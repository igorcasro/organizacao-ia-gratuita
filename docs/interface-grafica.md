# Interface gráfica: OpenCode Desktop e interface web

Situação em 2026-11-07: **possível, com limitações.** Análise feita na documentação e no código-fonte do OpenCode **2.2.6**; **ainda não executada** (ver [validacao.md](validacao.md)). O caminho validado continua sendo o terminal com `node scripts/ia-local.mjs iniciar`.

## Opções que o OpenCode oferece

| Interface | O que é | Como abre |
|---|---|---|
| **OpenCode Desktop** | Aplicativo com janela própria (Windows x64/ARM64, macOS, Linux `.deb`/`.rpm`/AppImage) | Download em https://opencode.ai/docs/ (seção *Desktop*) |
| **Interface web** | Interface no navegador, servida pelo próprio OpenCode, com senha; por padrão só neste computador | `opencode pair` mostra um link de uso único (5 minutos) |
| **Editor (ACP)** | OpenCode dentro de editores compatíveis com o *Agent Client Protocol*, como o Zed | `opencode acp`, configurado no editor |

## Por que o Desktop e a web não recebem as proteções do script

O comando `iniciar` abre o OpenCode com `--standalone` (servidor privado, só daquela sessão) e entrega as proteções por variáveis de ambiente: `OPENCODE_CONFIG` (políticas, permissões e instruções de segurança), remoção de `OPENCODE_API_KEY`, `OPENCODE_DISABLE_AUTOUPDATE` e `OPENCODE_DISABLE_CLAUDE_CODE`.

O Desktop e a interface web usam outro caminho: o **serviço compartilhado em segundo plano**, um servidor por usuário que "cuida de sessões, configuração, integrações, permissões e execução de ferramentas" (`cli/index.mdx`). O Desktop inicia esse serviço com `--service` (`packages/desktop/src/main/service/background-service.ts`). Esse serviço não recebe as variáveis do script; recebe só o que estiver nos arquivos de configuração.

## O que dá para levar ao Desktop: a configuração global

**Confirmado (documentação e código):**
- O OpenCode lê a configuração global `opencode.json(c)` em todos os clientes. O Desktop lê só `opencode.json(c)` (`build/plugins/gui/index.mdx`).
- A pasta global é `~/.config/opencode`, **também no Windows** (`C:\Users\<usuário>\.config\opencode`), a menos que `XDG_CONFIG_HOME` esteja definida (`packages/util/src/global-roots.ts`). Confira com `opencode debug paths config`.
- Políticas globais **prevalecem** sobre as de projeto: um repositório não consegue liberar de volta um provedor bloqueado globalmente (`policies.mdx`, seção *Precedence*).
- Políticas globais também prevalecem sobre a configuração que o script passa em `OPENCODE_CONFIG`: as políticas carregadas antes vencem, e a global é carregada antes (`packages/core/src/config.ts` e `config/plugin/policy.ts`).

Por isso o repositório traz [`configs/opencode.global.jsonc`](../configs/opencode.global.jsonc) com **só as proteções que não dependem do modo**:

| Proteção | No Desktop/web com a configuração global |
|---|---|
| Busca na web bloqueada | Sim |
| Buscar URLs e acessar pastas fora do projeto pedem aprovação | Sim |
| Comandos de rede (`curl`, `git push`, `Invoke-WebRequest`...) pedem aprovação | Sim |
| Leitura e edição de arquivos de segredos bloqueadas | Sim |
| Instruções de segurança entregues ao modelo | Sim |
| **Só os provedores do modo escolhido** | **Não** (ver abaixo) |
| Modelos pagos escondidos (`OPENCODE_API_KEY` removida) | Parcial: sem conta conectada e sem a variável definida, o OpenCode já mostra só os gratuitos. Não dá para *remover* uma variável pelo serviço (`opencode service set env` só acrescenta) |
| Sem consulta de atualização; versão fixa 2.2.6 | **Não**: o Desktop traz o próprio OpenCode embutido e se atualiza sozinho; o link de download é sempre o da versão mais recente |
| Skills de `~/.claude` fora do prompt | **Não** confirmado por configuração; pendente |

### Por que a configuração global não restringe provedores

Como as políticas globais vencem as do script, qualquer regra de provedor na configuração global passaria a valer também para o `iniciar`:
- Global "só `opencode`" → o modo **local** e a reserva do **misto** deixam de funcionar (o Ollama fica bloqueado).
- Global "`opencode` + `ollama`" → no modo **local** os modelos em nuvem voltam a aparecer, e a promessa "nada sai do computador" deixa de ser garantida.

Sem regra global de provedor, o `iniciar` continua restringindo cada modo como antes. No Desktop, aparecem os modelos gratuitos do OpenCode (sem conta) e os do Ollama, se ele estiver aberto. **A escolha do modelo, e portanto se o código vai para a nuvem, fica com você em `/models`.** Não há troca automática.

## Como aplicar (opcional)

### Pelo script (recomendado)

- **Onde:** PowerShell ou Git Bash (Windows) / terminal (Ubuntu). **Diretório:** a pasta deste repositório. **Administrador/sudo:** não (a pasta é do seu usuário).

```bash
node scripts/ia-local.mjs config-global            # mostra a pasta e o que já existe
node scripts/ia-local.mjs config-global aplicar    # mostra o efeito e pede confirmação
```

O comando:
- grava `opencode.jsonc` na pasta global, com uma marca de que foi gerado pelo repositório;
- **recusa** gravar se já houver um `opencode.json` ou `opencode.jsonc` seu nessa pasta (não mistura configurações; avisa também se o seu arquivo tiver regra de provedor, que bloquearia modos);
- ao atualizar a própria versão, guarda uma cópia (`opencode.jsonc.bak-<data>`);
- aponta as instruções de segurança para esta pasta do repositório. Se você mover ou apagar o repositório, rode `aplicar` de novo.

**Resultado esperado:** `Gravado: ...\.config\opencode\opencode.jsonc`. **Verificação:** `opencode debug paths config` deve mostrar a mesma pasta; depois, `opencode reload` (ou feche e abra o Desktop) e siga o roteiro em [validacao.md](validacao.md#interface-gráfica-desktop-e-web).

**Para desfazer:** `node scripts/ia-local.mjs config-global remover` (pede confirmação e só renomeia o arquivo gerado pelo repositório para `opencode.jsonc.removido-<data>`; arquivos seus nunca são tocados). Depois, `opencode reload`.

**Falhas comuns:**
- *"Já existe um arquivo seu..."*: junte à mão (abaixo) ou mova o seu arquivo para outro nome, se não precisar dele.
- A pasta mostrada pelo script é diferente da de `opencode debug paths config`: não use o comando; aplique à mão na pasta do OpenCode e registre o caso em [validacao.md](validacao.md).

### À mão (quando você já tem um arquivo de configuração global)

1. Descubra a pasta: `opencode debug paths config`.
2. Faça uma cópia de segurança do seu `opencode.json`/`opencode.jsonc` (ex.: `opencode.jsonc.bak`).
3. Junte ao seu arquivo as regras de [`configs/opencode.global.jsonc`](../configs/opencode.global.jsonc), trocando `<CAMINHO DO REPOSITÓRIO>` pela pasta deste repositório, **com barras normais** (`C:/Users/fulano/projetos/organizacao-ia-gratuita`). Não acrescente regras de provedor (`provider.use`).
4. `opencode reload` (ou feche e abra o Desktop).

Efeito colateral bom: o comando `opencode` aberto direto, sem o script, também passa a ter essas proteções.

## Proibido, em qualquer interface

- `opencode pair --remote`, `opencode service set hostname 0.0.0.0` e `opencode serve --hostname 0.0.0.0`: expõem o OpenCode à rede ou à internet (ver [seguranca.md](seguranca.md#nunca-faça), item 8).
- Conectar conta paga ou definir chaves de provedores pagos para "ter mais modelos" no Desktop.

## Decisões do mantenedor (2026-11-07)

1. **Recomendar ou não o Desktop aos colegas:** decidir **depois** da validação real (roteiro em [validacao.md](validacao.md#interface-gráfica-desktop-e-web)). Até lá, o caminho recomendado continua sendo o terminal com `iniciar`.
2. **Configuração global por comando do script:** aprovado, para evitar erros de cópia manual. Implementado em `config-global`, com confirmação, sem tocar em arquivos da pessoa e sem regra de provedor (regra 5 do [CLAUDE.md](../CLAUDE.md) ajustada).
