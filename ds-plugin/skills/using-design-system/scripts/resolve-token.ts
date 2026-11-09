#!/usr/bin/env node
// Valor final de um token por contexto (DTCG resolver: theme × channel).
// Uso: node scripts/resolve-token.ts color.action.primary [--theme=pj|all] [--channel=web|all]
import { fail, parseArgs } from './lib/cli.ts';
import { resolveToken } from './lib/ops.ts';

const { flags, positional } = parseArgs();
if (!positional[0]) fail('Uso: resolve-token.ts <token> [--theme=<t>|all] [--channel=<c>|all]');
try {
  console.log(resolveToken(positional[0], { theme: flags.theme, channel: flags.channel }));
} catch (e) {
  fail((e as Error).message);
}
