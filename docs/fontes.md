# Fontes e datas de consulta

Todas consultadas em **2026-11-07**. Quando a fonte foi o repositório oficial, o caminho do arquivo e a tag ficam indicados, para quem quiser conferir a mesma versão.

## OpenCode (versão 2.2.6)

| Assunto | Fonte |
|---|---|
| Repositório e tags | https://github.com/anomalyco/opencode (tag `v2.2.6`; V1 mais recente: `v1.19.5`) |
| Instalação V2 (npm `@opencode/cli`, binários, Windows) | https://opencode.ai/docs/ — no repositório: `services/site/src/docs/content/index.mdx` |
| Configuração, locais e precedência | https://opencode.ai/docs/config — `services/site/src/docs/content/config.mdx` |
| Provedor Ollama (descoberta automática, `settings.baseURL`) | https://opencode.ai/docs/providers — `providers.mdx`; `models.mdx` (seção *Local*) |
| Políticas (`provider.use`, `websearch.use`, ordem) | `services/site/src/docs/content/policies.mdx` |
| Migração V1 → V2 (formatos, mesmo comando `opencode`) | https://opencode.ai/docs/migrate-v1 — `migrate-v1.mdx` |
| CLI: `--standalone`, `run`, `mini`, `uninstall`, `debug paths` | `services/site/src/docs/content/cli/index.mdx`, `cli/commands.mdx` |
| TUI: agentes (Shift+Tab, `/agents`), `/models`, anexar arquivo com `@`, nova linha (Shift/Ctrl/Alt+Enter, Ctrl+J) | `cli/tui.mdx`; agentes `build`/`plan`: `agents.mdx` |
| `/undo` e snapshots | `snapshots.mdx` |
| `AGENTS.md` (V2 não lê `CLAUDE.md`) | `instructions.mdx` |
| Solução de problemas (`opencode service ...`) | `troubleshooting.mdx` |
| Variáveis `OPENCODE_CONFIG`, `OPENCODE_CONFIG_CONTENT`, `OPENCODE_DISABLE_FREE_MODELS` | `packages/cli/src/server-process.ts`, `packages/core/src/config.ts`, `packages/core/src/model.ts` |
| Opções da linha de comando (a interface principal não tem `--model`) | `packages/cli/src/commands/commands.ts` |
| Shell usado no Windows (ordem: `pwsh`, `powershell`, Git Bash, `cmd`) | `packages/core/src/shell/select.ts` |
| Desktop, web (`opencode pair`) e ACP | `index.mdx` (seções *Desktop* e *Web*), `cli/web.mdx`, `cli/acp.mdx` |
| Serviço compartilhado em segundo plano | `cli/index.mdx` (*Background service*), `cli/commands.mdx` (`service`, `reload`); `packages/desktop/src/main/service/background-service.ts` e `desktop-cli.ts` |
| Pasta global de configuração (inclusive no Windows; `XDG_CONFIG_HOME` e `OPENCODE_CONFIG_DIR`) | `packages/util/src/global-roots.ts`, `packages/util/src/global.ts` |
| `opencode reload` (recarrega a configuração sem reiniciar o servidor) | `cli/commands.mdx` (*reload*) |
| Modelos gratuitos, privacidade e descontinuados (2026-11-08) | `console/models.mdx` no ramo principal (commit de 2026-11-08), seções *Free models*, *Deprecated models* e *Privacy* |
| Comparação de padrões de permissão (maiúsculas ignoradas no Windows) | `packages/core/src/util/wildcard.ts` |
| Modelo padrão (`model`) na configuração | `config.mdx` (*Schema*), `models.mdx` (*Defaults*) |
| Ordem de carga das configurações e precedência das políticas | `packages/core/src/config.ts`, `packages/core/src/config/plugin/policy.ts`; `policies.mdx` (*Precedence*) |
| Desktop lê só `opencode.json(c)` | `build/plugins/gui/index.mdx` |
| Privacidade por modelo (base da classificação automática; lida pelo script em `raw.githubusercontent.com/anomalyco/opencode/dev/services/site/src/docs/content/console/models.mdx`) | `console/models.mdx`, seção *Privacy* |
| Comandos personalizados (`commands` na configuração; bloco `` !`comando` `` roda antes do envio, fora do fluxo de permissões) | `commands.mdx` (*JSON*, *Shell*) |
| Recarga automática quando arquivos de configuração mudam; variáveis `{env:}` e `{file:}` na configuração | `plugins.mdx` (*Reload*), `config.mdx` (*Variables*) |
| Pasta do Desktop instalado por usuário no Windows (`%LOCALAPPDATA%\Programs\ai.opencode.desktop\OpenCode.exe`) | Observado no Windows 11 em 2026-11-08 (não documentado) |
| Documentação do V1 (para comparação; não usar nos manuais) | `packages/web/src/content/docs/index.mdx` |

## Ollama (versão 0.40.15)

| Assunto | Fonte |
|---|---|
| Repositório e tags | https://github.com/ollama/ollama (tag `v0.40.15`) |
| Integração com o OpenCode | https://docs.ollama.com/integrations/opencode — `docs/integrations/opencode.mdx` |
| Código do `ollama launch opencode` | `cmd/launch/opencode.go`, `cmd/launch/launch.go`, `cmd/launch/muse.go` |
| Anúncio do `ollama launch` (v0.15+) | https://registry.ollama.ai/blog/launch |
| Contexto | https://docs.ollama.com/context-length — `docs/context-length.mdx` |
| Windows | https://docs.ollama.com/windows — `docs/windows.mdx`; instalador `scripts/install.ps1` |
| Linux | https://docs.ollama.com/linux — `docs/linux.mdx` |
| FAQ (variáveis, rede, pasta de modelos, nuvem) | https://docs.ollama.com/faq — `docs/faq.mdx` |
| Modelfile (`PARAMETER num_ctx`) | `docs/modelfile.mdx`; `docs/api/openai-compatibility.mdx` (seção *Setting the local context size*) |
| API (`/api/version`, `/api/tags`, `/api/show`, `/api/ps`, `/api/generate`) | `docs/api.md`; `api/types.go`; `types/model/capability.go` |
| Suporte a GPUs (NVIDIA, AMD ROCm, Vulkan, integradas, `GGML_VK_VISIBLE_DEVICES`, `setcap`) | https://docs.ollama.com/gpu — `docs/gpu.mdx` |
| Detecção de AMD integrada × dedicada no Linux | `discover/amd.go` |
| Instalador Linux (ROCm automático, grupos `render`/`video`) | `scripts/install.sh` |

## Modelos

| Modelo | Fonte |
|---|---|
| `qwen3.5` (tags, tamanhos, contexto, capacidades) | https://registry.ollama.ai/library/qwen3.5 |
| `gpt-oss` (tags, tamanhos, licença Apache 2.0) | https://registry.ollama.ai/library/gpt-oss ; https://huggingface.co/openai/gpt-oss-20b |
| `qwen3-coder:30b` (Q4_K_M, 30,5B/3,3B ativos, Apache 2.0) | https://registry.ollama.ai/library/qwen3-coder:30b |
| Lista de modelos com ferramentas | https://ollama.com/search?c=tools |

`registry.ollama.ai` serve as mesmas páginas da biblioteca de `ollama.com/library`.

## Modelos gratuitos em nuvem

| Assunto | Fonte |
|---|---|
| Modelos gratuitos do OpenCode: lista, preços zero, privacidade e regiões | https://opencode.ai/docs/console/models — `services/site/src/docs/content/console/models.mdx` (v2.2.6) |
| `OPENCODE_DISABLE_FREE_MODELS`; sem conta, só modelos sem preço | https://opencode.ai/docs/models#free-models — `models.mdx`; `packages/core/src/plugin/provider/opencode.ts` |
| Provedor OpenRouter no OpenCode (`OPENROUTER_API_KEY`) | https://opencode.ai/docs/providers#gateways — `providers.mdx` |
| Limites do OpenRouter `:free` | https://openrouter.ai/docs/limits |
| Variante `:free` e roteador `openrouter/free` | https://openrouter.ai/docs/guides/routing/model-variants/free |
| Preços da nuvem do Ollama (sem plano gratuito) | https://ollama.com/pricing ; `docs/cloud.mdx` (v0.40.15) |

## Segurança (OpenCode 2.2.6)

| Assunto | Fonte |
|---|---|
| Permissões (`webfetch`, `shell`, `read`, `edit`, `external_directory`; a última regra vence) | `services/site/src/docs/content/permissions.mdx`; padrões dos agentes em `agents.mdx` e `packages/core/src/plugin/agent.ts` |
| Instruções configuradas (`instructions`) e ordem do prompt | `instructions.mdx` |
| Ambiente enviado no prompt (data, diretório, plataforma) | `packages/core/src/instructions/builtins.ts` |
| Telemetria OpenTelemetry só com endereço definido | `packages/util/src/observability/otlp.ts` |
| Catálogo `models.opencode.ai` e `OPENCODE_DISABLE_MODELS_FETCH` | `packages/core/src/models-dev.ts`; `packages/cli/src/server-process.ts` |
| Consulta de atualização e `OPENCODE_DISABLE_AUTOUPDATE` | `packages/cli/src/services/updater.ts` |
| `fetch` do Code Mode sob a permissão `webfetch` | `packages/core/src/codemode/fetch.ts`; `tools.mdx` |
| Compartilhamento de sessões removido | `packages/tui/src/config/keybind.ts` |
| Skills de `~/.claude` e `OPENCODE_DISABLE_CLAUDE_CODE` | `skills.mdx`; `packages/cli/src/server-process.ts` |
| `OPENCODE_DISABLE_PROJECT_CONFIG` | `instructions.mdx`; `packages/cli/src/server-process.ts` |
| Exposição do servidor (`--hostname 0.0.0.0`, `pair`) | `cli/web.mdx` |

## Node.js e nvm

| Assunto | Fonte |
|---|---|
| Versões do Node.js | https://github.com/nodejs/node (tags `v24.*`) ; https://nodejs.org |
| nvm 0.41.0 (comando de instalação, `nvm install 24`) | https://github.com/nvm-sh/nvm (README na tag `v0.41.0`) |
- 2026-11-09 — [Agentes do OpenCode 2](https://opencode.ai/docs/agents): configuração `agents`, permissões por agente e herança do modelo da sessão.
