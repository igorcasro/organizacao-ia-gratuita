// Testes automatizados dos scripts. Executar na raiz do repositório:
//   node --test scripts/testes/
// Usam um Ollama simulado; não baixam modelos nem alteram o sistema.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startOllamaMock, fakeBinaries } from "./simulador.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = path.join(ROOT, "scripts", "ia-local.mjs");
const isWindows = process.platform === "win32";
// Motivos para pular no Windows (aparecem na saída do npm test).
const SKIP_CLI = isWindows && "usa executáveis falsos em shell (sh); roda no Linux";
const SKIP_SYSFS = isWindows && "simula o /sys do Linux, com ':' nos nomes de pasta (proibido no Windows); roda no Linux";

const catalogo = await import("../lib/catalogo.mjs");
const ollama = await import("../lib/ollama.mjs");
const prefs = await import("../lib/preferencias.mjs");

function runCli(args, { env = {}, input = "" } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.stdin.end(input);
    child.on("exit", (code) => resolve({ code, out }));
  });
}

const tmpHome = () => fs.mkdtempSync(path.join(os.tmpdir(), "ia-local-home-"));

test("catálogo é válido", () => {
  const c = catalogo.load();
  assert.ok(c.modelos.length >= 2);
  assert.deepEqual(catalogo.validate(c), []);
});

test("validação do catálogo rejeita modelo em nuvem e id repetido", () => {
  const c = structuredClone(catalogo.load());
  c.modelos.push({ ...c.modelos[0] });
  c.modelos.push({ ...c.modelos[0], id: "x", ollama_tag: "gpt-oss:20b-cloud" });
  const errors = catalogo.validate(c).join("\n");
  assert.match(errors, /id repetido/);
  assert.match(errors, /nuvem/);
});

test("recomendação conforme o hardware", () => {
  const c = catalogo.load();
  const semGpu8 = catalogo.recommend(c, { ram_gb: 8, vram_gb: 0, disco_livre_gb: 100 });
  assert.equal(semGpu8.best, null, "8 GB sem GPU: nem o 4B cabe com 64k e folga para o sistema");
  const semGpu8Reduzido = catalogo.recommend(c, { ram_gb: 8, vram_gb: 0, disco_livre_gb: 100 }, {}, 32768);
  assert.equal(semGpu8Reduzido.best, null, "8 GB sem GPU: também não cabe com 32k");

  const semGpu16 = catalogo.recommend(c, { ram_gb: 16, vram_gb: 0, disco_livre_gb: 100 });
  assert.equal(semGpu16.best?.modelo.id, "qwen3.5-4b", "16 GB sem GPU: 4B na CPU");
  assert.equal(semGpu16.best.classe, "possivel-lento");

  const semGpu32 = catalogo.recommend(c, { ram_gb: 32, vram_gb: 0, disco_livre_gb: 100 });
  assert.equal(semGpu32.best?.modelo.id, "qwen3.5-9b", "32 GB sem GPU: o maior com custo por token tolerável na CPU");
  const semGpu48 = catalogo.recommend(c, { ram_gb: 48, vram_gb: 0, disco_livre_gb: 100 });
  assert.equal(semGpu48.best?.modelo.id, "qwen3-coder-30b", "48 GB sem GPU: MoE com 3.3B ativos passa a caber");

  const gpu12 = catalogo.recommend(c, { ram_gb: 32, vram_gb: 12, disco_livre_gb: 200 });
  assert.equal(gpu12.best.classe, "recomendado");
  assert.equal(gpu12.best.modelo.id, "qwen3.5-4b", "12 GB: o 9B estimado (~11.7 GB) passa da VRAM útil (10.8 GB)");
  assert.equal(gpu12.rows.find((r) => r.modelo.id === "qwen3.5-9b").classe, "possivel-lento");

  const gpu16 = catalogo.recommend(c, { ram_gb: 32, vram_gb: 16, disco_livre_gb: 200 });
  assert.equal(gpu16.best.modelo.id, "qwen3.5-9b");

  const gpu24 = catalogo.recommend(c, { ram_gb: 64, vram_gb: 24, disco_livre_gb: 200 }, { prioridade: "qualidade" });
  assert.equal(gpu24.best.modelo.id, "gpt-oss-20b", "24 GB: o 30B estimado (~28 GB) não cabe inteiro na GPU");

  const rapido = catalogo.recommend(c, { ram_gb: 64, vram_gb: 24, disco_livre_gb: 200 }, { prioridade: "velocidade" });
  assert.equal(rapido.best.modelo.id, "qwen3.5-4b");

  const pouco = catalogo.recommend(c, { ram_gb: 4, vram_gb: 0, disco_livre_gb: 100 });
  assert.equal(pouco.best, null, "4 GB de RAM: nenhum modelo viável");

  const semDisco = catalogo.recommend(c, { ram_gb: 32, vram_gb: 12, disco_livre_gb: 6 });
  assert.equal(semDisco.best, null, "sem espaço para nenhum download com margem");
});

test("endereço do Ollama", () => {
  const old = process.env.OLLAMA_HOST;
  delete process.env.OLLAMA_HOST;
  assert.equal(ollama.baseUrl(), "http://127.0.0.1:11434");
  process.env.OLLAMA_HOST = "0.0.0.0";
  assert.equal(ollama.baseUrl(), "http://127.0.0.1:11434");
  process.env.OLLAMA_HOST = "127.0.0.1:5678";
  assert.equal(ollama.baseUrl(), "http://127.0.0.1:5678");
  if (old === undefined) delete process.env.OLLAMA_HOST;
  else process.env.OLLAMA_HOST = old;
});

test("nome do modelo derivado e detecção de nuvem", () => {
  assert.equal(ollama.derivedName("qwen3.5-9b", 65536), "ia-local-qwen3.5-9b:64k");
  assert.ok(ollama.isCloudName("gpt-oss:20b-cloud"));
  assert.ok(ollama.isCloudName("glm-5.3:cloud"));
  assert.ok(!ollama.isCloudName("qwen3.5:9b"));
});

test("situação do modelo nas preferências", () => {
  const p = prefs.empty();
  assert.equal(prefs.modelStage(p, []), "nenhum");
  p.modelo = { base: "a:1", efetivo: "ia-local-a:64k" };
  assert.equal(prefs.modelStage(p, []), "catalogo");
  assert.equal(prefs.modelStage(p, ["a:1"]), "instalado");
  assert.equal(prefs.modelStage(p, ["a:1", "ia-local-a:64k"]), "contexto-configurado");
  p.validacoes["ia-local-a:64k"] = { tecnica: { ok: true } };
  assert.equal(prefs.modelStage(p, ["a:1", "ia-local-a:64k"]), "verificado-tecnicamente");
  p.validacoes["ia-local-a:64k"].fluxo = { ok: true };
  assert.equal(prefs.modelStage(p, ["a:1", "ia-local-a:64k"]), "validado-no-fluxo");
});

test("CLI: ajuda e comando desconhecido", async () => {
  const ok = await runCli(["ajuda"], { env: { IA_LOCAL_HOME: tmpHome() } });
  assert.equal(ok.code, 0);
  assert.match(ok.out, /Comandos:/);
  const bad = await runCli(["xyz"], { env: { IA_LOCAL_HOME: tmpHome() } });
  assert.equal(bad.code, 2);
});

test("CLI: Ollama indisponível gera mensagem de recuperação", async () => {
  const home = tmpHome();
  const r = await runCli(["verificar"], { env: { IA_LOCAL_HOME: home, OLLAMA_HOST: "127.0.0.1:9" } });
  assert.equal(r.code, 1);
  assert.match(r.out, /Nenhum modelo escolhido/);
  fs.writeFileSync(path.join(home, "preferencias.json"), JSON.stringify({ ...prefs.empty(), modelo: { base: "a:1", efetivo: "ia-local-a:64k", contexto_tokens: 65536 } }));
  const r2 = await runCli(["verificar"], { env: { IA_LOCAL_HOME: home, OLLAMA_HOST: "127.0.0.1:9" } });
  assert.equal(r2.code, 1);
  assert.match(r2.out, /Ollama não está disponível/);
  assert.match(r2.out, /Como resolver/);
});

test("CLI: diagnóstico salva arquivo local fora do repositório", async () => {
  const home = tmpHome();
  const r = await runCli(["diagnostico"], { env: { IA_LOCAL_HOME: home, OLLAMA_HOST: "127.0.0.1:9" }, input: "n\n" });
  assert.equal(r.code, 0, r.out);
  const diag = JSON.parse(fs.readFileSync(path.join(home, "diagnostico.json"), "utf8"));
  assert.ok(diag.memoria.ram_total_gb > 0);
  assert.equal(diag.software.ollama.servico_online, false);
  assert.ok(!fs.existsSync(path.join(ROOT, "diagnostico.json")));
});

test("CLI: diagnóstico manual sobrepõe valores detectados", async () => {
  const home = tmpHome();
  const r = await runCli(["diagnostico", "--manual"], { env: { IA_LOCAL_HOME: home, OLLAMA_HOST: "127.0.0.1:9" }, input: "16\n8\n120\nGPU de teste\n" });
  assert.equal(r.code, 0, r.out);
  const diag = JSON.parse(fs.readFileSync(path.join(home, "diagnostico.json"), "utf8"));
  assert.deepEqual(diag.manual, { ram_total_gb: 16, vram_gb: 8, disco_livre_gb: 120, gpu_nome: "GPU de teste" });
  assert.match(r.out, /Valores usados na recomendação: RAM 16.0 GB, VRAM dedicada 8.0 GB, disco livre 120.0 GB/);
});

// Fluxo completo com Ollama e OpenCode simulados (executáveis falsos só funcionam fora do Windows).
let mock;
before(async () => {
  mock = await startOllamaMock({ models: [{ name: "glm-5.3:cloud", remote: true }] });
});
after(async () => mock?.close());

test("CLI: seleção, verificação e início com simuladores", { skip: SKIP_CLI }, async () => {
  const home = tmpHome();
  const bins = fakeBinaries(mock.port);
  const env = { IA_LOCAL_HOME: home, OLLAMA_HOST: `127.0.0.1:${mock.port}`, PATH: `${bins.dir}${path.delimiter}${process.env.PATH}` };
  fs.writeFileSync(
    path.join(home, "diagnostico.json"),
    JSON.stringify({ versao_esquema: 1, memoria: { ram_total_gb: 32 }, gpus: [], disco: { livre_gb: 200 }, manual: { vram_gb: 16 } })
  );
  // Respostas: tarefa (Enter), tamanho (Enter), prioridade (Enter), opção sugerida (Enter), baixar? s, criar? (Enter)
  const sel = await runCli(["selecionar"], { env, input: "\n\n\n\ns\n\n" });
  assert.equal(sel.code, 0, sel.out);
  assert.match(sel.out, /Preferência salva/);
  const saved = JSON.parse(fs.readFileSync(path.join(home, "preferencias.json"), "utf8"));
  assert.equal(saved.modelo.base, "qwen3.5:9b");
  assert.equal(saved.modelo.efetivo, "ia-local-qwen3.5-9b:64k");
  const calls = bins.calls();
  assert.ok(calls.some((c) => c.bin === "ollama" && c.args[0] === "pull" && c.args[1] === "qwen3.5:9b"));
  assert.ok(calls.some((c) => c.bin === "ollama" && c.args[0] === "create" && c.args[1] === "ia-local-qwen3.5-9b:64k"));
  const modelfile = fs.readdirSync(path.join(home, "modelfiles"))[0];
  assert.match(fs.readFileSync(path.join(home, "modelfiles", modelfile), "utf8"), /PARAMETER num_ctx 65536/);

  const ver = await runCli(["verificar"], { env });
  assert.equal(ver.code, 0, ver.out);
  assert.match(ver.out, /verificado tecnicamente/);
  const afterVer = JSON.parse(fs.readFileSync(path.join(home, "preferencias.json"), "utf8"));
  assert.equal(afterVer.validacoes["ia-local-qwen3.5-9b:64k"].tecnica.medida.contexto_carregado, 65536);
  assert.ok(fs.existsSync(path.join(home, "preferencias.json.bak")), "cópia de segurança criada");

  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "ia-local-proj-"));
  const ini = await runCli(["iniciar", proj], { env });
  assert.equal(ini.code, 0, ini.out);
  const launch = bins.calls().find((c) => c.bin === "ollama" && c.args[0] === "launch");
  assert.deepEqual(launch.args, ["launch", "opencode", "--model", "ia-local-qwen3.5-9b:64k"]);
  assert.equal(fs.realpathSync(launch.cwd), fs.realpathSync(proj));
  assert.equal(launch.OPENCODE_DISABLE_FREE_MODELS, "1");
  const policy = JSON.parse(fs.readFileSync(launch.OPENCODE_CONFIG, "utf8"));
  assert.deepEqual(policy.policies.map((p) => `${p.action}:${p.resource}:${p.effect}`), ["provider.use:*:deny", "provider.use:ollama:allow", "websearch.use:*:deny"]);
});

test("CLI: recusa iniciar com OpenCode 1", { skip: SKIP_CLI }, async () => {
  const home = tmpHome();
  const bins = fakeBinaries(mock.port, { opencodeVersion: "1.19.5" });
  await fetch(`http://127.0.0.1:${mock.port}/_mock/add`, { method: "POST", body: JSON.stringify({ name: "ia-local-x:64k" }) });
  fs.writeFileSync(path.join(home, "preferencias.json"), JSON.stringify({ ...prefs.empty(), modo: "local", modelo: { base: "x:1", efetivo: "ia-local-x:64k", contexto_tokens: 65536 } }));
  const env = { IA_LOCAL_HOME: home, OLLAMA_HOST: `127.0.0.1:${mock.port}`, PATH: `${bins.dir}${path.delimiter}${process.env.PATH}` };
  const r = await runCli(["iniciar", os.tmpdir()], { env });
  assert.equal(r.code, 1);
  assert.match(r.out, /este repositório usa o OpenCode 2/);
  assert.ok(!bins.calls().some((c) => c.args[0] === "launch"));
});

test("CLI: download recusado não altera preferências", { skip: SKIP_CLI }, async () => {
  const home = tmpHome();
  const bins = fakeBinaries(mock.port);
  const env = { IA_LOCAL_HOME: home, OLLAMA_HOST: `127.0.0.1:${mock.port}`, PATH: `${bins.dir}${path.delimiter}${process.env.PATH}` };
  fs.writeFileSync(path.join(home, "diagnostico.json"), JSON.stringify({ versao_esquema: 1, memoria: { ram_total_gb: 64 }, gpus: [], disco: { livre_gb: 500 }, manual: { vram_gb: 24 } }));
  const r = await runCli(["selecionar"], { env, input: "\n\n\n\nn\n" });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Download não autorizado/);
  assert.ok(!fs.existsSync(path.join(home, "preferencias.json")));
  assert.ok(!bins.calls().some((c) => c.args[0] === "pull"));
});

// ---------- GPUs AMD, Intel e integradas ----------
const gpu = await import("../lib/gpu.mjs");

test("tipo da GPU pelo nome (Windows e lspci)", () => {
  const casos = {
    "AMD Radeon RX 7600": "dedicada",
    "AMD Radeon RX 6700 XT": "dedicada",
    "AMD Radeon(TM) Graphics": "integrada",
    "AMD Radeon 780M Graphics": "integrada",
    "AMD Radeon(TM) 890M Graphics": "integrada",
    "AMD Radeon(TM) Vega 8 Graphics": "integrada",
    "Intel(R) UHD Graphics 620": "integrada",
    "Intel(R) Iris(R) Xe Graphics": "integrada",
    "Intel(R) Arc(TM) Graphics": "integrada",
    "Intel(R) Arc(TM) 140V GPU (16GB)": "integrada",
    "Intel(R) Arc(TM) A770 Graphics": "dedicada",
    "Advanced Micro Devices, Inc. [AMD/ATI] Navi 33 [Radeon RX 7700S/7600/7600S/7600M XT/PRO W7600]": "dedicada",
    "Advanced Micro Devices, Inc. [AMD/ATI] Phoenix1": "integrada",
    "Advanced Micro Devices, Inc. [AMD/ATI] Rembrandt [Radeon 680M]": "integrada",
    "Intel Corporation Alder Lake-P GT2 [Iris Xe Graphics]": "integrada",
    "Intel Corporation Meteor Lake-P [Intel Arc Graphics]": "integrada",
    "Intel Corporation DG2 [Arc A770]": "dedicada",
    "Microsoft Basic Display Adapter": "virtual",
    "VMware SVGA II Adapter": "virtual",
  };
  for (const [nome, tipo] of Object.entries(casos)) assert.equal(gpu.typeFromName(nome), tipo, nome);
});

function fakeDevice(root, slot, files) {
  const dir = path.join(root, "devices", "pci0000:00", slot);
  fs.mkdirSync(dir, { recursive: true });
  for (const [f, v] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), String(v));
  return dir;
}

test("AMD no Linux: regra do Ollama para integrada x dedicada", { skip: SKIP_SYSFS }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ia-local-sys-"));
  const GB = 1024 ** 3;
  const dGpu = fakeDevice(root, "0000:03:00.0", { vendor: "0x1002", mem_info_vram_total: 8 * GB, mem_info_gtt_total: 16 * GB, mem_info_vram_vendor: "samsung" });
  const apu = fakeDevice(root, "0000:c4:00.0", { vendor: "0x1002", mem_info_vram_total: 0.5 * GB, mem_info_gtt_total: 15 * GB });
  assert.equal(gpu.amdSysfsType(dGpu).tipo, "dedicada");
  assert.equal(gpu.amdSysfsType(dGpu).vram_gb, 8);
  assert.equal(gpu.amdSysfsType(apu).tipo, "integrada");
});

test("Linux: lista AMD dedicada, APU AMD e Intel integrada a partir de /sys", { skip: SKIP_SYSFS }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ia-local-sys-"));
  const GB = 1024 ** 3;
  const devs = {
    card0: fakeDevice(root, "0000:03:00.0", { vendor: "0x1002", mem_info_vram_total: 8 * GB, mem_info_gtt_total: 16 * GB, board_info: "x" }),
    card1: fakeDevice(root, "0000:c4:00.0", { vendor: "0x1002", mem_info_vram_total: 0.5 * GB, mem_info_gtt_total: 15 * GB }),
    card2: fakeDevice(root, "0000:00:02.0", { vendor: "0x8086" }),
  };
  const drm = path.join(root, "class", "drm");
  for (const [card, dir] of Object.entries(devs)) {
    fs.mkdirSync(path.join(drm, card), { recursive: true });
    fs.symlinkSync(dir, path.join(drm, card, "device"));
  }
  fs.mkdirSync(path.join(drm, "card0-DP-1"), { recursive: true }); // conector: deve ser ignorado
  const names = new Map([
    ["0000:03:00.0", "Advanced Micro Devices, Inc. [AMD/ATI] Navi 33 [Radeon RX 7600]"],
    ["0000:c4:00.0", "Advanced Micro Devices, Inc. [AMD/ATI] Phoenix1"],
    ["0000:00:02.0", "Intel Corporation Alder Lake-P GT2 [Iris Xe Graphics]"],
  ]);
  const list = gpu.linuxGpus({ sysRoot: root, names, nvidia: [] });
  assert.equal(list.length, 3);
  const by = Object.fromEntries(list.map((g) => [g.nome.split("[").pop(), g]));
  assert.equal(by["Radeon RX 7600]"].tipo, "dedicada");
  assert.equal(by["Radeon RX 7600]"].vram_gb, 8);
  assert.equal(by["AMD/ATI] Phoenix1"].tipo, "integrada");
  assert.equal(by["AMD/ATI] Phoenix1"].vram_gb, null, "VRAM reservada da APU não conta como VRAM dedicada");
  assert.equal(by["Iris Xe Graphics]"].tipo, "integrada");
  assert.match(gpu.expectedBackend(by["Radeon RX 7600]"], "linux"), /ROCm.*Vulkan/);
  assert.match(gpu.expectedBackend(by["Iris Xe Graphics]"], "linux"), /Vulkan.*RAM/);
});

test("Windows: dados do registro e do CIM para AMD, Intel e adaptador virtual", () => {
  const GB = 1024 ** 3;
  const data = {
    Registro: [{ Nome: "AMD Radeon RX 7600", Mem: 8 * GB }, { Nome: "AMD Radeon 780M Graphics", Mem: 0.5 * GB }],
    Cim: [
      { Nome: "AMD Radeon RX 7600", Mem: 4 * GB - 1 },
      { Nome: "AMD Radeon 780M Graphics", Mem: 0.5 * GB },
      { Nome: "Intel(R) Iris(R) Xe Graphics", Mem: 128 * 1024 ** 2 },
      { Nome: "Microsoft Basic Display Adapter", Mem: 0 },
    ],
  };
  const list = gpu.windowsFromCim(data);
  const t = Object.fromEntries(list.map((g) => [g.nome, g]));
  assert.equal(t["AMD Radeon RX 7600"].tipo, "dedicada");
  assert.equal(t["AMD Radeon RX 7600"].vram_gb, 8, "usa o valor de 64 bits do registro, não o limite de 4 GB do CIM");
  assert.equal(t["AMD Radeon 780M Graphics"].tipo, "integrada");
  assert.equal(t["AMD Radeon 780M Graphics"].vram_gb, null);
  assert.equal(t["Intel(R) Iris(R) Xe Graphics"].tipo, "integrada");
  assert.equal(t["Microsoft Basic Display Adapter"].tipo, "virtual");
  assert.match(gpu.expectedBackend(t["AMD Radeon RX 7600"], "win32"), /ROCm nas Radeon RX 7000/);
});

test("recomendação com GPU integrada usa só a RAM e explica a aceleração", () => {
  const c = catalogo.load();
  const r = catalogo.recommend(c, { ram_gb: 16, vram_gb: 0, gpu_integrada: true, disco_livre_gb: 100 });
  assert.equal(r.best.modelo.id, "qwen3.5-4b");
  assert.equal(r.best.classe, "possivel-lento");
  assert.match(r.best.motivos.join(" "), /GPU integrada.*Vulkan/);
});

test("avisos de GPU no Linux: falta de Vulkan e grupos do usuário ollama", () => {
  const gpus = [{ nome: "Phoenix1", fabricante: "AMD", tipo: "integrada" }];
  const msgs = gpu.advice(gpus, { vulkan: { arquivos: [], amd: false, intel: false }, grupos_ollama: { render: false, video: true } });
  assert.ok(msgs.some((m) => /mesa-vulkan-drivers/.test(m)));
  assert.ok(msgs.some((m) => /render e video/.test(m)));
  assert.ok(msgs.some((m) => /não aumenta a memória/.test(m)));
  assert.deepEqual(gpu.advice(gpus, { vulkan: { arquivos: ["radeon_icd.x86_64.json"], amd: true }, grupos_ollama: { render: true, video: true } }).filter((m) => /Vulkan da Mesa|grupos/.test(m)), []);
});

// ---------- Modos misto e nuvem gratuita ----------
const nuvemMod = await import("../lib/nuvem.mjs");

test("catálogo de nuvem gratuita é válido e não aceita Ollama nem OpenRouter pago", () => {
  const c = nuvemMod.load();
  assert.deepEqual(nuvemMod.validate(c), []);
  const bad = structuredClone(c);
  bad.provedores.push({ id: "ollama", fontes: ["x"], consultado_em: "x", modelos: [] });
  bad.provedores[1].modelos.push({ id: "anthropic/claude-x", privacidade: "sem-treino" });
  const errs = nuvemMod.validate(bad).join("\n");
  assert.match(errs, /Ollama local/);
  assert.match(errs, /só variantes :free/);
});

test("provedores liberados por modo", () => {
  assert.deepEqual(nuvemMod.allowedProviders({ modo: null, nuvem: { provedores: ["opencode"] } }), []);
  assert.deepEqual(nuvemMod.allowedProviders({ modo: "local", nuvem: { provedores: ["opencode"] } }), ["ollama"]);
  assert.deepEqual(nuvemMod.allowedProviders({ modo: "misto", nuvem: { provedores: ["opencode"] } }), ["ollama", "opencode"]);
  assert.deepEqual(nuvemMod.allowedProviders({ modo: "nuvem", nuvem: { provedores: ["opencode", "openrouter"] } }), ["opencode", "openrouter"]);
});

function cloudEnv(home, bins, extra = {}) {
  return { IA_LOCAL_HOME: home, OLLAMA_HOST: "127.0.0.1:9", PATH: `${bins.dir}${path.delimiter}${process.env.PATH}`, OPENCODE_API_KEY: "chave-paga-que-nao-deve-passar", OPENROUTER_API_KEY: "", ...extra };
}

test("CLI: modo nuvem exige 'concordo' e não altera nada sem ele", { skip: SKIP_CLI }, async () => {
  const home = tmpHome();
  const bins = fakeBinaries(mock.port);
  const r = await runCli(["modo"], { env: cloudEnv(home, bins), input: "\n\nn\nsim\n" });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Confirmação não recebida/);
  assert.ok(!fs.existsSync(path.join(home, "preferencias.json")));
});

test("CLI: modo nuvem sem Ollama — seleção, verificação e início", { skip: SKIP_CLI }, async () => {
  const home = tmpHome();
  const bins = fakeBinaries(mock.port);
  const env = cloudEnv(home, bins);
  // modo sugerido = nuvem (Enter), liberar opencode (Enter = sim), openrouter não, "concordo", modelo sugerido (Enter)
  const sel = await runCli(["modo"], { env, input: "\n\nn\nconcordo\n\n" });
  assert.equal(sel.code, 0, sel.out);
  const prefs = JSON.parse(fs.readFileSync(path.join(home, "preferencias.json"), "utf8"));
  assert.equal(prefs.modo, "nuvem");
  assert.deepEqual(prefs.nuvem.provedores, ["opencode"]);
  assert.equal(prefs.nuvem.modelo, "opencode/deepseek-v4.1-flash-free", "sugere um modelo que não treina com os dados");
  assert.equal(prefs.nuvem.consentimento.versao, 1);

  const ver = await runCli(["verificar"], { env, input: "s\n" });
  assert.equal(ver.code, 0, ver.out);
  assert.match(ver.out, /Só provedores liberados aparecem/);
  assert.match(ver.out, /verificado tecnicamente/);

  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "ia-local-proj-"));
  const ini = await runCli(["iniciar", proj], { env });
  assert.equal(ini.code, 0, ini.out);
  const launch = bins.calls().filter((c) => c.bin === "opencode" && c.args[0] === "--standalone").pop();
  assert.ok(launch, "OpenCode iniciado com --standalone");
  assert.equal(fs.realpathSync(launch.cwd), fs.realpathSync(proj));
  assert.equal(launch.OPENCODE_API_KEY, null, "chave paga do OpenCode removida do ambiente");
  assert.equal(launch.OPENCODE_DISABLE_FREE_MODELS, null, "modelos gratuitos liberados no modo nuvem");
  const cfg = JSON.parse(fs.readFileSync(launch.OPENCODE_CONFIG, "utf8"));
  assert.equal(cfg.model, "opencode/deepseek-v4.1-flash-free");
  assert.deepEqual(cfg.policies.map((p) => `${p.resource}:${p.effect}`), ["*:deny", "opencode:allow", "*:deny"]);
  assert.ok(!bins.calls().some((c) => c.bin === "ollama" && c.args[0] !== "--version"), "não chama o Ollama no modo nuvem");
});

test("CLI: modo misto inicia na nuvem com o modelo local como reserva manual", { skip: SKIP_CLI }, async () => {
  const home = tmpHome();
  const bins = fakeBinaries(mock.port);
  await fetch(`http://127.0.0.1:${mock.port}/_mock/add`, { method: "POST", body: JSON.stringify({ name: "ia-local-m:64k" }) });
  fs.writeFileSync(
    path.join(home, "preferencias.json"),
    JSON.stringify({ ...prefs.empty(), modo: "misto", modelo: { base: "m:1", efetivo: "ia-local-m:64k", contexto_tokens: 65536 }, nuvem: { provedores: ["opencode"], modelo: "opencode/glm-5.3-flash-free", consentimento: { versao: 1, data: "x" } } })
  );
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "ia-local-proj-"));
  const ok = await runCli(["iniciar", proj], { env: cloudEnv(home, bins, { OLLAMA_HOST: `127.0.0.1:${mock.port}` }) });
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /Reserva local disponível em \/models: ollama\/ia-local-m:64k/);
  const launch = bins.calls().filter((c) => c.bin === "opencode" && c.args[0] === "--standalone").pop();
  assert.ok(launch, "inicia o OpenCode direto, com o modelo em nuvem como padrão");
  assert.ok(!bins.calls().some((c) => c.bin === "ollama" && c.args[0] === "launch"));
  const cfg = JSON.parse(fs.readFileSync(launch.OPENCODE_CONFIG, "utf8"));
  assert.equal(cfg.model, "opencode/glm-5.3-flash-free");
  assert.deepEqual(cfg.policies.filter((p) => p.effect === "allow").map((p) => p.resource), ["ollama", "opencode"]);
  assert.equal(cfg.providers.ollama.models["ia-local-m:64k"].limit.context, 65536, "informa o contexto real da reserva local");
  assert.equal(launch.OPENCODE_DISABLE_FREE_MODELS, null);
  assert.equal(launch.OPENCODE_API_KEY, null);

  // Ollama fora do ar: a reserva local some, mas a sessão em nuvem começa normalmente (sem troca automática de modelo).
  const bins2 = fakeBinaries(mock.port);
  const off = await runCli(["iniciar", proj], { env: cloudEnv(home, bins2) });
  assert.equal(off.code, 0, off.out);
  assert.match(off.out, /Ollama indisponível: a reserva local não aparecerá/);
  const launch2 = bins2.calls().filter((c) => c.bin === "opencode" && c.args[0] === "--standalone").pop();
  assert.equal(JSON.parse(fs.readFileSync(launch2.OPENCODE_CONFIG, "utf8")).providers, undefined);
});

test("CLI: sem modo escolhido, iniciar orienta a escolher (recomendado: nuvem)", { skip: SKIP_CLI }, async () => {
  const home = tmpHome();
  const bins = fakeBinaries(mock.port);
  const r = await runCli(["iniciar", os.tmpdir()], { env: cloudEnv(home, bins) });
  assert.equal(r.code, 1);
  assert.match(r.out, /Modo ainda não escolhido/);
  assert.match(r.out, /Recomendado: nuvem/);
});

test("CLI: modo misto/nuvem sem consentimento não inicia", { skip: SKIP_CLI }, async () => {
  const home = tmpHome();
  const bins = fakeBinaries(mock.port);
  fs.writeFileSync(path.join(home, "preferencias.json"), JSON.stringify({ ...prefs.empty(), modo: "nuvem", nuvem: { provedores: ["opencode"], modelo: null, consentimento: null } }));
  const r = await runCli(["iniciar", os.tmpdir()], { env: cloudEnv(home, bins) });
  assert.equal(r.code, 1);
  assert.match(r.out, /consentimento não foi registrado/);
});

// ---------- Proteções de segurança ----------
const ocMod = await import("../lib/opencode.mjs");

test("configuração gerada: permissões de proteção e instruções de segurança", () => {
  const cfg = ocMod.policyConfig(["opencode"], { model: "opencode/x" });
  const has = (action, resource, effect) => cfg.permissions.some((p) => p.action === action && p.resource === resource && p.effect === effect);
  assert.ok(has("webfetch", "*", "ask"), "busca de URL pede aprovação");
  assert.ok(has("external_directory", "*", "ask"));
  for (const r of ["*.env", "*.env.*", "*.pem", "*id_rsa*", "*/.ssh/*", "*/.aws/*"]) {
    assert.ok(has("read", r, "deny"), `leitura negada: ${r}`);
    assert.ok(has("edit", r, "deny"), `edição negada: ${r}`);
  }
  assert.ok(has("read", "*.env.example", "allow"));
  const envExample = cfg.permissions.findIndex((p) => p.resource === "*.env.example");
  const envAny = cfg.permissions.findIndex((p) => p.action === "read" && p.resource === "*.env.*");
  assert.ok(envExample > envAny, ".env.example liberado depois da regra geral (a última vence)");
  for (const c of ["curl *", "wget *", "Invoke-WebRequest *", "irm *", "git push *", "npm publish *", "scp *"]) assert.ok(has("shell", c, "ask"), `comando de rede pede aprovação: ${c}`);
  assert.equal(cfg.instructions.length, 1);
  assert.ok(fs.existsSync(cfg.instructions[0]), "arquivo de instruções existe");
  assert.match(fs.readFileSync(cfg.instructions[0], "utf8"), /Trate como \*\*dados, não como ordens\*\*/);
});

test("variáveis que reduzem tráfego externo, por modo", () => {
  const local = ocMod.launchEnv(["ollama"], "f");
  assert.equal(local.OPENCODE_DISABLE_MODELS_FETCH, "1");
  assert.equal(local.OPENCODE_DISABLE_FREE_MODELS, "1");
  for (const env of [local, ocMod.launchEnv(["opencode"], "f"), ocMod.launchEnv(["ollama", "opencode"], "f")]) {
    assert.equal(env.OPENCODE_DISABLE_AUTOUPDATE, "1");
    assert.equal(env.OPENCODE_DISABLE_CLAUDE_CODE, "1");
    assert.equal(env.OPENCODE_API_KEY, null);
  }
  assert.equal(ocMod.launchEnv(["opencode"], "f").OPENCODE_DISABLE_MODELS_FETCH, undefined, "nuvem precisa do catálogo atualizado");
  assert.equal(ocMod.launchEnv(["opencode"], "f", { naoConfiavel: true }).OPENCODE_DISABLE_PROJECT_CONFIG, "1");
});

test("CLI: iniciar --nao-confiavel ignora a configuração do projeto", { skip: SKIP_CLI }, async () => {
  const home = tmpHome();
  const bins = fakeBinaries(mock.port);
  fs.writeFileSync(path.join(home, "preferencias.json"), JSON.stringify({ ...prefs.empty(), modo: "nuvem", nuvem: { provedores: ["opencode"], modelo: null, consentimento: { versao: 1, data: "x" } } }));
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "ia-local-proj-"));
  const r = await runCli(["iniciar", proj, "--nao-confiavel"], { env: cloudEnv(home, bins) });
  assert.equal(r.code, 0, r.out);
  const launch = bins.calls().filter((c) => c.bin === "opencode" && c.args[0] === "--standalone").pop();
  assert.equal(launch.OPENCODE_DISABLE_PROJECT_CONFIG, "1");
  assert.equal(launch.OPENCODE_DISABLE_AUTOUPDATE, "1");
  assert.equal(launch.OPENCODE_DISABLE_CLAUDE_CODE, "1");
});

test("Windows: PWD do Git Bash é trocado pela pasta real do processo filho", async () => {
  const { childEnv } = await import("../lib/util.mjs");
  const base = { PWD: "/c/Users/fulano/projeto", PATH: "x", OPENCODE_CONFIG: "y" };
  const env = childEnv(base, "C:\\Users\\fulano\\AppData\\Local\\Temp", { windows: true });
  assert.equal(env.PWD, "C:\\Users\\fulano\\AppData\\Local\\Temp");
  assert.equal(env.PATH, "x");
  assert.equal(env.OPENCODE_CONFIG, "y");
  assert.equal(base.PWD, "/c/Users/fulano/projeto", "não altera o objeto original");
  // Fora do Windows, nada muda.
  assert.equal(childEnv(base, "/tmp", { windows: false }), base);
  assert.equal(childEnv(undefined, "/tmp", { windows: false }), undefined);
});
