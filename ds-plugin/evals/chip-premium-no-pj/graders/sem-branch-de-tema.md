---
type: regex
pattern: "(?<!`if \\()(?<!`)\\btheme\\s*===?\\s*['\"]"
match: not_contains
---

Ignora a regra citada em código inline (`` `if (theme === 'pj')` ``), que o agente usa para explicar o que não fazer.
