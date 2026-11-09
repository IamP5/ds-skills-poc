#!/usr/bin/env node
// Servidor MCP (stdio) do Design System — sem dependências.
// Expõe as MESMAS operações dos scripts da skill (skills/using-design-system/scripts/lib/),
// para qualquer cliente MCP: Claude Code, GitHub Copilot (VS Code), Cursor, Codex...
//
// Só leitura. Retorna entidades (itens, valores resolvidos), não páginas de doc.
import { createInterface } from 'node:readline';
import { describe, SECTIONS, type Section } from '../skills/using-design-system/scripts/lib/component.ts';
import { checkContrast, find, list, resolveToken } from '../skills/using-design-system/scripts/lib/ops.ts';
import { render } from '../skills/using-design-system/scripts/lib/render.ts';
import { listContexts } from '../skills/using-design-system/scripts/lib/tokens.ts';
import { validate } from '../skills/using-design-system/scripts/lib/validate.ts';

const SERVER = { name: 'design-system', version: '0.3.0' };

type Tool = { name: string; description: string; inputSchema: object; run: (a: any) => string | { text: string; isError?: boolean } };

const contexts = listContexts();
const optionsOf = (mod: string) => contexts[mod]?.contexts ?? [];
const ctxProps = {
  theme: { type: 'string', enum: [...optionsOf('theme'), 'all'] },
  channel: { type: 'string', enum: [...optionsOf('channel'), 'all'] },
};
const singleCtxProps = {
  theme: { type: 'string', enum: optionsOf('theme') },
  channel: { type: 'string', enum: optionsOf('channel') },
};
const FORMATS = ['concise', 'detailed'];

/** Mensagem de entrada inválida com as opções válidas, ou null se ok. */
function badInput(a: Record<string, unknown>, allowAll: boolean): string | null {
  for (const mod of ['theme', 'channel']) {
    const v = a[mod];
    const valid = [...optionsOf(mod), ...(allowAll ? ['all'] : [])];
    if (v !== undefined && !valid.includes(String(v))) return `${mod} "${v}" não existe. Opções: ${valid.join(', ')}.`;
  }
  if (a.format !== undefined && !FORMATS.includes(String(a.format))) return `format "${a.format}" inválido. Opções: ${FORMATS.join(', ')}.`;
  return null;
}
const checked = (allowAll: boolean, run: Tool['run']): Tool['run'] => (a) => {
  const bad = badInput(a, allowAll);
  return bad ? { text: bad, isError: true } : run(a);
};

const TOOLS: Tool[] = [
  {
    name: 'ds_list',
    description: 'Lista componentes, templates ou services do Design System com resumo, lifecycle, contexto e caminho do doc. Use antes de escolher o que usar; só itens com lifecycle "built" podem ser usados.',
    inputSchema: {
      type: 'object',
      properties: { kind: { type: 'string', enum: ['components', 'templates', 'services'] }, lifecycle: { type: 'string' } },
      required: ['kind'],
    },
    run: (a) => list(a.kind, { lifecycle: a.lifecycle }),
  },
  {
    name: 'ds_find',
    description: 'Busca por intenção (em pt-BR) em ícones, flags, logos, ilustrações, animações, componentes, templates e services. Ex.: "seta voltar", "filtro extrato".',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        type: { type: 'string', enum: ['icon', 'flag', 'logo', 'illustration', 'animation', 'component', 'template', 'service'] },
        theme: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
    run: (a) => find(a.query, a),
  },
  {
    name: 'ds_get_component',
    description: 'Retorna o que o Design System sabe de um item pelo nome (ex.: ds-button, FilterSheetFlow): intenção, requisitos com ID, o que está fora de escopo e quem é o dono, o que foi descartado, exemplos de Faça/Não faça e a API. Avisa quando uma decisão está [open] e deve voltar ao humano, e mostra o substituto e a migração de itens depreciados. Por padrão é conciso; format "detailed" devolve o doc inteiro; sections filtra o conciso.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        format: { type: 'string', enum: FORMATS },
        sections: { type: 'array', items: { type: 'string', enum: SECTIONS } },
      },
      required: ['name'],
    },
    run: checked(false, (a) => {
      if (typeof a.name !== 'string' || !a.name) return { text: 'Informe name, ex.: "ds-button". Liste com ds_list.', isError: true };
      return describe(a.name, { format: a.format ?? 'concise', sections: a.sections as Section[] | undefined });
    }),
  },
  {
    name: 'ds_validate',
    description: 'Valida o uso do Design System num trecho de código ANTES de gravá-lo no arquivo. Aponta tags, atributos, valores de enum e slots inexistentes, itens depreciados ou ainda não construídos, valores crus (cor, medida), tokens primitivos e ramificações por tema no código, cada um com a correção. O file (só o nome basta) define a linguagem; theme e channel restringem o contexto.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        file: { type: 'string', description: 'Nome ou caminho do arquivo de destino, ex.: Extrato.tsx' },
        ...singleCtxProps,
        format: { type: 'string', enum: FORMATS },
      },
      required: ['code', 'file'],
    },
    run: checked(false, (a) => {
      if (typeof a.code !== 'string' || typeof a.file !== 'string' || !a.file)
        return { text: 'Informe code (o trecho) e file (ex.: "Extrato.tsx", define a linguagem).', isError: true };
      const result = validate(a.code, { file: a.file, theme: a.theme, channel: a.channel });
      if (!result.findings.length) return { text: `Nenhum erro de uso do DS em ${a.file}.`, isError: false };
      const text = render([{ file: a.file, result }], a.format ?? 'concise');
      const hasError = result.findings.some((f) => f.severity === 'error' && !f.suppressed);
      return { text: hasError ? text : `Nenhum erro; só avisos.\n${text}`, isError: false };
    }),
  },
  {
    name: 'ds_resolve_token',
    description: 'Valor final de um token semântico por contexto (DTCG resolver: theme × channel). Use "all" para comparar contextos.',
    inputSchema: { type: 'object', properties: { token: { type: 'string' }, ...ctxProps }, required: ['token'] },
    run: checked(true, (a) => resolveToken(a.token, a)),
  },
  {
    name: 'ds_check_contrast',
    description: 'Contraste WCAG entre dois tokens de cor em cada tema.',
    inputSchema: {
      type: 'object',
      properties: { foreground: { type: 'string' }, background: { type: 'string' }, ...ctxProps, large: { type: 'boolean' } },
      required: ['foreground', 'background'],
    },
    run: checked(true, (a) => checkContrast(a.foreground, a.background, a)),
  },
];

const send = (msg: object) => process.stdout.write(JSON.stringify(msg) + '\n');
const reply = (id: any, result: object) => send({ jsonrpc: '2.0', id, result });
const error = (id: any, code: number, message: string) => send({ jsonrpc: '2.0', id, error: { code, message } });

createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return;
  let msg: any;
  try { msg = JSON.parse(line); } catch { return error(null, -32700, 'Parse error'); }
  const { id, method, params } = msg;
  if (id === undefined) return; // notificações (ex.: notifications/initialized)

  switch (method) {
    case 'initialize':
      return reply(id, {
        protocolVersion: params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: SERVER,
        instructions: 'Design System: use ds_list/ds_find para descobrir, ds_get_component para ler só o item escolhido, ds_validate antes de gravar código, ds_resolve_token para valores por tema/canal.',
      });
    case 'ping':
      return reply(id, {});
    case 'tools/list':
      return reply(id, { tools: TOOLS.map(({ run, ...t }) => t) });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return error(id, -32602, `Tool desconhecida: ${params?.name}`);
      try {
        const r = tool.run(params.arguments ?? {});
        const { text, isError } = typeof r === 'string' ? { text: r, isError: false } : r;
        return reply(id, { content: [{ type: 'text', text }], isError: !!isError });
      } catch (e) {
        return reply(id, { content: [{ type: 'text', text: (e as Error).message }], isError: true });
      }
    }
    default:
      return error(id, -32601, `Método não suportado: ${method}`);
  }
});
