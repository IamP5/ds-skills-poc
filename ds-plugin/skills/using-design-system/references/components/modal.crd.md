---
component: ds-modal
summary: Interrupção que exige decisão do usuário
lifecycle: built            # requested | backlog | active | built | deprecated
channels: ["*"]
figma: "Modal / Default"
---

# ds-modal — Component Requirements Document

**Índice:** [Propósito](#propósito-e-escopo) · [Anatomia](#anatomia) · [Requisitos](#requisitos) · [Descartado](#descartado) · [Fora de escopo](#fora-de-escopo) · [Decisões](#decisões) · [Uso](#uso) · [Exemplos](#exemplos) · [API](#api-gerado-do-cem)

## Propósito e escopo
Interromper o fluxo para uma decisão ou informação crítica. O usuário precisa responder (ou fechar) antes de
voltar à tela.

## Anatomia
- `conteudo`: corpo do modal (slot default)
- `rodape`: área das ações (slot `footer`)
- `titulo`: título acessível do modal (attr `heading`)
- `aberto`: abre e fecha o modal (attr `open`)
- `tamanho`: largura do modal (attr `size`)

## Requisitos
### F · Funcional
- F1 Interrompe o fluxo para uma decisão ou informação crítica.
### S · Estados
### B · Comportamento
- B1 Em confirmação de ação destrutiva, as ações ficam no `rodape`: `ds-button variant="danger"` + `ds-button variant="ghost"`.
### C · Conteúdo
- C1 Em confirmação de ação destrutiva, o `titulo` é uma pergunta.
### A · Acessibilidade
- A1 Enquanto `aberto`, o foco fica preso dentro do modal (focus trap).
- A2 `Esc` fecha o modal.
- A3 Ao fechar, o foco volta ao elemento que abriu o modal.
### I · Integração
- I1 Usa `BodyScrollManager` internamente para travar o scroll do body.
- I2 Mais de um overlay ao mesmo tempo → abra pelo template `OverlayStack`.

## Descartado
- Travar o scroll do body por fora (`document.body.style.overflow`) · motivo: o `ds-modal` já usa `BodyScrollManager` (I1); travar por fora briga com ele.

## Fora de escopo
- Overlays empilhados (modal sobre sheet) → `OverlayStack`

## Decisões

## Uso
- Confirmação de ação destrutiva: `heading` em forma de pergunta, ações no slot `footer`
  com `ds-button variant="danger"` + `variant="ghost"` (C1, B1).
- Não use para conteúdo longo navegável: isso é página.

## Exemplos
### Faça
```html
<ds-modal heading="Excluir favorecido?" open={confirming} onDsClose={cancel}>
  <p>Essa ação não pode ser desfeita.</p>
  <div slot="footer">
    <ds-button variant="ghost" onClick={cancel}>Cancelar</ds-button>
    <ds-button variant="danger" onClick={remove}>Excluir</ds-button>
  </div>
</ds-modal>
```
### Não faça
```html
<!-- viola: I1 -->
<ds-modal heading="Excluir favorecido?" open={confirming} onDsClose={cancel}>…</ds-modal>
<script>document.body.style.overflow = 'hidden';</script>
```

<!-- ================= API (GERADO do CEM) ================= -->

## API (gerado do CEM)

### Atributos
| Atributo | Tipo | Default | Descrição |
|---|---|---|---|
| `heading` | `string` | — | Título acessível |
| `open` | `boolean` | `false` | Abre/fecha |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Largura |

### Eventos
| Evento | Tipo | Quando |
|---|---|---|
| `dsClose` | `CustomEvent<void>` | Fechou por ação do usuário |

### Slots
| Slot | Uso |
|---|---|
| (default) | Conteúdo |
| `footer` | Ações |

### CSS parts
_nenhum_
