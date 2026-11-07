// Funções utilitárias compartilhadas. Sem dependências externas: apenas módulos do Node.js.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

export const IS_WINDOWS = process.platform === "win32";

// Raiz do repositório (dois níveis acima de scripts/lib).
export const REPO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Pasta local do usuário. Fica FORA do repositório para não ser versionada por engano.
// Windows: %APPDATA%\ia-local   Linux: $XDG_CONFIG_HOME/ia-local ou ~/.config/ia-local
// Pode ser trocada com a variável IA_LOCAL_HOME (usada também nos testes).
export function localDir() {
  if (process.env.IA_LOCAL_HOME) return path.resolve(process.env.IA_LOCAL_HOME);
  if (IS_WINDOWS) {
    const base = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(base, "ia-local");
  }
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "ia-local");
}

export function localPath(...parts) {
  return path.join(localDir(), ...parts);
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson(file, fallback = undefined) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT" && fallback !== undefined) return fallback;
    if (err.code === "ENOENT") return undefined;
    throw new Error(`Não foi possível ler ${file}: ${err.message}`);
  }
}

// Grava JSON de forma atômica e, se o arquivo já existir, guarda uma cópia .bak.
export function writeJson(file, data, { backup = true } = {}) {
  ensureDir(path.dirname(file));
  if (backup && fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);
}

export function nowIso() {
  return new Date().toISOString();
}

export function gb(bytes) {
  return bytes / 1024 ** 3;
}

export function fmtGb(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "?";
  return `${Number(value).toFixed(digits)} GB`;
}

// Executa um comando e devolve a saída, sem lançar erro. Usado no diagnóstico.
// No Windows, programas instalados pelo npm são arquivos .cmd e precisam do shell.
export function runCapture(cmd, args = [], { timeoutMs = 8000, shell, env, cwd } = {}) {
  const useShell = shell ?? (IS_WINDOWS && !/\.exe$/i.test(cmd) && cmd !== "powershell");
  const result = spawnSync(useShell ? quoteForShell(cmd, args) : cmd, useShell ? [] : args, {
    encoding: "utf8",
    timeout: timeoutMs,
    shell: useShell,
    windowsHide: true,
    env: childEnv(env, cwd),
    cwd,
  });
  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    error: result.error,
  };
}

function quoteForShell(cmd, args) {
  const q = (s) => (/^[\w@%+=:,./\\-]+$/.test(s) ? s : `"${String(s).replace(/"/g, '\\"')}"`);
  return [cmd, ...args].map(q).join(" ");
}

// Executa um comando interativo herdando o terminal (progresso do download, interface do OpenCode).
export function runInteractive(cmd, args = [], { cwd, env } = {}) {
  return new Promise((resolve) => {
    const useShell = IS_WINDOWS && !/\.exe$/i.test(cmd) && cmd !== "ollama";
    const child = spawn(useShell ? quoteForShell(cmd, args) : cmd, useShell ? [] : args, {
      cwd,
      env: childEnv(env ? mergeEnv(env) : undefined, cwd),
      stdio: "inherit",
      shell: useShell,
    });
    child.on("error", (err) => resolve({ ok: false, code: null, error: err }));
    child.on("exit", (code, signal) => resolve({ ok: code === 0, code, signal }));
  });
}

// Junta variáveis ao ambiente atual; valor null remove a variável.
export function mergeEnv(extra) {
  const env = { ...process.env };
  for (const [k, v] of Object.entries(extra)) {
    if (v === null || v === undefined) delete env[k];
    else env[k] = v;
  }
  return env;
}

// Ambiente para processos filhos. No Windows, terminais como o Git Bash (MSYS) guardam a pasta atual
// em PWD no formato "/c/Users/...". Programas nativos que confiam em PWD (como o OpenCode 2) não
// conseguem entrar nessa pasta ("Failed to change directory"). Aqui PWD passa a ser a pasta real do
// processo filho, no formato do sistema. Em outros sistemas o ambiente não muda.
export function childEnv(env, cwd, { windows = IS_WINDOWS } = {}) {
  if (!windows) return env;
  const base = { ...(env ?? process.env) };
  for (const k of Object.keys(base)) if (k.toUpperCase() === "PWD") delete base[k];
  base.PWD = path.win32.resolve(cwd ?? process.cwd());
  return base;
}

export function commandExists(cmd) {
  const probe = IS_WINDOWS ? runCapture("where", [cmd], { shell: true }) : runCapture("sh", ["-c", `command -v ${cmd}`]);
  return probe.ok && probe.stdout.length > 0;
}

// ---------- Entrada do usuário ----------

// Leitura linha a linha com fila própria: funciona tanto no teclado quanto com entrada redirecionada
// (usada nos testes), sem perder linhas que chegam antes da pergunta.
let rl;
let ended = false;
const pending = [];
const waiters = [];

function getRl() {
  if (!rl) {
    ended = false;
    const tty = Boolean(process.stdin.isTTY && process.stdout.isTTY);
    rl = readline.createInterface({ input: process.stdin, output: tty ? process.stdout : undefined, terminal: tty });
    rl.on("line", (line) => {
      const w = waiters.shift();
      if (w) w.resolve(line);
      else pending.push(line);
    });
    rl.on("close", () => {
      rl = undefined;
      ended = true;
      while (waiters.length) waiters.shift().reject(new UserError("A entrada foi encerrada antes da resposta.", "Execute o comando novamente em um terminal interativo."));
    });
  }
  rl.resume();
  return rl;
}

function nextLine(prompt) {
  const tty = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (pending.length) {
    const line = pending.shift();
    process.stdout.write(`${prompt}${line}\n`);
    return Promise.resolve(line);
  }
  if (ended && !rl) return Promise.reject(new UserError("A entrada foi encerrada antes da resposta.", "Execute o comando novamente em um terminal interativo."));
  const r = getRl();
  if (tty) {
    r.setPrompt(prompt);
    r.prompt();
  } else {
    process.stdout.write(prompt);
  }
  return new Promise((resolve, reject) =>
    waiters.push({
      resolve: (line) => {
        if (!process.stdin.isTTY) process.stdout.write(`${line}\n`);
        resolve(line);
      },
      reject,
    })
  );
}

export function closeInput() {
  if (rl) rl.close();
}

// Suspende a leitura do teclado enquanto um programa filho mostra progresso (ex.: ollama pull).
export function pauseInput() {
  if (rl) rl.pause();
}

export async function ask(question, { defaultValue } = {}) {
  const suffix = defaultValue !== undefined && defaultValue !== "" ? ` [${defaultValue}]` : "";
  const answer = (await nextLine(`${question}${suffix}: `)).trim();
  return answer === "" && defaultValue !== undefined ? String(defaultValue) : answer;
}

export async function confirm(question, { defaultYes = false } = {}) {
  const hint = defaultYes ? "S/n" : "s/N";
  const answer = (await nextLine(`${question} (${hint}): `)).trim().toLowerCase();
  if (answer === "") return defaultYes;
  return ["s", "sim", "y", "yes"].includes(answer);
}

export async function choose(question, options, { defaultIndex } = {}) {
  options.forEach((opt, i) => console.log(`  ${i + 1}) ${opt}`));
  while (true) {
    const answer = await ask(question, { defaultValue: defaultIndex !== undefined ? defaultIndex + 1 : undefined });
    const n = Number(answer);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return n - 1;
    console.log(`Digite um número entre 1 e ${options.length}.`);
  }
}

export async function askNumber(question, { defaultValue, allowEmpty = false } = {}) {
  while (true) {
    const answer = await ask(question, { defaultValue });
    if (answer === "" && allowEmpty) return null;
    const n = Number(answer.replace(",", "."));
    if (Number.isFinite(n) && n >= 0) return n;
    console.log("Digite um número (use ponto ou vírgula para decimais) ou deixe em branco.");
  }
}

// ---------- Saída ----------

export function title(text) {
  console.log(`\n=== ${text} ===`);
}

export function warn(text) {
  console.log(`AVISO: ${text}`);
}

export class UserError extends Error {
  constructor(message, recovery) {
    super(message);
    this.recovery = recovery;
  }
}
