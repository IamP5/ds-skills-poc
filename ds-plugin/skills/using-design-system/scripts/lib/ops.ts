// Operações do DS usadas tanto pelos scripts (CLI) quanto pelo servidor MCP.
// Uma implementação só: o MCP é uma porta de entrada, não uma segunda fonte de lógica.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Readiness } from './readiness.ts';
import { buildTree, expandInputs, format, getNode, hexOf, isPrimitive, listTokens, resolve, type Inputs } from './tokens.ts';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');

/** `values` só existe quando o tipo no CEM é união pura de literais string. */
export type ApiAttr = { name: string; type: string; values?: string[] };
/** Slot `''` = default. */
export type CatalogApi = { attributes: ApiAttr[]; events: string[]; slots: string[]; cssParts: string[] };
export type CatalogItem = {
  kind: 'component' | 'template' | 'service';
  name: string;
  summary: string;
  lifecycle: string;
  replacement?: string;
  channels: string[];
  themes?: string[];
  tags: string[];
  mimics?: string[];
  doc?: string;
  api?: CatalogApi;
  readiness?: Readiness;
};
export type Asset = { type: string; name: string; tags: string[]; themes?: string[]; usage: string };

export const loadCatalog = (): { generatedAt: string; items: CatalogItem[] } =>
  JSON.parse(readFileSync(join(dataDir, 'catalog.json'), 'utf8'));
const loadAssets = (): Asset[] => JSON.parse(readFileSync(join(dataDir, 'assets.json'), 'utf8'));

const KIND: Record<string, CatalogItem['kind']> = { components: 'component', templates: 'template', services: 'service' };

// ---------- list ----------
export function list(kind: string, opts: { lifecycle?: string } = {}): string {
  const k = KIND[kind] ?? (kind as CatalogItem['kind']);
  const items = loadCatalog().items.filter((i) => i.kind === k && (!opts.lifecycle || i.lifecycle === opts.lifecycle));
  if (!items.length) return `Nenhum item do tipo "${kind}". Tipos: components, templates, services.`;
  const rows = items.map((i) => {
    const base = i.lifecycle === 'deprecated' && i.replacement ? `deprecated → ${i.replacement}` : i.lifecycle;
    const r = i.readiness;
    const life = r?.state === 'blocked' ? `${base} · incompleto (${[...new Set(r.gaps.map((g) => g.code))].join(', ')})` : base;
    const ctx = [i.channels.join(','), i.themes ? `temas:${i.themes.join(',')}` : ''].filter(Boolean).join(' ');
    return `| \`${i.name}\` | ${i.summary} | ${life} | ${ctx} | ${i.doc ?? '⚠️ sem doc'} |`;
  });
  return [`| Nome | Resumo | Lifecycle | Contexto | Doc |`, `|---|---|---|---|---|`, ...rows].join('\n');
}

// ---------- find ----------
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function find(query: string, opts: { type?: string; theme?: string; limit?: number } = {}): string {
  const terms = norm(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return 'Informe uma intenção, ex.: "seta voltar".';
  const pool = [
    ...loadAssets().map((a) => ({ type: a.type, name: a.name, tags: a.tags, themes: a.themes, out: a.usage })),
    ...loadCatalog().items.map((i) => ({
      type: i.kind, name: i.name, tags: [...i.tags, ...i.summary.split(/\s+/)], themes: i.themes,
      out: `${i.lifecycle}${i.replacement ? ` → ${i.replacement}` : ''} · ${i.doc ?? ''}`,
    })),
  ];
  const hits = pool
    .filter((e) => !opts.type || e.type === opts.type)
    .filter((e) => !opts.theme || !e.themes || e.themes.includes(opts.theme))
    .map((e) => {
      const hay = [e.name, ...e.tags].map(norm);
      const score = terms.reduce((s, t) => s + (hay.includes(t) ? 3 : hay.some((h) => h.includes(t)) ? 1 : 0), 0);
      return { e, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 5);
  if (!hits.length) return `Nenhum resultado para "${query}". Não invente: sinalize que isso não existe no DS.`;
  return hits
    .map(({ e }) => `${e.type.padEnd(12)} ${e.name.padEnd(24)} ${e.out}${e.themes ? ` [temas: ${e.themes.join(', ')}]` : ''}`)
    .join('\n');
}

// ---------- resolve token ----------
export function resolveToken(token: string, ctx: { theme?: string; channel?: string } = {}): string {
  const lines: string[] = [];
  if (isPrimitive(token)) lines.push(`⚠️ "${token}" é primitivo. Em código de produto use um token semântico (references/tokens.md).`);
  for (const inputs of expandInputs(ctx)) {
    const { tree, inputs: used } = buildTree(inputs);
    const label = Object.entries(used).map(([k, v]) => `${k}=${v}`).join(' ');
    try {
      const r = resolve(tree, token);
      lines.push(`${label.padEnd(26)} ${format(r.value, r.type).padEnd(28)} ${r.chain.join(' → ')}`);
    } catch (e) {
      lines.push(`${label.padEnd(26)} ${(e as Error).message}`);
    }
  }
  return lines.join('\n');
}

// ---------- contrast ----------
const lum = (hex: string) => {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrastRatio = (a: string, b: string) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

export function checkContrast(fg: string, bg: string, ctx: { theme?: string; channel?: string; large?: boolean } = {}) {
  const min = ctx.large ? 3 : 4.5;
  let ok = true;
  const lines: string[] = [];
  const trees = expandInputs({ theme: ctx.theme ?? 'all', channel: ctx.channel }).map((i) => buildTree(i as Inputs));
  for (const { tree, inputs: used } of trees) {
    const ratio = contrastRatio(hexOf(resolve(tree, fg)), hexOf(resolve(tree, bg)));
    const pass = ratio >= min;
    ok &&= pass;
    lines.push(`${`theme=${used.theme}`.padEnd(16)} ${ratio.toFixed(2)}:1  ${pass ? '✅ AA' : `❌ abaixo de ${min}:1`}`);
  }
  if (!ok) {
    const worst = (token: string) => Math.min(...trees.map(({ tree }) => contrastRatio(hexOf(resolve(tree, token)), hexOf(resolve(tree, bg)))));
    const passing = listTokens(trees[0].tree, 'color.text')
      .filter((t) => t !== fg && trees.every(({ tree }) => getNode(tree, t)))
      .map((t) => ({ t, r: worst(t) }))
      .filter((x) => x.r >= min)
      .sort((a, b) => b.r - a.r)
      .slice(0, 2);
    lines.push(passing.length
      ? `Sugestão: ${passing.map((x) => `${x.t} (mín. ${x.r.toFixed(1)}:1)`).join(', ')}`
      : `Sugestão: nenhum color.text.* passa ${min}:1 sobre ${bg} em todos os contextos pedidos; leve o caso ao time do DS.`);
  }
  return { ok, text: lines.join('\n') };
}
