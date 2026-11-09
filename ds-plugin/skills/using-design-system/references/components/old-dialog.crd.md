---
component: ds-old-dialog
summary: Diálogo legado
lifecycle: deprecated       # requested | backlog | active | built | deprecated
replacement: ds-modal
channels: ["*"]
---

# ds-old-dialog — Component Requirements Document

## Propósito e escopo
**Depreciado.** Use `ds-modal`. Se houver overlays empilhados, use o template `OverlayStack`.

## Migração
| ds-old-dialog | ds-modal |
|---|---|
| `title` | `heading` |
| `show()` | `open = true` |
| evento `closed` | evento `dsClose` |

<!-- ================= API (GERADO do CEM) ================= -->

## API (gerado do CEM)

### Atributos
| Atributo | Tipo | Default | Descrição |
|---|---|---|---|
| `title` | `string` | — | Título |

### Eventos
| Evento | Tipo | Quando |
|---|---|---|
| `closed` | `CustomEvent<void>` | Fechou |

### Slots
_nenhum_

### CSS parts
_nenhum_
