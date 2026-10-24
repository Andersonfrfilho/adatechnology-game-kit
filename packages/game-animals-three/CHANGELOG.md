# @adatechnology/game-animals-three

## 0.2.1

### Patch Changes

- Updated dependencies [e29f38d]
  - @adatechnology/game-props3d@0.3.0

## 0.2.0

### Minor Changes

- a41fcb7: The voices and the animal calls on `game-audio` (T6.1g). `game-characters-three` gets the sound bank of the bodies, 16 recipes whose traces equal the team code (the game's `grito` and `voz`, the art scene's `voice` behind groan, scream and leap, plus inhale, grab, bite, hurt, flesh, sever and gore), the table of the voices of the 13 undead types (`UNDEAD_VOICES`) and `createCharacterSound(host.audio)` (voices by moment, `body` events, what the player hears, the screamer's wind-up). `game-animals-three` gets the four calls of the game's `bichoSom` and `createAnimalSound` with the page's cooldowns. Both test areas play on the room's engine (new actions `voice`, `special_call` and `call`). `game-audio` exports the art scene's primitives (`sceneNoise`, `sceneTone`, `sceneVoice`, `sceneRecipe`); `game-destruction-three` uses them instead of its own copy (same recipes).

### Patch Changes

- Updated dependencies [a41fcb7]
- Updated dependencies [f49e466]
  - @adatechnology/game-audio@0.2.0
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

- 50eee43: Novo `@adatechnology/game-animals-three` 0.1.0 (spec 001, T4.3b e T4.4b): porte literal dos construtores dos Bichos do Vale (`quad`, `bird`, `snake`) e da animação, com os visuais vivo, infectado e morto para as 13 espécies, as vistas de juntas e aberta, e o módulo de teste `createAnimalsTestModule` (`?area=animals`). O `game-props3d` ganha `createNodeSkin` e `collectReferencedNodes`: uma malha de GPU que representa uma árvore inteira de peças, para muitos bichos numa chamada de desenho.

### Patch Changes

- Updated dependencies [76d15b6]
- Updated dependencies [50eee43]
- Updated dependencies [e980366]
- Updated dependencies [cc182c7]
- Updated dependencies [32a00c6]
- Updated dependencies [9e58b50]
  - @adatechnology/game-contracts@0.8.0
  - @adatechnology/game-props3d@0.2.0
  - @adatechnology/game-animals@0.1.0
