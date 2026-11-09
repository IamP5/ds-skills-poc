#!/usr/bin/env node
// Guard do DS: valida arquivos com lib/validate.ts. Um modo por chamada:
//   --hook=post               PostToolUse: valida o arquivo editado; exit 2 devolve os erros ao agente
//   --hook=stop               Stop: revalida os arquivos tocados na sessão; bloqueia o fim se ainda houver erro
//   --report [caminhos...]    relatório markdown (auditing-design-system)
//   --ci [caminhos...]        lista os erros; exit 1 se houver algum
//   --stdin --file=<nome>     valida o stdin como se fosse <nome>
// Opções: --theme=<t> --channel=<c> --format=concise|detailed (para --ci e --stdin)
//         --record[=<pasta>]  com --ci/--report: grava gaps e escapes em <pasta>/observations.jsonl (default .design-system)
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fail, parseArgs } from './lib/cli.ts';
import { record } from './lib/observations.ts';
import { render, type FileResult, type Style } from './lib/render.ts';
import { EXTENSIONS, validate, type Context } from './lib/validate.ts';

const USAGE = 'Uso: check.ts --hook=post|stop | --report [caminhos] | --ci [caminhos] | --stdin --file=<nome>  [--theme=] [--channel=] [--format=concise|detailed] [--record[=<pasta>]]';
const { flags, positional } = parseArgs();
const modes = ['hook', 'report', 'ci', 'stdin'].filter((m) => m in flags);
if (modes.length !== 1) fail(USAGE);
const format = flags.format as Style | undefined;
if (format && format !== 'concise' && format !== 'detailed') fail(USAGE);
// Hooks e stdin validam rascunho do agente: gravar isso seria ruído.
if (flags.record && !flags.ci && !flags.report) fail(USAGE);

const ctx = (file: string): Context => ({ file, ...(flags.theme && { theme: flags.theme }), ...(flags.channel && { channel: flags.channel }) });
const shown = (file: string) => {
  const rel = relative(process.cwd(), file);
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel : file;
};
const check = (file: string): FileResult => ({ file: shown(file), result: validate(readFileSync(file, 'utf8'), ctx(file)) });
const errors = (rs: FileResult[]) => rs.flatMap(({ file, result }) =>
  result.findings.filter((f) => f.severity === 'error' && !f.suppressed).map((f) => `${file}:${f.line}:${f.rule}`));

const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git', 'tokens', '.claude-plugin']);
const ignoredDir = (parent: string, name: string) => IGNORED_DIRS.has(name) || (name === 'results' && basename(parent) === 'evals');
const ignoredFile = (name: string) => /\.(spec|stories)\./.test(name);
const supported = (name: string) => EXTENSIONS.has(extname(name).toLowerCase());
// Só olha abaixo do cwd: um projeto que mora dentro de uma pasta `dist/` ou `tokens/` não fica todo ignorado.
const ignoredInProject = (file: string) => {
  const rel = relative(process.cwd(), file);
  if (rel.startsWith('..') || isAbsolute(rel)) return ignoredFile(basename(file));
  const parts = rel.split(/[\\/]/);
  return ignoredFile(parts.at(-1)!) || parts.slice(0, -1).some((p, i) => ignoredDir(parts[i - 1] ?? '', p));
};

function walk(path: string, out: string[] = []): string[] {
  const st = statSync(path, { throwIfNoEntry: false });
  if (!st) fail(`Caminho não encontrado: ${path}`);
  if (st.isFile()) {
    if (supported(path)) out.push(path);
    return out;
  }
  for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const child = join(path, entry.name);
    if (entry.isDirectory() && !ignoredDir(path, entry.name)) walk(child, out);
    else if (entry.isFile() && supported(entry.name) && !ignoredFile(entry.name)) out.push(child);
  }
  return out;
}

function stdinJson(): Record<string, any> {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

type Session = { touched: string[]; lastBlock?: string[] };
const sessionPath = (id: unknown) => join(tmpdir(), `ds-session-${String(id || 'default').replace(/[^\w-]/g, '_')}.json`);
function loadSession(path: string): Session {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { touched: [] };
  }
}

if (flags.hook === 'post') {
  const input = stdinJson();
  const raw = input.tool_input?.file_path;
  if (typeof raw !== 'string' || !existsSync(raw)) process.exit(0);
  const file = resolve(raw);
  if (!supported(file) || ignoredInProject(file)) process.exit(0);
  const path = sessionPath(input.session_id);
  const session = loadSession(path);
  if (!session.touched.includes(file)) {
    session.touched.push(file);
    writeFileSync(path, JSON.stringify(session));
  }
  const rs = [check(file)];
  if (!errors(rs).length) process.exit(0);
  console.error(render(rs, 'concise'));
  process.exit(2);
} else if (flags.hook === 'stop') {
  const input = stdinJson();
  const path = sessionPath(input.session_id);
  const session = loadSession(path);
  const rs = session.touched.filter((f) => existsSync(f)).map(check);
  const open = errors(rs).sort();
  if (!open.length) {
    if (session.lastBlock) writeFileSync(path, JSON.stringify({ touched: session.touched }));
    process.exit(0);
  }
  // Mesmo bloqueio de antes com o agente já reagindo a um Stop: ele não conseguiu corrigir; deixa terminar em vez de entrar em loop.
  if (input.stop_hook_active === true && JSON.stringify(open) === JSON.stringify(session.lastBlock)) {
    console.error(`Design System: ${open.length} violação(ões) seguem abertas após um bloqueio; liberando para não entrar em loop.`);
    process.exit(0);
  }
  writeFileSync(path, JSON.stringify({ ...session, lastBlock: open }));
  const reason = `Design System: ${open.length} violação(ões) ainda abertas. Corrija antes de terminar:\n${render(rs, 'concise')}`;
  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
} else if (flags.hook) {
  fail(USAGE);
} else if (flags.stdin) {
  if (!flags.file || flags.file === 'true') fail(USAGE);
  const rs = [{ file: flags.file, result: validate(readFileSync(0, 'utf8'), ctx(flags.file)) }];
  const out = render(rs, format ?? 'detailed');
  if (out) console.log(out);
  process.exit(errors(rs).length ? 1 : 0);
} else {
  const files = (positional.length ? positional : ['.']).flatMap((p) => walk(p));
  const rs = files.map(check);
  if (flags.record) console.error(`observações: +${record(rs, flags.record === 'true' ? '.design-system' : flags.record)}`);
  if (flags.report) {
    console.log(render(rs, 'report'));
    process.exit(0);
  }
  const out = render(rs, format ?? 'concise');
  if (out) console.log(out);
  process.exit(errors(rs).length ? 1 : 0);
}
