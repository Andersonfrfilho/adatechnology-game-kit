# @adatechnology/game-audio

## 0.12.0

### Minor Changes

- 4e8b8b8: Recorded sounds for the grenade launcher and the rocket: 33 CC0 takes from Freesound, credited in `assets/sfx/CREDITOS.md`. `launcher_40mm` (the 40 mm thunk of the M79, M32 and M203) and `rocket_launch` (an RPG-7 firing, three shots cut from one field recording, and more) are played by `WeaponAudio.launch`; the break-open reload (`barrels_open` and `barrels_close`, the hinged barrels of the M79 and of the break-action shotguns, which share the cue; `breech_open`, `grenade_load` and `breech_close`, the breech of a rocket launcher) and the rocket loading (`rocket_load`, `rocket_seat`) are the cues of the reload clips, whose hits are measured in `reload-sample-hits.json`; `explosion_rocket` is the blast of the rocket family; `rocket_motor_loop` is the motor of a rocket in flight, which the test room plays as one loop that follows the rockets in the air (`ROCKET_MOTOR`) and stops when the last one has burst. The recipes of the same ids stay as the fallback while a file decodes (the motor has a new one, `ROCKET_MOTOR_LOOP`).

## 0.11.0

### Minor Changes

- 89f1d9d: Sound occlusion: `createAudioEngine({ occlusion: { query } })` asks the host what lies between a sound and the ears (material and thickness, or a loss in dB), adds the transmission loss of the hits (`TRANSMISSION_LOSS`, a table of real values a game patches: 12 cm brick about 42 dB, concrete 48, drywall 33, wooden door 22, glass 27, open doorway 0, the mass law for other thicknesses) up to a configurable cap so a sound that gets around an edge never drops to silence, and plays each positioned voice through its own gain and lowpass (highs lose more). Voices are re-queried as the listener moves, at a limited rate and within a per-update budget, only while audible, and the gain and cutoff glide with `setTargetAtTime`. `occludedVoices()` reports the numbers. The old `(point) => 0..1` callback still works. The test room hands its engine a query that crosses its destruction world (`createWorldOcclusion`): the part's material, and its thickness from the way in and the way out.

## 0.10.0

### Minor Changes

- baaa7d4: Recorded wood splinters (by blow strength), axe and blade hits on wood, metal clangs, scrapes and pings, cloth rips and cloth thumps (by strength) replace the synthesized recipes of those impacts: 44 CC0 takes from Freesound, credited in `assets/sfx/CREDITOS.md`. `splinter`, `shot_wood`, `shot_metal`, `break_wood`, `impact_soft_blunt` and `break_fabric` are keys of the impact table now, and a blow sends its strength (`intensity`) so the light, medium or heavy take plays. The recipes of the same ids stay as the fallback while a file decodes.

## 0.9.4

### Patch Changes

- 5ce9f7b: `scripts/sfx-merge.mjs`: when `.sfx-local.json` links a game's sound folder, the test room also serves the `sfx:user` sounds the game's manifest does not answer (under `sfx-local/_sfx-user/`), so the game's folder no longer hides them; the game's manifest inside its own folder is no longer linked over its copy.
- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0

## 0.9.3

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0

## 0.9.2

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0

## 0.9.1

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0

## 0.9.0

### Minor Changes

- 9a44330: Synthesized sounds measured from the recordings. `@adatechnology/game-audio/fitted` holds the fitted copy of every recorded sound but the vehicles (band gain curves and ringing partials per take, measured by `tools/sfx-sources/fit.mjs`), and `registerFittedSounds(engine)` puts them in place of the older hand-made recipes of the same ids, so a door, a shot or a footstep stays close to its recording where the files are missing or still loading. The test room registers them; the weapons play the fitted shot, reload step and case under the recorded id (`played.kind === 'fitted'`) instead of the synthesized layers until the files load.

  The kit ships its default recorded sounds again: the 1050 CC0 and CC-BY takes in `@adatechnology/game-audio/assets/sfx/<categoria>/` (credits in `CREDITOS.md`), and `pointSamples(engine, files, { baseUrl })` lets a game play its own files for any id (the id keeps the kit's numbers) without touching the kit. Git takes only the manifest's CC0 and CC-BY files there.

- c8b0e40: `AudioSink.preload(ids)`: o módulo pede para decodificar as gravações já ao carregar, e o primeiro uso toca o arquivo, não o sintetizado. A área de veículos
  pré-carrega `VEHICLE_PRELOAD_SOUNDS` (motor, partida, desligar, portas e porta-malas): a primeira porta de carro aberta na 4280 tocava a receita.

  `SampleAlias.only`: o recorte vale só para as tomadas cujo arquivo contém esse trecho. A partida e o desligar do carro foram medidos na tomada `_01` de
  `engine_start_run_stop`, mas o jogo também sorteava a `_02` (21,9 s, que começa com o motor já ligado), e em metade das vezes o desligar tocava
  marcha lenta. Agora os dois usam só a `_01`.

  `loadSamples(ids)` lembra os ids que ainda não têm arquivo (o manifest ainda carregando) e carrega assim que um banco os resolve: o pré-carregamento
  da área de veículos acontece antes de o manifest chegar, e a primeira partida ainda tocava a receita.

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0

## 0.8.0

### Minor Changes

- 33c09f1: Sons de carro gravados por referência. `game-audio`: `SampleRef.offset`/`duration` (um trecho do arquivo, com fade no corte), `SampleSound.baseFrequency`
  (o laço gravado segue `set({ frequency })` pela taxa de reprodução), laço gravado com posição (queda e lado pelo ouvinte) e `SoundBank.sampleAliases`
  (um id do pacote toca as tomadas de um id do manifest, resolvido na consulta). `game-vehicles-three`: `VEHICLE_SAMPLE_ALIASES` liga o motor do carro
  (marcha lenta a 1 000 rpm, alta a 2 520 rpm) a `rpm / rpm gravado`, a partida e o desligar recortados de `engine_start_run_stop`, a porta e o
  porta-malas aos arquivos do jogo; sem os arquivos, tudo continua sintetizado.

### Patch Changes

- 63adb4c: The hand foley of the test room plays the recorded takes: `KIT_SAMPLE_ALIASES` points `door_wood_close` and `door_wood_slam` at the wooden door shut and slam files and the item pickups (metal, plastic, glass, wood, fabric) at the pickup files, and the room preloads those ids (`HAND_RECORDED_IDS`) on the first key or click. Taking an item now plays one sound, the item's class: the second `grab_*` sound that played with it at the same moment is gone.
- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0

## 0.7.0

### Minor Changes

- 2aae2ac: Catálogo de sons com 59 ids novos (cães, insetos, ventilador, minigun, fita e tampa de metralhadora, guardar arma, luneta, pino e fumaça de granada, C4 remota e desarmando, choque e faísca, tiro na cabeça, capacete e colete, sangue, inventário, curativo, lanterna, elevador, portas e portões, quedas, coração, passo no vidro, jato, turbina, burnout, freio de mão, sirene) e o bloco `impactos` no catálogo, para o painel de som listar os sons que o jogo referencia.

## 0.6.1

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0

## 0.6.0

### Minor Changes

- 6b44b4e: Sons do dono fora do git: `loadUserSamples` registra os arquivos convertidos por `sfx:user` (em `.sfx-local/`, a partir de `user-sounds/picks.json`). Onde o SDK não tem gravação toca o do dono; onde tem, o SDK toca primeiro e o do dono fica de reserva (e em `user:<id>`). O painel de som mostra a fonte do que tocou (SDK, seu som, sintetizado) e ganha "Tocar o seu"; o catálogo ganha os usos novos (rajada .45, sacar, supressor, granada quicando, C4, passos em azulejo/grade/água/duto, escada, nadar, zumbis, helicóptero).

## 0.5.0

### Minor Changes

- fb6d690: Explosions and fire sound like what happened. `createDestructionSound` plays the family of each explosion from its effect (grenade, big charge, fuel vessel, car, pipe bomb, rocket, flashbang, molotov; `BLAST_KIND_OF`, changeable by option), the far rumble past 60 m and the indoor tail when the blast was confined; fire has its ignition "whoomp" (at most two at once when many parts catch together), a gas leak while a punctured vessel vents, a lower roar and crackles at the burning points (`update(dt)`). The renderer sends the explosion's effect, radius and confinement with `explode` (`SoundDetail`). game-audio adds the `kit` mix (the art scene chain plus a soft limiter with a −1 dBFS ceiling), now the default: a blast with its debris no longer clips the output. The room passes the thrown explosive's id to the renderer and ticks the fire crackles.
  A car's fuel tank names its explosion (`car_fuel_tank`), so it sounds and looks like a car going up.
- 672f918: Recorded firearm sounds: 231 takes cut from The Free Firearm Sound Library (CC0), the Restrained Firearms Soundpack and the Oculus Audio Pack 1 (CC BY 4.0) by `tools/sfx-sources/cut.mjs`. A shot plays the near and mid-distance takes of its calibre profile with a crossover by distance; each reload step plays its recording in the tier of the weapon's weight; a case's first bounce plays the recorded floor. Without the files the synthesized sounds play. `AnimationEventSpec.lead` fires a sound event early by real seconds, so the measured hit of each recording (`reload-sample-hits.json`) lands on the frame the part reaches its stop.
- ebb9479: Foley of the hand. `game-audio` ships `FOLEY_BANK`: doors (wooden, metal, locked rattle, slam), fridge, microwave, drawers, item pickup by material, throw, can and bottle opening, gulps, chewing and first aid, under the ids of the sound list so a recorded take under the same id replaces the synthesised one. Each recipe draws pitch, timing and level from ranges (no two plays alike) and uses `FOLEY_FALLOFF`, which falls off faster and loses its highs with distance. `LEAF_FOLEY_SETS` groups the leaf sounds by kind (`fridge`, `microwave`, `drawer`, `wood_door`, `metal_door`).

  `TestableItem.sounds` (`ItemSounds`) lets an item name its leaf sound set per part, its pickup class, its opening sound and the sound of each use. The household fridges and microwave declare theirs; a vehicle's leaves are left to the vehicle bank (`game-vehicles-three`).

  `createDestructionSound` registers the foley bank and plays a key without a rule that is the id of a registered sound. The test room plays a leaf's set (the item's, else a drawer for a slide, else a metal or wooden door by material; a heavy leaf slams), and now sounds when an item is picked up, thrown, opened (can tab or screw cap) and while it is drunk or eaten. The doors keys `leaf_latch`, `leaf_creak_*`, `leaf_shut_*` and `leaf_rattle` are no longer sent by the room's doors.

- 784a6b0: Sound panel of the test room (categories, material × blow matrix, place and distance, A/B with blind test, C1–C10 measuring) and looping sample sounds: `SampleSound.loop` makes `engine.loop(id)` chain the takes with an equal-power crossfade, with the recipe loop standing in while the files load.
- 5d614c6: Sounds from recorded files: `SampleSound` in a bank's `samples` (takes per layer: `close`, `far`, `tiers` light/medium/heavy, `tail.indoor`/`tail.outdoor`), `planSample` (round-robin without repeat, ±pitch, equal-power near/far crossover, distance and wall lowpass, pan), `engine.play` plays the files once loaded and the `fallback` recipe meanwhile, `loadSamples`, `sampleStatus`, `setEnvironment`, `PlayOptions.environment`/`intensity`, a zero-delay limiter per bus for sample voices, `choke` for rapid fire, `onVoiceStart` and `output()` for measuring. `sampleBankFromManifest` reads the manifest of `scripts/sfx-convert.mjs` (assets/sfx-inbox → Ogg Vorbis mono 48 kHz at −1 dBFS, CC0/CC-BY only, CREDITOS.md). `measureCriteria` measures C1–C9 on an OfflineAudioContext through the real engine, `recordOutput` records the output for C10, and `createSoundCheckModule` (testing) is the `sound_check_area` of the test room.
- 9a151ad: `urgent` on a play (`PlayOptions`, `SoundRequest`): the voice is built at once instead of in the deferred start queue. The body's sounds use it (footsteps, jump, landing, swing, hit): at a low frame rate the queue started the hit of a knife, an axe or a bat 60 to 500 ms late, or dropped it.
- 4145cc9: Vehicle sounds that follow what the vehicle does. `game-audio`: a loop can carry a `falloff` and `pan`, and `set` takes a `position` (level and side from the listener, duller far away) and a `cutoff` (the first filter); the sink passes `params.cutoff` and the position through. `game-vehicles-three`: `VEHICLE_SOUND_BANK` and `createVehicleSound` — the engine as loops crossfaded by RPM at the firing frequency (car, truck, bike profiles), louder and brighter under load, an RPM guessed through gears for drivers without an engine model, the starter (catching with a flare, or failing), ignition off, tyres squealing on asphalt or hissing on dirt by slip, road noise by speed, crashes light / medium / heavy by speed, and car doors, trunk and hood. The vehicles area turns the key before the lane car pulls away. `game-test-room`: a leaf of an object tagged `vehicle` plays `vehicle_<door|trunk|hood>_<open|shut>`; `game-destruction-three` maps those to the car sounds, falling back to the old latch and metal shut when the vehicle bank is not loaded (`SoundKeyRule.fallback`).

### Patch Changes

- 4dce01e: Recorded blasts and fire (Freesound CC0 field recordings) for the explosion and fire sounds: `blastFireSampleBank` and `BLAST_FIRE_SAMPLES` in game-destruction-three play the files under the same ids as the synthesized recipes, which stay as the fallback; the fire's roar is a crossfaded loop of recorded fires. game-audio: a looping sample sound now plays at its own `gain`, and `sfx:convert` drops manifest takes whose file is gone.
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0

## 0.4.0

### Minor Changes

- 15046ce: Body sounds by action and by floor. `game-contracts` names them (`footstep_<surface>_<walk|run>` on 12 surfaces, `land_<surface>_<light|heavy>`, the swing and the hit of each blow, hurt, bite, grab, body fall) with `surfaceOfMaterial` and the `footfall` host event; `game-audio` answers every id with `BODY_FOLEY_BANK` (four takes each) and adds sound sets (`SoundBank.sets`: a take that never repeats, at ±4% of rate, through `retunePlan`) and `SoundRequest.delay`; `game-player` emits the ids (`sound.ids`, the team class stays in `sound.sound`), reads the floor (`world.surfaceAt`, `input.surface`) and steps on the host's footfalls (`input.footfall`); the player body says when a heel is down (`footfall()`); the test room sends the footfalls, plays the jump and the landing on the floor under the feet, the swing just before the contact and the hit with it.
- cbb20a2: The kit's deferred work can share one frame budget. `engine.deferredQueue()` (voices), `renderer.deferredQueue()` (destruction events and slices), `houseRenderer.deferredQueue()` (breach paint) and `createCreaseQueue()` with `VehicleDestructibleOptions.creaseQueue` (vehicle crease, one queue for every vehicle, round robin) give a `DeferredQueue` that `@adatechnology/game-runtime` runs inside its budget. Nothing changes without a budget: the queues keep draining by themselves and `deferredStart`, `eventBudgetMs`, `breachPaintBudgetMs` and `pump()` keep their meaning and defaults. The test room runs on the scheduler, registers the voice and destruction queues, lends `host.defer` and `onFrame(fn, { phase, order })`, and gains `frameBudgetMs` and `frameStats()`.
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

## 0.3.6

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0

## 0.3.5

### Patch Changes

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

## 0.3.4

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0

## 0.3.3

### Patch Changes

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0

## 0.3.2

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0

## 0.3.1

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0

## 0.3.0

### Minor Changes

- df42f4b: The test areas use the pieces of the kit instead of boxes: the weapons counters are the buffet of the furniture catalogue, the shelves and the finds table of the items area are a workbench and a meeting table of the catalogue, the 1.80 m reference is a person the host gives (`person` of `createItemsTestModule`; `personSpecOf` of `game-characters-three` is exported for it), and the probe of the sound bench is what the host gives (`probe` of `createAudioTestModule`, a portable radio of the goods catalogue in the kit's room). Without `person` or `probe` the area draws none.

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

- a41fcb7: The voices and the animal calls on `game-audio` (T6.1g). `game-characters-three` gets the sound bank of the bodies, 16 recipes whose traces equal the team code (the game's `grito` and `voz`, the art scene's `voice` behind groan, scream and leap, plus inhale, grab, bite, hurt, flesh, sever and gore), the table of the voices of the 13 undead types (`UNDEAD_VOICES`) and `createCharacterSound(host.audio)` (voices by moment, `body` events, what the player hears, the screamer's wind-up). `game-animals-three` gets the four calls of the game's `bichoSom` and `createAnimalSound` with the page's cooldowns. Both test areas play on the room's engine (new actions `voice`, `special_call` and `call`). `game-audio` exports the art scene's primitives (`sceneNoise`, `sceneTone`, `sceneVoice`, `sceneRecipe`); `game-destruction-three` uses them instead of its own copy (same recipes).

### Patch Changes

- Updated dependencies [f49e466]
  - @adatechnology/game-contracts@0.13.0

## 0.1.2

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0

## 0.1.1

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0

## 0.1.0

### Minor Changes

- 0f9e616: The WebAudio layer and the bench. `createAudioEngine` (lazy context with unlock, seeded noise buffer and reverb impulse, `play`, `plan`, `loop`, `channel`, mix profiles, buses with `level(bus)` meters, `setMaster`, voice limiter), `createAudioSink` (the `AudioSink` of the contracts, carrying its engine), the `weapon` build order, `to: 'from'` and `{ from }` without a ramp, and the traces of the teams' code reproduced node for node. `createAudioTestModule` is the sound area of the test room (any sound at a distance and bearing, loops, a storm of voices, mix chain and layers, bus levels, the resolved plan), written against the generic contracts only; `BENCH_BANK` holds its two probe sounds.
- 3a8cc95: Initial release (0.1.0): sound as data. Recipes (layers of seeded noise, oscillators, formant voices, serial or parallel filters, LFOs and an envelope, with `sources` for every number) are planned by `planSound` into a `SoundPlan` with every number drawn from a seeded stream in the order the recipe is written. The teams' distance curves (`DISTANCE_CURVES`: the game's 0.004 / 0.006 / 0.01 / 0.002 and its cutoff muffling, the art scene's 0.008, the animals' linear 70 m), the art scene's stereo pan, optional occlusion, a voice limiter (groups with concurrency, cooldown and distance; a global cap of 32 that drops the lowest `priority × gain`), loop state with the game's start threshold and smoothing, mixing profiles and a sound registry with register, patch and remove. `ESM` plus the `GameAudio` global. Shipped data with `sources`: the game's 12 noise classes and fallback (`game-sfx.json`, `noiseClassRecipe`), the two team mixing profiles (`game` and `art_scene`, the kit default), the `undead_voice` group, and a temporary library (motor, rotor, horde, horn, radio static, siren) until their packages exist.

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0
