---
type: regex
target: { source: file, path: src/extrato-filtros.html }
pattern: '#[0-9a-fA-F]{3,8}\b|rgba?\('
match: not_contains
weight: 2
---
