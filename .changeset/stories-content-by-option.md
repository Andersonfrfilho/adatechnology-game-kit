---
'@adatechnology/game-stories': minor
'@adatechnology/game-kit-defaults': minor
---

`game-stories` has new optional options (spec 005, D1 and D7): `names` and `ruleset` on `createStoryWorld`, `simulateStories`, `createSheet`, `drawSheet` and `createStoriesTestModule`, and `professionName` on `createStoriesTestModule`. Without them nothing changes: the name pools come from `getNamePools(locale)`, the ruleset from `SHEET_RULESET` and the profession names from `getProfession`, all of `game-characters-people`. The default is deprecated and will be removed in the next major. The schema types (`NamePools`, `SheetRuleset` and friends) are exported by `game-stories`. Recommended path: spread `defaultStoryContent(locale)` of `@adatechnology/game-kit-defaults`.
