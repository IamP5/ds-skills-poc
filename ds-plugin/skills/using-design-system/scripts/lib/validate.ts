// Validação de código de produto contra o que o DS sabe: catálogo (CEM + CRDs) e tokens.
// Puro e determinístico: recebe o texto, devolve achados. Nunca lança em markup malformado (melhor esforço).
import { loadCatalog, type CatalogItem } from './ops.ts';
import { buildTree, expandInputs, format, isPrimitive, listTokens, resolve, type Inputs } from './tokens.ts';

export const RULES = {
  'unknown-tag': { severity: 'error', signal: 'gap', source: 'scripts/list.ts components' },
  'unknown-attr': { severity: 'error', signal: 'gap', source: 'references/components/<tag>.crd.md#api-gerado-do-cem' },
  'invalid-enum': { severity: 'error', signal: 'gap', source: 'references/components/<tag>.crd.md#api-gerado-do-cem' },
  'unknown-slot': { severity: 'error', signal: 'gap', source: 'references/components/<tag>.crd.md#api-gerado-do-cem' },
  'unknown-token': { severity: 'error', signal: 'gap', source: 'references/tokens.md' },
  'deprecated': { severity: 'error', signal: 'drift', source: '<doc do item depreciado>' },
  'not-built': { severity: 'error', signal: 'drift', source: '<doc do item>' },
  'theme-restricted': { severity: 'error', signal: 'drift', source: 'references/themes.md' },
  'raw-color': { severity: 'error', signal: 'drift', source: 'references/tokens.md' },
  'raw-spacing': { severity: 'error', signal: 'drift', source: 'references/tokens.md' },
  'primitive-token': { severity: 'error', signal: 'drift', source: 'references/tokens.md' },
  'theme-branch': { severity: 'error', signal: 'drift', source: 'references/themes.md' },
  'body-overflow': { severity: 'error', signal: 'drift', source: 'references/services/body-scroll-manager.md' },
  'manual-zindex': { severity: 'warning', signal: 'drift', source: 'references/templates/overlay-stack.md' },
  'mimic': { severity: 'warning', signal: 'drift', source: '<doc do componente imitado>' },
} as const;
export type RuleId = keyof typeof RULES;
export type Subject = { tag: string; attr?: string; value?: string; slot?: string } | { token: string } | { raw: string; prop?: string };
export type Finding = {
  rule: RuleId; severity: 'error' | 'warning'; line: number; col: number; subject: Subject;
  message: string;
  fix?: { use: string; source: string };
  suppressed?: string;
};
export type Context = { file: string; theme?: string; channel?: string };
export type Result = { findings: Finding[]; uses: Record<string, number> };

type TokenValue = { path: string; type?: string; value: string };
export type TokenIndex = { byDashed: Map<string, string>; semantic: Set<string>; groups: Set<string>; roots: Set<string> };
type Index = TokenIndex & {
  components: Map<string, CatalogItem>;
  docs: Map<string, string>;
  mimics: { pattern: string; item: CatalogItem }[];
};

let index: Index | undefined;
const contextValues = new Map<string, TokenValue[] | null>();

function getIndex(): Index {
  if (index) return index;
  const items = loadCatalog().items;
  const components = new Map(items.filter((i) => i.kind === 'component').map((i) => [i.name, i]));
  const docs = new Map(items.filter((i) => i.doc).map((i) => [i.name, i.doc!]));
  const mimics = [...components.values()].flatMap((item) => (item.mimics ?? []).map((pattern) => ({ pattern, item })));
  index = { components, docs, mimics, ...tokenIndex() };
  return index;
}

let tokens: TokenIndex | undefined;
export function tokenIndex(): TokenIndex {
  if (tokens) return tokens;
  // Tema e canal só sobrescrevem valores, mas um token pode existir só em um contexto: une todos.
  const paths = new Set(expandInputs({ theme: 'all', channel: 'all' }).flatMap((inputs) => listTokens(buildTree(inputs).tree)));
  const byDashed = new Map([...paths].map((p) => [p.replace(/\./g, '-'), p]));
  const semantic = new Set([...paths].filter((p) => !isPrimitive(p)));
  const groups = new Set([...paths].flatMap((p) => p.split('.').slice(0, -1).map((_, i, segs) => segs.slice(0, i + 1).join('.'))));
  const roots = new Set([...paths].map((p) => p.split('.')[0]));
  tokens = { byDashed, semantic, groups, roots };
  return tokens;
}

/** Caminho do token como escrito no código (`var(--ds-…)` sem o var, ou `tokens.a.b`). */
export function tokenPath(written: string, t: TokenIndex): string {
  const dashed = written.match(/^--ds-(.+)$/)?.[1];
  if (dashed) return t.byDashed.get(dashed) ?? dashed;
  return written.replace(/^tokens\./, '').split('.').map(kebab).join('.');
}

function valuesIn(ctx: Context): TokenValue[] | null {
  const key = `${ctx.theme ?? ''}|${ctx.channel ?? ''}`;
  if (contextValues.has(key)) return contextValues.get(key)!;
  let out: TokenValue[] | null = null;
  try {
    const inputs: Inputs = {};
    if (ctx.theme) inputs.theme = ctx.theme;
    if (ctx.channel) inputs.channel = ctx.channel;
    const { tree } = buildTree(inputs);
    out = listTokens(tree).map((path) => {
      const r = resolve(tree, path);
      return { path, type: r.type, value: format(r.value, r.type).toLowerCase() };
    });
  } catch {
    // Tema/canal inexistente: sem valores, logo sem sugestão de fix; o resto da validação segue.
  }
  contextValues.set(key, out);
  return out;
}

function uniqueSemantic(ctx: Context, type: string, value: string, prefix: string): string | undefined {
  const hits = (valuesIn(ctx) ?? []).filter((t) => t.type === type && t.value === value && t.path.startsWith(prefix) && !isPrimitive(t.path));
  return hits.length === 1 ? hits[0].path : undefined;
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

export function closest(target: string, candidates: string[]): string[] {
  const max = Math.max(2, Math.floor(target.length / 3));
  return candidates
    .map((c) => ({ c, d: c.startsWith(target) || target.startsWith(c) ? 0.5 : distance(target, c) }))
    .filter((x) => x.d <= max)
    .sort((x, y) => x.d - y.d || x.c.localeCompare(y.c))
    .map((x) => x.c);
}

export const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const cssVar = (path: string) => `var(--ds-${path.replace(/\./g, '-')})`;
const apiSource = (item: CatalogItem) => `${item.doc ?? `references/components/${item.name.replace(/^ds-/, '')}.crd.md`}#api-gerado-do-cem`;

const GLOBAL_ATTRS = new Set(['class', 'classname', 'id', 'style', 'slot', 'hidden', 'role', 'tabindex', 'title', 'lang', 'dir', 'key', 'ref', 'part']);
const isGlobalAttr = (n: string) =>
  GLOBAL_ATTRS.has(n.toLowerCase()) || /^(aria|data)-/.test(n) || /^on[A-Z]/.test(n) || /^on[a-z]+$/.test(n);

const SCRIPT = new Set(['.tsx', '.jsx', '.ts', '.js', '.mjs', '.cjs', '.mts', '.cts']);
const MARKUP = new Set(['.html', '.htm', '.vue', ...SCRIPT]);
const CSS = new Set(['.css', '.scss']);
export const EXTENSIONS: ReadonlySet<string> = new Set([...MARKUP, ...CSS]);
const URL_ATTRS = new Set(['href', 'xlink:href', 'src', 'srcset', 'action', 'formaction', 'poster', 'cite', 'data', 'background']);

const THEME_BRANCH = /\b(theme|channel)\s*===?\s*['"]|data-(theme|channel)=["'][a-z]+["']\]\s*[.#\w]/g;
const BODY_OVERFLOW = /body\.style\.overflow|classList\.(add|toggle)\(['"]no-scroll/g;
const COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|(?:rgba?|hsla?)\([^)]*\)?/g;
const SPACING_PROP = /^(?:(?:margin|padding)(?:-[a-z-]+|[A-Z]\w*)?|(?:row-|column-)?gap|(?:row|column)Gap)$/;
const PX = /(?<![\w.-])(\d*\.?\d+)px\b/g;

type Attr = { name: string; value?: string; kind: 'none' | 'quoted' | 'expr'; at: number; valueAt?: number };
type Decl = { prop: string; propAt: number; value: string; valueAt: number };
type Region = { kind: 'css' | 'inline' | 'object'; start: number; text: string };

// Troca comentários por espaços mantendo quebras de linha: posições continuam valendo.
function mask(code: string): string {
  return code.replace(/<!--[\s\S]*?(?:-->|$)|\/\*[\s\S]*?(?:\*\/|$)/g, (m) => m.replace(/[^\n]/g, ' '));
}

function skipBraces(src: string, i: number): number {
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      const end = src.indexOf(c, i + 1);
      if (end < 0) return src.length;
      i = end;
    } else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i + 1;
  }
  return src.length;
}

function parseAttrs(src: string, i: number): { attrs: Attr[]; end: number; selfClosing: boolean } {
  const attrs: Attr[] = [];
  while (i < src.length) {
    while (/\s/.test(src[i] ?? '')) i++;
    const c = src[i];
    if (c === undefined) break;
    if (c === '>') return { attrs, end: i + 1, selfClosing: false };
    if (c === '/' && src[i + 1] === '>') return { attrs, end: i + 2, selfClosing: true };
    if (c === '<') return { attrs, end: i, selfClosing: false };
    if (c === '{') { i = skipBraces(src, i); continue; }
    const name = src.slice(i).match(/^[^\s=/>"'{}<]+/)?.[0];
    if (!name) { i++; continue; }
    const at = i;
    i += name.length;
    let j = i;
    while (/\s/.test(src[j] ?? '')) j++;
    if (src[j] !== '=') { attrs.push({ name, kind: 'none', at }); continue; }
    j++;
    while (/\s/.test(src[j] ?? '')) j++;
    const q = src[j];
    if (q === '"' || q === "'") {
      const end = src.indexOf(q, j + 1);
      const stop = end < 0 ? src.length : end;
      attrs.push({ name, value: src.slice(j + 1, stop), kind: 'quoted', at, valueAt: j + 1 });
      i = stop + 1;
    } else if (q === '{') {
      const end = skipBraces(src, j);
      attrs.push({ name, value: src.slice(j, end), kind: 'expr', at });
      i = end;
    } else {
      const v = src.slice(j).match(/^[^\s>]*/)![0];
      attrs.push({ name, value: v, kind: 'expr', at, valueAt: j });
      i = j + v.length;
    }
  }
  return { attrs, end: src.length, selfClosing: false };
}

function cssRegions(src: string): Region[] {
  const out: Region[] = [];
  for (const m of src.matchAll(/<style\b[^>]*>([\s\S]*?)(?:<\/style>|$)/gi))
    out.push({ kind: 'css', start: m.index + m[0].indexOf('>') + 1, text: m[1] });
  for (const m of src.matchAll(/\sstyle\s*=\s*(["'{])/g)) {
    const open = m.index + m[0].length - 1;
    if (m[1] !== '{') {
      const end = src.indexOf(m[1], open + 1);
      out.push({ kind: 'inline', start: open + 1, text: src.slice(open + 1, end < 0 ? src.length : end) });
      continue;
    }
    const end = skipBraces(src, open);
    const inner = src.slice(open + 1, end - 1);
    const lead = inner.match(/^\s*\{/);
    if (lead) {
      const objEnd = skipBraces(inner, lead[0].length - 1);
      out.push({ kind: 'object', start: open + 1 + lead[0].length, text: inner.slice(lead[0].length, objEnd - 1) });
    }
  }
  return out;
}

function declarations(r: Region): Decl[] {
  const out: Decl[] = [];
  if (r.kind !== 'object') {
    for (const m of r.text.matchAll(/([A-Za-z-][\w-]*)\s*:\s*([^;{}]*?)\s*(?=;|\}|$)/dg)) {
      const [p, v] = [m.indices![1], m.indices![2]];
      out.push({ prop: m[1], propAt: r.start + p[0], value: m[2], valueAt: r.start + v[0] });
    }
    return out;
  }
  let depth = 0, from = 0, quote = '';
  const parts: [number, number][] = [];
  for (let i = 0; i <= r.text.length; i++) {
    const c = r.text[i];
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') depth--;
    else if ((c === ',' && depth === 0) || c === undefined) { parts.push([from, i]); from = i + 1; }
  }
  for (const [a, b] of parts) {
    const m = r.text.slice(a, b).match(/^(\s*)(['"]?)([\w-]+)\2\s*:\s*/);
    if (!m) continue;
    const propAt = r.start + a + m[1].length + m[2].length;
    const valueAt = r.start + a + m[0].length;
    out.push({ prop: m[3], propAt, value: r.text.slice(a + m[0].length, b).trimEnd(), valueAt });
  }
  return out;
}

// `#abc` em URL (`/pag#abc`, `url(#abc)`) ou entidade (`&#123;`) não é cor.
function rawColors(text: string): { raw: string; index: number }[] {
  const out: { raw: string; index: number }[] = [];
  for (const c of text.matchAll(COLOR)) {
    if (c[0][0] === '#') {
      if (text[c.index - 1] === '&') continue;
      let k = c.index - 1;
      while (k >= 0 && !/[\s'"`]/.test(text[k]) && text[k] !== '/' && !text.startsWith('url(', k)) k--;
      if (k >= 0 && (text[k] === '/' || text.startsWith('url(', k))) continue;
    }
    out.push({ raw: c[0], index: c.index });
  }
  return out;
}

// Literais de string fora de comentários `//` (os de bloco já vêm mascarados). Melhor esforço: ignora regex literal.
function stringLiterals(code: string, start: number): { start: number; text: string }[] {
  const out: { start: number; text: string }[] = [];
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '/' && code[i + 1] === '/') {
      const nl = code.indexOf('\n', i);
      if (nl < 0) break;
      i = nl;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== c && (c === '`' || code[j] !== '\n')) j += code[j] === '\\' ? 2 : 1;
      out.push({ start: start + i + 1, text: code.slice(i + 1, j) });
      i = j;
    }
  }
  return out;
}

function hexOfRaw(raw: string): string | undefined {
  let h = raw.match(/^#([0-9a-f]+)$/i)?.[1].toLowerCase();
  if (h) {
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    if (h.length === 8 && h.endsWith('ff')) h = h.slice(0, 6);
    return h.length === 6 ? `#${h}` : undefined;
  }
  const rgb = raw.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*(1|1\.0+|100%)\s*)?\)$/i);
  return rgb ? `#${rgb.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}` : undefined;
}

export function validate(code: string, ctx: Context): Result {
  const idx = getIndex();
  const src = mask(code);
  const ext = ctx.file.match(/\.[^./\\]+$/)?.[0].toLowerCase() ?? '';
  const isCss = CSS.has(ext);
  const isMarkup = MARKUP.has(ext) || !isCss;
  const lineStarts = [0];
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') lineStarts.push(i + 1);
  const pos = (offset: number) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    return { line: lo + 1, col: offset - lineStarts[lo] + 1 };
  };

  const findings: Finding[] = [];
  const add = (rule: RuleId, at: number, subject: Subject, message: string, fix?: Finding['fix']) =>
    findings.push({ rule, severity: RULES[rule].severity, ...pos(at), subject, message, ...(fix && { fix }) });
  const uses: Record<string, number> = {};

  const rawColor = (at: number, raw: string, where: string, prop?: string) => {
    const hex = hexOfRaw(raw);
    const use = hex && uniqueSemantic(ctx, 'color', hex, 'color.');
    add('raw-color', at, prop ? { raw, prop } : { raw },
      `Cor crua ${raw} em ${where}. Use um token semântico color.*${use ? `: ${cssVar(use)}` : ''} (references/tokens.md).`,
      use ? { use, source: 'references/tokens.md' } : undefined);
  };

  if (isMarkup) {
    const stack: string[] = [];
    const tagRe = /<(\/?)([A-Za-z][\w:.-]*)/g;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(src))) {
      const [, closing, tag] = m;
      const isDs = tag.startsWith('ds-');
      if (closing) {
        const k = stack.lastIndexOf(tag);
        if (k >= 0) stack.length = k;
        continue;
      }
      const { attrs, end, selfClosing } = parseAttrs(src, m.index + m[0].length);
      const parent = stack.length ? idx.components.get(stack[stack.length - 1]) : undefined;
      for (const a of attrs) {
        const name = a.name.replace(/^(:|v-bind:)/, '').toLowerCase();
        if (a.valueAt === undefined || a.value!.startsWith('{') || name === 'style' || URL_ATTRS.has(name)) continue;
        for (const c of rawColors(a.value!)) rawColor(a.valueAt + c.index, c.raw, a.name, a.name);
      }
      const slot = attrs.find((a) => a.name === 'slot' && a.kind === 'quoted');
      if (slot && parent?.api && !parent.api.slots.includes(slot.value!)) {
        const named = parent.api.slots.filter(Boolean);
        const near = closest(slot.value!, named);
        add('unknown-slot', slot.at, { tag: parent.name, slot: slot.value },
          `${parent.name} não tem o slot "${slot.value}". Slots: ${parent.api.slots.map((s) => s || '(default)').join(', ')} (${apiSource(parent)}).`,
          near[0] ? { use: near[0], source: apiSource(parent) } : undefined);
      }
      // Tag que não é do DS: só interessa o `slot`. Recomeça logo depois do nome para um `<` solto em script não engolir tags.
      if (!isDs) continue;
      tagRe.lastIndex = end;
      uses[tag] = (uses[tag] ?? 0) + 1;
      if (!selfClosing) stack.push(tag);
      const at = m.index + 1;
      const item = idx.components.get(tag);
      if (!item) {
        const near = closest(tag, [...idx.components.keys()]);
        add('unknown-tag', at, { tag },
          `<${tag}> não existe no DS.${near.length ? ` Parecidos: ${near.slice(0, 3).join(', ')}.` : ''} Veja os componentes com scripts/list.ts components.`,
          near.length ? { use: near[0], source: RULES['unknown-tag'].source } : undefined);
        continue;
      }
      const doc = item.doc ?? apiSource(item);
      if (item.lifecycle === 'deprecated') {
        const repl = item.replacement;
        add('deprecated', at, { tag }, `${tag} está deprecated.${repl ? ` Use ${repl}.` : ''} Migração em ${doc}.`,
          repl ? { use: repl, source: doc } : undefined);
      } else if (item.lifecycle !== 'built') {
        add('not-built', at, { tag }, `${tag} ainda não está pronto para uso (lifecycle: ${item.lifecycle}). Não use em produto; sinalize o gap (${doc}).`);
      }
      if (item.themes && ctx.theme && !item.themes.includes(ctx.theme))
        add('theme-restricted', at, { tag },
          `${tag} só existe no(s) tema(s) ${item.themes.join(', ')}; o contexto é "${ctx.theme}". Veja as exceções em references/themes.md.`);
      if (!item.api) continue;
      for (const a of attrs) {
        let name = a.name;
        let kind = a.kind;
        if (/^(@|v-on:|#|v-slot)/.test(name) || (/^v-/.test(name) && !name.startsWith('v-bind:'))) continue;
        if (/^(:|v-bind:)/.test(name)) { name = name.replace(/^(:|v-bind:)/, ''); kind = 'expr'; }
        const spec = item.api.attributes.find((x) => x.name === name || x.name === kebab(name));
        if (spec) {
          if (kind === 'quoted' && spec.values && !spec.values.includes(a.value!)) {
            const near = closest(a.value!, spec.values);
            add('invalid-enum', a.at, { tag, attr: spec.name, value: a.value },
              `"${a.value}" não é valor de ${spec.name} em ${tag}. Valores: ${spec.values.join(' | ')} (${apiSource(item)}).`,
              near[0] ? { use: near[0], source: apiSource(item) } : undefined);
          }
          continue;
        }
        if (isGlobalAttr(name)) continue;
        const names = item.api.attributes.map((x) => x.name);
        const near = closest(kebab(name), names);
        add('unknown-attr', a.at, { tag, attr: name },
          `${tag} não tem o atributo "${name}". Atributos: ${names.join(', ') || '(nenhum)'} (${apiSource(item)}).`,
          near[0] ? { use: near[0], source: apiSource(item) } : undefined);
      }
    }

    for (const { pattern, item } of idx.mimics) {
      for (let i = src.indexOf(pattern); i >= 0; i = src.indexOf(pattern, i + 1)) {
        const doc = item.doc ?? apiSource(item);
        add('mimic', i, { raw: pattern }, `"${pattern}" imita ${item.name}. Use ${item.name} (${doc}).`, { use: item.name, source: doc });
      }
    }
  }

  const regions = isCss ? [{ kind: 'css' as const, start: 0, text: src }] : cssRegions(src);
  if (!MARKUP.has(ext) && !isCss) regions.push({ kind: 'css', start: 0, text: src });
  for (const decl of regions.flatMap(declarations)) {
    for (const c of decl.value.matchAll(COLOR)) rawColor(decl.valueAt + c.index, c[0], decl.prop, decl.prop);
    if (SPACING_PROP.test(decl.prop)) {
      for (const p of decl.value.matchAll(PX)) {
        if (!(Number(p[1]) > 0)) continue;
        const use = uniqueSemantic(ctx, 'dimension', `${Number(p[1])}px`, 'space.');
        add('raw-spacing', decl.valueAt + p.index, { raw: p[0], prop: decl.prop },
          `Espaçamento cru ${p[0]} em ${decl.prop}. Use space.* ou os utilitários ds-stack/ds-inset${use ? `: ${cssVar(use)}` : ''} (references/tokens.md).`,
          use ? { use, source: 'references/tokens.md' } : undefined);
      }
    }
    if (/^(z-index|zIndex)$/.test(decl.prop) && /^['"]?\s*-?\d+/.test(decl.value))
      add('manual-zindex', decl.propAt, { raw: `${decl.prop}: ${decl.value}`, prop: decl.prop },
        'z-index manual. Overlays empilhados usam o template OverlayStack (references/templates/overlay-stack.md).');
  }

  if (!isCss) {
    const scripts = SCRIPT.has(ext)
      ? [{ start: 0, text: src }]
      : [...src.matchAll(/<script\b[^>]*>([\s\S]*?)(?:<\/script>|$)/gi)].map((m) => ({ start: m.index + m[0].indexOf('>') + 1, text: m[1] }));
    for (const s of scripts.flatMap((r) => stringLiterals(r.text, r.start)))
      for (const c of rawColors(s.text)) rawColor(s.start + c.index, c.raw, 'string');
  }

  const checkToken = (at: number, written: string, path: string, primitiveGuess: boolean) => {
    if (idx.semantic.has(path)) return;
    const known = idx.byDashed.has(path.replace(/\./g, '-'));
    if ((known && isPrimitive(path)) || (!known && primitiveGuess)) {
      const r = known ? (valuesIn(ctx) ?? []).find((t) => t.path === path) : undefined;
      const use = r?.type ? uniqueSemantic(ctx, r.type, r.value, '') : undefined;
      add('primitive-token', at, { token: written },
        `${written} é token primitivo. Use o semântico equivalente${use ? `: ${use}` : ''} (references/tokens.md).`,
        use ? { use, source: 'references/tokens.md' } : undefined);
      return;
    }
    if (idx.groups.has(path)) return;
    const near = closest(path.replace(/\./g, '-'), [...idx.semantic].map((p) => p.replace(/\./g, '-'))).map((d) => idx.byDashed.get(d)!);
    add('unknown-token', at, { token: written },
      `${written} não é token semântico do DS.${near[0] ? ` Quis dizer ${near[0]}?` : ''} Tokens em references/tokens.md; se não houver um para a intenção, sinalize o gap.`,
      near[0] ? { use: near[0], source: 'references/tokens.md' } : undefined);
  };
  for (const v of src.matchAll(/var\(\s*(--ds-([A-Za-z0-9-]+))/dg))
    checkToken(v.indices![1][0], v[1], tokenPath(v[1], idx), /^(palette-|size-\d)/.test(v[2]));
  if (!isCss) {
    for (const t of src.matchAll(/\btokens\.((?:[A-Za-z_$][\w$]*|\d+)(?:\.(?:[A-Za-z_$][\w$]*|\d+))*)/g)) {
      const path = tokenPath(t[0], idx);
      if (!idx.roots.has(path.split('.')[0])) continue;
      checkToken(t.index, t[0], path, isPrimitive(path));
    }
  }

  for (const b of src.matchAll(THEME_BRANCH))
    add('theme-branch', b.index, { raw: b[0] }, 'Não ramifique por tema/canal. Use tokens ou o service ComponentToggle (references/themes.md).');
  for (const b of src.matchAll(BODY_OVERFLOW))
    add('body-overflow', b.index, { raw: b[0] }, 'Não trave o scroll do body à mão. Use o service BodyScrollManager (references/services/body-scroll-manager.md).');

  const ignores = new Map<number, Map<string, string>>();
  code.split('\n').forEach((text, i) => {
    for (const d of text.matchAll(/ds-ignore\s+([\w-]+)\s+--\s+(.+?)\s*(?:-->|\*\/|$)/g)) {
      if (!Object.hasOwn(RULES, d[1]) || !d[2].trim()) continue;
      for (const line of [i + 1, i + 2]) {
        if (!ignores.has(line)) ignores.set(line, new Map());
        ignores.get(line)!.set(d[1], d[2].trim());
      }
    }
  });

  const seen = new Set<string>();
  const out = findings
    .filter((f) => {
      const key = `${f.rule}|${f.line}|${f.col}`;
      return !seen.has(key) && !!seen.add(key);
    })
    .map((f) => {
      const reason = ignores.get(f.line)?.get(f.rule);
      return reason ? { ...f, suppressed: reason } : f;
    })
    .sort((a, b) => a.line - b.line || a.col - b.col || a.rule.localeCompare(b.rule));
  return { findings: out, uses };
}
