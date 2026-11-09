// Prontidão de um componente: o que falta para o CRD + API serem confiáveis para o agente.
// Calculada no build a partir do CRD parseado e do CEM; nunca escrita à mão.
import type { Crd, ParseError } from './crd.ts';

export type Api = { attributes: string[]; events: string[]; slots: string[]; cssParts: string[]; deprecated: boolean };
export type Doc = { kind: 'missing' } | { kind: 'invalid'; errors: ParseError[] } | { kind: 'ok'; crd: Crd };
export type Entry = { name: string; doc: Doc; api: Api | null };
export type GapCode =
  | 'no-crd' | 'parse-error' | 'not-in-cem' | 'cem-deprecated'
  | 'open' | 'amending' | 'no-anatomy' | 'no-requirements'
  | 'unbound-part' | 'dangling-ref' | 'no-replacement';
export type Gap = { code: GapCode; detail: string };
export type Readiness = { state: 'ready' } | { state: 'blocked'; gaps: Gap[] };

const looksLikeDsName = (s: string) => s.startsWith('ds-') || /^(?:[A-Z][a-z0-9]+)+$/.test(s);

function hasBinding(api: Api, b: NonNullable<Crd['anatomy'][number]['binds']>): boolean {
  if (b.kind === 'slot') return api.slots.includes(b.name);
  if (b.kind === 'part') return api.cssParts.includes(b.name);
  return api.attributes.includes(b.name);
}

/** Calculada, nunca guardada à mão. `known` = todo nome do catálogo (componentes, templates, services). */
export function readiness(e: Entry, known: Set<string>): Readiness {
  const gaps: Gap[] = [];
  const add = (code: GapCode, detail: string) => {
    if (!gaps.some((g) => g.code === code && g.detail === detail)) gaps.push({ code, detail });
  };
  const done = (): Readiness => (gaps.length ? { state: 'blocked', gaps } : { state: 'ready' });

  if (e.doc.kind === 'missing') { add('no-crd', `${e.name} não tem CRD em references/components/`); return done(); }
  if (e.doc.kind === 'invalid') { for (const er of e.doc.errors) add('parse-error', `linha ${er.line}: ${er.msg}`); return done(); }
  const { crd } = e.doc;
  const { api } = e;

  if (!api) add('not-in-cem', `CRD de ${e.name} não tem componente no CEM`);
  else if (api.deprecated && crd.lifecycle !== 'deprecated') add('cem-deprecated', `CEM marca ${e.name} como deprecated, mas o CRD diz "${crd.lifecycle}"`);

  for (const r of crd.requirements) if (r.state === 'open') add('open', `${r.id}: ${r.text}`);
  for (const a of crd.amendment) add('amending', `${a.date} · ${a.text}`);

  if (crd.lifecycle === 'active' || crd.lifecycle === 'built') {
    if (!crd.anatomy.length) add('no-anatomy', 'seção Anatomia vazia');
    if (!crd.requirements.length) add('no-requirements', 'seção Requisitos vazia');
  }

  if (api)
    for (const p of crd.anatomy)
      if (p.binds && !hasBinding(api, p.binds))
        add('unbound-part', `parte "${p.name}" aponta para ${p.binds.kind} ${p.binds.name ? `"${p.binds.name}"` : 'default'}, que não existe na API`);

  if (crd.lifecycle === 'deprecated' && !crd.replacement) add('no-replacement', 'deprecated sem "replacement" no frontmatter');

  const refs = new Map<string, string[]>();
  if (crd.replacement) refs.set(crd.replacement, ['replacement']);
  for (const o of crd.outOfScope) refs.set(o.owner, [...(refs.get(o.owner) ?? []), `Fora de escopo, linha ${o.line}`]);
  for (const [name, where] of refs)
    if (looksLikeDsName(name) && !known.has(name)) add('dangling-ref', `${name} não existe no catálogo (${where.join('; ')})`);

  return done();
}
