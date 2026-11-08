// Configuração GLOBAL do OpenCode 2 (Desktop, interface web e "opencode" sem o script).
// Escreve só as proteções que não dependem do modo e NUNCA regras de provedor: as políticas globais
// vencem as que o script passa em OPENCODE_CONFIG e quebrariam os modos (ver docs/interface-grafica.md).
// Só altera arquivo com a marca deste repositório; arquivos da pessoa nunca são tocados.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { securityPermissions, SECURITY_INSTRUCTIONS } from "./opencode.mjs";
import { confirm, nowIso, title, warn, UserError } from "./util.mjs";

export const MARCA = "Gerado por organizacao-ia-gratuita (node scripts/ia-local.mjs config-global)";
export const ARQUIVOS = ["opencode.jsonc", "opencode.json"];

// Pasta global do OpenCode: XDG_CONFIG_HOME ou ~/.config, também no Windows
// (packages/util/src/global-roots.ts, v2.2.6). OPENCODE_CONFIG_DIR muda a pasta e é respeitada.
export function dir(env = process.env) {
  if (env.OPENCODE_CONFIG_DIR) return path.resolve(env.OPENCODE_CONFIG_DIR);
  const base = env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "opencode");
}

// "modelo": modelo padrão para o Desktop e o "opencode" sem o script (o melhor do dia que não treina).
// O "iniciar" sempre passa o próprio modelo, então este valor não interfere no script.
export function config(modelo = null) {
  return {
    $schema: "https://opencode.ai/config.json",
    ...(modelo ? { model: modelo } : {}),
    policies: [{ action: "websearch.use", resource: "*", effect: "deny" }],
    permissions: securityPermissions(),
    // Barras normais: aceitas pelo Node.js no Windows e sem escapes no JSON.
    instructions: [SECURITY_INSTRUCTIONS.split(path.sep).join("/")],
  };
}

export function texto(modelo = null) {
  return [
    `// ${MARCA}`,
    "// Proteções independentes do modo: busca na web bloqueada, aprovações, segredos bloqueados e",
    "// instruções de segurança. Sem regra de provedor, de propósito. Para remover:",
    "//   node scripts/ia-local.mjs config-global remover",
    JSON.stringify(config(modelo), null, 2),
    "",
  ].join("\n");
}

export function estado(env = process.env) {
  const pasta = dir(env);
  const arquivos = ARQUIVOS.map((nome) => {
    const file = path.join(pasta, nome);
    if (!fs.existsSync(file)) return { nome, file, existe: false };
    const conteudo = fs.readFileSync(file, "utf8");
    let modelo = null;
    try {
      modelo = JSON.parse(conteudo.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join("\n")).model || null;
    } catch {}
    return {
      nome,
      file,
      existe: true,
      nosso: conteudo.includes(MARCA),
      modelo,
      atualizado: conteudo === texto(modelo),
      regraProvedor: /provider\.use/.test(conteudo),
    };
  });
  return { pasta, arquivos };
}

function carimbo() {
  return nowIso().replace(/[:.]/g, "-");
}

function mostrar(st) {
  console.log(`Pasta global do OpenCode: ${st.pasta}`);
  console.log("(confira com: opencode debug paths config)");
  for (const a of st.arquivos) {
    if (!a.existe) console.log(`- ${a.nome}: não existe`);
    else if (a.nosso) console.log(`- ${a.nome}: gerado por este repositório; modelo padrão: ${a.modelo || "nenhum"}${a.atualizado ? "" : " (regras DESATUALIZADAS: rode 'config-global aplicar')"}`);
    else console.log(`- ${a.nome}: arquivo seu (não será alterado)${a.regraProvedor ? " — ATENÇÃO: tem regra de provedor (provider.use), que vence as do script e pode bloquear modos" : ""}`);
  }
}

const RECARREGAR = "Para valer agora: 'opencode reload' (ou feche e abra o OpenCode Desktop).";

async function aplicar(st, modeloDoDia) {
  const alheio = st.arquivos.find((a) => a.existe && !a.nosso);
  if (alheio) {
    throw new UserError(
      `Já existe um arquivo seu em ${alheio.file}; o script não mistura configurações automaticamente.`,
      "Junte à mão as regras de configs/opencode.global.jsonc ao seu arquivo (faça uma cópia antes), conforme docs/interface-grafica.md.",
    );
  }
  const nosso = st.arquivos.find((a) => a.existe && a.nosso);
  const { modelo, motivo } = modeloDoDia();
  console.log(`\nModelo padrão: ${modelo || "nenhum"} — ${motivo}`);
  if (nosso?.atualizado && nosso.modelo === modelo) {
    console.log("A configuração global já está aplicada e atualizada. Nada a fazer.");
    return;
  }
  const destino = path.join(st.pasta, "opencode.jsonc");
  console.log(`\nVai ${nosso ? "atualizar" : "criar"}: ${destino}`);
  console.log("Efeito em TODOS os clientes do OpenCode deste usuário (Desktop, web e 'opencode' sem o script):");
  console.log("- busca na web bloqueada;");
  console.log("- buscar URLs, acessar pastas fora do projeto e comandos de rede pedem aprovação;");
  console.log("- leitura e edição de arquivos de segredos (.env, chaves) bloqueadas;");
  console.log(`- instruções de segurança: ${SECURITY_INSTRUCTIONS}`);
  if (modelo) console.log(`- modelo padrão: ${modelo} (não treina com seus dados). A lista muda: rode 'config-global aplicar' de novo para atualizar;`);
  console.log("NÃO limita provedores: no Desktop, a escolha entre nuvem e local fica com você em /models.");
  console.log("Se você mover ou apagar esta pasta do repositório, rode 'config-global aplicar' de novo (as instruções apontam para ela).");
  if (!(await confirm("Gravar a configuração global?", { defaultYes: false }))) {
    console.log("Nada foi alterado.");
    return;
  }
  fs.mkdirSync(st.pasta, { recursive: true });
  if (nosso) {
    const copia = `${nosso.file}.bak-${carimbo()}`;
    fs.copyFileSync(nosso.file, copia);
    console.log(`Cópia da versão anterior: ${copia}`);
    if (nosso.file !== destino) fs.rmSync(nosso.file);
  }
  fs.writeFileSync(destino, texto(modelo));
  console.log(`Gravado: ${destino}`);
  console.log(RECARREGAR);
}

async function remover(st) {
  const nossos = st.arquivos.filter((a) => a.existe && a.nosso);
  const alheios = st.arquivos.filter((a) => a.existe && !a.nosso);
  if (!nossos.length) {
    console.log("Não há configuração global gerada por este repositório. Nada a remover.");
    if (alheios.length) console.log("Arquivos seus não são removidos pelo script.");
    return;
  }
  for (const a of nossos) console.log(`Vai desativar: ${a.file} (renomeado, não apagado)`);
  if (!(await confirm("Desativar a configuração global?", { defaultYes: false }))) {
    console.log("Nada foi alterado.");
    return;
  }
  for (const a of nossos) {
    const novo = `${a.file}.removido-${carimbo()}`;
    fs.renameSync(a.file, novo);
    console.log(`Renomeado para: ${novo} (o OpenCode ignora esse nome; apague quando quiser)`);
  }
  console.log(RECARREGAR);
}

// Atualização automática, usada pelo atalho do Desktop (decisão do mantenedor em 2026-11-08):
// sem perguntar, mas SÓ no arquivo com a marca do repositório e nunca se houver arquivo da pessoa na pasta.
// Atualiza as regras (vindas do repositório, após um 'git pull') e o modelo padrão (o melhor do dia que não treina).
// Sem a lista de hoje (sem internet), mantém o modelo atual. Nunca cria o arquivo: isso exige 'aplicar'.
export function atualizar(modeloDoDiaRes, env = process.env) {
  const st = estado(env);
  const nosso = st.arquivos.find((a) => a.existe && a.nosso);
  if (!nosso) return { mudou: false, motivo: "não há configuração global do repositório; rode 'config-global aplicar' uma vez" };
  if (st.arquivos.some((a) => a.existe && !a.nosso)) return { mudou: false, modelo: nosso.modelo, motivo: "há um arquivo seu na pasta global; nada foi alterado" };
  const modelo = modeloDoDiaRes?.modelo || nosso.modelo;
  if (nosso.atualizado && nosso.modelo === modelo) return { mudou: false, modelo, motivo: "já estava atualizada" };
  const destino = path.join(st.pasta, "opencode.jsonc");
  fs.writeFileSync(destino, texto(modelo));
  if (nosso.file !== destino) fs.rmSync(nosso.file);
  return { mudou: true, modelo, antes: nosso.modelo, regras: !nosso.atualizado, motivo: "atualizada" };
}

export function descreverAtualizacao(r) {
  if (!r.mudou) return `Configuração global: ${r.motivo}${r.modelo ? ` (modelo padrão: ${r.modelo})` : ""}.`;
  const partes = [];
  if (r.antes !== r.modelo) partes.push(`modelo padrão ${r.antes || "nenhum"} → ${r.modelo || "nenhum"}`);
  if (r.regras) partes.push("regras de segurança atualizadas");
  return `Configuração global atualizada: ${partes.join("; ")}.`;
}

// Melhor modelo do dia que não treina, consultando 'opencode models' só com o provedor gratuito do OpenCode.
// Sem OpenCode ou sem internet, nenhum modelo é gravado (o OpenCode usa o padrão dele).
export async function modeloDoDiaPadrao() {
  const nuvem = await import("./nuvem.mjs");
  const opencode = await import("./opencode.mjs");
  const prefs = (await import("./preferencias.mjs")).load();
  const cat = nuvem.load();
  const r = opencode.listModels(["opencode"]);
  if (!r.ok) return { modelo: null, motivo: "não foi possível consultar a lista de hoje ('opencode models'); nenhum modelo padrão gravado. ATENÇÃO: o OpenCode pode então usar um modelo que treina com seus dados." };
  const live = nuvem.parseModelList(r.stdout);
  const validados = Object.entries(prefs.validacoes || {}).filter(([k, v]) => k.startsWith("nuvem:") && v?.fluxo?.ok).map(([k]) => k.slice(6));
  const [melhor] = nuvem.autoCandidates(cat, ["opencode"], live, validados);
  if (!melhor) return { modelo: null, motivo: "nenhum modelo que não treina está disponível hoje; escolha em /models com cuidado." };
  return { modelo: melhor, motivo: "o melhor modelo disponível hoje que não treina com seus dados." };
}

export async function run(args = [], { modeloDoDia = null } = {}) {
  const sub = args[0] || "mostrar";
  title("Configuração global do OpenCode");
  const st = estado();
  mostrar(st);
  if (sub === "mostrar") {
    const nosso = st.arquivos.find((a) => a.existe && a.nosso);
    if (!nosso) console.log("\nPara aplicar: node scripts/ia-local.mjs config-global aplicar  (leia docs/interface-grafica.md)");
    return;
  }
  if (sub === "aplicar") {
    const md = modeloDoDia ? await modeloDoDia() : await modeloDoDiaPadrao();
    return aplicar(st, () => md);
  }
  if (sub === "remover") return remover(st);
  if (sub === "atualizar") {
    const md = modeloDoDia ? await modeloDoDia() : await modeloDoDiaPadrao();
    console.log(descreverAtualizacao(atualizar(md)));
    return;
  }
  warn(`Opção desconhecida: ${sub}`);
  throw new UserError(`'config-global ${sub}' não existe.`, "Use: config-global [mostrar|aplicar|atualizar|remover].");
}
