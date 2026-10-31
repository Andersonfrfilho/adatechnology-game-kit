# Evidência — Spec 005

| Task | Data | Commit | Modelo | Gates | Notas |
|---|---|---|---|---|---|
| T0.1 | 2026-10-31 | (este commit) | opus | — | Plano D1–D9 a partir de `docs/arquitetura-plug-sdks.md` |
| T1.1 | 2026-10-31 | (este commit) | sonnet | `pnpm check:layers` sai 0 (342 conhecidas ignoradas); import novo proibido (`core-not-content`, `nothing-imports-test-room`, `no-deep-import`) faz sair 1 e foi revertido | `dependency-cruiser` 18.7, resolve os pacotes por `src` (tsconfig gerado em `node_modules/.cache`), sem build. Baseline: 13 `adapter-not-content`, 5 `content-not-adapter`, 5 `core-no-three`, 7 `core-not-content`, 272 `no-circular` (todos dentro de um pacote; 0 entre pacotes), 11 `no-domain-adapter-to-adapter`, 29 `testing-only-from-testing` (warn) |
