# @adatechnology/game-characters-people

## 0.3.0

### Minor Changes

- 6546677: The player's attack pose clips as data: `ATTACK_CLIPS` (`punch_right`, `shove_two_hands`, `front_kick`, `recoil_rifle`, `recoil_pistol`, in the `PoseClip` format of `game-characters`, one `impact` each) and `ATTACK_CLIP_LOCALES` (the phase texts in pt-BR and en). Authored in the kit; replace with the Elenco team's clips when delivered.
- 95691ff: `FIRST_PERSON_CLIPS`: the first-person counterpart of the strikes of `ATTACK_CLIPS` (`punch_right`, `shove_two_hands`, `front_kick`), with the same duration and the same `impact` second as the third-person clip, so both views hit at the same moment. Authored in the kit; replace with the Elenco team's clips when delivered.

### Patch Changes

- Updated dependencies [1331018]
- Updated dependencies [95691ff]
- Updated dependencies [15c5da6]
- Updated dependencies [4ecaa9f]
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
  - @adatechnology/game-characters@0.1.6

## 0.1.5

### Patch Changes

- @adatechnology/game-characters@0.1.5

## 0.1.4

### Patch Changes

- @adatechnology/game-characters@0.1.4

## 0.1.3

### Patch Changes

- @adatechnology/game-characters@0.1.3

## 0.1.2

### Patch Changes

- @adatechnology/game-characters@0.1.2

## 0.1.1

### Patch Changes

- @adatechnology/game-characters@0.1.1

## 0.1.0

### Minor Changes

- 66d8587: Novo pacote `@adatechnology/game-characters-people` (fase 4): 12 profissões genéricas como presets do `game-characters`, 4 faixas de idade, pools de aparência e os ids dos acessórios, com nomes `en` e `pt-BR`.

### Patch Changes

- Updated dependencies [d8177f4]
- Updated dependencies [038d6f1]
- Updated dependencies [5e64ab9]
  - @adatechnology/game-characters@0.1.0
