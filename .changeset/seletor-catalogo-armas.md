---
'@adatechnology/game-weapons': minor
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-test-room': minor
---

The weapon picker. `weaponMenu(arsenal)` lists the whole arsenal by group (firearms, melee weapons, explosives, tools) and category, sorted by name and with each brand weapon's maker; `genericWeapons` and `realLoadout` name the generic guns (the `9 mm service pistol`) and the real weapon that stands for each. The test room opens the picker with the key left of 1 (or its Armas button): a click equips the weapon and adds it to the hotbar, a search finds a weapon by name or maker in every group, and the default hotbar holds the real weapons instead of the generic guns.

The explosives of the weapons gallery are ported (`buildExplosiveModel`: the M67, the molotov, the pipe bomb, the dynamite, the C4, the Claymore and the flashbang), so the throwables are drawn with their own model in the hands, on the counters and in flight (`projectileModel`) instead of the box of the generic prop. The M79 gets the gallery's model with a break action that folds down to load one grenade, a grenade launcher no longer fires a rocket's backblast, the claw hammer takes the item model of the hammer, and the pt-BR names of the weapons that showed in English are translated.
