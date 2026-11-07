# Problemas, atualização e recuperação

Comece sempre por:

```
node scripts/ia-local.mjs status
node scripts/ia-local.mjs diagnostico
```

Os scripts mostram `ERRO:` seguido de `Como resolver:`. As seções abaixo detalham cada caso.

## Ollama indisponível

**Sintoma:** "O Ollama não está disponível" ou "não respondeu em http://127.0.0.1:11434".

| Windows (PowerShell) | Ubuntu (Bash) |
|---|---|
| Abra **Ollama** pelo menu Iniciar (ícone na bandeja) | `systemctl status ollama --no-pager` |
| `Invoke-RestMethod http://127.0.0.1:11434/api/version` | `curl -s http://127.0.0.1:11434/api/version` |
| Log: `%LOCALAPPDATA%\Ollama\server.log` | Log: `journalctl -e -u ollama` |
| — | Iniciar: `sudo systemctl start ollama` (sudo: serviço do sistema) |

Se você definiu `OLLAMA_HOST` com outra porta, os scripts usam esse valor. **Não** use `0.0.0.0` só para resolver isso: esse valor expõe o Ollama à rede local.

## Download interrompido

**Sintoma:** "O download de <modelo> não terminou".

1. Confira a conexão e o espaço livre (`diagnostico`).
2. Rode `selecionar` de novo e escolha o mesmo modelo. O download recomeça pelo `ollama pull`. **Pendente de validação nesta versão:** se o Ollama reaproveita as partes já baixadas.
3. Para descartar uma tentativa incompleta: se o modelo aparecer em `ollama list`, remova com `ollama rm <tag>`. Partes soltas ficam na pasta `blobs` dentro da pasta de modelos; o Ollama limpa arquivos não referenciados quando o serviço reinicia (comportamento a confirmar).

## Falta de espaço

**Sintoma:** "Espaço em disco insuficiente" ou o download falha perto do fim.

- Remova modelos que não usa: `ollama list` e `ollama rm <nome>`.
- Ou mude a pasta de modelos para um disco com mais espaço, **antes** de baixar:
  - **Windows:** saia do Ollama; crie a variável de usuário `OLLAMA_MODELS` (PowerShell: `[Environment]::SetEnvironmentVariable("OLLAMA_MODELS", "D:\ollama-modelos", "User")`); abra o Ollama de novo.
  - **Ubuntu:** `sudo systemctl edit ollama` e acrescente `Environment="OLLAMA_MODELS=/caminho/novo"` em `[Service]`; dê acesso ao usuário do serviço: `sudo chown -R ollama:ollama /caminho/novo`; depois `sudo systemctl daemon-reload && sudo systemctl restart ollama` (sudo: altera o serviço e as permissões).
- Rode `diagnostico` de novo para atualizar o espaço livre.

## Modelo ausente

**Sintoma:** "O modelo 'ia-local-...' não está no Ollama".

O modelo derivado (ou o base) foi removido, ou a pasta de modelos mudou. Rode `selecionar` e escolha o mesmo modelo: o script baixa o base, com confirmação, e recria o derivado.

## Modelo sem suporte a ferramentas

**Sintoma:** "O modelo não declara suporte a ferramentas ('tools')".

Sem ferramentas, o OpenCode não consegue ler nem editar arquivos nem executar comandos. Escolha outro modelo do catálogo. Se insistir, `verificar` marcará falha e o fluxo provavelmente não funcionará.

## Contexto carregado menor que o pedido ou falta de memória

**Sintoma:** em `verificar`, "Contexto carregado" abaixo de 65536, erro ao carregar ou computador travando.

- Escolha um modelo menor em `selecionar`.
- Feche programas pesados e tente de novo.
- Se nenhum couber, aceite o contexto reduzido de 32k oferecido pela seleção (abaixo do recomendado).

## GPU não usada

**Sintoma:** `verificar` mostra 0% na GPU, ou `ollama ps` mostra `100% CPU`, mesmo com GPU.

Primeiro rode `node scripts/ia-local.mjs diagnostico`: ele mostra a aceleração esperada para cada GPU e avisos específicos.

| Caso | O que fazer |
|---|---|
| NVIDIA sem `nvidia-smi` | Instale o driver proprietário (Windows: nvidia.com ou Windows Update; Ubuntu: **Programas e Atualizações → Drivers adicionais**) e reinicie |
| AMD no Windows | Atualize o driver AMD Adrenalin. RX 7000/PRO W7000 usam ROCm; as demais, Vulkan |
| AMD no Ubuntu | Confira `vulkaninfo --summary` e `id -nG ollama` (precisa de `render` e `video`). Se faltar o grupo: `sudo usermod -a -G render,video ollama && sudo systemctl restart ollama` (sudo: altera um usuário e um serviço do sistema) |
| AMD fora da lista do ROCm no Ubuntu | O Vulkan (Mesa) deve atender. A documentação do Ollama também descreve `HSA_OVERRIDE_GFX_VERSION` para forçar um alvo ROCm parecido; é experimental |
| Intel (integrada ou Arc) | Windows: atualize o driver gráfico Intel. Ubuntu: `sudo apt install mesa-vulkan-drivers` |
| GPU integrada **e** dedicada no mesmo computador | Se o Ollama usar a integrada ou ficar instável, a documentação do Ollama orienta a definir `GGML_VK_VISIBLE_DEVICES` com o índice da dedicada (ex.: `1`), ou `OLLAMA_VULKAN=0` para desligar o Vulkan. Defina como as outras variáveis do Ollama (Windows: variável de usuário + reiniciar o Ollama; Ubuntu: `sudo systemctl edit ollama`) |
| Só GPU integrada, modelo lento | Esperado: a integrada divide a RAM e a banda de memória com o sistema. Use um modelo menor ou a prioridade "velocidade" |

Logs para confirmar qual biblioteca foi carregada: Windows `%LOCALAPPDATA%\Ollama\server.log`; Ubuntu `journalctl -u ollama --no-pager`. Procure linhas com `CUDA`, `ROCm` ou `Vulkan`. **Pendente:** o texto exato dessas linhas na versão 0.40.15.

## OpenCode 1 instalado

**Sintoma:** "OpenCode 1.x encontrado; este repositório usa o OpenCode 2", ou `opencode --version` mostra `1.x`.

Os dois usam o comando `opencode` e não convivem. Remova o V1 e instale o V2:

| Origem do V1 | Remoção |
|---|---|
| npm (`opencode-ai`) | `npm uninstall -g opencode-ai` |
| Instalador `curl` do V1 (Linux) | Apague `~/.opencode/bin/opencode` e a linha que o instalador acrescentou ao `~/.bashrc` |
| `ollama launch opencode` sem OpenCode instalado | No Windows ele usa `npm install -g opencode-ai@latest`; no Linux, o instalador `curl` do V1. Remova como acima |
| choco / scoop (Windows) | `choco uninstall opencode` ou `scoop uninstall opencode` |

Depois: `npm install -g @opencode/cli@2.2.6` e `opencode --version`.

Suas configurações do V1 continuam sendo lidas pelo V2, que entende os dois formatos. Veja https://opencode.ai/docs/migrate-v1.

## OpenCode não inicia

- `opencode --version` funciona? Se não, reinstale (Passo A2 do Windows / Passo A3 do Ubuntu).
- **Windows**, erro de execução de scripts `.ps1`: veja o Passo A2 do [manual do Windows](windows-11.md).
- O OpenCode 2 usa um serviço em segundo plano. Para diagnosticar: `opencode service status` e, se travado, `opencode service restart`.
- Teste o modo alternativo, sem `ollama launch`: `node scripts/ia-local.mjs iniciar --direto` (**pendente de validação**).
- Logs detalhados: `opencode --standalone --print-logs` (os logs do servidor exigem `--standalone`).

## O modelo não usa ferramentas direito

Modelos locais erram mais: respondem em texto em vez de editar, inventam nomes de arquivo, repetem ações. Tente:
- pedidos mais curtos e específicos ([uso-diario.md](uso-diario.md));
- um modelo maior, se `verificar` mostrar folga de memória;
- registrar o comportamento em `validar-fluxo`, para a equipe saber quais modelos funcionam.

## Modelos em nuvem (modos misto e nuvem)

| Sintoma | O que fazer |
|---|---|
| "consentimento não foi registrado" | Rode `node scripts/ia-local.mjs modo` e confirme, ou escolha `local` |
| `Model unavailable` ou modelo sumiu de `/models` | Os gratuitos são "por tempo limitado". Rode `modo` e escolha outro, ou escolha em `/models`; avise para atualizar `catalogo/nuvem-gratuita.json` |
| Modelos pagos aparecem em `/models` | Há uma conta do OpenCode conectada ou `OPENCODE_API_KEY` definida em outro lugar. O script remove a variável, mas uma conta conectada pelo `/connect` pode continuar ativa (**pendente de validação**). Verifique com `opencode auth list` e desconecte com `opencode auth logout` se não quiser modelos pagos |
| OpenRouter: erro de limite (429) | Limite de 50 pedidos por dia sem créditos. Espere o dia seguinte ou use os modelos gratuitos do OpenCode. **Não** compre créditos se quiser ficar no gratuito |
| "variável OPENROUTER_API_KEY não definida" | Defina a chave como em [nuvem-gratuita.md](nuvem-gratuita.md#2-openrouter-somente-variantes-free-opcional) e abra um terminal novo |
| Sem internet | O modo nuvem não funciona offline. Use `modo` → `local` (precisa do Ollama e de um modelo baixado) |

## Bloqueios das proteções de segurança

| Sintoma | Explicação e saída |
|---|---|
| O OpenCode pede aprovação para buscar uma URL ou rodar `curl`, `git push`, `Invoke-WebRequest` | Proteção do script ([seguranca.md](seguranca.md)). Aprove só se você pediu aquilo e entende o comando |
| "permission denied" ao ler ou editar `.env`, chaves ou `.ssh` | Bloqueio intencional. Edite esses arquivos você mesmo, fora do OpenCode |
| As regras do `AGENTS.md` ou do `opencode.json` do projeto não foram aplicadas | Você iniciou com `--nao-confiavel`, que ignora a configuração do projeto. Inicie sem a opção se o repositório for seu |

## Preferências corrompidas

Os scripts guardam a versão anterior em `preferencias.json.bak`, na pasta local (`status` mostra o caminho). Para voltar: apague `preferencias.json` e renomeie o `.bak`. Para recomeçar do zero: apague a pasta local inteira.

## Atualização

Atualizar é diferente de instalar a versão de referência. Primeiro confira em [validacao.md](validacao.md) se a nova versão já foi avaliada.

| Componente | Windows (PowerShell) | Ubuntu (Bash) |
|---|---|---|
| Ollama | `$env:OLLAMA_VERSION = "<versão>"; irm https://ollama.com/install.ps1 \| iex` (sem a variável: última versão) | `curl -fsSL https://ollama.com/install.sh \| OLLAMA_VERSION=<versão> sh` |
| OpenCode | `npm install -g @opencode/cli@<versão>` | igual |
| Node.js | `winget upgrade --id OpenJS.NodeJS.LTS -e` | `nvm install 24` (traz a última 24.x) |
| Este repositório | `git pull` | `git pull` |
| Modelo | `ollama pull <tag base>` e depois `selecionar` para recriar o derivado | igual |

O OpenCode verifica atualizações e, por padrão, só avisa (`"update": "notify"`). O comando `opencode upgrade <versão>` também existe. Para manter a versão de referência, não aceite a atualização automática.

Depois de atualizar o modelo base, **recrie o derivado** (`selecionar`): ele foi criado a partir da versão anterior dos pesos.

## Desinstalação

Veja a tabela no fim de cada manual: [Windows](windows-11.md#passo-c2--desinstalação) e [Ubuntu](ubuntu-24.04.md#passo-c2--desinstalação). Elas separam programas, configurações e modelos.
