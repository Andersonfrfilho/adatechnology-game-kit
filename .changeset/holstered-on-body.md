---
'@adatechnology/game-contracts': minor
'@adatechnology/game-characters-three': minor
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-test-room': minor
---

A weapon put away is drawn on the body: `HostEvent` `holster` and `ModuleHost.bodySlot` (game-contracts), `PlayerAvatar.slot('hip' | 'back')` (game-characters-three), `createHolsteredWeapons`/`holsteredModel` (game-weapons-three: pistol on the hip, long gun across the back); the test room sends the events and lends the slots.
