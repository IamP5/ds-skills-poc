# design-system — plugin de exemplo (v0.3)

Plugin para agentes trabalharem com o Design System. Todo o conteúdo é **exemplo**:
troque nomes, tokens e regras pelos do seu DS.

## O que mudou na v0.3
Pesquisa e decisões em [`docs/PESQUISA-v0.3.md`](../docs/PESQUISA-v0.3.md).

| # | Melhoria | Onde |
|---|---|---|
| 1 | **CRD tipado**: anatomia, requisitos com ID (`F1`, `A2`…), `[open]`/`[review]`, *Descartado*, *Fora de escopo*, decisões datadas | `scripts/lib/crd.ts`, `references/components/*.crd.md` |
| 2 | **Prontidão calculada** no build (nunca declarada à mão) e mostrada no `ds_list` | `scripts/lib/readiness.ts` |
| 3 | **Um validador** (`validate()`) atrás de MCP, hooks, reviewer, auditoria e CI: conhece tags, atributos, enums, slots, lifecycle, temas e tokens | `scripts/lib/validate.ts` |
| 4 | `ds_validate` (validar antes de escrever, também no Copilot) e `ds_get_component` (CRD curto com exemplos) | `mcp/server.ts`, `scripts/check.ts`, `scripts/component.ts` |
| 5 | **Stop hook**: não deixa o agente terminar com violação aberta | `hooks/hooks.json` |
| 6 | **Observações → `gaps.md`**: o que produtos pedem e não existe volta para o time do DS, com status calculado | `scripts/lib/observations.ts`, `tools/build-catalog.ts --observations` |
| 7 | Modos de falha do agente, reviewer ancorado no CRD, evals de disparo com negativos "quase" e de gap/decisão aberta | `references/failure-modes.md`, `agents/ds-reviewer.md`, `evals/` |

## O que mudou da v0.1
| # | Melhoria | Onde |
|---|---|---|
| 1 | Referências a **1 nível** do SKILL.md; a listagem virou script/MCP; índice nos docs longos | `skills/using-design-system/SKILL.md`, `scripts/list.ts` |
| 2 | **Portável**: skill com caminhos relativos + **MCP do DS** para Copilot, Cursor, Codex | `mcp/server.ts`, `.mcp.json` |
| 3 | API dos componentes vem do **Custom Elements Manifest** (padrão), não do `docs-json` | `tools/build-catalog.ts` |
| 4 | Tokens no **DTCG 2025.10** + **Resolver Module** (theme × channel) | `data/tokens/ds.resolver.json` |
| 5 | **Evals** no formato do `claude plugin eval` | `evals/` |
| 6 | Docs de componente como **CRD** com `lifecycle` e status por seção | `references/components/*.crd.md` |
| 7 | **DESIGN.md** por tema exportado dos tokens, como saída derivada | `tools/export-design-md.ts`, `data/design-md/` |
| — | Description em terceira pessoa, nomes no gerúndio, ferramentas MCP qualificadas | skills |

## Estrutura
```
ds-plugin/
├─ .claude-plugin/plugin.json
├─ .mcp.json                       # MCP do DS (stdio) + Figma (http)
├─ skills/
│  ├─ using-design-system/         # PORTÁVEL (padrão Agent Skills)
│  │  ├─ SKILL.md                  # roteador
│  │  ├─ references/               # 1 nível: components/*.crd.md, templates/, services/, tokens.md, themes.md, utilities.md, failure-modes.md
│  │  │                            #   gaps.md: GERADO de observações (feedback para o time do DS)
│  │  ├─ data/                     # GERADO, nunca lido inteiro
│  │  │  ├─ catalog.json           # CEM + frontmatter dos CRDs/docs
│  │  │  ├─ assets.json
│  │  │  ├─ tokens/ds.resolver.json + base / themes/* / channels/*
│  │  │  └─ design-md/DESIGN.<tema>.md
│  │  └─ scripts/                  # list, find, component, check, resolve-token, check-contrast (+ lib/ compartilhada com o MCP)
│  └─ auditing-design-system/      # GROUND
├─ mcp/server.ts                   # mesmas operações dos scripts, via MCP
├─ agents/ds-reviewer.md           # GUARD (Claude Code)
├─ hooks/hooks.json                # GUARD: validate a cada Write/Edit + Stop hook (Claude Code)
├─ tools/                          # build-time, roda no CI do DS
│  ├─ build-catalog.ts
│  ├─ export-design-md.ts
│  ├─ eval-summary.ts              # resume/compara resultados do claude plugin eval
│  └─ fixtures/custom-elements.json  # exemplo de CEM
└─ evals/                          # claude plugin eval
```

## Uma origem por fato
| Fato | Origem | Chega ao plugin via |
|---|---|---|
| Atributos, eventos, slots, CSS parts | Código Stencil → `custom-elements.json` | `build-catalog.ts` (catálogo + seção API do CRD) |
| Lifecycle, resumo, canais, substituto | Frontmatter do CRD / doc (escrito por pessoas) | `build-catalog.ts` |
| Intenção, quando usar ou não, decisões | Corpo do CRD (pessoas + agentes) | lido sob demanda |
| Valores por tema/canal | Tokens DTCG + resolver | `resolve-token` / `ds_resolve_token` |
| Visual (anatomia, espaçamentos) | Figma | Figma MCP + Code Connect; o CRD não repete |
| DESIGN.md | **Derivado** dos tokens | `export-design-md.ts`; nunca editar à mão |

## Pipeline no CI do DS
```bash
# stencil.config.ts → outputTargets: [{ type: 'docs-custom-elements-manifest', file: 'dist/custom-elements.json' }]  (Stencil >= 4.42)
npx stencil build
node tools/build-catalog.ts --cem=dist/custom-elements.json   # catálogo + API dos CRDs; lista a prontidão
node tools/export-design-md.ts                                # DESIGN.<tema>.md
node --test skills/using-design-system/scripts/lib/*.test.ts skills/using-design-system/scripts/*.test.ts mcp/*.test.ts tools/*.test.ts
npx @google/design.md lint skills/using-design-system/data/design-md/DESIGN.default.md
claude plugin validate .
claude plugin eval . --allow-real-servers --allow-tools Bash Write "mcp__plugin_design-system_design-system__*" -j 4 --output-dir evals/results/<rotulo>
node tools/eval-summary.ts evals/results/baseline-v0.2 evals/results/<rotulo>   # compara com a baseline da v0.2
```
Gaps de exemplo que o build aponta de propósito: `ds-bottom-sheet` sem CRD; `ds-chip-premium` com decisão `[open]`;
`ds-button` e `ds-chip-premium` citando componentes que não estão no CEM de exemplo.

## CI dos produtos
```bash
node <skill>/scripts/check.ts --ci src/ --record     # falha com erro do DS; grava .design-system/observations.jsonl
```
Suba o `observations.jsonl` como artefato. No CI do DS: `node tools/build-catalog.ts --observations=<pasta>[,...]`
regera `references/gaps.md` (pedidos que não existem, escapes com motivo, o que já foi resolvido).

## Usar em cada ferramenta
| Ferramenta | Skill | MCP | Hook / reviewer |
|---|---|---|---|
| Claude Code | plugin inteiro (`claude --plugin-dir ./ds-plugin`) | automático via `.mcp.json` | sim |
| GitHub Copilot (VS Code) | copie `skills/using-design-system/` para `.github/skills/` | `.vscode/mcp.json` (abaixo) | não; use `check.ts --ci` no CI |
| Cursor / Codex / Gemini CLI | copie a skill para `.agents/skills/` | config MCP da ferramenta | não; use `check.ts --ci` no CI |

```json
// .vscode/mcp.json
{ "servers": { "design-system": { "type": "stdio", "command": "node", "args": ["<caminho>/ds-plugin/mcp/server.ts"] } } }
```

Requisitos: Node 22.18+ (roda `.ts` direto, sem dependências).

## Testar localmente
```bash
cd skills/using-design-system
node scripts/list.ts components
node scripts/find.ts "filtro extrato"
node scripts/resolve-token.ts size.control.min-height --channel=all
node scripts/check-contrast.ts color.text.on-action color.action.primary --theme=all
node scripts/component.ts ds-button
echo '<ds-button variant="primari">Ok</ds-button>' | node scripts/check.ts --stdin --file=x.html
```
