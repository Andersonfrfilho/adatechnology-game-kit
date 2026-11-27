# @adatechnology/game-player

## 0.12.0

### Minor Changes

- 7fcd9d8: O jogador da sala ganha o ponto `Locomotion` (TS.9g a TS.9m): o caminho `own` é o código de sempre, movido sem mudar comportamento; com `host.physics` (laço do motor) o corpo é um `createWalker` no mundo (`player-body.ts`), com o veto dos blockers, `kickLight` desligado, câmera na fase `present`, nocaute e batida, sentar/voar/veículo por `park`/`unpark` e o avatar lendo os pés desenhados. `Walker.teleport(feet)` novo no `game-player`; `Player.hold`, `Player.engine`, `drawnX`/`drawnZ` e o `bodiless` do `footing` na sala. Com `physics: 'own'` nada muda.

## 0.11.0

### Minor Changes

- 837d7f0: O jogador no motor (TS.9a a TS.9f): `pushCharacter` respeita o eixo y (pulo) e `CharacterDesc.gravity?` (9,81); `setCharacterShape` (três posturas, false se penetrar); `CharacterDesc.shadow?` e `characterBody` (cápsula-sombra); `readCharacterGround`; personagens no `saveState`/`restoreState`; `createWalker` no `game-player`.

### Patch Changes

- Updated dependencies [837d7f0]
  - @adatechnology/game-physics@0.8.0

## 0.10.5

### Patch Changes

- Updated dependencies [3b5f3be]
  - @adatechnology/game-physics@0.7.0

## 0.10.4

### Patch Changes

- Updated dependencies [e4a9d0e]
  - @adatechnology/game-physics@0.6.0

## 0.10.3

### Patch Changes

- Updated dependencies [4afbea0]
  - @adatechnology/game-contracts@0.43.0
  - @adatechnology/game-physics@0.5.0

## 0.10.2

### Patch Changes

- Updated dependencies [9412886]
- Updated dependencies [cf37f9c]
- Updated dependencies [cefa5d9]
  - @adatechnology/game-contracts@0.42.0
  - @adatechnology/game-physics@0.4.0

## 0.10.1

### Patch Changes

- Updated dependencies [d7fa717]
  - @adatechnology/game-contracts@0.41.0

## 0.10.0

### Minor Changes

- 7e40a5b: Controlador de personagem atrás do contrato (spec 008, T4.1). `game-physics` ganha `createCharacter`, `moveCharacter`, `pushCharacter`, `readCharacter`, `teleportCharacter`, `characterSupported` e `removeCharacter` (sobe degrau de 18 cm, rampa de 30 graus, empurra caixa de 30 kg, é empurrado); `game-physics-jolt` os implementa com o `CharacterVirtual` por `CharacterId`; `game-player` aceita `PlayerWorld.controller` e traz `createPhysicsController`. Sem controlador o jogador anda pela grade como antes.

  Segurar, soltar e arremessar (T4.2): `grabBody` em `game-physics` (cinemático varrido contra o que é fixo, sem atravessar parede; solta como dinâmico e varrido) e `setContinuous` no contrato.

### Patch Changes

- Updated dependencies [7e40a5b]
  - @adatechnology/game-physics@0.3.0

## 0.9.2

### Patch Changes

- Updated dependencies [b3670e1]
  - @adatechnology/game-contracts@0.40.0

## 0.9.1

### Patch Changes

- Updated dependencies [2e803a4]
  - @adatechnology/game-contracts@0.39.0

## 0.9.0

### Minor Changes

- c6faa01: O corpo que anda em passos fixos deixa de tremer: `createStepPose` (game-player) guarda os dois últimos passos e mistura pelo `alpha` do agendador, e o distrito de referência desenha o corpo e a câmera por ele (a 144 Hz o corpo andava 0 ou 2 passos por quadro, variação de 118% na velocidade desenhada). Na sala, o braço da câmera em terceira pessoa volta a se afastar da parede (o `dt` da recuperação era sempre 0) e o olho sobe uma soleira ou borda de laje em poucos quadros, em vez de um salto de 4,5 cm.

## 0.8.1

### Patch Changes

- Updated dependencies [5682afd]
  - @adatechnology/game-contracts@0.38.0

## 0.8.0

### Minor Changes

- 81e70aa: Hands and holster (owner's rule, 2026-11-24): `planHands`, `drawBackOf` and `interactionHandsFor` in game-player; `rules.hands` and `weaponHandsOf` in game-weapons; the test room picks a small thing up in the off hand with the weapon still in hand, and a big thing or a push first puts the weapon away in the slot that fits (`bodySlots`, default a hip holster) or drops it to the floor, drawing it back after.

### Patch Changes

- Updated dependencies [81e70aa]
  - @adatechnology/game-contracts@0.37.0

## 0.7.0

### Minor Changes

- fcf6f83: `@adatechnology/game-player/hud`: o HUD do corpo (vida, fôlego, sangramento, infecção, ferimentos, arma e munição, nome da cena, mensagens e mira em primeira pessoa) e a tela de morte ("Você morreu", causa, tempo sobrevivido, "Reiniciar cena" com Enter/R e "Voltar ao início"), em DOM e sem three.js, com textos em pt-BR e en.

### Patch Changes

- c8b5c71: Spec 008 (fases 1–3 até a T3.8): motor físico Jolt Physics como opção do kit, desligado por padrão.

  - Pacotes novos: `game-physics` (contrato do motor, fila de despertar, medidor de custo) e `game-physics-jolt` (adaptador do Jolt). O Jolt é escolhido por `physics`; sem ele, o solver próprio segue como hoje.
  - Entulho de explosão opcional (`blastDebris`): as peças despertam em lotes, com o mínimo e o máximo ajustados pelo custo medido na máquina.
  - Colisores fiéis ao desenho:
    - a caixa só vale quando as faces estão cobertas;
    - se as faces não estão cobertas, a peça colide pelos triângulos (batentes e molduras não são mais placas maciças).
  - Portas e janelas sem peças nascendo umas dentro das outras.
  - Fiação e canos se soltam em trechos (`segmentLimits`), cortados em lajes e paredes.
  - O chão é montado ao longo do caminho de peças rápidas.
  - Os estilhaços de granada sorteiam por alvo: um objeto novo na cena não muda mais onde eles caem.
  - A mão empurra a porta que se afasta, em vez de seguir a folha (spec 004).

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

## 0.6.4

### Patch Changes

- Updated dependencies [b0b031b]
  - @adatechnology/game-contracts@0.35.0

## 0.6.3

### Patch Changes

- Updated dependencies [779f9f4]
  - @adatechnology/game-contracts@0.34.0

## 0.6.2

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0

## 0.6.1

### Patch Changes

- Updated dependencies [4e2d44b]
  - @adatechnology/game-contracts@0.32.0

## 0.6.0

### Minor Changes

- 99183cb: Pushing, as in the real world. A pushed piece that meets a loose one shoves it along when the legs beat the frictions of the whole row (`canPush`, `pushSpeedFor` and `pushAccelerationFor` take a row; `FurniturePush.setLoad`), and locks when they do not. Dragging scratches the floor by its material (`dragMarks` in `FurniturePushRules`, `dragMarkFor`): wood and tile scratch, concrete scuffs, dirt and sand furrow, carpet and grass keep no mark; the scratch is a persistent `scrape` mark of `game-vfx` (`VfxWorld.scrape`, at most `SCRAPE_LIMIT`, the oldest leaving first), drawn instanced by `game-vfx-three`. Civilians walk round a piece of furniture along its face instead of shoving it (`crowd.movableAt`, `bodyRadius`), and `flee` starts its own stuck count. A liquid spilled on a table top goes with the pushed table (`FluidWorld.moveSurface`). `world.sweepBox` ignores a list of objects.
- 1dea1ac: Pushing furniture with what rests on it, and being shoved by a horde. The push now speeds up as a person does (`accel` in `FurniturePushRules`: the force left over the friction over the mass, at most 1.5 m/s², braking at 3 m/s²), so a cup on a pushed table rides along, and a sudden stop (the piece hits something, or the player lets go) throws what rests on it forward with the speed it had (`slipsOnTop`, `frictionFor`, `pushAccelerationFor`; each step reports `velocity`, `acceleration` and `stoppedFrom`). The agents of a crowd stop at the faces of the host's movable furniture (`crowd.setMovables`), lean their force on it with the arms out and the body forward (`numbers.shoveForce`, the look's `shoveLean`), and their forces add up (`crowd.shoves`); the host moves the piece at the speed that force gives it (`ModuleHost.movables` and `ModuleHost.shove`). The test room's table is pushable, carries what rests on its top and adds its mass to the push; a module's bodies shove what the player can push, a piece too heavy for one of them moves for three, and a shoved piece stops at the player. The crowd bench has a `furniture_shove` scene.

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0

## 0.5.8

### Patch Changes

- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0

## 0.5.7

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0

## 0.5.6

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0

## 0.5.5

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0

## 0.5.4

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0

## 0.5.3

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0

## 0.5.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0

## 0.5.1

### Patch Changes

- 9a151ad: `urgent` on a play (`PlayOptions`, `SoundRequest`): the voice is built at once instead of in the deferred start queue. The body's sounds use it (footsteps, jump, landing, swing, hit): at a low frame rate the queue started the hit of a knife, an axe or a bat 60 to 500 ms late, or dropped it.
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0

## 0.5.0

### Minor Changes

- 15046ce: Body sounds by action and by floor. `game-contracts` names them (`footstep_<surface>_<walk|run>` on 12 surfaces, `land_<surface>_<light|heavy>`, the swing and the hit of each blow, hurt, bite, grab, body fall) with `surfaceOfMaterial` and the `footfall` host event; `game-audio` answers every id with `BODY_FOLEY_BANK` (four takes each) and adds sound sets (`SoundBank.sets`: a take that never repeats, at ±4% of rate, through `retunePlan`) and `SoundRequest.delay`; `game-player` emits the ids (`sound.ids`, the team class stays in `sound.sound`), reads the floor (`world.surfaceAt`, `input.surface`) and steps on the host's footfalls (`input.footfall`); the player body says when a heel is down (`footfall()`); the test room sends the footfalls, plays the jump and the landing on the floor under the feet, the swing just before the contact and the hit with it.
- 455522d: New `./testing` subpath on each package that ships a test area or bench (spec 005, D6): `import { createXTestModule } from '@adatechnology/game-<pkg>/testing'`. The test areas, benches and their texts moved behind it so the runtime entry does not carry them. Nothing is removed: every export that used to be on the package root is still there, `@deprecated`, and will be removed in the next major. The ESM build splits chunks (`splitting: true`), so the root and `./testing` share one copy of the module-level registries.

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [7b77aa7]
- Updated dependencies [d97cf9f]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
  - @adatechnology/game-contracts@0.22.0

## 0.4.1

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0

## 0.4.0

### Minor Changes

- 7051d83: Opening doors by hand: a tap of E on a door, lid or drawer of furniture or a vehicle (any part an `open_*` clip moves) opens or closes it. The player steps up to the handle, the hand takes the free edge and follows it in first and third person, the leaf swings at a speed set by its mass and stops at what is in its way, a door that swings into the player makes the player step back, and a locked leaf only rattles (`createDoorUse` in game-player, `room.useLeaf`/`lockLeaf`). New sounds for the latch, the hinge, the leaf meeting the frame and the rattle. House doors use the same hand and body through the new `ModuleHost.reachFor`.

### Patch Changes

- 7f7dd06: A leaf left between closed and open goes the other way from where the last use sent it: a door that hit something while opening closes on the next E instead of trying to open again forever (`DoorUseTarget.lastGoal`, `DoorUseRules.endTolerance`; the room remembers the last way of each leaf). At either end the old rule holds, so a leaf put back by a reset opens.
- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [53babb5]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0

## 0.3.1

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0

## 0.3.0

### Minor Changes

- e5ac121: Pushing furniture: holding the interaction button against a piece fills a ring by its mass, then the player walks with it, slower with the load; `world.sweepBox` tests the volume of the piece before each step, an obstacle or too much mass locks it and the player strains; poses in first and third person, and a drag sound by material.

### Patch Changes

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0

## 0.2.4

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0

## 0.2.3

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0

## 0.2.2

### Patch Changes

- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0

## 0.2.1

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

## 0.2.0

### Minor Changes

- e6452f5: New package: the player's body (spec 001, T8.3), a literal port of the team game's player. `createPlayer` gives vitals from an attribute sheet (derived values as data),
  stamina, wounds that bleed and the bandage, the grab with six pushes or the knife, knock-downs, low-wall vaults, footstep noise, panic, the shove and the melee blow against
  any crowd (`PlayerCrowd`), and an optional individual infection (off by default: the normal world first). Every number has its source in `defaults.json`; the golden
  `game-player.json` (18 scripted runs of the game code) is replayed frame by frame. `createPlayerTestModule` is the `player_area` bench; texts in `en` and `pt-BR`; global `GamePlayer`.
