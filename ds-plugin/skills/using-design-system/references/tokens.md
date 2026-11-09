<!-- Nomes e intenções gerados de data/tokens (campo $description). Sem valores: eles dependem de tema e canal. -->
# Tokens semânticos

Use só estes nomes. Primitivos (`palette.*`, `size.<n>`) são proibidos em código de produto.
Valor num contexto: `node scripts/resolve-token.ts <token> --theme=<t> --channel=<c>`.

CSS: `var(--ds-color-action-primary)` · TS: `tokens.color.action.primary`

## Cor
| Token | Intenção |
|---|---|
| `color.action.primary` | Fundo da ação principal |
| `color.action.primary-hover` | Hover da ação principal |
| `color.action.danger` | Ações destrutivas |
| `color.text.default` | Texto corrido |
| `color.text.subtle` | Texto de apoio |
| `color.text.on-action` | Texto sobre `color.action.*` |
| `color.surface.default` | Fundo de página |
| `color.surface.raised` | Cards, sheets |
| `color.feedback.success` / `error` | Estados de feedback (nunca decoração) |

## Espaço e tamanho
| Token | Intenção |
|---|---|
| `space.inset.sm` / `md` | Padding interno de componentes |
| `space.stack.md` / `lg` | Espaço vertical entre blocos / seções |
| `size.control.min-height` | Altura mínima de controles (área de toque; muda por canal) |

## Forma
| Token | Intenção |
|---|---|
| `radius.control` | Inputs, botões |
| `radius.container` | Cards, sheets, modais |

## Tipografia
| Token | Intenção |
|---|---|
| `font.heading` | Títulos de tela e seção |
| `font.body` | Texto corrido |
| `font.label` | Rótulos de controles |

## Escolhendo o token certo
- Erro de validação → `color.feedback.error`, não `color.action.danger`
- Card dentro de modal → `color.surface.raised`
- Não achou token para a intenção? Não invente nem use primitivo: sinalize o gap.
