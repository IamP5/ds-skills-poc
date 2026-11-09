---
component: ds-chip-premium
summary: Destaque de benefício exclusivo do segmento premium
lifecycle: built            # requested | backlog | active | built | deprecated
channels: ["*"]
themes: ["premium"]         # só existe neste tema
---

# ds-chip-premium — Component Requirements Document

## Propósito e escopo
Sinalizar um benefício exclusivo do segmento premium. Existe só no tema `premium`.

## Anatomia
- `rotulo`: texto do chip (attr `label`)
- `icone`: ícone opcional (slot `icon`)

## Requisitos
### F · Funcional
- F1 Sinaliza benefício exclusivo do segmento premium.
### S · Estados
### B · Comportamento
### C · Conteúdo
- C1 [open] Limite de texto do `rotulo` e uso sem `icone` ainda não definidos.
### A · Acessibilidade
### I · Integração

## Descartado

## Fora de escopo
- Status (aprovado, pendente) → `ds-badge`
- Destaque em qualquer outro tema que não `premium` → `ds-chip`

## Decisões

## Uso
- Só existe no tema `premium`. Em qualquer outro tema use `ds-chip variant="highlight"`.
- Não use para status (aprovado, pendente): isso é `ds-badge`.

<!-- ================= API (GERADO do CEM) ================= -->

## API (gerado do CEM)

### Atributos
| Atributo | Tipo | Default | Descrição |
|---|---|---|---|
| `label` | `string` | — | Texto do chip |

### Eventos
_nenhum_

### Slots
| Slot | Uso |
|---|---|
| `icon` | Ícone opcional |

### CSS parts
_nenhum_
