---
'@adatechnology/game-destruction': patch
---

A call that sets off many parts at once (a blast that fails more than 64 charges) now resolves every blast it queued before returning, instead of leaving the rest for the next call and shifting their effects in time. The loop ends because a part goes off once and is primed once.
