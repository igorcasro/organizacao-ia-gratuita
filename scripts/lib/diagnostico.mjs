// Diagnóstico do computador. Usa apenas o que o sistema já oferece:
// Node.js (os, fs), nvidia-smi quando existir, /sys e lspci no Linux, PowerShell/CIM no Windows.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { IS_WINDOWS, runCapture, gb, nowIso, localPath, readJson, writeJson, ask, askNumber, confirm, fmtGb, title } from "./util.mjs";
import * as ollama from "./ollama.mjs";
import * as opencode from "./opencode.mjs";
import * as gpu from "./gpu.mjs";

export const DIAG_FILE = () => localPath("diagnostico.json");

function osInfo() {
  let nome = `${os.type()} ${os.release()}`;
  if (process.platform === "linux") {
    try {
      const txt = fs.readFileSync("/etc/os-release", "utf8");
      const m = txt.match(/^PRETTY_NAME="?([^"\n]+)"?/m);
      if (m) nome = m[1];
    } catch {}
    if (/microsoft/i.test(os.release())) nome += " (WSL)";
  } else if (IS_WINDOWS) {
    const r = runCapture("powershell", ["-NoProfile", "-Command", "(Get-CimInstance Win32_OperatingSystem).Caption"]);
    if (r.ok && r.stdout) nome = r.stdout;
  }
  return { plataforma: process.platform, nome, arquitetura: os.arch() };
}

function cpuInfo() {
  const cpus = os.cpus() || [];
  return { modelo: cpus[0]?.model?.trim() || null, nucleos_logicos: cpus.length || null };
}

// Pasta onde o Ollama guarda os modelos (docs/faq.mdx do Ollama, "Where are models stored?").
export function ollamaModelsDir() {
  if (process.env.OLLAMA_MODELS) return { caminho: process.env.OLLAMA_MODELS, fonte: "variável OLLAMA_MODELS" };
  if (IS_WINDOWS) return { caminho: path.join(os.homedir(), ".ollama", "models"), fonte: "padrão do Windows" };
  if (fs.existsSync("/usr/share/ollama/.ollama/models")) return { caminho: "/usr/share/ollama/.ollama/models", fonte: "padrão do serviço Linux" };
  if (process.platform === "linux") return { caminho: "/usr/share/ollama/.ollama/models", fonte: "padrão do serviço Linux (ainda não criado)" };
  return { caminho: path.join(os.homedir(), ".ollama", "models"), fonte: "padrão" };
}

export function freeSpaceGb(dir) {
  let p = path.resolve(dir);
  while (!fs.existsSync(p)) {
    const parent = path.dirname(p);
    if (parent === p) break;
    p = parent;
  }
  try {
    const s = fs.statfsSync(p);
    return { livre_gb: gb(s.bavail * s.bsize), medido_em: p };
  } catch {
    return { livre_gb: null, medido_em: p };
  }
}

export async function collect() {
  const modelsDir = ollamaModelsDir();
  const disco = freeSpaceGb(modelsDir.caminho);
  const ol = await ollama.status();
  const oc = opencode.detect();
  const node = process.versions.node;
  const g = gpu.detect();
  const gpus = g.gpus.map((x) => ({ ...x, aceleracao_esperada: gpu.expectedBackend(x) }));
  return {
    versao_esquema: 1,
    coletado_em: nowIso(),
    sistema: osInfo(),
    cpu: cpuInfo(),
    memoria: { ram_total_gb: gb(os.totalmem()), ram_livre_gb: gb(os.freemem()) },
    gpus,
    gpu_linux: g.linux,
    disco: { pasta_modelos: modelsDir.caminho, fonte_pasta: modelsDir.fonte, ...disco },
    software: {
      node,
      ollama: { instalado: ol.cliInstalled, versao_cli: ol.cliVersion, servico_online: ol.online, versao_servico: ol.serverVersion, endereco: ol.url },
      opencode: oc,
    },
    manual: {},
  };
}

// Valores efetivos usados pela recomendação: o preenchimento manual tem prioridade sobre o detectado.
export function effective(diag) {
  const m = diag.manual || {};
  const gpus = diag.gpus || [];
  const dedicated = gpus.filter((g) => g.tipo === "dedicada" && g.vram_gb);
  const vramDetected = dedicated.length ? Math.max(...dedicated.map((g) => g.vram_gb)) : 0;
  return {
    ram_gb: m.ram_total_gb ?? diag.memoria?.ram_total_gb ?? null,
    vram_gb: m.vram_gb ?? vramDetected,
    gpu_integrada: gpus.some((g) => g.tipo === "integrada"),
    gpu_dedicada_sem_vram: gpus.some((g) => (g.tipo === "dedicada" || g.tipo === "desconhecida") && !g.vram_gb) && m.vram_gb === undefined,
    disco_livre_gb: m.disco_livre_gb ?? diag.disco?.livre_gb ?? null,
  };
}

export function print(diag) {
  title("Diagnóstico");
  const e = effective(diag);
  console.log(`Sistema: ${diag.sistema.nome} (${diag.sistema.arquitetura})`);
  console.log(`Processador: ${diag.cpu.modelo ?? "não detectado"} — ${diag.cpu.nucleos_logicos ?? "?"} núcleos lógicos`);
  console.log(`RAM total: ${fmtGb(diag.memoria.ram_total_gb)} (livre agora: ${fmtGb(diag.memoria.ram_livre_gb)})`);
  if (!diag.gpus.length) console.log("GPU: nenhuma GPU detectada (ou detecção indisponível).");
  for (const g of diag.gpus) {
    const mem = g.vram_gb ? `, ${fmtGb(g.vram_gb)} de VRAM` : g.tipo === "integrada" ? ", usa a RAM do sistema" : "";
    console.log(`GPU: ${g.nome} — ${g.fabricante}, ${g.tipo}${mem} [fonte: ${g.fonte}]`);
    if (g.aceleracao_esperada) console.log(`     Aceleração esperada no Ollama: ${g.aceleracao_esperada}`);
  }
  const precisaVulkan = (diag.gpus || []).some((g) => g.tipo !== "virtual" && (g.fabricante === "AMD" || g.fabricante === "Intel"));
  if (precisaVulkan && diag.gpu_linux?.vulkan) {
    const v = diag.gpu_linux.vulkan;
    console.log(`Drivers Vulkan: ${v.arquivos.length ? v.arquivos.join(", ") : "nenhum encontrado"}`);
  }
  for (const msg of gpu.advice(diag.gpus || [], diag.gpu_linux)) console.log(`AVISO: ${msg}`);
  console.log(`Espaço livre para modelos: ${fmtGb(diag.disco.livre_gb)} em ${diag.disco.medido_em} (pasta de modelos: ${diag.disco.pasta_modelos})`);
  const s = diag.software;
  console.log(`Node.js: ${s.node}`);
  console.log(
    `Ollama: ${s.ollama.instalado ? `instalado (CLI ${s.ollama.versao_cli ?? "?"})` : "não encontrado"}; serviço ${s.ollama.servico_online ? `online em ${s.ollama.endereco} (versão ${s.ollama.versao_servico})` : "não respondeu"}`
  );
  console.log(`OpenCode: ${s.opencode.instalado ? `instalado (versão ${s.opencode.versao ?? "?"}, major ${s.opencode.major ?? "?"})` : "não encontrado"}`);
  const manual = Object.keys(diag.manual || {});
  if (manual.length) console.log(`Valores informados manualmente: ${manual.join(", ")}`);
  console.log(`\nValores usados na recomendação: RAM ${fmtGb(e.ram_gb)}, VRAM dedicada ${fmtGb(e.vram_gb)}, disco livre ${fmtGb(e.disco_livre_gb)}`);
  if (e.gpu_dedicada_sem_vram) console.log("AVISO: há GPU dedicada (ou de tipo desconhecido) sem memória detectada. Informe a VRAM manualmente (diagnóstico --manual); se ela for integrada, informe 0.");
}

export async function manualFill(diag) {
  title("Preenchimento manual");
  console.log("Deixe em branco para manter o valor detectado. Veja como consultar cada valor no manual do seu sistema (docs/).");
  const m = { ...(diag.manual || {}) };
  const ram = await askNumber(`RAM total em GB (detectado: ${fmtGb(diag.memoria.ram_total_gb)})`, { allowEmpty: true });
  if (ram !== null) m.ram_total_gb = ram;
  const vram = await askNumber(`VRAM da GPU dedicada em GB, 0 se não houver (detectado: ${fmtGb(effective(diag).vram_gb)})`, { allowEmpty: true });
  if (vram !== null) m.vram_gb = vram;
  const disk = await askNumber(`Espaço livre em GB no disco dos modelos (detectado: ${fmtGb(diag.disco.livre_gb)})`, { allowEmpty: true });
  if (disk !== null) m.disco_livre_gb = disk;
  const gpuName = await ask("Nome da GPU (opcional)", { defaultValue: "" });
  if (gpuName) m.gpu_nome = gpuName;
  diag.manual = m;
  return diag;
}

export function load() {
  return readJson(DIAG_FILE());
}

export function save(diag) {
  writeJson(DIAG_FILE(), diag);
}

export async function run({ manual = false } = {}) {
  const previous = load();
  const diag = await collect();
  if (previous?.manual) diag.manual = previous.manual;
  print(diag);
  const e = effective(diag);
  const needsManual = manual || e.ram_gb === null || e.disco_livre_gb === null || e.gpu_dedicada_sem_vram;
  if (needsManual && (manual || (await confirm("Alguns valores não foram detectados. Deseja informá-los agora?", { defaultYes: true })))) {
    await manualFill(diag);
    print(diag);
  }
  save(diag);
  console.log(`\nDiagnóstico salvo em ${DIAG_FILE()} (arquivo local, fora do repositório).`);
  return diag;
}
