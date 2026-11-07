// Funções propositalmente simples para o roteiro de validação.
// A função media tem um defeito conhecido: com lista vazia retorna NaN.

export function soma(numeros) {
  return numeros.reduce((total, n) => total + n, 0);
}

export function media(numeros) {
  return soma(numeros) / numeros.length;
}

export function maior(numeros) {
  if (numeros.length === 0) return null;
  return Math.max(...numeros);
}
