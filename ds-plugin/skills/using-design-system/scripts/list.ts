#!/usr/bin/env node
// Lista itens do catálogo (nível 2 do progressive disclosure, sem arquivo intermediário).
// Uso: node scripts/list.ts components|templates|services [--lifecycle=built]
import { fail, parseArgs } from './lib/cli.ts';
import { list } from './lib/ops.ts';

const { flags, positional } = parseArgs();
if (!positional[0]) fail('Uso: list.ts <components|templates|services> [--lifecycle=built]');
console.log(list(positional[0], { lifecycle: flags.lifecycle }));
