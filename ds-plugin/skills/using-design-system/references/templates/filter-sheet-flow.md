---
template: FilterSheetFlow
summary: Filtros múltiplos em sheet com aplicar/limpar e contador de filtros ativos
lifecycle: built
channels: ["*"]
uses: [ds-bottom-sheet, ds-chip, ds-button, OverlayStack]
tags: [filtro, filtrar, extrato, sheet, busca]
---

# FilterSheetFlow

## Use quando
Lista longa (extrato, transações, produtos) que precisa de 2+ critérios de filtro.

## Não use quando
- Um único critério → `ds-select` ou `ds-segmented` inline
- Busca textual → `ds-search`

## Receita
```html
<ds-filter-trigger count={activeCount} onClick={openFilters}></ds-filter-trigger>
```
```ts
const result = await overlayStack.push('ds-filter-sheet', {
  heading: 'Filtrar extrato',
  groups: [
    { id: 'periodo', type: 'chips', options: ['7 dias', '30 dias', '90 dias'] },
    { id: 'tipo', type: 'checkbox', options: ['Entradas', 'Saídas'] },
  ],
});
if (result.action === 'apply') applyFilters(result.values);
```

## O que NÃO pode mudar
- Rodapé fixo com `primary` "Aplicar" e `ghost` "Limpar".
- O contador no trigger reflete filtros **aplicados**, não selecionados.
