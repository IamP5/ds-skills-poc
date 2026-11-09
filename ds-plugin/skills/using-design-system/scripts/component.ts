#!/usr/bin/env node
// Doc de um item do catálogo pronto para o agente (requisitos com ID, donos, exemplos, API).
// Uso: node scripts/component.ts ds-button [--format=concise|detailed] [--sections=requisitos,api]
import { fail, parseArgs } from './lib/cli.ts';
import { describe, type Section } from './lib/component.ts';

const { flags, positional } = parseArgs();
const [name] = positional;
if (!name) fail('Uso: component.ts <nome> [--format=concise|detailed] [--sections=a,b]');
const format = flags.format ?? 'concise';
if (format !== 'concise' && format !== 'detailed') fail(`--format inválido: "${format}". Use concise ou detailed.`);
const sections = flags.sections?.split(',').map((s) => s.trim()).filter(Boolean) as Section[] | undefined;
const r = describe(name, { format, sections });
if (r.isError) fail(r.text);
console.log(r.text);
