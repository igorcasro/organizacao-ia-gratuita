# Uso diário

## Abrir o OpenCode num projeto

Na pasta do projeto:

```
node <repositório>/scripts/ia-local.mjs iniciar
```

ou, de qualquer lugar:

```
node <repositório>/scripts/ia-local.mjs iniciar <pasta do projeto>
```

O comando confere o modo escolhido e o OpenCode 2 e aplica as proteções de [seguranca.md](seguranca.md). Nos modos nuvem e misto, inicia o OpenCode com o modelo gratuito em nuvem. No modo local, confere o Ollama e o modelo e executa `ollama launch opencode --model <modelo>`.

**Repositório de terceiros** (clonado da internet, de um cliente, de um curso): use `iniciar --nao-confiavel`. Assim, o `opencode.json`, a pasta `.opencode/` e o `AGENTS.md` dele são ignorados, e ele não consegue afrouxar as proteções nem instalar plugins.

**Primeira vez num projeto:** o OpenCode 2 lê instruções do arquivo `AGENTS.md` na raiz do projeto (ele **não** lê `CLAUDE.md`). Vale criar um, curto, com comandos de build e teste e convenções do código. Você pode pedir ao próprio OpenCode um rascunho, mas com modelo local revise o resultado antes de confiar nele.

## Teclas úteis

| Ação | Tecla |
|---|---|
| Alternar entre `plan` e `build` | **Shift+Tab** (a interface mostra "shift+tab agents") |
| Nova linha sem enviar | **Ctrl+J**. A documentação também cita Shift+Enter, Ctrl+Enter e Alt+Enter, mas **Shift+Enter não funcionou no Windows Terminal** (2026-11-07); muitos terminais não distinguem Shift+Enter de Enter |
| Trocar de modelo | `/models` |
| Desfazer a última alteração do agente | `/undo` |
| Sair | **Ctrl+D** |

## Agentes `build` e `plan`

O OpenCode tem dois agentes principais. Para alternar: **Shift+Tab**, ou **Ctrl+X** e depois **A**, ou o comando `/agents`.

- **plan:** explora e planeja sem editar os arquivos do projeto; comandos continuam sujeitos a permissão.
- **build:** o agente padrão. Pode editar arquivos e usar ferramentas **sem pedir confirmação** por padrão; só a leitura de arquivos de ambiente sensíveis pede aprovação.

Com modelos locais, comece em **plan** para ver se o modelo entendeu a tarefa e só depois mude para **build**. Trabalhe com o projeto versionado no git, para revisar e desfazer qualquer alteração.

## Pedidos que funcionam melhor com modelos locais

- **Seja específico e curto.** "Na função `parseData` de `src/io.ts`, trate o caso de linha vazia" funciona melhor que "melhore o tratamento de erros".
- **Uma tarefa por vez.** Peça, revise, depois peça a próxima.
- **Indique arquivos**: digite `@` e escolha o arquivo para anexá-lo ao pedido, assim o modelo não precisa procurar.
- **Peça para rodar os testes** depois de alterar: "rode `npm test` e me mostre o resultado".
- **Revise sempre** com `git diff`. Para desfazer: `/undo` no OpenCode (desfaz a última resposta e os arquivos que ela alterou; exige repositório git) ou `git checkout -- <arquivo>`.

Exemplos:

```
Explique o que src/auth/token.ts faz, em tópicos curtos.
Escreva um teste para a função calcularFrete em src/frete.js cobrindo CEP inválido.
Renomeie a variável tmp para totalItens em src/carrinho.js e ajuste os usos.
Leia o erro abaixo e diga qual arquivo provavelmente causa o problema: <cole o erro>
```

## Desempenho

- A **primeira** resposta depois de iniciar demora mais: o modelo está sendo carregado na memória.
- Se `verificar` mostrou menos de 100% na GPU, as respostas serão mais lentas. É esperado.
- O Ollama descarrega o modelo após alguns minutos sem uso; a próxima resposta volta a demorar.
- Feche abas do navegador e programas pesados para liberar memória.

## Modos nuvem e misto

- **Nuvem (recomendado):** o OpenCode abre com o modelo gratuito escolhido em `modo`. Para trocar, use `/models`; aparecem só os modelos dos provedores liberados.
- **Misto:** igual ao nuvem, mas o modelo local `ollama/ia-local-...` também aparece em `/models`. Troque para ele quando a cota gratuita acabar, o modelo em nuvem sair do ar ou a tarefa envolver arquivos que não devem sair do computador. A troca vale para a sessão atual.
- Antes de abrir um projeto confidencial nesses modos, leia [seguranca.md](seguranca.md). Em caso de dúvida, use o modo `local`.

## Trocar de modelo

```
node scripts/ia-local.mjs selecionar
```

A preferência anterior fica guardada em `preferencias.json.bak`. Os modelos antigos continuam instalados até você removê-los com `ollama rm`.

## Usar o OpenCode sem o script

Se preferir chamar o OpenCode diretamente, o caminho oficial do Ollama é:

```
ollama launch opencode --model ia-local-<id>:64k
```

Nesse caso as políticas e permissões do script **não** são aplicadas. Para ter ao menos as políticas de provedor e de busca na web, copie o exemplo do seu modo — [`configs/opencode.somente-local.jsonc`](../configs/opencode.somente-local.jsonc) (local) ou [`configs/opencode.nuvem-gratuita.jsonc`](../configs/opencode.nuvem-gratuita.jsonc) (nuvem; para o misto, descomente a linha do `ollama`) — para a pasta de configuração do OpenCode (mostrada por `opencode debug paths config`). **Atenção:** na pasta global, as regras de provedor desses exemplos passam a valer também para o script e bloqueiam os outros modos. Se você usa mais de um modo, prefira `node scripts/ia-local.mjs config-global aplicar` (ver [interface-grafica.md](interface-grafica.md)). Antes, faça uma cópia de qualquer `opencode.json`/`opencode.jsonc` que já exista lá.

Para o OpenCode Desktop e a interface web, veja [interface-grafica.md](interface-grafica.md): eles não recebem as proteções do script, e a configuração global só leva parte delas.

**Não** rode `ollama launch opencode` sem o OpenCode 2 instalado: nesse caso o Ollama instala o OpenCode 1.
