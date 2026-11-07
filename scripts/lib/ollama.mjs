// Comunicação com o Ollama local pela API HTTP documentada (docs/api.md do projeto Ollama)
// e pela linha de comando apenas para ações interativas (pull, create).
import fs from "node:fs";
import path from "node:path";
import { runCapture, runInteractive, commandExists, ensureDir, localPath, UserError } from "./util.mjs";

// Endereço do servidor. Padrão do Ollama: 127.0.0.1:11434 (somente esta máquina).
// Se OLLAMA_HOST estiver definido, ele é respeitado; 0.0.0.0 (endereço de escuta) vira 127.0.0.1 para o cliente.
export function baseUrl() {
  let host = (process.env.OLLAMA_HOST || "").trim();
  if (!host) return "http://127.0.0.1:11434";
  if (!/^https?:\/\//i.test(host)) host = `http://${host}`;
  const url = new URL(host);
  if (url.hostname === "0.0.0.0" || url.hostname === "[::]") url.hostname = "127.0.0.1";
  if (!url.port && url.protocol === "http:") url.port = "11434";
  return url.origin;
}

async function request(method, route, body, { timeoutMs = 5000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl()}${route}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export const OLLAMA_OFFLINE_HELP =
  "O serviço do Ollama não respondeu em " +
  "{url}. Verifique: (1) o Ollama está instalado? Rode 'ollama --version'. " +
  "(2) No Windows, abra o Ollama pelo menu Iniciar (ele fica na bandeja do sistema). " +
  "(3) No Ubuntu, rode 'systemctl status ollama' e, se estiver parado, 'sudo systemctl start ollama'. " +
  "Veja docs/problemas.md, seção 'Ollama indisponível'.";

export async function status() {
  const cliInstalled = commandExists("ollama");
  let cliVersion = null;
  if (cliInstalled) {
    const r = runCapture("ollama", ["--version"]);
    const m = `${r.stdout}\n${r.stderr}`.match(/(\d+\.\d+\.\d+[\w.-]*)/);
    cliVersion = m ? m[1] : null;
  }
  try {
    const v = await request("GET", "/api/version");
    return { cliInstalled, cliVersion, online: true, serverVersion: v.version || null, url: baseUrl() };
  } catch (err) {
    return { cliInstalled, cliVersion, online: false, serverVersion: null, url: baseUrl(), error: err.message };
  }
}

export async function requireOnline() {
  const s = await status();
  if (!s.online) throw new UserError("O Ollama não está disponível.", OLLAMA_OFFLINE_HELP.replace("{url}", s.url));
  return s;
}

export async function listModels() {
  const data = await request("GET", "/api/tags");
  return (data.models || []).map((m) => ({
    name: m.name || m.model,
    sizeBytes: m.size || 0,
    modifiedAt: m.modified_at,
    details: m.details || {},
    remote: Boolean(m.remote_host) || /(:|-)cloud$/.test(m.name || ""),
  }));
}

export async function show(model) {
  return request("POST", "/api/show", { model }, { timeoutMs: 15000 });
}

export async function running() {
  const data = await request("GET", "/api/ps");
  return data.models || [];
}

// Carrega o modelo na memória sem gerar texto (requisição sem prompt) e devolve o que o /api/ps reporta.
export async function loadAndMeasure(model, { timeoutMs = 600000 } = {}) {
  const started = Date.now();
  await request("POST", "/api/generate", { model }, { timeoutMs });
  const loadSeconds = (Date.now() - started) / 1000;
  const ps = await running();
  const entry = ps.find((m) => m.name === model || m.model === model) || null;
  return { loadSeconds, entry };
}

export function isCloudName(name) {
  return /(:|-)cloud$/i.test(name) || /:cloud\b/i.test(name);
}

// Download pelo comando oficial (mostra progresso nativo do Ollama).
export async function pull(tag) {
  if (!commandExists("ollama")) {
    throw new UserError("O comando 'ollama' não foi encontrado.", "Instale o Ollama seguindo o manual do seu sistema em docs/.");
  }
  const result = await runInteractive("ollama", ["pull", tag]);
  if (!result.ok) {
    throw new UserError(
      `O download de ${tag} não terminou (código ${result.code ?? result.error?.message}).`,
      "Verifique a conexão e o espaço livre e execute a mesma opção novamente. " +
        "Para descartar uma tentativa incompleta, veja docs/problemas.md, seção 'Download interrompido'."
    );
  }
}

// Nome do modelo derivado com a janela de contexto fixada (ex.: ia-local-qwen3.5-9b:64k).
export function derivedName(catalogId, contextTokens) {
  return `ia-local-${catalogId}:${Math.round(contextTokens / 1024)}k`;
}

// Cria um modelo derivado com PARAMETER num_ctx, como recomenda a documentação do Ollama
// para clientes que usam a API compatível com OpenAI (o OpenCode é um deles).
// Não altera o serviço do Ollama nem afeta outros modelos; não baixa os pesos de novo.
export async function createDerived(baseTag, name, contextTokens) {
  const dir = ensureDir(localPath("modelfiles"));
  const file = path.join(dir, `${name.replace(/[:/\\]/g, "_")}.Modelfile`);
  const content =
    `# Gerado por scripts/ia-local.mjs. Pode ser apagado; recrie pela opção de seleção.\n` +
    `FROM ${baseTag}\nPARAMETER num_ctx ${contextTokens}\n`;
  fs.writeFileSync(file, content, "utf8");
  const result = await runInteractive("ollama", ["create", name, "-f", file]);
  if (!result.ok) {
    throw new UserError(
      `Não foi possível criar ${name} a partir de ${baseTag}.`,
      `Confirme que '${baseTag}' aparece em 'ollama list'. O arquivo usado está em ${file}.`
    );
  }
  return file;
}
