# Instalação assistida por IA

Este guia serve para pedir a um assistente de IA (Claude, ChatGPT ou outro) que conduza a instalação passo a passo, ajudando quando algo der errado. Funciona de dois jeitos:

- **A IA orienta e você executa:** num chat comum, você cola as saídas dos comandos.
- **A IA executa:** num agente com acesso ao terminal. Mesmo assim, as confirmações marcadas abaixo continuam sendo **suas**.

## Texto para colar no assistente

Copie o bloco abaixo e substitua os valores entre `< >`.

```text
Você vai me conduzir na instalação do repositório "organizacao-ia-gratuita"
(https://github.com/igorcasro/organizacao-ia-gratuita) no meu computador.

Meu sistema: <Windows 11 | Ubuntu 24.04>
Quem executa os comandos: <eu, e colo as saídas | você, pelo terminal>
Objetivo: <só nuvem gratuita (Parte A) | nuvem + modelo local de reserva (Partes A e B) | só local (Parte B)>

Siga EXATAMENTE o manual do meu sistema (docs/windows-11.md ou docs/ubuntu-24.04.md)
e as regras de docs/instalacao-assistida.md. Leia também docs/seguranca.md antes de começar.
Regras principais:
1. Um passo por vez. Para cada passo, diga onde executar, a pasta, se precisa de
   administrador/sudo e por quê, o comando completo e o resultado esperado. Depois espere
   a saída e confira o item "Verificação" antes de seguir.
2. Não invente comandos. Se algo não estiver no manual, diga isso e pergunte antes.
   Em caso de erro, consulte docs/problemas.md primeiro.
3. Peça minha confirmação antes de instalar programas, usar sudo/administrador, alterar
   serviços ou variáveis de ambiente, e antes de qualquer download de modelo.
4. Nunca digite por mim a confirmação "concordo" do comando "modo", nunca escolha por mim
   liberar o OpenRouter e nunca peça, leia ou escreva chaves de API, senhas ou tokens.
5. Não conecte contas, não cadastre cartão e não use nada pago.
6. Ao final, preencha o relatório da seção "Relatório final" de docs/instalacao-assistida.md,
   sem dados pessoais (nome de usuário, caminhos completos, números de série).
```

## Regras para o assistente

**Ordem**
- Siga a ordem do manual: **Parte A** (Node.js, OpenCode, repositório, `modo`, `verificar`). A **Parte B** (Ollama e modelo local) só entra se o objetivo pedir. **Parte C** é manutenção.
- Não pule a "Verificação" de nenhum passo. Se o resultado for diferente do esperado, pare e resolva antes de seguir.
- Instale as **versões de referência** do manual (por exemplo, `@opencode/cli@2.2.6`), não "a mais recente".

**Confirmações que pertencem à pessoa**

| Momento | O que a pessoa decide |
|---|---|
| Instalar Node.js, Git, Ollama, pacotes do sistema | Autoriza a instalação (e a elevação, quando houver) |
| `modo` | Escolhe o modo, decide liberar ou não cada provedor e **digita ela mesma** `concordo` depois de ler os avisos |
| `selecionar` (Parte B) | Escolhe o modelo e autoriza o download (4 a 19 GB) |
| `verificar` no modo nuvem | Autoriza ou não o pedido de teste ao modelo em nuvem |
| Variáveis de ambiente (`OLLAMA_NO_CLOUD`, `OPENROUTER_API_KEY`) | Decide se define. **A chave do OpenRouter é digitada só pela pessoa** |

**Proibido ao assistente**
- Pedir, ler, repetir ou gravar chaves, senhas ou tokens.
- Sugerir `sudo npm`, executar o OpenCode como administrador, expor o Ollama ou o OpenCode à rede, desativar as proteções do script ou usar `--auto` / `--dangerously-skip-permissions` fora do projeto de validação.
- Usar comandos de desinstalação ou que apaguem arquivos sem pedido explícito.
- Sugerir compra de hardware, assinatura ou créditos.
- Todos os itens de "Nunca faça" em [seguranca.md](seguranca.md).

**Quando algo falhar**
1. Leia a mensagem completa. Os scripts mostram `ERRO:` seguido de `Como resolver:`.
2. Procure o sintoma em [problemas.md](problemas.md).
3. Se a solução não estiver documentada, explique o que sabe, proponha o próximo diagnóstico (comando de leitura, sem alterar nada) e peça autorização.
4. Registre a falha e a solução no relatório, para o repositório ser corrigido.

## Pontos de verificação

| Ponto | Comando | Esperado |
|---|---|---|
| Node.js | `node --version` | `v24.x` (mínimo `v20`) |
| OpenCode | `opencode --version` | `2.2.6` |
| Repositório | `node scripts/ia-local.mjs ajuda` | Lista de comandos |
| Modo | `node scripts/ia-local.mjs status` | `Modo: nuvem` (ou o escolhido) |
| Verificação | `node scripts/ia-local.mjs verificar` | Todos os itens `[OK]` |
| Fluxo | `node scripts/ia-local.mjs validar-fluxo` | 6 itens respondidos |
| Ollama (Parte B) | `ollama --version` e `curl http://127.0.0.1:11434/api/version` (Windows: `Invoke-RestMethod http://127.0.0.1:11434/api/version`) | `0.40.15` |
| Modelo local (Parte B) | `node scripts/ia-local.mjs verificar --local` | Contexto carregado ≥ 65536 |

No Windows, use `scripts\ia-local.mjs` (barra invertida) se preferir; os dois formatos funcionam no PowerShell.

## Relatório final

O assistente preenche este modelo ao terminar. A pessoa pode acrescentar o resultado em [validacao.md](validacao.md), na tabela "Registro de validações".

```text
Data:
Sistema e versão (ex.: Windows 11 23H2 / Ubuntu 24.04.1):
CPU / RAM / GPU (VRAM), só se a Parte B foi feita:
Versões: Node.js / OpenCode / Ollama:
Modo final: nuvem | misto | local
Modelo em nuvem padrão:
Modelo local (se houver) e medição do 'verificar --local' (memória, % GPU, contexto):
Resultado do 'verificar':
Resultado do 'validar-fluxo' (6 itens):
Passos que falharam e como foram resolvidos:
Divergências entre o manual e o que aconteceu (para corrigir o repositório):
```
