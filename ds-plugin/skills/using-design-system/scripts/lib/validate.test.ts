import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseCrd } from './crd.ts';
import { loadCatalog } from './ops.ts';
import { RULES, validate, type Context, type Finding, type RuleId } from './validate.ts';

const here = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(here, '../../references/components');

const html = (code: string, extra: Partial<Context> = {}) => validate(code, { file: 'x.html', ...extra }).findings;
const rulesOf = (fs: Finding[]) => fs.map((f) => f.rule);
const components = loadCatalog().items.filter((i) => i.kind === 'component');
const pick = (what: string, pred: (i: (typeof components)[number]) => boolean) => {
  const item = components.find(pred);
  assert.ok(item, `o catálogo precisa de um componente ${what} para este teste`);
  return item;
};

type Case = { code: string; ctx?: Partial<Context> };
const deprecated = () => pick('deprecated', (i) => i.lifecycle === 'deprecated').name;
const notBuilt = () => pick('fora de built/deprecated', (i) => !['built', 'deprecated'].includes(i.lifecycle)).name;
const themed = () => pick('restrito a tema', (i) => !!i.themes?.length);
const CASES: Record<RuleId, { bad: Case; good: Case }> = {
  'unknown-tag': { bad: { code: '<ds-foo></ds-foo>' }, good: { code: '<ds-button>Ok</ds-button>' } },
  'unknown-attr': {
    bad: { code: '<ds-button colour="red">Ok</ds-button>' },
    good: { code: '<ds-button variant="ghost" class="a" data-x="1" aria-label="a" onClick={f} onclick="g()">Ok</ds-button>' },
  },
  'invalid-enum': { bad: { code: '<ds-button variant="primari">Ok</ds-button>' }, good: { code: '<ds-button variant="ghost">Ok</ds-button>' } },
  'unknown-slot': {
    bad: { code: '<ds-modal heading="x"><div slot="rodape"></div></ds-modal>' },
    good: { code: '<ds-modal heading="x"><div slot="footer"></div></ds-modal>' },
  },
  'unknown-token': {
    bad: { code: '.a { color: var(--ds-color-nope); }', ctx: { file: 'x.css' } },
    good: { code: '.a { color: var(--ds-color-text-default); }', ctx: { file: 'x.css' } },
  },
  'deprecated': { bad: { code: `<${deprecated()}></${deprecated()}>` }, good: { code: '<ds-button>Ok</ds-button>' } },
  'not-built': { bad: { code: `<${notBuilt()}></${notBuilt()}>` }, good: { code: '<ds-button>Ok</ds-button>' } },
  'theme-restricted': {
    bad: { code: `<${themed().name}></${themed().name}>`, ctx: { theme: 'pj' } },
    good: { code: `<${themed().name}></${themed().name}>`, ctx: { theme: themed().themes![0] } },
  },
  'raw-color': {
    bad: { code: '.a { color: #E00000; }', ctx: { file: 'x.css' } },
    good: { code: '.a { color: var(--ds-color-text-default); }', ctx: { file: 'x.css' } },
  },
  'raw-spacing': {
    bad: { code: '.a { padding: 0 12px; }', ctx: { file: 'x.css' } },
    good: { code: '.a { padding: 0; margin: var(--ds-space-inset-md); width: 12px; }', ctx: { file: 'x.css' } },
  },
  'primitive-token': {
    bad: { code: '.a { color: var(--ds-palette-blue-600); }', ctx: { file: 'x.css' } },
    good: { code: '.a { color: var(--ds-color-action-primary); }', ctx: { file: 'x.css' } },
  },
  'theme-branch': {
    bad: { code: "if (theme === 'pj') show();", ctx: { file: 'x.ts' } },
    good: { code: "if (mode === 'pj') show();", ctx: { file: 'x.ts' } },
  },
  'body-overflow': {
    bad: { code: "document.body.style.overflow = 'hidden';", ctx: { file: 'x.ts' } },
    good: { code: 'scroll.lock(this);', ctx: { file: 'x.ts' } },
  },
  'manual-zindex': {
    bad: { code: '.a { z-index: 10; }', ctx: { file: 'x.css' } },
    good: { code: '.a { z-index: auto; }', ctx: { file: 'x.css' } },
  },
  'mimic': { bad: { code: '<button class="btn">Ok</button>' }, good: { code: '<ds-button>Ok</ds-button>' } },
};

for (const rule of Object.keys(RULES) as RuleId[]) {
  test(`regra ${rule}: um caso que dispara e um que não`, () => {
    const c = CASES[rule];
    assert.ok(c, `falta caso de teste para a regra "${rule}" em CASES`);
    const run = ({ code, ctx }: Case) => html(code, ctx);
    const bad = run(c.bad).filter((f) => f.rule === rule);
    assert.ok(bad.length, `esperava ${rule} em: ${c.bad.code}`);
    assert.equal(bad[0].severity, RULES[rule].severity);
    assert.match(bad[0].message, /\S/);
    assert.deepEqual(run(c.good).filter((f) => f.rule === rule), [], `não esperava ${rule} em: ${c.good.code}`);
  });
}

test('enum com {expr} ou :bind não é checado', () => {
  assert.deepEqual(rulesOf(html('<ds-button variant={v} size=sz>Ok</ds-button>')), []);
  assert.deepEqual(rulesOf(validate('<ds-button :variant="v" @click="go">Ok</ds-button>', { file: 'x.vue' }).findings), []);
});

test('slot é checado contra o ds-* mais próximo, atravessando aninhamento', () => {
  const code = [
    '<ds-modal heading="x">',
    '  <div slot="footer">',
    '    <ds-button variant="ghost"><span slot="start"></span><span slot="footer"></span></ds-button>',
    '  </div>',
    '  <p slot="end"></p>',
    '</ds-modal>',
  ].join('\n');
  const slots = html(code).filter((f) => f.rule === 'unknown-slot');
  assert.deepEqual(slots.map((f) => [f.line, f.subject]), [
    [3, { tag: 'ds-button', slot: 'footer' }],
    [5, { tag: 'ds-modal', slot: 'end' }],
  ]);
});

test('ds-ignore: suprime com regra e motivo (mesma linha ou acima); sem motivo não suprime', () => {
  const code = [
    '<style>',
    '/* ds-ignore raw-color -- cor da marca parceira */',
    '.a { color: #E00000; }',
    '.b { color: #E00000; } /* ds-ignore raw-color -- legado */',
    '/* ds-ignore raw-color */',
    '.c { color: #E00000; }',
    '/* ds-lint-ignore */',
    '.d { color: #E00000; }',
    '.e { color: #E00000; padding: 12px; } /* ds-ignore raw-spacing -- grid do parceiro */',
    '</style>',
  ].join('\n');
  const fs = html(code).filter((f) => f.rule === 'raw-color' || f.rule === 'raw-spacing');
  assert.deepEqual(fs.map((f) => [f.line, f.rule, f.suppressed]), [
    [3, 'raw-color', 'cor da marca parceira'],
    [4, 'raw-color', 'legado'],
    [6, 'raw-color', undefined],
    [8, 'raw-color', undefined],
    [9, 'raw-color', undefined],
    [9, 'raw-spacing', 'grid do parceiro'],
  ]);
});

test('raw-color sugere o token quando exatamente um semântico tem o mesmo valor no contexto', () => {
  const [one] = html('<div style="background: #1F4FD1"></div>');
  assert.deepEqual(one.fix, { use: 'color.action.primary', source: 'references/tokens.md' });
  const [short] = html('<div style="color: #fff"></div>').filter((f) => f.rule === 'raw-color');
  assert.equal(short.fix, undefined, '#fff é text.on-action e surface.default: ambíguo, sem fix');
  const [rgb] = html('<div style="color: rgb(20, 23, 31)"></div>');
  assert.equal(rgb.fix?.use, 'color.text.default');
  assert.equal(html('<div style="color: #E00000"></div>')[0].fix, undefined);
});

test('JSX: camelCase de atributo kebab conta como o atributo; style={{}} é CSS', () => {
  const fs = validate('<ds-button fullWidth variant="ghost" style={{ color: \'#E00000\', zIndex: 3 }}>Ok</ds-button>', { file: 'x.tsx' }).findings;
  assert.deepEqual(rulesOf(fs), ['raw-color', 'manual-zindex']);
});

test('uses conta cada tag ds-* usada', () => {
  const r = validate('<ds-button>a</ds-button><ds-button/><ds-modal heading="x"></ds-modal><ds-foo></ds-foo>', { file: 'x.tsx' });
  assert.deepEqual(r.uses, { 'ds-button': 2, 'ds-modal': 1, 'ds-foo': 1 });
});

test('linha e coluna corretas em tag multilinha; achados ordenados', () => {
  const code = ['<p>oi</p>', '<ds-button', '  variant="primari"', '    colour="x"', '>Ok</ds-button>'].join('\n');
  const fs = html(code);
  assert.deepEqual(fs.map((f) => [f.rule, f.line, f.col]), [['invalid-enum', 3, 3], ['unknown-attr', 4, 5]]);
  assert.equal(fs[0].fix?.use, 'primary');
});

test('markup malformado não lança', () => {
  for (const code of ['<ds-button variant="primary', '<ds-modal><div slot=', '<ds-button {...p} onClick={() => {', '</ds-modal></ds-x>', '<'])
    assert.doesNotThrow(() => validate(code, { file: 'x.tsx' }));
  assert.doesNotThrow(() => validate('<ds-button style="color:#fff">', { file: 'x.html', theme: 'inexistente' }));
});

test('tokens.a.b.c em TS passa pelas mesmas checagens', () => {
  const fs = validate('const a = tokens.color.text.default; const b = tokens.palette.blue; const c = tokens.color.nope; // tokens.md', { file: 'x.ts' }).findings;
  assert.deepEqual(fs.map((f) => [f.rule, f.subject]), [
    ['primitive-token', { token: 'tokens.palette.blue' }],
    ['unknown-token', { token: 'tokens.color.nope' }],
  ]);
});

const crdFiles = readdirSync(componentsDir).filter((f) => f.endsWith('.crd.md'));
for (const file of crdFiles) {
  const parsed = parseCrd(readFileSync(join(componentsDir, file), 'utf8'), file);
  if (!parsed.ok) continue;
  parsed.crd.examples.forEach((ex, n) => {
    const rules = ex.violates.filter((v) => v.startsWith('system#')).map((v) => v.slice(7));
    if (ex.kind === 'dont' && !rules.length) return;
    test(`${file}: exemplo ${n + 1} (${ex.kind === 'do' ? 'Faça' : 'Não faça'}, linha ${ex.line})`, () => {
      const fs = html(ex.code);
      if (ex.kind === 'do') return assert.deepEqual(fs.filter((f) => f.severity === 'error'), []);
      for (const r of rules) {
        assert.ok(Object.hasOwn(RULES, r), `"system#${r}" não é regra conhecida (${Object.keys(RULES).join(', ')})`);
        assert.ok(fs.some((f) => f.rule === r), `esperava ${r}; veio ${rulesOf(fs).join(', ') || 'nada'}`);
      }
    });
  });
}

test('raw-color em atributo de markup (SVG etc.), fora de URL e entidade', () => {
  const colors = (code: string, file = 'x.html') =>
    validate(code, { file }).findings.filter((f) => f.rule === 'raw-color').map((f) => [f.line, f.col, f.subject]);
  assert.deepEqual(colors('<svg><path fill="#E00000" stroke=#fff></path></svg>\n<font color="rgb(1, 2, 3)">a</font>'), [
    [1, 18, { raw: '#E00000', prop: 'fill' }],
    [1, 34, { raw: '#fff', prop: 'stroke' }],
    [2, 14, { raw: 'rgb(1, 2, 3)', prop: 'color' }],
  ]);
  assert.deepEqual(colors('<table bgcolor="#abc"></table>'), [[1, 17, { raw: '#abc', prop: 'bgcolor' }]]);
  assert.deepEqual(colors([
    '<a href="#abc">a</a><a href="/pag#fade">b</a><img src="x.png#add">',
    '<rect fill="url(#bad)"/><p title="a&#123;b">c</p><use xlink:href="#cafe"/>',
    '<!-- <path fill="#E00000"/> -->',
    '<div style="color: var(--ds-color-text-default)" data-x="cafe"></div>',
  ].join('\n')), []);
});

test('raw-color em string de script (.ts/.tsx e <script>), fora de comentário e URL', () => {
  const colors = (code: string, file: string) =>
    validate(code, { file }).findings.filter((f) => f.rule === 'raw-color').map((f) => [f.line, f.subject]);
  assert.deepEqual(colors("const a = '#E00000';\nconst b = `hsl(0 100% 50%)`;\nchart({ color: \"rgba(0,0,0,.5)\" });", 'x.ts'), [
    [1, { raw: '#E00000' }],
    [2, { raw: 'hsl(0 100% 50%)' }],
    [3, { raw: 'rgba(0,0,0,.5)' }],
  ]);
  assert.deepEqual(colors('<svg fill={"#E00000"} />', 'x.tsx'), [[1, { raw: '#E00000' }]]);
  assert.deepEqual(colors('<p>x</p>\n<script>\nel.style.setProperty("--c", "#E00000");\n</script>', 'x.html'), [[3, { raw: '#E00000' }]]);
  assert.deepEqual(colors([
    "// const a = '#E00000';",
    "/* const b = '#E00000'; */",
    "const c = 'https://x.com/a#abc'; const d = 'url(#bad)';",
    'const e = "&#123;"; const f = 0xE00000; // #fff',
  ].join('\n'), 'x.ts'), []);
  assert.deepEqual(colors("<p>Cor #E00000 no texto</p>\n<script>// '#E00000'\n</script>", 'x.html'), []);
});
