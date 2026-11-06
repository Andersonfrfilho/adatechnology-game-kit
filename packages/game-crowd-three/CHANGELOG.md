# @adatechnology/game-crowd-three

## 0.5.5

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [63adb4c]
- Updated dependencies [78e76b0]
- Updated dependencies [33c09f1]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-audio@0.8.0
  - @adatechnology/game-characters-three@0.9.5
  - @adatechnology/game-characters@0.2.11
  - @adatechnology/game-crowd@0.4.2
  - @adatechnology/game-player@0.5.3

## 0.5.4

### Patch Changes

- Updated dependencies [2aae2ac]
  - @adatechnology/game-audio@0.7.0
  - @adatechnology/game-characters-three@0.9.4

## 0.5.3

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-characters-three@0.9.2
  - @adatechnology/game-audio@0.6.1
  - @adatechnology/game-characters@0.2.10
  - @adatechnology/game-crowd@0.4.1
  - @adatechnology/game-player@0.5.2

## 0.5.2

### Patch Changes

- Updated dependencies [6b44b4e]
  - @adatechnology/game-audio@0.6.0
  - @adatechnology/game-characters-three@0.9.1

## 0.5.1

### Patch Changes

- Updated dependencies
  - @adatechnology/game-characters-three@0.9.0

## 0.5.0

### Minor Changes

- a27d5ae: A blast's shove is blocked by cover and reaches the player. `DestructionWorld.blastReach(point, target)` gives the share of a blast that gets through what stands between, vehicles included as shells crossed through both walls (always on, whatever `BlastOptions.shelter` says); the renderer cuts the push of pieces and loose furniture by it, the host lends it to the modules (`ModuleHost.blastReach`), and the people of the characters module and the horde (`CrowdBlast.reach`, shove and damage, no lethal core behind solid cover) use it. The knock of a body (`knockOf`, `stepKnock`, `bodyMass`) moved to game-contracts, and the test room's player is shoved by it: thrown, off its feet when the push passes 2.5 m/s, lies a while and gets up (the view drops to the floor and rolls, the body takes its down pose; `TestRoom.playerKnock`, `TestRoomOptions.playerMass`). A body or a piece thrown into something firm stops there instead of passing through: the room's player slams into the wall (`PlayerOptions.onSlam`; the wall takes a blunt blow of `½ m v²`, body thud and hurt cry), and the pieces of the renderer sweep their way through the world (`PieceSystemOptions.sweep`/`onSlam`): a crate thrown at a wall stops, bounces a little, and both take the blow.

### Patch Changes

- Updated dependencies [4dce01e]
- Updated dependencies [fb6d690]
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [784a6b0]
- Updated dependencies [5d614c6]
- Updated dependencies [29782fc]
- Updated dependencies [5ff4a45]
- Updated dependencies [106c0f5]
- Updated dependencies [9a151ad]
- Updated dependencies [4145cc9]
  - @adatechnology/game-audio@0.5.0
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-crowd@0.4.0
  - @adatechnology/game-characters-three@0.8.1
  - @adatechnology/game-shapes-three@0.3.1
  - @adatechnology/game-player@0.5.1
  - @adatechnology/game-characters@0.2.9

## 0.4.0

### Minor Changes

- a407665: The crowd area steps the crowd in the host's `fixedSimulate` phase when the physics is on (one fixed step per call, the same at any frame rate), keeps the frame step when it is off, and answers the host's `explosion` events with `crowd.blast`. The bench gains `scene` (`dense_wall`: a horde pressed against a wall and a door; `chain_line`: a horde coming down a street at a row of gas cylinders and a car; more by the `scenes` option, drawn with the `props` option) and `physics` controls, applied after the seed and before the count whatever the order of the bench state, and publishes `falls_pressure`, `falls_chain`, `falls_landing`, `climbers`, `mound_max`, `thrown_peak`, `max_overlap`, `chain_links` and `crowd_ms_p99`. `CrowdRenderer.prepare()` bakes every type and makes every batch the frame would make on demand (bodies on the ground, blobs, impostors, accessories) so a host's warm-up links their programs before play; the `eager` option calls it once the bench state is applied.
- 41b9dd4: The horde draw cost (spec 005, D12). `createCrowdRenderer({ variety })` gets a level `budget` (bodies per mesh level, bodies on the ground included; a crowd packed near the camera pulls the level edges in, the nearest bodies draw first), an `adapt` loop that sizes it from the crowd's GPU time (`EXT_disjoint_timer_query_webgl2`, the frame time where there is none), `nearDepthPrepass` (the near level draws its depth first so the room's lights shade a pixel once) and `detailScale`/`gpuMs` read-outs. `createBodyBatch` and `createVariantBatches` take `depthPrepass` and return `batch.prepass`; add it to the scene next to `batch.mesh`. `game-render-three` gets `createFramePacer`, which holds the draw back while the GPU is a frame behind.
- dc95951: The impostor tier of the economy ladder (with `variety`, `impostor: false` turns it off): `bakeImpostorAtlas` draws each silhouette (one per crowd type, from the far mesh of its first variant) on the CPU at 8 views and 8 steps of the walk into an RGBA8 atlas of bone, material class, shade and coverage (plus a colour layer), both `NearestFilter`; `createImpostorBatch` draws every far body in one call, picking its cell by the view angle and the walk phase, tinted per instance (shirt, trousers palette, missing limbs hide their bones). `createBlobShadowBatch` is the blob shadow under bodies beyond the nearest level. The renderer sends the bodies that walk past 90 m to the impostor batch and keeps the others on the far mesh. The identity extension recolours the legs above the shoes with the trousers palette, as the atlas does.
- 5aba035: Segment clips in a texture (step 3 of the ladder, option `variety.segmentClips`, default off): `bakeSegmentClips` samples 14 clips at 30 Hz (a walk, a limp on each side, a drag, a lurch, a shamble and a stagger, each with the arms down and raised) from the maths of the shader's walk into 12 bones of 24 texels, `createSegmentClipUniforms` makes the RGBA32F `NearestFilter` texture, and a body material built with `segmentClips` walks the bodies flagged `clips` in `iD` from it: the clips of the agent's gait family blended by how far it has raised its arms, the amplitude scaled by its gait, the phase and the cadence its own. Shadow and distance materials read the same texture. The other poses stay on the shader's procedural pose.
- 04128b6: Variety on the instanced renderer (option `variety`, default off, the game's renderer is unchanged without it): every body gets an identity from its crowd identity and state (`lookOfAgent`: trousers, wound splashes that grow with the infection age, accessories, gait style, the stagger pose, the lean of a shove), the kit's accessories (cap, helmet, backpack, hood) are drawn in eight fixed batches placed per variant, real shadows are cast only by the nearest level and a blob shadow batch covers the rest. `createCrowdTestModule` takes `variety` and `crowdPhysics`; `appearanceSignature` is the look of an instance as one number.
- b97f318: Graphics settings for the player. New `@adatechnology/game-graphics` (presets Automático, Baixa, Média, Alta, Ultra; resolution scale, horde detail, shadows, view distance, FPS cap and counter; the automatic mode that moves only what is left on `auto` by the frame time; a 3 s calibration on the first load, kept per GPU; the choice in `localStorage`; the settings screen at `/screen`) and `@adatechnology/game-graphics-three` (pixel ratio, sun shadow and far plane on three.js, GPU name, whole-frame GPU timer). `startLoop` takes `minFrameMs` (a frame cap). `ModuleHost.graphics` (`HostGraphics`) lends the horde detail to modules; the crowd test module fixes its level budgets at that share or keeps `budget.adapt` under auto, and reports its `detailScale`. The test room takes `graphics: true | RoomGraphicsOptions`: a Gráficos button in place of the quality select, the calibration on its loading indicator, `room.graphics` and `room.graphicsScreen`.
- 455522d: New `./testing` subpath on each package that ships a test area or bench (spec 005, D6): `import { createXTestModule } from '@adatechnology/game-<pkg>/testing'`. The test areas, benches and their texts moved behind it so the runtime entry does not carry them. Nothing is removed: every export that used to be on the package root is still there, `@deprecated`, and will be removed in the next major. The ESM build splits chunks (`splitting: true`), so the root and `./testing` share one copy of the module-level registries.

### Patch Changes

- 6247fbe: The room shows its memory and warns on screen when it leaks. The counters line adds geometries, textures and the JS heap (`geometries`, `textures`, `heap_mb` in `metrics()`). After each clear the room compares the GPU counts with the earlier clears of the same area: when they grew on each of the last four clears past the budget (40 geometries or 4 textures), a red banner stays under the tool, the log gets a `memory_leak` event and the counters line marks it, until a clear finds the memory back down. New `createMemoryWatch` and `RoomUi.alert`.

  The terrain area frees its strip labels (plane, material and canvas texture) when it closes, and a new lint rule (`kit/no-bare-remove`) fails a `removeFromParent()` in a function that frees nothing.
  The horde bench frees the walls of its scenes when a scene closes.

- Updated dependencies [ce94d04]
- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [455522d]
- Updated dependencies [7b77aa7]
- Updated dependencies [f613255]
- Updated dependencies [81af508]
- Updated dependencies [41b9dd4]
- Updated dependencies [33f4fd8]
- Updated dependencies [dc95951]
- Updated dependencies [302a2dc]
- Updated dependencies [5aba035]
- Updated dependencies [cbb20a2]
- Updated dependencies [d97cf9f]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
- Updated dependencies [455522d]
  - @adatechnology/game-characters-three@0.8.0
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-audio@0.4.0
  - @adatechnology/game-player@0.5.0
  - @adatechnology/game-shapes-three@0.3.0
  - @adatechnology/game-characters@0.2.8
  - @adatechnology/game-crowd@0.3.0

## 0.3.9

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-characters-three@0.7.2
  - @adatechnology/game-audio@0.3.6
  - @adatechnology/game-characters@0.2.7
  - @adatechnology/game-player@0.4.1

## 0.3.8

### Patch Changes

- Updated dependencies [9c4ec9f]
- Updated dependencies [28280ef]
- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7f7dd06]
- Updated dependencies [7dc60fa]
- Updated dependencies [61bdbe1]
- Updated dependencies [fe1f40a]
- Updated dependencies [aa75500]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [53babb5]
- Updated dependencies [711af5d]
- Updated dependencies [a2ce4c5]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-characters-three@0.7.0
  - @adatechnology/game-contracts@0.20.0
  - @adatechnology/game-player@0.4.0
  - @adatechnology/game-audio@0.3.5
  - @adatechnology/game-characters@0.2.6

## 0.3.7

### Patch Changes

- Updated dependencies [f44dbbc]
  - @adatechnology/game-characters-three@0.6.0

## 0.3.6

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-audio@0.3.4
  - @adatechnology/game-characters@0.2.5
  - @adatechnology/game-characters-three@0.5.1
  - @adatechnology/game-crowd@0.2.6
  - @adatechnology/game-player@0.3.1

## 0.3.5

### Patch Changes

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- Updated dependencies [2c9c963]
- Updated dependencies [ae81390]
- Updated dependencies [2961d53]
- Updated dependencies [e5ac121]
- Updated dependencies [a2b0bb3]
- Updated dependencies [8aa480b]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-characters-three@0.5.0
  - @adatechnology/game-audio@0.3.3
  - @adatechnology/game-player@0.3.0
  - @adatechnology/game-characters@0.2.4
  - @adatechnology/game-crowd@0.2.5

## 0.3.4

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [454e821]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-characters-three@0.4.2
  - @adatechnology/game-audio@0.3.2
  - @adatechnology/game-characters@0.2.3
  - @adatechnology/game-crowd@0.2.4
  - @adatechnology/game-player@0.2.4

## 0.3.3

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-characters-three@0.4.1
  - @adatechnology/game-audio@0.3.1
  - @adatechnology/game-characters@0.2.2
  - @adatechnology/game-crowd@0.2.3
  - @adatechnology/game-player@0.2.3

## 0.3.2

### Patch Changes

- df42f4b: Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.
- Updated dependencies [df42f4b]
- Updated dependencies [df42f4b]
  - @adatechnology/game-audio@0.3.0
  - @adatechnology/game-characters-three@0.4.0
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-characters@0.2.1
  - @adatechnology/game-crowd@0.2.2
  - @adatechnology/game-player@0.2.2

## 0.3.1

### Patch Changes

- Updated dependencies [692c098]
  - @adatechnology/game-characters-three@0.3.1
  - @adatechnology/game-characters@0.2.0

## 0.3.0

### Minor Changes

- 945d00d: A loading indicator for any slow job of the test room: `room.loading` / `room.busy(label, work)` / `room.openAreaAsync(area)` (spinner or bar, text in the room's locale, nothing drawn with `ui: false`), the generic `BusySink` contract and `ModuleHost.loading`, `ModuleControl.slow` and `TestableItem.slow` so the room's panel and catalogue run a slow press or spawn behind it, and `LOADING_CSS` / `loadingMarkup` for a page's first frame. The house bench rebuilds, the nursery lot, the walker, the crowd, the skins and the vehicles use it.

### Patch Changes

- Updated dependencies [6546677]
- Updated dependencies [4e90488]
- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [574f847]
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
- Updated dependencies [a185888]
- Updated dependencies [024d0e8]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [fcd0be6]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-characters-three@0.3.0
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-characters@0.2.0
  - @adatechnology/game-audio@0.2.1
  - @adatechnology/game-crowd@0.2.1
  - @adatechnology/game-player@0.2.1

## 0.2.0

### Minor Changes

- 79316a5: New package (spec 001, T8.1c): the three.js drawing of a `game-crowd` crowd, a literal port of the team game's `hordeRender` and `npcRender`.
  `createCrowdInstances` (view culling, LOD 18/55 m with 1.5 m of hysteresis, the attack pose in at 1.6 m and out at 2.2 m, the pose by state, the
  bloater's swelling, bodies on the ground that darken and shrink, civilians), `createCrowdRenderer` on the baked variants of `game-characters-three`
  (a type is baked the first time it is drawn), `createHerdView` for the herd on the animals' own rigs, `CROWD_SOUND_BANK` (the scream, the groans and
  the animal calls) and `createCrowdTestModule` (`crowd_area`). The golden `game-crowd-render.json` replays the game's drawing instance by instance.

### Patch Changes

- Updated dependencies [b6e8131]
- Updated dependencies [ac9fc82]
- Updated dependencies [e6452f5]
  - @adatechnology/game-crowd@0.2.0
  - @adatechnology/game-characters@0.1.6
  - @adatechnology/game-player@0.2.0
  - @adatechnology/game-characters-three@0.2.1
