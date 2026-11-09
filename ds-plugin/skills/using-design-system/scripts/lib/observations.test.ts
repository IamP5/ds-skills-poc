import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { FILE, readObservations, record, renderGaps, status } from './observations.ts';
import { loadCatalog } from './ops.ts';
import { validate } from './validate.ts';

const CODE = [
  '<ds-tooltip variant="highlight">x</ds-tooltip>',
  '<p style="color:#123456">sem escape</p>',
  '<!-- ds-ignore raw-color -- cor da marca parceira -->',
  '<p style="color:#654321">com escape</p>',
].join('\n');
const results = () => [{ file: 'src/tela.html', result: validate(CODE, { file: 'tela.html' }) }];

function tmp(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'ds-obs-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('record: grava gap e drift suprimido, ignora drift aberto; segunda vez não grava nada', (t) => {
  const dir = tmp(t);
  assert.equal(record(results(), dir), 2);
  assert.equal(record(results(), dir), 0);
  const { observations } = readObservations(dir);
  assert.deepEqual(observations.map((o) => [o.rule, o.suppressed]), [['unknown-tag', undefined], ['raw-color', 'cor da marca parceira']]);
  assert.deepEqual(observations[0].subject, { tag: 'ds-tooltip' });
});

test('readObservations: pula linha malformada e conta', (t) => {
  const dir = tmp(t);
  record(results(), dir);
  appendFileSync(join(dir, FILE), 'não é json\n{"v":2}\n');
  const r = readObservations(join(dir, FILE));
  assert.equal(r.observations.length, 2);
  assert.equal(r.malformed, 2);
});

test('status: ds-tooltip aberto no catálogo atual, resolvido num catálogo que tem ds-tooltip', (t) => {
  const dir = tmp(t);
  record(results(), dir);
  const chip = readObservations(dir).observations.find((o) => o.rule === 'unknown-tag')!;
  const { items } = loadCatalog();
  assert.equal(status(chip, { items }), 'open');
  const withChip = { items: [...items, { kind: 'component' as const, name: 'ds-tooltip', summary: '', lifecycle: 'built', channels: ['*'], tags: [] }] };
  assert.equal(status(chip, withChip), 'resolved');

  const md = renderGaps(readObservations(dir).observations, withChip);
  assert.match(md, /^<!-- GERADO/);
  assert.match(md, /## Resolvidos desde a coleta[\s\S]*`ds-tooltip` \| ds-tooltip agora existe no catálogo/);
  assert.match(md, /### Escapes[\s\S]*`raw-color`: cor da marca parceira \| 1 \| `src\/tela\.html`/);
});

test('status: suprimido de drift segue aberto enquanto a regra ainda dispararia', (t) => {
  const dir = tmp(t);
  record(results(), dir);
  const escape = readObservations(dir).observations.find((o) => o.suppressed)!;
  assert.equal(status(escape, loadCatalog()), 'open');
  assert.ok(readFileSync(join(dir, FILE), 'utf8').endsWith('\n'));
});
