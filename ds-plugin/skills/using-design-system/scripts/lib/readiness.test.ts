import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCrd, type Crd } from './crd.ts';
import { readiness, type Api, type Entry, type GapCode, type Readiness } from './readiness.ts';

const crdOf = (md: string): Crd => {
  const r = parseCrd(md, 'x.crd.md');
  assert.ok(r.ok, `esperava parse ok, veio: ${JSON.stringify(!r.ok && r.errors)}`);
  return r.crd;
};
const fm = (lifecycle: string, extra = '') => `---\ncomponent: ds-x\nsummary: s\nlifecycle: ${lifecycle}\n${extra}---\n`;
const COMPLETE = '## Anatomia\n- `rotulo`: texto (slot default)\n## Requisitos\n### F · Funcional\n- F1 Faz algo com o `rotulo`.\n';
const api = (over: Partial<Api> = {}): Api => ({ attributes: [], events: [], slots: [''], cssParts: [], deprecated: false, ...over });
const known = new Set(['ds-x', 'ds-modal', 'OverlayStack']);
const entry = (md: string, a: Api | null = api()): Entry => ({ name: 'ds-x', doc: { kind: 'ok', crd: crdOf(md) }, api: a });
const codes = (r: Readiness): GapCode[] => (r.state === 'blocked' ? r.gaps.map((g) => g.code) : []);
const details = (r: Readiness): string[] => (r.state === 'blocked' ? r.gaps.map((g) => g.detail) : []);

test('CRD completo e amarrado à API fica ready', () => {
  assert.deepEqual(readiness(entry(fm('built') + COMPLETE), known), { state: 'ready' });
});

test('no-crd: sem documento para o componente, e para por aí', () => {
  const r = readiness({ name: 'ds-x', doc: { kind: 'missing' }, api: null }, known);
  assert.deepEqual(codes(r), ['no-crd']);
});

test('parse-error: um gap por erro, com a linha, e para por aí', () => {
  const p = parseCrd(fm('built') + '## Changelog\n## Descartado\n- sem motivo\n', 'x.crd.md');
  assert.ok(!p.ok);
  const r = readiness({ name: 'ds-x', doc: { kind: 'invalid', errors: p.errors }, api: null }, known);
  assert.deepEqual(codes(r), ['parse-error', 'parse-error']);
  assert.match(details(r)[0], /^linha 6: seção desconhecida/);
  assert.match(details(r)[1], /^linha 8: Descartado/);
});

test('not-in-cem: CRD sem componente no CEM; não acusa unbound-part sem API', () => {
  const r = readiness(entry(fm('built') + COMPLETE.replace('(slot default)', '(slot `inexistente`)'), null), known);
  assert.deepEqual(codes(r), ['not-in-cem']);
});

test('cem-deprecated: CEM depreciou mas o CRD não', () => {
  assert.deepEqual(codes(readiness(entry(fm('built') + COMPLETE, api({ deprecated: true })), known)), ['cem-deprecated']);
  const dep = entry(fm('deprecated', 'replacement: ds-modal\n'), api({ deprecated: true }));
  assert.deepEqual(readiness(dep, known), { state: 'ready' });
});

test('open: cada requisito [open] vira gap com ID e texto', () => {
  const md = fm('built') + COMPLETE + '- F2 [open] Deve aceitar `href`?\n- F3 [review] Revisado.\n';
  const r = readiness(entry(md), known);
  assert.deepEqual(codes(r), ['open']);
  assert.deepEqual(details(r), ['F2: Deve aceitar `href`?']);
});

test('amending: emenda em andamento bloqueia', () => {
  const md = fm('built') + '## Emenda\n- 2026-11-01 · aceitar ícone\n' + COMPLETE;
  const r = readiness(entry(md), known);
  assert.deepEqual(codes(r), ['amending']);
  assert.match(details(r)[0], /2026-11-01 · aceitar ícone/);
});

test('no-anatomy e no-requirements só para active/built', () => {
  assert.deepEqual(codes(readiness(entry(fm('active')), known)), ['no-anatomy', 'no-requirements']);
  assert.deepEqual(codes(readiness(entry(fm('built')), known)), ['no-anatomy', 'no-requirements']);
  for (const draft of ['requested', 'backlog']) assert.deepEqual(readiness(entry(fm(draft)), known), { state: 'ready' });
});

test('unbound-part: binding que não existe em slots, parts ou atributos do CEM', () => {
  const md = fm('built') + '## Anatomia\n- `rotulo`: texto (slot default)\n- `rodape`: ações (slot `footer`)\n'
    + '- `nativo`: o elemento interno (part `native`)\n- `tamanho`: largura (attr `size`)\n'
    + '## Requisitos\n### F · Funcional\n- F1 Faz algo.\n';
  const r = readiness(entry(md, api({ slots: [''], cssParts: [], attributes: ['size'] })), known);
  assert.deepEqual(codes(r), ['unbound-part', 'unbound-part']);
  assert.match(details(r)[0], /"rodape".*slot "footer"/);
  assert.match(details(r)[1], /"nativo".*part "native"/);
  assert.deepEqual(readiness(entry(md, api({ slots: ['', 'footer'], cssParts: ['native'], attributes: ['size'] })), known), { state: 'ready' });
});

test('dangling-ref: replacement e donos de Fora de escopo com cara de nome do DS que não existem', () => {
  const md = fm('built') + COMPLETE
    + '## Fora de escopo\n- Status → `ds-badge`\n- Outro status → `ds-badge`\n- Empilhar → `OverlayStack`\n'
    + '- Fluxo → `MissingFlow`\n- Conteúdo longo → `página`\n';
  const r = readiness(entry(md), known);
  assert.deepEqual(codes(r), ['dangling-ref', 'dangling-ref']);
  assert.match(details(r)[0], /^ds-badge não existe no catálogo/);
  assert.match(details(r)[1], /^MissingFlow /);
  const dep = readiness(entry(fm('deprecated', 'replacement: ds-sumiu\n')), known);
  assert.deepEqual(codes(dep), ['dangling-ref']);
  assert.match(details(dep)[0], /replacement/);
});

test('no-replacement: deprecated sem substituto', () => {
  assert.deepEqual(codes(readiness(entry(fm('deprecated')), known)), ['no-replacement']);
});

test('gaps na ordem das regras', () => {
  const md = fm('built') + '## Emenda\n- 2026-11-01 · revisão\n## Requisitos\n### F · Funcional\n- F1 [open] Algo?\n'
    + '## Fora de escopo\n- X → `ds-nada`\n';
  const r = readiness(entry(md, api({ deprecated: true })), known);
  assert.deepEqual(codes(r), ['cem-deprecated', 'open', 'amending', 'no-anatomy', 'dangling-ref']);
});
