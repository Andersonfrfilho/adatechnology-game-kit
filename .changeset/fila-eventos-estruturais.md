---
'@adatechnology/game-destruction-three': patch
---

The renderer never drops an event that changes what is drawn. A blast floods the event queue with damage, melt and drip events; past its cap the queue now keeps taking breaks, collapses, detaches, fires and leaks, and drops only the cosmetic ones, so a wall the solver brought down is never left drawn standing.
