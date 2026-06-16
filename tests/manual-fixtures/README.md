# Manual CLI testing

These files are for local scanner tests only. Do not put real secrets here.

- `should-flag.js` — scanner should report hardcoded secret findings
- `should-flag-console.js` — scanner should report console.log leaks
- `should-pass.js` — scanner should stay clean (env vars only)

```bash
node bin/secretkeeper.js audit tests/manual-fixtures
```
