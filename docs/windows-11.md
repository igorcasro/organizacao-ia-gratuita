# Manual — Windows 11

Instalação **nativa** no Windows (sem WSL). Situação dos testes: **pendente de validação no Windows**; os comandos foram confirmados na documentação oficial (ver [validacao.md](validacao.md) e [fontes.md](fontes.md)).

**Versões de referência** (instale exatamente estas para reproduzir; para atualizar depois, veja [problemas.md](problemas.md#atualização)):

| Componente | Versão |
|---|---|
| Node.js | 24 LTS (24.22.2 era a mais recente em 2026-11-07) |
| Ollama | 0.40.15 (só para a Parte B, modelo local) |
| OpenCode | 2.2.6 (pacote npm `@opencode/cli`) |

### Por que não WSL
O OpenCode 1 recomendava WSL no Windows. O OpenCode 2 publica binários nativos para Windows, e o Ollama roda como aplicativo nativo com suporte a GPU NVIDIA e AMD. Usar WSL acrescentaria uma segunda instalação de Linux, a ponte de rede entre Windows e WSL e a configuração de GPU dentro do WSL, sem benefício claro para este fluxo. Se um impedimento concreto aparecer na validação, isso será documentado.

### Qual caminho seguir
- **Recomendado: nuvem gratuita (Parte A).** Sem Ollama e sem download. Passos A1 a A6.
- **Reserva ou alternativa local (Parte B).** Só se precisar de um modelo local: modo misto (nuvem + reserva local) ou modo local (último recurso).
- Manutenção (atualização e desinstalação): Parte C.

### Convenções
- **Terminal:** PowerShell (Windows Terminal → PowerShell). Os comandos abaixo são de PowerShell; não use o "Prompt de Comando" a menos que indicado.
- **Valores a substituir** aparecem entre `<` e `>`; remova os sinais ao digitar.
- **Administrador:** só quando indicado. O padrão é um PowerShell **comum**.

---


---

# Parte A — Caminho recomendado: nuvem gratuita

Sem Ollama, sem download de modelos e sem exigência de hardware. Exige internet. Nesse modo, o código que o OpenCode ler é enviado ao provedor do modelo; leia [nuvem-gratuita.md](nuvem-gratuita.md) e [seguranca.md](seguranca.md) antes.

## Passo A1 — Instalar Node.js e Git

- **Onde:** PowerShell comum. **Diretório:** qualquer.
- **Administrador:** o instalador do Node.js pede elevação (janela do Controle de Conta de Usuário), porque instala para todo o computador.
- **Comandos** (o `winget` já vem no Windows 11):

  ```powershell
  winget install --id OpenJS.NodeJS.LTS -e
  winget install --id Git.Git -e
  ```

  Alternativa sem `winget`: baixe o instalador **LTS** em https://nodejs.org e o Git em https://git-scm.com.
- **Resultado esperado:** instalação concluída. **Feche e reabra o PowerShell** para atualizar o PATH.
- **Verificação:**

  ```powershell
  node --version   # v24.x.x (ou 20+ no mínimo)
  npm --version
  git --version
  ```

- **Falhas comuns:**
  - `node` não reconhecido → reabra o terminal; se persistir, reinicie a sessão do Windows.
  - Os identificadores `OpenJS.NodeJS.LTS` e `Git.Git` estão **pendentes de confirmação** nesta data. Confira com `winget search nodejs` e `winget search git`.
  - Para fixar uma versão exata: `winget install --id OpenJS.NodeJS.LTS -e --version <versão>` (as versões disponíveis aparecem em `winget show OpenJS.NodeJS.LTS --versions`).

## Passo A2 — Instalar o OpenCode 2.2.6

- **Onde:** PowerShell comum. **Diretório:** qualquer. **Administrador:** não.
- **Antes:** se já usou o OpenCode 1, remova-o (os dois usam o comando `opencode`):

  ```powershell
  npm uninstall -g opencode-ai
  ```

- **Comando:**

  ```powershell
  npm install -g @opencode/cli@2.2.6
  ```

- **Resultado esperado:** pacote instalado; o `postinstall` escolhe o binário nativo do Windows.
- **Verificação:**

  ```powershell
  opencode --version   # 2.2.6
  ```

- **Falhas comuns:**
  - *"opencode.ps1 não pode ser carregado porque a execução de scripts foi desabilitada"* → o PowerShell bloqueia os atalhos `.ps1` que o npm cria. Rode `opencode.cmd --version` para confirmar a instalação. Para liberar scripts locais **só para o seu usuário**: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. Os scripts deste repositório não dependem dessa mudança.
  - Versão `1.x` aparece → ainda há um OpenCode 1 no PATH (instalado por outro gerenciador ou pelo `ollama launch`). Veja [problemas.md](problemas.md#opencode-1-instalado).
  - **Não** use `choco` ou `scoop`: a documentação do OpenCode 2 informa que gerenciadores de pacotes do Windows não são suportados.

## Passo A3 — Obter este repositório

- **Onde:** PowerShell comum. **Diretório:** a pasta onde você guarda projetos (exemplo: `C:\Users\<seu usuário>\projetos`). **Administrador:** não.

  ```powershell
  cd C:\Users\<seu usuário>\projetos
  git clone https://github.com/igorcasro/organizacao-ia-gratuita.git
  cd organizacao-ia-gratuita
  ```

- **Verificação:** `node scripts\ia-local.mjs ajuda` mostra a lista de comandos.
- **Falhas comuns:** "Este script requer Node.js 20" → atualize o Node.js (Passo A1).

## Passo A4 — Escolher o modo (nuvem gratuita)

- **Onde:** PowerShell comum. **Diretório:** a pasta do repositório. **Administrador:** não.

  ```powershell
  node scripts\ia-local.mjs modo
  ```

- **Respostas:**
  1. Modo: **Enter** (`nuvem`, o recomendado).
  2. "Liberar opencode?": **Enter** (sim). São os modelos gratuitos do OpenCode, sem conta e sem chave.
  3. "Liberar openrouter?": **n**, a menos que você já tenha criado a conta e definido a chave (ver [nuvem-gratuita.md](nuvem-gratuita.md)).
  4. Leia os avisos de privacidade e digite `concordo`.
  5. Modelo padrão: **Enter** para **Automático** (a primeira opção): a cada início, o script usa o melhor modelo disponível no dia que **não treina** com os seus dados (ver [nuvem-gratuita.md](nuvem-gratuita.md#modelo-padrão-automático-recomendado)).
- **Resultado esperado:** `Modo 'nuvem' salvo. Provedores em nuvem liberados: opencode.`
- **Verificação:** `node scripts\ia-local.mjs status` mostra `Modo: nuvem`.
- **Falhas comuns:** "Confirmação não recebida" → nada foi salvo; rode de novo e digite exatamente `concordo`.

## Passo A5 — Verificar e primeiro teste

- **Onde:** PowerShell comum. **Diretório:** a pasta do repositório. **Administrador:** não.

  ```powershell
  node scripts\ia-local.mjs verificar
  ```

- **Resultado esperado:** `[OK]` em todos os itens. O script lista os modelos sem enviar nada a eles e confere que só aparece o provedor `opencode`. Depois pergunta se pode enviar um pedido curto de teste; responda `s`.
- **Validação do fluxo de programação** (projeto descartável):

  ```powershell
  node scripts\ia-local.mjs validar-fluxo
  ```

  O script cria uma cópia descartável e mostra o comando para abrir o OpenCode nela em **outro** terminal. Siga os 6 itens e responda.
- **Falhas comuns:** "Só provedores liberados aparecem" com falha, modelo indisponível, modelos pagos visíveis → [problemas.md](problemas.md#modelos-em-nuvem-modos-misto-e-nuvem).

## Passo A6 — Uso diário em projetos existentes

- **Onde:** PowerShell comum. **Diretório:** a pasta do **seu projeto**. **Administrador:** não.

  ```powershell
  cd C:\caminho\do\seu\projeto
  node C:\Users\<seu usuário>\projetos\organizacao-ia-gratuita\scripts\ia-local.mjs iniciar
  ```

- **Resultado esperado:** a interface do OpenCode abre com o modelo do modo escolhido: o gratuito em nuvem (modos nuvem e misto) ou `ollama/ia-local-<id>:64k` (modo local).
- **Terminal:** abra o OpenCode no **PowerShell** (de preferência no Windows Terminal). Em 2026-11-07, com o Git Bash aberto a partir do PowerShell, a resposta ficava rolando dentro da área do OpenCode e o cursor sumia; no PowerShell, tudo normal. O Git Bash serve para os demais comandos do script.
- **Teclas:** trocar entre `plan` e `build` com **Shift+Tab**. Nova linha sem enviar: **Ctrl+J** (no Windows Terminal, Shift+Enter não funcionou).
- Mais exemplos e boas práticas: [uso-diario.md](uso-diario.md).


---

# Parte B — Modelo local (opcional, último recurso)

Faça esta parte só se quiser um **modelo local**: como reserva do modo **misto** (para quando a cota gratuita acabar ou a internet cair) ou como modo **local** (código confidencial, sem internet). Ela exige download de 4 a 19 GB e hardware adequado. Ao terminar, rode `modo` e escolha `misto` ou `local`.

## Passo B1 — Diagnóstico inicial (antes de instalar)

Serve para saber se vale a pena continuar. O script do repositório faz isso automaticamente depois (Passo B3); aqui você consulta à mão.

- **Onde:** PowerShell comum. **Diretório:** qualquer. **Administrador:** não.
- **Comandos:**

  ```powershell
  # Sistema e arquitetura (espere "64 bits" / AMD64)
  Get-CimInstance Win32_OperatingSystem | Select-Object Caption, OSArchitecture
  # RAM total em GB
  [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
  # Processador
  (Get-CimInstance Win32_Processor).Name
  # Placas de vídeo
  Get-CimInstance Win32_VideoController | Select-Object Name
  # Espaço livre no disco C: em GB
  [math]::Round((Get-PSDrive C).Free / 1GB, 1)
  ```

  Se tiver GPU NVIDIA, este comando mostra o nome e a memória (VRAM):

  ```powershell
  nvidia-smi --query-gpu=name,memory.total --format=csv
  ```

  Sem `nvidia-smi` (GPU AMD ou Intel): abra o **Gerenciador de Tarefas** → **Desempenho** → **GPU** e anote **"Memória dedicada da GPU"**.

  **GPU integrada** (Intel UHD/Iris/Arc integrada, AMD "Radeon Graphics", "Radeon 780M" etc.): ela usa a mesma RAM do sistema. Considere **0** de VRAM; o que conta é a RAM. O Ollama pode usá-la para acelerar (via Vulkan), mas ela não aumenta a memória disponível para o modelo.
- **Resultado esperado:** números de RAM, VRAM e disco.
- **Verificação:** compare com a tabela de requisitos do [README](../README.md#requisitos). Com menos de 16 GB de RAM e sem GPU dedicada, o uso será muito limitado.
- **Falhas comuns:** `nvidia-smi` não reconhecido → driver NVIDIA ausente ou GPU não NVIDIA; use o Gerenciador de Tarefas.

## Passo B2 — Instalar o Ollama 0.40.15

- **Onde:** PowerShell comum. **Diretório:** qualquer.
- **Administrador:** não. O instalador do Ollama instala na pasta do usuário.
- **Comando** (instalador oficial em PowerShell, com versão fixada):

  ```powershell
  $env:OLLAMA_VERSION = "0.40.15"; irm https://ollama.com/install.ps1 | iex
  ```

  Alternativa: baixe `OllamaSetup.exe` da página da versão em https://github.com/ollama/ollama/releases/tag/v0.40.15 e execute.
- **Resultado esperado:** Ollama instalado em `%LOCALAPPDATA%\Programs\Ollama`, ícone na bandeja do sistema, servidor ativo em `http://127.0.0.1:11434`.
- **Verificação** (em um PowerShell **novo**):

  ```powershell
  ollama --version
  Invoke-RestMethod http://127.0.0.1:11434/api/version
  ```

  A segunda linha deve mostrar `version : 0.40.15`.
- **Falhas comuns:**
  - `Invoke-RestMethod` falha → o aplicativo não está aberto. Abra **Ollama** pelo menu Iniciar e tente de novo.
  - Disco C: com pouco espaço → defina a variável de usuário `OLLAMA_MODELS` para outra pasta antes de baixar modelos (ver [problemas.md](problemas.md#falta-de-espaço)).
  - Logs: `explorer %LOCALAPPDATA%\Ollama` (arquivo `server.log`).

### GPU AMD ou integrada no Windows

O Ollama acelera GPUs de três formas no Windows (documentação de hardware do Ollama, v0.40.15):

| GPU | Como o Ollama acelera | O que você precisa |
|---|---|---|
| NVIDIA (GTX 750 em diante) | CUDA | Driver NVIDIA 550 ou mais novo |
| AMD Radeon RX 7000 / PRO W7000 | ROCm | Driver AMD Adrenalin recente, com suporte a HIP 7 |
| Outras AMD (RX 6000, RX 5000, APUs Ryzen) | Vulkan | Driver AMD Adrenalin recente (o Vulkan já vem nele) |
| Intel integrada (UHD, Iris Xe, Arc) e Intel Arc dedicada | Vulkan | Driver gráfico Intel recente (o Vulkan já vem nele) |

- **Onde/administrador:** os drivers são instalados pelos sites dos fabricantes (amd.com, intel.com, nvidia.com) ou pelo Windows Update; o instalador pede elevação.
- **Verificação:** depois do Passo B5 (`verificar`), o script mostra a porcentagem do modelo na GPU (medição real). Também é possível ver com `ollama ps` (coluna `PROCESSOR`) enquanto o modelo está carregado.
- **Falhas comuns:** notebook com GPU integrada **e** dedicada usando a integrada, ou instável → veja [problemas.md](problemas.md#gpu-não-usada).

### Opcional, recomendado: desativar os recursos de nuvem do Ollama
Reforça o uso somente local (o Ollama oferece modelos em nuvem que exigem conta).

- **Administrador:** não. Altera uma variável de ambiente do **seu usuário**.

  ```powershell
  [Environment]::SetEnvironmentVariable("OLLAMA_NO_CLOUD", "1", "User")
  ```

  Depois, **saia do Ollama** (ícone da bandeja → Quit) e abra-o de novo pelo menu Iniciar.
- **Verificação:** o arquivo `%LOCALAPPDATA%\Ollama\server.log` deve conter `Ollama cloud disabled: true`.
- **Desfazer:** `[Environment]::SetEnvironmentVariable("OLLAMA_NO_CLOUD", $null, "User")` e reinicie o Ollama.

## Passo B3 — Diagnóstico pelo script

- **Onde:** PowerShell comum. **Diretório:** a pasta do repositório. **Administrador:** não.

  ```powershell
  node scripts\ia-local.mjs diagnostico
  ```

- **Resultado esperado:** resumo de sistema, CPU, RAM, GPU, disco e versões; arquivo salvo em `%APPDATA%\ia-local\diagnostico.json`.
- **Verificação:** os valores conferem com o Passo B1. Se a VRAM estiver errada ou ausente, corrija:

  ```powershell
  node scripts\ia-local.mjs diagnostico --manual
  ```

- **Falhas comuns:** a VRAM de placas AMD/Intel vem do registro do Windows ou do `Win32_VideoController`, que limita o valor a 4 GB. Na dúvida, informe manualmente.

## Passo B4 — Escolher, baixar e configurar o modelo

- **Onde:** PowerShell comum. **Diretório:** a pasta do repositório. **Administrador:** não.

  ```powershell
  node scripts\ia-local.mjs selecionar
  ```

- **O que acontece:**
  1. Perguntas sobre tarefas, tamanho dos projetos e prioridade.
  2. Lista de modelos instalados e do catálogo, com classificação para o seu hardware (estimativa) e motivo.
  3. Você escolhe pelo número (a sugestão vem marcada).
  4. Se o modelo não estiver instalado, o script mostra o tamanho e **pergunta antes de baixar**.
  5. O script mostra as capacidades declaradas pelo Ollama (precisa ter `tools`).
  6. Cria o modelo derivado `ia-local-<id>:64k` com contexto de 65536 tokens (não baixa nada novo).
  7. Salva a preferência em `%APPDATA%\ia-local\preferencias.json`.
- **Verificação:** `ollama list` mostra o modelo base e o `ia-local-...:64k`.
- **Falhas comuns:** download interrompido, falta de espaço, modelo sem `tools` → [problemas.md](problemas.md).

## Passo B5 — Verificação técnica e primeiro teste

No modo **misto** use `verificar --local` (o `verificar` sem opção testa a parte em nuvem). No modo **local**, `verificar` e `verificar --local` fazem o mesmo.

- **Onde:** PowerShell comum. **Diretório:** a pasta do repositório. **Administrador:** não.

  ```powershell
  node scripts\ia-local.mjs verificar --local
  ```

- **Resultado esperado:** `[OK]` em todos os itens; a medição mostra memória usada, porcentagem na GPU e contexto carregado (deve ser ≥ 65536). Esses números são **medições reais** deste computador.
- **Depois, valide o fluxo de programação** com o projeto descartável:

  ```powershell
  node scripts\ia-local.mjs validar-fluxo
  ```

  O script cria uma cópia em `%TEMP%` e mostra o comando para abrir o OpenCode nela, em **outro** PowerShell. Siga os 6 itens e responda.
- **Falhas comuns:** "Contexto carregado" menor que o pedido ou falta de memória → escolha um modelo menor (Passo B4).


---

# Parte C — Manutenção

## Passo C1 — Atualização e recuperação

Veja [problemas.md](problemas.md#atualização). Resumo: atualizar exige rodar de novo os comandos dos passos 3 e 4 com a nova versão e, se o modelo base mudar, recriar o modelo derivado (`selecionar`).

## Passo C2 — Desinstalação

Cada parte é independente. Faça só o que quiser remover.

| O que remover | Comando ou ação | Administrador |
|---|---|---|
| Modelos (libera mais espaço) | `ollama list` e depois `ollama rm <nome>` para cada modelo (inclusive os `ia-local-...`) | Não |
| Dados locais deste repositório | `Remove-Item -Recurse "$env:APPDATA\ia-local"` | Não |
| OpenCode (programa) | `opencode uninstall --dry-run` para ver o que sai; depois `opencode uninstall`. Se o pacote npm continuar listado: `npm uninstall -g @opencode/cli` | Não |
| Configurações e sessões do OpenCode | `opencode debug paths` mostra as pastas `config`, `data` e `state`; o `uninstall` **não** as remove. Apague-as manualmente se quiser | Não |
| Ollama (programa) | Configurações → Aplicativos → Ollama → Desinstalar; ou `$env:OLLAMA_UNINSTALL = "1"; irm https://ollama.com/install.ps1 \| iex` | Não |
| Modelos do Ollama (se sobrarem) | Apagar `%USERPROFILE%\.ollama` (ou a pasta de `OLLAMA_MODELS`, se você mudou) | Não |
| Variáveis criadas | `[Environment]::SetEnvironmentVariable("OLLAMA_NO_CLOUD", $null, "User")` (e `OLLAMA_MODELS`, se criou) | Não |
| Node.js e Git | Configurações → Aplicativos | Sim (Node.js) |
