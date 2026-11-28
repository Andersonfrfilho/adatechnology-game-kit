# 021 — Evidência

Worktree `regra-ponto-unico`, base `origin/main` em `ccfbd5a04` (2026-11-28). Medido, Jolt (`physicsOption()`), passo de 1/60.

## A1 — `kit-energy` passa

`pnpm --filter @adatechnology/game-destruction-three test -- kit-energy`: 7 testes, 7 passam (cinco tamanhos × 6 móveis × 3 cenários, e os dois da régua).
Em todo tamanho as quatro regras ligadas são exercitadas (`pushes > 0`).

## A2 — revertendo o #610 a régua nomeia a regra

`const reach = this.reachAlong(...)` trocado por `Math.max(...body.halfExtents)` só para a prova (desfeito): 5 dos 5 tamanhos reprovam, todas as linhas
novas começam por `goOverIfBalanced`:

| Tamanho | Caso (perdendo os pés um a um) | Deu | Queda |
|---|---|---|---|
| desenho | mesa 4,4 m (duas vezes) | 440,7 J e 300,6 J | 216,0 J e 163,0 J |
| 3x mais comprido | mesa 4,4 m | 11.877,8 J | 648,0 J |
| 3x mais comprido | cama / bancada / mesa / banco | 1.581,0 / 532,2 / 489,5 / 22,5 J | 395,1 / 254,3 / 256,0 / 6,3 J |
| 3x mais fundo | banco (duas vezes) | 25,6 J e 22,5 J | 23,2 J e 6,7 J |
| 3x mais alto | mesa 4,4 m | 403,7 J | 99,9 J (a linha de `KNOWN` aceita até 2,0 da queda: piorou, reprova) |
| 1/3 | mesa 4,4 m (duas vezes), mesa, bancada, banco | 39,9 / 11,9 / 0,76 / 0,76 / 0,029 J | 0,46 / 1,75 / 0,27 / 0,27 / 0,018 J |

## Resolução da régua

Antes do 1 mm de resolução, o `topple` aparecia centenas de vezes em tampos deitados (queda 0): o maior desses empurrões deu 0,003 mm de altura de energia,
três ordens abaixo de 1 mm. Com a resolução, nenhum.

## A3 — guardas, sem mudar limite

- `game-destruction-three`: `kit-energy`, `long-debris-settles`, `undermined-feet`, `support-lost`, `topple-energy`, `hold-push`, `pieces-tipping`,
  `determinism`, `energy-ruler`: 9 arquivos, 87 passam, 1 pulado (já pulado na main).
- `game-floorplan-three`: `broken-catalogue`, `-spin`, `-settles`, `destruction-pieces-never-rise`, `furniture-laid-still`, `exact-golden`: 6 arquivos,
  183 passam (256 s).
- `game-test-room`: `step-equivalence`, `room`, `invariant-log`: 3 arquivos, 41 passam.
- Nenhum golden nem linha de base regravado.

## A4 — `room.ts`

5222 linhas antes e depois.
