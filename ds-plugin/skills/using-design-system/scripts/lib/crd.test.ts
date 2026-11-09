import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseCrd, type Crd, type ParseError } from './crd.ts';

const here = dirname(fileURLToPath(import.meta.url));
const buttonMd = readFileSync(join(here, '../../references/components/button.crd.md'), 'utf8');
const malformedMd = readFileSync(join(here, '../../../../tools/fixtures/crd-malformed.md'), 'utf8');

const ok = (md: string, file = 'x.crd.md'): Crd => {
  const r = parseCrd(md, file);
  assert.ok(r.ok, `esperava parse ok, veio: ${JSON.stringify(!r.ok && r.errors)}`);
  return r.crd;
};
const errorsOf = (md: string, file = 'x.crd.md'): ParseError[] => {
  const r = parseCrd(md, file);
  assert.ok(!r.ok, 'esperava erros');
  return r.errors;
};
const lineOf = (md: string, needle: string) => {
  const i = md.split('\n').findIndex((l) => l.includes(needle));
  assert.ok(i >= 0, `fixture não contém "${needle}"`);
  return i + 1;
};

test('button.crd.md: parse ok com os requisitos esperados', () => {
  const crd = ok(buttonMd, 'button.crd.md');
  assert.equal(crd.name, 'ds-button');
  assert.equal(crd.lifecycle, 'built');
  assert.deepEqual(crd.mimics, ['<button']);
  assert.deepEqual(crd.requirements.map((r) => r.id), ['F1', 'F2', 'S1', 'B1', 'B2', 'C1', 'C2', 'A1']);
  assert.equal(crd.requirements.filter((r) => r.state === 'open').length, 0);
  const b1 = crd.requirements.find((r) => r.id === 'B1');
  assert.ok(b1 && b1.state === 'settled' && b1.review);
  assert.deepEqual(crd.requirements.find((r) => r.id === 'C1')?.parts, ['icone-inicio', 'icone-fim', 'label']);
  assert.deepEqual(crd.requirements.find((r) => r.id === 'A1')?.parts, []);
});

test('button.crd.md: anatomia amarrada a slots, part e attr reais', () => {
  const binds = Object.fromEntries(ok(buttonMd).anatomy.map((p) => [p.name, p.binds]));
  assert.deepEqual(binds, {
    label: { kind: 'slot', name: '' },
    'icone-inicio': { kind: 'slot', name: 'start' },
    'icone-fim': { kind: 'slot', name: 'end' },
    nativo: { kind: 'part', name: 'native' },
    variante: { kind: 'attr', name: 'variant' },
  });
});

test('button.crd.md: decisões com dono, escopo e exemplos com violações', () => {
  const crd = ok(buttonMd);
  assert.deepEqual(crd.decisions.map((d) => [d.date, d.owner]), [['2026-01-15', '@time-ds'], ['2026-03-01', '@time-a11y']]);
  assert.deepEqual(crd.outOfScope.map((o) => o.owner), ['ds-link', 'ds-icon-button']);
  assert.ok(crd.ruledOut.length >= 2 && crd.ruledOut.every((r) => r.why));
  assert.ok(crd.examples.some((e) => e.kind === 'do'));
  const donts = crd.examples.filter((e) => e.kind === 'dont');
  assert.ok(donts.length > 0 && donts.every((e) => e.violates.length > 0));
  assert.ok(donts.flatMap((e) => e.violates).includes('system#raw-color'));
  const ids = new Set(crd.requirements.map((r) => r.id as string));
  for (const v of donts.flatMap((e) => e.violates)) assert.ok(v.includes('#') || ids.has(v), `violação ${v} não é requisito`);
});

test('button.crd.md: ignora tudo a partir do marcador da API', () => {
  const crd = ok(buttonMd);
  assert.ok(!crd.usage.includes('Atributos'));
});

test('fixture malformada: cada problema com a linha certa', () => {
  const errors = errorsOf(malformedMd, 'crd-malformed.md');
  const expect = (needle: string, pattern: RegExp) => {
    const line = lineOf(malformedMd, needle);
    assert.ok(
      errors.some((e) => e.line === line && pattern.test(e.msg) && e.file === 'crd-malformed.md'),
      `faltou erro ${pattern} na linha ${line}; veio ${JSON.stringify(errors)}`,
    );
  };
  expect('lifecycle: pronto', /lifecycle/);
  expect('- F1 Outra coisa', /duplicado/);
  expect('- S2 ', /deve começar com F/);
  expect('[open] [review]', /\[open\] e \[review\]/);
  expect('- Prop `cor` livre', /motivo/);
  expect('2026-13-40', /data inválida/);
  expect('## Changelog', /seção desconhecida/);
  expect('<!-- viola: F1 -->', /Faça/);
});

test('CRD só com frontmatter é válido: vazio é informação', () => {
  const crd = ok('---\ncomponent: ds-novo\nsummary: Ainda em discussão\nlifecycle: requested\n---\n');
  assert.equal(crd.lifecycle, 'requested');
  assert.deepEqual(crd.channels, ['*']);
  assert.deepEqual([crd.requirements, crd.anatomy, crd.examples, crd.mimics], [[], [], [], []]);
});

test('[open] vira state open', () => {
  const md = '---\ncomponent: ds-x\nsummary: s\nlifecycle: backlog\n---\n## Requisitos\n### F · Funcional\n- F1 [open] Deve aceitar `href`?\n';
  const [r] = ok(md).requirements;
  assert.equal(r.state, 'open');
  assert.equal(r.text, 'Deve aceitar `href`?');
  assert.equal(r.line, 8);
});

test('Migração é prosa, inclusive tabela, em qualquer lifecycle', () => {
  const md = '---\ncomponent: ds-velho\nsummary: s\nlifecycle: deprecated\nreplacement: ds-novo\n---\n## Migração\n| velho | novo |\n|---|---|\n| `title` | `heading` |\n';
  const crd = ok(md);
  assert.equal(crd.migration, '| velho | novo |\n|---|---|\n| `title` | `heading` |');
  assert.equal(ok(md.replace('deprecated', 'built')).migration, crd.migration);
});
