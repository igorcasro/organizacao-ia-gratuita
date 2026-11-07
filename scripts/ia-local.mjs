#!/usr/bin/env node
// Ponto de entrada único, igual no Windows 11 e no Ubuntu 24.04:
//   node scripts/ia-local.mjs            -> menu
//   node scripts/ia-local.mjs <comando>  -> comando direto (veja "ajuda")
// Requer Node.js 20 ou mais novo. Não usa pacotes externos.

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  console.error(`Este script requer Node.js 20 ou mais novo; encontrado ${process.versions.node}. Veja o manual do seu sistema em docs/.`);
  process.exit(1);
}

const { main } = await import("./lib/comandos.mjs");
await main(process.argv.slice(2));
