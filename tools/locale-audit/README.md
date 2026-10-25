# locale-audit

Lists, per package, the keys present in `pt-BR` and missing in `en` (and the reverse), `en` texts that are a copy of the `pt-BR`, and (as a note) placeholder differences.

```sh
node tools/locale-audit/audit.mjs                 # report
node tools/locale-audit/audit.mjs --check         # exit 1 when anything is found
node tools/locale-audit/audit.mjs --values        # show the copied texts
node tools/locale-audit/audit.mjs --package game-vfx
```

It reads `{ en, 'pt-BR' }` pairs from `packages/*/src`, `examples/*` and `site` (TypeScript is evaluated with the repo's own `typescript`; no new dependencies).

`allowlist.json`: `excluded` owners (packages left for a later round), `values` (texts that are the same word in both languages), `keys` and `keyPatterns` (`owner::key.path`), `knownGaps` (owner with a reported, intentionally open gap).
