# Modos de falha do agente com o DS

Erros que agentes repetem ao usar este DS. Cada modo diz como detectar e o que fazer.
Detecção por **regra** = `ds_validate` / `scripts/check.ts` pegam sozinhos. Por **review** = só o `ds-reviewer` ou uma pessoa.
Adaptado do catálogo de Jeen Suratriyanont (github.com/wishayajeen/portfolio, `failure-modes.md`).

**Índice:** [Inventário especulativo](#1-inventário-especulativo) · [Deriva semântica](#2-deriva-semântica-de-elemento) ·
[Cópia do DS](#3-cópia-do-ds-mimic) · [Ramificação por contexto](#4-ramificação-por-tema-ou-canal) ·
[Compensação em cascata](#5-compensação-em-cascata) · [Cegueira de arquitetura](#6-cegueira-de-arquitetura) ·
[Deriva da origem](#7-deriva-da-origem) · [Decisão em aberto ignorada](#8-decisão-em-aberto-ignorada)

## 1. Inventário especulativo
- **O que é:** inventar componente, prop, valor, slot ou token que "deveria existir" (`<ds-chip>`, `variant="highlight"`).
- **Por quê:** o nome soa plausível e o agente completa o padrão.
- **Detecção:** regra `unknown-tag`, `unknown-attr`, `invalid-enum`, `unknown-slot`, `unknown-token`.
- **Prevenção:** `ds_find` / `ds_list` antes de escrever; `ds_validate` no trecho antes do Write.
- **Recuperação:** se não existe, diga que é **gap do DS** e proponha a alternativa que existe. Não crie o componente.

## 2. Deriva semântica de elemento
- **O que é:** usar o controle com a semântica errada: `ds-button` para navegar, checkbox onde a mudança é imediata, `div` clicável.
- **Por quê:** o agente escolhe pela aparência, não pela intenção documentada.
- **Detecção:** review (seção *Fora de escopo* e *Descartado* do CRD dizem o dono certo).
- **Prevenção:** leia o CRD com `ds_get_component` e confira *Fora de escopo* antes de escolher.
- **Recuperação:** troque pelo dono indicado (`→ ds-link`).

## 3. Cópia do DS (mimic)
- **O que é:** refazer à mão algo que o DS já tem (`<button class="btn">`, modal com `div` + `z-index`).
- **Detecção:** regra `mimic` (padrões do campo `mimics` do CRD) e `manual-zindex`; o resto por review.
- **Prevenção:** ordem de decisão do SKILL.md: template → componente → service → só então algo novo, justificado.

## 4. Ramificação por tema ou canal
- **O que é:** `if (theme === 'pj')`, CSS por `[data-theme=pj] .x`, ou usar um componente fora do tema dele.
- **Detecção:** regra `theme-branch` e `theme-restricted` (passe `theme` para o `ds_validate`).
- **Prevenção:** só token semântico; contexto vem do runtime (`references/themes.md`).

## 5. Compensação em cascata
- **O que é:** corrigir o sintoma com valor cru e depois compensar o valor cru em outro lugar (`padding: 12px` → `margin: -4px`).
- **Detecção:** regra `raw-color`, `raw-spacing`, `primitive-token`.
- **Recuperação:** volte ao primeiro valor cru e troque pelo token; os ajustes seguintes costumam sumir.

## 6. Cegueira de arquitetura
- **O que é:** resolver localmente o que um service já resolve: `document.body.style.overflow`, empilhar overlays na mão.
- **Detecção:** regra `body-overflow`, `manual-zindex`; review para os demais services.
- **Prevenção:** passo 3 da ordem de decisão (service) e requisitos `I*` (Integração) do CRD.

## 7. Deriva da origem
- **O que é:** confiar no Figma, num print ou em código antigo em vez do catálogo; usar `deprecated` porque "já está no projeto".
- **Detecção:** regra `deprecated` e `not-built`.
- **Prevenção:** hierarquia de verdade do SKILL.md: código do DS (catálogo) > CRD > Figma.

## 8. Decisão em aberto ignorada
- **O que é:** implementar por cima de um requisito `[open]` do CRD, escolhendo sozinho o que o time ainda não decidiu.
- **Detecção:** `ds_get_component` mostra `PARE: <ID> está [open]`; review confere.
- **Recuperação:** pare e devolva a pergunta à pessoa, citando o ID. Siga com o que não depende dela.
