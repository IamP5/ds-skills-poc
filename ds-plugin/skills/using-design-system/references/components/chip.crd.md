---
component: ds-chip
summary: Rótulo curto para filtro selecionável ou destaque de benefício
lifecycle: built            # requested | backlog | active | built | deprecated
channels: ["*"]
---

# ds-chip — Component Requirements Document

## Propósito e escopo
Rótulo curto em dois usos: opção selecionável num grupo de filtros e destaque de um benefício. No tema `premium`,
o destaque de benefício exclusivo é do `ds-chip-premium`.

## Anatomia
- `rotulo`: texto do chip (attr `label`)
- `variante`: neutro ou destaque (attr `variant`)
- `selecionado`: estado de seleção no uso como filtro (attr `selected`)
- `icone`: ícone opcional (slot `icon`)

## Requisitos
### F · Funcional
- F1 Como filtro, alterna `selecionado` ao clicar e emite `dsChange`.
- F2 A `variante` highlight destaca um benefício em qualquer tema.
### S · Estados
- S1 `selecionado` tem estado visual distinto do neutro em todos os temas.
### B · Comportamento
### C · Conteúdo
- C1 O `rotulo` é curto (uma ou duas palavras); frase longa vai em texto, não em chip.
### A · Acessibilidade
- A1 Como filtro, expõe o estado selecionado para leitor de tela.
### I · Integração
- I1 Dentro do template `FilterSheetFlow`, os chips do mesmo grupo são as opções do filtro.

## Descartado

## Fora de escopo
- Status (aprovado, pendente) → `ds-badge`
- Benefício exclusivo no tema `premium` → `ds-chip-premium`

## Decisões

## Uso
- Destaque de benefício fora do tema premium: `<ds-chip variant="highlight" label="Benefício exclusivo"></ds-chip>`.

## Exemplos
### Faça
```html
<ds-chip variant="highlight" label="Tarifa zero"></ds-chip>
```
### Não faça
```html
<!-- viola: system#raw-color -->
<ds-chip label="Tarifa zero" style="background:#FFD700"></ds-chip>
```

<!-- ================= API (GERADO do CEM) ================= -->

## API (gerado do CEM)

### Atributos
| Atributo | Tipo | Default | Descrição |
|---|---|---|---|
| `label` | `string` | — | Texto do chip |
| `variant` | `'default' \| 'highlight'` | `'default'` | Neutro ou destaque de benefício |
| `selected` | `boolean` | `false` | Selecionado (uso como filtro) |

### Eventos
| Evento | Tipo | Quando |
|---|---|---|
| `dsChange` | `CustomEvent<boolean>` | Mudou a seleção |

### Slots
| Slot | Uso |
|---|---|
| `icon` | Ícone opcional |

### CSS parts
_nenhum_
