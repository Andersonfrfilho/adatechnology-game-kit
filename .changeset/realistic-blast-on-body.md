---
'@adatechnology/game-contracts': minor
'@adatechnology/game-weapons': minor
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-test-room': minor
'@adatechnology/game-characters-three': patch
---

A blast pushes a body by its blast wave, not by a game coupling. `blast-impulse` reads the impulse of the wave (Kinney and Graham's side-on impulse, reflected on the body) from the charge in kg of TNT and the distance. `knockOf` takes the body's area and mass, so a hand grenade at 3 m moves a person a few tenths of a metre per second and a big charge close throws them. A body inside the lethal radius that the blast reaches falls where it stands, wounded, and lies longer. Cover that stops half the blast stops the fragments too. A body in reach is stunned, and the player's view sways while stunned.

Each explosive of the arsenal gives its charge (`ExplosiveDef.tnt`: M67 0.24 kg, C4 0.76 kg, P13 1.5 kg, and so on). The charge travels on the detonation, the `explodes` spec, the destruction `explode` event and the host `explosion` event (`tnt`, `lethalRadius`). A blast without a charge takes one from its energy at the arsenal's scale. The horde keeps its own shove.
