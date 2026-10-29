# @adatechnology/game-characters-three

## 0.3.1

### Patch Changes

- 692c098: Test room: C crouches (`crouch.keys` option) without also firing the held item's second use, Ctrl/Alt+key stay in the game while playing, closing the page asks first, and a "Full screen" button keeps the whole keyboard (Ctrl+W included). Player avatar: crouch pose and arm carrying angle. Destruction: leaks follow the moved object and hole decals sit on dented skins.
  - @adatechnology/game-characters@0.2.0

## 0.3.0

### Minor Changes

- 6546677: The avatar area drops the four disabled "pending" entries (Soco, Empurrão, Chute, Tiro) and offers a button per registered clip, so passing `ATTACK_CLIPS` as `clips` gives the strikes. New option `clipLocales` for the phase texts, and a clip's `impact` event is logged as its own `impact` JSON line. `AvatarAreaText` loses `pending` and `pendingHint`.
- 4e90488: The player's body in the test room: `toRoomAvatar(avatar)` fits `createPlayerAvatar` to the room's `setAvatar`, and `createAvatarTestModule` (`AVATAR_AREA_ID` `avatar_area`) brings the bench buttons for the 1st/3rd person view, crouch, fall, armed and the pose clips (grab, bite), disabled entries for the animations pending from the Elenco team, metrics and a JSON line in the log per action.
- 8feb42f: An explosion shoves what is around it. `blastShove` (game-contracts) is the one rule, `min(maxSpeed, sqrt(2 * energy * coupling / mass)) * (1 - d / r)^2`, with every number in `BlastShoveOptions` (the room's `blastShove` option, lent to modules as `ModuleHost.blastShove`). The destruction renderer uses it for its pieces and, with `shoveable`/`onLoosened`, makes a heavy object that is not fixed a piece when a blast reaches it. The test room marks heavy, free items that way, and wraps an item whose builder scales the root so that its spec, box and mass are in metres (a can of beans was 0.7 m and 460 kg). The characters test area pushes its people and knocks them down. The explosives area has scenarios that measure the push of a P13 shot and a thrown M67.
- 574f847: `createFirstPersonArms` (sleeves, hands that close on a grip, a two-bone IK to the hand targets, stances, clips for punch, shove and kick with the right leg) and `toRoomAvatar` gives the room the arms and `strike` by default (`firstPerson: false` to disable). `PlayerAvatar` exposes `colors` and `three`.
- 6889db1: The hands work the parts a reload clip moves (`data/hand-work.json`: slide rack or thumb release on a pistol, charging handle on ARs and AKs after an empty reload, bolt handle, loading port, crane, belt cover), following the clip's own timeline; `ToolClipPlayer.running` exposes the clip time. The right index finger rests along the frame, goes to the trigger after a shot and pulls with the trigger part (`HandTargets.fingers.index`).
- 15c5da6: The kick alternates legs (`kickLeg`: `alternate` default, `left`, `right`). `mirrorPoseClip` mirrors a pose clip (legs and arms swap, sideways channels flip, events and times stay); the first-person arms play a kick with `play(clip, { leg: 'left' })`; the room logs the leg in the strike entry.
- 4ecaa9f: Keyframed pose clips and the player's body. `game-characters`: `PoseClip`, `samplePoseClip` (the Bestiário `sample`), `clipEventsBetween`, `createPoseClipRegistry` and the two
  "grab and bite" clips (`POSE_CLIPS`, texts in `pt-BR` and `en`). `game-characters-three`: `createPlayerAvatar`, the team game's player body (rich human, default spec as data) that
  walks with the gait tied to ground speed, crouches, goes down, plays pose clips over the gait (upper or full body, with blend and events) and has a hand socket for weapons.
- a185888: Strikes stop at contact: the update state of the first-person arms takes an optional `contact(origin, direction, maxDistance)` (distance to the first surface or null) that the room answers with its raycast, leaving out the player, the held item and the viewmodel. The hands and the kick foot stay a few millimetres in front of the surface along the camera forward, so the elbow bends instead of the hand entering the mesh.

### Patch Changes

- fcd0be6: The weapon models, the animals and the characters draw their geometry with game-shapes (`shapeGeometries(host)`), with the same bytes as before (exact goldens of 367, 27 and 281 cases). game-weapons-three no longer depends on game-props3d. The IIFE builds of game-props3d, game-interactables-three and game-weapons-three bundle game-shapes. `shapeGeometries` of a namespace it made gives it back.
- Updated dependencies [6546677]
- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [95691ff]
- Updated dependencies [95691ff]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [15c5da6]
- Updated dependencies [1b1d611]
- Updated dependencies [d610199]
- Updated dependencies [9b27571]
- Updated dependencies [4ecaa9f]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [fcd0be6]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-characters-people@0.3.0
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-characters@0.2.0
  - @adatechnology/game-shapes-three@0.1.1
  - @adatechnology/game-audio@0.2.1

## 0.2.1

### Patch Changes

- Updated dependencies [b6e8131]
  - @adatechnology/game-characters@0.1.6

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
