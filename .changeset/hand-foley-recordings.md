---
'@adatechnology/game-audio': patch
'@adatechnology/game-test-room': patch
---

The hand foley of the test room plays the recorded takes: `KIT_SAMPLE_ALIASES` points `door_wood_close` and `door_wood_slam` at the wooden door shut and slam files and the item pickups (metal, plastic, glass, wood, fabric) at the pickup files, and the room preloads those ids (`HAND_RECORDED_IDS`) on the first key or click. Taking an item now plays one sound, the item's class: the second `grab_*` sound that played with it at the same moment is gone.
