---
'@adatechnology/game-weapons-three': minor
---

Weapon models redrawn from the photo of the real weapon. The Desert Eagle Mark XIX gets a model of its own (`pistol-deagle.ts`) instead of the generic pistol: a flat-topped slide over the rear half, the fixed barrel ahead of it with its triangular section and the rail on top, the frame running under both to the muzzle, the large squared trigger guard, the ring hammer and the thick wrap-around grip. The anchors (`slide`, `grip`, `mag`, `trigger`, `hammer`, `muzzle`, `eject`) are the pistol's, so the hands, the reload and the shot follow the new shape.

The SVD Dragunov gets its thumbhole stock (`stock: 'svd'`: the comb with the cheek rest, the butt behind the hole and the bottom bar closing it at the foot of the pistol grip) and its chunky slotted wooden handguard with the gas block (`svd`), in `rifle-svd.ts`; no other rifle uses either option.

The bolt-action rifles (Remington 700 and its .300 Win Mag and .30-06 hunting versions, M24 SWS, Steyr SSG 69) get the sporter stock of their photos (`stock: 'sporter'`, `rifle-sporter.ts`): the butt dropping from the comb to the toe, the wrist into the pistol-grip swell, the bedding under the receiver and the forend tapering under the barrel, instead of the straight bar on a tall block.
