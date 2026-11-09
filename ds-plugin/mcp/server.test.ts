import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const server = spawn(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'server.ts')], { stdio: ['pipe', 'pipe', 'inherit'] });
const pending = new Map<number, (msg: any) => void>();
createInterface({ input: server.stdout }).on('line', (line) => {
  const msg = JSON.parse(line);
  pending.get(msg.id)?.(msg);
  pending.delete(msg.id);
});
after(() => server.kill());

let nextId = 1;
const rpc = (method: string, params: object = {}): Promise<any> =>
  new Promise((res) => {
    const id = nextId++;
    pending.set(id, res);
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
const call = async (name: string, args: object) => {
  const { result } = await rpc('tools/call', { name, arguments: args });
  return { text: result.content[0].text as string, isError: result.isError as boolean };
};

test('initialize + tools/list: ferramentas novas, sem ds_get_doc', async () => {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  assert.equal(init.result.serverInfo.version, '0.3.0');
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const { result } = await rpc('tools/list');
  assert.deepEqual(result.tools.map((t: any) => t.name).sort(),
    ['ds_check_contrast', 'ds_find', 'ds_get_component', 'ds_list', 'ds_resolve_token', 'ds_validate']);
});

test('ds_validate aponta o substituto do depreciado', async () => {
  const r = await call('ds_validate', { code: '<ds-old-dialog title="Sair"></ds-old-dialog>', file: 'Sair.tsx' });
  assert.equal(r.isError, false);
  assert.ok(r.text.includes('ds-modal'), r.text);
});

test('ds_validate sem achados diz explicitamente', async () => {
  const r = await call('ds_validate', { code: '<ds-button variant="primary">Salvar</ds-button>', file: 'a.html' });
  assert.equal(r.isError, false);
  assert.match(r.text, /Nenhum erro/);
});

test('ds_get_component devolve requisitos com ID', async () => {
  const r = await call('ds_get_component', { name: 'ds-modal' });
  assert.equal(r.isError, false);
  assert.ok(r.text.includes('A1'), r.text);
});

test('entrada inválida mostra as opções', async () => {
  const r = await call('ds_validate', { code: '<ds-button>x</ds-button>', file: 'a.html', theme: 'roxo' });
  assert.equal(r.isError, true);
  assert.ok(r.text.includes('premium'), r.text);
});
