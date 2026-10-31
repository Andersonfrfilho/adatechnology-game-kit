# @adatechnology/game-characters

## 0.2.5

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0

## 0.2.4

### Patch Changes

- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0

## 0.2.3

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0

## 0.2.2

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0

## 0.2.1

### Patch Changes

- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0

## 0.2.0

### Minor Changes

- 1331018: An explosive part can carry `explodes.lethalRadius` (and a blast `Hit` its `lethalRadius`; the `explode` event repeats it). A character inside it takes the whole blast, between it and `radius` it takes at most `blast.injuryPoints` (default 15 per segment) falling off to nothing at `radius`, so it is hurt but not killed. Without `lethalRadius` the blast is the old one: points fall off over `radius`.
- 95691ff: First-person clips: the `FirstPersonClip` format (hands and a foot as poses in the camera's space, with a weight that hands the pose back to what the hand is doing otherwise, and the same events as a `PoseClip`) and `sampleFirstPersonClip`, which eases between keys with the smoothstep of the pose clips.
- 15c5da6: The kick alternates legs (`kickLeg`: `alternate` default, `left`, `right`). `mirrorPoseClip` mirrors a pose clip (legs and arms swap, sideways channels flip, events and times stay); the first-person arms play a kick with `play(clip, { leg: 'left' })`; the room logs the leg in the strike entry.
- 4ecaa9f: Keyframed pose clips and the player's body. `game-characters`: `PoseClip`, `samplePoseClip` (the Bestiário `sample`), `clipEventsBetween`, `createPoseClipRegistry` and the two
  "grab and bite" clips (`POSE_CLIPS`, texts in `pt-BR` and `en`). `game-characters-three`: `createPlayerAvatar`, the team game's player body (rich human, default spec as data) that
  walks with the gait tied to ground speed, crouches, goes down, plays pose clips over the gait (upper or full body, with blend and events) and has a hand socket for weapons.

### Patch Changes

- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [1b1d611]
- Updated dependencies [d610199]
- Updated dependencies [9b27571]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0

## 0.1.6

### Patch Changes

- b6e8131: New package `game-crowd` (spec 001, T8.1a): any crowd as a struct of arrays, a literal port of the team game's horde (`hordeUpdate` and everything it calls).
  Relevance bands with hysteresis, perception by sight, hearing and smell, the sliced flow field, the spatial hash and separation, six attack slots, chain
  alerts, doors (`createDoors`), piles against walls, the special moves as type traits, corpses, the blood trail, the population and migrations, on the game's
  grid (`createNavGrid`). The golden `game-crowd.json` (8 scenes of the game code) is replayed frame by frame; global `GameCrowd`.
  `game-characters-undead` gives `undeadCrowdPack()` (the 13 types with the horde's numbers and traits); the corpse ledger of `game-characters` gains `remove(index)`.

## 0.1.5

### Patch Changes

- Updated dependencies [f49e466]
  - @adatechnology/game-contracts@0.13.0

## 0.1.4

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0

## 0.1.3

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0

## 0.1.2

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0

## 0.1.1

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0

## 0.1.0

### Minor Changes

- d8177f4: Modelo de dano do corpo (fase 4): o personagem é um `DestructibleImpl`. Resolve a parte, proteção em camadas (presets que reproduzem as roupas do jogo: coletes, capacete de uma bala, roupa de bombeiro; mordida e arranhão pela fórmula em camadas), penetração `physical` (P = √(E·m/A), calibrada: 9 mm atravessa 2 corpos, 5,56 três, .308 quatro) e `team-game`, pontos `3,5·E^0,37` ou tabela por calibre, multiplicadores, gravidade por segmento (quebra, arranca, destrói, cascata, manca, rasteja, partido ao meio, cabeça e mandíbula), regra de morte, sangramento em eventos `leak`, os dois níveis de detalhe (segmentos e as regiões do jogo) e `penetrateLine`. Presets `arsenal` e `elenco` reproduzem as páginas dos times.
- 038d6f1: `game-characters`: passada e pose em números puros (`walkGait` igual ao do jogo, `animateProfile`, cascata, `MOVES` do Elenco, poses do corpo instanciado), `createConditionTimeline`, `kit.createCorpses()` (400 corpos, 900 s) e o gerador de aparência (`drawBodyVariance`, `drawAppearance`, regra ZVAR).
- 5e64ab9: Novo pacote `@adatechnology/game-characters` (fase 4): corpo vivo sem engine. Proporções `GUIDE` (guia do Elenco, 1,80 m, ombros 0,61 m) e `TEAM_GAME` (juntas do jogo), rig com 17 juntas e os 12 ossos do corpo instanciado, árvore de 17 segmentos (os 11 tipos do Arsenal) com as 6 regiões da multidão, registro de presets por pacote (`packs`, `patch`, `remove`) e `createCharacters`.

### Patch Changes

- Updated dependencies [76d15b6]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
  - @adatechnology/game-contracts@0.8.0
