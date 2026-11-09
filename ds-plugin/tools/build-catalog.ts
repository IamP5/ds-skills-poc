#!/usr/bin/env node
// Build-time (CI do DS), não usado pelo agente.
// Gera data/catalog.json e a seção "API" de cada *.crd.md a partir das origens:
//
//   API dos componentes   → custom-elements.json (CEM, gerado pelo Stencil)
//   lifecycle, resumo,    → frontmatter dos CRDs / docs de template e service
//   canais, substituto      (escrito por pessoas: é a "origem" desses fatos)
//   prontidão             → calculada do CRD parseado + CEM (lib/readiness.ts)
//   references/gaps.md    → observations.jsonl dos produtos (só com --observations; sem a flag não é tocado)
//
// Uso: node tools/build-catalog.ts --cem=dist/custom-elements.json [--observations=<pasta-ou-jsonl>[,...]] [--out=<pasta da skill>]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_MARK, parseCrd, parseFrontmatter } from '../skills/using-design-system/scripts/lib/crd.ts';
import { readObservations, renderGaps, type Observation } from '../skills/using-design-system/scripts/lib/observations.ts';
import type { ApiAttr, CatalogApi } from '../skills/using-design-system/scripts/lib/ops.ts';
import { readiness, type Api, type Doc, type Readiness } from '../skills/using-design-system/scripts/lib/readiness.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name: string) => process.argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
// --out existe para o teste rodar numa cópia: os outros testes leem o catalog.json real em paralelo.
const skill = arg('out')[0] ?? join(root, 'skills/using-design-system');
const refs = join(skill, 'references');
const cemPath = arg('cem')[0] ?? join(root, 'tools/fixtures/custom-elements.json');
const observationPaths = arg('observations').flatMap((v) => v.split(',')).filter(Boolean);

const readDocs = (dir: string) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => ({ file: f, md: readFileSync(join(dir, f), 'utf8') })) : [];

// ---------- CEM ----------
type Decl = { tagName: string; description?: string; deprecated?: string | boolean; attributes?: any[]; events?: any[]; slots?: any[]; cssParts?: any[] };
const cem = JSON.parse(readFileSync(cemPath, 'utf8'));
const decls: Decl[] = cem.modules.flatMap((m: any) => m.declarations ?? []).filter((d: any) => d.customElement && d.tagName);

const esc = (s = '') => String(s).replace(/\|/g, '\\|').split('\n')[0];

function apiSection(d: Decl): string {
  const t = (rows: string[], head: string) => (rows.length ? [head, ...rows].join('\n') : '_nenhum_');
  return [
    API_MARK, '', '## API (gerado do CEM)', '',
    '### Atributos',
    t((d.attributes ?? []).map((a) => `| \`${a.name}\` | \`${esc(a.type?.text)}\` | ${a.default ? `\`${esc(a.default)}\`` : '—'} | ${esc(a.description)} |`),
      '| Atributo | Tipo | Default | Descrição |\n|---|---|---|---|'),
    '', '### Eventos',
    t((d.events ?? []).map((e) => `| \`${e.name}\` | \`${esc(e.type?.text)}\` | ${esc(e.description)} |`), '| Evento | Tipo | Quando |\n|---|---|---|'),
    '', '### Slots',
    t((d.slots ?? []).map((s) => `| ${s.name ? `\`${s.name}\`` : '(default)'} | ${esc(s.description)} |`), '| Slot | Uso |\n|---|---|'),
    '', '### CSS parts',
    t((d.cssParts ?? []).map((p) => `| \`${p.name}\` | ${esc(p.description)} |`), '| Part | O que é |\n|---|---|'),
    '',
  ].join('\n');
}

const items: any[] = [];
const extras: any[] = [];
for (const [kind, folder, key] of [['template', 'templates', 'template'], ['service', 'services', 'service']] as const) {
  for (const doc of readDocs(join(refs, folder))) {
    const fm = parseFrontmatter(doc.md);
    extras.push({
      kind, name: fm[key], summary: fm.summary ?? '', lifecycle: fm.lifecycle ?? 'sem-lifecycle',
      ...(fm.replacement && { replacement: fm.replacement }),
      channels: fm.channels ?? ['*'], tags: fm.tags ?? [], doc: `references/${folder}/${doc.file}`,
    });
  }
}
const known = new Set<string>([...decls.map((d) => d.tagName), ...extras.map((i) => i.name)]);

const crds = new Map(readDocs(join(refs, 'components')).map((d) => [parseFrontmatter(d.md).component, d]));
const docOf = (file: string, md: string): Doc => {
  const r = parseCrd(md, file);
  return r.ok ? { kind: 'ok', crd: r.crd } : { kind: 'invalid', errors: r.errors };
};
// Só união pura de literais string vira enum: `'a' | 'b'`. Qualquer outra coisa (boolean, string, `'a' | undefined`) não.
function enumValues(text: string | undefined): string[] | undefined {
  if (!text) return undefined;
  const members = text.split('|').map((m) => m.trim().match(/^'([^']*)'$|^"([^"]*)"$/));
  return members.every(Boolean) ? members.map((m) => m![1] ?? m![2]) : undefined;
}
const catalogApiOf = (d: Decl): CatalogApi => ({
  attributes: (d.attributes ?? []).map((a): ApiAttr => {
    const values = enumValues(a.type?.text);
    return { name: a.name, type: a.type?.text ?? '', ...(values && { values }) };
  }),
  events: (d.events ?? []).map((e) => e.name),
  slots: (d.slots ?? []).map((s) => s.name ?? ''),
  cssParts: (d.cssParts ?? []).map((p) => p.name),
});
const readinessApiOf = (api: CatalogApi, d: Decl): Api => ({ ...api, attributes: api.attributes.map((a) => a.name), deprecated: !!d.deprecated });
const report: { name: string; doc: Doc; readiness: Readiness }[] = [];

for (const d of decls) {
  const file = crds.get(d.tagName);
  const doc: Doc = file ? docOf(`references/components/${file.file}`, file.md) : { kind: 'missing' };
  const api = catalogApiOf(d);
  const r = readiness({ name: d.tagName, doc, api: readinessApiOf(api, d) }, known);
  report.push({ name: d.tagName, doc, readiness: r });
  const fm: Record<string, any> = doc.kind === 'ok' ? doc.crd : file ? parseFrontmatter(file.md) : {};
  items.push({
    kind: 'component',
    name: d.tagName,
    summary: fm.summary ?? esc(d.description),
    lifecycle: fm.lifecycle ?? (d.deprecated ? 'deprecated' : 'sem-lifecycle'),
    ...(fm.replacement && { replacement: fm.replacement }),
    channels: fm.channels ?? ['*'],
    ...(fm.themes && { themes: fm.themes }),
    tags: fm.tags ?? [],
    ...(doc.kind === 'ok' && doc.crd.mimics.length && { mimics: doc.crd.mimics }),
    ...(file && { doc: `references/components/${file.file}` }),
    api,
    readiness: r,
  });
  if (file) {
    const intent = file.md.includes(API_MARK) ? file.md.slice(0, file.md.indexOf(API_MARK)) : `${file.md.trimEnd()}\n\n`;
    writeFileSync(join(refs, 'components', file.file), intent + apiSection(d));
  }
}
for (const [tag, file] of crds) {
  if (decls.some((d) => d.tagName === tag)) continue;
  const doc = docOf(`references/components/${file.file}`, file.md);
  report.push({ name: tag ?? file.file, doc, readiness: readiness({ name: tag ?? file.file, doc, api: null }, known) });
}
items.push(...extras);

writeFileSync(join(skill, 'data/catalog.json'), JSON.stringify({ generatedAt: new Date().toISOString(), source: { cem: 'custom-elements.json' }, items }, null, 2) + '\n');
console.log(`catalog.json: ${items.length} itens (${decls.length} componentes do CEM)`);
if (observationPaths.length) {
  const observations: Observation[] = [];
  let malformed = 0;
  for (const path of observationPaths) {
    if (!existsSync(path)) console.error(`aviso: ${path} não existe`);
    const r = readObservations(path);
    observations.push(...r.observations);
    malformed += r.malformed;
  }
  writeFileSync(join(refs, 'gaps.md'), renderGaps(observations, { items }));
  console.log(`gaps.md: ${observations.length} observação(ões)${malformed ? `, ${malformed} linha(s) malformada(s) ignorada(s)` : ''}`);
}
console.log('Prontidão:');
for (const { name, readiness: r } of report)
  console.log(r.state === 'ready' ? `  ✅ ${name}` : [`  ⛔ ${name}`, ...r.gaps.map((g) => `      - ${g.code}: ${g.detail}`)].join('\n'));
const parseErrors = report.flatMap(({ doc }) => (doc.kind === 'invalid' ? doc.errors : []));
if (parseErrors.length) console.log('Erros de parse:\n' + parseErrors.map((e) => `  ${e.file}:${e.line}: ${e.msg}`).join('\n'));
