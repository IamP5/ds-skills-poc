// Doc de um item do catálogo pronto para o agente: o que o DS sabe (requisitos, donos, exemplos, API),
// não a página inteira. Mesma função para a CLI (scripts/component.ts) e o MCP (ds_get_component).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCrd, type Crd } from './crd.ts';
import { loadCatalog, type CatalogItem } from './ops.ts';
import { closest } from './validate.ts';

export const SECTIONS = ['requisitos', 'anatomia', 'fora-de-escopo', 'descartado', 'decisoes', 'uso', 'exemplos', 'api', 'migracao'] as const;
export type Section = (typeof SECTIONS)[number];
export type ComponentView = { format: 'concise' | 'detailed'; sections?: Section[] };

const skillDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT: Section[] = ['requisitos', 'fora-de-escopo', 'descartado', 'exemplos', 'api', 'migracao'];

function nearNames(name: string, items: CatalogItem[]): string[] {
  const byKey = new Map(items.map((i) => [i.name.toLowerCase().replace(/^ds-/, ''), i.name]));
  return closest(name.toLowerCase().replace(/^ds-/, ''), [...byKey.keys()]).slice(0, 3).map((k) => byKey.get(k)!);
}

function header(item: CatalogItem): string {
  const life = item.replacement ? `${item.lifecycle} → ${item.replacement}` : item.lifecycle;
  const r = item.readiness;
  const ready = !r ? '' : r.state === 'ready' ? ' · prontidão: pronto'
    : ` · prontidão: incompleto (${[...new Set(r.gaps.map((g) => g.code))].join(', ')})`;
  return `${item.name} · ${life}${ready}`;
}

function apiLines(item: CatalogItem): string[] {
  const api = item.api;
  if (!api) return [];
  const out = api.attributes.map((a) => `- ${a.name}: ${a.values ? a.values.join('|') : a.type}`);
  if (api.slots.length) out.push(`- slots: ${api.slots.map((s) => s || '(default)').join(', ')}`);
  if (api.events.length) out.push(`- eventos: ${api.events.join(', ')}`);
  if (api.cssParts.length) out.push(`- parts: ${api.cssParts.join(', ')}`);
  return out;
}

function exampleLines(crd: Crd): string[] {
  const block = (e: Crd['examples'][number]) => {
    const body = e.code.split('\n').filter((l) => !/^\s*<!--\s*viola:/.test(l)).join('\n');
    return `${e.kind === 'do' ? 'Faça' : `Não faça (viola: ${e.violates.join(', ') || '?'})`}\n\`\`\`${e.lang}\n${body}\n\`\`\``;
  };
  return [...crd.examples.filter((e) => e.kind === 'do').slice(0, 1), ...crd.examples.filter((e) => e.kind === 'dont').slice(0, 2)].map(block);
}

function concise(item: CatalogItem, crd: Crd, sections: Section[]): string {
  const out = [header(item), item.summary];
  if (item.lifecycle === 'deprecated') {
    out.push(item.replacement ? `DEPRECIADO: use ${item.replacement}. Não escreva código novo com ${item.name}.` : `DEPRECIADO e sem substituto definido.`);
  }
  const open = crd.requirements.filter((r) => r.state === 'open').map((r) => r.id);
  if (open.length) {
    out.push(`PARE: ${open.join(', ')} ${open.length > 1 ? 'estão' : 'está'} [open] — devolva essa decisão ao humano antes de implementar algo que dependa dela.`);
  }
  const part = (title: string, lines: string[]) => { if (lines.length) out.push('', `## ${title}`, ...lines); };
  const bodies: Record<Section, () => void> = {
    requisitos: () => part('Requisitos', crd.requirements.map((r) =>
      `${r.id}${r.state === 'open' ? ' [open]' : r.review ? ' [review]' : ''} ${r.text}`)),
    anatomia: () => part('Anatomia', crd.anatomy.map((a) =>
      `- ${a.name}: ${a.description}${a.binds ? ` (${a.binds.kind} ${a.binds.name || 'default'})` : ''}`)),
    'fora-de-escopo': () => part('Fora de escopo', crd.outOfScope.map((o) => `- ${o.topic} → ${o.owner}`)),
    descartado: () => part('Descartado', crd.ruledOut.map((d) => `- ${d.text} (${d.why.replace(/\.$/, '')})`)),
    decisoes: () => part('Decisões', crd.decisions.map((d) => `- ${d.date} · ${d.text}${d.owner ? ` · ${d.owner}` : ''}`)),
    uso: () => part('Uso', crd.usage ? [crd.usage] : []),
    exemplos: () => part('Exemplos', exampleLines(crd)),
    api: () => part('API', apiLines(item)),
    migracao: () => part('Migração', crd.migration ? [crd.migration] : []),
  };
  const order: readonly Section[] = item.lifecycle === 'deprecated' ? ['migracao', ...SECTIONS.filter((s) => s !== 'migracao')] : SECTIONS;
  for (const s of order) if (sections.includes(s)) bodies[s]();
  return out.join('\n');
}

/** Doc de qualquer item do catálogo, pronto para o agente. Nome desconhecido → sugere nomes próximos. */
export function describe(name: string, view: ComponentView = { format: 'concise' }): { text: string; isError?: boolean } {
  const { items } = loadCatalog();
  const item = items.find((i) => i.name === name);
  if (!item) {
    const near = nearNames(name, items);
    return {
      isError: true,
      text: `Nenhum item "${name}" no catálogo.${near.length ? ` Você quis dizer: ${near.join(', ')}?` : ''} Busque por intenção com ds_find (CLI: scripts/find.ts) ou liste com ds_list.`,
    };
  }
  const bad = (view.sections ?? []).filter((s) => !SECTIONS.includes(s));
  if (bad.length) return { isError: true, text: `Seção desconhecida: ${bad.join(', ')}. Seções: ${SECTIONS.join(', ')}.` };

  if (!item.doc) {
    const api = apiLines(item);
    return { text: [header(item), item.summary, `⚠️ ${item.name} não tem doc: não há requisitos para seguir.`, ...(api.length ? ['', '## API', ...api] : [])].join('\n') };
  }
  const md = readFileSync(join(skillDir, item.doc), 'utf8');
  if (item.kind !== 'component') return { text: md };

  const parsed = parseCrd(md, item.doc);
  if (!parsed.ok) return { text: `⚠️ CRD inválido: ${parsed.errors.length} erro(s)\n${md}` };
  if (view.format === 'detailed') return { text: md };
  return { text: concise(item, parsed.crd, view.sections?.length ? view.sections : DEFAULT) };
}
