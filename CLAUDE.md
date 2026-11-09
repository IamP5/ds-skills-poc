# design-system-ai

Plugin de agente para o Design System (web components Stencil, vários temas por canal).
Objetivo: ensinar o agente **o que o DS sabe**, não só como ele parece.
Contexto completo, decisões e próximos passos: [docs/HANDOFF.md](docs/HANDOFF.md).

## Estrutura
- `ds-plugin/`: o plugin (Claude Code). A skill `ds-plugin/skills/using-design-system/` é portável (padrão Agent Skills).
- `docs/contexto/`: fotos dos slides da palestra que originou o projeto e print das categorias do Storybook.

## Comandos (rodar em `ds-plugin/`)
```bash
node tools/build-catalog.ts --cem=<custom-elements.json>   # regera catalog.json e a seção API dos CRDs
node tools/export-design-md.ts                              # regera DESIGN.<tema>.md
node skills/using-design-system/scripts/check.ts --report <pasta>   # auditoria (--ci falha com erro; --record grava observações)
node --test skills/using-design-system/scripts/lib/*.test.ts skills/using-design-system/scripts/*.test.ts mcp/*.test.ts tools/*.test.ts
claude plugin validate .
claude plugin eval . --allow-real-servers --allow-tools Bash Write "mcp__plugin_design-system_design-system__*" -j 4 --output-dir evals/results/<rotulo>   # ~US$ 4; sem --allow-real-servers o MCP do DS não sobe
node tools/eval-summary.ts evals/results/baseline-v0.2 [evals/results/<rotulo>]   # tabela ou comparação antes→depois
```
Scripts da skill: `cd skills/using-design-system && node scripts/{list,find,component,check,resolve-token,check-contrast}.ts`.

## Convenções
- Node 22.18+, TypeScript rodado direto pelo Node (só sintaxe apagável: sem enum/namespace), **zero dependências**.
- Docs e mensagens em pt-BR.
- **Uma origem por fato.** Nunca edite à mão: `data/catalog.json`, `data/design-md/*`, `references/utilities.md`, `references/gaps.md` nem a seção
  `## API (gerado do CEM)` dos `*.crd.md`. Mude a origem (CEM, frontmatter do CRD, tokens) e regere.
- Referências a **1 nível** do SKILL.md. Doc com mais de 100 linhas leva índice no topo.
- Scripts da skill e `mcp/server.ts` compartilham `skills/using-design-system/scripts/lib/`: lógica nova vai na lib.
- Toda checagem de uso do DS mora em `lib/validate.ts` (`RULES`). Regra nova = entrada na tabela + teste; não crie outro lint.
- CRD segue a gramática v0.3 de `scripts/lib/crd.ts` (`parseCrd`); `button.crd.md` é o exemplo. Prontidão (`lib/readiness.ts`) é calculada no build e sai em `catalog.json`; nunca declare status à mão.
- Tokens no formato DTCG 2025.10 (cor e dimension como objeto), contexto via `data/tokens/ds.resolver.json`.
- Não coloque CLAUDE.md dentro de `ds-plugin/`: o validador do plugin reclama, e ele não é carregado.
