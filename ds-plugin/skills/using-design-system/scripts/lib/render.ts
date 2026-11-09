// Texto dos achados de validate() para hooks, CI, review e auditoria.
import { RULES, type Finding, type Result } from './validate.ts';

export type FileResult = { file: string; result: Result };
export type Style = 'concise' | 'detailed' | 'report';

const open = (f: Finding) => !f.suppressed;
const isError = (f: Finding) => open(f) && f.severity === 'error';
const fixText = (f: Finding) => (f.fix ? ` → ${f.fix.use} (fonte: ${f.fix.source})` : '');
const all = (rs: FileResult[]) => rs.flatMap(({ file, result }) => result.findings.map((f) => ({ file, f })));

function concise(rs: FileResult[]): string {
  const lines = all(rs).filter(({ f }) => isError(f)).map(({ file, f }) => `${file}:${f.line}:${f.col} [${f.rule}] ${f.message}${fixText(f)}`);
  const warnings = all(rs).filter(({ f }) => open(f) && f.severity === 'warning').length;
  if (warnings) lines.push(`+ ${warnings} aviso(s) não listado(s) (peça o formato detailed para ver).`);
  return lines.join('\n');
}

function detailed(rs: FileResult[]): string {
  return rs
    .filter(({ result }) => result.findings.length)
    .map(({ file, result }) => [
      file,
      ...result.findings.map((f) =>
        `  ${f.line}:${f.col} ${f.severity === 'error' ? 'erro' : 'aviso'} [${f.rule}] ${f.message}${fixText(f)}${f.suppressed ? ` (suprimido: ${f.suppressed})` : ''}`),
    ].join('\n'))
    .join('\n\n');
}

function report(rs: FileResult[]): string {
  const found = all(rs);
  const live = found.filter(({ f }) => open(f));
  const list = (pred: (f: Finding) => boolean, line: (file: string, f: Finding) => string) => {
    const items = live.filter(({ f }) => pred(f)).map(({ file, f }) => `- ${line(file, f)}`);
    return items.length ? items : ['Nenhum.'];
  };
  const perRule = new Map<string, number>();
  for (const { f } of live) perRule.set(f.rule, (perRule.get(f.rule) ?? 0) + 1);
  const uses = new Map<string, number>();
  for (const { result } of rs) for (const [tag, n] of Object.entries(result.uses)) uses.set(tag, (uses.get(tag) ?? 0) + n);

  return [
    '# Relatório do Design System',
    '',
    '## Resumo',
    `- Arquivos analisados: ${rs.length}`,
    `- Erros: ${live.filter(({ f }) => f.severity === 'error').length} · Avisos: ${live.filter(({ f }) => f.severity === 'warning').length} · Suprimidos (ds-ignore): ${found.length - live.length}`,
    '',
    ...(perRule.size
      ? ['| Regra | Severidade | Achados |', '|---|---|---|',
        ...[...perRule].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([rule, n]) => `| ${rule} | ${RULES[rule as keyof typeof RULES].severity} | ${n} |`)]
      : ['Nenhuma violação.']),
    '',
    '## Uso do DS',
    ...(uses.size
      ? ['| Componente | Usos |', '|---|---|', ...[...uses].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, n]) => `| ${tag} | ${n} |`)]
      : ['Nenhum componente ds-* encontrado.']),
    '',
    '## Depreciados em uso',
    ...list((f) => f.rule === 'deprecated', (file, f) => `${file}:${f.line} → ${f.fix?.use ?? 'sem substituto'}`),
    '',
    '## Valores crus',
    ...list((f) => f.rule === 'raw-color' || f.rule === 'raw-spacing',
      (file, f) => `${file}:${f.line} \`${'raw' in f.subject ? f.subject.raw : ''}\` → ${f.fix ? `${f.fix.use}` : 'sem token'}`),
    '',
    '## Pedidos ao DS (gaps ou erros de digitação: tag, atributo, valor, slot ou token que não existe)',
    ...list((f) => RULES[f.rule].signal === 'gap', (file, f) => `${file}:${f.line} [${f.rule}] ${f.message}${f.fix ? ` → ${f.fix.use}` : ''}`),
    '',
  ].join('\n');
}

export function render(rs: FileResult[], style: Style): string {
  return style === 'report' ? report(rs) : style === 'detailed' ? detailed(rs) : concise(rs);
}
