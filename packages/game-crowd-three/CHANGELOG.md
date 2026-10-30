# @adatechnology/game-crowd-three

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
