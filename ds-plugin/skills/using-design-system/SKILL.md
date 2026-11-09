---
name: using-design-system
description: Orienta a criação, alteração e revisão de UI com o Design System (componentes, templates, services, tokens semânticos, temas por canal, ícones e ilustrações). Use quando a tarefa envolver telas, fluxos, componentes web (ds-*), estilos, cores, espaçamentos, temas/canais ou assets visuais.
---

# Usando o Design System

Roteador. Não descreve componentes: diz onde olhar e em que ordem.
Todos os caminhos são relativos à pasta desta skill.

## 1. Descubra o que existe (sem ler arquivos grandes)

Use o MCP `design-system` se estiver disponível; senão, rode o script equivalente.

| Pergunta | MCP | Script |
|---|---|---|
| O que existe desse tipo? | `design-system:ds_list` | `node scripts/list.ts <components\|templates\|services>` |
| Qual item/asset serve para X? | `design-system:ds_find` | `node scripts/find.ts "<intenção>" [--type=icon]` |
| Como usar um item (requisitos, fora de escopo, exemplos, API) | `design-system:ds_get_component` | `node scripts/component.ts <nome>` |
| Esse trecho está certo? | `design-system:ds_validate` | `node scripts/check.ts --stdin --file=<nome.html>` |
| Valor de um token num contexto | `design-system:ds_resolve_token` | `node scripts/resolve-token.ts <token> --theme=<t> --channel=<c>` |
| Contraste entre dois tokens | `design-system:ds_check_contrast` | `node scripts/check-contrast.ts <texto> <fundo> --theme=all` |

`list` mostra nome, resumo, lifecycle, canais e prontidão. **Só use itens com lifecycle `built`.**
`incompleto (...)` quer dizer que o doc do item tem lacunas: use, mas confira o que falta no `ds_get_component`.

## 2. Leia só o item escolhido

`ds_get_component` devolve a versão curta do CRD: requisitos com ID (`F1`, `A2`…), *Fora de escopo* com o
componente dono, *Descartado* com o motivo, exemplos de faça/não faça e a API. Peça `format: detailed` só se precisar
do texto inteiro. Para assuntos transversais:

| Assunto | Doc |
|---|---|
| Tokens semânticos (nomes e intenção) | [references/tokens.md](references/tokens.md) |
| Temas e canais | [references/themes.md](references/themes.md) |
| Classes utilitárias | [references/utilities.md](references/utilities.md) |
| Erros que agentes repetem com este DS | [references/failure-modes.md](references/failure-modes.md) |

## 3. Ordem de decisão ao montar UI

1. Existe **template** para essa tela/fluxo? Comece por ele.
2. Senão, componha com **componentes** `built`. Confira *Fora de escopo*: se o caso é de outro componente, use o dono.
3. Comportamento transversal (scroll, overlay, loading, async)? Use o **service**.
4. Nada serve? Diga isso explicitamente, como **gap do DS**, antes de criar algo novo.

Gap não bloqueia a entrega: se pediram a tela ou o arquivo, entregue com o que existe (itens `built`, HTML nativo
acessível estilizado com tokens semânticos) e liste os gaps no fim. Nunca invente um `ds-*` para tapar o gap.
Só pare antes de entregar se esbarrar numa decisão `[open]` (abaixo).

## 4. Valide antes de escrever

Passe o trecho por `ds_validate` (com `theme`/`channel` se souber o contexto) antes de gravar o arquivo e corrija o
que ele apontar. No Claude Code o hook roda o mesmo validador a cada edição e não deixa terminar com erro aberto.
Escape só com motivo: `<!-- ds-ignore <regra> -- <motivo> -->` na linha de cima.

## Decisões em aberto

Se `ds_get_component` mostrar `PARE: <ID> está [open]`, não decida no lugar do time: diga que essa parte ainda não
está definida, cite o ID e siga só com o que não depende dela.

## Hierarquia de verdade

1. Código do DS (`data/catalog.json` e `data/tokens/` são gerados dele) — vence sempre
2. CRDs e docs em `references/` — intenção e regras de uso
3. Figma (`figma:get_design_context`) — referência visual, não fonte de props nem de tokens

## Regras inegociáveis

O `ds_validate` checa todas; [failure-modes.md](references/failure-modes.md) explica cada uma.
- Nunca use valor cru (hex, rgb, px de espaçamento) nem token primitivo. Só token semântico.
- Nunca use item `deprecated`: use o `replacement`.
- Nunca ramifique por tema/canal (`if (theme === 'pj')`). Contexto é resolvido em runtime via `[data-theme]` e `[data-channel]`.
- Nunca mexa em `document.body.style.overflow` nem empilhe overlays na mão: `BodyScrollManager` / `OverlayStack`.
- Não invente prop, valor, slot, token, ícone ou componente. Se não existe, é gap do DS.
