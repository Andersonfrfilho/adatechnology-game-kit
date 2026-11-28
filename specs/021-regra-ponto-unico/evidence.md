# 021 — Evidência

Worktree `regra-ponto-unico`, base `origin/main` em `ccfbd5a04` (2026-11-28). Medido, Jolt (`physicsOption()`), passo de 1/60.

## A1 — `kit-energy` passa

`pnpm --filter @adatechnology/game-destruction-three test -- kit-energy`: 7 testes, 7 passam (cinco tamanhos × 6 móveis × 3 cenários, e os dois da régua).
Em todo tamanho as quatro regras ligadas são exercitadas (`pushes > 0`).

## A2 — revertendo o #610 a régua nomeia a regra

`const reach = this.reachAlong(...)` trocado por `Math.max(...body.halfExtents)` só para a prova (desfeito): 5 dos 5 tamanhos reprovam, todas as linhas
novas começam por `goOverIfBalanced`. Exemplos:

| Tamanho | Caso | Deu | Queda |
|---|---|---|---|
| desenho | mesa 4,4 m, perdendo os pés | 11.877,8 J | 648,0 J |
| desenho | cama | 1.581,0 J | 395,1 J |
| desenho | mesa 1,6 m | 489,5 J | 256,0 J |
| 3x mais comprido | mesa 4,4 m | 440,7 J | 216,0 J |
| 1/3 | mesa 4,4 m | 39,9 J | 0,46 J |

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
