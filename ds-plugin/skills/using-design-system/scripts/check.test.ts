import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'check.ts');
const DIRTY = '<style>.a { color: #E00000; }</style>\n';
const CLEAN = '<ds-button variant="ghost">Ok</ds-button>\n';

const run = (args: string[], input = '', cwd?: string) => {
  const r = spawnSync(process.execPath, [script, ...args], { input, encoding: 'utf8', cwd });
  return { code: r.status, out: r.stdout, err: r.stderr };
};

function setup(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'ds-check-'));
  const session = `test-${randomUUID()}`;
  t.after(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(join(tmpdir(), `ds-session-${session}.json`), { force: true });
  });
  const file = (name: string, code: string) => {
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, code);
    return path;
  };
  const hook = (kind: 'post' | 'stop', payload: object) => run([`--hook=${kind}`], JSON.stringify({ session_id: session, ...payload }));
  return { dir, file, hook };
}

test('hook post: arquivo com erro → exit 2 e achado no stderr; limpo ou sem file_path → exit 0', (t) => {
  const { file, hook } = setup(t);
  const dirty = hook('post', { tool_input: { file_path: file('tela.html', DIRTY) } });
  assert.equal(dirty.code, 2);
  assert.match(dirty.err, /\[raw-color\]/);
  assert.equal(hook('post', { tool_input: { file_path: file('ok.html', CLEAN) } }).code, 0);
  assert.equal(hook('post', { tool_input: {} }).code, 0);
  assert.equal(hook('post', { tool_input: { file_path: file('nota.md', DIRTY) } }).code, 0, '.md não é validado');
  assert.equal(run(['--hook=post'], 'não é json').code, 0);
});

test('hook stop: bloqueia com erro aberto, libera no segundo stop igual e depois da correção', (t) => {
  const { file, hook } = setup(t);
  const path = file('tela.html', DIRTY);
  hook('post', { tool_input: { file_path: path } });
  const first = hook('stop', { stop_hook_active: false });
  assert.equal(first.code, 0);
  const json = JSON.parse(first.out);
  assert.equal(json.decision, 'block');
  assert.match(json.reason, /^Design System: 1 violação\(ões\) ainda abertas/);
  assert.match(json.reason, /\[raw-color\]/);
  assert.deepEqual(hook('stop', { stop_hook_active: false }), first, 'mesmo estado, mesma saída');

  const again = hook('stop', { stop_hook_active: true });
  assert.equal(again.code, 0);
  assert.equal(again.out, '');
  assert.match(again.err, /loop/);

  writeFileSync(path, CLEAN);
  const fixed = hook('stop', { stop_hook_active: true });
  assert.deepEqual([fixed.code, fixed.out], [0, '']);
});

test('hook stop: sessão sem arquivos tocados → exit 0', (t) => {
  const { hook } = setup(t);
  assert.deepEqual(hook('stop', {}).out, '');
});

test('--ci: exit 1 com erro, 0 sem; ignora node_modules, *.stories.* e extensões fora do validate', (t) => {
  const { dir, file } = setup(t);
  file('ok.html', CLEAN);
  file('node_modules/x/a.css', DIRTY);
  file('src/a.stories.tsx', DIRTY);
  file('README.md', DIRTY);
  assert.deepEqual(run(['--ci', dir]), { code: 0, out: '', err: '' });
  file('src/tela.html', DIRTY);
  const r = run(['--ci', dir]);
  assert.equal(r.code, 1);
  assert.match(r.out, /src\/tela\.html:1:20 \[raw-color\]/);
  assert.equal(r.out.trim().split('\n').length, 1);
  assert.match(run(['--ci', dir, '--format=detailed']).out, /erro \[raw-color\]/);
});

test('--report: imprime as seções do relatório', (t) => {
  const { dir, file } = setup(t);
  file('a.html', DIRTY + CLEAN + '<ds-foo></ds-foo>\n');
  const r = run(['--report', dir]);
  assert.equal(r.code, 0);
  for (const s of ['## Resumo', '## Uso do DS', '## Depreciados em uso', '## Valores crus', '## Pedidos ao DS'])
    assert.ok(r.out.includes(s), `faltou ${s}`);
  assert.match(r.out, /Arquivos analisados: 1/);
  assert.match(r.out, /\| ds-button \| 1 \|/);
  assert.match(r.out, /a\.html:1 `#E00000` → sem token/);
  assert.match(r.out, /a\.html:3 \[unknown-tag\]/);
});

test('--ci --record: grava o gap uma vez; rodar de novo não grava nada', (t) => {
  const { dir, file } = setup(t);
  file('src/tela.html', '<ds-tooltip>x</ds-tooltip>\n');
  const obs = join(dir, 'obs');
  const first = run(['--ci', join(dir, 'src'), `--record=${obs}`]);
  assert.equal(first.code, 1);
  assert.match(first.err, /observações: \+1/);
  assert.equal(readFileSync(join(obs, 'observations.jsonl'), 'utf8').trim().split('\n').length, 1);
  assert.match(run(['--ci', join(dir, 'src'), `--record=${obs}`]).err, /observações: \+0/);
  assert.equal(run(['--stdin', '--file=x.html', `--record=${obs}`], CLEAN).code, 1, '--record só com --ci/--report');
});

test('--stdin --file: valida o trecho colado', () => {
  const bad = run(['--stdin', '--file=x.css'], '.a { color: #E00000; }');
  assert.equal(bad.code, 1);
  assert.match(bad.out, /^x\.css\n {2}1:13 erro \[raw-color\]/);
  assert.deepEqual(run(['--stdin', '--file=x.html'], CLEAN), { code: 0, out: '', err: '' });
});

test('sem modo ou com dois modos → uso e exit 1', () => {
  assert.equal(run([]).code, 1);
  assert.match(run(['--ci', '--report']).err, /^Uso:/);
});
