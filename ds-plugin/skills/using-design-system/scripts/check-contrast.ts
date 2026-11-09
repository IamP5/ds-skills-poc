#!/usr/bin/env node
// Contraste WCAG entre dois tokens de cor, por tema. Exit 1 se algum contexto falhar.
// Uso: node scripts/check-contrast.ts color.text.on-action color.action.primary [--theme=all] [--large]
import { fail, parseArgs } from './lib/cli.ts';
import { checkContrast } from './lib/ops.ts';

const { flags, positional } = parseArgs();
const [fg, bg] = positional;
if (!fg || !bg) fail('Uso: check-contrast.ts <token-texto> <token-fundo> [--theme=<t>|all] [--large]');
try {
  const r = checkContrast(fg, bg, { theme: flags.theme, channel: flags.channel, large: flags.large === 'true' });
  console.log(r.text);
  process.exit(r.ok ? 0 : 1);
} catch (e) {
  fail((e as Error).message);
}
