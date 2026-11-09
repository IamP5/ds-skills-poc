#!/usr/bin/env node
// Build-time: exporta um DESIGN.md (spec aberta do Google, alpha) por tema, DERIVADO dos tokens.
// Serve para ferramentas que leem DESIGN.md (Stitch, Figma Make, v0...). Não é fonte de verdade:
// nunca edite o arquivo gerado — mude os tokens e rode de novo.
//
// Uso: node tools/export-design-md.ts [--channel=app]
// Validação: npx @google/design.md lint skills/using-design-system/data/design-md/DESIGN.<tema>.md
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTree, getNode, listContexts, listTokens, resolve } from '../skills/using-design-system/scripts/lib/tokens.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'skills/using-design-system/data/design-md');
const channel = process.argv.find((a) => a.startsWith('--channel='))?.slice(10) ?? 'app';
mkdirSync(outDir, { recursive: true });

const q = (s: string) => JSON.stringify(s);
const dim = (v: any) => `${v.value}${v.unit}`;
const key = (path: string, prefix: string) => path.slice(prefix.length + 1).replace(/\./g, '-');

for (const theme of listContexts().theme.contexts) {
  const { tree } = buildTree({ theme, channel });
  const val = (p: string) => resolve(tree, p).value;
  const desc = (p: string) => getNode(buildTree({}).tree, p)?.$description ?? '';

  const colors = listTokens(tree, 'color').map((p) => [key(p, 'color'), val(p).hex, p] as const);
  const typography = listTokens(tree, 'font').map((p) => [key(p, 'font'), val(p), p] as const);
  const rounded = listTokens(tree, 'radius').map((p) => [key(p, 'radius'), dim(val(p))] as const);
  const spacing = listTokens(tree, 'space').map((p) => [key(p, 'space'), dim(val(p))] as const);

  const yaml = [
    '---',
    'version: alpha',
    `name: ${q(`Design System — ${theme} (${channel})`)}`,
    `description: ${q(`Gerado de data/tokens/ds.resolver.json com theme=${theme}, channel=${channel}. Não edite.`)}`,
    'colors:', ...colors.map(([k, hex]) => `  ${k}: ${q(hex)}`),
    'typography:',
    ...typography.flatMap(([k, t]) => [
      `  ${k}:`,
      `    fontFamily: ${q(Array.isArray(t.fontFamily) ? t.fontFamily[0] : t.fontFamily)}`,
      `    fontSize: ${dim(t.fontSize)}`,
      `    fontWeight: ${t.fontWeight}`,
      `    lineHeight: ${t.lineHeight}`,
    ]),
    'rounded:', ...rounded.map(([k, v]) => `  ${k}: ${v}`),
    'spacing:', ...spacing.map(([k, v]) => `  ${k}: ${v}`),
    'components:',
    '  button-primary:',
    '    backgroundColor: "{colors.action-primary}"',
    '    textColor: "{colors.text-on-action}"',
    '    typography: "{typography.label}"',
    '    rounded: "{rounded.control}"',
    '    padding: "{spacing.inset-md}"',
    `    height: ${dim(val('size.control.min-height'))}`,
    '  button-primary-hover:',
    '    backgroundColor: "{colors.action-primary-hover}"',
    '  card:',
    '    backgroundColor: "{colors.surface-raised}"',
    '    textColor: "{colors.text-default}"',
    '    rounded: "{rounded.container}"',
    '    padding: "{spacing.inset-md}"',
    '---',
  ].join('\n');

  const body = [
    '',
    '## Overview',
    '',
    `Tema **${theme}**, canal **${channel}**. Este arquivo é uma exportação para ferramentas que leem DESIGN.md.`,
    'Para componentes, templates e regras de uso completas, use a skill `using-design-system` ou o MCP `design-system`.',
    '',
    '## Colors',
    '',
    ...colors.map(([k, hex, p]) => `- **${k}** (${hex}): ${desc(p)}`),
    '',
    '## Typography',
    '',
    ...typography.map(([k, , p]) => `- **${k}**: ${desc(p)}`),
    '',
    '## Layout',
    '',
    ...spacing.map(([k, v]) => `- **${k}**: ${v}`),
    '',
    '## Shapes',
    '',
    ...rounded.map(([k, v]) => `- **${k}**: ${v}`),
    '',
    '## Components',
    '',
    '- **button-primary**: uma ação principal por área. Navegação usa link, não botão.',
    '- **card**: superfície elevada para agrupar conteúdo resumido.',
    '',
    "## Do's and Don'ts",
    '',
    '- Do: use só os tokens acima; nunca valores crus.',
    '- Do: erro de validação usa `feedback-error`, não `action-danger`.',
    "- Don't: criar variações de cor por tela ou ramificar por tema no código.",
    '',
  ].join('\n');

  const file = join(outDir, `DESIGN.${theme}.md`);
  writeFileSync(file, yaml + '\n' + body);
  console.log(`DESIGN.${theme}.md (${colors.length} cores, ${typography.length} tipografias)`);
}
