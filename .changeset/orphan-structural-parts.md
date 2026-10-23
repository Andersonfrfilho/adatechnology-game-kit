---
'@adatechnology/game-destruction': patch
---

A structural part that never had a support path (the spec leaves it floating, for example an upper floor resting on a wall that is only a `partition`) is no longer reported as collapsed by the first unrelated loss. It used to sit in its own unanchored group from the start and fall as soon as any column broke (a houses frame lost 64, 22 and 3 parts to a single pillar this way). Such parts are now held by their joints like non-structural ones and still fall with whatever they hang on.
