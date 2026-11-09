---
name: auditing-design-system
description: Audita a aderência de um repositório ao Design System (fase GROUND) e gera um relatório de drift sem corrigir nada. Use quando pedirem para auditar um repo ou pasta, medir drift do DS, listar componentes depreciados em uso ou valores crus no código.
---

# Auditando o Design System

Responde às 3 perguntas do GROUND para o escopo pedido (padrão: repo atual):
1. Quais componentes do DS estão em uso e com que lifecycle?
2. Quais regras estão sendo violadas?
3. Onde o produto já divergiu do DS?

## Passos
1. Liste o que existe: `design-system:ds_list` (components, templates, services)
   ou `node ../using-design-system/scripts/list.ts components`.
2. Gere o relatório base: `node ../using-design-system/scripts/check.ts --report <pasta>`
   (caminho relativo à pasta desta skill) e salve a saída como base do relatório.
3. Procure componentes custom que o `mimic` não pegou (ex.: `*Button*`, `*Modal*` fora de `node_modules`)
   e compare com o catálogo.
4. Para cada par texto/fundo de cor usado, valide em todos os temas com `ds_check_contrast`.

## Saída
Salve em `ds-audit-<data>.md` na raiz do projeto. **Resumo**, **Depreciados em uso**, **Valores crus** e
**Gaps do DS** vêm do relatório do passo 2; complete com o resto:
- **Resumo**: % de UI usando DS (a partir de "Uso do DS"), nº de violações por regra
- **Depreciados em uso**: arquivo:linha → substituto
- **Valores crus**: arquivo:linha → token semântico sugerido (só com match claro; senão "sem token")
- **Componentes duplicados**: custom → equivalente do DS (passo 3)
- **Gaps do DS**: casos legítimos sem cobertura. É feedback para o time do DS, não violação.

Não corrija nada nesta skill. Ela só diagnostica.
