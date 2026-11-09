import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describe } from './component.ts';

const concise = (name: string) => {
  const r = describe(name, { format: 'concise' });
  assert.ok(!r.isError, r.text);
  return r.text;
};

test('ds-button concise: requisitos com ID, dono do fora de escopo, exemplo e API', () => {
  const t = concise('ds-button');
  assert.match(t, /^F1 /m);
  assert.match(t, /^B1 \[review\] /m);
  assert.ok(t.includes('→ ds-link'));
  assert.ok(t.includes('```html'));
  assert.ok(t.includes('Não faça (viola: F1)'));
  assert.ok(t.includes('variant: primary|secondary|ghost|danger'));
  assert.ok(!t.includes('## Decisões'), 'decisões só quando pedidas');
});

test('ds-chip-premium concise: manda parar no requisito [open]', () => {
  assert.match(concise('ds-chip-premium'), /PARE: C1 está \[open\]/);
});

test('ds-old-dialog concise: substituto e tabela de migração', () => {
  const t = concise('ds-old-dialog');
  assert.ok(t.includes('deprecated → ds-modal'));
  assert.ok(t.includes('| `title` | `heading` |'));
});

test('sections filtra o concise', () => {
  const t = concise('ds-button');
  const r = describe('ds-button', { format: 'concise', sections: ['api'] });
  assert.ok(r.text.includes('## API') && !r.text.includes('## Requisitos'));
  assert.ok(t.length > r.text.length);
});

test('detailed devolve o CRD inteiro, com a API gerada', () => {
  const t = describe('ds-button', { format: 'detailed' }).text;
  assert.ok(t.startsWith('---\ncomponent: ds-button'));
  assert.ok(t.includes('## API (gerado do CEM)'));
});

test('template devolve o próprio doc', () => {
  const r = describe('FilterSheetFlow', { format: 'concise' });
  assert.ok(!r.isError);
  assert.ok(r.text.includes('template: FilterSheetFlow'));
});

test('nome desconhecido: erro com sugestão', () => {
  const r = describe('ds-buton', { format: 'concise' });
  assert.equal(r.isError, true);
  assert.ok(r.text.includes('ds-button'));
});

test('seção desconhecida: erro listando as válidas', () => {
  const r = describe('ds-button', { format: 'concise', sections: ['xx' as any] });
  assert.equal(r.isError, true);
  assert.ok(r.text.includes('requisitos'));
});
