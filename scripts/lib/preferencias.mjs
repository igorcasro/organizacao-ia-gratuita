// Preferências locais do usuário neste computador. Nunca ficam no repositório.
import { localPath, readJson, writeJson, nowIso } from "./util.mjs";

export const PREFS_FILE = () => localPath("preferencias.json");

export function empty() {
  return {
    versao_esquema: 1,
    atualizado_em: null,
    perfil_uso: { tarefas: null, tamanho_projetos: null, prioridade: "equilibrio" },
    modelo: null, // { catalogo_id, base, efetivo, contexto_tokens, escolhido_em }
    modo_inicio: "ollama-launch", // ou "direto"
    modo: null, // null = ainda não escolhido; "nuvem" (recomendado), "misto" ou "local" — ver scripts/lib/nuvem.mjs
    nuvem: { provedores: [], modelo: null, consentimento: null }, // modelo: "opencode/<id>" opcional
    validacoes: {}, // por nome efetivo do modelo
  };
}

export function load() {
  const data = readJson(PREFS_FILE());
  if (!data) return empty();
  if (data.versao_esquema !== 1) {
    throw new Error(`Versão de preferências não suportada em ${PREFS_FILE()}. Renomeie o arquivo e refaça a seleção.`);
  }
  const base = empty();
  return { ...base, ...data, nuvem: { ...base.nuvem, ...(data.nuvem || {}) } };
}

export function save(prefs) {
  prefs.atualizado_em = nowIso();
  writeJson(PREFS_FILE(), prefs);
}

// Situação do modelo escolhido, da mais fraca para a mais forte:
// catalogo -> instalado -> contexto-configurado -> verificado-tecnicamente -> validado-no-fluxo
export function modelStage(prefs, installedNames) {
  const m = prefs.modelo;
  if (!m) return "nenhum";
  const v = prefs.validacoes?.[m.efetivo] || {};
  if (v.fluxo?.ok) return "validado-no-fluxo";
  if (v.tecnica?.ok) return "verificado-tecnicamente";
  if (installedNames.includes(m.efetivo)) return "contexto-configurado";
  if (installedNames.includes(m.base)) return "instalado";
  return "catalogo";
}
