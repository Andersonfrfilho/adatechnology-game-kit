---
'@adatechnology/game-stories': minor
'@adatechnology/game-characters-people': minor
---

New package `game-stories` (spec 001, T8.2): stories as data, a literal port of Os Vivos do Vale (`life()`, `simulate()` and the event engine) and of the
Personagens sheet. Stories of beats with roles, conditions, text pieces and changes; the casting (a pinned person, someone who fits, or a person made from
the name pools); the chronicle; the character sheet (point buy, derived values, skills and milestones, memory and opinion); the life simulation between
the stories, with the infection layer off by default. Every number has its source; the golden `game-stories-life.json` (7 full lives, 40 by hash, 96 sets
of player actions and 48 sheets of the team code) is replayed. `createStoriesTestModule` is the `stories_area` bench; global `GameStories`.
`game-characters-people` gives the Personagens ruleset as data (`SHEET_RULESET`: attributes, skills, professions, traits, derived formulas) and the
name pools (`NAME_POOLS`, `getNamePools`).
