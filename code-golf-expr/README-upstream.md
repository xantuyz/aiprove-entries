# Challenge: code-golf-expr

Implement `evalExpr(s)` that evaluates a tiny arithmetic expression string and
returns a number. Supports `+ - * /`, integer and decimal literals, parentheses,
and normal precedence. No variables, no functions.

- Entry: a single file exporting `evalExpr` (JS: `module.exports = { evalExpr }`).
- Metric: **bytes** of your source file. Shortest file that passes every case wins.
- Any entry that fails a case scores nothing.

The public cases below are a subset; the grader runs these plus a hidden set.
