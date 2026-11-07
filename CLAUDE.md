# Orientações para manutenção deste repositório

Este arquivo orienta quem (pessoa ou assistente de IA) for manter o repositório. O OpenCode 2 não lê `CLAUDE.md`; por isso o `AGENTS.md` da raiz aponta para cá.

## Objetivo

Permitir que pessoas diferentes, em computadores diferentes (Windows 11 ou Ubuntu 24.04), usem o **OpenCode 2** com **modelos gratuitos** — em nuvem (prioridade) ou locais pelo **Ollama** (último recurso) — sem assinatura, cartão nem API paga. O repositório **não** recria o OpenCode nem o Ollama: só diagnostica, orienta a escolha do modelo, prepara a configuração e inicia.

## Regras que não podem ser quebradas

1. **Só gratuito; nuvem gratuita primeiro, local como último recurso.** Ordem de preferência decidida pelo mantenedor em 2026-11-07: `nuvem` (modelos **gratuitos**, sem cartão nem créditos, listados em `catalogo/nuvem-gratuita.json`) → `misto` (nuvem + reserva local) → `local`. Nenhum modo vem ativado; os modos com nuvem exigem consentimento registrado pelo comando `modo`. Nunca configurar provedor pago, nunca trocar automaticamente entre nuvem e local, nunca relaxar as políticas de `opencode.policyConfig()` e manter a recusa dos modelos `*cloud` do Ollama (pagos). Siga também as regras de [docs/seguranca.md](docs/seguranca.md).
2. **Ollama não é exposto à rede.** Não definir `OLLAMA_HOST=0.0.0.0` em nenhum script ou manual como passo padrão.
3. **Nada pessoal no repositório.** Preferências, diagnósticos, caminhos particulares, logs, credenciais e modelos ficam fora (ver `.gitignore` e `scripts/lib/util.mjs → localDir()`).
4. **Confirmação antes de baixar.** Nenhum download de modelo sem confirmação explícita. Nunca baixar o catálogo inteiro.
5. **Não alterar o sistema sem pedido.** Scripts não instalam programas, não alteram serviços e não editam configurações globais do OpenCode. A janela de contexto é ajustada com um modelo derivado (`ollama create`), não com variáveis de serviço.
6. **Não inventar.** Comandos, opções, requisitos e resultados precisam de fonte oficial (registre em `docs/fontes.md` com data) ou ficam marcados como pendência.
7. **Diferenciar estados.** Instalado ≠ verificado tecnicamente ≠ validado no fluxo de programação. Estimativa ≠ medição. Confirmado em documentação ≠ testado.

## Estrutura

- `scripts/ia-local.mjs` — ponto de entrada (Node.js ≥ 20, sem dependências externas).
- `scripts/lib/` — módulos: `nuvem` (modos e catálogo de nuvem gratuita), `diagnostico`, `gpu` (NVIDIA/AMD/Intel, dedicada × integrada), `catalogo` (regras de recomendação), `ollama` (API HTTP + CLI), `opencode`, `preferencias`, `comandos` (menu), `util`.
- `scripts/testes/` — testes com Ollama e OpenCode simulados. Executar: `node --test scripts/testes/ia-local.test.mjs` (ou `npm test`).
- `catalogo/modelos.json` — modelos locais (validado por `catalogo.validate`); `catalogo/nuvem-gratuita.json` — provedores e modelos gratuitos em nuvem (validado por `nuvem.validate`).
- `configs/instrucoes-seguranca.md` — regras de segurança entregues ao modelo em toda sessão; mudanças nele afetam todos os usuários.
- `configs/` — exemplos; nunca são aplicados automaticamente. `configs/opencode.global.jsonc` leva as proteções independentes de modo ao Desktop e à interface web e **não pode ter regra de provedor** (políticas globais vencem as do script; ver docs/interface-grafica.md). Se mudar `securityPermissions()`, atualize-o (o teste avisa).
- `exemplos/projeto-validacao/` — projeto descartável do roteiro de validação.
- `docs/` — manuais e referências.

## Decisões técnicas (resumo; detalhes em docs/arquitetura.md)

- **Uma só implementação em Node.js** para Windows e Ubuntu, evitando duplicar regras em PowerShell e Bash. O Node.js já é necessário para instalar o OpenCode pelo npm nos dois sistemas.
- **OpenCode 2** (`@opencode/cli`). Configurações em formato nativo V2 (`providers`, `policies`). Não misturar com exemplos do V1 (`provider`, `npm`), que ainda aparecem em documentações de terceiros, inclusive na página de integração do Ollama.
- **Início:** modos nuvem e misto com `opencode --standalone` e a configuração gerada em `OPENCODE_CONFIG`; modo local com `ollama launch opencode --model <modelo>`, a integração oficial do Ollama. Antes disso, o script exige o OpenCode 2 instalado: sem ele, o `ollama launch` instalaria o OpenCode 1 por conta própria.
- **Contexto de 64k** por modelo derivado com `PARAMETER num_ctx`, conforme a documentação do Ollama para clientes compatíveis com a API OpenAI.

## Ao alterar

- Atualize `docs/validacao.md` (versões, datas, o que foi ou não testado) e `docs/fontes.md`.
- Ao mudar versões de referência, revise os comandos fixados nos manuais (`@opencode/cli@X`, `OLLAMA_VERSION=X`) e confira se o formato de configuração não mudou.
- Rode os testes antes de entregar.
- Escreva em português do Brasil.
