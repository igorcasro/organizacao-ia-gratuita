// Detecção e inicialização do OpenCode.
// Versão de referência: OpenCode 2 (pacote npm @opencode/cli). Ver docs/validacao.md.
import fs from "node:fs";
import path from "node:path";
import { runCapture, runInteractive, commandExists, localPath, ensureDir, mergeEnv, REPO_DIR, UserError } from "./util.mjs";

export function detect() {
  if (!commandExists("opencode")) return { instalado: false, versao: null, major: null };
  const r = runCapture("opencode", ["--version"], { timeoutMs: 15000 });
  const fields = `${r.stdout}`.trim().split(/\s+/);
  const versao = (fields[fields.length - 1] || "").replace(/^v/, "") || null;
  const major = versao && /^\d+\./.test(versao) ? Number(versao.split(".")[0]) : null;
  return { instalado: true, versao, major };
}

// Instruções de segurança entregues ao modelo em toda sessão iniciada pelo script (campo "instructions").
export const SECURITY_INSTRUCTIONS = path.join(REPO_DIR, "configs", "instrucoes-seguranca.md");

// Permissões de proteção (docs/seguranca.md). A última regra que corresponde vence e estas entram depois
// dos padrões do OpenCode, então prevalecem sobre eles. Não são aplicadas a configurações de projeto mais fortes.
const SEGREDOS = ["*.env", "*.env.*", "*.pem", "*.key", "*.p12", "*.pfx", "*.kdbx", "*id_rsa*", "*id_ed25519*", "*/.ssh/*", "*/.aws/*", "*/.azure/*", "*/.gnupg/*", "*/.git-credentials", "*/.npmrc", "*/.pypirc", "*/.docker/config.json", "*/.kube/config"];
// Comandos de rede que pedem aprovação. Cada um vale também com ".exe" e com caminho completo:
// em 2026-11-08, no Windows, o modelo usou "curl.exe ..." e escapou de "curl *" (docs/validacao.md).
// No Windows a comparação ignora maiúsculas (packages/core/src/util/wildcard.ts, v2.2.6).
// É uma lista de melhor esforço: comandos indiretos (node -e, python -c, git -C <pasta> push) não são pegos.
const PROGRAMAS_REDE = ["curl", "wget", "scp", "sftp", "ssh", "rsync", "nc", "ncat", "telnet", "ftp", "Invoke-WebRequest", "Invoke-RestMethod", "iwr", "irm", "Start-BitsTransfer", "git push", "git remote", "npm publish", "gh"];
export function redePatterns(programas = PROGRAMAS_REDE) {
  const out = [];
  for (const p of programas) {
    const [cmd, ...resto] = p.split(" ");
    const sufixo = resto.length ? ` ${resto.join(" ")} *` : " *";
    const cmdlet = cmd.includes("-"); // cmdlets do PowerShell não têm .exe nem caminho
    const nomes = cmdlet ? [cmd] : [cmd, `${cmd}.exe`];
    for (const n of nomes) {
      out.push(`${n}${sufixo}`);
      if (!cmdlet) out.push(`*/${n}${sufixo}`);
    }
  }
  return out;
}
const REDE = redePatterns();

// Comandos que citam arquivos de segredos pedem aprovação. A regra "read" acima só vale para a ferramenta de
// leitura do OpenCode; um comando como "Get-Content .env" ou "cat .env" passava livre (2026-11-08).
// Melhor esforço: o texto do comando é comparado inteiro; formas indiretas (curingas, código montando o nome)
// não são pegas, e há falsos positivos (ex.: "process.env" também pede aprovação).
const SEGREDOS_SHELL = ["*.env*", "*.pem*", "*.key*", "*.p12*", "*.pfx*", "*.kdbx*", "*id_rsa*", "*id_ed25519*", "*.ssh*", "*.aws*", "*.azure*", "*.gnupg*", "*.git-credentials*", "*.npmrc*", "*.pypirc*", "*.docker*config.json*", "*.kube*config*"];

export function securityPermissions() {
  return [
    { action: "webfetch", resource: "*", effect: "ask" },
    { action: "external_directory", resource: "*", effect: "ask" },
    ...SEGREDOS.map((r) => ({ action: "read", resource: r, effect: "deny" })),
    ...SEGREDOS.map((r) => ({ action: "edit", resource: r, effect: "deny" })),
    { action: "read", resource: "*.env.example", effect: "allow" },
    ...REDE.map((r) => ({ action: "shell", resource: r, effect: "ask" })),
    ...SEGREDOS_SHELL.map((r) => ({ action: "shell", resource: r, effect: "ask" })),
  ];
}

// Políticas no formato nativo do OpenCode 2: nega todos os provedores e libera só os escolhidos.
// A última regra que corresponde vence (docs de policies do OpenCode). Busca na web sempre negada.
export function policyConfig(providers = ["ollama"], { model } = {}) {
  const config = {
    $schema: "https://opencode.ai/config.json",
    policies: [
      { action: "provider.use", resource: "*", effect: "deny" },
      ...providers.map((p) => ({ action: "provider.use", resource: p, effect: "allow" })),
      { action: "websearch.use", resource: "*", effect: "deny" },
    ],
    permissions: securityPermissions(),
    instructions: [SECURITY_INSTRUCTIONS],
  };
  if (model) config.model = model;
  return config;
}

// Mantido para compatibilidade: configuração somente local.
export function localOnlyConfig() {
  return policyConfig(["ollama"]);
}

export function writePolicyFile(config) {
  const file = path.join(ensureDir(localPath()), "opencode-politicas.json");
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf8");
  return file;
}

export function requireV2() {
  const oc = detect();
  if (!oc.instalado) {
    throw new UserError(
      "O OpenCode não foi encontrado no PATH.",
      "Instale a versão de referência seguindo o manual do seu sistema (docs/windows-11.md ou docs/ubuntu-24.04.md). " +
        "Não use 'ollama launch opencode' sem o OpenCode instalado: nessa situação o Ollama instala o OpenCode 1 automaticamente."
    );
  }
  if (oc.major !== 2) {
    throw new UserError(
      `OpenCode ${oc.versao ?? "de versão desconhecida"} encontrado; este repositório usa o OpenCode 2.`,
      "Veja docs/problemas.md, seção 'OpenCode 1 instalado'."
    );
  }
  return oc;
}

// Variáveis aplicadas ao processo do OpenCode.
// OPENCODE_API_KEY é removida para que o provedor "opencode" ofereça só os modelos gratuitos (sem conta,
// o OpenCode 2 desabilita os modelos com preço).
// Também reduz o tráfego que não é de modelo (docs/seguranca.md):
// - OPENCODE_DISABLE_AUTOUPDATE: sem consulta de atualização (mantém a versão de referência);
// - OPENCODE_DISABLE_CLAUDE_CODE: não carrega skills de ~/.claude, que poderiam ir para o prompt;
// - no modo local, OPENCODE_DISABLE_MODELS_FETCH: usa o catálogo embutido em vez de baixar de models.opencode.ai;
// - projeto não confiável: OPENCODE_DISABLE_PROJECT_CONFIG ignora opencode.json, .opencode/ e AGENTS.md do projeto.
export function launchEnv(providers, policyFile, { naoConfiavel = false } = {}) {
  const env = { OPENCODE_CONFIG: policyFile, OPENCODE_API_KEY: null, OPENCODE_DISABLE_AUTOUPDATE: "1", OPENCODE_DISABLE_CLAUDE_CODE: "1" };
  if (!providers.includes("opencode")) env.OPENCODE_DISABLE_FREE_MODELS = "1";
  if (providers.length === 1 && providers[0] === "ollama") env.OPENCODE_DISABLE_MODELS_FETCH = "1";
  if (naoConfiavel) env.OPENCODE_DISABLE_PROJECT_CONFIG = "1";
  return env;
}

// Modos local e misto: integração oficial 'ollama launch opencode --model <modelo>'.
// O modelo padrão é o local; no misto, os modelos em nuvem liberados aparecem em /models para escolha manual.
export async function launchViaOllama(model, dir, providers = ["ollama"], opts = {}) {
  const policyFile = writePolicyFile(policyConfig(providers));
  return runInteractive("ollama", ["launch", "opencode", "--model", model], { cwd: dir, env: launchEnv(providers, policyFile, opts) });
}

// Modos nuvem e misto: OpenCode direto, com servidor privado (--standalone) para que as variáveis valham nesta sessão.
// No misto, o OpenCode 2 descobre sozinho os modelos do Ollama local; aqui só se informa o contexto real
// do modelo derivado (num_ctx), para o OpenCode não presumir a janela máxima do modelo base.
export async function launchCloud(dir, providers, model, local = null, opts = {}) {
  const config = policyConfig(providers, { model });
  if (local && providers.includes("ollama")) {
    config.providers = { ollama: { models: { [local.efetivo]: { limit: { context: local.contexto_tokens, output: Math.min(8192, Math.floor(local.contexto_tokens / 4)) } } } } };
  }
  const policyFile = writePolicyFile(config);
  return runInteractive("opencode", ["--standalone"], { cwd: dir, env: launchEnv(providers, policyFile, opts) });
}

// Modo alternativo (diagnóstico) do local: chama o OpenCode sem o 'ollama launch'.
export async function launchDirect(model, dir, contextTokens, providers = ["ollama"], opts = {}) {
  const config = {
    ...policyConfig(providers),
    model: `ollama/${model}`,
    providers: { ollama: { models: { [model]: { limit: { context: contextTokens, output: Math.min(8192, Math.floor(contextTokens / 4)) } } } } },
  };
  return runInteractive("opencode", ["--standalone"], {
    cwd: dir,
    env: { ...launchEnv(providers, writePolicyFile(policyConfig(providers)), opts), OPENCODE_CONFIG_CONTENT: JSON.stringify(config) },
  });
}

// Lista os modelos que o OpenCode oferece com as políticas aplicadas (não envia nenhum pedido a modelos).
export function listModels(providers, model) {
  const policyFile = writePolicyFile(policyConfig(providers, { model }));
  const merged = mergeEnv(launchEnv(providers, policyFile));
  return runCapture("opencode", ["models", "--standalone"], { timeoutMs: 60000, env: merged });
}

// Teste curto em modo não interativo. Envia uma frase ao modelo em nuvem (exige consentimento).
export function smokeTest(providers, model, dir) {
  const policyFile = writePolicyFile(policyConfig(providers, { model }));
  const merged = mergeEnv(launchEnv(providers, policyFile));
  return runCapture("opencode", ["run", "--standalone", "--model", model, "Responda somente com a palavra OK."], { timeoutMs: 180000, env: merged, cwd: dir });
}
