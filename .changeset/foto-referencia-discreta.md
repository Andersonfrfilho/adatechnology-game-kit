---
'@adatechnology/game-contracts': minor
'@adatechnology/game-test-room': minor
'@adatechnology/game-weapons-three': minor
---

The photo of the real weapon is now a small thumbnail in the bottom-left corner of the weapons room, opening large (with author, licence and the Wikimedia link) on a click, instead of a big card on the bench panel. `ModuleHost.cornerImage` (contracts) and the room's corner image with lightbox (test-room) are generic; the weapons module shows the photo only with the new `referencePhotos` option (default off, so the general test room shows none). The showcase no longer sends a bench sheet.
