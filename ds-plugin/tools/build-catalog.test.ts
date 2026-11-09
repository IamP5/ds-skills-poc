import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'build-catalog.ts');
const skill = join(here, '../skills/using-design-system');
const fixture = join(here, 'fixtures/custom-elements.json');

const observation = {
  v: 1, fp: 'f1', rule: 'unknown-tag', subject: { tag: 'ds-tooltip' }, file: 'src/tela.html', line: 1,
  seenAt: '2026-11-01T10:00:00.000Z', catalog: 'x',
};

test('--observations: gaps.md lista ds-tooltip em Abertos; com ds-tooltip no CEM, em Resolvidos; sem a flag não cria', (t) => {
  const tmp = mkdtempSync(join(tmpdir(), 'ds-build-'));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const out = join(tmp, 'skill');
  for (const d of ['references', 'data']) cpSync(join(skill, d), join(out, d), { recursive: true });
  rmSync(join(out, 'references/gaps.md'), { force: true });
  const obs = join(tmp, 'observations.jsonl');
  writeFileSync(obs, JSON.stringify(observation) + '\n');
  const build = (...args: string[]) => {
    const r = spawnSync(process.execPath, [script, `--out=${out}`, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  };
  const gaps = () => readFileSync(join(out, 'references/gaps.md'), 'utf8');

  build();
  assert.equal(existsSync(join(out, 'references/gaps.md')), false);

  assert.match(build(`--observations=${obs}`), /gaps\.md: 1 observação/);
  const open = gaps().split('## Resolvidos')[0];
  assert.match(open, /## Abertos[\s\S]*### Componentes pedidos que não existem\n\n\| Pedido[^\n]*\n[^\n]*\n\| `ds-tooltip` \| 1 \| `src\/tela\.html` \| 2026-11-01 \|/);

  const cem = JSON.parse(readFileSync(fixture, 'utf8'));
  cem.modules.push({ kind: 'javascript-module', path: 'src/chip.tsx', declarations: [{ kind: 'class', name: 'DsTooltip', tagName: 'ds-tooltip', customElement: true }] });
  const cemPath = join(tmp, 'cem.json');
  writeFileSync(cemPath, JSON.stringify(cem));
  build(`--cem=${cemPath}`, `--observations=${tmp}`);
  const [before, after] = gaps().split('## Resolvidos desde a coleta');
  assert.doesNotMatch(before, /ds-tooltip/);
  assert.match(after, /`ds-tooltip` \| ds-tooltip agora existe no catálogo \| 1 \|/);
});
