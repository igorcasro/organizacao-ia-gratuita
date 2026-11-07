# Modelos: catálogo, critérios e limitações

> Esta página trata dos **modelos locais** (Parte B dos manuais), usados como reserva no modo **misto** ou no modo **local**, que é o último recurso. Para o caminho recomendado, com modelos gratuitos em nuvem, veja [nuvem-gratuita.md](nuvem-gratuita.md).

O catálogo fica em [`catalogo/modelos.json`](../catalogo/modelos.json). Ele é **compartilhado** e pequeno de propósito: poucas opções, revisadas, para perfis diferentes de computador. Ninguém precisa baixar todas, e o script nunca faz isso.

## Catálogo atual (consultado em 2026-11-07)

| Modelo (tag do Ollama) | Perfil | Download | Contexto máx. | Capacidades declaradas | Licença |
|---|---|---|---|---|---|
| `qwen3.5:4b` | entrada | 3,3–4,0 GB | 256K | tools, thinking, vision | a confirmar |
| `qwen3.5:9b` | equilibrado | 6,6–7,6 GB | 256K | tools, thinking, vision | a confirmar |
| `gpt-oss:20b` | intermediário | 14 GB | 128K | tools, thinking | Apache-2.0 |
| `qwen3-coder:30b` (MoE, 3,3B ativos, Q4_K_M) | programação | 19 GB | 256K | tools | Apache-2.0 |

- **Capacidades declaradas** são as que a página do modelo no Ollama informa. O script confere de novo com `ollama show` depois do download, porque é isso que o OpenCode lê.
- **Faixas de download** (ex.: 6,6–7,6 GB): a página do Ollama mostra a faixa entre as variantes da tag. O script usa o valor **maior** nas estimativas, por segurança.
- **Licença "a confirmar"**: a página consultada não mostrava a licença. Depois de baixar, confira com `ollama show qwen3.5:9b --license`.
- **Nenhum modelo do catálogo está validado no fluxo do OpenCode ainda.** Ver [validacao.md](validacao.md).

## Como a recomendação funciona

Para cada modelo, o script calcula uma **estimativa** de memória:

```
memória ≈ download × 1,15  +  custo do contexto (proporcional a 64k)  +  0,5 GB
```

- `download × 1,15`: os pesos carregados ocupam um pouco mais que o arquivo baixado.
- **Custo do contexto** (`estimativa.contexto_gb_por_64k` no catálogo): memória do cache de atenção (K/V) para 65536 tokens. Depende da arquitetura do modelo, por isso cada entrada tem o seu valor e uma nota explicando a origem.
- `0,5 GB`: buffers de execução.

Depois compara com a memória **útil** do computador:

| Classe | Condição |
|---|---|
| Recomendado | estimativa ≤ 90% da VRAM dedicada |
| Possível, porém lento | estimativa ≤ 70% da RAM + 90% da VRAM (parte ou todo o modelo na CPU) |
| Não recomendado | acima disso |

E checa o disco: download + 5 GB de folga.

A ordem final depende da prioridade:

- **velocidade:** o menor modelo que cabe;
- **equilíbrio:** o maior que cabe na GPU; sem GPU, o maior com até ~9B de parâmetros ativos por token (acima disso, a CPU fica lenta demais para uso interativo);
- **qualidade:** o maior que cabe, mesmo lento.

Todas as margens estão em `REGRAS`, em [`scripts/lib/catalogo.mjs`](../scripts/lib/catalogo.mjs).

### Limitações da estimativa

- **Não é medição.** A medição real acontece em `verificar`, que carrega o modelo e lê do Ollama a memória usada, a fração na GPU e o contexto carregado.
- A memória livre real depende do que mais estiver aberto (navegador, IDE).
- **GPU integrada** (Intel, APUs AMD) não conta como VRAM: ela usa a mesma RAM do sistema, então o limite continua sendo 70% da RAM. Ela pode acelerar o processamento (via Vulkan), mas o ganho varia muito e não é estimado; `verificar` mede a fração usada.
- **AMD dedicada** é tratada como a NVIDIA na estimativa de memória. Se o modelo de placa não for suportado pelo ROCm nem tiver driver Vulkan, o Ollama roda na CPU e a classificação "recomendado" fica otimista; `verificar` mostra isso.
- Arquiteturas híbridas (Qwen3.5) e com janela deslizante (gpt-oss) gastam menos com o contexto do que modelos tradicionais. Os valores do catálogo são conservadores e aproximados.
- Velocidade (tokens por segundo) **não** é estimada. Ela varia muito com CPU, GPU e drivers.

## Por que 64k de contexto

A documentação do Ollama afirma que o OpenCode precisa de pelo menos 64000 tokens de contexto, e que o Ollama usa só 4k por padrão quando há menos de 24 GB de VRAM. O OpenCode envia instruções, definições de ferramentas e trechos de arquivos a cada pedido; com pouco contexto, a conversa perde informação logo no início.

Quando **nenhum** modelo cabe com 64k, o script oferece **32k** com um aviso: fica abaixo do recomendado, e esse modo está **pendente de validação**.

O contexto é aplicado criando um **modelo derivado** (ex.: `ia-local-qwen3.5-9b:64k`) com `PARAMETER num_ctx 65536`. Ele reaproveita os arquivos do modelo base, não altera o serviço do Ollama e é removido com `ollama rm`. Exemplo manual em [`configs/Modelfile.exemplo`](../configs/Modelfile.exemplo).

## Quando nenhum modelo cabe

O script informa isso claramente. Opções sem comprar hardware:

1. Feche programas pesados e rode `verificar` com o menor modelo (`qwen3.5:4b`): a medição pode ser melhor que a estimativa.
2. Aceite o contexto reduzido (32k), sabendo que tarefas longas ficarão piores.
3. Use o modelo pequeno só para tarefas curtas: explicar um arquivo, escrever uma função.

Se nem isso funcionar, o computador não roda uma configuração útil deste fluxo. É uma limitação do equipamento, não de configuração.

## Modelos fora do catálogo

Em `selecionar`, a opção "Outro modelo já instalado" permite usar qualquer modelo que você tenha baixado com `ollama pull`. Ele recebe o mesmo modelo derivado com contexto, mas não tem estimativa nem revisão. Faça `verificar` e `validar-fluxo` antes de usar.

## Manutenção do catálogo

### Adicionar um modelo
1. Confirme na página oficial do modelo (`https://ollama.com/library/<nome>`): tag exata, tamanho do download, contexto máximo, capacidades (precisa ter **tools**) e licença.
2. Acrescente um objeto em `modelos`, seguindo os existentes. Campos obrigatórios: `id` (minúsculas, números, ponto, hífen), `ollama_tag` (`nome:variante`, nunca `cloud`), `download_gb.max`, `estimativa.contexto_gb_por_64k`, `capacidades_declaradas`, `fontes`, `consultado_em`.
3. O que não puder confirmar fica `null` e entra em `pendencias`.
4. Explique em `estimativa.nota` de onde veio o custo do contexto.
5. Rode `node --test scripts/testes/ia-local.test.mjs`: o primeiro teste valida o catálogo.
6. Registre a fonte e a data em [fontes.md](fontes.md).

### Atualizar
Mude os campos e o `consultado_em`. Se a tag passar a apontar para outra versão dos pesos, avise no histórico do commit: quem já tem o modelo precisa de `ollama pull <tag>` e de recriar o derivado (`selecionar`).

### Remover
Apague o objeto. Quem já usa o modelo continua podendo usá-lo pela opção "Outro modelo já instalado".

### Critérios para entrar no catálogo
- Executa localmente pelo Ollama (sem `cloud`).
- Declara suporte a ferramentas (`tools`).
- Licença identificada, ou pendência registrada.
- Preenche um perfil de hardware que ainda não está bem coberto. O catálogo deve continuar pequeno (até ~6 modelos).
