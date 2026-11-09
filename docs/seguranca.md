# Segurança e privacidade: o que sai do seu computador

Análise feita em 2026-11-07 no **código-fonte do OpenCode 2.2.6** e do **Ollama 0.40.15**, e nas documentações oficiais. Os pontos marcados **pendente** ainda não foram observados com os programas rodando de verdade.

## Resposta curta

- **Não encontrei telemetria ativa por padrão no OpenCode 2.2.6.** O único exportador de telemetria (OpenTelemetry) só liga se a variável `OTEL_EXPORTER_OTLP_ENDPOINT` estiver definida. O compartilhamento de sessões foi removido no V2 (o código diz "session sharing was removed").
- **O grande fluxo de dados é o pedido ao modelo.** No modo **local**, ele vai para o Ollama no próprio computador. Nos modos **nuvem** e **misto**, vai para o provedor do modelo: tudo o que o agente ler (arquivos, saídas de comandos) mais o contexto da sessão. Alguns modelos gratuitos **podem usar esses dados para treino** (ver [nuvem-gratuita.md](nuvem-gratuita.md)).
- **Há pouco tráfego além dos pedidos ao modelo:** a consulta de atualização e o download do catálogo de modelos. Elas revelam o seu IP e a versão do OpenCode, não o seu código. O script desativa a consulta de atualização sempre e o catálogo no modo local.
- **O maior risco prático não é ser "vigiado", e sim o agente vazar dados por engano** ou porque foi induzido por um texto malicioso num arquivo ou página (*prompt injection*). Por isso o script aplica permissões que pedem aprovação para acessar a rede e bloqueiam a leitura de arquivos de segredos.

## Inventário: o que o OpenCode 2.2.6 envia, e para onde

| Tráfego | Destino | O que vai | Quando | O que o script faz |
|---|---|---|---|---|
| **Pedido ao modelo** | Local: `127.0.0.1:11434` (Ollama). Nuvem: `opencode.ai/inference/...` ou `openrouter.ai` | Instruções do sistema, seus pedidos, conteúdo dos arquivos lidos, saídas de comandos, resultados de buscas de URL. Também: **data, caminho absoluto da pasta do projeto (que costuma conter o seu nome de usuário), sistema operacional**, o conteúdo dos `AGENTS.md` (global e do projeto) e as instruções configuradas | A cada passo do agente | Libera só os provedores do modo escolhido; recusa provedores pagos |
| Catálogo de modelos | `https://models.opencode.ai` (GET) | Endereço IP e identificação do programa (*User-Agent*) | Ao iniciar e periodicamente | **Desligado no modo local** (`OPENCODE_DISABLE_MODELS_FETCH=1`, usa o catálogo embutido). Mantido nos modos nuvem e misto, porque a lista de modelos gratuitos muda |
| Consulta de atualização | `https://opencode.ai/update/api/...?current=<versão>` | IP e versão instalada | Periodicamente | **Desligada** (`OPENCODE_DISABLE_AUTOUPDATE=1`), o que também mantém a versão de referência |
| Configuração da conta (Console) | `opencode.ai` | Dados da conta e da organização | **Só com uma conta do OpenCode conectada** (`/connect`) | Nenhuma conta é necessária. Não conecte uma |
| Telemetria OpenTelemetry | O endereço que você definir | Logs | **Só se `OTEL_EXPORTER_OTLP_ENDPOINT` estiver definida** | Não define |
| Download do `ripgrep` | `github.com/BurntSushi/ripgrep/releases` | Nada do projeto | Uma vez, se o `ripgrep` não estiver disponível | — |
| **Ferramentas acionadas pelo modelo** | Qualquer URL | O que o modelo colocar no pedido | Quando o agente usa `webfetch`, o `fetch` do Code Mode ou comandos de rede no terminal | **Pedem aprovação** (permissões abaixo). Busca na web **bloqueada** |
| Servidores MCP, plugins, instruções por URL | Terceiros | Depende do componente | Só se você configurar | Nenhum é configurado; veja "Nunca faça" |

Fontes no código: `packages/util/src/observability/otlp.ts` (telemetria só com endereço), `packages/core/src/models-dev.ts` (catálogo em `models.opencode.ai`), `packages/cli/src/services/updater.ts` (atualização e `OPENCODE_DISABLE_AUTOUPDATE`), `packages/core/src/plugin/provider/opencode.ts` (Console só com conexão), `packages/tui/src/config/keybind.ts` (compartilhamento removido), `packages/core/src/instructions/builtins.ts` (data, diretório e plataforma no prompt), `packages/core/src/codemode/fetch.ts` (o `fetch` do Code Mode usa a mesma permissão do `webfetch`), `packages/core/src/ripgrep/binary.ts`.

### Dados guardados no seu computador
O OpenCode grava as sessões completas (pedidos, respostas, trechos de arquivos e saídas de comandos) num banco SQLite local. Não são enviados a lugar nenhum, mas ficam no disco; o caminho é mostrado por `opencode debug paths db`. Se um segredo aparecer numa conversa, ele fica gravado ali. Apague a sessão com `opencode session delete <id>` (as sessões são listadas por `opencode session list`).

### Ollama
- Escuta só em `127.0.0.1:11434` (padrão). Não altere para `0.0.0.0`.
- Os recursos de nuvem do Ollama (modelos `:cloud`, que são pagos) podem ser desligados com `OLLAMA_NO_CLOUD=1` (manuais, Parte B).
- O `ollama pull` baixa modelos de `registry.ollama.ai`.
- **Pendente:** quais consultas o aplicativo do Ollama para Windows faz sozinho (por exemplo, verificação de atualização). Não foi verificado no código.

### Os scripts deste repositório
Conversam com o Ollama local (`127.0.0.1:11434`) e executam comandos do `ollama`, do `opencode` e do `git`. O que sai para a internet:
- o pedido de teste opcional de `verificar` no modo nuvem, só se você confirmar;
- `atualizar` / `/atualizar-ia`: `git fetch` e `git pull` no GitHub, só quando você pede;
- **quando aparece um modelo gratuito novo** (fora do catálogo), no máximo **uma vez por dia**: um download da página de privacidade da documentação oficial do OpenCode (`raw.githubusercontent.com/anomalyco/opencode/.../console/models.mdx`). É um pedido de leitura comum; nada do seu projeto é enviado.

Para conferir: procure `fetch(` e endereços `https://` em `scripts/lib/`.

## Proteções aplicadas automaticamente pelo script

Toda sessão iniciada por `node scripts/ia-local.mjs iniciar` recebe, sem alterar os seus arquivos:

| Proteção | Como |
|---|---|
| Só os provedores do modo escolhido; nenhum pago; busca na web bloqueada | `policies` (`provider.use`, `websearch.use`) |
| Modelos pagos do OpenCode escondidos | `OPENCODE_API_KEY` removida do ambiente (sem conta, o OpenCode habilita só os gratuitos) |
| Buscar URLs (`webfetch` e o `fetch` do Code Mode) **pede aprovação** | `permissions`: `webfetch` → `ask` |
| Comandos que enviam dados para fora **pedem aprovação**: `curl`, `wget`, `scp`, `ssh`, `rsync`, `nc`, `Invoke-WebRequest`, `Invoke-RestMethod`, `iwr`, `irm`, `git push`, `git remote`, `npm publish`, `gh` — também com `.exe` e caminho completo (`curl.exe`, `C:\...\curl.exe`). **Lista de melhor esforço:** comandos indiretos (`node -e`, `python -c`, `git -C <pasta> push`) não são pegos. Em 2026-11-08 o modelo usou `curl.exe` e escapou da regra antiga; corrigido | `permissions`: `shell` → `ask` |
| Os demais comandos (`npm test`, `git diff`, `ls` e também os que apagam arquivos) **rodam sem pedir aprovação**. Decisão do mantenedor em 2026-11-07, após a validação no Windows: manter o fluxo ágil e contar com o git para revisar e reverter. Por isso, trabalhe sempre com o projeto versionado e revise com `git diff` | padrão do OpenCode (sem regra própria) |
| Acesso a pastas fora do projeto **pede aprovação** | `permissions`: `external_directory` → `ask` |
| **Leitura e edição bloqueadas** em `.env*` (exceto `.env.example`), `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.kdbx`, `id_rsa`, `id_ed25519`, `.ssh/`, `.aws/`, `.azure/`, `.gnupg/`, `.git-credentials`, `.npmrc`, `.pypirc`, `.docker/config.json`, `.kube/config` | `permissions`: `read`/`edit` → `deny` |
| **Comandos que citam esses arquivos** (`Get-Content .env`, `cat .env`, `type ...\.ssh\id_ed25519`) **pedem aprovação**. Sem isso, um comando lia o segredo e escapava do bloqueio acima, que só vale para a ferramenta de leitura. Melhor esforço: compara o texto do comando; curingas ou nomes montados por código não são pegos; `process.env` também pede aprovação (falso positivo aceito) | `permissions`: `shell` → `ask` |
| Regras de segurança entregues ao modelo em toda sessão | `instructions`: [`configs/instrucoes-seguranca.md`](../configs/instrucoes-seguranca.md) |
| Skills do Claude Code (`~/.claude/skills`) não são carregadas no prompt | `OPENCODE_DISABLE_CLAUDE_CODE=1` |
| Sem consulta de atualização | `OPENCODE_DISABLE_AUTOUPDATE=1` |
| Modo local: sem download do catálogo | `OPENCODE_DISABLE_MODELS_FETCH=1` |
| **Repositório de terceiros**: `iniciar --nao-confiavel` ignora `opencode.json`, `.opencode/` (agentes, comandos, plugins) e `AGENTS.md` do projeto | `OPENCODE_DISABLE_PROJECT_CONFIG=1` |

O arquivo gerado fica em `<pasta local>/opencode-politicas.json`, e `opencode debug config` mostra a configuração final que o OpenCode está usando.

**Limites destas proteções:**
- As permissões do script entram como configuração explícita (`OPENCODE_CONFIG`). Um `opencode.json` **do projeto** tem precedência maior e pode afrouxá-las; por isso existe `--nao-confiavel`.
- As regras de terminal identificam comandos pelo nome. Um comando disfarçado (um script `.py` que faz a requisição, por exemplo) não é reconhecido. **Leia o que o agente pede para executar.**
- Instruções ao modelo **não são uma barreira de segurança**: um modelo pode ignorá-las ou ser enganado. Quem bloqueia de fato são as permissões e as políticas.
- **Pendente:** confirmar com o OpenCode real que as permissões do script prevalecem sobre os padrões do agente `build` (a documentação diz que regras posteriores vencem; ver `docs/permissions` e `docs/agents`).

## Nunca faça

Valem para pessoas e para qualquer assistente de IA que use ou mantenha este repositório.

**Contas, chaves e custos**
1. Nunca conecte uma conta paga nem cadastre cartão ou créditos (OpenCode Console, OpenRouter, Ollama). Com saldo, um modelo pago escolhido por engano gera cobrança.
2. Nunca coloque chaves de API, senhas ou tokens em arquivos do repositório, em `opencode.json`, em `AGENTS.md` ou na conversa com o modelo. Use variáveis de ambiente do seu usuário.
3. Nunca use os modelos `:cloud` do Ollama (são pagos).

**Código e dados**
4. Nunca use os modos **nuvem** ou **misto** com código confidencial, de clientes ou de empregador sem autorização expressa. Nesses casos, use o modo **local**.
5. Nunca cole na conversa dados pessoais, senhas, chaves, *dumps* de banco de dados ou arquivos `.env`.
6. Nunca escolha modelos marcados como "pode treinar" ou "uso registrado" para código que não seja público.
7. Nunca desative as proteções (`policies`, `permissions`) para "o agente funcionar melhor". Se uma permissão atrapalhar, aprove o pedido pontual.

**Rede e exposição**
8. Nunca exponha o Ollama ou o OpenCode à rede: nada de `OLLAMA_HOST=0.0.0.0`, `opencode serve --hostname 0.0.0.0`, `opencode service set hostname 0.0.0.0`, túneis (ngrok, Cloudflare) ou `opencode pair` em redes que você não controla.
9. Nunca defina `OTEL_EXPORTER_OTLP_ENDPOINT` nem configure instruções por URL (`"instructions": ["https://..."]`).

**Componentes de terceiros**
10. Nunca instale plugins do OpenCode, servidores MCP, skills ou extensões de origem desconhecida. Plugins executam código no seu computador com as suas permissões.
11. Nunca abra um repositório de terceiros sem `iniciar --nao-confiavel`, nem antes de olhar se ele tem `opencode.json`, `.opencode/` ou `AGENTS.md` com instruções estranhas.
12. Nunca aprove automaticamente comandos do agente (`--auto`, `--dangerously-skip-permissions`) fora do projeto descartável de validação.

**Comandos**
13. Nunca aprove um comando que você não entende, principalmente se envolver rede (`curl`, `Invoke-WebRequest`), `git push`, apagar arquivos, `sudo` ou administrador.
14. Nunca rode o OpenCode como administrador ou com `sudo`.

## Instruções aos modelos nos seus próprios projetos

O script já entrega [`configs/instrucoes-seguranca.md`](../configs/instrucoes-seguranca.md) ao modelo em toda sessão. Se você também usar o OpenCode **sem** o script, inclua as mesmas regras de uma destas formas:

- **Para todos os projetos:** copie o conteúdo para o `AGENTS.md` global do OpenCode, na pasta de configuração mostrada por `opencode debug paths config`. Faça uma cópia antes se o arquivo já existir.
- **Para um projeto:** acrescente o conteúdo ao `AGENTS.md` da raiz do projeto.

## Como conferir você mesmo

Enquanto o OpenCode está aberto, liste as conexões de rede dele:

| Windows (PowerShell) | Ubuntu (Bash) |
|---|---|
| `Get-NetTCPConnection -State Established \| Where-Object { (Get-Process -Id $_.OwningProcess).ProcessName -like "opencode*" } \| Select-Object RemoteAddress, RemotePort` | `ss -tnp \| grep -i opencode` |

- **No modo local**, o esperado é ver só conexões com `127.0.0.1`.
- **No modo nuvem**, o esperado é ver os endereços do provedor (resolva com `nslookup <endereço>`).

**Pendente de validação:** este roteiro e o resultado esperado ainda não foram executados.

## Pendências desta análise

- Observar o tráfego real nos três modos (roteiro acima) e confirmar que só aparecem os destinos da tabela.
- Confirmar a precedência das permissões do script sobre os padrões do agente `build`.
- Verificar as consultas automáticas do aplicativo do Ollama no Windows.
- Confirmar se uma conta do OpenCode conectada anteriormente faz o OpenCode buscar a configuração da conta mesmo sem `OPENCODE_API_KEY`.
- Rever esta análise a cada atualização do OpenCode ou do Ollama.
