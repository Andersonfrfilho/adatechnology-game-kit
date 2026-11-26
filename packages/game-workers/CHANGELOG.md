# @adatechnology/game-workers

## 0.1.5

### Patch Changes

- Updated dependencies [d7fa717]
  - @adatechnology/game-contracts@0.41.0

## 0.1.4

### Patch Changes

- Updated dependencies [b3670e1]
  - @adatechnology/game-contracts@0.40.0

## 0.1.3

### Patch Changes

- Updated dependencies [2e803a4]
  - @adatechnology/game-contracts@0.39.0

## 0.1.2

### Patch Changes

- Updated dependencies [5682afd]
  - @adatechnology/game-contracts@0.38.0

## 0.1.1

### Patch Changes

- Updated dependencies [81e70aa]
  - @adatechnology/game-contracts@0.37.0

## 0.1.0

### Minor Changes

- f1c7229: Coordenador de workers do SDK (`game-workers`): quantidade automática pelos núcleos ou por configuração, faixas `sim`/`build`/`background`, prioridade e prazo em quadros, fallback no quadro principal com os mesmos bytes, navegador e Node. Contratos em `game-contracts`. A física da multidão roda como a residente `crowd.physics` quando o jogo passa `physics.workers`.
- 631d9d0: Thread de simulação (spec 009, T22): `installSimThread`, `startSimThread` e `runSimInline` no `game-workers`, com memória compartilhada sem espera na página (buffer triplo de retratos e anel de comandos); `SimModule` no `game-contracts`; a horda como módulo (`hordeSimModule`) no `game-crowd`; a bancada da multidão com `hordeThread`. `run` de uma categoria `sim` sem worker roda no quadro principal (a thread de simulação aguarda os jobs).
- 232c3a6: O coordenador passa a deixar 16 jobs com cada worker por padrão (`IN_FLIGHT_PER_WORKER`, era 2): uma rajada de jobs do quadro (as telhas do chão de uma explosão) não espera mais vários quadros de ida e volta pela thread principal. Medido na sala: 139 de 163 telhas atrasadas com 2, nenhuma com 16.

### Patch Changes

- Updated dependencies [cd5113c]
- Updated dependencies [ff1a27b]
- Updated dependencies [f1c7229]
- Updated dependencies [e3a9ee8]
- Updated dependencies [78ac539]
- Updated dependencies [5e05bb2]
- Updated dependencies [6fb91f5]
- Updated dependencies [c8b5c71]
- Updated dependencies [6356f68]
- Updated dependencies [65b522a]
- Updated dependencies [631d9d0]
- Updated dependencies [c394683]
- Updated dependencies [8d26913]
  - @adatechnology/game-contracts@0.36.0
