# Handoff — plugin de IA para o Design System

Migrado de um chat no app do Claude em 2026-11-09. Estado: **v0.3 do plugin, com dados de exemplo** (v0.3 descrita em [PESQUISA-v0.3.md](PESQUISA-v0.3.md)).
O README do plugin (`ds-plugin/README.md`) descreve estrutura, pipeline e uso por ferramenta. Aqui fica só o que não está lá.

## De onde veio
Palestra da Thoughtworks sobre design systems para IA (slides em `docs/contexto/01..05`):
- **Ground** (estabelecer o que é verdade: auditar, resolver drift, nomes), **Guide** (tornar decisões utilizáveis pela IA),
  **Guard** (verificar o que é construído: lint de DS, code review, detecção de drift).
- **One origin per fact**: cada decisão tem uma casa autoritativa, acessível a humanos e agentes
  (Context→AGENTS.md, Knowledge→Design.md, Logic→`*.crd.md`, Foundation→tokens.json, Structure→Figma).
  Inspirado em Cassie Groos, "Design Systems in the Age of Agents".
- Frase-guia: "Don't just teach AI what your design system looks like. Teach it what your design system knows."

O DS do usuário tem, além de componentes: Services (BodyScrollManager, ComponentToggle, ContentLoaders, Instances),
Templates (AccordionNested, CalendarTemplate, FilterSheetFlow, OverlayStack, PopoverTutorial, Rating, Tables…),
Utils (Async), Images (Animation, Flags, Icons, Illustration, Logos), Utilities (Classes) — ver `docs/contexto/06`.
Vários temas trocam tokens por tema/canal.

## Decisões tomadas (e por quê)
| Decisão | Motivo |
|---|---|
| Organizar pela pergunta que o agente faz, não pela árvore do Storybook | Roteamento por tarefa (montar tela → templates primeiro) |
| Referências a 1 nível do SKILL.md; listagem via script/MCP | Doc oficial: Claude pode ler só parte de arquivos aninhados |
| Assets e valores de token nunca entram no contexto; só via `find`/`resolve-token` | Catálogos grandes, valores dependem de contexto |
| Agente não raciocina sobre valor de tema: código usa só token semântico | Tema/canal resolvidos em runtime via `data-theme`/`data-channel` |
| Skill portável + MCP próprio, mesma lib | 130+ squads usam Copilot; hooks/subagente só existem no Claude Code |
| API do componente vem do CEM (Stencil ≥ 4.42), não do `docs-json` | Padrão aberto; Storybook MCP não gera manifest para web components |
| Lifecycle/canais/substituto no frontmatter do CRD (não em tags do Storybook) | CRD é a origem desses fatos (modelo da Cassie Groos) |
| Lifecycle `requested\|backlog\|active\|built\|deprecated`; só `built` é usável | Mesmo vocabulário do CRD original |
| DTCG 2025.10 + Resolver Module com modifiers `theme` e `channel` | Padrão estável; substitui merge caseiro |
| DESIGN.md (spec do Google, alpha) só como **exportação** por tema | Cobre tokens, não componentes; evita segunda origem |
| Descriptions em 3ª pessoa, nomes no gerúndio, ferramentas MCP qualificadas (`design-system:ds_find`) | Best practices de Agent Skills |

## Estado atual
- Tudo em `ds-plugin/` funciona com dados **fictícios**: CEM de exemplo em `tools/fixtures/custom-elements.json`,
  temas `default|premium|pj`, canais `app|web`, nomes de componente com prefixo `ds-`.
- Testado: scripts, MCP via stdio, hook de lint (exit 2), build idempotente, `claude plugin validate` passou
  (avisos só de licença/ícone/privacy, relevantes apenas para diretório público).
- Gaps propositais que o build mostra: `ds-bottom-sheet` sem CRD; `ds-chip-premium` com `usage: partial`.

## Não verificado
- `npx @google/design.md lint` nos `DESIGN.*.md` (bloqueado no ambiente anterior). YAML, refs e ordem de seções foram checados localmente.
- Evals: baseline da v0.2 rodou em 2026-11-09 (`ds-plugin/evals/results/baseline-v0.2/`): 100% com plugin, Δ médio +0.63, US$ 4,13. Ressalvas em [PESQUISA-v0.3.md](PESQUISA-v0.3.md#baseline-v02).
- URL do Figma MCP remoto em `.mcp.json` (`https://mcp.figma.com/mcp`) — confirmar.
- Se o Stencil do usuário já está ≥ 4.42 (necessário para o output target de CEM).

## Próximos passos sugeridos
1. Trocar os dados fictícios pelos reais: CEM do build do Stencil, tokens reais em DTCG + resolver, prefixo real dos componentes.
2. Rodar `build-catalog.ts` e transformar a lista de gaps em backlog de CRDs para o time do DS.
3. Escrever CRDs reais dos componentes mais usados primeiro (intenção, quando NÃO usar, anti-exemplo).
4. Comparar cada mudança com a baseline (`node tools/eval-summary.ts evals/results/baseline-v0.2 <novo>`).
5. Ligar `build-catalog` + `export-design-md` + `plugin validate` no pipeline Nx do DS; publicar o plugin a cada release.
6. Distribuição para Copilot: `.github/skills/` + `.vscode/mcp.json` (snippet no README do plugin).
7. Opcional: trocar regras de `scripts/lint-ds.ts` por ESLint/Stylelint reais; avaliar `cem mcp`/HELiXiR como alternativa ao MCP próprio para a parte de API.

## Pesquisa (2026-11-09) — fontes
- Skill authoring best practices (Anthropic): https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Plugin manifest reference: https://code.claude.com/docs/en/plugins-reference · Plugin evals: https://code.claude.com/docs/en/plugin-evals
- DTCG 2025.10 Format: https://www.designtokens.org/TR/2025.10/format/ · Resolver: https://www.designtokens.org/TR/2025.10/resolver/
- Stencil CEM: https://stenciljs.com/docs/docs-custom-elements-manifest · cem MCP: https://bennypowers.github.io/cem/docs/mcp
- Storybook MCP (suporte por framework): https://storybook.js.org/docs/ai/mcp/overview
- Figma MCP: https://developers.figma.com/docs/figma-mcp-server/
- DS MCPs: Primer https://primer.style/product/getting-started/foundations/mcp · Atlassian `@atlaskit/ads-mcp` · comparativo Supernova https://www.supernova.io/blog/design-system-mcp-servers
- DESIGN.md spec: https://github.com/google-labs-code/design.md
- CRD (Cassie Groos): https://www.designsystemscollective.com/probabilistic-isnt-a-dirty-word-37fa836bedd8

## Skills sugeridas para a próxima sessão
- `skill-creator` — iterar a skill `using-design-system` com evals e otimizar a `description` para disparo.
- `grill-with-docs` — estressar o plano contra este HANDOFF e o README antes de plugar dados reais.
- `to-issues` — quebrar "Próximos passos" em issues no tracker do time.
- `frontend-design` — se for escrever exemplos de tela nos CRDs/templates.
- `dataviz` — se for montar um painel de aderência ao DS a partir dos relatórios do `auditing-design-system`.

## Pesquisa v0.3 (2026-11-09)
Proposta de melhorias com fontes (Cassie Groos, Jeen Suratriyanont, indústria, guardrails): [PESQUISA-v0.3.md](PESQUISA-v0.3.md).

## v0.3 (2026-11-09)
Os 10 passos de [PESQUISA-v0.3.md](PESQUISA-v0.3.md#6-sequência-verificável) foram feitos: CRD tipado, prontidão calculada,
`validate()` único atrás de MCP/hooks/reviewer/auditoria/CI, Stop hook, `ds_validate`/`ds_get_component`, observações →
`gaps.md`, modos de falha, 13 evals. Testes: 77 (`node --test`, ver CLAUDE.md). Evals: 100% com plugin, Δ +0.50.
Pendências: avaliar evals com `validate()`; `ds-link`, `ds-icon-button`, `ds-badge`, `ds-bottom-sheet` seguem como gaps
de exemplo; trocar os dados fictícios pelos reais continua sendo o passo 1 de "Próximos passos".
