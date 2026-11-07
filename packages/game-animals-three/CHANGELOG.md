# @adatechnology/game-animals-three

## 0.4.15

### Patch Changes

- Updated dependencies [304dcc8]
  - @adatechnology/game-audio@0.13.0

## 0.4.14

### Patch Changes

- Updated dependencies [4e8b8b8]
  - @adatechnology/game-audio@0.12.0

## 0.4.13

### Patch Changes

- Updated dependencies [89f1d9d]
  - @adatechnology/game-audio@0.11.0

## 0.4.12

### Patch Changes

- Updated dependencies [baaa7d4]
  - @adatechnology/game-audio@0.10.0

## 0.4.11

### Patch Changes

- Updated dependencies [c4b8218]
- Updated dependencies [5ce9f7b]
  - @adatechnology/game-contracts@0.30.0
  - @adatechnology/game-audio@0.9.4

## 0.4.10

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0
  - @adatechnology/game-audio@0.9.3

## 0.4.9

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-audio@0.9.2

## 0.4.8

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-audio@0.9.1

## 0.4.7

### Patch Changes

- Updated dependencies [9a44330]
- Updated dependencies [c8b0e40]
  - @adatechnology/game-audio@0.9.0
  - @adatechnology/game-contracts@0.26.0

## 0.4.6

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [63adb4c]
- Updated dependencies [78e76b0]
- Updated dependencies [33c09f1]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-audio@0.8.0

## 0.4.5

### Patch Changes

- Updated dependencies [2aae2ac]
  - @adatechnology/game-audio@0.7.0

## 0.4.4

### Patch Changes

- Updated dependencies [157b90d]
  - @adatechnology/game-render-three@0.2.0

## 0.4.3

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-audio@0.6.1

## 0.4.2

### Patch Changes

- Updated dependencies [6b44b4e]
  - @adatechnology/game-audio@0.6.0

## 0.4.1

### Patch Changes

- Updated dependencies [4dce01e]
- Updated dependencies [fb6d690]
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [784a6b0]
- Updated dependencies [5d614c6]
- Updated dependencies [29782fc]
- Updated dependencies [106c0f5]
- Updated dependencies [9a151ad]
- Updated dependencies [4145cc9]
  - @adatechnology/game-audio@0.5.0
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-shapes-three@0.3.1

## 0.4.0

### Minor Changes

- 455522d: New `./testing` subpath on each package that ships a test area or bench (spec 005, D6): `import { createXTestModule } from '@adatechnology/game-<pkg>/testing'`. The test areas, benches and their texts moved behind it so the runtime entry does not carry them. Nothing is removed: every export that used to be on the package root is still there, `@deprecated`, and will be removed in the next major. The ESM build splits chunks (`splitting: true`), so the root and `./testing` share one copy of the module-level registries.

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [455522d]
- Updated dependencies [7b77aa7]
- Updated dependencies [41b9dd4]
- Updated dependencies [cbb20a2]
- Updated dependencies [d97cf9f]
- Updated dependencies [05fbba9]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
- Updated dependencies [455522d]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-audio@0.4.0
  - @adatechnology/game-shapes-three@0.3.0
  - @adatechnology/game-render-three@0.1.0
  - @adatechnology/game-props3d@0.3.3

## 0.3.8

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-audio@0.3.6

## 0.3.7

### Patch Changes

- 94f98a3: Memory leaks fixed: what leaves the scene frees its GPU side. New `releaseObject3D` and `discardObject3D` (game-shapes-three) free the geometries, materials, textures and skeletons of a removed tree, keeping what the scene still draws. The test room uses them when it clears or removes things (items, loose pieces, projectiles and charges), the explosives bench frees its blast rings (two canvas labels each) and launched shells, the flying pieces of cut bodies and the ejected rounds free their own geometry, a shattered car pane frees its crack texture, and the characters area stops tracking the wounds of bodies that left the room (each one kept its whole rig in memory). The test areas of cars, plants, the city, animals and items free their helper layers and forget the items that left the scene, and the house scenarios stop listening to the world when they end (each run left a listener collecting every later event). New `markShared` marks resources shared without touching them, and the weapon model kit marks its materials and cached boxes with it, so a weapon put away does not free them for the next one.
- Updated dependencies [94f98a3]
  - @adatechnology/game-shapes-three@0.2.0
  - @adatechnology/game-props3d@0.3.2

## 0.3.6

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
  - @adatechnology/game-audio@0.3.5

## 0.3.5

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-audio@0.3.4

## 0.3.4

### Patch Changes

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-audio@0.3.3

## 0.3.3

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-audio@0.3.2

## 0.3.2

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-audio@0.3.1

## 0.3.1

### Patch Changes

- df42f4b: Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.
- Updated dependencies [df42f4b]
- Updated dependencies [df42f4b]
  - @adatechnology/game-audio@0.3.0
  - @adatechnology/game-contracts@0.15.0

## 0.3.0

### Minor Changes

- 945d00d: A loading indicator for any slow job of the test room: `room.loading` / `room.busy(label, work)` / `room.openAreaAsync(area)` (spinner or bar, text in the room's locale, nothing drawn with `ui: false`), the generic `BusySink` contract and `ModuleHost.loading`, `ModuleControl.slow` and `TestableItem.slow` so the room's panel and catalogue run a slow press or spawn behind it, and `LOADING_CSS` / `loadingMarkup` for a page's first frame. The house bench rebuilds, the nursery lot, the walker, the crowd, the skins and the vehicles use it.

### Patch Changes

- fcd0be6: The weapon models, the animals and the characters draw their geometry with game-shapes (`shapeGeometries(host)`), with the same bytes as before (exact goldens of 367, 27 and 281 cases). game-weapons-three no longer depends on game-props3d. The IIFE builds of game-props3d, game-interactables-three and game-weapons-three bundle game-shapes. `shapeGeometries` of a namespace it made gives it back.
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
- Updated dependencies [fcd0be6]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-props3d@0.3.1
  - @adatechnology/game-shapes-three@0.1.1
  - @adatechnology/game-audio@0.2.1

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
