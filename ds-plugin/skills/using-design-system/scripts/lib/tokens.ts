// Resolução de tokens seguindo o DTCG Resolver Module 2025.10.
// - lê data/tokens/ds.resolver.json
// - aplica resolutionOrder (sets e modifiers); o último a declarar um token vence
// - resolve aliases {a.b.c}
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Json = { [k: string]: any };
export type Inputs = Record<string, string>;
export type Resolved = { value: any; type?: string; chain: string[] };

const tokensDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'tokens');
const RESOLVER_FILE = join(tokensDir, 'ds.resolver.json');

const readJson = (p: string): Json => JSON.parse(readFileSync(p, 'utf8'));
const isToken = (n: any) => n && typeof n === 'object' && '$value' in n;

export function loadResolver(): Json {
  return readJson(RESOLVER_FILE);
}

/** Modifiers e seus contextos, ex.: { theme: ['default','premium','pj'], channel: ['app','web'] } */
export function listContexts(): Record<string, { contexts: string[]; default?: string }> {
  const r = loadResolver();
  return Object.fromEntries(
    Object.entries<Json>(r.modifiers ?? {}).map(([name, m]) => [name, { contexts: Object.keys(m.contexts), default: m.default }]),
  );
}

function validateInputs(r: Json, inputs: Inputs): Inputs {
  const mods: Json = r.modifiers ?? {};
  const given: Inputs = {};
  for (const [k, v] of Object.entries(inputs)) {
    const name = Object.keys(mods).find((m) => m.toLowerCase() === k.toLowerCase());
    if (!name) throw new Error(`Modifier desconhecido: "${k}". Existentes: ${Object.keys(mods).join(', ')}`);
    if (!(v in mods[name].contexts)) throw new Error(`Contexto "${v}" não existe em "${name}". Opções: ${Object.keys(mods[name].contexts).join(', ')}`);
    given[name] = v;
  }
  const out: Inputs = {}; // na ordem em que os modifiers são declarados
  for (const [name, m] of Object.entries<Json>(mods)) {
    if (name in given) out[name] = given[name];
    else if (m.default) out[name] = m.default;
    else throw new Error(`Informe o modifier "${name}" (não tem default).`);
  }
  return out;
}

/** Mescla no nível de token: um token declarado depois substitui o anterior inteiro. */
function mergeTokens(target: Json, src: Json): Json {
  for (const [k, v] of Object.entries(src)) {
    if (k.startsWith('$') && !isToken(src)) continue; // metadados de grupo/arquivo
    if (isToken(v)) target[k] = v;
    else if (v && typeof v === 'object') target[k] = mergeTokens(target[k] && !isToken(target[k]) ? target[k] : {}, v);
  }
  return target;
}

function loadSources(sources: Json[]): Json[] {
  return sources.map((s) => (s.$ref ? readJson(join(tokensDir, s.$ref)) : s));
}

/** Árvore final de tokens para um conjunto de inputs (ex.: { theme: 'pj', channel: 'web' }). */
export function buildTree(inputs: Inputs = {}): { tree: Json; inputs: Inputs } {
  const r = loadResolver();
  const resolvedInputs = validateInputs(r, inputs);
  const tree: Json = {};
  for (const item of r.resolutionOrder) {
    const ref: string | undefined = item.$ref;
    if (ref?.startsWith('#/sets/')) {
      for (const s of loadSources(r.sets[ref.slice(7)].sources)) mergeTokens(tree, s);
    } else if (ref?.startsWith('#/modifiers/')) {
      const name = ref.slice(12);
      for (const s of loadSources(r.modifiers[name].contexts[resolvedInputs[name]])) mergeTokens(tree, s);
    } else if (item.type === 'set') {
      for (const s of loadSources(item.sources)) mergeTokens(tree, s);
    }
  }
  return { tree, inputs: resolvedInputs };
}

export function getNode(tree: Json, path: string): Json | undefined {
  return path.split('.').reduce<Json | undefined>((n, k) => (n ? n[k] : undefined), tree);
}

export function resolve(tree: Json, path: string, seen: string[] = []): Resolved {
  if (seen.includes(path)) throw new Error(`Alias circular: ${[...seen, path].join(' → ')}`);
  const node = getNode(tree, path);
  if (!isToken(node)) throw new Error(`Token não existe neste contexto: ${path}`);
  const m = typeof node!.$value === 'string' && node!.$value.match(/^\{(.+)\}$/);
  if (m) {
    const r = resolve(tree, m[1], [...seen, path]);
    return { value: r.value, type: node!.$type ?? r.type, chain: [path, ...r.chain] };
  }
  return { value: node!.$value, type: node!.$type, chain: [path] };
}

/** Lista caminhos de todos os tokens sob um prefixo. */
export function listTokens(tree: Json, prefix = ''): string[] {
  const out: string[] = [];
  const walk = (n: Json, p: string) => {
    for (const [k, v] of Object.entries(n)) {
      if (k.startsWith('$')) continue;
      const path = p ? `${p}.${k}` : k;
      if (isToken(v)) out.push(path);
      else if (v && typeof v === 'object') walk(v, path);
    }
  };
  walk(prefix ? getNode(tree, prefix) ?? {} : tree, prefix);
  return out;
}

export const isPrimitive = (path: string) => /^(palette|size\.\d+)/.test(path);

/** Formata valores DTCG 2025.10 (objetos) para leitura humana/CSS. */
export function format(value: any, type?: string): string {
  if (type === 'color' && value && typeof value === 'object') return value.hex ?? toHex(value.components);
  if (type === 'dimension' && value && typeof value === 'object') return `${value.value}${value.unit}`;
  if (type === 'typography' && value && typeof value === 'object') {
    const fam = Array.isArray(value.fontFamily) ? value.fontFamily[0] : value.fontFamily;
    return `${value.fontWeight} ${format(value.fontSize, 'dimension')}/${value.lineHeight} ${fam}`;
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function toHex(components: number[]): string {
  return '#' + components.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
}

export function hexOf(r: Resolved): string {
  if (r.type !== 'color') throw new Error(`${r.chain[0]} não é cor (${r.type})`);
  return format(r.value, 'color');
}

/** Combinações de contexto pedidas na CLI: --theme=all expande, demais fixos. */
export function expandInputs(args: Record<string, string | undefined>): Inputs[] {
  const ctx = listContexts();
  let combos: Inputs[] = [{}];
  for (const [name, { contexts }] of Object.entries(ctx)) {
    const v = args[name];
    const values = v === 'all' ? contexts : v ? [v] : [undefined];
    combos = combos.flatMap((c) => values.map((val) => (val ? { ...c, [name]: val } : c)));
  }
  return combos;
}
