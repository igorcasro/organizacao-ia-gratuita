// Leitura do catálogo compartilhado e regras de recomendação.
// As regras ficam só aqui (não duplicadas por sistema operacional).
import path from "node:path";
import { REPO_DIR, readJson } from "./util.mjs";

export const CATALOG_FILE = path.join(REPO_DIR, "catalogo", "modelos.json");

// Margens usadas na estimativa. Ajuste aqui e documente em docs/modelos.md.
export const REGRAS = {
  fator_pesos: 1.15, // pesos carregados ocupam um pouco mais que o download
  sobrecarga_gb: 0.5, // buffers de execução
  fracao_vram_util: 0.9, // deixa folga para o sistema e a tela
  fracao_ram_util: 0.7, // deixa RAM para sistema, editor e navegador
  margem_disco_gb: 5,
  limite_cpu_b: 9, // bilhões de parâmetros ativos por token tolerados na CPU com prioridade 'equilibrio'
};

export function load(file = CATALOG_FILE) {
  const data = readJson(file);
  if (!data) throw new Error(`Catálogo não encontrado em ${file}.`);
  const errors = validate(data);
  if (errors.length) throw new Error(`Catálogo inválido (${file}):\n- ${errors.join("\n- ")}`);
  return data;
}

export function validate(data) {
  const errors = [];
  if (data.versao_esquema !== 1) errors.push("versao_esquema deve ser 1");
  if (!data.contexto?.padrao_tokens) errors.push("contexto.padrao_tokens é obrigatório");
  if (!Array.isArray(data.modelos) || !data.modelos.length) errors.push("modelos deve ser uma lista não vazia");
  const ids = new Set();
  for (const [i, m] of (data.modelos || []).entries()) {
    const where = `modelos[${i}] (${m.id ?? "sem id"})`;
    if (!m.id || !/^[a-z0-9][a-z0-9.-]*$/.test(m.id)) errors.push(`${where}: id deve ter só letras minúsculas, números, ponto e hífen`);
    if (ids.has(m.id)) errors.push(`${where}: id repetido`);
    ids.add(m.id);
    if (!m.ollama_tag || !m.ollama_tag.includes(":")) errors.push(`${where}: ollama_tag deve ter o formato nome:variante`);
    if (/(:|-)cloud$/.test(m.ollama_tag || "")) errors.push(`${where}: modelos em nuvem não são permitidos no catálogo`);
    if (!(m.download_gb?.max > 0)) errors.push(`${where}: download_gb.max é obrigatório`);
    if (!(m.estimativa?.contexto_gb_por_64k >= 0)) errors.push(`${where}: estimativa.contexto_gb_por_64k é obrigatório`);
    if (!Array.isArray(m.capacidades_declaradas)) errors.push(`${where}: capacidades_declaradas deve ser lista`);
    if (!m.consultado_em) errors.push(`${where}: consultado_em é obrigatório`);
    if (!Array.isArray(m.fontes) || !m.fontes.length) errors.push(`${where}: informe ao menos uma fonte`);
  }
  return errors;
}

export function estimateMemoryGb(model, contextTokens) {
  const pesos = model.download_gb.max * REGRAS.fator_pesos;
  const contexto = model.estimativa.contexto_gb_por_64k * (contextTokens / 65536);
  return pesos + contexto + REGRAS.sobrecarga_gb;
}

// Classifica cada modelo para o hardware informado.
// hw: { ram_gb, vram_gb (só GPU dedicada), gpu_integrada, disco_livre_gb }
// GPU integrada não soma memória: ela usa a mesma RAM do sistema.   perfil: { prioridade: "velocidade"|"equilibrio"|"qualidade" }
export function classify(catalog, hw, contextTokens) {
  const vramBudget = (hw.vram_gb || 0) * REGRAS.fracao_vram_util;
  const ramBudget = (hw.ram_gb || 0) * REGRAS.fracao_ram_util;
  return catalog.modelos.map((m) => {
    const memoria = estimateMemoryGb(m, contextTokens);
    const motivos = [];
    let classe;
    if (hw.ram_gb === null || hw.ram_gb === undefined) {
      classe = "indefinido";
      motivos.push("RAM desconhecida: informe manualmente no diagnóstico");
    } else if (memoria <= vramBudget) {
      classe = "recomendado";
      motivos.push(`estimativa de ${memoria.toFixed(1)} GB cabe na VRAM útil (${vramBudget.toFixed(1)} GB)`);
    } else if (memoria <= ramBudget + vramBudget) {
      classe = "possivel-lento";
      motivos.push(
        vramBudget > 0
          ? `estimativa de ${memoria.toFixed(1)} GB excede a VRAM útil; parte rodará na CPU (mais lento)`
          : hw.gpu_integrada
            ? `GPU integrada: usará ~${memoria.toFixed(1)} GB da RAM do sistema; o Ollama pode acelerar com Vulkan, mas fica mais lento que uma GPU dedicada`
            : `sem GPU dedicada: rodará na CPU usando ~${memoria.toFixed(1)} GB de RAM (lento)`
      );
      if (m.ativos_por_token_b) motivos.push(`MoE com ${m.ativos_por_token_b}B ativos por token tende a ser mais rápido na CPU que um modelo denso do mesmo tamanho`);
    } else {
      classe = "nao-recomendado";
      motivos.push(`estimativa de ${memoria.toFixed(1)} GB excede a memória útil (${(ramBudget + vramBudget).toFixed(1)} GB)`);
    }
    let disco_ok = null;
    if (hw.disco_livre_gb !== null && hw.disco_livre_gb !== undefined) {
      disco_ok = hw.disco_livre_gb >= m.download_gb.max + REGRAS.margem_disco_gb;
      if (!disco_ok) motivos.push(`espaço livre insuficiente: precisa de ~${(m.download_gb.max + REGRAS.margem_disco_gb).toFixed(0)} GB`);
    }
    return { modelo: m, memoria_estimada_gb: memoria, classe, disco_ok, motivos };
  });
}

const ORDER = { recomendado: 0, "possivel-lento": 1, indefinido: 2, "nao-recomendado": 3 };

// Ordena da melhor para a pior opção conforme a prioridade escolhida.
export function recommend(catalog, hw, perfil = {}, contextTokens = catalog.contexto.padrao_tokens) {
  const rows = classify(catalog, hw, contextTokens);
  const prioridade = perfil.prioridade || "equilibrio";
  const size = (r) => r.modelo.download_gb.max;
  rows.sort((a, b) => {
    const da = a.disco_ok === false ? 1 : 0;
    const db = b.disco_ok === false ? 1 : 0;
    if (da !== db) return da - db;
    if (ORDER[a.classe] !== ORDER[b.classe]) return ORDER[a.classe] - ORDER[b.classe];
    if (a.classe === "nao-recomendado") return a.memoria_estimada_gb - b.memoria_estimada_gb;
    if (prioridade === "velocidade") return size(a) - size(b);
    if (a.classe === "possivel-lento" && prioridade !== "qualidade") {
      // Em CPU, modelos com custo por token acima do limite ficam lentos demais para uso interativo.
      // O custo de um MoE conta pelos parâmetros ativos.
      const cost = (r) => r.modelo.ativos_por_token_b ?? r.modelo.parametros_b ?? size(r);
      const heavy = (r) => (cost(r) > REGRAS.limite_cpu_b ? 1 : 0);
      if (heavy(a) !== heavy(b)) return heavy(a) - heavy(b);
    }
    return size(b) - size(a);
  });
  const best = rows.find((r) => r.classe === "recomendado" && r.disco_ok !== false) || rows.find((r) => r.classe === "possivel-lento" && r.disco_ok !== false) || null;
  return { rows, best, contextTokens, prioridade };
}

export const LABELS = {
  recomendado: "Recomendado (cabe na GPU)",
  "possivel-lento": "Possível, porém lento (CPU, GPU integrada ou GPU parcial)",
  indefinido: "Indefinido (faltam dados)",
  "nao-recomendado": "Não recomendado (memória insuficiente)",
};
