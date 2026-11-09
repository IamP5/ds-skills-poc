---
component: ds-quebrado
summary: CRD propositalmente inválido, usado pelos testes do parser
lifecycle: pronto
---

# ds-quebrado — Component Requirements Document

## Anatomia
- `rotulo`: texto do componente (slot default)

## Requisitos
### F · Funcional
- F1 Faz alguma coisa com o `rotulo`.
- F1 Outra coisa com o mesmo ID.
- S2 Requisito de estado escrito sob a categoria funcional.
- F3 [open] [review] Aberto e em revisão ao mesmo tempo.

## Descartado
- Prop `cor` livre sem dizer por quê

## Decisões
- 2026-13-40 · decisão com data impossível · @time-ds

## Changelog
- algo que não é seção do CRD

## Exemplos
### Faça
```html
<!-- viola: F1 -->
<ds-quebrado>Exemplo bom com linha de violação</ds-quebrado>
```
