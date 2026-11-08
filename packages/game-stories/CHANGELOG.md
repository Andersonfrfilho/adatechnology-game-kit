# @adatechnology/game-stories

## 0.3.12

### Patch Changes

- Updated dependencies [779f9f4]
  - @adatechnology/game-contracts@0.34.0
  - @adatechnology/game-characters@0.2.20

## 0.3.11

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0
  - @adatechnology/game-characters@0.2.19

## 0.3.10

### Patch Changes

- Updated dependencies [4e2d44b]
  - @adatechnology/game-contracts@0.32.0
  - @adatechnology/game-characters@0.2.18

## 0.3.9

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0
  - @adatechnology/game-characters@0.2.17

## 0.3.8

### Patch Changes

- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0
  - @adatechnology/game-characters@0.2.16

## 0.3.7

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0
  - @adatechnology/game-characters@0.2.15

## 0.3.6

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-characters@0.2.14

## 0.3.5

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-characters@0.2.13

## 0.3.4

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0
  - @adatechnology/game-characters@0.2.12

## 0.3.3

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-characters@0.2.11

## 0.3.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-characters@0.2.10

## 0.3.1

### Patch Changes

- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-characters@0.2.9

## 0.3.0

### Minor Changes

- ba6dd38: `game-stories` has new optional options (spec 005, D1 and D7): `names` and `ruleset` on `createStoryWorld`, `simulateStories`, `createSheet`, `drawSheet` and `createStoriesTestModule`, and `professionName` on `createStoriesTestModule`. Without them nothing changes: the name pools come from `getNamePools(locale)`, the ruleset from `SHEET_RULESET` and the profession names from `getProfession`, all of `game-characters-people`. The default is deprecated and will be removed in the next major. The schema types (`NamePools`, `SheetRuleset` and friends) are exported by `game-stories`. Recommended path: spread `defaultStoryContent(locale)` of `@adatechnology/game-kit-defaults`.
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
  - @adatechnology/game-characters@0.2.8

## 0.2.8

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-characters@0.2.7

## 0.2.7

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
  - @adatechnology/game-characters@0.2.6

## 0.2.6

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-characters@0.2.5
  - @adatechnology/game-characters-people@0.4.1

## 0.2.5

### Patch Changes

- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [a2b0bb3]
- Updated dependencies [8aa480b]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-characters-people@0.4.0
  - @adatechnology/game-characters@0.2.4

## 0.2.4

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [454e821]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-characters-people@0.3.3
  - @adatechnology/game-characters@0.2.3

## 0.2.3

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-characters@0.2.2
  - @adatechnology/game-characters-people@0.3.2

## 0.2.2

### Patch Changes

- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-characters@0.2.1
  - @adatechnology/game-characters-people@0.3.1

## 0.2.1

### Patch Changes

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
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-characters-people@0.3.0
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-characters@0.2.0

## 0.2.0

### Minor Changes

- e2f0f02: New package `game-stories` (spec 001, T8.2): stories as data, a literal port of Os Vivos do Vale (`life()`, `simulate()` and the event engine) and of the
  Personagens sheet. Stories of beats with roles, conditions, text pieces and changes; the casting (a pinned person, someone who fits, or a person made from
  the name pools); the chronicle; the character sheet (point buy, derived values, skills and milestones, memory and opinion); the life simulation between
  the stories, with the infection layer off by default. Every number has its source; the golden `game-stories-life.json` (7 full lives, 40 by hash, 96 sets
  of player actions and 48 sheets of the team code) is replayed. `createStoriesTestModule` is the `stories_area` bench; global `GameStories`.
  `game-characters-people` gives the Personagens ruleset as data (`SHEET_RULESET`: attributes, skills, professions, traits, derived formulas) and the
  name pools (`NAME_POOLS`, `getNamePools`).

### Patch Changes

- Updated dependencies [b6e8131]
- Updated dependencies [e2f0f02]
  - @adatechnology/game-characters@0.1.6
  - @adatechnology/game-characters-people@0.2.0
