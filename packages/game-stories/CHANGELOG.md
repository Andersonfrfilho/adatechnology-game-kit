# @adatechnology/game-stories

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
