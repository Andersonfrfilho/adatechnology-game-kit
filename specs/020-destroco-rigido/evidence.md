# 020 — Evidência

Medido em 2026-11-28, worktree `spec-020-destroco-rigido`.

| O quê | Antes de qualquer correção | Com o remendo (#613) | Com a raiz |
|---|---|---|---|
| `long-debris-settles` (A1) | reprova tábua e ripa | passa | passa |
| Tábua sobre o caixote (A2) | atravessa o caixote (0,02 m) | atravessa o caixote (0,02 m) | apoiada no caixote |
| Sala, PKM, 110 tiros, pedaços compridos 4 s depois | 0,88 m no ar, acordado aos 10 s | todos dormindo, o mais alto a 0,12 m | todos dormindo, deitados (0° a 5°, os inclinados apoiados em outro) |
| `broken-catalogue-settles`, dívida | 14 | 14 | 9 |

- Suítes: `game-physics` 33, `game-physics-jolt` 263, `game-destruction-three` 911 passam.
- `game-floorplan-three`: `exact-golden`, `broken-catalogue*`, `destruction-pieces-never-rise`, `furniture-laid-still`, `house-switch-release` passam. A suíte
  inteira não terminou em 10 min com a máquina em carga 23; o CI é o juiz.
- Goldens regravados: só `destruction/breach`, `destruction/spall`, `destruction/fracture`.
- Caminho descartado, com o número: destroço na camada `debris` levantou uma porta 1,2 m numa explosão de 2 MJ e deu 5 m/s às piscinas quebradas.
- Não medido: `perf-gate`; salas além da de teste; destroço de casa na sala (`?area=house_complete`).
