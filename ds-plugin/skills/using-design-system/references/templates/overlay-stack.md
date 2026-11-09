---
template: OverlayStack
summary: Overlays empilhados (modal sobre sheet) sem quebrar foco, scroll nem z-index
lifecycle: built
channels: ["*"]
uses: [ds-modal, ds-bottom-sheet, BodyScrollManager]
tags: [modal, sheet, overlay, empilhar, confirmação]
---

# OverlayStack

## Use quando
- Existe mais de um overlay possível ao mesmo tempo
- Um overlay abre outro (confirmação, detalhe, erro)

## Não use quando
- Só existe um overlay no fluxo → `ds-modal` ou `ds-bottom-sheet` direto
- É tooltip/popover → `ds-popover` (não trava scroll nem foco)

## Receita
```ts
import { overlayStack } from '@ds/services';

await overlayStack.push('ds-bottom-sheet', { heading: 'Filtros' });
await overlayStack.push('ds-modal', { heading: 'Descartar filtros?' });
await overlayStack.pop(); // fecha o modal; foco volta para o sheet
```

## O que NÃO pode mudar
- z-index vem do stack (`elevation.overlay` + posição). Nunca defina z-index manual.
- Scroll: o stack chama `BodyScrollManager`. Não chame direto aqui.
- Foco: o stack faz o focus trap e devolve o foco ao overlay anterior.

## Pode variar
Conteúdo de cada overlay, `size` do modal, altura do sheet.

## Pegadinhas
- Fechar com `el.remove()` em vez de `overlayStack.pop()` deixa o scroll travado.
- No canal `web`, `ds-bottom-sheet` renderiza como `ds-modal` (ver `references/themes.md`).
