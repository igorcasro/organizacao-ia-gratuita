# Projeto de validação

Projeto mínimo e **descartável** usado no roteiro de `docs/validacao.md`. Não depende de pacotes externos: só do Node.js.

Não edite esta pasta diretamente durante a validação. O comando abaixo cria uma cópia na pasta temporária, com um repositório git próprio para revisar e reverter as alterações:

```
node scripts/ia-local.mjs validar-fluxo
```

Estado inicial esperado de `npm test`: 3 testes passam e 1 é ignorado (`skipped`). A função `media` tem um defeito proposital (lista vazia retorna `NaN`) que o roteiro pede para o modelo corrigir.
