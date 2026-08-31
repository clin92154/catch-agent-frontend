#!/usr/bin/env node

import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_ROOT = resolve(REPO_ROOT, "..");
const RUNTIME_DIR = join(REPO_ROOT, ".demo-runtime");
const STATE_FILE = join(RUNTIME_DIR, "state.json");

const REPOS = {
  agentBackend: resolve(WORKSPACE_ROOT, "demo_agent_bot_crm_integrate"),
  agentFrontend: REPO_ROOT,
  crmBackend: resolve(WORKSPACE_ROOT, "aposo_crm_ai_marketing_admin"),
  crmFrontend: resolve(WORKSPACE_ROOT, "aposo_crm_frontend_agent_adapter"),
};

const DEFAULTS = {
  agentBackendPort: 8002,
  agentFrontendPort: 5176,
  // Demo CRM Backend must stay separate from the primary CRM development port.
  crmBackendPort: 8012,
  crmFrontendPort: 5175,
  crmDatabaseUrl: "postgresql://shihtengchang@127.0.0.1:5432/crm_agent_demo_dev",
  crmEnvFile: resolve(WORKSPACE_ROOT, "aposo_crm_security_refactor/.env.crud-bench"),
};

const ALL_SERVICE_ORDER = ["crmBackend", "agentBackend", "crmFrontend", "agentFrontend"];

function parseEnvFile(filePath) {
  if (!filePath || !existsSync(filePath)) return {};
  const values = {};
  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function loadDemoEnv() {
  const configuredFile = process.env.DEMO_ENV_FILE || join(REPO_ROOT, ".env.demo");
  const demoFile = isAbsolute(configuredFile) ? configuredFile : resolve(REPO_ROOT, configuredFile);
  return { ...parseEnvFile(demoFile), ...process.env, DEMO_ENV_FILE: demoFile };
}

function value(env, key, fallback = "") {
  return String(env[key] ?? fallback).trim();
}

function booleanValue(env, key, fallback = false) {
  const raw = value(env, key, fallback ? "true" : "false").toLowerCase();
  return ["1", "true", "yes", "on"].includes(raw);
}

function resolveConfiguredPath(rawPath, fallback) {
  const candidate = rawPath || fallback;
  return isAbsolute(candidate) ? candidate : resolve(REPO_ROOT, candidate);
}

function buildConfig() {
  const env = loadDemoEnv();
  const crmMode = value(env, "DEMO_CRM_MODE", "fake").toLowerCase();
  if (!["fake", "http"].includes(crmMode)) throw new Error("DEMO_CRM_MODE 僅支援 fake 或 http");
  const agentFile = resolveConfiguredPath(env.DEMO_AGENT_ENV_FILE, join(REPOS.agentBackend, ".env"));
  const crmFile = resolveConfiguredPath(env.DEMO_CRM_ENV_FILE, DEFAULTS.crmEnvFile);
  const crmFrontendFile = resolveConfiguredPath(env.DEMO_CRM_FRONTEND_ENV_FILE, join(REPOS.crmFrontend, ".env.dev"));
  const agentBase = parseEnvFile(agentFile);
  const crmBase = parseEnvFile(crmFile);
  const crmFrontendBase = parseEnvFile(crmFrontendFile);

  const ports = {
    agentBackend: Number(value(env, "DEMO_AGENT_BACKEND_PORT", DEFAULTS.agentBackendPort)),
    agentFrontend: Number(value(env, "DEMO_AGENT_FRONTEND_PORT", DEFAULTS.agentFrontendPort)),
    crmBackend: Number(value(env, "DEMO_CRM_BACKEND_PORT", DEFAULTS.crmBackendPort)),
    crmFrontend: Number(value(env, "DEMO_CRM_FRONTEND_PORT", DEFAULTS.crmFrontendPort)),
  };
  const allowExternalLlm = booleanValue(env, "DEMO_ALLOW_EXTERNAL_LLM");
  const crmDatabaseUrl = value(env, "DEMO_CRM_DATABASE_URL", DEFAULTS.crmDatabaseUrl);
  // CRM Frontend and CRM Backend must share the same dev database identity.
  // Prefer the Agent Adapter credential because it is the credential already
  // verified against the selected CRM backend; the frontend value can belong
  // to another local database snapshot.
  const crmAccount = value(env, "DEMO_CRM_ADMIN_ACCOUNT", agentBase.CRM_API_ACCOUNT || crmFrontendBase.VITE_DEV_LOGIN_ACCOUNT);
  const crmPassword = value(env, "DEMO_CRM_ADMIN_PASSWORD", agentBase.CRM_API_PASSWORD || crmFrontendBase.VITE_DEV_LOGIN_PASSWORD);

  const agentEnv = {
    ...agentBase,
    ...env,
    LLM_MODE: value(env, "DEMO_LLM_MODE", "demo"),
    STORE_METADATA_MODE: value(env, "DEMO_STORE_METADATA_MODE", "csv"),
    STORE_MASTER_CSV_PATH: value(
      env,
      "DEMO_STORE_MASTER_CSV_PATH",
      "mock_data/official_store_master.csv",
    ),
    STORE_LOCATIONS_CSV_PATH: value(
      env,
      "DEMO_STORE_LOCATIONS_CSV_PATH",
      "mock_data/store_locations.csv",
    ),
    CRM_ADAPTER_MODE: crmMode,
    ...(crmMode === "http" ? {
      CRM_API_BASE_URL: `http://127.0.0.1:${ports.crmBackend}`,
      CRM_API_ACCOUNT: crmAccount,
      CRM_API_PASSWORD: crmPassword,
    } : {
      CRM_API_BASE_URL: "",
      CRM_API_TOKEN: "",
      CRM_API_ACCOUNT: "",
      CRM_API_PASSWORD: "",
    }),
    CORS_ALLOWED_ORIGINS: [
      agentBase.CORS_ALLOWED_ORIGINS,
      `http://127.0.0.1:${ports.agentFrontend}`,
      `http://localhost:${ports.agentFrontend}`,
    ].filter(Boolean).join(","),
  };
  const crmEnv = {
    ...crmBase,
    ...env,
    DATABASE_URL: crmDatabaseUrl,
    CRM_SCHEDULER_ENABLED: "false",
    CRM_CORS_ALLOWED_ORIGINS: [
      crmBase.CRM_CORS_ALLOWED_ORIGINS,
      `http://127.0.0.1:${ports.crmFrontend}`,
      `http://localhost:${ports.crmFrontend}`,
    ].filter(Boolean).join(","),
  };
  const crmFrontendEnv = {
    ...crmFrontendBase,
    ...env,
    VITE_APP_ENV: "dev",
    VITE_DEV_HOST: "127.0.0.1",
    VITE_DEV_PORT: String(ports.crmFrontend),
    VITE_DEV_API_PROXY: `http://127.0.0.1:${ports.crmBackend}`,
    VITE_API_BASE: "/aposo",
    VITE_DEV_LOGIN_ACCOUNT: crmAccount,
    VITE_DEV_LOGIN_PASSWORD: crmPassword,
  };
  const agentFrontendEnv = {
    ...env,
    VITE_PROXY_TARGET: `http://127.0.0.1:${ports.agentBackend}`,
  };

  return { env, files: { agentFile, crmFile, crmFrontendFile }, ports, crmMode, crmDatabaseUrl, crmAccount, crmPassword, allowExternalLlm, agentEnv, crmEnv, crmFrontendEnv, agentFrontendEnv };
}

function serviceOrder(config) {
  return config.crmMode === "http"
    ? ALL_SERVICE_ORDER
    : ["agentBackend", "agentFrontend"];
}

function assertRepo(name, path) {
  if (!existsSync(path)) throw new Error(`${name} repo 不存在：${path}`);
}

function assertPort(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`port 無效：${port}`);
}

function validateConfig(config) {
  assertRepo("agentBackend", REPOS.agentBackend);
  assertRepo("agentFrontend", REPOS.agentFrontend);
  if (config.crmMode === "http") {
    assertRepo("crmBackend", REPOS.crmBackend);
    assertRepo("crmFrontend", REPOS.crmFrontend);
  }
  for (const port of Object.values(config.ports)) assertPort(port);
  if (!existsSync(config.files.agentFile)) throw new Error(`找不到 Agent env：${config.files.agentFile}`);
  if (config.crmMode === "http") {
    if (!config.crmDatabaseUrl.startsWith("postgresql")) throw new Error("DEMO_CRM_DATABASE_URL 必須是 PostgreSQL URL");
    const databaseName = config.crmDatabaseUrl.split("/").pop()?.split("?")[0] || "";
    if (!/(dev|demo|test)/i.test(databaseName) || /(stage|staging|prod|production)/i.test(databaseName)) {
      throw new Error(`拒絕使用非開發資料庫：${databaseName}`);
    }
    if (!existsSync(config.files.crmFile)) throw new Error(`找不到 CRM env：${config.files.crmFile}`);
    if (!config.crmAccount || !config.crmPassword) throw new Error("缺少 CRM Demo 登入帳密；請設定 DEMO_CRM_ADMIN_ACCOUNT／DEMO_CRM_ADMIN_PASSWORD，或在 Agent .env 設定 CRM_API_ACCOUNT／CRM_API_PASSWORD");
  }
  if (!config.agentEnv.LLM_MODE || !["demo", "openai", "gemini"].includes(config.agentEnv.LLM_MODE)) {
    throw new Error("DEMO_LLM_MODE 僅支援 demo、openai 或 gemini");
  }
  if (config.agentEnv.LLM_MODE !== "demo" && !config.allowExternalLlm) {
    throw new Error("使用外部 LLM 前，請明確設定 DEMO_ALLOW_EXTERNAL_LLM=true");
  }
  if (config.agentEnv.LLM_MODE !== "demo") {
    const agentEnv = parseEnvFile(config.files.agentFile);
    const hasApiKey = Boolean(
      value(config.env, "LLM_API_KEY")
      || value(config.env, "OPENAI_API_KEY")
      || value(agentEnv, "LLM_API_KEY")
      || value(agentEnv, "OPENAI_API_KEY")
    );
    if (!hasApiKey) throw new Error("外部 LLM 模式缺少 API Key");
  }
  if (config.agentEnv.CRM_ADAPTER_MODE !== config.crmMode) throw new Error("CRM Adapter 模式設定不一致");
}

function redact(valueToRedact) {
  if (!valueToRedact) return "<未設定>";
  return "<已設定>";
}

function printConfig(config) {
  console.log("Demo 環境檢查通過：");
  console.log(`- Agent Backend：${REPOS.agentBackend} → :${config.ports.agentBackend}`);
  console.log(`- Agent Frontend：${REPOS.agentFrontend} → :${config.ports.agentFrontend}`);
  console.log(`- CRM Adapter：${config.crmMode === "fake" ? "示範資料（不連線 CRM）" : "HTTP CRM Demo"}`);
  if (config.crmMode === "http") {
    console.log(`- CRM Backend：${REPOS.crmBackend} → :${config.ports.crmBackend}`);
    console.log(`- CRM Frontend：${REPOS.crmFrontend} → :${config.ports.crmFrontend}/aposo/`);
    console.log(`- CRM DB：${config.crmDatabaseUrl.replace(/:\/\/.*@/, "://<redacted>@")}`);
  }
  console.log(`- LLM_MODE：${config.agentEnv.LLM_MODE}`);
  console.log(`- External LLM：${config.allowExternalLlm ? "enabled" : "disabled"}`);
  console.log(`- CRM_ADAPTER_MODE：${config.agentEnv.CRM_ADAPTER_MODE}`);
  if (config.crmMode === "http") {
    console.log(`- CRM API account：${config.crmAccount}`);
    console.log(`- CRM API password：${redact(config.crmPassword)}`);
  }
  console.log(`- Agent env：${config.files.agentFile}`);
  if (config.crmMode === "http") console.log(`- CRM frontend env：${config.files.crmFrontendFile}`);
}

async function fetchStatus(url, timeoutMs = 1200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function serviceHealth(name, config) {
  const port = config.ports[name];
  const url = name === "agentBackend" ? `http://127.0.0.1:${port}/health`
    : name === "crmBackend" ? `http://127.0.0.1:${port}/health`
      : name === "crmFrontend" ? `http://127.0.0.1:${port}/aposo/`
        : `http://127.0.0.1:${port}/`;
  return { ...await fetchStatus(url), url };
}

function readState() {
  if (!existsSync(STATE_FILE)) return { services: {} };
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch { return { services: {} }; }
}

function saveState(state) {
  mkdirSync(RUNTIME_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

function commandFor(name, config) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  if (name === "crmBackend") return { command: "uv", args: ["run", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", String(config.ports.crmBackend)], cwd: REPOS.crmBackend, env: config.crmEnv };
  if (name === "agentBackend") return { command: "uv", args: ["run", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(config.ports.agentBackend)], cwd: REPOS.agentBackend, env: config.agentEnv };
  if (name === "crmFrontend") return { command: npmCommand, args: ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(config.ports.crmFrontend)], cwd: REPOS.crmFrontend, env: config.crmFrontendEnv };
  return { command: npmCommand, args: ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(config.ports.agentFrontend)], cwd: REPOS.agentFrontend, env: config.agentFrontendEnv };
}

function startProcess(name, spec) {
  mkdirSync(RUNTIME_DIR, { recursive: true });
  const output = openSync(join(RUNTIME_DIR, `${name}.log`), "a");
  const child = spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    env: { ...process.env, ...spec.env },
    detached: true,
    stdio: ["ignore", output, output],
  });
  child.unref();
  return child.pid;
}

function stopPid(pid) {
  if (!pid) return;
  try { process.kill(-pid, "SIGTERM"); } catch { try { process.kill(pid, "SIGTERM"); } catch {} }
}

async function waitFor(name, config, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await serviceHealth(name, config);
    if (result.ok) return result;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  return serviceHealth(name, config);
}

async function checkEnv() {
  const config = buildConfig();
  validateConfig(config);
  printConfig(config);
}

async function up() {
  const config = buildConfig();
  validateConfig(config);
  printConfig(config);
  const state = { startedAt: new Date().toISOString(), config: config.ports, services: {} };
  for (const name of serviceOrder(config)) {
    const before = await serviceHealth(name, config);
    if (before.ok) {
      state.services[name] = { reused: true, pid: null, url: before.url };
      console.log(`✓ ${name} 已在執行：${before.url}`);
      continue;
    }
    const pid = startProcess(name, commandFor(name, config));
    state.services[name] = { reused: false, pid, url: before.url };
    saveState(state);
    const ready = await waitFor(name, config);
    if (!ready.ok) {
      console.error(`✗ ${name} 啟動失敗，請查看 ${join(RUNTIME_DIR, `${name}.log`)}`);
      await down(false);
      process.exitCode = 1;
      return;
    }
    console.log(`✓ ${name} 已啟動：${ready.url}`);
  }
  saveState(state);
  console.log("\nDemo 全部服務已開啟：");
  console.log(`- Agent 前端：http://127.0.0.1:${config.ports.agentFrontend}/`);
  console.log(`- Agent API：http://127.0.0.1:${config.ports.agentBackend}/docs`);
  if (config.crmMode === "http") {
    console.log(`- CRM 後台：http://127.0.0.1:${config.ports.crmFrontend}/aposo/`);
    console.log(`- CRM API：http://127.0.0.1:${config.ports.crmBackend}/docs`);
  }
}

async function down(print = true) {
  const state = readState();
  let stopped = 0;
  for (const [name, service] of Object.entries(state.services || {})) {
    if (service.pid && !service.reused) {
      stopPid(service.pid);
      console.log(`✓ 已停止 ${name}（PID ${service.pid}）`);
      stopped += 1;
    }
  }
  if (existsSync(STATE_FILE)) rmSync(STATE_FILE);
  if (print && stopped === 0) console.log("沒有由 Demo 控制層啟動的服務；外部既有服務未停止。");
}

async function status() {
  const config = buildConfig();
  validateConfig(config);
  for (const name of serviceOrder(config)) {
    const result = await serviceHealth(name, config);
    console.log(`${result.ok ? "✓" : "✗"} ${name.padEnd(14)} ${result.status || "offline"} ${result.url}`);
  }
}

function logs() {
  mkdirSync(RUNTIME_DIR, { recursive: true });
  const files = readdirSync(RUNTIME_DIR).filter((file) => file.endsWith(".log"));
  if (!files.length) {
    console.log("尚無 Demo log；請先執行 npm run demo:up");
    return;
  }
  console.log(files.map((file) => `- ${join(RUNTIME_DIR, file)}`).join("\n"));
}

const action = process.argv[2] || "status";
try {
  if (action === "check-env") await checkEnv();
  else if (action === "up") await up();
  else if (action === "down") await down();
  else if (action === "status") await status();
  else if (action === "logs") logs();
  else throw new Error(`未知命令：${action}（可用：check-env、up、down、status、logs）`);
} catch (error) {
  console.error(`Demo 控制失敗：${error.message}`);
  process.exitCode = 1;
}
