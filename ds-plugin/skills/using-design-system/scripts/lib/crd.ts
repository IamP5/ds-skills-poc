// Parser do CRD (Component Requirements Document), gramática v0.3.
// Puro: recebe o texto, devolve o CRD estruturado ou TODOS os erros com a linha (1-based).
// Readiness (o que falta preencher) não é papel do parser: seção vazia é informação.

export type Lifecycle = 'requested' | 'backlog' | 'active' | 'built' | 'deprecated';
export type Category = 'F' | 'S' | 'B' | 'C' | 'A' | 'I';
export type ReqId = `${Category}${number}`;
export type Requirement = { id: ReqId; text: string; parts: string[]; line: number } &
  ({ state: 'open' } | { state: 'settled'; review: boolean });
export type AnatomyPart = { name: string; description: string; binds?: { kind: 'slot' | 'part' | 'attr'; name: string } };
export type Example = { kind: 'do' | 'dont'; lang: string; code: string; violates: string[]; line: number };
export type Dated = { date: string; text: string; line: number };
export type Crd = {
  file: string; name: string; summary: string; lifecycle: Lifecycle; replacement?: string;
  channels: string[]; themes?: string[]; figma?: string; mimics: string[]; tags: string[];
  purpose: string; usage: string; migration: string;
  amendment: Dated[]; anatomy: AnatomyPart[]; requirements: Requirement[];
  ruledOut: { text: string; why: string; line: number }[];
  outOfScope: { topic: string; owner: string; line: number }[];
  decisions: (Dated & { owner: string })[];
  examples: Example[];
};
export type ParseError = { file: string; line: number; msg: string };

export const API_MARK = '<!-- ================= API (GERADO do CEM) ================= -->';

const LIFECYCLES: Lifecycle[] = ['requested', 'backlog', 'active', 'built', 'deprecated'];
const CATEGORIES = 'FSBCAI';
const SECTIONS = ['Emenda', 'Propósito e escopo', 'Anatomia', 'Requisitos', 'Descartado', 'Fora de escopo', 'Decisões', 'Uso', 'Migração', 'Exemplos'] as const;
type Section = (typeof SECTIONS)[number];

// YAML mínimo: chave: valor, listas inline, 1 nível de objeto (`chave:` vazia abre o objeto).
export function parseFrontmatter(md: string): Record<string, any> {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, any> = {};
  let parent: string | null = null;
  for (const raw of m[1].split('\n')) {
    const line = raw.replace(/\s+#.*$/, '');
    if (!line.trim()) continue;
    const nested = line.match(/^\s{2,}([\w-]+):\s*(.*)$/);
    const top = line.match(/^([\w-]+):\s*(.*)$/);
    const parse = (v: string) =>
      v.startsWith('[') ? v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
        : v.replace(/^["']|["']$/g, '');
    if (nested && parent) out[parent][nested[1]] = parse(nested[2]);
    else if (top) {
      if (top[2] === '') { parent = top[1]; out[parent] = {}; }
      else { parent = null; out[top[1]] = parse(top[2]); }
    }
  }
  return out;
}

const isDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const asList = (v: unknown): string[] | undefined => (v === undefined ? undefined : Array.isArray(v) ? v : [String(v)]);

export function parseCrd(md: string, file: string): { ok: true; crd: Crd } | { ok: false; errors: ParseError[] } {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const errors: ParseError[] = [];
  const err = (line: number, msg: string) => errors.push({ file, line, msg });

  const fmEnd = lines[0] === '---' ? lines.indexOf('---', 1) : -1;
  const fm = fmEnd > 0 ? parseFrontmatter(lines.slice(0, fmEnd + 1).join('\n')) : {};
  if (fmEnd < 0) err(1, 'frontmatter ausente: o arquivo deve começar com um bloco --- ... ---');
  const keyLine = (k: string) => {
    const i = lines.slice(1, Math.max(fmEnd, 1)).findIndex((l) => l.startsWith(`${k}:`));
    return i < 0 ? 1 : i + 2;
  };
  if (fmEnd > 0) {
    for (const k of ['component', 'summary', 'lifecycle']) if (!fm[k]) err(keyLine(k), `frontmatter: falta a chave obrigatória "${k}"`);
    if (fm.lifecycle && !LIFECYCLES.includes(fm.lifecycle))
      err(keyLine('lifecycle'), `frontmatter: lifecycle "${fm.lifecycle}" inválido (use ${LIFECYCLES.join(' | ')})`);
  }

  const crd: Crd = {
    file, name: fm.component ?? '', summary: fm.summary ?? '', lifecycle: fm.lifecycle,
    ...(fm.replacement && { replacement: fm.replacement }),
    channels: asList(fm.channels) ?? ['*'],
    ...(fm.themes && { themes: asList(fm.themes) }),
    ...(fm.figma && { figma: fm.figma }),
    mimics: asList(fm.mimics) ?? [], tags: asList(fm.tags) ?? [],
    purpose: '', usage: '', migration: '',
    amendment: [], anatomy: [], requirements: [], ruledOut: [], outOfScope: [], decisions: [], examples: [],
  };
  const seen = new Set<Section>();
  const reqIds = new Map<string, number>();
  const prose: Record<'purpose' | 'usage' | 'migration', string[]> = { purpose: [], usage: [], migration: [] };
  let section: Section | null = null;
  let reqCat: Category | null = null;
  let exKind: 'do' | 'dont' | null = null;
  let fence: { lang: string; line: number; body: string[] } | null = null;

  const closeFence = (f: { lang: string; line: number; body: string[] }) => {
    if (section !== 'Exemplos') return;
    if (!exKind) return err(f.line, 'Exemplos: bloco de código fora de "### Faça" ou "### Não faça"');
    const viola = f.body[0]?.match(/^\s*<!--\s*viola:\s*(.*?)\s*-->\s*$/);
    if (viola && exKind === 'do') err(f.line + 1, 'Exemplos: bloco de "Faça" não pode ter linha "viola:"');
    crd.examples.push({
      kind: exKind, lang: f.lang, code: f.body.join('\n'), line: f.line,
      violates: viola && exKind === 'dont' ? viola[1].split(',').map((s) => s.trim()).filter(Boolean) : [],
    });
  };

  for (let i = fmEnd + 1; i < lines.length; i++) {
    const text = lines[i];
    const n = i + 1;
    if (text.trim() === API_MARK) break;

    const proseKey = section === 'Uso' ? 'usage' : section === 'Propósito e escopo' ? 'purpose' : section === 'Migração' ? 'migration' : null;
    if (fence) {
      if (proseKey) prose[proseKey].push(text);
      if (/^\s*```\s*$/.test(text)) { closeFence(fence); fence = null; }
      else fence.body.push(text);
      continue;
    }
    const open = text.match(/^\s*```\s*([\w-]*)\s*$/);
    if (open) { fence = { lang: open[1], line: n, body: [] }; if (proseKey) prose[proseKey].push(text); continue; }

    const h2 = text.match(/^## (.+?)\s*$/);
    if (h2) {
      const name = h2[1] as Section;
      if (!SECTIONS.includes(name)) { err(n, `seção desconhecida "## ${h2[1]}" (permitidas: ${SECTIONS.join(', ')})`); section = null; }
      else if (seen.has(name)) { err(n, `seção "## ${name}" repetida`); section = null; }
      else { seen.add(name); section = name; }
      reqCat = null; exKind = null;
      continue;
    }

    const h3 = text.match(/^### (.+?)\s*$/);
    if (h3 && section === 'Requisitos') {
      const c = h3[1].match(/^([A-Z]) · .+$/);
      if (c && CATEGORIES.includes(c[1])) reqCat = c[1] as Category;
      else { err(n, `Requisitos: H3 "${h3[1]}" inválido (use "<L> · <nome>" com L em ${CATEGORIES.split('').join(' ')})`); reqCat = null; }
      continue;
    }
    if (h3 && section === 'Exemplos') {
      if (h3[1] === 'Faça') exKind = 'do';
      else if (h3[1] === 'Não faça') exKind = 'dont';
      else { err(n, `Exemplos: H3 "${h3[1]}" inválido (use "Faça" ou "Não faça")`); exKind = null; }
      continue;
    }

    if (proseKey) { prose[proseKey].push(text); continue; }
    if (!text.startsWith('- ')) continue;

    switch (section) {
      case 'Requisitos': {
        if (!reqCat) { err(n, 'Requisitos: item fora de um H3 de categoria'); break; }
        const m = text.match(/^- (\S+)((?:\s+\[(?:open|review)\])*)\s+(\S.*)$/);
        const id = m?.[1].match(/^([A-Z])([1-9]\d*)$/);
        if (!m || !id) { err(n, `Requisitos: item malformado (use "- ${reqCat}1 [open|review]? texto")`); break; }
        const markers = m[2].match(/\[(open|review)\]/g) ?? [];
        if (markers.includes('[open]') && markers.includes('[review]')) err(n, `Requisitos: ${m[1]} tem [open] e [review] ao mesmo tempo`);
        if (id[1] !== reqCat) err(n, `Requisitos: ${m[1]} está sob "${reqCat} · ..."; o ID deve começar com ${reqCat}`);
        if (reqIds.has(m[1])) err(n, `Requisitos: ID ${m[1]} duplicado (já usado na linha ${reqIds.get(m[1])})`);
        else reqIds.set(m[1], n);
        const base = { id: m[1] as ReqId, text: m[3], parts: [] as string[], line: n };
        crd.requirements.push(markers.includes('[open]') ? { ...base, state: 'open' } : { ...base, state: 'settled', review: markers.includes('[review]') });
        break;
      }
      case 'Anatomia': {
        const m = text.match(/^- `([^`]+)`:\s*(.*?)\s*(?:\((?:slot default|(slot|part|attr) `([^`]+)`)\))?$/);
        if (!m || !m[2]) { err(n, 'Anatomia: item malformado (use "- `nome`: descrição (slot|part|attr `x`)")'); break; }
        if (crd.anatomy.some((p) => p.name === m[1])) err(n, `Anatomia: parte "${m[1]}" repetida`);
        const bound = /\(slot default\)$/.test(text) ? { kind: 'slot' as const, name: '' }
          : m[3] ? { kind: m[3] as 'slot' | 'part' | 'attr', name: m[4] } : undefined;
        crd.anatomy.push({ name: m[1], description: m[2], ...(bound && { binds: bound }) });
        break;
      }
      case 'Descartado': {
        const m = text.match(/^- (.+?) · motivo: (.+)$/);
        if (!m) err(n, 'Descartado: falta " · motivo: <por quê>"');
        else crd.ruledOut.push({ text: m[1], why: m[2], line: n });
        break;
      }
      case 'Fora de escopo': {
        const m = text.match(/^- (.+?) → `([^`]+)`\s*$/);
        if (!m) err(n, 'Fora de escopo: item malformado (use "- tópico → `dono`")');
        else crd.outOfScope.push({ topic: m[1], owner: m[2], line: n });
        break;
      }
      case 'Decisões':
      case 'Emenda': {
        const m = text.match(/^- (\S+) · (.+)$/);
        if (!m || !isDate(m[1])) { err(n, `${section}: data inválida (use "- AAAA-MM-DD · texto")`); break; }
        if (section === 'Emenda') { crd.amendment.push({ date: m[1], text: m[2], line: n }); break; }
        const o = m[2].match(/^(.+?) · (@\S+)$/);
        crd.decisions.push({ date: m[1], text: o ? o[1] : m[2], owner: o ? o[2] : '', line: n });
        break;
      }
    }
  }
  if (fence) err(fence.line, 'bloco de código sem fechamento (```)');

  const partNames = new Set(crd.anatomy.map((p) => p.name));
  for (const r of crd.requirements)
    r.parts = [...new Set([...r.text.matchAll(/`([^`]+)`/g)].map((x) => x[1]).filter((w) => partNames.has(w)))];
  crd.purpose = prose.purpose.join('\n').trim();
  crd.usage = prose.usage.join('\n').trim();
  crd.migration = prose.migration.join('\n').trim();

  return errors.length ? { ok: false, errors: errors.sort((a, b) => a.line - b.line) } : { ok: true, crd };
}
