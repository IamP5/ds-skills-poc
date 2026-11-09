# Pesquisa e proposta v0.3 do plugin (2026-11-09)

Proposta, nada implementado. Base: 4 pesquisas em paralelo (Cassie Groos, Jeen Suratriyanont, prática da indústria,
guardrails e evals) e 2 desenhos concorrentes ("CRD como modelo de domínio" e "loop de verificação fechado").

## Índice
1. [Resumo](#1-resumo)
2. [O que a pesquisa diz](#2-o-que-a-pesquisa-diz)
3. [Desenho escolhido](#3-desenho-escolhido)
4. [Tipos centrais](#4-tipos-centrais)
5. [Mapa de módulos](#5-mapa-de-módulos)
6. [Sequência verificável](#6-sequência-verificável)
7. [Rejeitado e por quê](#7-rejeitado-e-por-quê)
8. [Perguntas abertas](#8-perguntas-abertas)
9. [Fontes](#9-fontes)
10. [Baseline v0.2](#baseline-v02)
11. [Resultado v0.3](#resultado-v03)

## 1. Resumo
- O GUIDE do plugin já está alinhado com o mercado. A palestra da Jeen na XConf 2026 usa o mesmo modelo
  ("one origin per decision; the map just points") e o mesmo CRD da Cassie.
- O buraco está no **GUARD** e na **medição**. Os times mais adiantados (Carbon, Spectrum, Atlassian, Storybook)
  expõem uma ferramenta de validação que o agente chama antes de escrever. Nosso lint é regex, só roda depois do Write,
  não conhece atributos, enums, slots nem temas, e não chega ao Copilot.
- O CRD que temos copia o lifecycle da Cassie, mas não a estrutura que o torna testável: IDs de requisito,
  `[open]` que para o agente, prontidão calculada, "Ruled out", "Out-of-scope", log de decisões.
- As evals não têm baseline. Sem isso não dá para provar que skill ou MCP ajudam (a Atlassian mediu e achou que
  DESIGN.md gastou ~92% mais tokens que MCP e fez o agente recriar componentes em vez de importar).

Proposta: **um motor `validate()` na lib** (base do desenho B) que lê um **CRD parseado e tipado** (enxerto do
desenho A). Todo o resto deriva dos dois: hook, Stop hook, `ds_validate` no MCP, reviewer, auditoria, log de gaps e
avaliadores das evals.

## 2. O que a pesquisa diz

### Cassie Groos (origem do CRD)
| Ideia | Temos? |
|---|---|
| Anatomia nomeada; todo requisito usa os nomes das partes | Não |
| Requisitos atômicos com ID por categoria: F funcional, S estados, B comportamento, C conteúdo, A a11y, I integração | Não (bullets soltos) |
| `[review]` marca o que só humano verifica | Não |
| `[open]`: agente que encontra para e devolve ao humano | Não |
| "Pronto para dev" **calculado**, nunca guardado ("a stored flag can be true in the frontmatter and false in reality") | Não: `status:` é declarado à mão |
| Ruled out, Out-of-scope (aponta o dono), log de decisões datado, bloco de emenda | Parcial (decisões soltas no texto) |
| Regras (aplicadas) × guidelines (revisão humana) × decisões (dono nomeado) | Não |
| Agente lê CRDs irmãos como precedente | Não |

### Jeen Suratriyanont (Thoughtworks)
| Ideia | Temos? |
|---|---|
| DESIGN.md como mapa que só aponta | Sim (README + SKILL.md) |
| Loop build → audit → log → dashboard; auditoria apodrece se o resultado não volta para os dados | Não: relatório é descartável |
| `failure-modes.md` com 8 modos (deriva semântica de elemento, inventário especulativo, auditoria velha…), cada um com sinais de detecção e prevenção | Não |
| Contagem de adoção e de "mimics" (cópias feitas à mão de componentes do DS) | Não |
| Auditoria do DOM renderizado via Playwright: fatos crus primeiro, humano decide o token | Não |
| "Aponte gaps e contradições, não invente convenções" | Sim, como prosa; sem eval |

### Indústria
| Padrão (2+ times) | Quem | Temos? |
|---|---|---|
| Ferramenta de validação chamável | Carbon `code_audit`, Spectrum `validate-component-props`, ADS `ads_analyze_a11y`, Storybook `test-run` | Não |
| Busca de exemplos prontos | Carbon `code_search`, Storybook `docs-show`, shadcn `view` | Não |
| Linters reais com o substituto na mensagem | Atlassian, SLDS, Builder.io | Regex |
| Codemods de depreciação | Atlassian hypermod, SLDS | Não |
| llms.txt + md/JSON por componente | Atlassian, Cloudscape, shadcn | Não |
| Evals comparando condições (tokens, turnos) | Atlassian | Não |

### Guardrails e evals
- Regra que precisa valer sempre vai em hook; **Stop hook com exit 2** devolve o agente ao trabalho (docs Claude Code).
- Ferramentas para agente: `response_format` conciso/detalhado, erro que mostra a entrada válida (Anthropic).
- Evals de disparo: ~20 prompts, metade negativos "quase" (Stencil genérico, CSS, outro DS), 3 execuções, split 60/40;
  evals de saída com e sem skill; descarte asserção que passa nos dois (agentskills.io).
- Radar Thoughtworks vol. 35: *progressive context disclosure* em Adopt, *agent instruction bloat* em Caution.
- A11y por construção, não por julgamento do LLM (TJ Pitre, Hidde de Vries).

## 3. Desenho escolhido

Dois desenhos foram feitos em paralelo e comparados:
- **A, CRD como modelo de domínio.** O CRD vira documento tipado e tudo deriva dele, inclusive as regras regex,
  escritas em comentários HTML dentro de um `system.crd.md`.
- **B, loop de verificação fechado.** Um motor `validate()` profundo atrás de todas as superfícies de GUARD,
  observações imutáveis com status de gap calculado, evals como comparação de baseline.

**Base: B.** Ele fecha o buraco que a pesquisa mais aponta (validação chamável, também no Copilot) e já traz medição.
**Enxertos de A:**
1. Gramática e parser do CRD (`Crd` tipado com anatomia, IDs, `[open]`, `[review]`, Ruled out, Out-of-scope, decisões).
2. Prontidão calculada (`readiness()`), usada no build, no `ds_list` e no novo `ds_get_component`.
3. Exemplos `faça`/`não faça` do CRD viram teste: cada `faça` passa no `validate`, cada `não faça` dispara a regra que
   declara violar. Os mesmos exemplos alimentam a resposta do MCP (o padrão "busca de exemplos" da indústria).
4. `ds_get_component` com `format: concise|detailed` substitui `ds_get_doc`, e devolve "PARE: F4 [open]…" quando há
   decisão pendente.

**Onde A e B divergiam e o que ficou:** regras globais em tabela TS tipada (`RULES` de B) e não regex em comentário
de markdown (A). O tipo `RuleId` deriva da tabela e o teste itera as chaves, então regra sem teste quebra o build.
Cada regra cita o requisito de origem (`system#I2`) para manter o rastreio que A queria.

**Do material da Jeen:** `references/failure-modes.md` (1 nível do SKILL.md). Cada modo com sinal detectável vira regra
no `RULES` e caso de eval; os que precisam de julgamento ficam como pergunta do reviewer.

## 4. Tipos centrais

```ts
// lib/crd.ts — único parser de *.crd.md
type Category = 'F' | 'S' | 'B' | 'C' | 'A' | 'I';
type ReqId = `${Category}${number}`;          // nunca renumera; removido vai para Ruled out
type Requirement = { id: ReqId; text: string; parts: string[] } &
  ({ state: 'open' } | { state: 'settled'; verify: 'rule' | 'review' | 'component-test' });
type Crd = {
  kind: 'component' | 'template' | 'service'; name: string; summary: string;
  lifecycle: 'requested' | 'backlog' | 'active' | 'built' | 'deprecated'; replacement?: string;
  channels: string[]; themes?: string[]; fallback?: string; mimics: string[];
  anatomy: { name: string; binds?: { kind: 'slot' | 'part' | 'attr'; name: string } }[];
  requirements: Requirement[]; ruledOut: { text: string; why: string }[];
  outOfScope: { topic: string; owner: string }[]; decisions: { date: string; text: string; owner: string }[];
  examples: { kind: 'do' | 'dont'; code: string; violates: string[] }[];
};
function parseCrd(md: string, file: string): { crd: Crd } | { errors: { line: number; msg: string }[] };
function readiness(crd: Crd | null, api: Api | null): { state: 'ready' } | { state: 'blocked'; gaps: Gap[] };

// lib/validate.ts — único motor de GUARD
type Finding = { rule: RuleId; line: number; subject: Subject; message: string;
  fix?: { use: string; source: string }; suppressed?: string };
type Result = { findings: Finding[]; uses: Record<string, number> };   // uses → adoção e asserções das evals
function validate(code: string, ctx: { file: string; theme?: string; channel?: string }): Result;

// lib/observations.ts — único dono de .design-system/observations.jsonl
type Observation = { fp: string; rule: RuleId; subject: Subject; file: string; line: number; seenAt: string; catalog: string };
function status(o: Observation, catalog: Catalog): 'open' | 'resolved';   // calculado, nunca guardado
```

Invariantes que os tipos garantem: requisito `[open]` não pode ter verificação; status de gap e prontidão não existem
como campo; o formato bruto do CEM só é lido em `build-catalog` (o motor vê `values: string[]`).

## 5. Mapa de módulos

| | Arquivos |
|---|---|
| Novo | `lib/crd.ts`, `lib/validate.ts`, `lib/validate.test.ts` (`node:test`), `lib/observations.ts`, `lib/render.ts`, `scripts/check.ts` (`--hook=post\|stop`, `--ci`, `--record`), `tools/eval-summary.ts` (feito), `references/failure-modes.md`, gerados `references/gaps.md` e `llms.txt` |
| Muda | `tools/build-catalog.ts` (API completa do CEM com enums, usa `parseCrd`, gera bloco de regras do SKILL.md, lê observações), `lib/ops.ts`, `mcp/server.ts` (+`ds_validate`, +`ds_get_component`, −`ds_get_doc`), `hooks.json` (+Stop), os 4 CRDs (nova gramática, sem `status:`), `ds-reviewer.md` (roda `ds_validate`, decide cada `[review]` com evidência, ignora estilo), `auditing-design-system/SKILL.md`, `using-design-system/SKILL.md` (passo "valide antes de escrever"), README |
| Sai | `scripts/lint-ds.ts`, `status:` dos CRDs, `ds_get_doc`, passos manuais 2–4 da auditoria |

Superfície do MCP fica em 6 ferramentas: `ds_list`, `ds_find`, `ds_get_component`, `ds_validate`,
`ds_resolve_token`, `ds_check_contrast` (este passa a sugerir o token mais próximo que passa).

## 6. Sequência verificável

Cada passo termina num check. A ordem põe a medição cedo para que o resto seja julgado por número.

| # | Unidade | Check |
|---|---|---|
| 1 | ~~`eval-baseline.ts`~~ Feito com `claude plugin eval` (já roda o braço sem plugin) + `tools/eval-summary.ts` | Baseline gravada em `evals/results/baseline-v0.2/` (ver [Baseline v0.2](#baseline-v02)) |
| 2 | ✅ Catálogo com API completa (atributos com tipo e `values`, slots, eventos, parts) | `ds-button.variant` com 4 valores; build 2× só muda `generatedAt` |
| 3 | ✅ `parseCrd` (`lib/crd.ts`) + `button.crd.md` reescrito + `tools/fixtures/crd-malformed.md` | `node --test` 7/7; 8 erros com linha no fixture; catálogo igual |
| 4 | ✅ Outros 3 CRDs reescritos; `readiness()` (`lib/readiness.ts`) no build e no `ds_list` | build mostra `ds-bottom-sheet: no-crd`, `chip-premium` e `ds-button` bloqueados; 20 testes; evals 14/15 (ver abaixo) |
| 5 | ✅ `lib/validate.ts` (15 regras em `RULES`) + testes; exemplos dos CRDs viram teste | `node --test` passa; equivalência com o lint antigo provada antes de apagá-lo |
| 6 | ✅ `scripts/check.ts` (`--hook=post\|stop`, `--ci`, `--report`, `--stdin`) + `lib/render.ts`; `lint-ds.ts` apagado | Stop com violação emite `block`; repetido com `stop_hook_active` libera |
| 7 | ✅ MCP `ds_validate` e `ds_get_component` (`ds_get_doc` removido); `check_contrast` sugere token | teste stdio: `<ds-old-dialog>` → `ds-modal`; `ds-chip-premium` → `PARE: C1` |
| 8 | ✅ `lib/observations.ts`, `check.ts --record`, `build-catalog --observations` → `gaps.md` | `--record` 2× não duplica; componente adicionado ao CEM vira `Resolvidos` |
| 9 | ✅ `failure-modes.md`, reviewer ancorado no CRD, SKILL.md, 8 evals novas (6 de disparo, 1 de gap, 1 de decisão aberta) | `claude plugin validate .`; `rg lint-ds` vazio |
| 10 | ✅ Evals completas da v0.3 | ver [Resultado v0.3](#resultado-v03) |

Fora do núcleo sem dependências (CI opcional): auditoria do DOM renderizado com Playwright + axe por tema × canal,
`npx @google/design.md lint` e `diff` nos `DESIGN.*.md`, codemods de depreciação.

## 7. Rejeitado e por quê
- **ESLint/Stylelint como motor.** Trazem dependência e o caminho do Copilot via MCP precisaria de outra implementação.
  Fica como alvo futuro: o motor pode emitir regras para eles.
- **Log de discrepâncias com status guardado (o `system.json` da Jeen).** Status apodrece e ganha segundo escritor.
  Observação imutável + status calculado resolve os dois. Decisões humanas ficam no log de decisões do CRD.
- **Regex de regra dentro do markdown (desenho A).** Perde tipo e teste; a tabela TS com `RuleId` derivado não deixa
  regra sem teste.
- **Manter `ds_get_doc` ao lado de `ds_get_component`.** Duas formas de fazer a mesma coisa; o agente copia a primeira
  que achar.
- **Promover DESIGN.md a fonte.** O teste da Atlassian mostrou mais tokens e componente recriado. Continua só exportação.
- **Ferramenta "plano" única estilo `ads_plan`.** Interessante, mas sem baseline não dá para saber se paga o custo.
  Reavaliar depois do passo 10.

## 8. Perguntas abertas
1. `observations.jsonl` é commitado no repo de produto ou só artefato de CI?
2. `[open]` bloqueia o **uso** de um componente `built` em revisão, ou só a prontidão dele?
3. `unknown-tag` vindo do agente conta como demanda ou como alucinação no `gaps.md`?
4. `claude -p --output-format stream-json` reporta uso por execução de forma confiável para medir tokens? Não testado.
5. Code Connect do Figma suporta web components Stencil? Não verificado.

## 9. Fontes
Lidas pelos agentes de pesquisa nesta sessão. Ressalvas marcadas.

**Cassie Groos** (Medium e Design Systems Collective deram 403; texto lido pelo feed `https://medium.com/feed/@cassiegroos`)
- Probabilistic isn't a dirty word: https://www.designsystemscollective.com/probabilistic-isnt-a-dirty-word-37fa836bedd8
- The Design System Identity Crisis (Hatch 2026, só o resumo): https://vault.hatchconference.com/2026/the-design-system-identity-crisis/
- Também: "Context, context everywhere" (Config, 16/10/2026) e "Humans, humans everywhere" (Converge, 25/10/2026), via feed.
- Não achado nada com o título "Design Systems in the Age of Agents" citado no HANDOFF; o mais próximo é a palestra da Hatch.

**Jeen Suratriyanont** (Experience Designer, Thoughtworks)
- XConf Americas 2026, "Your design system has a new user: AI": https://www.jeensdesign.com/work/xconf-americas-2026
- Dogfooding My Design System: https://www.jeensdesign.com/diary/dogfooding-my-design-system/
- I Let AI Audit 10 Web Pages While I Made Tea: https://www.jeensdesign.com/diary/i-let-ai-audit-10-web-pages-while-i-made-tea/
- DESIGN.md, failure-modes e governance: https://github.com/wishayajeen/portfolio/blob/main/DESIGN.md

**Indústria**
- Atlassian, teste de DESIGN.md: https://www.atlassian.com/blog/ai-at-work/atlassians-design-md-is-here-what-we-learned-testing-portable-design-context-in-practice
- Atlassian llms.txt: https://atlassian.design/llms.txt
- Carbon MCP: https://carbondesignsystem.com/developing/carbon-mcp/onboarding-and-setup/ (descrição de `code_audit` só por snippet de busca)
- Storybook MCP: https://storybook.js.org/docs/ai/mcp/overview · boas práticas: https://storybook.js.org/docs/ai/best-practices
- Figma MCP: https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/
- Cloudscape: https://cloudscape.design/get-started/for-developers/ai-tools-support/
- shadcn registry MCP: https://ui.shadcn.com/docs/registry/mcp
- Builder.io: https://www.builder.io/blog/how-to-make-ai-agents-follow-your-design-system
- zeroheight MCP: https://zeroheight.com/mcp/

**Guardrails, evals, contexto**
- Brad Frost, Agentic Design Systems in 2026: https://bradfrost.com/blog/post/agentic-design-systems-in-2026/
- Radar Thoughtworks: https://www.thoughtworks.com/radar/techniques/progressive-context-disclosure · https://www.thoughtworks.com/radar/techniques/anchoring-coding-agents-to-a-reference-application
- Anthropic, Writing effective tools for agents: https://www.anthropic.com/engineering/writing-tools-for-agents
- Agent Skills, descriptions e evals: https://agentskills.io/skill-creation/optimizing-descriptions.md · https://agentskills.io/skill-creation/evaluating-skills.md
- Claude Code best practices: https://code.claude.com/docs/en/best-practices
- Chromatic MCP: https://www.chromatic.com/docs/mcp
- TJ Pitre, AI Proposes. The Design System Disposes: https://southleft.substack.com/p/ai-proposes-the-design-system-disposes
- The System Arguing With Itself (resume Murphy Trueman): https://designsystemscollective.substack.com/p/the-system-arguing-with-itself
- Hidde de Vries: https://hidde.blog/teaching-llms-or-companies/
- DTCG 2025.10 estável: https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/

## Baseline v0.2

Rodada em 2026-11-09 com `claude plugin eval` (3 execuções por braço, MCP real ligado, US$ 4,13).

**Mudança de plano.** O passo 1 previa um `eval-baseline.ts` próprio. O `claude plugin eval` já roda um braço sem
plugin e reporta Δ, turnos e custo por execução. Ficou só `tools/eval-summary.ts`, que resume e compara resultados.
As variantes "só skill" e "só MCP" não existem no comando; ficam de fora até alguma decisão depender delas.

| Caso | Plugin | Sem | Δ | Turnos (plugin/sem) | US$ (plugin/sem) |
|---|---|---|---|---|---|
| chip-premium-no-pj | 100% | 0% | +0.50 | 6.7 / 4.0 | 0.150 / 0.115 |
| dialogo-depreciado | 100% | 0% | +0.67 | 7.7 / 4.0 | 0.169 / 0.121 |
| icone-voltar | 100% | 0% | +1.00 | 5.3 / 3.7 | 0.117 / 0.112 |
| montar-tela-filtros | 100% | 0% | +1.00 | 15.7 / 4.0 | 0.304 / 0.125 |
| nao-dispara-fora-de-ui | 100% | 100% | 0.00 | 1.0 / 1.0 | 0.084 / 0.079 |

**O que o número não mede** (lido nos traces):
- **Sem `--allow-real-servers` o MCP do DS não sobe** e o braço com plugin roda só com scripts. O comando no
  `CLAUDE.md` já leva a flag.
- **O Δ de `montar-tela-filtros` mede acesso, não qualidade.** O sandbox está vazio; sem plugin o agente procura o DS,
  não acha e se recusa a criar o arquivo. É o comportamento certo, mas o +1.00 não diz nada sobre a tela.
- **`usa-template` passa por menção.** O agente montou a tela com `ds-modal` (porque `ds-bottom-sheet` não tem CRD) e
  citou `FilterSheetFlow` num comentário HTML, o que basta para o regex. O fixture se contradiz: o template manda usar
  `ds-bottom-sheet` e a skill proíbe item sem lifecycle `built`.
- **`sem-branch-de-tema` dava falso positivo** quando o agente citava a regra (`` `if (theme === 'pj')` ``). Corrigido
  para ignorar código inline; a primeira rodada marcava esse caso 50% com plugin.
- **O agente achou um gap real do fixture**: o CRD do `ds-chip-premium` aponta `ds-chip` como substituto, mas `ds-chip`
  não está no CEM. O agente disse isso em vez de inventar. É o `dangling-ref` que o desenho A previa.
- Evals com regex sobre a última mensagem são frágeis nos dois sentidos. É mais um motivo para o passo 5 usar o
  `validate()` como avaliador.

### Depois do passo 4 (`evals/results/v0.3-step4/`, só braço com plugin)
`node tools/eval-summary.ts evals/results/baseline-v0.2 evals/results/v0.3-step4`: 4 casos iguais (100%);
`montar-tela-filtros` caiu para 2/3. A execução que falhou parou sozinha em 14 turnos sem criar o arquivo (sem erro, longe
do limite de 25). Rodado de novo 3× com trace: 3/3. Somando, 5/6. Com essa amostra não dá para separar ruído de regressão;
o trace da falha não foi guardado. Hipótese não verificada: o agente terminou perguntando, já que o `ds_list` agora mostra
`ds-bottom-sheet` como `incompleto (no-crd)` e o template depende dele.

O build agora aponta gaps que o formato antigo escondia: `ds-button` cita `ds-link` e `ds-icon-button`, e
`ds-chip-premium` cita `ds-chip` e `ds-badge`, nenhum deles no CEM de exemplo.

## Resultado v0.3

`evals/results/v0.3-final/` (13 casos, 3 execuções por braço, MCP real, US$ 10,83). 100% com plugin, Δ médio +0.50.

| Caso | Plugin | Sem | Δ | Turnos (plugin/sem) |
|---|---|---|---|---|
| chip-premium-no-pj | 100% | 0% | +0.50 | 7.0 / 3.3 |
| decisao-aberta-chip | 100% | 33% | +0.67 | 5.0 / 3.0 |
| dialogo-depreciado | 100% | 0% | +0.67 | 7.0 / 4.0 |
| dispara-cor-erro | 100% | 0% | +1.00 | 9.7 / 3.0 |
| dispara-espacamento-cards | 100% | 0% | +1.00 | 9.7 / 3.0 |
| gap-tooltip | 100% | 33% | +0.67 | 15.3 / 3.0 |
| icone-voltar | 100% | 0% | +1.00 | 9.7 / 3.0 |
| montar-tela-filtros | 100% | 0% | +1.00 | 18.3 / 4.3 |
| 5 negativos "quase" | 100% | 100% | 0.00 | ~1 / ~1 |

**O que mudou no caminho** (rodada intermediária em `evals/results/v0.3/`, 90%):
- `chip-premium-no-pj` e `montar-tela-filtros` caíram para 33%. Nos traces o agente seguia as regras novas: o validador
  barrava `ds-chip`, que o CRD do `ds-chip-premium` e o `themes.md` indicavam mas não existia no CEM de exemplo; e o
  template `FilterSheetFlow` cita 4 componentes que não existem, então numa execução o agente se recusou a criar a tela.
- Correções: `ds-chip` entrou no CEM de exemplo com CRD `built` (os dados prometiam que ele existia), e o SKILL.md ganhou
  a regra "gap não bloqueia a entrega: entregue com o que existe e liste os gaps; só pare em decisão `[open]`".
  Essa regra é uma escolha de produto; o oposto (parar em todo gap) é defensável.
- O caso negativo `nao-dispara-teste-unitario` estourava o limite de 5 turnos (pedia para escrever arquivo sem Write).
  O prompt passou a pedir só a resposta; 3/3 sem erro depois.

**Custo do GUARD.** Nos 4 casos da v0.2 o custo médio por execução com plugin subiu em dois: `icone-voltar`
US$ 0,117 → 0,173 (5,3 → 9,7 turnos) e `montar-tela-filtros` 0,304 → 0,378. Inferido, não medido por chamada: o passo
"valide antes de escrever" acrescenta chamadas ao `ds_validate`. Os outros dois ficaram iguais.

**O que o número ainda não mede.** Os avaliadores continuam regex/LLM sobre a última mensagem; o passo seguinte natural
é usar o `validate()` como avaliador dos arquivos e blocos de código gerados (ideia do desenho B ainda não feita).
