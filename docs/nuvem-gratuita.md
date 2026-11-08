# Modos de uso: nuvem gratuita, misto e local

O repositório oferece três modos, nesta ordem de preferência: **nuvem gratuita** (recomendado), **misto** e **local** (último recurso). Nenhum vem ativado: na primeira vez, escolha o modo com o comando abaixo. Os modos com nuvem pedem confirmação explícita.

```
node scripts/ia-local.mjs modo
```

| Modo | Modelo padrão | Precisa do Ollama e de download? | O código sai do computador? |
|---|---|---|---|
| **nuvem** (recomendado) | Modelo gratuito em nuvem | **Não** | Sim |
| **misto** | Modelo gratuito em nuvem; o local fica como **reserva** em `/models` | Sim, para a reserva | Sim, exceto quando você troca para o modelo local |
| **local** (último recurso) | Modelo do Ollama | Sim | Não |

Quando usar cada um:
- **nuvem:** o dia a dia, em projetos sem restrição de confidencialidade.
- **misto:** como o nuvem, mas com um modelo local pronto para quando a cota gratuita acabar, um modelo sair do ar ou a internet cair.
- **local:** código confidencial, de clientes ou com segredos; trabalho sem internet.

**Não há troca automática** entre nuvem e local. A troca é sempre sua: `/models` dentro do OpenCode, ou o comando `modo`. No modo misto, se o Ollama estiver fora do ar, a sessão começa normalmente na nuvem, com um aviso de que a reserva local não aparecerá.

## Por que considerar a nuvem gratuita

- **Não precisa baixar modelos** (4 a 19 GB) nem de hardware com muita memória.
- Os modelos gratuitos em nuvem costumam ser **bem maiores** que os que cabem num computador comum, então tendem a responder melhor e mais rápido.

## O que você aceita ao usar a nuvem

O script mostra estes avisos e pede que você digite `concordo` antes de salvar o modo:

- O OpenCode envia ao provedor os seus pedidos, os arquivos do projeto que ele ler e as saídas dos comandos executados.
- Alguns modelos gratuitos **podem usar os dados para treinar** modelos (veja a tabela abaixo).
- Os modelos são gratuitos **"por tempo limitado"**: podem sumir ou mudar sem aviso, e não há limite de uso garantido.
- Não use em código confidencial, de clientes ou com segredos (senhas, chaves, dados pessoais) sem autorização de quem é responsável por eles.

Quando os avisos mudarem, o consentimento é pedido de novo (`VERSAO_CONSENTIMENTO` em `scripts/lib/nuvem.mjs`).

## Opções incluídas (consultadas em 2026-11-08)

O catálogo fica em [`catalogo/nuvem-gratuita.json`](../catalogo/nuvem-gratuita.json). Só entram opções **sem cartão, sem créditos e sem assinatura**.

### 1. Modelos gratuitos do OpenCode (recomendado)

- **Conta:** não. **Chave:** não. **Custo:** zero.
- **Como funciona:** sem conta e sem `OPENCODE_API_KEY`, o OpenCode 2 habilita só os modelos sem preço do provedor `opencode`. Os pagos ficam desabilitados (confirmado no código-fonte da versão 2.2.6). Para garantir isso, o script **remove `OPENCODE_API_KEY`** do ambiente do OpenCode.
- **Limites:** não publicados.

| Modelo (`opencode/...`) | Privacidade, segundo a documentação do OpenCode (2026-11-08) |
|---|---|
| `deepseek-v4.1-flash-free` | Retenção zero; não treina com os dados. **Validado no fluxo** (Windows 11, 2026-11-07) |
| `glm-5.3-flash-free` | Retenção zero; não treina com os dados |
| `beam-free` | Não treina; guarda por 30 dias por segurança |
| `crouton-alpha-free` | Não treina; guarda por 30 dias (origem não divulgada) |
| `big-pickle` | **Pode usar os dados** para melhorar o modelo (origem não divulgada) |
| `iceman-free` | **Guarda e usa os dados** para melhorar o modelo (origem não divulgada) |
| `inkling-2-small-free` | **Guarda os dados e pode usá-los para treino** (Thinking Machines) |
| `flint-40b-free` | **Pode usar os dados**; guarda por 30 dias |
| `mimo-v2.6-flash-free` | **Pode usar os dados** |
| `nemotron-3.5-lightning-free`, `nemotron-3.5-super-vl-free`, `nemotron-3-ultra-free` | Termos de teste da NVIDIA: uso registrado; **não envie dados pessoais ou confidenciais** |

Saiu da lista: `pulse-alpha-free` (descontinuado em 2026-11-06).

### Modelo padrão automático (recomendado)

Não existe uma avaliação oficial, atualizada a cada dia, dos modelos gratuitos. Por isso o **modelo automático** funciona assim, a cada `iniciar` e `verificar`:

1. Consulta a lista **de hoje** com `opencode models` (não envia pedido a nenhum modelo).
2. Considera só os modelos marcados como **não treina** no catálogo. Modelos novos, ainda sem classificação, **nunca** são escolhidos automaticamente; o script só avisa que eles existem.
3. Prefere os que você já **validou no fluxo** neste computador (`validar-fluxo`).
4. Depois, segue a ordem do catálogo, que é a avaliação do mantenedor (campo `criterio_ordem`): validado no roteiro → retenção zero → origem divulgada.

Se o modelo que você fixou sumir da lista, o script avisa e usa o automático (que só escolhe modelos que não treinam). Nunca troca para o modo local.

Para usar: rode `modo` e escolha a opção **Automático** (a primeira). Sem o script (Desktop, interface web ou `opencode` puro), o modelo padrão vem do `config-global aplicar`, que grava o melhor do dia; rode-o de novo quando o `iniciar` avisar que mudou. Sem isso, o OpenCode abriu com o **Big Pickle**, que pode treinar com os dados (observado em 2026-11-08).

**Ainda não sabemos quais desses modelos funcionam bem como agente de programação** (ferramentas, edição de arquivos). Isso depende de validação (`validar-fluxo`).

### 2. OpenRouter, somente variantes `:free` (opcional)

- **Conta:** sim. **Chave:** sim (`OPENROUTER_API_KEY`). **Custo:** zero nas variantes `:free`.
- **Limites:** 20 pedidos por minuto e **50 por dia** sem créditos comprados. Um agente faz vários pedidos por tarefa (um por passo), então o limite diário acaba rápido.
- **Não compre créditos.** Sem saldo, escolher um modelo pago por engano gera erro em vez de cobrança.
- Modelo incluído: `openrouter/openrouter/free`, o roteador do OpenRouter que escolhe **só entre modelos gratuitos**.
- **Privacidade: pendente.** A documentação consultada não informa como os provedores dos modelos gratuitos tratam os dados.

**Definir a chave** (o script nunca grava a chave em arquivos dele):

| Windows (PowerShell, sem administrador) | Ubuntu (Bash) |
|---|---|
| `[Environment]::SetEnvironmentVariable("OPENROUTER_API_KEY", "<sua chave>", "User")` e reabra o terminal | Acrescente `export OPENROUTER_API_KEY="<sua chave>"` ao `~/.bashrc` e rode `source ~/.bashrc` |

A chave fica em texto simples nas variáveis do seu usuário (Windows) ou no `~/.bashrc` (Ubuntu). Não a coloque no repositório. Para remover: `[Environment]::SetEnvironmentVariable("OPENROUTER_API_KEY", $null, "User")` ou apague a linha do `~/.bashrc`.

### Avaliadas e não incluídas

- **Nuvem do Ollama (modelos `:cloud`):** em 2026-11-07 a página de preços do Ollama não oferece plano gratuito, só pagamento por uso e assinaturas. O script continua recusando modelos `:cloud`.

## Passo a passo

1. **OpenCode 2 instalado** (manual do seu sistema, passo do OpenCode). No modo `nuvem`, você pode **pular** as etapas do Ollama e da escolha de modelo local.
2. `node scripts/ia-local.mjs modo` → escolha `nuvem` (Enter) ou `misto` → libere os provedores → leia os avisos → digite `concordo` → escolha o modelo padrão em nuvem.
3. `node scripts/ia-local.mjs verificar`. No modo nuvem, ele:
   - lista os modelos com `opencode models` (não envia nada a modelos) e confere que **só os provedores liberados aparecem**;
   - pergunta se pode enviar um pedido curto de teste ("Responda somente com a palavra OK").
4. `node scripts/ia-local.mjs validar-fluxo` com o projeto descartável.
5. Uso diário: `node <repositório>/scripts/ia-local.mjs iniciar` na pasta do projeto.

No modo **misto**, o OpenCode abre com o modelo gratuito em nuvem. Para usar a reserva local numa conversa (por exemplo, para um arquivo confidencial), rode `/models` e escolha `ollama/ia-local-...`. A troca vale para a sessão atual. A reserva é preparada na Parte B do manual do seu sistema; verifique-a com `verificar --local`.

Para usar só modelos locais: `modo` → `local`.

## Como o script limita os provedores

Ao iniciar, o script grava `opencode-politicas.json` na pasta local e o passa ao OpenCode pela variável `OPENCODE_CONFIG`, com políticas no formato do OpenCode 2:

```json
{ "policies": [
  { "action": "provider.use", "resource": "*", "effect": "deny" },
  { "action": "provider.use", "resource": "ollama", "effect": "allow" },
  { "action": "provider.use", "resource": "opencode", "effect": "allow" },
  { "action": "websearch.use", "resource": "*", "effect": "deny" }
] }
```

Só aparecem as linhas `allow` do modo escolhido. Além disso:

| Modo | Como o OpenCode é iniciado | `OPENCODE_DISABLE_FREE_MODELS` | `OPENCODE_API_KEY` |
|---|---|---|---|
| local | `ollama launch opencode --model <local>` | `1` (oculta os gratuitos em nuvem) | removida |
| misto | `opencode --standalone`; o OpenCode descobre o Ollama sozinho e o script informa o contexto real da reserva (`providers.ollama.models.<modelo>.limit`) | não definida | removida |
| nuvem | `opencode --standalone` (servidor privado, para as variáveis valerem) | não definida | removida |

Em todos os modos, o script também aplica as proteções de [seguranca.md](seguranca.md): permissões que pedem aprovação para acessar a rede, bloqueio de arquivos de segredos, instruções de segurança ao modelo, `OPENCODE_DISABLE_AUTOUPDATE=1` e `OPENCODE_DISABLE_CLAUDE_CODE=1`.

Exemplo para quem quiser usar o OpenCode sem o script: [`configs/opencode.nuvem-gratuita.jsonc`](../configs/opencode.nuvem-gratuita.jsonc).

## Situação dos testes

- **Testado com simuladores** (2026-11-07): escolha do modo, exigência de `concordo`, provedores liberados por modo, início no modo nuvem sem Ollama, remoção de `OPENCODE_API_KEY`, modo misto iniciando na nuvem com a reserva local e o contexto dela, modo misto com o Ollama fora do ar (começa na nuvem, sem a reserva), início bloqueado enquanto nenhum modo foi escolhido.
- **Pendente com o OpenCode e a internet reais:**
  - se as políticas realmente escondem os outros provedores;
  - se os modelos gratuitos aparecem sem conta;
  - se uma conta do OpenCode já conectada (`/connect`) faz modelos pagos aparecerem mesmo sem `OPENCODE_API_KEY`;
  - o formato da saída de `opencode models`;
  - o desempenho de cada modelo gratuito no fluxo de programação;
  - a privacidade dos modelos gratuitos do OpenRouter.

Veja [validacao.md](validacao.md).
