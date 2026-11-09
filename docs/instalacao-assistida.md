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
Ritmo: <rápido: blocos da seção "Instalação rápida" do manual (recomendado) | detalhado: um passo por vez>
Objetivo: <só nuvem gratuita (Parte A) | nuvem + OpenCode Desktop no Windows (Parte A e Passo A7, recomendado) | nuvem + modelo local de reserva (Partes A e B) | só local (Parte B)>

Siga EXATAMENTE o manual do meu sistema (docs/windows-11.md ou docs/ubuntu-24.04.md)
e as regras de docs/instalacao-assistida.md. Leia também docs/seguranca.md antes de começar.
Regras principais:
1. No ritmo rápido, use os blocos da seção "Instalação rápida" do manual, exatamente como
   estão: para cada bloco, diga em 2 ou 3 linhas o que ele faz e o que vou precisar confirmar,
   espere a saída e confira o "Esperado" antes do próximo. Não divida um bloco em passos nem
   peça verificações extras se o "Esperado" bateu. Só passe ao ritmo detalhado se algo falhar.
   No ritmo detalhado, vá um passo por vez (onde executar, pasta, administrador/sudo e por
   quê, comando completo, resultado esperado) e confira a "Verificação" antes de seguir.
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

**Ritmo**
- **Rápido (recomendado):** os blocos da seção *Instalação rápida* do manual. A pessoa confirma cada bloco, não cada comando. As decisões da tabela abaixo continuam sendo dela (o próprio script pergunta).
- **Detalhado:** um passo por vez. Use quando a pessoa pedir ou quando um bloco falhar.

**Ordem**
- Siga a ordem do manual: **Parte A** (Node.js, OpenCode, repositório, `modo`, `verificar`). No Windows, o **Passo A7** (Desktop e atalho) entra se o objetivo pedir. A **Parte B** (Ollama e modelo local) só entra se o objetivo pedir. **Parte C** é manutenção.
- No Windows, use o **PowerShell** (de preferência no Windows Terminal). O OpenCode aberto pelo Git Bash teve problemas de tela (validação de 2026-11-07).
- Se Node.js ou Git já estiverem instalados (Node.js 20 ou mais novo), não reinstale: pule para o passo seguinte.
- Não pule a "Verificação" de nenhum passo. Se o resultado for diferente do esperado, pare e resolva antes de seguir.
- Instale as **versões de referência** do manual (por exemplo, `@opencode/cli@2.2.6`), não "a mais recente".

**Confirmações que pertencem à pessoa**

| Momento | O que a pessoa decide |
|---|---|
| Instalar Node.js, Git, Ollama, pacotes do sistema | Autoriza a instalação (e a elevação, quando houver) |
| `modo` | Escolhe o modo, decide liberar ou não cada provedor e **digita ela mesma** `concordo` depois de ler os avisos |
| `selecionar` (Parte B) | Escolhe o modelo e autoriza o download (4 a 19 GB) |
| `modo` (modelo padrão) | Escolhe **Automático** (recomendado: o melhor do dia que não treina com os dados) ou um modelo fixo, sabendo a classificação de privacidade |
| `verificar` no modo nuvem | Autoriza ou não o pedido de teste ao modelo em nuvem |
| `config-global aplicar` e `desktop atalho` (Passo A7) | Autoriza gravar a configuração global do OpenCode e criar o atalho na Área de Trabalho; o instalador do Desktop é executado pela pessoa |
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
| Node.js | `node --version` | `v20` ou mais novo (referência: `v24.x`) |
| OpenCode | `opencode --version` | `2.2.6` |
| Repositório | `node scripts/ia-local.mjs ajuda` | Lista de comandos |
| Modo | `node scripts/ia-local.mjs status` | `Modo: nuvem` (ou o escolhido) |
| Verificação | `node scripts/ia-local.mjs verificar` | Todos os itens `[OK]` |
| Fluxo | `node scripts/ia-local.mjs validar-fluxo` | 6 itens respondidos |
| Configuração global (A7) | `node scripts/ia-local.mjs config-global` | `opencode.jsonc: gerado por este repositório; modelo padrão: opencode/...` |
| Desktop (A7) | Abrir pelo atalho **OpenCode (gratuito)** e pedir `Execute o comando: curl.exe -sS https://example.com` | O OpenCode pede aprovação (rejeitar) |
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
