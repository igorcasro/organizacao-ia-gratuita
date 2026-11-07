// Detecção de GPUs NVIDIA, AMD e Intel (dedicadas e integradas) no Windows e no Linux.
// Usa só o que o sistema oferece: nvidia-smi, /sys, lspci, registro do Windows e CIM.
// As regras de "integrada x dedicada" no Linux seguem as do próprio Ollama (discover/amd.go, v0.40.15).
import fs from "node:fs";
import path from "node:path";
import { IS_WINDOWS, runCapture, gb } from "./util.mjs";

const VENDORS = { "0x10de": "NVIDIA", "0x1002": "AMD", "0x8086": "Intel" };

// Adaptadores virtuais ou de software: não aceleram modelos.
const VIRTUAL = /microsoft basic|llvmpipe|softpipe|vmware|virtualbox|virtio|qxl|bochs|cirrus|hyper-v|parallels|remote display/i;

// Nomes de GPUs integradas (Windows usa o nome comercial; lspci, o codinome do chip).
const INTEGRATED = [
  /intel.*\b(uhd|iris|hd graphics)\b/i,
  /intel.*arc(\(tm\))?\s*(graphics\b|\d{3}[vth]\b)/i, // Arc integrada (Meteor/Lunar/Arrow Lake); Arc A/B são dedicadas
  /\[intel arc graphics\]/i,
  /radeon(\(tm\))?\s*(\d{3,4}[ms]\s*)?graphics/i, // "Radeon Graphics", "Radeon 780M Graphics", "Radeon(TM) 890M Graphics"
  /vega \d+ graphics/i,
  /\b(renoir|cezanne|lucienne|barcelo|rembrandt|phoenix\d?|hawk point|raphael|granite ridge|strix( halo)?|krackan|mendocino|raven2?|picasso|dali|van gogh|pollock|stoney|carrizo|kaveri)\b/i,
  /intel.*\b(alder|raptor|meteor|lunar|arrow|tiger|ice|comet|coffee|kaby|whiskey|jasper|elkhart|gemini) lake\b/i,
];

const DEDICATED_HINT = /\b(radeon\s+(rx|pro|ai pro)|navi|instinct|arc(\(tm\))?\s*[ab]\d{3}|dg2|battlemage|alchemist|geforce|quadro|rtx|tesla)\b/i;

export function vendorFromName(nome) {
  if (/nvidia|geforce|quadro|rtx|tesla/i.test(nome)) return "NVIDIA";
  if (/\bamd\b|\bati\b|radeon|advanced micro devices/i.test(nome)) return "AMD";
  if (/intel/i.test(nome)) return "Intel";
  return "?";
}

export function typeFromName(nome) {
  if (VIRTUAL.test(nome)) return "virtual";
  if (DEDICATED_HINT.test(nome)) return "dedicada";
  if (INTEGRATED.some((re) => re.test(nome))) return "integrada";
  return "desconhecida";
}

// Mesma regra do Ollama para AMD no Linux: placas dedicadas expõem mem_info_vram_vendor ou board_info;
// integradas têm pouca "VRAM" reservada (≤ 4 GB) e muita memória compartilhada (GTT ≥ 8 GB e ≥ 4× a VRAM).
export function amdSysfsType(deviceDir) {
  const exists = (f) => fs.existsSync(path.join(deviceDir, f));
  const num = (f) => {
    try {
      return Number(fs.readFileSync(path.join(deviceDir, f), "utf8").trim());
    } catch {
      return null;
    }
  };
  const vram = num("mem_info_vram_total");
  const gtt = num("mem_info_gtt_total");
  let tipo = null;
  if (exists("mem_info_vram_vendor") || exists("board_info")) tipo = "dedicada";
  else if (vram > 0 && gtt !== null && vram <= 4 * 1024 ** 3 && gtt >= 8 * 1024 ** 3 && gtt >= 4 * vram) tipo = "integrada";
  return { tipo, vram_gb: vram ? gb(vram) : null, compartilhada_gb: gtt ? gb(gtt) : null };
}

function nvidiaSmi() {
  const r = runCapture("nvidia-smi", ["--query-gpu=name,memory.total,memory.free,pci.bus_id", "--format=csv,noheader,nounits"]);
  if (!r.ok || !r.stdout) return [];
  return r.stdout.split(/\r?\n/).map((line) => {
    const [nome, total, livre, bus] = line.split(",").map((s) => s.trim());
    return { nome, fabricante: "NVIDIA", tipo: "dedicada", vram_gb: Number(total) / 1024, vram_livre_gb: Number(livre) / 1024, pci: (bus || "").toLowerCase(), driver_ok: true, fonte: "nvidia-smi" };
  });
}

// ---------- Linux ----------

function lspciNames() {
  const r = runCapture("lspci", ["-D"]);
  const map = new Map();
  if (!r.ok) return map;
  for (const line of r.stdout.split("\n")) {
    if (!/VGA compatible|3D controller|Display controller/i.test(line)) continue;
    const slot = line.split(" ")[0].toLowerCase();
    map.set(slot, line.replace(/^\S+\s+[^:]+:\s*/, "").trim());
  }
  return map;
}

export function linuxGpus({ sysRoot = "/sys", names = lspciNames(), nvidia = nvidiaSmi() } = {}) {
  const gpus = [...nvidia];
  const drm = path.join(sysRoot, "class", "drm");
  let cards = [];
  try {
    cards = fs.readdirSync(drm).filter((c) => /^card\d+$/.test(c));
  } catch {}
  for (const card of cards) {
    const devLink = path.join(drm, card, "device");
    let devDir;
    try {
      devDir = fs.realpathSync(devLink);
    } catch {
      continue;
    }
    let vendorId;
    try {
      vendorId = fs.readFileSync(path.join(devDir, "vendor"), "utf8").trim().toLowerCase();
    } catch {
      continue;
    }
    const fabricante = VENDORS[vendorId];
    if (!fabricante) continue;
    const slot = path.basename(devDir).toLowerCase();
    const nome = names.get(slot) || `${fabricante} (${card})`;
    if (fabricante === "NVIDIA") {
      if (nvidia.length) continue; // nvidia-smi já listou as placas NVIDIA com driver
      gpus.push({ nome, fabricante, tipo: "dedicada", vram_gb: null, driver_ok: false, fonte: "/sys (driver NVIDIA não encontrado)" });
      continue;
    }
    if (fabricante === "AMD") {
      const s = amdSysfsType(devDir);
      const byName = typeFromName(nome);
      const tipo = s.tipo || (byName !== "desconhecida" ? byName : s.vram_gb && s.vram_gb > 4 ? "dedicada" : "integrada");
      gpus.push({ nome, fabricante, tipo, vram_gb: tipo === "dedicada" ? s.vram_gb : null, memoria_compartilhada_gb: s.compartilhada_gb, fonte: s.tipo ? "/sys (regra do Ollama)" : "/sys + nome" });
      continue;
    }
    // Intel: a VRAM das Arc dedicadas não é exposta de forma simples; pede preenchimento manual.
    const tipoIntel = typeFromName(nome);
    gpus.push({ nome, fabricante, tipo: tipoIntel === "desconhecida" ? "integrada" : tipoIntel, vram_gb: null, fonte: "/sys + nome" });
  }
  // Sem /sys (contêiner, WSL): usa só o lspci.
  if (!cards.length) {
    for (const [, nome] of names) {
      const fab = vendorFromName(nome);
      if (fab === "NVIDIA" && nvidia.length) continue;
      gpus.push({ nome, fabricante: fab, tipo: typeFromName(nome), vram_gb: null, fonte: "lspci" });
    }
  }
  return gpus;
}

// Drivers Vulkan instalados (necessários para AMD sem ROCm e para GPUs integradas no Linux).
export function linuxVulkanIcds(dirs = ["/usr/share/vulkan/icd.d", "/etc/vulkan/icd.d"]) {
  const files = [];
  for (const d of dirs) {
    try {
      files.push(...fs.readdirSync(d).filter((f) => f.endsWith(".json")));
    } catch {}
  }
  return {
    arquivos: files,
    amd: files.some((f) => /radeon|amd/i.test(f)),
    intel: files.some((f) => /intel/i.test(f)),
    nvidia: files.some((f) => /nvidia/i.test(f)),
  };
}

// O instalador do Ollama coloca o usuário de serviço "ollama" nos grupos render e video.
export function linuxOllamaGroups() {
  const r = runCapture("id", ["-nG", "ollama"]);
  if (!r.ok) return null;
  const groups = r.stdout.split(/\s+/);
  return { render: groups.includes("render"), video: groups.includes("video") };
}

// ---------- Windows ----------

function windowsGpus({ nvidia = nvidiaSmi() } = {}) {
  // AdapterRAM do Win32_VideoController é limitado a 4 GB; o registro guarda o valor de 64 bits.
  const script =
    "$ErrorActionPreference='SilentlyContinue';" +
    "$k='HKLM:\\SYSTEM\\ControlSet001\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0*';" +
    "$r=@(Get-ItemProperty -Path $k | ForEach-Object { [pscustomobject]@{Nome=$_.DriverDesc; Mem=$_.'HardwareInformation.qwMemorySize'} });" +
    "$c=@(Get-CimInstance Win32_VideoController | ForEach-Object { [pscustomobject]@{Nome=$_.Name; Mem=$_.AdapterRAM; Driver=$_.DriverVersion} });" +
    "[pscustomobject]@{Registro=$r; Cim=$c} | ConvertTo-Json -Depth 4 -Compress";
  const r = runCapture("powershell", ["-NoProfile", "-Command", script], { timeoutMs: 15000 });
  const list = [...nvidia];
  if (!r.ok || !r.stdout) return list;
  let data;
  try {
    data = JSON.parse(r.stdout);
  } catch {
    return list;
  }
  return [...list, ...windowsFromCim(data, { hasNvidiaSmi: nvidia.length > 0 })];
}

export function windowsFromCim(data, { hasNvidiaSmi = false } = {}) {
  const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
  const fromReg = new Map(arr(data.Registro).filter((x) => x.Nome).map((x) => [x.Nome, Number(x.Mem) || null]));
  const out = [];
  for (const x of arr(data.Cim)) {
    if (!x.Nome) continue;
    const fabricante = vendorFromName(x.Nome);
    if (fabricante === "NVIDIA" && hasNvidiaSmi) continue;
    let tipo = typeFromName(x.Nome);
    const reg = fromReg.get(x.Nome);
    const vram = reg ? gb(reg) : x.Mem ? gb(Number(x.Mem)) : null;
    if (tipo === "desconhecida") tipo = fabricante === "Intel" ? "integrada" : vram && vram > 4 ? "dedicada" : "desconhecida";
    out.push({
      nome: x.Nome,
      fabricante,
      tipo,
      vram_gb: tipo === "dedicada" || tipo === "desconhecida" ? vram : null,
      driver: x.Driver || null,
      driver_ok: fabricante === "NVIDIA" ? false : undefined,
      fonte: reg ? "registro do Windows" : "Win32_VideoController (pode estar limitado a 4 GB)",
    });
  }
  return out;
}

// ---------- Resumo ----------

// Como o Ollama deve acelerar cada GPU, segundo a documentação de hardware (docs/gpu.mdx, v0.40.15).
export function expectedBackend(g, platform = process.platform) {
  if (g.tipo === "virtual") return "nenhuma (adaptador virtual ou de software)";
  if (g.fabricante === "NVIDIA") return g.driver_ok === false ? "nenhuma até instalar o driver NVIDIA (550 ou mais novo)" : "CUDA";
  if (g.tipo === "integrada") return "Vulkan, usando a memória RAM do sistema";
  if (g.fabricante === "AMD") {
    return platform === "win32"
      ? "ROCm nas Radeon RX 7000 e PRO W7000 (driver com HIP 7); Vulkan nas demais"
      : "ROCm v7 nas placas listadas pelo Ollama; Vulkan (Mesa) nas demais";
  }
  if (g.fabricante === "Intel") return "Vulkan";
  return "desconhecida";
}

export function detect() {
  if (IS_WINDOWS) return { gpus: windowsGpus(), linux: null };
  if (process.platform !== "linux") return { gpus: nvidiaSmi(), linux: null };
  return { gpus: linuxGpus(), linux: { vulkan: linuxVulkanIcds(), grupos_ollama: linuxOllamaGroups() } };
}

// Avisos práticos a partir do que foi detectado.
export function advice(gpus, linux) {
  const msgs = [];
  const useful = gpus.filter((g) => g.tipo !== "virtual");
  if (gpus.some((g) => g.fabricante === "NVIDIA" && g.driver_ok === false)) {
    msgs.push("GPU NVIDIA sem driver em uso: instale o driver proprietário (veja o manual do seu sistema).");
  }
  if (gpus.some((g) => g.tipo === "integrada") && !useful.some((g) => g.tipo === "dedicada")) {
    msgs.push("Só há GPU integrada: ela usa a mesma RAM do sistema. Pode acelerar um pouco (via Vulkan), mas não aumenta a memória disponível. A medição em 'verificar' mostra o ganho real.");
  }
  if (useful.some((g) => g.tipo === "integrada") && useful.some((g) => g.tipo === "dedicada")) {
    msgs.push("Há GPU integrada e dedicada. Se o Ollama escolher a integrada ou ficar instável, veja docs/problemas.md, seção 'GPU não usada'.");
  }
  if (linux) {
    const needsVulkan = useful.some((g) => (g.fabricante === "AMD" || g.fabricante === "Intel"));
    if (needsVulkan && linux.vulkan && !(linux.vulkan.amd || linux.vulkan.intel)) {
      msgs.push("Nenhum driver Vulkan da Mesa encontrado: instale 'mesa-vulkan-drivers' para o Ollama usar GPUs AMD/Intel sem ROCm.");
    }
    if (needsVulkan && linux.grupos_ollama && !(linux.grupos_ollama.render && linux.grupos_ollama.video)) {
      msgs.push("O usuário 'ollama' não está nos grupos render e video; sem isso o serviço pode não acessar a GPU (veja o manual do Ubuntu).");
    }
  }
  return msgs;
}
