#!/usr/bin/env node
// Busca por intenção em assets e no catálogo. O catálogo inteiro nunca entra no contexto.
// Uso: node scripts/find.ts "seta voltar" [--type=icon|flag|logo|illustration|animation|component|template|service] [--theme=premium] [--limit=5]
import { fail, parseArgs } from './lib/cli.ts';
import { find } from './lib/ops.ts';

const { flags, positional } = parseArgs();
if (!positional.length) fail('Uso: find.ts "<intenção>" [--type=...] [--theme=...]');
console.log(find(positional.join(' '), { type: flags.type, theme: flags.theme, limit: flags.limit ? Number(flags.limit) : undefined }));
