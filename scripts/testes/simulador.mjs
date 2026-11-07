// Simulador mínimo do Ollama e do OpenCode, só para os testes automatizados dos scripts.
// Não é usado no fluxo real. Responde às rotas da API usadas por scripts/lib/ollama.mjs.
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function startOllamaMock({ models = [], version = "0.40.15" } = {}) {
  const state = { models: new Map(models.map((m) => [m.name, m])), loaded: new Map() };
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const json = body ? JSON.parse(body) : {};
    const send = (code, data) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(data));
    };
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/api/version") return send(200, { version });
    if (url.pathname === "/api/tags") return send(200, { models: [...state.models.values()].map((m) => ({ name: m.name, model: m.name, size: m.size ?? 5e9, details: {} })) });
    if (url.pathname === "/api/show") {
      const m = state.models.get(json.model);
      if (!m) return send(404, { error: `model '${json.model}' not found` });
      return send(200, { capabilities: m.caps ?? ["completion", "tools"], details: { parameter_size: "9B", quantization_level: "Q4_K_M" }, license: "Apache License\nVersion 2.0" });
    }
    if (url.pathname === "/api/generate") {
      const m = state.models.get(json.model);
      if (!m) return send(404, { error: `model '${json.model}' not found` });
      state.loaded.set(m.name, m);
      return send(200, { done: true });
    }
    if (url.pathname === "/api/ps") {
      return send(200, { models: [...state.loaded.values()].map((m) => ({ name: m.name, model: m.name, size: m.size ?? 5e9, size_vram: m.size_vram ?? 0, context_length: m.ctx ?? 4096 })) });
    }
    if (url.pathname === "/_mock/add") {
      state.models.set(json.name, json);
      return send(200, {});
    }
    send(404, { error: "not found" });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port, state, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

// Cria executáveis falsos "ollama" e "opencode" (Linux/macOS) que registram as chamadas.
export function fakeBinaries(port, { opencodeVersion = "2.2.6" } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ia-local-bin-"));
  const log = path.join(dir, "chamadas.log");
  const ollama = `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ bin: "ollama", args, OPENCODE_CONFIG: process.env.OPENCODE_CONFIG || null, OPENCODE_DISABLE_FREE_MODELS: process.env.OPENCODE_DISABLE_FREE_MODELS || null, OPENCODE_DISABLE_MODELS_FETCH: process.env.OPENCODE_DISABLE_MODELS_FETCH || null, OPENCODE_DISABLE_PROJECT_CONFIG: process.env.OPENCODE_DISABLE_PROJECT_CONFIG || null, cwd: process.cwd() }) + "\\n");
const add = (body) => fetch("http://127.0.0.1:${port}/_mock/add", { method: "POST", body: JSON.stringify(body) });
(async () => {
  if (args[0] === "--version") { console.log("ollama version is 0.40.15"); return; }
  if (args[0] === "pull") { await add({ name: args[1], caps: ["completion", "tools"], ctx: 4096 }); console.log("success"); return; }
  if (args[0] === "create") {
    const file = args[args.indexOf("-f") + 1];
    const txt = fs.readFileSync(file, "utf8");
    const ctx = Number((txt.match(/num_ctx (\\d+)/) || [])[1] || 4096);
    await add({ name: args[1], caps: ["completion", "tools"], ctx, size: 8e9, size_vram: 8e9 });
    console.log("success"); return;
  }
  if (args[0] === "launch") { console.log("launch simulado"); return; }
  process.exit(1);
})();
`;
  // OpenCode falso: registra argumentos e variáveis; em "models" aplica as políticas de OPENCODE_CONFIG
  // de forma simplificada (só para testar o script, não o OpenCode).
  const opencode = `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ bin: "opencode", args, OPENCODE_CONFIG: process.env.OPENCODE_CONFIG || null, OPENCODE_API_KEY: process.env.OPENCODE_API_KEY || null, OPENCODE_DISABLE_FREE_MODELS: process.env.OPENCODE_DISABLE_FREE_MODELS || null, OPENCODE_DISABLE_AUTOUPDATE: process.env.OPENCODE_DISABLE_AUTOUPDATE || null, OPENCODE_DISABLE_CLAUDE_CODE: process.env.OPENCODE_DISABLE_CLAUDE_CODE || null, OPENCODE_DISABLE_MODELS_FETCH: process.env.OPENCODE_DISABLE_MODELS_FETCH || null, OPENCODE_DISABLE_PROJECT_CONFIG: process.env.OPENCODE_DISABLE_PROJECT_CONFIG || null, cwd: process.cwd() }) + "\\n");
if (args[0] === "--version") { console.log(${JSON.stringify(opencodeVersion)}); process.exit(0); }
if (args[0] === "models") {
  const all = ["opencode/deepseek-v4.1-flash-free", "opencode/big-pickle", "anthropic/claude-sonnet-5-5", "ollama/qwen3.5:9b"];
  let allow = null;
  try {
    const cfg = JSON.parse(fs.readFileSync(process.env.OPENCODE_CONFIG, "utf8"));
    allow = cfg.policies.filter((p) => p.action === "provider.use" && p.effect === "allow").map((p) => p.resource);
  } catch {}
  for (const m of all) if (!allow || allow.includes(m.split("/")[0])) console.log(m);
  process.exit(0);
}
if (args[0] === "run") { console.log("OK"); process.exit(0); }
`;
  fs.writeFileSync(path.join(dir, "ollama"), ollama, { mode: 0o755 });
  fs.writeFileSync(path.join(dir, "opencode"), opencode, { mode: 0o755 });
  const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
  return { dir, calls };
}
