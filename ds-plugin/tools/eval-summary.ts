#!/usr/bin/env node
// Resume o aggregate-result.json gerado por `claude plugin eval` em tabela markdown.
//
// Uso: node tools/eval-summary.ts <pasta-ou-json>             # um resultado
//      node tools/eval-summary.ts <antes> <depois>            # comparação por caso
// Uma pasta vale como <pasta>/aggregate-result.json.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

type CaseSummary = {
  name: string;
  passWith: number;
  passWithout: number | null;
  delta: number | null;
  turnsWith: number;
  turnsWithout: number | null;
  costWith: number;
  costWithout: number | null;
  fired: number | null;
  errors: string[];
};
type RunSummary = { cases: Map<string, CaseSummary>; passRate: number; meanDelta: number | null; costUsd: number };

const DASH = '—';

function fail(msg: string): never {
  console.error(`eval-summary: ${msg}`);
  process.exit(1);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function resolvePath(arg: string): string {
  try {
    return statSync(arg).isDirectory() ? join(arg, 'aggregate-result.json') : arg;
  } catch {
    return fail(`caminho não encontrado: ${arg}`);
  }
}

function load(arg: string): RunSummary {
  const file = resolvePath(arg);
  let raw: any;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    return fail(`não consegui ler ${file}: ${(e as Error).message}`);
  }
  if (raw?.schemaVersion !== 1) {
    fail(`schemaVersion ${JSON.stringify(raw?.schemaVersion)} não suportado em ${file} (esperado 1)`);
  }

  const cases = new Map<string, CaseSummary>();
  for (const c of raw.cases ?? []) {
    const withRuns: any[] = c.arms?.with ?? [];
    const withoutRuns: any[] | null = c.arms?.without?.length ? c.arms.without : null;
    const errors = [
      ...withRuns.filter((r) => r.error).map(() => `${c.name} (plugin)`),
      ...(withoutRuns ?? []).filter((r) => r.error).map(() => `${c.name} (sem)`),
    ];
    const hasGate = withRuns.some((r) => r.graders?.some((g: any) => g.withOnly));
    const fired = hasGate
      ? withRuns.filter((r) => r.graders.filter((g: any) => g.withOnly).every((g: any) => g.passed)).length / withRuns.length
      : null;
    cases.set(c.name, {
      name: c.name,
      passWith: c.aggregates?.passRate ?? 0,
      passWithout: withoutRuns ? (c.aggregates?.passRateWithout ?? null) : null,
      delta: withoutRuns ? (c.aggregates?.delta ?? null) : null,
      turnsWith: mean(withRuns.map((r) => r.turns ?? 0)),
      turnsWithout: withoutRuns ? mean(withoutRuns.map((r) => r.turns ?? 0)) : null,
      costWith: mean(withRuns.map((r) => r.costUsd ?? 0)),
      costWithout: withoutRuns ? mean(withoutRuns.map((r) => r.costUsd ?? 0)) : null,
      fired,
      errors,
    });
  }
  return {
    cases,
    passRate: raw.aggregates?.overallPassRate ?? 0,
    meanDelta: raw.aggregates?.meanDelta ?? null,
    costUsd: raw.costUsd ?? 0,
  };
}

const pct = (n: number | null) => (n === null ? DASH : `${Math.round(n * 100)}%`);
const delta = (n: number | null) => (n === null ? DASH : `${n > 0 ? '+' : ''}${n.toFixed(2)}`);
const turns = (n: number | null) => (n === null ? DASH : n.toFixed(1));
const cost = (n: number | null) => (n === null ? DASH : n.toFixed(3));
const pair = (a: string, b: string) => `${a} / ${b}`;
const arrow = (a: string, b: string) => `${a} → ${b}`;
const table = (head: string[], rows: string[][]) =>
  [head, head.map(() => '---'), ...rows].map((r) => `| ${r.join(' | ')} |`).join('\n');

function renderSummary(run: RunSummary): string {
  const rows = [...run.cases.values()].map((c) => [
    c.name,
    pct(c.passWith),
    pct(c.passWithout),
    delta(c.delta),
    pair(turns(c.turnsWith), turns(c.turnsWithout)),
    pair(cost(c.costWith), cost(c.costWithout)),
    pct(c.fired),
  ]);
  const head = ['Caso', 'Passa (plugin)', 'Passa (sem)', 'Δ score', 'Turnos (plugin/sem)', 'Custo US$ (plugin/sem)', 'Plugin disparou'];
  const errors = [...run.cases.values()].flatMap((c) => c.errors);
  return [
    table(head, rows),
    '',
    `Total: passa ${pct(run.passRate)} | Δ médio ${delta(run.meanDelta)} | custo US$ ${cost(run.costUsd)} | runs com erro: ${errors.length}${errors.length ? ` (${errors.join(', ')})` : ''}`,
  ].join('\n');
}

function renderComparison(before: RunSummary, after: RunSummary): string {
  const names = [...new Set([...before.cases.keys(), ...after.cases.keys()])];
  const side = <T>(b: CaseSummary | undefined, a: CaseSummary | undefined, f: (c: CaseSummary) => T, fmt: (v: T) => string) =>
    b && a ? arrow(fmt(f(b)), fmt(f(a))) : DASH;
  const rows = names.map((name) => {
    const b = before.cases.get(name);
    const a = after.cases.get(name);
    const worse = b && a && a.passWith < b.passWith ? ' ⚠' : '';
    return [
      name,
      side(b, a, (c) => c.passWith, pct) + worse,
      side(b, a, (c) => c.delta, delta),
      side(b, a, (c) => c.turnsWith, turns),
      side(b, a, (c) => c.costWith, cost),
    ];
  });
  const head = ['Caso', 'Passa antes→depois', 'Δ antes→depois', 'Turnos antes→depois', 'Custo US$ antes→depois'];
  return [
    table(head, rows),
    '',
    `Total: passa ${arrow(pct(before.passRate), pct(after.passRate))} | custo US$ ${arrow(cost(before.costUsd), cost(after.costUsd))}`,
  ].join('\n');
}

const args = process.argv.slice(2);
if (args.length < 1 || args.length > 2) {
  fail('uso: node tools/eval-summary.ts <pasta-ou-json> [<depois>]');
}
console.log(args.length === 1 ? renderSummary(load(args[0])) : renderComparison(load(args[0]), load(args[1])));
