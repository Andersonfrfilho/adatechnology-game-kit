---
'@adatechnology/game-shapes-three': minor
'@adatechnology/game-test-room': patch
'@adatechnology/game-weapons-three': patch
'@adatechnology/game-characters-three': patch
'@adatechnology/game-vehicles': patch
---

Memory leaks fixed: what leaves the scene frees its GPU side. New `releaseObject3D` and `discardObject3D` (game-shapes-three) free the geometries, materials, textures and skeletons of a removed tree, keeping what the scene still draws. The test room uses them when it clears or removes things (items, loose pieces, projectiles and charges), the explosives bench frees its blast rings (two canvas labels each) and launched shells, the flying pieces of cut bodies and the ejected rounds free their own geometry, a shattered car pane frees its crack texture, and the characters area stops tracking the wounds of bodies that left the room (each one kept its whole rig in memory).
