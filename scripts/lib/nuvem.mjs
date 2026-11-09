// Modos de uso, na ordem de preferência do projeto:
//   nuvem  -> só modelos gratuitos em nuvem; o Ollama não é necessário (recomendado)
//   misto  -> modelo gratuito em nuvem como padrão; modelo local do Ollama disponível como reserva em /models
//   local  -> só Ollama; último recurso (sem internet, código confidencial ou limites da nuvem esgotados)
// Nunca há troca automática entre nuvem e local: a troca é sempre feita pela pessoa (/models ou comando 'modo').
// Nada pago: só entram provedores gratuitos, sem cartão nem créditos.
import path from "node:path";
import { REPO_DIR, readJson } from "./util.mjs";

export const CLOUD_FILE = path.join(REPO_DIR, "catalogo", "nuvem-gratuita.json");
export const MODOS = ["nuvem", "misto", "local"];
export const MODO_RECOMENDADO = "nuvem";
export const VERSAO_CONSENTIMENTO = 1;

export const MODO_DESCRICAO = {
  nuvem: "(recomendado) Só modelos gratuitos em nuvem. Sem Ollama e sem download; exige internet e envia o código ao provedor.",
  misto: "Nuvem gratuita como padrão + modelo local do Ollama como reserva, escolhido à mão em /models.",
  local: "(último recurso) Só Ollama. Nada sai do computador; exige baixar um modelo e hardware adequado.",
};

export const TEXTO_CONSENTIMENTO = [
  "Nos modos 'misto' e 'nuvem', quando um modelo em nuvem é usado, o OpenCode envia ao provedor os seus pedidos,",
  "trechos e arquivos do projeto que ele ler, e saídas de comandos executados.",
  "- Alguns modelos gratuitos PODEM usar esses dados para treinar ou melhorar modelos (veja a lista).",
  "- Os modelos são gratuitos 'por tempo limitado' e podem sumir ou mudar sem aviso; não há garantia de limite de uso.",
  "- Não use em código confidencial, de clientes ou com segredos (senhas, chaves, dados pessoais) sem autorização.",
];

export function load(file = CLOUD_FILE) {
  const data = readJson(file);
  if (!data) throw new Error(`Catálogo de nuvem não encontrado em ${file}.`);
  const errors = validate(data);
  if (errors.length) throw new Error(`Catálogo de nuvem inválido:\n- ${errors.join("\n- ")}`);
  return data;
}

export function validate(data) {
  const errors = [];
  if (data.versao_esquema !== 1) errors.push("versao_esquema deve ser 1");
  for (const [i, p] of (data.provedores || []).entries()) {
    const w = `provedores[${i}] (${p.id ?? "?"})`;
    if (!p.id) errors.push(`${w}: id obrigatório`);
    if (p.id === "ollama") errors.push(`${w}: o Ollama local não pertence a este catálogo`);
    if (p.precisa_chave && !p.variavel_chave) errors.push(`${w}: informe variavel_chave`);
    if (!p.fontes?.length || !p.consultado_em) errors.push(`${w}: fontes e consultado_em obrigatórios`);
    for (const m of p.modelos || []) {
      if (!["sem-treino", "pode-treinar", "registrado", "desconhecida"].includes(m.privacidade)) errors.push(`${w}/${m.id}: privacidade inválida`);
      if (p.id === "openrouter" && !(m.id.endsWith(":free") || m.id === "openrouter/free")) errors.push(`${w}/${m.id}: no OpenRouter só variantes :free`);
    }
  }
  return errors;
}

export function provider(cat, id) {
  return cat.provedores.find((p) => p.id === id);
}

// Referência do modelo no formato provedor/modelo usado pelo OpenCode.
export function modelRef(providerId, modelId) {
  return `${providerId}/${modelId}`;
}

// Provedores liberados nas políticas do OpenCode para cada modo.
export function allowedProviders(prefs) {
  const modo = prefs.modo;
  if (!modo) return [];
  const nuvem = modo === "local" ? [] : prefs.nuvem?.provedores || [];
  return modo === "nuvem" ? [...nuvem] : ["ollama", ...nuvem];
}

export function hasConsent(prefs) {
  return prefs.nuvem?.consentimento?.versao === VERSAO_CONSENTIMENTO;
}

// Verifica se as chaves exigidas estão no ambiente (nunca são gravadas pelo script).
export function missingKeys(cat, providers, env = process.env) {
  return providers
    .map((id) => provider(cat, id))
    .filter((p) => p?.precisa_chave && !env[p.variavel_chave])
    .map((p) => ({ provedor: p.id, variavel: p.variavel_chave }));
}

// ---- Modelo automático ("o melhor do dia que não treina com seus dados") ----
// Não existe uma avaliação oficial diária dos modelos gratuitos. O "melhor" é definido assim:
//   1) só modelos que aparecem AGORA em 'opencode models' (a lista muda sem aviso);
//   2) só modelos do catálogo com privacidade "sem-treino" (modelos novos, sem classificação, nunca entram);
//   3) primeiro os já validados no fluxo de programação neste computador ('validar-fluxo');
//   4) depois, a ordem do catálogo, que é a avaliação do mantenedor (ver 'criterio_ordem' no catálogo).
export const AUTO = "auto";

// Extrai "provedor/modelo" das linhas de 'opencode models'.
export function parseModelList(stdout) {
  return `${stdout || ""}`
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[\w.-]+\/\S+/.test(l))
    .map((l) => l.split(/\s+/)[0]);
}

export function findModel(cat, ref) {
  const [pid, ...rest] = `${ref}`.split("/");
  const id = rest.join("/");
  const p = provider(cat, pid);
  // No OpenRouter o id do catálogo já inclui o prefixo "openrouter/".
  const m = p?.modelos.find((x) => x.id === id || x.id === ref);
  return m ? { ...m, provedor: pid, ref } : null;
}

// Candidatos ao modelo automático, do melhor para o pior.
// "extras": classificação automática de modelos novos (privacidade.mjs); entram DEPOIS dos do catálogo.
export function autoCandidates(cat, providers, live = null, validados = [], extras = {}) {
  const ordem = [];
  for (const pid of providers) {
    const p = provider(cat, pid);
    for (const m of p?.modelos || []) if (m.privacidade === "sem-treino") ordem.push(modelRef(pid, m.id));
  }
  for (const [ref, c] of Object.entries(extras)) {
    if (c?.privacidade === "sem-treino" && providers.some((p) => ref.startsWith(`${p}/`)) && !ordem.includes(ref)) ordem.push(ref);
  }
  const presentes = live ? ordem.filter((r) => live.includes(r)) : ordem;
  return [...presentes.filter((r) => validados.includes(r)), ...presentes.filter((r) => !validados.includes(r))];
}

// Modelos que o OpenCode oferece hoje e que o catálogo ainda não classifica.
export function unclassified(cat, live, providers) {
  return (live || []).filter((r) => providers.some((p) => r.startsWith(`${p}/`)) && !findModel(cat, r));
}

export const ETIQUETA = {
  "sem-treino": "não treina com seus dados",
  "pode-treinar": "PODE TREINAR com seus dados",
  registrado: "uso registrado; nada confidencial",
  desconhecida: "privacidade não informada",
};
