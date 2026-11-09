---
version: alpha
name: "Design System — premium (app)"
description: "Gerado de data/tokens/ds.resolver.json com theme=premium, channel=app. Não edite."
colors:
  action-primary: "#c9a227"
  action-primary-hover: "#b08c1e"
  action-danger: "#c62828"
  text-default: "#ffffff"
  text-subtle: "#b8bcc6"
  text-on-action: "#14171f"
  surface-default: "#14171f"
  surface-raised: "#1e222c"
  feedback-success: "#2e7d32"
  feedback-error: "#c62828"
typography:
  heading:
    fontFamily: "Inter"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Inter"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.25
rounded:
  control: 8px
  container: 16px
spacing:
  inset-sm: 8px
  inset-md: 16px
  stack-md: 16px
  stack-lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.text-on-action}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "{spacing.inset-md}"
    height: 48px
  button-primary-hover:
    backgroundColor: "{colors.action-primary-hover}"
  card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-default}"
    rounded: "{rounded.container}"
    padding: "{spacing.inset-md}"
---

## Overview

Tema **premium**, canal **app**. Este arquivo é uma exportação para ferramentas que leem DESIGN.md.
Para componentes, templates e regras de uso completas, use a skill `using-design-system` ou o MCP `design-system`.

## Colors

- **action-primary** (#c9a227): Fundo da ação principal
- **action-primary-hover** (#b08c1e): Hover da ação principal
- **action-danger** (#c62828): Ações destrutivas
- **text-default** (#ffffff): Texto corrido
- **text-subtle** (#b8bcc6): Texto de apoio
- **text-on-action** (#14171f): Texto sobre color.action.*
- **surface-default** (#14171f): Fundo de página
- **surface-raised** (#1e222c): Cards, sheets
- **feedback-success** (#2e7d32): Sucesso
- **feedback-error** (#c62828): Erro de validação ou sistema

## Typography

- **heading**: Títulos de tela e seção
- **body**: Texto corrido
- **label**: Rótulos de controles

## Layout

- **inset-sm**: 8px
- **inset-md**: 16px
- **stack-md**: 16px
- **stack-lg**: 24px

## Shapes

- **control**: 8px
- **container**: 16px

## Components

- **button-primary**: uma ação principal por área. Navegação usa link, não botão.
- **card**: superfície elevada para agrupar conteúdo resumido.

## Do's and Don'ts

- Do: use só os tokens acima; nunca valores crus.
- Do: erro de validação usa `feedback-error`, não `action-danger`.
- Don't: criar variações de cor por tela ou ramificar por tema no código.
