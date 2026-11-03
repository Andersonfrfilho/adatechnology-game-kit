---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-crowd': minor
'@adatechnology/game-crowd-three': minor
'@adatechnology/game-characters-three': patch
'@adatechnology/game-test-room': minor
---

A blast's shove is blocked by cover and reaches the player. `DestructionWorld.blastReach(point, target)` gives the share of a blast that gets through what stands between, vehicles included as shells crossed through both walls (always on, whatever `BlastOptions.shelter` says); the renderer cuts the push of pieces and loose furniture by it, the host lends it to the modules (`ModuleHost.blastReach`), and the people of the characters module and the horde (`CrowdBlast.reach`, shove and damage, no lethal core behind solid cover) use it. The knock of a body (`knockOf`, `stepKnock`, `bodyMass`) moved to game-contracts, and the test room's player is shoved by it: thrown, off its feet when the push passes 2.5 m/s, lies a while and gets up (the view drops to the floor and rolls, the body takes its down pose; `TestRoom.playerKnock`, `TestRoomOptions.playerMass`). A body or a piece thrown into something firm stops there instead of passing through: the room's player slams into the wall (`PlayerOptions.onSlam`; the wall takes a blunt blow of `½ m v²`, body thud and hurt cry), and the pieces of the renderer sweep their way through the world (`PieceSystemOptions.sweep`/`onSlam`): a crate thrown at a wall stops, bounces a little, and both take the blow.
