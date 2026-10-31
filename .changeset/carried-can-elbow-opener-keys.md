---
'@adatechnology/game-contracts': minor
'@adatechnology/game-characters-three': minor
'@adatechnology/game-test-room': patch
'@adatechnology/game-items-three': patch
---

An item carried in first person no longer lifts the elbow above the shoulder: `HandTargets.elbows` (`view`, the default, or `body`) says where the elbows go, and the first-person arms keep the elbow in the view only for `view`; the room's carried items ask for `body`, so a tin in the hand has its forearm coming from below (elbow bend 103° instead of 57°). While C crouches, an item's second use (empty a tin) is on Shift+F instead of C, and the HUD says so. The items area lays an opening tool beside each sealed tin (a can opener next to the beans), within reach when the tin is picked up.
