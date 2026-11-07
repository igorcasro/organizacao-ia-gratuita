# Validação: versões, testes e pendências

Legenda:
- **Testado**: executado, com ambiente, versão e data.
- **Confirmado (doc/código)**: confirmado em documentação oficial ou no código-fonte da versão indicada, mas **não executado**.
- **Pendente**: ainda não confirmado nem executado.

## Versões de referência

| Componente | Versão | Como foi identificada | Data |
|---|---|---|---|
| OpenCode | 2.2.6 (`@opencode/cli`) | Última tag estável `v2.2.6` em github.com/anomalyco/opencode; `packages/cli/package.json` | 2026-11-07 |
| Ollama | 0.40.15 | Última tag estável `v0.40.15` em github.com/ollama/ollama | 2026-11-07 |
| Node.js | 24 LTS (24.22.2) | Última tag `v24.x` em github.com/nodejs/node | 2026-11-07 |
| nvm | 0.41.0 | Última tag em github.com/nvm-sh/nvm | 2026-11-07 |

**Compatibilidade OpenCode × Ollama:** o código de `ollama launch` na v0.40.15 (`cmd/launch/opencode.go`) detecta o OpenCode 1 ou 2 pela saída de `opencode --version` e, no 2, inicia com `--standalone` passando a configuração em `OPENCODE_CONFIG_CONTENT`. O OpenCode 2.2.6 lê essa variável (`packages/cli/src/server-process.ts`) e aceita o formato de configuração do V1 que o Ollama gera (`migrate-v1.mdx`). Situação: **confirmado (código), não executado**.

## O que foi testado

**Ambiente:** contêiner Linux Ubuntu 24.04.5 LTS x86_64, Node.js 22.23.4, 2 núcleos, 7,8 GB de RAM, sem GPU. **Data:** 2026-11-07.
**Ollama e OpenCode reais não estavam instalados.** Os testes usam um simulador da API do Ollama (`scripts/testes/simulador.mjs`) e executáveis falsos de `ollama` e `opencode`.

Comando: `node --test scripts/testes/ia-local.test.mjs` → **29 de 29 passaram** na última execução (19 antes dos modos de nuvem; 26 antes das proteções de segurança) (13 em 2026-11-07 na primeira entrega; 6 de GPU acrescentados no mesmo dia).
Os testes de GPU usam árvores `/sys` falsas, nomes de `lspci` e respostas simuladas do registro do Windows; **nenhuma GPU real foi testada**.

| Item | Situação |
|---|---|
| Validação do catálogo (campos obrigatórios, ids repetidos, recusa de modelos `cloud`) | Testado |
| Recomendação para 8, 16, 32 e 48 GB sem GPU; 12, 16 e 24 GB de VRAM; falta de disco; prioridades | Testado (regras; os números são estimativas) |
| Interpretação de `OLLAMA_HOST` (padrão, `0.0.0.0`, porta própria) | Testado |
| Diagnóstico automático (sistema, CPU, RAM, disco) gravado fora do repositório | Testado (Linux sem GPU) |
| Preenchimento manual sobrepondo o detectado | Testado |
| Mensagem de recuperação com Ollama indisponível | Testado |
| Seleção completa: perguntas → recomendação → confirmação → `ollama pull` → conferência de `tools` → `ollama create` com `num_ctx 65536` → preferência salva | Testado com simuladores |
| Recusa de download não altera preferências e não baixa nada | Testado com simuladores |
| Verificação técnica: leitura de `/api/ps`, contexto carregado, cópia `.bak` das preferências | Testado com simuladores |
| Início: `ollama launch opencode --model <modelo>` na pasta certa, com `OPENCODE_CONFIG` (políticas) e `OPENCODE_DISABLE_FREE_MODELS=1` | Testado com simuladores (argumentos e variáveis) |
| Recusa de iniciar com OpenCode 1 | Testado com simuladores |
| Projeto de validação: `npm test` com 3 testes passando e 1 ignorado | Testado (Node.js 22.23.4) |
| Menu: exibição e saída | Testado (entrada redirecionada) |
| Classificação por nome de GPUs AMD, Intel, integradas e virtuais (19 nomes de Windows e `lspci`) | Testado (dados simulados) |
| AMD no Linux: regra integrada × dedicada do Ollama (`mem_info_vram_vendor`/`board_info`, VRAM ≤ 4 GB com GTT ≥ 8 GB) | Testado (`/sys` simulado) |
| Linux: AMD dedicada + APU AMD + Intel integrada; conectores ignorados; VRAM da APU não contada | Testado (`/sys` simulado) |
| Windows: VRAM de 64 bits do registro em vez do limite de 4 GB do CIM; integrada e adaptador virtual | Testado (dados simulados) |
| Recomendação com GPU integrada (usa só a RAM, explica o Vulkan) | Testado |
| Avisos de falta de driver Vulkan e de grupos `render`/`video` | Testado (dados simulados) |

### Windows 11 real — Parte A, modo nuvem (em andamento)

**Ambiente:** Windows 11 Pro 64 bits, Node.js 22.15.1, Git 2.49.0, terminal **Git Bash** (o manual cobre o PowerShell; o Git Bash está sendo validado como alternativa). **Data:** 2026-11-07.

| Item | Situação |
|---|---|
| `winget search --id OpenJS.NodeJS.LTS -e` e `--id Git.Git -e` encontram os pacotes (o LTS oferecido era o Node.js 26.13.0; o manual ainda cita o 24 como referência — revisar) | Testado |
| Node.js 22 atende ao mínimo (≥ 20) para o OpenCode e os scripts | Testado |
| `npm install -g @opencode/cli@2.2.6` no Git Bash, sem administrador; `opencode --version` → `2.2.6` | Testado |
| `ajuda`, `modo` (nuvem, só `opencode`, `concordo`, modelo sugerido), `status` | Testado |
| `verificar`: OpenCode 2, consentimento, chaves, `opencode models` com 11 modelos, só o provedor `opencode`, `deepseek-v4.1-flash-free` disponível | Testado |
| `npm test` no Windows: 19 passaram e 2 falharam (os testes de `/sys` do Linux criam pastas com `:`, nome proibido no Windows). Esses 2 passam a ser pulados no Windows, como os 9 de CLI (executáveis falsos em `sh`). Resultado esperado no Windows: **19 passam, 11 pulados, 0 falhas**; no Linux, 30 de 30 | Corrigido; reteste pendente |
| `verificar` após a correção do `PWD`: pedido de teste respondido `OK`; verificado tecnicamente | Testado |
| `validar-fluxo` no modo nuvem com `deepseek-v4.1-flash-free`: inicialização, leitura, explicação, alteração, teste e reversão — **6 de 6** | Testado (avaliação da pessoa) |
| Comando `npm test` executado pelo agente **sem pedir aprovação**: está de acordo com as permissões geradas (só comandos de rede pedem). O roteiro dizia "após sua permissão"; texto corrigido | Testado |
| Antes de reverter (ação destrutiva), o agente pediu confirmação na conversa. Não se sabe se veio de uma permissão do OpenCode ou das instruções de segurança | Observado; origem pendente |
| Interface do OpenCode no Git Bash: a resposta rola dentro da área do OpenCode e não pôde ser lida por inteiro; o cursor de texto não aparece | Problema observado; terminal exato e comparação com o PowerShell/Windows Terminal pendentes |
| `verificar`: pedido de teste falhou no Git Bash com *"Failed to change directory to /c/Users/..."*: o OpenCode recebia a variável `PWD` no formato MSYS. Corrigido em `util.childEnv` (o `PWD` do processo filho passa a ser a pasta real, no formato do Windows) | Corrigido; reteste pendente |

## Confirmado em documentação ou código, não executado

| Item | Fonte |
|---|---|
| Instalação do Ollama no Windows sem administrador; `install.ps1` com `OLLAMA_VERSION` | docs/windows.mdx; scripts/install.ps1 (Ollama v0.40.15) |
| Instalação do Ollama no Linux com `OLLAMA_VERSION`; serviço systemd; desinstalação | docs/linux.mdx |
| Ollama escuta em `127.0.0.1:11434` por padrão | docs/faq.mdx |
| Contexto padrão de 4k com menos de 24 GB de VRAM; recomendação de ≥ 64000 para ferramentas de programação | docs/context-length.mdx; docs/integrations/opencode.mdx |
| `PARAMETER num_ctx` em modelo derivado para clientes da API OpenAI | docs/api/openai-compatibility.mdx |
| `/api/show` devolve `capabilities`; `/api/ps` devolve `context_length`, `size`, `size_vram` | docs/api.md; api/types.go |
| `OLLAMA_NO_CLOUD=1` desativa os recursos de nuvem | docs/faq.mdx |
| OpenCode 2 instalável por `npm install -g @opencode/cli`; binários nativos para Windows; gerenciadores de pacotes do Windows não suportados | services/site/src/docs/content/index.mdx (OpenCode v2.2.6) |
| OpenCode 2 descobre modelos do Ollama em `127.0.0.1:11434` com o provedor `ollama` | providers.mdx; models.mdx |
| Políticas `provider.use` e `websearch.use`; a última regra que corresponde vence | policies.mdx; config.mdx |
| `OPENCODE_CONFIG` (arquivo explícito) e `OPENCODE_DISABLE_FREE_MODELS` | packages/cli/src/server-process.ts; packages/core/src/model.ts |
| No Windows, o OpenCode 2 usa `pwsh`, `powershell`, Git Bash ou `cmd`, nessa ordem (Git Bash não é obrigatório) | packages/core/src/shell/select.ts |
| GPUs suportadas: NVIDIA (CUDA, compute 5.0+, driver 550+), AMD (ROCm v7 em placas listadas; Vulkan nas demais), Intel e integradas (Vulkan); Vulkan ativado por padrão | docs/gpu.mdx (Ollama v0.40.15) |
| Instalador Linux baixa o pacote ROCm quando o `lspci` mostra AMD e coloca o usuário `ollama` em `render` e `video` | scripts/install.sh (Ollama v0.40.15) |
| Regra do Ollama para AMD integrada × dedicada no Linux | discover/amd.go (Ollama v0.40.15) |
| `opencode uninstall` não remove sessões nem configurações | cli/index.mdx |
| `ollama launch opencode` instala o OpenCode **1** quando não encontra o comando | cmd/launch/opencode.go (Ollama v0.40.15) |

### Modos misto e nuvem gratuita (acrescentados em 2026-11-07)

| Item | Situação |
|---|---|
| Catálogo de nuvem: recusa o Ollama e modelos do OpenRouter que não sejam `:free` | Testado |
| Provedores liberados por modo (local, misto, nuvem) | Testado |
| `modo` sem digitar `concordo` não altera nada | Testado com simuladores |
| Modo nuvem: seleção, sugestão de modelo que não treina, verificação, início sem chamar o Ollama, `--standalone`, remoção de `OPENCODE_API_KEY` | Testado com simuladores |
| Modo misto: início na nuvem com a reserva local (contexto informado); Ollama fora do ar → começa na nuvem, sem a reserva | Testado com simuladores |
| Sem modo escolhido, `iniciar` orienta a escolher (recomendado: nuvem); `selecionar` define `local` se nenhum modo foi escolhido | Testado com simuladores |
| Sem consentimento, misto e nuvem não iniciam | Testado com simuladores |
| Sem conta, o OpenCode 2 habilita só os modelos gratuitos do provedor `opencode` (chave `public`) | Confirmado (código, v2.2.6) |
| Lista, privacidade e regiões dos modelos gratuitos | Confirmado (docs `console/models.mdx`, v2.2.6) |
| Ollama sem plano gratuito na nuvem | Confirmado (ollama.com/pricing, 2026-11-07) |
| Limites do OpenRouter `:free` (20/min, 50/dia sem créditos) | Confirmado (openrouter.ai/docs/limits, 2026-11-07) |

### Segurança (acrescentado em 2026-11-07)

| Item | Situação |
|---|---|
| Configuração gerada: `webfetch` e acesso fora do projeto pedem aprovação; leitura e edição de segredos negadas (`.env.example` liberado); comandos de rede pedem aprovação; instruções de segurança incluídas | Testado (conteúdo do arquivo gerado) |
| Variáveis por modo (`OPENCODE_DISABLE_AUTOUPDATE`, `OPENCODE_DISABLE_CLAUDE_CODE`, `OPENCODE_DISABLE_MODELS_FETCH` só no local, `OPENCODE_API_KEY` removida) e `--nao-confiavel` | Testado com simuladores |
| Telemetria só com `OTEL_EXPORTER_OTLP_ENDPOINT`; compartilhamento de sessões removido; Console só com conta conectada; catálogo em `models.opencode.ai`; consulta de atualização e variável para desligá-la | Confirmado (código, v2.2.6) |
| Efeito real das permissões e do tráfego de rede nos três modos | Pendente (roteiro em [seguranca.md](seguranca.md#como-conferir-você-mesmo)) |

## Pendente de validação

| Item | Como validar |
|---|---|
| **Windows 11**: todo o manual, inclusive a detecção de GPU pelo registro e o comportamento do PowerShell com `opencode.ps1` | Roteiro abaixo, num Windows 11 real |
| **Ubuntu 24.04 real**: instalação do Ollama e do OpenCode, GPU NVIDIA/AMD | Roteiro abaixo |
| Fluxo de programação com qualquer modelo do catálogo (leitura, edição, comando, teste) | `validar-fluxo` |
| Efeito real das políticas "somente local" no OpenCode 2 (provedores em nuvem ocultos ou bloqueados) | Após `iniciar`, rodar `/models` no OpenCode e conferir se só aparecem modelos `ollama/...` |
| Modo `iniciar --direto` (`OPENCODE_CONFIG_CONTENT` + `--standalone`, limite de contexto declarado) | Iniciar nos dois modos e comparar `/models` e o comportamento em conversa longa |
| Contexto reduzido de 32k | Repetir `validar-fluxo` com 32k |
| Modos misto e nuvem com o OpenCode e a internet reais: políticas, modelos gratuitos sem conta, formato de `opencode models`, efeito de uma conta já conectada | `modo` → `verificar` → `/models` dentro do OpenCode |
| Quais modelos gratuitos em nuvem funcionam como agente de programação | `validar-fluxo` no modo nuvem, um modelo por vez |
| Privacidade dos modelos `:free` do OpenRouter | Consultar as políticas de cada provedor no OpenRouter |
| **GPU AMD dedicada** com ROCm e com Vulkan (Windows e Ubuntu) | `diagnostico` + `verificar` numa placa RX 7000 (ROCm) e numa RX 6000 ou anterior (Vulkan) |
| **GPU integrada** Intel e AMD (Vulkan), inclusive notebook com integrada + dedicada | `diagnostico` + `verificar`; anotar % na GPU e tempo de carga |
| Detecção da VRAM de AMD/Intel pelo registro do Windows | Comparar `diagnostico` com o Gerenciador de Tarefas |
| Texto das linhas de log do Ollama que indicam CUDA/ROCm/Vulkan | Ler `server.log` / `journalctl` após carregar um modelo |
| `setcap cap_perfmon` sobrevive a atualizações do Ollama | `getcap "$(readlink -f "$(command -v ollama)")"` depois de atualizar |
| Download interrompido: se o `ollama pull` reaproveita as partes já baixadas | Interromper com Ctrl+C e repetir |
| Licença e quantização de `qwen3.5:4b` e `qwen3.5:9b` | `ollama show <tag> --license` e `ollama show <tag>` |
| Estimativas de memória do catálogo × medições reais | Comparar a saída de `verificar` com a coluna "memória estimada" de `modelos` |
| ARM64 (Windows ou Linux) | Fora do escopo inicial |

## Roteiro de validação num computador

Use-o em cada sistema (Windows 11 e Ubuntu 24.04) e em perfis de hardware diferentes.

1. Siga o manual do sistema até o passo de instalação do OpenCode. Anote as versões: `node --version`, `ollama --version`, `opencode --version`.
2. `node scripts/ia-local.mjs diagnostico` — os valores conferem com o Gerenciador de Tarefas / `free -h` / `nvidia-smi`?
3. `node scripts/ia-local.mjs modelos` — a recomendação faz sentido?
4. `node scripts/ia-local.mjs selecionar` — confirme que **perguntou antes de baixar**; ao fim, `ollama list` mostra o modelo base e o `ia-local-...:64k`.
5. Feche e reabra o terminal; `node scripts/ia-local.mjs status` — a preferência persistiu?
6. `node scripts/ia-local.mjs verificar` — anote memória, % na GPU, contexto carregado e tempo de carga (**medições**).
7. `node scripts/ia-local.mjs validar-fluxo` — siga os 6 itens no OpenCode:
   1. inicialização e conexão ao modelo local (`/models` mostra só `ollama/...`?);
   2. leitura de arquivo;
   3. explicação de código;
   4. alteração pequena e verificável (`git diff`);
   5. execução de teste (`npm test`);
   6. revisão e reversão (`git checkout -- .` ou `/undo`).
8. Tratamento de erros: com o Ollama fechado (Windows: Quit na bandeja; Ubuntu: `sudo systemctl stop ollama`), rode `verificar` e `iniciar` e confira as mensagens. Reabra o Ollama depois.
9. Registre o resultado abaixo, **sem dados pessoais** (nada de nome de usuário, caminhos particulares ou número de série).

### Registro de validações

| Data | Sistema | CPU / RAM / GPU (VRAM) | Ollama | OpenCode | Modelo | Contexto | Medição (memória, % GPU) | Fluxo (6 itens) | Observações |
|---|---|---|---|---|---|---|---|---|---|
| 2026-11-07 | Windows 11 Pro 64 bits, Git Bash | não se aplica (modo nuvem) | não instalado | 2.2.6 | `opencode/deepseek-v4.1-flash-free` (nuvem) | definido pelo provedor | não se aplica | 6 de 6 ok | Ver observações abaixo |
