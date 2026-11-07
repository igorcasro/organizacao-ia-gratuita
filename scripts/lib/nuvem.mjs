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
