// Classificação automática da privacidade de modelos gratuitos NOVOS (que ainda não estão no catálogo),
// lendo a seção "Privacy" da documentação oficial do OpenCode. Decisão do mantenedor em 2026-11-08.
//
// Regras deterministicas, sem pedir a um modelo de IA que interprete o texto (um modelo pode se enganar
// ou ser induzido a erro, e o erro aqui mandaria código para um modelo que treina com os dados):
//   - a página precisa conter a frase-base "zero-retention policy and do not use your data for model training";
//   - o modelo listado nas exceções é classificado pelo texto da exceção;
//   - o modelo que NÃO está nas exceções só vira "sem-treino" se a página citar o nome dele em outro lugar
//     (evita classificar como seguro um modelo que a documentação ainda nem conhece);
//   - em qualquer dúvida: "desconhecida" (nunca entra no automático).
// O resultado fica só neste computador (pasta local), vale por um dia e nunca altera o catálogo do repositório.
import path from "node:path";
import { localDir, nowIso, readJson, writeJson } from "./util.mjs";

export const FONTE = "https://raw.githubusercontent.com/anomalyco/opencode/dev/services/site/src/docs/content/console/models.mdx";
export const FRASE_BASE = /zero-retention policy and do not use your data for model training/i;

export function normalizar(s) {
  return `${s}`.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function secaoPrivacy(texto) {
  const i = texto.search(/^## Privacy\s*$/m);
  if (i < 0) return null;
  const resto = texto.slice(i + 1);
  const fim = resto.search(/^## /m);
  return fim < 0 ? resto : resto.slice(0, fim);
}

export function classificarTexto(nota) {
  if (/trial use only|use is logged/i.test(nota)) return "registrado";
  if (/not used for (model )?training/i.test(nota) && !/may be used|used to improve|and used/i.test(nota)) return "sem-treino";
  if (/train|improve/i.test(nota)) return "pode-treinar";
  return "desconhecida";
}

// ref: "opencode/<id>". Devolve { privacidade, nota } a partir do texto da página.
export function classificar(texto, ref) {
  const id = `${ref}`.split("/").slice(1).join("/");
  const chave = normalizar(id);
  const privacy = texto ? secaoPrivacy(texto) : null;
  if (!privacy || !FRASE_BASE.test(privacy)) {
    return { privacidade: "desconhecida", nota: "A documentação oficial não pôde ser interpretada (formato mudou)." };
  }
  for (const linha of privacy.split(/\r?\n/)) {
    const m = linha.match(/^- ([^:]+):\s*(.+)$/);
    if (!m) continue;
    const nome = m[1].replace(/\(.*?\)/g, "");
    if (normalizar(nome) === chave) {
      const nota = m[2].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();
      return { privacidade: classificarTexto(nota), nota: `Documentação oficial: "${nota.slice(0, 220)}"` };
    }
  }
  if (normalizar(texto).includes(chave)) {
    return { privacidade: "sem-treino", nota: "Documentação oficial: sem exceção para este modelo, então vale a regra geral (retenção zero e sem uso para treino)." };
  }
  return { privacidade: "desconhecida", nota: "O modelo ainda não aparece na documentação oficial." };
}

async function buscarTexto(url) {
  // Testes: IA_LOCAL_FONTE_PRIVACIDADE aponta para um arquivo local (ou para um que não existe = sem acesso).
  if (process.env.IA_LOCAL_FONTE_PRIVACIDADE) {
    try {
      return (await import("node:fs")).readFileSync(process.env.IA_LOCAL_FONTE_PRIVACIDADE, "utf8");
    } catch {
      return null;
    }
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function arquivoCache() {
  return path.join(localDir(), "privacidade-automatica.json");
}

// Classifica os modelos novos. Consulta a documentação no máximo uma vez por dia.
// Devolve { "<ref>": { privacidade, nota, fonte, data } }.
export async function classificarNovos(refs, { buscar = buscarTexto, hoje = nowIso().slice(0, 10), arquivo = arquivoCache() } = {}) {
  if (!refs.length) return {};
  const cache = readJson(arquivo, null) || {};
  const faltam = refs.filter((r) => !(cache.data === hoje && cache.modelos?.[r]));
  if (faltam.length) {
    const texto = await buscar(FONTE);
    const modelos = cache.data === hoje ? { ...(cache.modelos || {}) } : {};
    for (const r of faltam) {
      modelos[r] = texto
        ? { ...classificar(texto, r), fonte: FONTE, data: hoje }
        : { privacidade: "desconhecida", nota: "Sem acesso à documentação oficial agora.", fonte: FONTE, data: hoje };
    }
    if (texto) writeJson(arquivo, { data: hoje, modelos }, { backup: false });
    return Object.fromEntries(refs.map((r) => [r, modelos[r]]));
  }
  return Object.fromEntries(refs.map((r) => [r, cache.modelos[r]]));
}
