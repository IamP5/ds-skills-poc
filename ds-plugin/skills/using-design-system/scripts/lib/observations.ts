// Observações: achados de gap e escapes (ds-ignore) gravados pelo CI dos produtos, para o time do DS ver a demanda real.
// Único dono do formato de observations.jsonl. O status (aberto/resolvido) é calculado contra o catálogo atual, nunca gravado.
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadCatalog, type CatalogItem } from './ops.ts';
import { isPrimitive } from './tokens.ts';
import { kebab, RULES, tokenIndex, tokenPath, type Result, type RuleId, type Subject, type TokenIndex } from './validate.ts';

export type Observation = {
  v: 1; fp: string; rule: RuleId; subject: Subject; file: string; line: number;
  suppressed?: string; seenAt: string; catalog: string;
};
export type GapStatus = 'open' | 'resolved';
export type CatalogLike = { items: CatalogItem[]; tokens?: TokenIndex };

export const FILE = 'observations.jsonl';
const sha1 = (s: string) => createHash('sha1').update(s).digest('hex');
// Sem generatedAt: rodar o build de novo sem mudar nada não pode virar "outro catálogo".
export const catalogHash = (items: CatalogItem[]) => sha1(JSON.stringify(items));
// Sem a linha: mover o código de lugar não cria uma observação nova.
const fingerprint = (rule: RuleId, file: string, subject: Subject) => sha1(`${rule}|${file}|${JSON.stringify(subject)}`);
const pathOf = (dirOrFile: string) =>
  existsSync(dirOrFile) && statSync(dirOrFile).isFile() ? dirOrFile : join(dirOrFile, FILE);

export function readObservations(dirOrFile: string): { observations: Observation[]; malformed: number } {
  const path = pathOf(dirOrFile);
  if (!existsSync(path)) return { observations: [], malformed: 0 };
  const observations: Observation[] = [];
  let malformed = 0;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      const ok = o?.v === 1 && typeof o.fp === 'string' && Object.hasOwn(RULES, o.rule) && o.subject && typeof o.subject === 'object'
        && typeof o.file === 'string' && typeof o.seenAt === 'string' && typeof o.catalog === 'string';
      if (ok) observations.push(o);
      else malformed++;
    } catch {
      malformed++;
    }
  }
  return { observations, malformed };
}

/** Grava achados de gap e todo achado suprimido (escape também é pedido ao DS). Idempotente por catálogo. Devolve quantas linhas entraram. */
export function record(results: { file: string; result: Result }[], dir: string, now = new Date()): number {
  const catalog = catalogHash(loadCatalog().items);
  const seen = new Set(readObservations(dir).observations.filter((o) => o.catalog === catalog).map((o) => o.fp));
  const lines: string[] = [];
  for (const { file, result } of results) {
    for (const f of result.findings) {
      if (RULES[f.rule].signal !== 'gap' && !f.suppressed) continue;
      const fp = fingerprint(f.rule, file, f.subject);
      if (seen.has(fp)) continue;
      seen.add(fp);
      const o: Observation = {
        v: 1, fp, rule: f.rule, subject: f.subject, file, line: f.line,
        ...(f.suppressed && { suppressed: f.suppressed }), seenAt: now.toISOString(), catalog,
      };
      lines.push(JSON.stringify(o));
    }
  }
  if (lines.length) {
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, FILE), lines.join('\n') + '\n');
  }
  return lines.length;
}

/** Por que a observação deixou de valer no catálogo dado; undefined = segue aberta. */
export function resolution(o: Observation, catalog: CatalogLike): string | undefined {
  const s = o.subject as Record<string, string | undefined>;
  const component = (tag?: string) => catalog.items.find((i) => i.kind === 'component' && i.name === tag);
  const item = component(s.tag);
  switch (o.rule) {
    case 'unknown-tag':
      return item ? `${s.tag} agora existe no catálogo` : undefined;
    case 'unknown-attr': {
      const attr = item?.api?.attributes.find((a) => a.name === s.attr || a.name === kebab(s.attr ?? ''));
      return attr ? `${s.tag} agora tem o atributo ${attr.name}` : undefined;
    }
    case 'invalid-enum': {
      const attr = item?.api?.attributes.find((a) => a.name === s.attr);
      return attr && (!attr.values || attr.values.includes(s.value ?? '')) ? `${s.tag} agora aceita ${s.attr}="${s.value}"` : undefined;
    }
    case 'unknown-slot':
      return item?.api?.slots.includes(s.slot ?? '') ? `${s.tag} agora tem o slot ${s.slot}` : undefined;
    case 'unknown-token': {
      const t = catalog.tokens ?? tokenIndex();
      const path = tokenPath(s.token ?? '', t);
      return t.semantic.has(path) || t.groups.has(path) ? `o token ${path} agora existe` : undefined;
    }
    case 'deprecated':
      return item && item.lifecycle !== 'deprecated' ? `${s.tag} não está mais deprecated` : undefined;
    case 'not-built':
      return item && item.lifecycle === 'built' ? `${s.tag} agora está built` : undefined;
    case 'theme-restricted':
      return item && !item.themes ? `${s.tag} agora vale para todos os temas` : undefined;
    case 'primitive-token': {
      const t = catalog.tokens ?? tokenIndex();
      return isPrimitive(tokenPath(s.token ?? '', t)) ? undefined : `${s.token} não é mais primitivo`;
    }
    case 'mimic':
      return catalog.items.some((i) => i.mimics?.includes(s.raw ?? '')) ? undefined : `nenhum componente declara mais o padrão "${s.raw}"`;
    default:
      return undefined;
  }
}

export const status = (o: Observation, catalog: CatalogLike): GapStatus => (resolution(o, catalog) ? 'resolved' : 'open');

const subjectText = (o: Observation): string => {
  const s = o.subject as Record<string, string | undefined>;
  if ('token' in s) return `\`${s.token}\``;
  if ('raw' in s) return `\`${s.raw}\``;
  if (s.slot !== undefined) return `\`${s.tag}\` slot \`${s.slot}\``;
  if (s.value !== undefined) return `\`${s.tag}\` ${s.attr}=\`${s.value}\``;
  if (s.attr !== undefined) return `\`${s.tag}\` atributo \`${s.attr}\``;
  return `\`${s.tag}\``;
};

type Row = { subject: string; count: number; files: string[]; last: string; why?: string };

// Mesma observação gravada sob catálogos diferentes conta uma vez; vale o registro mais recente.
function latestByFp(observations: Observation[]): Observation[] {
  const byFp = new Map<string, Observation>();
  for (const o of observations) {
    const prev = byFp.get(o.fp);
    if (!prev || o.seenAt > prev.seenAt) byFp.set(o.fp, o);
  }
  return [...byFp.values()];
}

function rows(observations: Observation[], key: (o: Observation) => string, label: (o: Observation) => string, catalog?: CatalogLike): Row[] {
  const groups = new Map<string, Observation[]>();
  for (const o of observations) groups.set(key(o), [...(groups.get(key(o)) ?? []), o]);
  return [...groups.values()]
    .map((os) => ({
      subject: label(os[0]),
      count: os.length,
      files: [...new Set(os.map((o) => o.file))],
      last: os.map((o) => o.seenAt).sort().at(-1)!.slice(0, 10),
      ...(catalog && { why: resolution(os[0], catalog) }),
    }))
    .sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject));
}

const table = (rs: Row[], resolved = false): string[] => {
  if (!rs.length) return ['Nenhum.'];
  const head = resolved ? '| Pedido | Resolvido porque | Ocorrências | Arquivos | Visto pela última vez |\n|---|---|---|---|---|'
    : '| Pedido | Ocorrências | Arquivos | Visto pela última vez |\n|---|---|---|---|';
  return [head, ...rs.map((r) => {
    const files = r.files.slice(0, 3).map((f) => `\`${f}\``).join(', ') + (r.files.length > 3 ? ` +${r.files.length - 3}` : '');
    return `| ${r.subject} |${resolved ? ` ${r.why} |` : ''} ${r.count} | ${files} | ${r.last} |`;
  })];
};

const SECTIONS: { title: string; anchor: string; rules: RuleId[] }[] = [
  { title: 'Componentes pedidos que não existem', anchor: 'componentes-pedidos-que-não-existem', rules: ['unknown-tag'] },
  { title: 'Atributos, valores e slots pedidos', anchor: 'atributos-valores-e-slots-pedidos', rules: ['unknown-attr', 'invalid-enum', 'unknown-slot'] },
  { title: 'Tokens pedidos', anchor: 'tokens-pedidos', rules: ['unknown-token'] },
];

/** gaps.md: demanda que os produtos registraram, com status calculado contra o catálogo dado. */
export function renderGaps(observations: Observation[], catalog: CatalogLike): string {
  const all = latestByFp(observations);
  const open = all.filter((o) => status(o, catalog) === 'open');
  const resolved = all.filter((o) => status(o, catalog) === 'resolved');
  const bySubject = (o: Observation) => `${o.rule}|${JSON.stringify(o.subject)}`;
  const body = [
    '## Abertos', '',
    ...SECTIONS.flatMap((s) => [`### ${s.title}`, '', ...table(rows(open.filter((o) => !o.suppressed && s.rules.includes(o.rule)), bySubject, subjectText)), '']),
    '### Escapes (ds-ignore)', '',
    ...table(rows(open.filter((o) => o.suppressed), (o) => `${o.rule}|${o.suppressed}`, (o) => `\`${o.rule}\`: ${o.suppressed}`)), '',
    '## Resolvidos desde a coleta', '',
    ...table(rows(resolved, bySubject, subjectText, catalog), true), '',
  ];
  const head = [
    '<!-- GERADO por tools/build-catalog.ts --observations. Nunca edite à mão: rode o build de novo. -->',
    '# Gaps observados nos produtos', '',
    `Pedidos ao DS registrados pelo \`check.ts --record\` no CI dos produtos: ${all.length} observação(ões), ${open.length} aberta(s).`,
    'Status calculado contra o catálogo deste build.', '',
  ];
  const index = '**Índice:** ' + [...SECTIONS, { title: 'Escapes', anchor: 'escapes-ds-ignore' }, { title: 'Resolvidos', anchor: 'resolvidos-desde-a-coleta' }]
    .map((s) => `[${s.title}](#${s.anchor})`).join(' · ');
  const lines = head.length + body.length;
  return [...head, ...(lines > 100 ? [index, ''] : []), ...body].join('\n').trimEnd() + '\n';
}
