---
component: ds-button
summary: Dispara uma ação na tela atual
lifecycle: built            # requested | backlog | active | built | deprecated
channels: ["*"]
figma: "Button / Primary"   # nó com Code Connect
mimics: ["<button"]
---

# ds-button — Component Requirements Document

**Índice:** [Propósito](#propósito-e-escopo) · [Anatomia](#anatomia) · [Requisitos](#requisitos) · [Descartado](#descartado) · [Fora de escopo](#fora-de-escopo) · [Decisões](#decisões) · [Uso](#uso) · [Exemplos](#exemplos) · [API](#api-gerado-do-cem)

<!-- Tudo acima de "API" é escrito por pessoas (PM, design, dev) e mantido junto com os agentes.
     A seção API é regerada por tools/build-catalog.ts a partir do custom-elements.json. -->

## Propósito e escopo
Disparar uma ação na tela atual (salvar, enviar, confirmar, cancelar). Navegar para outra rota ou página
não é ação: é do `ds-link`.

## Anatomia
- `label`: rótulo do botão (slot default)
- `icone-inicio`: ícone antes do rótulo, um `ds-icon` (slot `start`)
- `icone-fim`: ícone depois do rótulo, um `ds-icon` (slot `end`)
- `nativo`: o <button> interno (part `native`)
- `variante`: ênfase visual (attr `variant`)

## Requisitos
### F · Funcional
- F1 Dispara uma ação na tela atual, com o `label` como nome acessível.
- F2 Oferece 4 níveis de ênfase pela `variante`: principal, alternativa, baixa e destrutiva.
### S · Estados
- S1 `loading` bloqueia clique duplo sem perder o foco.
### B · Comportamento
- B1 [review] No máximo uma `variante` primary por área; as demais ações usam secondary ou ghost.
- B2 A `variante` danger sempre vem acompanhada de confirmação.
### C · Conteúdo
- C1 Ícone opcional antes (`icone-inicio`) ou depois (`icone-fim`) do `label`.
- C2 O `label` é obrigatório; botão só com ícone é outro componente (ver Fora de escopo).
### A · Acessibilidade
- A1 Área de toque mínima de `size.control.min-height` (varia por canal).
### I · Integração

## Descartado
- Navegação via `onClick`/`router` no `ds-button` · motivo: navegação não é ação; existe `ds-link variant="button"`.
- Prop `color` livre · motivo: quebra temas; a cor vem da `variant` e dos tokens.

## Fora de escopo
- Ir para outra rota/página (`variant="button"`) → `ds-link`
- Só ícone, sem texto (exige `label`) → `ds-icon-button`

## Decisões
- 2026-01-15 · `<button>` nativo no shadow DOM: herda teclado, foco e semântica sem ARIA extra · @time-ds
- 2026-03-01 · `loading` seta `aria-busy="true"` e mantém o foco no botão (decisão de a11y) · @time-a11y

## Uso
Cores, espaçamentos e anatomia nascem no Figma (`Button / Primary`) e viram tokens; este documento **não repete**
valores visuais. Tokens consumidos: `color.action.*`, `color.text.on-action`, `space.inset.*`, `radius.control`,
`size.control.min-height`, `font.label`.

| `variant` | Use quando |
|---|---|
| `primary` | Ação principal da tela/seção (no máx. 1 por área) |
| `secondary` | Ações alternativas |
| `ghost` | Baixa ênfase (cancelar, voltar) |
| `danger` | Ação destrutiva — sempre com confirmação |

## Exemplos
### Faça
```html
<ds-button variant="primary" type="submit" loading={saving}>Salvar alterações</ds-button>
<ds-button variant="ghost" onClick={cancel}>Cancelar</ds-button>
```
### Não faça
```html
<!-- viola: F1 -->
<ds-button variant="primary" onClick={() => router.push('/extrato')}>Ver extrato</ds-button>
```
```html
<!-- viola: system#raw-color -->
<ds-button variant="primary" style="background:#E00000">Salvar</ds-button>
```
```html
<!-- viola: B1 -->
<ds-button variant="primary">Salvar</ds-button>
<ds-button variant="primary">Compartilhar</ds-button>
```

<!-- ================= API (GERADO do CEM) ================= -->

## API (gerado do CEM)

### Atributos
| Atributo | Tipo | Default | Descrição |
|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'primary'` | Ênfase visual |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Altura e padding |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | Tipo nativo |
| `loading` | `boolean` | `false` | Mostra spinner e bloqueia clique |
| `disabled` | `boolean` | `false` | Desabilita |
| `full-width` | `boolean` | `false` | Ocupa 100% do container |

### Eventos
| Evento | Tipo | Quando |
|---|---|---|
| `dsClick` | `CustomEvent<MouseEvent>` | Clique, exceto em loading/disabled |

### Slots
| Slot | Uso |
|---|---|
| (default) | Rótulo |
| `start` | Ícone antes do rótulo (ds-icon) |
| `end` | Ícone depois do rótulo (ds-icon) |

### CSS parts
| Part | O que é |
|---|---|
| `native` | O <button> interno |
