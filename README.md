# organizacao-ia-gratuita

Assistência de IA para programação **sem assinatura, sem cartão e sem API paga**, usando o **[OpenCode](https://opencode.ai)**, um assistente de programação no terminal que lê o projeto, edita arquivos e executa comandos.

Os modelos podem vir de três modos, nesta ordem de preferência:

| Modo | Modelos | Precisa de | Quando usar |
|---|---|---|---|
| **nuvem** (recomendado) | Gratuitos em nuvem (modelos gratuitos do OpenCode; OpenRouter `:free` opcional) | Internet | Dia a dia, em projetos sem restrição de confidencialidade |
| **misto** | Nuvem gratuita como padrão + modelo local como reserva | Internet + [Ollama](https://ollama.com) com um modelo baixado | Para quando a cota gratuita acabar ou a internet cair |
| **local** (último recurso) | Só local, pelo Ollama | Ollama, 4 a 19 GB de download e hardware adequado | Código confidencial, sem internet |

Funciona no **Windows 11** e no **Ubuntu 24.04**. Para o modelo local, o repositório também **diagnostica o computador**, **recomenda um modelo** e **baixa com confirmação**.

> **Expectativa realista.** Modelos gratuitos e locais não equivalem aos serviços pagos (Claude, Codex). Os gratuitos em nuvem são "por tempo limitado", podem mudar sem aviso e **enviam o seu código ao provedor**; alguns podem usar os dados para treino. Os locais são menores e mais lentos, e usam disco, memória e energia. Leia [docs/seguranca.md](docs/seguranca.md) antes de usar em projetos reais.

## Requisitos

| Item | Modo nuvem | Modos misto e local |
|---|---|---|
| Sistema | Windows 11 (x64) ou Ubuntu 24.04 (x64) | igual |
| Node.js | 20 ou mais novo (recomendado 24 LTS) | igual |
| OpenCode | 2.2.6 | igual |
| Internet | Sim | Só para o misto |
| RAM | Qualquer | 16 GB para uso útil (com 8 GB nenhum modelo do catálogo cabe com o contexto necessário, segundo a estimativa) |
| GPU | Não precisa | Opcional: NVIDIA (CUDA), AMD (ROCm ou Vulkan), Intel e integradas (Vulkan) |
| Disco | Algumas centenas de MB | Mais 4 a 19 GB por modelo |

Versões de referência (consultadas em 2026-11-07): **OpenCode 2.2.6**, **Node.js 24 LTS** e, para o modelo local, **Ollama 0.40.15**.

**Situação dos testes:** a Parte A (modo nuvem), o OpenCode Desktop e o atalho foram **testados no Windows 11** em 2026-11-07 e 08. O **Ubuntu 24.04** e a Parte B (modelo local) **ainda não foram testados** num computador real. Detalhes em [docs/validacao.md](docs/validacao.md).

## Início rápido

1. Siga a **Parte A** do manual do seu sistema (Node.js, OpenCode e este repositório):
   [Windows 11](docs/windows-11.md) · [Ubuntu 24.04](docs/ubuntu-24.04.md)
2. Na pasta deste repositório (comando igual nos dois sistemas):

   ```
   node scripts/ia-local.mjs modo        # Enter = nuvem; leia os avisos e digite "concordo"
   node scripts/ia-local.mjs verificar
   ```

3. No dia a dia, dentro da pasta do seu projeto:

   ```
   node <caminho do repositório>/scripts/ia-local.mjs iniciar
   ```

4. **Windows, recomendado para o modo nuvem:** use o OpenCode Desktop (janela própria) pelo atalho **OpenCode (gratuito)**, que mantém as proteções e o modelo do dia atualizados. Passo A7 do [manual do Windows](docs/windows-11.md).
5. **Opcional:** para ter um modelo local (modos misto ou local), siga a **Parte B** do manual.

**Atualizar** (de tempos em tempos; correções de segurança e do catálogo de modelos chegam assim): dentro do OpenCode, digite **`/atualizar-ia`**, ou, no terminal, `node scripts/ia-local.mjs atualizar`. Os dois fazem `git pull` neste repositório e atualizam a configuração global. Nada é atualizado sem você pedir.

Menu completo: `node scripts/ia-local.mjs`. Ajuda: `node scripts/ia-local.mjs ajuda`.
**Instalação assistida por IA:** [docs/instalacao-assistida.md](docs/instalacao-assistida.md).

## Ordem de leitura

1. Manual do seu sistema: [Windows 11](docs/windows-11.md) ou [Ubuntu 24.04](docs/ubuntu-24.04.md)
2. [docs/seguranca.md](docs/seguranca.md) — que dados saem do computador e o que nunca fazer
3. [docs/nuvem-gratuita.md](docs/nuvem-gratuita.md) — modos nuvem e misto: modelos, privacidade e limites
4. [docs/modelos.md](docs/modelos.md) — modelos locais: catálogo, critérios e limitações das estimativas
5. [docs/uso-diario.md](docs/uso-diario.md) — como trabalhar em projetos existentes
6. [docs/problemas.md](docs/problemas.md) — diagnóstico de falhas, atualização, recuperação e desinstalação
7. [docs/validacao.md](docs/validacao.md) — o que foi testado, o que só foi confirmado em documentação e o que está pendente
8. [docs/interface-grafica.md](docs/interface-grafica.md) — OpenCode Desktop e interface web: o que funciona, o que não, e como aplicar as proteções
9. [docs/arquitetura.md](docs/arquitetura.md) — como as peças se encaixam (para quem vai manter o repositório)
10. [docs/fontes.md](docs/fontes.md) — referências oficiais e datas de consulta

## O que fica no repositório e o que fica no seu computador

| No repositório (compartilhado) | Só no seu computador (nunca versionado) |
|---|---|
| Catálogo de modelos (`catalogo/modelos.json`) | Diagnóstico do hardware |
| Scripts (`scripts/`) | Preferências: modelo escolhido, perfil de uso, resultados de validação |
| Configurações de exemplo (`configs/`) | Arquivos dos modelos (pasta do Ollama) |
| Documentação e projeto de validação | Configurações pessoais do OpenCode, logs, credenciais |

Os arquivos locais ficam em `%APPDATA%\ia-local` (Windows) ou `~/.config/ia-local` (Ubuntu). O comando `status` mostra os caminhos.

## Privacidade e custo

- **Nada pago.** Só entram provedores gratuitos, sem cartão nem créditos. Modelos `:cloud` do Ollama (pagos) são recusados.
- **Só os provedores do modo escolhido.** Ao iniciar, o script passa ao OpenCode políticas que bloqueiam todos os outros provedores e a busca na web, e remove `OPENCODE_API_KEY` do ambiente para que modelos pagos não apareçam.
- **Nenhuma troca automática** entre nuvem e local.
- **Nos modos nuvem e misto, o código vai para o provedor do modelo.** Os detalhes do que sai do computador, inclusive tráfego que não é de modelo, estão em [docs/seguranca.md](docs/seguranca.md).
- O Ollama fica acessível **somente neste computador** (`127.0.0.1:11434`).

## Licença

[MIT](LICENSE): use, copie, modifique e redistribua à vontade, mantendo o aviso de licença. O OpenCode, o Ollama e os modelos têm licenças próprias; veja [docs/modelos.md](docs/modelos.md).
