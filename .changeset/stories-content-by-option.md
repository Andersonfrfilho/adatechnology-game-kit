---
'@adatechnology/game-stories': minor
'@adatechnology/game-kit-defaults': minor
---

`game-stories` no longer imports `game-characters-people` (spec 005, D1 and D7): `createStoryWorld` and `simulateStories` take `names` and `ruleset`, `createSheet` and `drawSheet` take `ruleset`, and `createStoriesTestModule` takes `names`, `ruleset` and `professionName?`, all by option. The schema types (`NamePools`, `SheetRuleset` and friends) are exported by `game-stories`. Migration: pass `getNamePools(locale)` and `SHEET_RULESET` of `game-characters-people`, or spread `defaultStoryContent(locale)` of `@adatechnology/game-kit-defaults`.
