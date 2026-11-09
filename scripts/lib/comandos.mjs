// Comandos e menu. Toda a lógica é compartilhada entre Windows e Ubuntu.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  REPO_DIR, localDir, ask, confirm, choose, closeInput, pauseInput, title, warn, fmtGb, nowIso, UserError, commandExists, runCapture,
} from "./util.mjs";
import * as catalogo from "./catalogo.mjs";
import * as diagnostico from "./diagnostico.mjs";
import * as ollama from "./ollama.mjs";
import * as opencode from "./opencode.mjs";
import * as prefsMod from "./preferencias.mjs";
import * as nuvem from "./nuvem.mjs";
import * as configGlobal from "./configglobal.mjs";
import * as desktop from "./desktop.mjs";
import * as atualizarRepo from "./atualizar.mjs";
import * as privacidade from "./privacidade.mjs";

const AJUDA = `
Uso: node scripts/ia-local.mjs [comando] [opções]

Sem comando, abre o menu.

Comandos:
  modo                     Escolhe o modo: nuvem gratuita (recomendado), misto (nuvem + reserva local) ou local.
  diagnostico [--manual]   Detecta sistema, CPU, RAM, GPU, disco e versões; --manual pede os valores.
  modelos                  Mostra o catálogo, os modelos instalados e a recomendação para este computador.
  selecionar               Escolhe o modelo, confirma o download, ajusta o contexto e salva a preferência.
  verificar [--local]      Verificação técnica do modo atual; --local verifica o modelo do Ollama (memória, contexto).
  validar-fluxo            Roteiro guiado de validação do fluxo de programação com projeto descartável.
  iniciar [pasta] [--nao-confiavel] [--direto]
                           Inicia o OpenCode na pasta (padrão: pasta atual) no modo escolhido.
                           --nao-confiavel ignora opencode.json, .opencode/ e AGENTS.md do projeto
                           (use em repositórios de terceiros). Veja docs/seguranca.md.
  status                   Mostra preferências, situação do modelo e caminhos dos arquivos locais.
  config-global [mostrar|aplicar|atualizar|remover]
                           Proteções do script no OpenCode Desktop, na web e no 'opencode' sem o script
                           (com confirmação; nunca altera arquivo seu). Veja docs/interface-grafica.md.
  desktop [atalho|remover-atalho]
                           Atualiza a configuração global e abre o OpenCode Desktop (Windows);
                           'atalho' cria na Área de Trabalho um atalho que faz isso a cada abertura.
  atualizar                Atualiza este repositório (git pull) e a configuração global. Dentro do
                           OpenCode, o mesmo pelo comando /atualizar-ia (após 'config-global aplicar').
  ajuda                    Mostra esta ajuda.

Arquivos locais (fora do repositório): ${localDir()}
`;

// ---------- utilidades internas ----------

async function installedLocalModels() {
  try {
    const list = await ollama.listModels();
    return list.filter((m) => !m.remote);
  } catch {
    return null;
  }
}

function diagOrNull() {
  try {
    return diagnostico.load() || null;
  } catch {
    return null;
  }
}

async function ensureDiag() {
  const d = diagOrNull();
  if (d) return d;
  console.log("Ainda não há diagnóstico salvo neste computador. Vamos fazê-lo agora.");
  return diagnostico.run();
}

function printRows(result, installedNames) {
  console.log(`Contexto considerado: ${result.contextTokens} tokens. Prioridade: ${result.prioridade}.`);
  console.log("Valores de memória são ESTIMATIVAS (ver docs/modelos.md). A medição real é feita em 'verificar'.\n");
  result.rows.forEach((r, i) => {
    const m = r.modelo;
    const inst = installedNames?.includes(m.ollama_tag) ? " [instalado]" : "";
    const dl = m.download_gb.min === m.download_gb.max ? `${m.download_gb.max} GB` : `${m.download_gb.min}–${m.download_gb.max} GB`;
    console.log(`${i + 1}) ${m.nome} — ${m.ollama_tag}${inst}`);
    console.log(`   ${catalogo.LABELS[r.classe]}${r.disco_ok === false ? " — SEM ESPAÇO EM DISCO" : ""}`);
    console.log(`   Download: ${dl} | memória estimada: ~${r.memoria_estimada_gb.toFixed(1)} GB | licença: ${m.licenca ?? "a confirmar"}`);
    console.log(`   Capacidades declaradas: ${m.capacidades_declaradas.join(", ") || "nenhuma"} | perfil: ${m.perfil}`);
    console.log(`   Motivo: ${r.motivos.join("; ")}`);
    if (m.limitacoes?.length) console.log(`   Limitações: ${m.limitacoes.join("; ")}`);
  });
}

async function askProfile(prefs) {
  title("Uso pretendido");
  console.log("Essas respostas ajudam a ordenar as opções. Pressione Enter para manter o valor entre colchetes.");
  const tarefasOpts = ["Explicar e revisar código", "Pequenas alterações e testes", "Tarefas longas em vários arquivos"];
  const tamOpts = ["Pequenos (até ~50 arquivos)", "Médios (até ~500 arquivos)", "Grandes (mais de 500 arquivos)"];
  const prioOpts = ["velocidade", "equilibrio", "qualidade"];
  const idx = (opts, v, d) => (opts.indexOf(v) >= 0 ? opts.indexOf(v) : d);
  const p = prefs.perfil_uso || {};
  console.log("Tipo de tarefa mais comum:");
  const t = await choose("Escolha", tarefasOpts, { defaultIndex: idx(tarefasOpts, p.tarefas, 1) });
  console.log("Tamanho típico dos projetos:");
  const s = await choose("Escolha", tamOpts, { defaultIndex: idx(tamOpts, p.tamanho_projetos, 0) });
  console.log("Prioridade entre velocidade e qualidade das respostas:");
  const q = await choose("Escolha", prioOpts, { defaultIndex: idx(prioOpts, p.prioridade, 1) });
  prefs.perfil_uso = { tarefas: tarefasOpts[t], tamanho_projetos: tamOpts[s], prioridade: prioOpts[q] };
  if (s === 2) console.log("Projetos grandes consomem mais contexto. O OpenCode compacta a conversa, mas espere respostas mais lentas.");
  return prefs.perfil_uso;
}

async function checkCapabilities(name) {
  const info = await ollama.show(name);
  const caps = info.capabilities || [];
  return {
    caps,
    tools: caps.includes("tools"),
    completion: caps.includes("completion"),
    licenca: (info.license || "").split("\n").find((l) => l.trim()) || null,
    quantizacao: info.details?.quantization_level || null,
    parametros: info.details?.parameter_size || null,
  };
}

// ---------- comandos ----------

export async function cmdModelos() {
  const catalog = catalogo.load();
  const diag = await ensureDiag();
  const prefs = prefsMod.load();
  const hw = diagnostico.effective(diag);
  const installed = await installedLocalModels();
  title("Modelos instalados no Ollama");
  if (installed === null) console.log("Não foi possível consultar: o Ollama não está respondendo. A recomendação abaixo continua válida.");
  else if (!installed.length) console.log("Nenhum modelo local instalado.");
  else installed.forEach((m) => console.log(`- ${m.name} (${fmtGb(m.sizeBytes / 1024 ** 3)})`));
  title("Catálogo e recomendação para este computador");
  const result = catalogo.recommend(catalog, hw, prefs.perfil_uso, catalog.contexto.padrao_tokens);
  printRows(result, installed?.map((m) => m.name));
  if (!result.best) {
    const reduced = catalogo.recommend(catalog, hw, prefs.perfil_uso, catalog.contexto.reduzido_tokens);
    if (reduced.best) {
      warn(`Nenhum modelo cabe com ${catalog.contexto.padrao_tokens} tokens. Com ${catalog.contexto.reduzido_tokens} tokens, a melhor opção seria ${reduced.best.modelo.nome}, abaixo do mínimo recomendado pela documentação do Ollama.`);
    } else {
      warn("Nenhum modelo do catálogo parece viável neste computador com as estimativas atuais. Veja docs/modelos.md, seção 'Quando nenhum modelo cabe'.");
    }
  } else {
    console.log(`\nSugestão: ${result.best.modelo.nome} (${result.best.modelo.ollama_tag}).`);
  }
  return result;
}

export async function cmdSelecionar() {
  const catalog = catalogo.load();
  const prefs = prefsMod.load();
  const diag = await ensureDiag();
  const hw = diagnostico.effective(diag);
  const ol = await ollama.status();
  if (!ol.online) {
    throw new UserError("O Ollama não está disponível; a seleção precisa dele para listar e baixar modelos.", ollama.OLLAMA_OFFLINE_HELP.replace("{url}", ol.url));
  }
  await askProfile(prefs);
  const installed = (await installedLocalModels()) || [];
  const installedNames = installed.map((m) => m.name);

  let contextTokens = catalog.contexto.padrao_tokens;
  let result = catalogo.recommend(catalog, hw, prefs.perfil_uso, contextTokens);
  if (!result.best) {
    const reduced = catalogo.recommend(catalog, hw, prefs.perfil_uso, catalog.contexto.reduzido_tokens);
    if (reduced.best) {
      warn(`Com ${contextTokens} tokens nenhum modelo cabe. É possível usar ${catalog.contexto.reduzido_tokens} tokens, abaixo do mínimo recomendado (64000) pela documentação do Ollama para o OpenCode: conversas longas perderão contexto mais cedo.`);
      if (await confirm(`Considerar ${catalog.contexto.reduzido_tokens} tokens?`)) {
        contextTokens = catalog.contexto.reduzido_tokens;
        result = reduced;
      }
    }
  }
  title("Escolha do modelo");
  printRows(result, installedNames);
  const others = installed.filter((m) => !catalog.modelos.some((c) => c.ollama_tag === m.name) && !m.name.startsWith("ia-local-"));
  const options = result.rows.map((r) => `${r.modelo.nome} (${r.modelo.ollama_tag})${r === result.best ? " <- sugestão" : ""}`);
  if (others.length) options.push("Outro modelo já instalado (fora do catálogo)");
  options.push("Cancelar");
  const defaultIndex = result.best ? result.rows.indexOf(result.best) : options.length - 1;
  console.log("");
  const pick = await choose("Número da opção", options, { defaultIndex });
  if (pick === options.length - 1) {
    console.log("Seleção cancelada. Nada foi alterado.");
    return null;
  }

  let catalogId;
  let baseTag;
  if (pick < result.rows.length) {
    const row = result.rows[pick];
    catalogId = row.modelo.id;
    baseTag = row.modelo.ollama_tag;
    if (row.classe === "nao-recomendado" && !(await confirm("Este modelo provavelmente não cabe na memória. Continuar mesmo assim?"))) return null;
    if (!installedNames.includes(baseTag)) {
      const dl = row.modelo.download_gb.max;
      console.log(`\n${baseTag} não está instalado. Download aproximado: ${dl} GB. Espaço livre detectado: ${fmtGb(hw.disco_livre_gb)}.`);
      if (row.disco_ok === false) {
        throw new UserError("Espaço em disco insuficiente para este modelo.", "Libere espaço ou mude a pasta de modelos (OLLAMA_MODELS). Veja docs/problemas.md, seção 'Falta de espaço'.");
      }
      if (!(await confirm(`Baixar ${baseTag} agora?`))) {
        console.log("Download não autorizado. Nada foi alterado.");
        return null;
      }
      pauseInput(); // libera o terminal para o progresso do Ollama
      await ollama.pull(baseTag);
    }
  } else {
    console.log("Modelos instalados fora do catálogo:");
    const i = await choose("Número do modelo", others.map((m) => m.name));
    baseTag = others[i].name;
    catalogId = baseTag.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
    warn("Modelos fora do catálogo não têm estimativas nem revisão. A verificação técnica e o roteiro de validação são ainda mais importantes.");
  }

  const caps = await checkCapabilities(baseTag);
  console.log(`\nCapacidades informadas pelo Ollama para ${baseTag}: ${caps.caps.join(", ") || "nenhuma"}`);
  console.log(`Parâmetros: ${caps.parametros ?? "?"} | quantização: ${caps.quantizacao ?? "?"} | licença (1ª linha): ${caps.licenca ?? "não informada"}`);
  if (!caps.completion || !caps.tools) {
    warn("O modelo não declara suporte a ferramentas ('tools'). O OpenCode depende disso para ler e editar arquivos e executar comandos.");
    if (!(await confirm("Continuar mesmo assim?"))) return null;
  }

  const efetivo = ollama.derivedName(catalogId, contextTokens);
  console.log(`\nO OpenCode precisa de uma janela de contexto maior que o padrão do Ollama em computadores com menos de 24 GB de VRAM.`);
  console.log(`Será criado o modelo '${efetivo}' com 'num_ctx ${contextTokens}', a partir de '${baseTag}'.`);
  console.log("Isso não baixa nada de novo, não altera o serviço do Ollama e pode ser desfeito com 'ollama rm " + efetivo + "'.");
  const freshInstalled = ((await installedLocalModels()) || []).map((m) => m.name);
  if (!freshInstalled.includes(efetivo) || (await confirm(`'${efetivo}' já existe. Recriar?`))) {
    if (!freshInstalled.includes(efetivo) && !(await confirm("Criar agora?", { defaultYes: true }))) return null;
    pauseInput();
    await ollama.createDerived(baseTag, efetivo, contextTokens);
  }

  prefs.modelo = { catalogo_id: catalogId, base: baseTag, efetivo, contexto_tokens: contextTokens, escolhido_em: nowIso() };
  if (!prefs.modo) {
    prefs.modo = "local";
    console.log("Modo definido como 'local' (nenhum modo havia sido escolhido). Para usar a nuvem gratuita, rode 'modo'.");
  } else if (prefs.modo === "nuvem") {
    console.log("Observação: no modo 'nuvem' o modelo local não é usado. Ele serve de reserva no modo 'misto' ou como padrão no 'local'.");
  }
  prefsMod.save(prefs);
  console.log(`\nPreferência salva em ${prefsMod.PREFS_FILE()}.`);
  console.log("Situação: modelo instalado e contexto configurado, mas AINDA NÃO validado. Próximo passo: 'verificar'.");
  return prefs.modelo;
}

export async function cmdVerificar(args = []) {
  const prefs = prefsMod.load();
  if (!args.includes("--local") && (prefs.modo === "nuvem" || prefs.modo === "misto")) {
    const ok = await verificarNuvem(prefs);
    if (prefs.modo === "misto") console.log("Modo misto: para verificar também o modelo local de reserva, rode 'verificar --local'.");
    return ok;
  }
  if (!prefs.modelo) throw new UserError("Nenhum modelo escolhido.", "Use a opção 'selecionar' primeiro.");
  const { efetivo, contexto_tokens } = prefs.modelo;
  const ol = await ollama.requireOnline();
  const names = ((await installedLocalModels()) || []).map((m) => m.name);
  if (!names.includes(efetivo)) {
    throw new UserError(`O modelo '${efetivo}' não está no Ollama.`, "Use 'selecionar' para baixar o modelo e recriar o contexto. Veja docs/problemas.md, seção 'Modelo ausente'.");
  }
  title(`Verificação técnica de ${efetivo}`);
  const checks = [];
  const add = (nome, ok, detalhe) => {
    checks.push({ nome, ok, detalhe });
    console.log(`${ok ? "[OK]  " : "[FALHA]"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  };
  add("Ollama respondendo", true, `versão ${ol.serverVersion} em ${ol.url}`);
  const caps = await checkCapabilities(efetivo);
  add("Modelo declara 'tools' e 'completion'", caps.tools && caps.completion, caps.caps.join(", "));
  const oc = opencode.detect();
  add("OpenCode 2 instalado", oc.instalado && oc.major === 2, oc.instalado ? `versão ${oc.versao}` : "não encontrado");
  console.log("\nCarregando o modelo para medir memória e contexto (pode levar alguns minutos na primeira vez)...");
  let medida = null;
  try {
    const { loadSeconds, entry } = await ollama.loadAndMeasure(efetivo);
    if (entry) {
      const total = entry.size / 1024 ** 3;
      const vram = (entry.size_vram || 0) / 1024 ** 3;
      const gpuPct = total > 0 ? Math.round((vram / total) * 100) : 0;
      medida = { carga_segundos: Number(loadSeconds.toFixed(1)), memoria_gb: Number(total.toFixed(2)), vram_gb: Number(vram.toFixed(2)), gpu_percentual: gpuPct, contexto_carregado: entry.context_length ?? null };
      add("Modelo carregado", true, `${fmtGb(total)} em memória, ${gpuPct}% na GPU, ${loadSeconds.toFixed(1)} s`);
      add(`Contexto carregado >= ${contexto_tokens}`, (entry.context_length ?? 0) >= contexto_tokens, `${entry.context_length ?? "não informado"} tokens`);
      const diag = diagOrNull();
      const hw = diag ? diagnostico.effective(diag) : {};
      if (hw.gpu_integrada && !(hw.vram_gb > 0)) {
        console.log(gpuPct > 0
          ? `Observação: ${gpuPct}% do modelo está na GPU integrada (memória compartilhada com o sistema).`
          : "Observação: o modelo está rodando só na CPU; a GPU integrada não foi usada. Veja docs/problemas.md, seção 'GPU não usada'.");
      } else if (gpuPct === 0 && hw.vram_gb > 0) {
        console.log("Observação: há GPU dedicada, mas o modelo ficou todo na CPU. Veja docs/problemas.md, seção 'GPU não usada'.");
      } else if (gpuPct < 100) {
        console.log("Observação: parte do modelo está na CPU; as respostas serão mais lentas (medição real, não estimativa).");
      }
    } else {
      add("Modelo carregado", false, "não apareceu em /api/ps");
    }
  } catch (err) {
    add("Modelo carregado", false, `${err.message}. Se for falta de memória, escolha um modelo menor ou o contexto reduzido.`);
  }
  const ok = checks.every((c) => c.ok);
  prefs.validacoes[efetivo] = {
    ...(prefs.validacoes[efetivo] || {}),
    tecnica: { data: nowIso(), ok, versao_ollama: ol.serverVersion, versao_opencode: oc.versao, medida, checks },
  };
  prefsMod.save(prefs);
  console.log(`\nResultado: ${ok ? "verificado tecnicamente" : "verificação com falhas"}. Isso NÃO comprova o fluxo de programação; use 'validar-fluxo'.`);
  return ok;
}

const ROTEIRO = [
  ["inicializacao", "O OpenCode abriu e mostra o modelo escolhido (comando /models ou rodapé); em /models só aparecem provedores liberados pelo modo."],
  ["leitura", "Pedido: \"Leia o arquivo src/calculadora.mjs e liste as funções.\" O modelo usou a ferramenta de leitura e respondeu corretamente."],
  ["explicacao", "Pedido: \"Explique o que a função media faz e qual problema ela tem com lista vazia.\" A explicação faz sentido."],
  ["alteracao", "Pedido: \"Corrija media para retornar 0 quando a lista estiver vazia.\" O arquivo da CÓPIA DESCARTÁVEL (pasta mostrada acima, não o seu repositório) foi alterado; confira com git diff nessa pasta."],
  ["teste", "Pedido: \"Remova o .skip do teste 'media de lista vazia' e execute npm test.\" O modelo executou o comando e os 4 testes passaram. (Comandos comuns como npm test rodam sem pedir aprovação; só comandos de rede pedem.)"],
  ["reversao", "Você revisou a alteração com git diff e conseguiu revertê-la (git checkout -- . ou /undo no OpenCode)."],
];

export function prepareExample() {
  const src = path.join(REPO_DIR, "exemplos", "projeto-validacao");
  const dest = path.join(os.tmpdir(), `ia-local-validacao-${Date.now()}`);
  fs.cpSync(src, dest, { recursive: true });
  const git = commandExists("git") ? initGit(dest) : false;
  return { dest, git };
}

function initGit(dest) {
  const run = (args) => runCapture("git", ["-C", dest, ...args], { timeoutMs: 15000 }).ok;
  return run(["init", "-q"]) && run(["add", "."]) && run(["-c", "user.name=ia-local", "-c", "user.email=ia-local@localhost", "commit", "-q", "-m", "estado inicial"]);
}

export async function cmdValidarFluxo() {
  const prefs = prefsMod.load();
  if (!prefs.modo) throw new UserError("Modo ainda não escolhido.", "Rode 'node scripts/ia-local.mjs modo' (recomendado: nuvem).");
  if (prefs.modo === "local" && !prefs.modelo) throw new UserError("Nenhum modelo escolhido.", "Use 'selecionar' e depois 'verificar'.");
  const efetivo = validationKey(prefs);
  title(`Validação do fluxo de programação com ${efetivo}`);
  console.log("Use um projeto pequeno e descartável. Nada no seu projeto real será tocado.");
  let dest = null;
  if (await confirm("Criar uma cópia descartável de exemplos/projeto-validacao na pasta temporária?", { defaultYes: true })) {
    const r = prepareExample();
    dest = r.dest;
    console.log(`Cópia criada em: ${dest}${r.git ? " (repositório git inicializado para revisar e reverter)" : " (git não encontrado: compare os arquivos manualmente)"}`);
  }
  console.log("\nEm OUTRO terminal, execute:");
  console.log(`  node "${path.join(REPO_DIR, "scripts", "ia-local.mjs")}" iniciar "${dest ?? "<pasta do projeto descartável>"}"`);
  console.log("Siga os itens abaixo dentro do OpenCode e responda aqui ao final de cada um.");
  if (dest) console.log(`As alterações do modelo acontecem SÓ na cópia (${dest}); o repositório não muda.`);
  console.log("");
  const itens = {};
  for (const [id, texto] of ROTEIRO) {
    console.log(`- ${texto}`);
    const ok = await confirm("  Funcionou?");
    const obs = await ask("  Observação (opcional)", { defaultValue: "" });
    itens[id] = { ok, obs: obs || undefined };
  }
  const ok = Object.values(itens).every((i) => i.ok);
  const oc = opencode.detect();
  const ol = await ollama.status();
  prefs.validacoes[efetivo] = {
    ...(prefs.validacoes[efetivo] || {}),
    fluxo: { data: nowIso(), ok, itens, sistema: `${os.type()} ${os.release()}`, versao_opencode: oc.versao, versao_ollama: ol.serverVersion },
  };
  prefsMod.save(prefs);
  console.log(`\nResultado registrado localmente: ${ok ? "VALIDADO no fluxo de programação" : "NÃO validado (veja os itens com falha)"}.`);
  console.log("Para compartilhar com a equipe, copie o resumo para docs/validacao.md (sem dados pessoais).");
  return ok;
}

export async function cmdIniciar(args) {
  const direto = args.includes("--direto");
  const opts = { naoConfiavel: args.includes("--nao-confiavel") };
  const dirArg = args.find((a) => !a.startsWith("--"));
  const dir = path.resolve(dirArg || process.cwd());
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new UserError(`A pasta não existe: ${dir}`, "Informe o caminho de uma pasta de projeto existente.");
  const prefs = prefsMod.load();
  const modo = prefs.modo;
  if (!modo) throw new UserError("Modo ainda não escolhido.", "Rode 'node scripts/ia-local.mjs modo'. Recomendado: nuvem (modelos gratuitos, sem download). O local é o último recurso.");
  const providers = nuvem.allowedProviders(prefs);
  if (modo !== "local") requireCloudReady(prefs, providers);

  if (modo === "nuvem" || modo === "misto") {
    opencode.requireV2();
    let local = null;
    if (modo === "misto") local = await localReserve(prefs);
    closeInput();
    const escolhido = await resolveCloudModel(prefs, providers);
    const alvo = escolhido || "modelo a escolher em /models";
    console.log(`Iniciando o OpenCode em ${dir} no modo ${modo.toUpperCase()} (${alvo}). Provedores liberados: ${providers.join(", ")}.`);
    if (local) console.log(`Reserva local disponível em /models: ollama/${local.efetivo}.`);
    console.log("Lembrete: com um modelo em nuvem, o código que o OpenCode ler é enviado ao provedor do modelo.");
    if (opts.naoConfiavel) console.log("Projeto marcado como não confiável: opencode.json, .opencode/ e AGENTS.md do projeto serão ignorados.");
    const r = await opencode.launchCloud(dir, providers, escolhido || undefined, local, opts);
    if (!r.ok && r.error) throw new UserError(`Falha ao iniciar: ${r.error.message}`, "Veja docs/problemas.md, seção 'OpenCode não inicia'.");
    return r;
  }

  // Modo local (último recurso).
  if (!prefs.modelo) throw new UserError("Nenhum modelo local escolhido.", "Use 'selecionar' primeiro, ou escolha o modo 'nuvem' com o comando 'modo'.");
  const { efetivo, contexto_tokens } = prefs.modelo;
  if (ollama.isCloudName(efetivo)) throw new UserError("Modelos ':cloud' do Ollama são pagos e não são usados por este repositório.", "Escolha um modelo local em 'selecionar'.");
  await ollama.requireOnline();
  const names = ((await installedLocalModels()) || []).map((m) => m.name);
  if (!names.includes(efetivo)) throw new UserError(`O modelo '${efetivo}' não está no Ollama.`, "Use 'selecionar' para baixá-lo e configurar o contexto.");
  opencode.requireV2();
  const stage = prefsMod.modelStage(prefs, names);
  if (stage !== "validado-no-fluxo" && stage !== "verificado-tecnicamente") {
    warn(`Situação do modelo: ${stage}. Recomenda-se rodar 'verificar' antes de usar em projetos reais.`);
  }
  closeInput();
  console.log(`Iniciando o OpenCode em ${dir} com ollama/${efetivo} (${direto ? "modo direto" : "via 'ollama launch'"}).`);
  if (opts.naoConfiavel) console.log("Projeto marcado como não confiável: opencode.json, .opencode/ e AGENTS.md do projeto serão ignorados.");
  const r = direto ? await opencode.launchDirect(efetivo, dir, contexto_tokens, providers, opts) : await opencode.launchViaOllama(efetivo, dir, providers, opts);
  if (!r.ok && r.error) throw new UserError(`Falha ao iniciar: ${r.error.message}`, "Veja docs/problemas.md, seção 'OpenCode não inicia'.");
  return r;
}

// No modo misto, o modelo local é só reserva: se o Ollama estiver fora do ar, o início continua só com a nuvem.
async function localReserve(prefs) {
  if (!prefs.modelo) {
    warn("Modo misto sem modelo local de reserva. Para tê-lo, rode 'selecionar' (exige Ollama e download).");
    return null;
  }
  const s = await ollama.status();
  if (!s.online) {
    warn("Ollama indisponível: a reserva local não aparecerá em /models nesta sessão.");
    return null;
  }
  const names = ((await installedLocalModels()) || []).map((m) => m.name);
  if (!names.includes(prefs.modelo.efetivo)) {
    warn(`O modelo local '${prefs.modelo.efetivo}' não está no Ollama; a reserva não aparecerá. Use 'selecionar'.`);
    return null;
  }
  return prefs.modelo;
}

// Modelo em nuvem que será usado agora. Consulta 'opencode models' (sem enviar pedidos a modelos):
// no automático, escolhe o melhor que não treina; num modelo fixo que sumiu da lista, cai para o automático
// (que só usa modelos "sem-treino", então a privacidade nunca piora). Nunca troca para o local.
async function resolveCloudModel(prefs, providers, { listar = opencode.listModels } = {}) {
  const cat = nuvem.load();
  const fixo = prefs.nuvem?.modelo && prefs.nuvem.modelo !== nuvem.AUTO ? prefs.nuvem.modelo : null;
  if (!prefs.nuvem?.modelo) return null; // "escolher depois, em /models"
  const r = listar(providers.filter((p) => p !== "ollama"));
  const live = r.ok ? nuvem.parseModelList(r.stdout) : null;
  if (!live) warn("Não foi possível consultar a lista atual de modelos ('opencode models'); usando o catálogo do repositório.");
  const novos = live ? nuvem.unclassified(cat, live, providers) : [];
  const extras = await privacidade.classificarNovos(novos);
  for (const r of novos) {
    const c = extras[r];
    const uso = c.privacidade === "sem-treino" ? "pode ser usado no automático" : "não é usado no automático";
    console.log(`Modelo novo, fora do catálogo: ${r} — ${nuvem.ETIQUETA[c.privacidade]} (classificado automaticamente pela documentação oficial; ${uso}).`);
  }
  if (fixo && (!live || live.includes(fixo))) {
    const m = nuvem.findModel(cat, fixo);
    console.log(`Modelo escolhido por você: ${fixo} — ${m ? nuvem.ETIQUETA[m.privacidade] : "privacidade não classificada no catálogo"}.`);
    return fixo;
  }
  if (fixo) warn(`O modelo escolhido (${fixo}) não está mais na lista de hoje. Usando o automático; para fixar outro, rode 'modo'.`);
  const validados = Object.entries(prefs.validacoes || {})
    .filter(([k, v]) => k.startsWith("nuvem:") && v?.fluxo?.ok)
    .map(([k]) => k.slice("nuvem:".length));
  const [melhor] = nuvem.autoCandidates(cat, providers, live, validados, extras);
  if (!melhor) {
    warn("Nenhum modelo que não treina com seus dados está disponível hoje. O OpenCode abrirá sem modelo padrão: escolha em /models, olhando a privacidade em catalogo/nuvem-gratuita.json, ou use o modo local.");
    return null;
  }
  const nota = nuvem.findModel(cat, melhor)?.nota_privacidade || extras[melhor]?.nota || "";
  console.log(`Modelo automático de hoje: ${melhor} — não treina com seus dados${validados.includes(melhor) ? "; validado no fluxo neste computador" : ""}. ${nota}`);
  prefs.nuvem.ultimo_auto = melhor;
  prefsMod.save(prefs);
  const global = configGlobal.estado().arquivos.find((a) => a.existe && a.nosso);
  if (global && global.modelo !== melhor) {
    console.log(`O modelo padrão do Desktop/configuração global (${global.modelo || "nenhum"}) não é o melhor de hoje. Para atualizar: node scripts/ia-local.mjs config-global aplicar`);
  }
  return melhor;
}

function validationKey(prefs) {
  if (prefs.modo === "nuvem" || prefs.modo === "misto") {
    const m = prefs.nuvem?.modelo === nuvem.AUTO ? prefs.nuvem?.ultimo_auto || nuvem.AUTO : prefs.nuvem?.modelo;
    return `nuvem:${m || "escolhido-em-models"}`;
  }
  return prefs.modelo.efetivo;
}

function requireCloudReady(prefs, providers) {
  if (!nuvem.hasConsent(prefs)) {
    throw new UserError(`O modo '${prefs.modo}' usa nuvem, mas o consentimento não foi registrado.`, "Rode 'node scripts/ia-local.mjs modo' e confirme, ou escolha o modo local.");
  }
  const cat = nuvem.load();
  const cloud = providers.filter((p) => p !== "ollama");
  const missing = nuvem.missingKeys(cat, cloud);
  for (const m of missing) warn(`Provedor ${m.provedor}: variável ${m.variavel} não definida; ele ficará indisponível. Veja docs/nuvem-gratuita.md.`);
  if (missing.length === cloud.length) {
    throw new UserError("Nenhum provedor em nuvem utilizável: falta a chave de todos os escolhidos.", "Defina a variável indicada ou inclua os modelos gratuitos do OpenCode (sem chave) no comando 'modo'.");
  }
}

// ---------- modo de uso ----------

export async function cmdModo() {
  const prefs = prefsMod.load();
  const cat = nuvem.load();
  title("Modo de uso");
  console.log(`Modo atual: ${prefs.modo || "ainda não escolhido"}\n`);
  const idx = await choose("Escolha o modo", nuvem.MODOS.map((m) => `${m} — ${nuvem.MODO_DESCRICAO[m]}`), { defaultIndex: nuvem.MODOS.indexOf(prefs.modo || nuvem.MODO_RECOMENDADO) });
  const modo = nuvem.MODOS[idx];
  if (modo === "local") {
    prefs.modo = "local";
    prefsMod.save(prefs);
    console.log("Modo local salvo. Nenhum provedor em nuvem será liberado no OpenCode.");
    if (!prefs.modelo) console.log("Próximo passo: 'diagnostico' e 'selecionar' para escolher e baixar o modelo local.");
    return prefs;
  }

  title("Antes de usar modelos em nuvem");
  nuvem.TEXTO_CONSENTIMENTO.forEach((l) => console.log(l));
  console.log("");
  const escolhidos = [];
  for (const p of cat.provedores) {
    console.log(`* ${p.nome}`);
    console.log(`  Conta: ${p.precisa_conta ? "sim" : "não"} | chave: ${p.precisa_chave ? `sim (${p.variavel_chave})` : "não"}`);
    console.log(`  Custo: ${p.custo}`);
    console.log(`  Limites: ${p.limites}`);
    if (await confirm(`  Liberar ${p.id}?`, { defaultYes: p.id === "opencode" })) escolhidos.push(p.id);
  }
  if (!escolhidos.length) {
    console.log("Nenhum provedor escolhido. Nada foi alterado.");
    return null;
  }
  const resposta = (await ask('Para confirmar que leu os avisos acima, digite "concordo"')).toLowerCase();
  if (resposta !== "concordo") {
    console.log("Confirmação não recebida. Nada foi alterado.");
    return null;
  }
  for (const m of nuvem.missingKeys(cat, escolhidos)) {
    warn(`A variável ${m.variavel} não está definida neste terminal. Defina-a como explicado em docs/nuvem-gratuita.md; o script nunca grava a chave.`);
  }

  let modelo = prefs.nuvem?.modelo || null;
  {
    // Padrão: automático. A lista só aparece se a pessoa quiser fixar um modelo, e é a lista REAL de hoje
    // ('opencode models'), com a privacidade do catálogo; modelos novos aparecem como "não classificada".
    console.log("\nModelo padrão:");
    const atual = prefs.nuvem?.modelo;
    const fixoAtual = atual && atual !== nuvem.AUTO;
    const i = await choose("Número", [
      "Automático (recomendado): a cada início, o melhor modelo disponível no dia que NÃO treina com seus dados",
      "Fixar um modelo (avançado): escolher numa lista dos modelos disponíveis hoje",
      "Escolher depois, dentro do OpenCode (/models)",
    ], { defaultIndex: fixoAtual ? 1 : 0 });
    if (i === 0) modelo = nuvem.AUTO;
    else if (i === 2) modelo = null;
    else {
      const r = opencode.listModels(escolhidos);
      const live = r.ok ? nuvem.parseModelList(r.stdout).filter((ref) => escolhidos.some((p) => ref.startsWith(`${p}/`))) : null;
      if (!live) warn("Não foi possível consultar a lista de hoje ('opencode models'); mostrando o catálogo do repositório.");
      const todos = live || escolhidos.flatMap((pid) => nuvem.provider(cat, pid).modelos.map((m) => nuvem.modelRef(pid, m.id)));
      const auto = await privacidade.classificarNovos(nuvem.unclassified(cat, todos, escolhidos));
      // Ordem de recomendação (a mesma do automático), não a ordem em que o OpenCode lista.
      const validados = Object.entries(prefs.validacoes || {}).filter(([k, v]) => k.startsWith("nuvem:") && v?.fluxo?.ok).map(([k]) => k.slice(6));
      const recomendados = nuvem.autoCandidates(cat, escolhidos, todos, validados, auto);
      const refs = [...recomendados, ...todos.filter((r) => !recomendados.includes(r))];
      const rotulo = (ref) => {
        const m = nuvem.findModel(cat, ref);
        if (ref === recomendados[0]) return `${ref} — ${nuvem.ETIQUETA[m ? m.privacidade : "sem-treino"]} (RECOMENDADO HOJE: é o que o Automático usaria)`;
        if (m) return `${ref} — ${nuvem.ETIQUETA[m.privacidade]}`;
        const a = auto[ref];
        return a && a.privacidade !== "desconhecida"
          ? `${ref} — ${nuvem.ETIQUETA[a.privacidade]} (modelo novo; classificado pela documentação oficial)`
          : `${ref} — privacidade NÃO classificada (modelo novo; pode treinar com seus dados)`;
      };
      console.log("\nEm ordem de recomendação: primeiro os que não treinam com seus dados (o 1º é o que o Automático usaria hoje).");
      console.log("A ordem segue privacidade e validação, não é um ranking de desempenho (veja docs/nuvem-gratuita.md).");
      const j = await choose("Número", refs.map(rotulo), { defaultIndex: Math.max(0, refs.indexOf(atual)) });
      modelo = refs[j];
      const m = nuvem.findModel(cat, modelo) || (auto[modelo] && { privacidade: auto[modelo].privacidade, nota_privacidade: auto[modelo].nota });
      if (!m || m.privacidade === "desconhecida") warn("Este modelo ainda não tem a privacidade classificada. Trate como se pudesse treinar com seus dados.");
      else if (m.privacidade !== "sem-treino") warn(m.nota_privacidade);
    }
  }
  if (modo === "misto" && !prefs.modelo) {
    console.log("Modo misto: para ter a reserva local, rode depois 'diagnostico' e 'selecionar' (exige Ollama e download).");
  }

  prefs.modo = modo;
  prefs.nuvem = { provedores: escolhidos, modelo, consentimento: { versao: nuvem.VERSAO_CONSENTIMENTO, data: nowIso() } };
  prefsMod.save(prefs);
  console.log(`\nModo '${modo}' salvo. Provedores em nuvem liberados: ${escolhidos.join(", ")}.`);
  console.log("Próximo passo: 'verificar'. Para usar só o local (sem internet ou código confidencial): 'modo' e escolha 'local'.");
  return prefs;
}

async function verificarNuvem(prefs) {
  const providers = nuvem.allowedProviders(prefs);
  title(`Verificação do modo ${prefs.modo}`);
  const checks = [];
  const add = (nome, ok, detalhe) => {
    checks.push({ nome, ok, detalhe });
    console.log(`${ok ? "[OK]  " : "[FALHA]"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  };
  const oc = opencode.detect();
  add("OpenCode 2 instalado", oc.instalado && oc.major === 2, oc.instalado ? `versão ${oc.versao}` : "não encontrado");
  add("Consentimento registrado", nuvem.hasConsent(prefs), prefs.nuvem?.consentimento?.data);
  const cat = nuvem.load();
  const missing = nuvem.missingKeys(cat, providers);
  add("Chaves necessárias no ambiente", missing.length === 0, missing.length ? `faltando: ${missing.map((m) => m.variavel).join(", ")}` : "nenhuma faltando");
  let modelo = prefs.nuvem?.modelo || null;
  if (oc.instalado && oc.major === 2 && modelo) modelo = await resolveCloudModel(prefs, providers);
  if (oc.instalado && oc.major === 2) {
    console.log("\nConsultando o catálogo do OpenCode com as políticas do modo (nenhum pedido é enviado a modelos)...");
    const r = opencode.listModels(providers, modelo || undefined);
    const linhas = `${r.stdout}`.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[\w.-]+\/\S+/.test(l));
    const fora = linhas.filter((l) => !providers.some((p) => l.startsWith(`${p}/`)));
    add("'opencode models' executou", r.ok, r.ok ? `${linhas.length} modelos listados` : (r.stderr || r.error?.message || "").slice(0, 200));
    if (r.ok) {
      add("Só provedores liberados aparecem", fora.length === 0, fora.length ? `outros: ${fora.slice(0, 5).join(", ")}` : providers.join(", "));
      if (modelo) add("Modelo padrão disponível", linhas.some((l) => l.split(/\s+/)[0] === modelo), modelo);
    }
    if (modelo && r.ok && (await confirm("Enviar um pedido curto de teste ('Responda somente com a palavra OK') ao modelo em nuvem?", { defaultYes: true }))) {
      const t = opencode.smokeTest(providers, modelo, os.tmpdir());
      add("Pedido de teste respondido", t.ok && /ok/i.test(t.stdout), t.ok ? t.stdout.slice(0, 80) : (t.stderr || "").slice(0, 200));
    }
  }
  const ok = checks.every((c) => c.ok);
  const key = validationKey(prefs);
  prefs.validacoes[key] = { ...(prefs.validacoes[key] || {}), tecnica: { data: nowIso(), ok, versao_opencode: oc.versao, checks } };
  prefsMod.save(prefs);
  console.log(`\nResultado: ${ok ? "verificado tecnicamente" : "verificação com falhas"}. Isso NÃO comprova o fluxo de programação; use 'validar-fluxo'.`);
  return ok;
}

export async function cmdStatus() {
  const prefs = prefsMod.load();
  const names = ((await installedLocalModels()) || []).map((m) => m.name);
  title("Status");
  console.log(`Pasta local: ${localDir()}`);
  console.log(`Preferências: ${prefsMod.PREFS_FILE()}`);
  console.log(`Diagnóstico: ${diagnostico.DIAG_FILE()}`);
  console.log(`Perfil de uso: ${JSON.stringify(prefs.perfil_uso)}`);
  console.log(`Modo: ${prefs.modo || "ainda não escolhido (rode 'modo'; recomendado: nuvem)"}${prefs.modo && prefs.modo !== "local" ? ` — nuvem: ${(prefs.nuvem?.provedores || []).join(", ")}; modelo padrão em nuvem: ${prefs.nuvem?.modelo === nuvem.AUTO ? `automático (último: ${prefs.nuvem?.ultimo_auto || "ainda não usado"})` : prefs.nuvem?.modelo || "escolher em /models"}` : ""}`);
  if (!prefs.modelo) console.log("Modelo escolhido: nenhum");
  else {
    console.log(`Modelo escolhido: ${prefs.modelo.efetivo} (base ${prefs.modelo.base}, contexto ${prefs.modelo.contexto_tokens})`);
    console.log(`Situação: ${prefsMod.modelStage(prefs, names)}`);
    const v = prefs.validacoes[prefs.modelo.efetivo] || {};
    if (v.tecnica) console.log(`Verificação técnica: ${v.tecnica.ok ? "ok" : "falhou"} em ${v.tecnica.data}${v.tecnica.medida ? ` — ${JSON.stringify(v.tecnica.medida)}` : ""}`);
    if (v.fluxo) console.log(`Validação do fluxo: ${v.fluxo.ok ? "ok" : "falhou"} em ${v.fluxo.data}`);
  }
  if (!names.length) console.log("(Ollama indisponível ou sem modelos locais)");
}

async function menu() {
  const items = [
    ["Escolher modo (nuvem gratuita recomendada, misto ou local)", cmdModo],
    ["Diagnosticar este computador", () => diagnostico.run()],
    ["Diagnóstico com preenchimento manual", () => diagnostico.run({ manual: true })],
    ["Ver modelos e recomendação", cmdModelos],
    ["Escolher modelo local (download com confirmação)", cmdSelecionar],
    ["Verificar o modo atual", () => cmdVerificar([])],
    ["Validar fluxo de programação (roteiro)", cmdValidarFluxo],
    ["Iniciar OpenCode na pasta atual", () => cmdIniciar([])],
    ["Status e caminhos", cmdStatus],
    ["Configuração global (Desktop e web)", () => configGlobal.run(["mostrar"])],
    ["Sair", null],
  ];
  while (true) {
    title("ia-local — OpenCode + Ollama");
    const i = await choose("Opção", items.map((x) => x[0]));
    const fn = items[i][1];
    if (!fn) return;
    try {
      await fn();
      if (items[i][0].startsWith("Iniciar")) return;
    } catch (err) {
      report(err);
    }
  }
}

function report(err) {
  if (err instanceof UserError) {
    console.error(`\nERRO: ${err.message}`);
    if (err.recovery) console.error(`Como resolver: ${err.recovery}`);
  } else {
    console.error(`\nERRO inesperado: ${err.stack || err.message}`);
    console.error("Se persistir, registre a mensagem acima e veja docs/problemas.md.");
  }
}

export async function main(argv) {
  const [cmd, ...rest] = argv;
  const table = {
    diagnostico: () => diagnostico.run({ manual: rest.includes("--manual") }),
    modo: cmdModo,
    modelos: cmdModelos,
    selecionar: cmdSelecionar,
    verificar: () => cmdVerificar(rest),
    "validar-fluxo": cmdValidarFluxo,
    iniciar: () => cmdIniciar(rest),
    status: cmdStatus,
    "config-global": () => configGlobal.run(rest),
    desktop: () => desktop.run(rest),
    atualizar: () => atualizarRepo.run(),
    ajuda: async () => console.log(AJUDA),
    "--help": async () => console.log(AJUDA),
    "-h": async () => console.log(AJUDA),
  };
  try {
    if (!cmd) await menu();
    else if (table[cmd]) await table[cmd]();
    else {
      console.error(`Comando desconhecido: ${cmd}`);
      console.log(AJUDA);
      process.exitCode = 2;
    }
  } catch (err) {
    report(err);
    process.exitCode = 1;
  } finally {
    closeInput();
  }
}
