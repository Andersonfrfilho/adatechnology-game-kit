---
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-weapons': minor
'@adatechnology/game-test-room': minor
'@adatechnology/game-vfx': minor
---

First lot, part C: the M32 multiple grenade launcher (Milkor MGL), the M18 smoke grenade, the Semtex charge, the KA-BAR, the katana and brass knuckles.

- game-weapons: the `m32_mgl` launcher (six 40x46 mm grenades, 778 mm with the stock out and 565 mm folded, 5.3 kg, 75 m/s; launcher family `revolver`); the `smoke_grenade` explosive (`kind: 'smoke'`, no blast, fuse 1.0 to 2.3 s, coloured smoke for 50 to 90 s, new `ExplosiveDef.smoke` carried by the `Detonation`); the `semtex` explosive (500 g, 0.83 kg TNT, remote or about 30 s fuse); the melee weapons `kabar`, `katana` (two-hand) and `brass_knuckles` (harder punch over a smaller contact area than `fists`). Generated data comes from `tools/weapons-catalog` (`multiLaunchers`, `radii`).
- game-weapons-three: a model of its own for each (`mgl` builder with the swing-out cylinder, front grip, collimator sight and folding stock; new `cylinder` model family that reloads and cycles like a revolver and is held as a long gun, with the support hand on `parts.foreGrip`; `buildHandheldModel` for the melee weapons, with a `support` mark for the second hand; the M18 and Semtex builders next to the other explosives).
- game-test-room: a burning smoke canister lets out puffs of its colour through the effects world until its filling is spent and tells the host of no explosion; brass knuckles punch with the fists clip and the one-hand punch rule.
- game-vfx: `semtex` blasts like the C4 (alias).
