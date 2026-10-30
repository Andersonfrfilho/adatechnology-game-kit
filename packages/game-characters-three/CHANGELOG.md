# @adatechnology/game-characters-three

## 0.5.0

### Minor Changes

- e5ac121: Pushing furniture: holding the interaction button against a piece fills a ring by its mass, then the player walks with it, slower with the load; `world.sweepBox` tests the volume of the piece before each step, an obstacle or too much mass locks it and the player strains; poses in first and third person, and a drag sound by material.
- a2b0bb3: Third-person punches redone from boxing technique: jab, cross, hook and uppercut move the whole body (guard, hip and shoulder turn, full extension, front knee) from and back to a new looping `fight_guard` clip; `toRoomAvatar` holds that guard between punches (`guardClip`, `guardHold`, `punchBlend`), and a `grip` event closes the fists on a clip with no impact.

### Patch Changes

- ae81390: Crouching in the test room. A tap of C stays crouched until the next tap and a longer press crouches while held; before, a tap only dipped the view for a moment. A crouched body keeps its legs bent under a punch and the fighting guard, which used to stand it up while the camera stayed low; only a kick takes the legs.
- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- 8aa480b: A punch combo as an ability. `ATTACK_CLIPS` and `FIRST_PERSON_CLIPS` gain `jab`, `hook` and `uppercut` (written for the right hand, the left plays the mirror), and `PUNCH_COMBO` (`StrikeCombo`) chains jab (left), cross (right), hook (left), uppercut (right). The test room takes it as `strikeCombo`: while it is on (N, its button, `setStrikeCombo`, `strikeComboOn`) each punch is the next step and a pause longer than `reset` starts over; off, the punch is the usual one. The player body closes the hands for any clip whose impact is a punch.
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [a2b0bb3]
- Updated dependencies [8aa480b]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-audio@0.3.3
  - @adatechnology/game-characters-people@0.4.0
  - @adatechnology/game-characters@0.2.4

## 0.4.2

### Patch Changes

- 454e821: Punches alternate hands and the third-person punch reads as one. The room throws `hand`/`fists` punches right, left, right (`punchHand`: `alternate` default, `left`, `right`; `punchTools`) and logs the hand; `strike(clip, { hand: 'left' })` plays the mirror of the clip on the body and the left fist on the first-person arms (`arms.play(clip, { hand: 'left' })`). On the body, `punch_right` and `front_kick` now move the same arm and leg the first-person view shows (they moved the other side), the punch aims at the centre with the guard up, and the joints follow a clip that does not loop 5 times faster (`clipCascade`), so the arm reaches the shoulder by the impact instead of lagging halfway.
- Updated dependencies [da5261d]
- Updated dependencies [454e821]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-characters-people@0.3.3
  - @adatechnology/game-audio@0.3.2
  - @adatechnology/game-characters@0.2.3

## 0.4.1

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-audio@0.3.1
  - @adatechnology/game-characters@0.2.2
  - @adatechnology/game-characters-people@0.3.2

## 0.4.0

### Minor Changes

- df42f4b: The test areas use the pieces of the kit instead of boxes: the weapons counters are the buffet of the furniture catalogue, the shelves and the finds table of the items area are a workbench and a meeting table of the catalogue, the 1.80 m reference is a person the host gives (`person` of `createItemsTestModule`; `personSpecOf` of `game-characters-three` is exported for it), and the probe of the sound bench is what the host gives (`probe` of `createAudioTestModule`, a portable radio of the goods catalogue in the kit's room). Without `person` or `probe` the area draws none.

### Patch Changes

- df42f4b: Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.
- Updated dependencies [df42f4b]
- Updated dependencies [df42f4b]
  - @adatechnology/game-audio@0.3.0
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-characters@0.2.1
  - @adatechnology/game-characters-people@0.3.1

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
