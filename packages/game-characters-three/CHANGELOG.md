# @adatechnology/game-characters-three

## 0.2.0

### Minor Changes

- cca7380: The `body` events reach the running film of the liquids (T5.3e). `createFluidsBridge` takes a `film` sink (the `splat` of `createFilmBridge`): a `wound` throws 3 drops of blood, a `severed`, `destroyed` or `split` segment throws 4, 7 or 10 (options `spray`, `burstDrops`), thrown along the way out, in the colours of the body's `BloodLook` (`WoundBody.blood`). `bloodLookOfAge(age)` reads `ages.json` (fresh and dry colours, `blood` as the amount; ages thinner than 0.3 bleed `old_blood`), and the characters area takes `film` and `bloodOf(age)`. The test room exposes the film bridge as `room.film`.
- a41fcb7: The voices and the animal calls on `game-audio` (T6.1g). `game-characters-three` gets the sound bank of the bodies, 16 recipes whose traces equal the team code (the game's `grito` and `voz`, the art scene's `voice` behind groan, scream and leap, plus inhale, grab, bite, hurt, flesh, sever and gore), the table of the voices of the 13 undead types (`UNDEAD_VOICES`) and `createCharacterSound(host.audio)` (voices by moment, `body` events, what the player hears, the screamer's wind-up). `game-animals-three` gets the four calls of the game's `bichoSom` and `createAnimalSound` with the page's cooldowns. Both test areas play on the room's engine (new actions `voice`, `special_call` and `call`). `game-audio` exports the art scene's primitives (`sceneNoise`, `sceneTone`, `sceneVoice`, `sceneRecipe`); `game-destruction-three` uses them instead of its own copy (same recipes).

### Patch Changes

- Updated dependencies [a41fcb7]
- Updated dependencies [f49e466]
  - @adatechnology/game-audio@0.2.0
  - @adatechnology/game-contracts@0.13.0
  - @adatechnology/game-characters@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0
  - @adatechnology/game-characters@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0
  - @adatechnology/game-characters@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0
  - @adatechnology/game-characters@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0
  - @adatechnology/game-characters@0.1.1

## 0.1.0

### Minor Changes

- ac61bb5: Novo pacote `@adatechnology/game-characters-three` (fase 4): caminho instanciado do corpo da multidão — geometria `buildInstancedBody` (16/10/5), trecho de shader `BODY_CHUNK` igual ao do jogo, material, `createBodyBatch`, `bakeBody`/`bakeVariants` (regra ZVAR) e `createFlyingLimbs`. O three entra pelo host.
- 50eee43: Caminho rico do `game-characters-three` (spec 001, T4.1h, T4.1i e T4.4a): `createBestBuilder` (Bestiário v17, porte literal conferido por 780 cenas gravadas), `createPersonBuilder` (sobreviventes com 62 acessórios, chapéus, rosto e mãos), `createRigAnimator` (andar, cascata, pose), `createWounds` (corte, osso quebrado que balança, membro que voa, estouro, decalques), `findEyes`, `createFluidsBridge` e o módulo de teste `createCharactersTestModule` com `registerBodyMaterial` (`?area=characters`).

### Patch Changes

- Updated dependencies [76d15b6]
- Updated dependencies [d8177f4]
- Updated dependencies [038d6f1]
- Updated dependencies [5e64ab9]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
  - @adatechnology/game-contracts@0.8.0
  - @adatechnology/game-characters@0.1.0
