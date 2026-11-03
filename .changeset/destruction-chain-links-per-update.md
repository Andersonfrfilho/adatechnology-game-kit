---
'@adatechnology/game-destruction': minor
---

`DestructionOptions.chainLinksPerUpdate` (spec 005, T4b.4): at most that many primed explosives go off per `update`; the rest wait in the order of due time, older object and part order. Off by default, which keeps today's behaviour. The delay of each link is still the `chain` data of the explosive.
