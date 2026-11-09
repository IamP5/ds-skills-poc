# Temas e canais

## Como funciona
- Código de produto usa **só tokens semânticos**; o contexto troca os valores em runtime.
- Dois eixos independentes, aplicados no root: `<html data-theme="pj" data-channel="app">`
  - `theme` = segmento/marca: `default` | `premium` | `pj`
  - `channel` = plataforma: `app` | `web`
- Os dados seguem o **DTCG Resolver Module 2025.10**: `data/tokens/ds.resolver.json`
  declara os modifiers `theme` e `channel`, e a ordem `foundation → theme → channel`.

## Regras
- ❌ `if (theme === 'premium')` em componente ou página.
- ❌ `[data-theme="pj"] .minha-classe { ... }` em código de produto. Overrides só existem no DS.
- ✅ Diferença de *comportamento* por canal → service `ComponentToggle`.
- ✅ Precisa de um valor (contraste, debug)? `resolve-token.ts` / `check-contrast.ts --theme=all`.

## Exceções (único lugar em que o contexto muda o que você escreve)
| Item | Exceção |
|---|---|
| `ds-chip-premium` | Só existe no tema `premium`. Fora dele: `ds-chip variant="highlight"`. |
| `ds-bottom-sheet` | No canal `web` renderiza como `ds-modal`. Não precisa tratar. |
| Ilustrações | Tema `premium` tem set próprio: `find.ts --theme=premium`. |
| `size.control.min-height` | Maior no canal `app` (toque). Não fixe altura de controle. |
