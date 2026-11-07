import { test } from "node:test";
import assert from "node:assert/strict";
import { soma, media, maior } from "../src/calculadora.mjs";

test("soma", () => {
  assert.equal(soma([1, 2, 3]), 6);
  assert.equal(soma([]), 0);
});

test("media de lista com valores", () => {
  assert.equal(media([2, 4, 6]), 4);
});

test("maior", () => {
  assert.equal(maior([3, 9, 1]), 9);
  assert.equal(maior([]), null);
});

// Teste do roteiro: depois da correção pedida ao OpenCode, remova o ".skip" para confirmar.
test.skip("media de lista vazia retorna 0", () => {
  assert.equal(media([]), 0);
});
