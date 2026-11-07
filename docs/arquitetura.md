# Arquitetura

## Componentes

```
 ┌──────────────────────── seu computador ─────────────────────────┐
 │                                                                 │
 │  Terminal                                                       │
 │    └─ node scripts/ia-local.mjs  (este repositório)             │
 │         │ diagnóstico, catálogo, seleção, verificação           │
 │         │                                                       │
 │         ├─ API HTTP ──────────────► Ollama (127.0.0.1:11434)     │
 │         │   /api/version /api/tags   └─ modelos em disco        │
 │         │   /api/show /api/ps                                   │
 │         │                                                       │
 │         └─ nuvem/misto: opencode --standalone                   │
 │            local:       ollama launch opencode --model <m>      │
 │                 └─► OpenCode 2 (interface no terminal)          │
 │                         └─ API compatível com OpenAI ─► Ollama   │
 └─────────────────────────────────────────────────────────────────┘
```

| Componente | Papel | Quem fornece |
|---|---|---|
| Ollama | Baixa e executa modelos; serve a API em `127.0.0.1:11434` | Projeto Ollama |
| OpenCode 2 | Assistente de programação: lê, edita, executa comandos com permissão | Projeto OpenCode |
| `ollama launch opencode` | Integração oficial: inicia o OpenCode já apontado para um modelo do Ollama | Projeto Ollama |
| `scripts/ia-local.mjs` | Diagnóstico, recomendação, confirmação de download, contexto, verificação, início | Este repositório |
| `catalogo/modelos.json` | Lista curta de modelos recomendados, com tamanhos, licenças e estimativas | Este repositório |

## Fluxo

1. **Diagnóstico** (`diagnostico`): sistema, arquitetura, CPU, RAM, GPUs NVIDIA, AMD e Intel (dedicadas ou integradas, com a aceleração esperada no Ollama: CUDA, ROCm ou Vulkan) e VRAM quando detectável, espaço livre na pasta de modelos do Ollama, versões de Node.js, Ollama e OpenCode. Valores que faltam podem ser informados à mão (`diagnostico --manual`). O preenchimento manual tem prioridade sobre o detectado.
2. **Recomendação** (`modelos`): para cada modelo do catálogo, estima a memória com o contexto de 64k e classifica em *recomendado* (cabe na GPU), *possível, porém lento* (CPU ou GPU parcial) ou *não recomendado*. Checa o espaço em disco. A ordem depende da prioridade escolhida (velocidade, equilíbrio, qualidade).
3. **Seleção** (`selecionar`): pergunta tarefas, tamanho dos projetos e prioridade; mostra modelos instalados e catálogo; permite escolha manual; **confirma antes de baixar**; consulta as capacidades declaradas pelo Ollama (`tools`); cria o modelo derivado com contexto fixo; salva a preferência local.
4. **Verificação técnica** (`verificar`): carrega o modelo e **mede** pelo `/api/ps` a memória usada, a fração na GPU e o contexto realmente carregado; confere a versão do OpenCode.
5. **Validação do fluxo** (`validar-fluxo`): roteiro guiado num projeto descartável (leitura, explicação, alteração, teste, revisão e reversão). O resultado fica registrado localmente.
6. **Início** (`iniciar`): confere o modo, o consentimento e o OpenCode 2 e gera a configuração com políticas, permissões e instruções de segurança ([seguranca.md](seguranca.md)). Nos modos nuvem e misto executa `opencode --standalone`; no local confere o Ollama e o modelo e executa `ollama launch opencode --model <modelo>`, sempre na pasta do projeto.

## Estados de um modelo

| Estado | Significado | Como se chega |
|---|---|---|
| `catalogo` | Escolhido, mas não baixado | — |
| `instalado` | Modelo base presente no Ollama | `ollama pull` (com confirmação) |
| `contexto-configurado` | Modelo derivado com `num_ctx` criado | `ollama create` |
| `verificado-tecnicamente` | Carregou com o contexto pedido e declara `tools` | `verificar` |
| `validado-no-fluxo` | O roteiro de programação funcionou neste computador | `validar-fluxo` |

Conseguir conversar com o modelo **não** comprova que ele usa ferramentas, edita arquivos ou executa comandos corretamente. Só o último estado indica isso.

## Decisões e justificativas

### Por que Node.js para os scripts
O Windows 11 não vem com Python, e o Ubuntu não vem com PowerShell. O Node.js já é exigido para instalar o OpenCode pelo npm (método documentado pelo OpenCode e o único que o Ollama usa no Windows). Com ele, o mesmo código roda nos dois sistemas e as regras não ficam duplicadas. Nenhum pacote externo é usado.

### Por que OpenCode 2
É a versão atual (tag `v2.2.6` em 2026-11-07). A documentação do V2 oferece binários nativos para Windows e descoberta automática dos modelos do Ollama. **Atenção:** a página de integração do Ollama ainda mostra a instalação e o formato de configuração do OpenCode 1 (`npm install -g opencode-ai`, chave `provider` com `npm`). O código do `ollama launch` (v0.40.15) já reconhece o OpenCode 2 e inicia com `--standalone`. Os dois formatos de configuração não devem ser misturados.

### Por que `ollama launch` no modo local
É o caminho oficial e já resolve dois detalhes: monta a configuração do provedor e informa ao OpenCode o tamanho de contexto realmente carregado (lido do Ollama depois de carregar o modelo). Assim o OpenCode não presume uma janela maior do que a disponível. Ressalva: se o OpenCode não estiver instalado, o `ollama launch` instala o **OpenCode 1** por conta própria. Por isso o script exige o OpenCode 2 antes.

Há um modo alternativo (`iniciar --direto`) que chama `opencode --standalone` com a configuração em `OPENCODE_CONFIG_CONTENT`. Ele serve para diagnóstico e está **pendente de validação**.

### Por que um modelo derivado para o contexto
O Ollama usa contexto de 4k em máquinas com menos de 24 GB de VRAM, e a documentação dele indica pelo menos 64000 tokens para ferramentas como o OpenCode. A documentação de compatibilidade OpenAI do Ollama recomenda criar um modelo com `PARAMETER num_ctx` para mudar o contexto. Comparado a `OLLAMA_CONTEXT_LENGTH`, o modelo derivado não altera o serviço, não afeta outros modelos, não exige sudo e é desfeito com `ollama rm`.

### Modos nuvem, misto e local
Ordem de preferência do projeto: **nuvem gratuita → misto → local** (último recurso). O modo fica nas preferências locais (`modo`) e começa vazio, então `iniciar` pede que ele seja escolhido. Os modos `nuvem` e `misto` liberam provedores **gratuitos** listados em `catalogo/nuvem-gratuita.json`, só depois do consentimento registrado pelo comando `modo`. Nos dois, o OpenCode é iniciado com `opencode --standalone` e um modelo gratuito em nuvem como padrão. No `misto`, o modelo local do Ollama fica disponível como reserva em `/models`, com o contexto real informado ao OpenCode. No `local`, o início é por `ollama launch`. Não há troca automática entre nuvem e local. Detalhes em [nuvem-gratuita.md](nuvem-gratuita.md).

### Como os provedores são limitados
No modo local: ao iniciar, o script passa ao OpenCode, pela variável `OPENCODE_CONFIG`, um arquivo com políticas (`policies`) que negam todos os provedores exceto `ollama` e negam a busca na web. Define também `OPENCODE_DISABLE_FREE_MODELS=1`. Essas variáveis e o formato das políticas foram confirmados na documentação e no código do OpenCode 2.2.6, mas **o efeito ainda não foi testado com o OpenCode real**. Nos modos misto e nuvem, as mesmas políticas liberam também os provedores escolhidos, `OPENCODE_DISABLE_FREE_MODELS` não é definida e `OPENCODE_API_KEY` é removida do ambiente, para que o provedor `opencode` ofereça só os modelos gratuitos. Como reforço opcional, o Ollama pode ter os recursos de nuvem desativados (`OLLAMA_NO_CLOUD=1`, ver manuais).

## Onde ficam os dados

| Dado | Local | Versionado? |
|---|---|---|
| Catálogo | `catalogo/modelos.json` | Sim |
| Diagnóstico | `<pasta local>/diagnostico.json` | Não |
| Preferências (modo, modelo, consentimento da nuvem) e validações | `<pasta local>/preferencias.json` (+ `.bak` da versão anterior) | Não |
| Modelfiles gerados | `<pasta local>/modelfiles/` | Não |
| Políticas de provedores geradas ao iniciar | `<pasta local>/opencode-politicas.json` | Não |
| Modelos | Pasta do Ollama (`%USERPROFILE%\.ollama\models` ou `/usr/share/ollama/.ollama/models`) | Não |
| Configuração do OpenCode | `opencode debug paths` mostra | Não (o repositório não a altera) |

`<pasta local>` = `%APPDATA%\ia-local` no Windows, `~/.config/ia-local` no Ubuntu, ou o valor de `IA_LOCAL_HOME`.
