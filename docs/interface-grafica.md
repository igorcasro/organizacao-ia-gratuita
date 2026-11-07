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

## Como aplicar (opcional, manual)

Os scripts não alteram a configuração global do OpenCode (regra 5 do [CLAUDE.md](../CLAUDE.md)); a cópia é feita pela própria pessoa.

1. **Descubra a pasta** (PowerShell ou Git Bash, qualquer diretório, sem administrador): `opencode debug paths config`.
2. **Se já existir** `opencode.json` ou `opencode.jsonc` nela, faça uma cópia de segurança (ex.: `opencode.jsonc.bak`) e junte as regras à mão, em vez de substituir.
3. **Copie** [`configs/opencode.global.jsonc`](../configs/opencode.global.jsonc) para essa pasta com o nome `opencode.jsonc` e troque `<CAMINHO DO REPOSITÓRIO>` pela pasta deste repositório, **com barras normais** (`C:/Users/fulano/projetos/organizacao-ia-gratuita`).
4. **Recarregue:** `opencode reload` (ou feche e abra o Desktop).
5. **Confira:** veja o roteiro em [validacao.md](validacao.md#interface-gráfica-desktop-e-web).

Para desfazer: apague o `opencode.jsonc` copiado ou restaure a cópia de segurança, e rode `opencode reload`.

Efeito colateral bom: o comando `opencode` aberto direto, sem o script, também passa a ter essas proteções.

## Proibido, em qualquer interface

- `opencode pair --remote`, `opencode service set hostname 0.0.0.0` e `opencode serve --hostname 0.0.0.0`: expõem o OpenCode à rede ou à internet (ver [seguranca.md](seguranca.md#nunca-faça), item 8).
- Conectar conta paga ou definir chaves de provedores pagos para "ter mais modelos" no Desktop.

## Decisões pendentes do mantenedor

1. **Recomendar ou não o Desktop aos colegas** depois da validação, sabendo que ele não fixa a versão nem limita os provedores por modo.
2. **Se um comando do script deve escrever a configuração global** (com confirmação e cópia de segurança). Hoje isso contraria a regra 5 do `CLAUDE.md`; a decisão muda essa regra.
