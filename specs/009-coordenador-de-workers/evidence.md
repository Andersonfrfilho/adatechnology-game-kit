# Evidência — Spec 009

## 2026-11-18 — Fase A (container, sem GPU)

- `pnpm --filter @adatechnology/game-workers test`: 15 passando, incluindo `worker_threads` (mesmos bytes; worker que morre é substituído).
- `game-crowd` `tests/physics/coordinator.test.ts`: 600 agentes, 300 passos, hash do estado igual ao protocolo `inline` sem worker, com
  worker a tempo (≥ 90% a tempo), com worker sempre atrasado e com `worker_threads` em latência 1 e 2. Suíte da multidão: 122 passando.
- `examples/crowd-test-area/test.mjs` (Chromium com GL por software): 3 workers sobem e conhecem `crowd.physics`; a horda passa por eles;
  todas as checagens da área passam. Com GL por software cada quadro leva ~1,8 s e todo passo cai no quadro principal (mesmo resultado):
  a fração a tempo é medida no helios (T5). Print: `examples/crowd-test-area/shots/crowd-workers-pt-BR.png`.
