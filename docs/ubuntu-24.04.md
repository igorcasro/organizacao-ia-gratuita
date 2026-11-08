# Manual — Ubuntu 24.04

Instalação nativa no Ubuntu 24.04 (x64). Situação dos testes: os **scripts do repositório** foram testados num contêiner Ubuntu 24.04 com Ollama e OpenCode **simulados**; a **instalação real** do Ollama e do OpenCode e o fluxo com modelo estão **pendentes de validação** (ver [validacao.md](validacao.md)).

**Versões de referência** (instale exatamente estas para reproduzir; para atualizar depois, veja [problemas.md](problemas.md#atualização)):

| Componente | Versão |
|---|---|
| Node.js | 24 LTS, instalado com nvm 0.41.0 |
| Ollama | 0.40.15 (só para a Parte B, modelo local) |
| OpenCode | 2.2.6 (pacote npm `@opencode/cli`) |

### Qual caminho seguir
- **Recomendado: nuvem gratuita (Parte A).** Sem Ollama e sem download. Passos A1 a A7.
- **Reserva ou alternativa local (Parte B).** Só se precisar de um modelo local: modo misto (nuvem + reserva local) ou modo local (último recurso).
- Manutenção (atualização e desinstalação): Parte C.

### Convenções
- **Terminal:** Bash (aplicativo "Terminal").
- **Valores a substituir** aparecem entre `<` e `>`.
- **sudo:** só quando indicado, com justificativa.

---


---

# Parte A — Caminho recomendado: nuvem gratuita

Sem Ollama, sem download de modelos e sem exigência de hardware. Exige internet. Nesse modo, o código que o OpenCode ler é enviado ao provedor do modelo; leia [nuvem-gratuita.md](nuvem-gratuita.md) e [seguranca.md](seguranca.md) antes.

## Passo A1 — Pacotes básicos

- **Onde:** terminal. **Diretório:** qualquer.
- **sudo:** sim, porque instala pacotes do sistema.

  ```bash
  sudo apt update
  sudo apt install -y curl git zstd pciutils mesa-vulkan-drivers vulkan-tools
  ```

  Para a Parte A bastam `curl` e `git`. Os demais servem à Parte B (modelo local): o `zstd` descompacta os pacotes `.tar.zst` que o Ollama distribui; o `pciutils` fornece o `lspci`, usado no diagnóstico **e pelo instalador do Ollama para detectar GPUs AMD**, por isso precisa estar instalado antes do Passo B2; `mesa-vulkan-drivers` (drivers Vulkan para AMD e Intel) e `vulkan-tools` (comando `vulkaninfo`) permitem que o Ollama acelere GPUs AMD sem ROCm e GPUs integradas. Quem só vai usar a nuvem pode instalar só `curl git`.
- **Verificação:** `curl --version && git --version`.

## Passo A2 — Instalar o Node.js 24 com nvm

O pacote `nodejs` do Ubuntu 24.04 é da série 18, e os scripts deste repositório exigem Node.js 20 ou mais novo. O nvm instala o Node.js na sua pasta pessoal, sem sudo, e evita usar `sudo npm`.

- **Onde:** terminal. **Diretório:** qualquer. **sudo:** não.

  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.41.0/install.sh | bash
  ```

  **Feche e reabra o terminal**, e então:

  ```bash
  nvm install 24
  ```

- **Verificação:**

  ```bash
  node --version   # v24.x.x
  npm --version
  ```

- **Falhas comuns:** `nvm: command not found` → reabra o terminal ou rode `source ~/.bashrc`.

## Passo A3 — Instalar o OpenCode 2.2.6

- **Onde:** terminal. **Diretório:** qualquer. **sudo:** não (com o Node.js do nvm, o npm instala na sua pasta pessoal).
- **Antes:** remova um OpenCode 1, se existir:

  ```bash
  npm uninstall -g opencode-ai 2>/dev/null; ls ~/.opencode/bin 2>/dev/null
  ```

  Se a segunda linha listar um `opencode`, ele veio do instalador `curl` do OpenCode 1; veja [problemas.md](problemas.md#opencode-1-instalado).
- **Comando:**

  ```bash
  npm install -g @opencode/cli@2.2.6
  ```

- **Verificação:**

  ```bash
  opencode --version   # 2.2.6
  which opencode       # caminho dentro de ~/.nvm
  ```

- **Falhas comuns:** `EACCES` → o npm não é o do nvm (`which npm` deve apontar para `~/.nvm`). **Não** use `sudo npm`.

## Passo A4 — Obter este repositório

- **Onde:** terminal. **Diretório:** a pasta onde você guarda projetos. **sudo:** não.

  ```bash
  cd ~/<pasta de projetos>
  git clone https://github.com/igorcasro/organizacao-ia-gratuita.git
  cd organizacao-ia-gratuita
  node scripts/ia-local.mjs ajuda
  ```

## Passo A5 — Escolher o modo (nuvem gratuita)

- **Onde:** terminal. **Diretório:** a pasta do repositório. **sudo:** não.

  ```bash
  node scripts/ia-local.mjs modo
  ```

- **Respostas:**
  1. Modo: **Enter** (`nuvem`, o recomendado).
  2. "Liberar opencode?": **Enter** (sim). São os modelos gratuitos do OpenCode, sem conta e sem chave.
  3. "Liberar openrouter?": **n**, a menos que você já tenha criado a conta e definido a chave (ver [nuvem-gratuita.md](nuvem-gratuita.md)).
  4. Leia os avisos de privacidade e digite `concordo`.
  5. Modelo padrão: **Enter** para **Automático** (a primeira opção): a cada início, o script usa o melhor modelo disponível no dia que **não treina** com os seus dados (ver [nuvem-gratuita.md](nuvem-gratuita.md#modelo-padrão-automático-recomendado)).
- **Resultado esperado:** `Modo 'nuvem' salvo. Provedores em nuvem liberados: opencode.`
- **Verificação:** `node scripts/ia-local.mjs status` mostra `Modo: nuvem`.
- **Falhas comuns:** "Confirmação não recebida" → nada foi salvo; rode de novo e digite exatamente `concordo`.

## Passo A6 — Verificar e primeiro teste

- **Onde:** terminal. **Diretório:** a pasta do repositório. **sudo:** não.

  ```bash
  node scripts/ia-local.mjs verificar
  ```

- **Resultado esperado:** `[OK]` em todos os itens. O script lista os modelos sem enviar nada a eles e confere que só aparece o provedor `opencode`. Depois pergunta se pode enviar um pedido curto de teste; responda `s`.
- **Validação do fluxo de programação** (projeto descartável):

  ```bash
  node scripts/ia-local.mjs validar-fluxo
  ```

  O script cria uma cópia descartável e mostra o comando para abrir o OpenCode nela em **outro** terminal. Siga os 6 itens e responda.
- **Falhas comuns:** "Só provedores liberados aparecem" com falha, modelo indisponível, modelos pagos visíveis → [problemas.md](problemas.md#modelos-em-nuvem-modos-misto-e-nuvem).

## Passo A7 — Uso diário

  ```bash
  cd ~/caminho/do/seu/projeto
  node ~/<pasta de projetos>/organizacao-ia-gratuita/scripts/ia-local.mjs iniciar
  ```

Atalho opcional (só para o seu usuário): acrescente ao `~/.bashrc`

  ```bash
  alias ia-local='node ~/<pasta de projetos>/organizacao-ia-gratuita/scripts/ia-local.mjs'
  ```

e use `ia-local iniciar`. Mais em [uso-diario.md](uso-diario.md).


---

# Parte B — Modelo local (opcional, último recurso)

Faça esta parte só se quiser um **modelo local**: como reserva do modo **misto** (para quando a cota gratuita acabar ou a internet cair) ou como modo **local** (código confidencial, sem internet). Ela exige download de 4 a 19 GB e hardware adequado. Ao terminar, rode `modo` e escolha `misto` ou `local`.

## Passo B1 — Diagnóstico inicial (antes de instalar)

- **Onde:** terminal. **Diretório:** qualquer. **sudo:** não.

  ```bash
  lsb_release -ds; uname -m          # Ubuntu 24.04.x LTS / x86_64
  free -h                            # linha "Mem:", coluna "total"
  lscpu | grep -E 'Model name|^CPU\(s\)'
  lspci | grep -iE 'vga|3d|display'  # placas de vídeo
  df -h /usr/share /home             # espaço livre (os modelos do Ollama ficam em /usr/share/ollama)
  ```

  GPU NVIDIA com driver instalado:

  ```bash
  nvidia-smi --query-gpu=name,memory.total --format=csv
  ```

  GPU AMD (driver `amdgpu`), VRAM em bytes:

  ```bash
  cat /sys/class/drm/card*/device/mem_info_vram_total 2>/dev/null
  ```

- **Resultado esperado:** RAM, VRAM e espaço livre conhecidos. **GPU integrada** (Intel UHD/Iris/Arc integrada; AMD com nomes como Phoenix, Rembrandt, Renoir, "Radeon Graphics") usa a mesma RAM do sistema: conte **0** de VRAM. O valor que o comando da AMD mostra para uma integrada é só a reserva de memória, não memória própria.
- **Verificação:** compare com os requisitos do [README](../README.md#requisitos).
- **Falhas comuns:** `lspci` ausente → `sudo apt install pciutils`. `nvidia-smi` ausente com placa NVIDIA → falta o driver proprietário (Ubuntu: **Programas e Atualizações → Drivers adicionais**). Sem driver, o Ollama usa só a CPU.

## Passo B2 — Instalar o Ollama 0.40.15

- **Onde:** terminal. **Diretório:** qualquer.
- **sudo:** sim (o instalador pede a senha). Ele copia o programa para `/usr`, cria o usuário de sistema `ollama` e o serviço `systemd` que inicia o Ollama com o computador.

  ```bash
  curl -fsSL https://ollama.com/install.sh | OLLAMA_VERSION=0.40.15 sh
  ```

- **Resultado esperado:** serviço `ollama` ativo, ouvindo **somente** em `127.0.0.1:11434` (padrão do Ollama).
- **Verificação:**

  ```bash
  ollama --version
  systemctl status ollama --no-pager
  curl -s http://127.0.0.1:11434/api/version   # {"version":"0.40.15"}
  ```

- **Falhas comuns:**
  - Serviço parado → `sudo systemctl start ollama` (sudo: controla um serviço do sistema).
  - Logs: `journalctl -e -u ollama`.
  - GPU não usada → confira o driver (Passo B1). Para AMD, a documentação do Ollama indica o pacote ROCm adicional; veja https://docs.ollama.com/linux.
  - Pouco espaço em `/usr/share` → veja [problemas.md](problemas.md#falta-de-espaço) antes de baixar modelos.

### GPU AMD ou integrada no Ubuntu

O Ollama acelera GPUs de três formas no Linux (documentação de hardware do Ollama, v0.40.15):

| GPU | Como o Ollama acelera | O que você precisa |
|---|---|---|
| NVIDIA | CUDA | Driver proprietário 550 ou mais novo |
| AMD listadas pelo Ollama (RX 9000, RX 7000, RX 6800/6900, PRO W7000/W6000, Ryzen AI) | ROCm v7 | Driver ROCm v7 (`amdgpu-install`, ver https://rocm.docs.amd.com) **ou** Vulkan, abaixo |
| Demais AMD, incluindo APUs Ryzen | Vulkan | `mesa-vulkan-drivers` (Passo A1) |
| Intel integrada e Intel Arc | Vulkan | `mesa-vulkan-drivers` (Passo A1) |

O que o instalador do Ollama já faz: se o `lspci` mostrar uma GPU AMD, ele baixa o pacote ROCm do Ollama; e acrescenta o usuário de serviço `ollama` aos grupos `render` e `video`, necessários para acessar a GPU.

- **Verificação** (sem sudo):

  ```bash
  vulkaninfo --summary | grep -E 'deviceName|deviceType'   # sua GPU deve aparecer (INTEGRATED_GPU ou DISCRETE_GPU)
  id -nG ollama                                            # deve incluir render e video
  ```

  Depois do Passo B5 (`verificar`), o script mostra a porcentagem do modelo na GPU (medição real); `ollama ps` também mostra (coluna `PROCESSOR`).
- **Opcional, para GPUs usadas via Vulkan:** a documentação do Ollama explica que, sem uma permissão extra, ele não lê a memória livre real da GPU pelo Vulkan e usa tamanhos aproximados. Para conceder a permissão (**sudo:** sim, altera um arquivo do sistema):

  ```bash
  sudo setcap cap_perfmon+ep "$(readlink -f "$(command -v ollama)")"
  sudo systemctl restart ollama
  ```

  **Pendente de validação:** se a permissão precisa ser aplicada de novo depois de atualizar o Ollama (o instalador substitui o arquivo).
- **Falhas comuns:** [problemas.md](problemas.md#gpu-não-usada).

### Opcional, recomendado: desativar os recursos de nuvem do Ollama

- **sudo:** sim, porque altera o serviço do sistema.

  ```bash
  sudo systemctl edit ollama
  ```

  No editor, acrescente entre os comentários indicados:

  ```ini
  [Service]
  Environment="OLLAMA_NO_CLOUD=1"
  ```

  Salve, saia e reinicie:

  ```bash
  sudo systemctl daemon-reload
  sudo systemctl restart ollama
  ```

- **Verificação:** `journalctl -u ollama --no-pager | grep -i 'cloud disabled'` deve mostrar `Ollama cloud disabled: true`.
- **Desfazer:** `sudo systemctl revert ollama` e reinicie o serviço.

## Passo B3 — Diagnóstico pelo script

- **Onde:** terminal. **Diretório:** a pasta do repositório. **sudo:** não.

  ```bash
  node scripts/ia-local.mjs diagnostico
  ```

- **Resultado esperado:** resumo e arquivo `~/.config/ia-local/diagnostico.json`.
- **Correção manual** (VRAM não detectada, por exemplo):

  ```bash
  node scripts/ia-local.mjs diagnostico --manual
  ```

## Passo B4 — Escolher, baixar e configurar o modelo

  ```bash
  node scripts/ia-local.mjs selecionar
  ```

- **Onde/diretório/sudo:** terminal, pasta do repositório, sem sudo.
- **O que acontece:** igual ao Windows (perguntas de uso → recomendação → escolha → **confirmação antes do download** → conferência de `tools` → modelo derivado `ia-local-<id>:64k` → preferência salva em `~/.config/ia-local/preferencias.json`).
- **Verificação:** `ollama list` mostra o modelo base e o derivado.

## Passo B5 — Verificação técnica e primeiro teste

No modo **misto** use `verificar --local` (o `verificar` sem opção testa a parte em nuvem). No modo **local**, `verificar` e `verificar --local` fazem o mesmo.

  ```bash
  node scripts/ia-local.mjs verificar --local
  node scripts/ia-local.mjs validar-fluxo
  ```

- `verificar` mede memória, fração na GPU e contexto carregado (deve ser ≥ 65536).
- `validar-fluxo` cria uma cópia descartável em `/tmp` e mostra o comando para abrir o OpenCode nela em **outro** terminal. Siga os 6 itens.


---

# Parte C — Manutenção

## Passo C1 — Atualização e recuperação

Veja [problemas.md](problemas.md#atualização).

## Passo C2 — Desinstalação

| O que remover | Comando | sudo |
|---|---|---|
| Modelos | `ollama list` e `ollama rm <nome>` para cada um | Não |
| Dados locais deste repositório | `rm -rf ~/.config/ia-local` | Não |
| OpenCode (programa) | `opencode uninstall --dry-run`, depois `opencode uninstall`; se ainda listado: `npm uninstall -g @opencode/cli` | Não |
| Configurações e sessões do OpenCode | `opencode debug paths` mostra as pastas; o `uninstall` não as remove | Não |
| Serviço do Ollama | `sudo systemctl stop ollama && sudo systemctl disable ollama && sudo rm /etc/systemd/system/ollama.service` | Sim: serviço do sistema |
| Programa do Ollama | `sudo rm -r $(which ollama \| tr 'bin' 'lib')` e `sudo rm $(which ollama)` | Sim: arquivos em `/usr` |
| Modelos e usuário do Ollama | `sudo userdel ollama; sudo groupdel ollama; sudo rm -r /usr/share/ollama` | Sim |
| Node.js | `nvm uninstall 24` | Não |

Os comandos de remoção do Ollama são os da documentação oficial (https://docs.ollama.com/linux, seção *Uninstall*).
