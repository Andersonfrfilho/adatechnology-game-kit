# @adatechnology/game-weapons

## 0.11.1

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0

## 0.11.0

### Minor Changes

- 6686e67: A launched round (rocket, 40 mm grenade) always goes off where it lands, on any ground, wall or object, however close: an impact before the arming
  distance detonates by default (`rules.explosives.unarmedImpact: 'detonate'`; `'dud'` keeps the real safety of the fuze). Two safety fuzes: a launched
  round that comes to rest goes off (`restSpeed`), and one that hits nothing self-destructs (`selfDestructSeconds`, 20 s). `sweepGround` reads the ground
  along the whole step, so a fast round cannot cross a heap, a kerb or a crater rim between two frames. The ground of the destruction world answers rays
  with its surface as it is now (`surfaceRay`), so a round fired into a crater goes off on its floor instead of in the air over the old flat level.

## 0.10.2

### Patch Changes

- Updated dependencies [4e2d44b]
  - @adatechnology/game-contracts@0.32.0

## 0.10.1

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0

## 0.10.0

### Minor Changes

- 694cad8: A granada de 40 mm (M79, M203, AG36, M32) arma entre 14 e 27 m de voo, sorteado a cada disparo, como a espoleta da M406 real, e a VOG-25 do GP-25 entre 10 e 40 m: antes disso o impacto é falha. Novo campo `armRange` no explosivo.

## 0.9.2

### Patch Changes

- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0

## 0.9.1

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0

## 0.9.0

### Minor Changes

- 20a6526: Four new weapons with models drawn from reference photos: FAMAS (carry handle over the whole top, grooved spigot, folding bipod legs), IWI Tavor (one olive polymer body, full-hand trigger guard, reflex sight on a short rail), L85A2 (steel body with SUSAT optic, tan quad-rail handguard) and Winchester 1887 (lever-action shotgun with tall receiver, big lever loop, wood stock and forend). New `look` option of the bullpup builder and `m1887` option of the rifle builder; the Steyr AUG and the other models are unchanged.
- 624ee79: A weapon in each hand, finished. The magazine change frees a hand as a person does: the other weapon is tucked in the belt (`rules.dualWield.stowSeconds`, 0.45 s), the free hand goes to the magazine well of the weapon being reloaded and back, the weapon is drawn again, then the same the other way round; neither weapon fires meanwhile. The contracts gain `HostTool.stowed`, the `stow` host event and `HandTargets.fingersL` (the left hand's index finger, as `fingers` is the right's); the first-person arms and the player's body curl each index finger by it (the body's right index now follows `fingers` too). Q (fire mode) and B (safety) act on the weapon of the hand that fired last, and X clears the stuck weapon (the last-fired one first).
- b6677b5: A weapon in each hand. `rules.dualWield` of the arsenal says which weapons go one in each hand (the pistols and revolvers by category, the Mini Uzi, Uzi, MAC-10, vz. 61, MP7 and the knives, machete and hatchet by id; a game changes the lists) and how much worse each one shoots then (`spread` 1.8x, `recoil` 1.35x); `canDualWield(arsenal, id)` answers it, and `setStance({ dualWield: true })` applies it and keeps the weapon from aiming. The contracts gain `ToolHand`, `HostTool.offHand` (the left hand's tool, with its own rounds and reload), `hand` on the tool events, a `MuzzleSource` and a `holdFrame` asked by hand. The weapon module draws the left hand's weapon out to the left, the left hand on the mirror of its grip, in both views (`VIEW_HOLD.dual`, `BODY_HOLD.dualGrip`, `oneHandHold`; a stock is folded while held in one hand), and lends each hand's muzzle, so each shot's flash and tracer leave its own gun. The test room: Shift+click in the weapon picker puts two of an eligible weapon in the hands (a second Shift+click changes the left one, a plain click goes back to one); the left mouse button fires the right hand, the right button the left hand (no aiming with two); R reloads the right one, then the left one; `room.setOffTool`, `room.offTool`, `room.useOff` and `room.reload`.
- 5e7d154: Six more real weapons in the arsenal, each with its model, reload and real numbers (the source of each in `tools/weapons-catalog/decisions.json`, `creations`): AKS-74U, FN SCAR-L, M1 Garand, Accuracy L96A1, Mossberg 590 and FN M240B. A generic weapon now wears the model of a weapon of its own before a variant of another (`variantOf`), so a weapon added later never changes what the generic looks like.
- 0ce0b71: Three more real weapons in the arsenal, each with a model drawn after its photo and not borrowed from another weapon: MP40 (tubular receiver, magazine well, Bakelite housing and grip, ribbed barrel with the rest bar, stock that folds under), B&T MP9 (compact polymer block, magazine in the grip, vertical foregrip, top rail, stock that folds to the right) and FN PS90 (thumbhole stock with the trigger guard cut through the body, translucent magazine on top, integrated optic housing and the 407 mm barrel). Real numbers and sources in `tools/weapons-catalog/decisions.json` (`creations`); the models are `weaponModels` decisions with the new `mp40`, `mp9` and `ps90` builders. The FN P90 keeps its model.
- 0e47730: Four more real weapons in the arsenal, each with a model drawn after its photo and not borrowed from another weapon: PPSh-41 (one-piece wooden stock and body, perforated barrel jacket with the slanted muzzle brake, 71-round drum or curved box, tangent sight), Mauser Kar98k (long bolt action with the turned-down bolt handle, full wooden stock, one barrel band, nose cap with bayonet lug, internal five-round magazine), MG42 (perforated barrel shroud with the barrel-change opening, conical muzzle booster, front bipod, belt feed on the left, butt and pistol grip) and VSS Vintorez (integral suppressor over the whole barrel, AK-like receiver, skeletal wooden stock, 10-round box magazine). Three new calibres (7.62x25 Tokarev, 7.92x57 Mauser, 9x39) with their numbers, cartridge sizes and ammunition loads; the VSS carries the integral suppressor and its subsonic noise. Real numbers and sources in `tools/weapons-catalog/decisions.json` (`creations`, `calibers`, `archetypes`); the models are `weaponModels` decisions with the new `ppsh`, `kar98`, `mg42` and `vss` builders, and the new `beech` material. The three new calibres reuse existing gunshot profiles. No existing weapon changes.
- 5170e39: First lot, part C: the M32 multiple grenade launcher (Milkor MGL), the M18 smoke grenade, the Semtex charge, the KA-BAR, the katana and brass knuckles.

  - game-weapons: the `m32_mgl` launcher (six 40x46 mm grenades, 778 mm with the stock out and 565 mm folded, 5.3 kg, 75 m/s; launcher family `revolver`); the `smoke_grenade` explosive (`kind: 'smoke'`, no blast, fuse 1.0 to 2.3 s, coloured smoke for 50 to 90 s, new `ExplosiveDef.smoke` carried by the `Detonation`); the `semtex` explosive (500 g, 0.83 kg TNT, remote or about 30 s fuse); the melee weapons `kabar`, `katana` (two-hand) and `brass_knuckles` (harder punch over a smaller contact area than `fists`). Generated data comes from `tools/weapons-catalog` (`multiLaunchers`, `radii`).
  - game-weapons-three: a model of its own for each (`mgl` builder with the swing-out cylinder, front grip, collimator sight and folding stock; new `cylinder` model family that reloads and cycles like a revolver and is held as a long gun, with the support hand on `parts.foreGrip`; `buildHandheldModel` for the melee weapons, with a `support` mark for the second hand; the M18 and Semtex builders next to the other explosives).
  - game-test-room: a burning smoke canister lets out puffs of its colour through the effects world until its filling is spent and tells the host of no explosion; brass knuckles punch with the fists clip and the one-hand punch rule.
  - game-vfx: `semtex` blasts like the C4 (alias).

- 2321c3f: Four weapons of the first lot, part A2, drawn as their photos instead of inheriting another weapon's model: the SIG Sauer P320, HK USP and Walther P99 (new `design` option of the pistol builder: modular or polymer frame with a grip of its own, serrated slides, rails, squared or hooked trigger guard, the USP's external hammer, the P99's strap ridges and dimples) and the Colt Python (new `python` option of the revolver builder: ventilated rib, full-length underlug, walnut checkered grip with medallion, round trigger guard). Existing pistols and revolvers are unchanged; the four are added to the catalogue (creations and model decisions), with goldens, thumbnails and docs.

### Patch Changes

- 970f192: The Heckler & Koch G36, G36K and G36C as the real ones (compared with the photos in `assets/weapon-references.json`): the tall polymer receiver with the stock hinge and the trigger group housing, the skeletal side-folding stock, the grip leaning back, the translucent magazine with the rounds seen through it, and on top the carry handle with its optic and red dot (G36, G36K) or the long rail on two risers ending in the front sight (G36C, with a rail under its short handguard). New `g36` model option and `stock: 'g36'`, `magMat: 'smoke'`; the options are decisions of the catalogue (`weaponModels` in `tools/weapons-catalog/decisions.json`). The goldens of the three models and their silhouettes are regenerated.
- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0

## 0.8.0

### Minor Changes

- 6c569dd: Barrel heat is physical. `WeaponState.heat` is now the barrel temperature above ambient in °C: each round adds `share × muzzle energy / (barrel mass × 490 J/(kg·K))` (the whole shell for a shotgun), the barrel mass is its length times kg per metre of the category divided over the barrels a rotary gun has (`dimensions.barrels`, the M134 has 6; `dimensions.barrelMass` overrides it for a heavy or quick-change barrel), and it cools by Newton's law with `τ = 30 s + 250 s/kg × mass`, integrated exactly. An M4 reaches the warning after about 130 rounds of rapid fire instead of one magazine; a pistol or a bolt rifle at a bolt pace never does. `rules.heat` is now data in °C (`cap` 900, `displayMax` 750, `faultFrom` 350, `faultSpan` 200, `specificHeat`, `barrelShare`, `barrelKilogramsPerMetre`, `barrelFallback`, `cooling`, `visual.smokeFrom` 250 / `smokeSpan` 300 / `glowFrom` 450 / `glowSpan` 300); `perShot`, `decayBase` and `decayPerPoint` left the main rules and live in `rules.heat.gallery`, which `GALLERY_HEAT` sets so the recorded Galeria runs stay reproducible. New exports: `roundsToWarningOf`, `roundsToWarning`, `barrelMassOf`, `coolingTimeConstant`, `decayHeat`. `decayHeat` and `heatPerRound` take the barrel mass. In `game-weapons-three` the viewmodel smoke reads `visual.smokeSpan`, and the test area bench shows the barrel temperature in °C plus the new `rounds_to_warning` metric (rounds to the warning at the weapon's own rate of fire, from cold).

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0

## 0.7.1

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0

## 0.7.0

### Minor Changes

- 0e1bb14: Every gun closes the view in when it aims, not only one with a scope. `rules.aim.ironSightZoom` gives the iron-sight zoom of each weapon category (1.1x for a handgun up to 1.4x for a marksman or sniper rifle with no optic) and `aimZoomOf(arsenal, weapon, attachments)` answers the zoom of a weapon: the optic fitted (the AUG's integral 1.5x, an ACOG 4x), else the iron sights of its category. The right mouse button of the weapons area aims every firearm and launcher by it.
- e507329: The weapon picker. `weaponMenu(arsenal)` lists the whole arsenal by group (firearms, melee weapons, explosives, tools) and category, sorted by name and with each brand weapon's maker; `genericWeapons` and `realLoadout` name the generic guns (the `9 mm service pistol`) and the real weapon that stands for each. The test room opens the picker with the key left of 1 (or its Armas button): a click equips the weapon and adds it to the hotbar, a search finds a weapon by name or maker in every group, and the default hotbar holds the real weapons instead of the generic guns.

  The explosives of the weapons gallery are ported (`buildExplosiveModel`: the M67, the molotov, the pipe bomb, the dynamite, the C4, the Claymore and the flashbang), so the throwables are drawn with their own model in the hands, on the counters and in flight (`projectileModel`) instead of the box of the generic prop. The M79 gets the gallery's model with a break action that folds down to load one grenade, a grenade launcher no longer fires a rocket's backblast, the claw hammer takes the item model of the hammer, and the pt-BR names of the weapons that showed in English are translated.

### Patch Changes

- e0aaf22: The `pdw` tags of the FN P90 and the HK MP7A1 and the break-action model of the M79 are decisions of the catalogue (`weaponTags` and `weaponModels` in `tools/weapons-catalog/decisions.json`), so the generated `firearms.json` and `models.json` keep them: they had been written into the generated files by hand, and the catalogue check failed.
- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0

## 0.6.0

### Minor Changes

- 8f07024: A blast pushes a body by its blast wave, not by a game coupling. `blast-impulse` reads the impulse of the wave (Kinney and Graham's side-on impulse, reflected on the body) from the charge in kg of TNT and the distance. `knockOf` takes the body's area and mass, so a hand grenade at 3 m moves a person a few tenths of a metre per second and a big charge close throws them. A body inside the lethal radius that the blast reaches falls where it stands, wounded, and lies longer. Cover that stops half the blast stops the fragments too. A body in reach is stunned, and the player's view sways while stunned.

  Each explosive of the arsenal gives its charge (`ExplosiveDef.tnt`: M67 0.24 kg, C4 0.76 kg, P13 1.5 kg, and so on). The charge travels on the detonation, the `explodes` spec, the destruction `explode` event and the host `explosion` event (`tnt`, `lethalRadius`). A blast without a charge takes one from its energy at the arsenal's scale. The horde keeps its own shove.

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0

## 0.5.9

### Patch Changes

- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0

## 0.5.8

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [7b77aa7]
- Updated dependencies [d97cf9f]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
  - @adatechnology/game-contracts@0.22.0

## 0.5.7

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0

## 0.5.6

### Patch Changes

- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [53babb5]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0

## 0.5.5

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0

## 0.5.4

### Patch Changes

- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0

## 0.5.3

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0

## 0.5.2

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0

## 0.5.1

### Patch Changes

- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0

## 0.5.0

### Minor Changes

- 0604035: `ExplosiveDef` gets two optional blocks for a world explosive that is a pressure vessel: `leak` (`fluid`, `liters`, `pressurized`, `igniteDelay`, `hissSeconds`: what it holds and when a leak catches fire as a torch) and `shell` (`launchSpeed`, `trailSeconds`: what is left of it after the blast). `propane_p13` carries the Laboratório de Explosões values (24 l of gas, torch after 0.8 s, shell up at 13 m/s with a 1.8 s fire trail) and a mass of 28 kg (15 kg tare plus 13 kg of gas); `checkArsenal` validates them.
- 1b1d611: Per-caliber penetration table in `game-weapons` (`AMMO`, 50 loads, `arsenal.loadOf`, `weapon.setAmmoKind`, `ArsenalOptions.ammo`): per calibre and kind of round
  (fmj, hp, ap, buck, slug, birdshot, incendiary, tracer...) the core and jacket, the mass and speed when they differ, the energy and the millimetres of steel,
  concrete, brick and wood it goes through. The shot carries `ammo`, `penetration`, `incendiary` and `tracer`. `game-contracts`: `Hit.penetration`, `Hit.incendiary`,
  `Hit.tracer`, `Hit.ignition`, `shotExtras(shot, distance)` (the penetration scaled by the energy left) and `shotToHit` passes them. `game-destruction` reads
  `Hit.penetration` by material class (`MaterialDef.penetrationClass` / `penetrationScale`), keeps `Hit.piercing` as the energy-rule fallback and reads no calibre
  names: `PIERCING_BY_KIND`, `PIERCING_BY_CALIBER` and `piercingOf` are removed (breaking). `shoot` takes `{ penetration, piercing, ... }` or a bare piercing factor.
  `game-test-room` passes the round of the shot to the world.
- d610199: A normal bullet that goes through a fuel tank, a jerrycan or a gas bottle now only leaks; it no longer blows the tank up by itself. The leak lights with a spark of a
  hard round on steel, an incendiary or tracer round, a fire near (a burning part or fuel stain) or a blast, and then the usual fire and explosion run.
  `game-contracts`: `IgnitionRules`, `DEFAULT_IGNITION_RULES`, `resolveIgnitionRules`, `ignitionChance`, `fillFactor`, `sparkTargetFactor` (the container side: a fill curve where a full
  tank mostly leaks and a nearly empty one lights easiest, what a spark needs to strike, the fire near). `game-weapons`: `rules.ignition` (chance of the core and the jacket of the round,
  built from the ammo table, plus the flame of incendiary and tracer) and `ammoIgnition`; the shot carries `ignition`. `game-destruction`: `DestructionOptions.ignition`, the roll in the
  ballistic hit of a container of `gas` or `fuel`, fire near and blast. `game-vehicles`: `VehicleDestructibleOptions.fuel` (starting level) and `ignition`; the `E > 1500` rule that
  heated the tank is gone. `game-vfx`: `vehicle_leak` is now the leak without the fire and the blast, and `vehicle_leak_ignited` is the whole Garagem sequence. `game-vehicles-three`:
  `defaultEffectIds.leakIgnited`, asked when the tank catches fire.
- 011e17a: Drive first-person muzzle smoke and flash scale from per-weapon data profiles (`smokeless`, `black_powder`, `suppressed`, `none`). Add `propellant` to `CaliberDef`, `.45-70 Government (black powder)` (`45_70_bp`), `MUZZLE_SMOKE` and `muzzleSmokeOf({ caliber, weapon, suppressed })` in `game-weapons`, parameterize `viewmodel_muzzle_flash` in `game-vfx` with smokeless defaults, pass the resolved profile through `createEffects().muzzleFlash` and `viewmodel-events.ts` in `game-weapons-three`, and refine the hot-barrel smoke wisp into a thin rising thread.

  Add a `gallery` smoke profile (never chosen by default) and optional `driftSpread`, `riseSpread`, `sideSpread` and `lifeSpread` values so the recipe can still reproduce the Arsenal gallery's original muzzle smoke exactly.

  Cool the barrel closer to real life: `rules.heat.perShot` is lower (a rifle magazine no longer glows), and the new `rules.heat.visual` (`smokeFrom`, `smokeSeconds`, `glowFrom`, `glowSpan`) sets when the player sees the hot-barrel thread of smoke (only above `smokeFrom` and for `smokeSeconds` after the last shot) and the red glow. `GALLERY_HEAT` keeps the numbers the Arsenal gallery recorded.

### Patch Changes

- 8842f5b: Complete the `en` locale table: the five later weapons and every explosive now have their English name there (same text the catalog fallback gave).
- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [1b1d611]
- Updated dependencies [d610199]
- Updated dependencies [9b27571]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0

## 0.4.5

### Patch Changes

- Updated dependencies [f49e466]
  - @adatechnology/game-contracts@0.13.0

## 0.4.4

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0

## 0.4.3

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0

## 0.4.2

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0

## 0.4.1

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0

## 0.4.0

### Minor Changes

- 76d15b6: Contrato do corpo vivo (fase 4): `body.ts` com `BodySlot`, `SegmentKind`, `BodyRegion` e `MISSING_BITS`; `Hit.mass`, `Hit.cut` e `Hit.part`; evento `body`; `ObjectState.body`. `Shot.mass` (gramas do projétil) sai das armas e `shotToHit` copia para o `Hit`. O `game-destruction` ganha o rótulo do evento `body` nos dois idiomas.
- afffd1b: Twelve generic weapons for the melee items of the real-world catalog: tactical knife, meat cleaver, hatchet, nail bat, iron pipe, pickaxe, sickle, police baton, cast iron skillet, improvised spear, chainsaw and recurve bow, with reach, noise and mass of the item. They come after the existing weapons, so the order and the recorded scenarios of the shipped ones are unchanged.

### Patch Changes

- cc182c7: Contracts: `Thumbnail` (`svg` or `render`, with `yaw`, `pitch`, `distance` and `wear`) and `TestableItem.thumbnail`; the registry helpers `mergeById`, `applyPatches`, `removeIds`, `deepMerge` and the `DeepPartial` type now live here so every catalog package merges packs the same way. Interactables: `ItemDef.thumbnail` and a dependency on the contracts. Weapons: imports the helpers from the contracts (public API unchanged).
- Updated dependencies [76d15b6]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
  - @adatechnology/game-contracts@0.8.0

## 0.3.1

### Patch Changes

- Updated dependencies [572f2fa]
  - @adatechnology/game-contracts@0.7.0

## 0.3.0

### Minor Changes

- 86b68d7: 21 new weapons (data from `decisions.creations`, each number with its source and reason): `hk_mp5sd3` (integral suppressor), `fn_parafal`, `taurus_t4_civil`, `taurus_th380`, `mossberg_500_cruiser`, `hk_mp5k`, `hk_ump9`, `mini_uzi`, `hk_mp7a1`, `hk_g36`, `hk_g36k`, `hk_g36c` (integral 3x optic on the first two), `fn_m249`, `fn_minimi_para`, `fn_mag`, `rpk`, `sig_mpx`, `mg3`, `pp19_bizon`, `vz61` and `m134`, and the calibres `4_6x30` and `32acp`. The M134 has three modes (hand-held with a belt box, with the ammunition backpack, on a tripod), a rate range (`rpmRange`, 2000 to 6000, 3000 by default) and a barrel spin-up (`spin`). The GP-25 fits only AK weapons (not the SKS). A factory part that is subsonic with its parts on (the MP5SD3) has the subsonic effect in its base numbers. `game-weapons-three` draws them (two new builders: the M134 rotary barrels that turn with each shot, and the Bizon helical magazine), keeps the 77 gallery hashes and has its own golden for the new models; the weapons area has four columns of counters and the M134 on its tripod.
- 16c1453: Accessories and stocks, types first (T1.7.1). `game-weapons` gains `attachment-types` (`AttachmentDef`, `MountDef`, `StatModifier`, `FittedAttachment`, `StockDef`, `WeaponSnapshot`), the optional `WeaponDef.mounts`, `fitted` and `stock`, the phases `fit`, `stock` and `switch`, the rule events `attachment`, `toggle`, `stock` and `underbarrel`, and `TriggerResult.suppressed` (also on the `shot` event). Nothing existing changes.

  `game-contracts` gains the `HostEvent`s `attachment`, `toggle`, `stock` and `underbarrel` and the clips `TOOL_CLIP.STOCK` (variants `fold`, `unfold`, `collapse`, `extend`) and `TOOL_CLIP.TOGGLE` (`on`, `off`); `toolAnimationStep` maps `stock` and `toggle`. BREAKING for exhaustive switches over `HostEvent`. The test room reports the new events to modules.

  Data (T1.7.2): `data/attachments.json` (30 accessories: suppressors, brakes, optics, grips, bipod, lights, laser, magazines, barrels, sling, ammunition backpack, tripod, grenade launchers), generated by the catalog tool from the Arsenal §11 lines and `decisions.json`; `firearms.json` gains `mounts`, `fitted` and `stock` per weapon (from the Gallery options plus the muzzle `threads`, `mountNotes`, `stocks` and `integral` decisions) and the length with the stock in for the seven weapons the Arsenal sheet lacks.

  Rule (T1.7.3): `resolveLoadout` and `canFit` (with the `isCompatible` plugin), `WeaponState.fit`, `remove`, `toggle`, `setStock`, `setStance`, `snapshot` and `arsenal.restore`, `aimSeconds` and `mass`. Effects apply in the order set, add, mul with the factory parts taken back out (a weapon without changes runs exactly as before). A suppressed pull sets `TriggerResult.suppressed`; a home-made suppressor breaks at a shot drawn from a salted stream. New rules `rules.attachments` (fit seconds 2/15/30, switch seconds, speed of sound), `rules.aim` (`hipSpread` is 1 in the SDK: the Arsenal's ×6 is a configuration) and `rules.stock`; `ArsenalOptions` gains `attachments`, `patch.attachments`, `remove.attachments` and `isCompatible`. `TriggerResult.status` gains `busy` (an accessory or the stock is being worked on).

  Launchers under a barrel (T1.7.4): the accessories `m203`, `gp_25` and `ag36` name a launcher weapon (`category: 'launcher'`, `tags: ['underbarrel']`) added to `launchers.json`, with the new reload family `underbarrel` (`breech_open`, `round_in`, `breech_close`) and the explosive `vog_25`. A weapon with one fitted has `underbarrel` (a second `WeaponState` with its own ammunition, the M79 launcher rule), `underbarrelActive` and `useUnderbarrel(on)` (phase `switch`); `trigger` and `reload` go to the launcher while it is on and `drain()` carries its events. `ReloadFamily` and the launcher action `family` gain `underbarrel`.

  BREAKING for code that implements the interfaces (not for callers): `WeaponState` gains the required members `attachments`, `mass`, `aimSeconds`, `suppressed`, `stock`, `underbarrel`, `underbarrelActive`, `canFit`, `fit`, `remove`, `toggle`, `setStock`, `setStance`, `useUnderbarrel` and `snapshot`, and `Arsenal` gains the required `attachments`, `canFit` and `restore`; a fake or a wrapper of either has to add them. Taking off a launcher keeps its rounds for that accessory: fitting it again brings them back (grenades are conserved).

### Patch Changes

- Updated dependencies [bd41a66]
- Updated dependencies [16c1453]
  - @adatechnology/game-contracts@0.6.0

## 0.2.0

### Minor Changes

- b3a5d99: Launchers, throwables and flamethrower with the rule of the team deliveries. A launcher returns the projectile (`throw` with `explosive`, `trigger: 'impact'`, `armDistance` 10 m) and the `backblast` (5 m, 19° cone); `arsenal.explosiveBody(use)` flies it with gravity, bounces, counts the fuse, arms by distance (a hit before it is a `dud`) and returns `detonate` with everything a host needs; `blastEffect` and `backblastEffect` say who is in the lethal or injury zone (cone of the Claymore, stun of the flashbang). Throwables follow their `ExplosiveDef` (fuse, fire, energy): the molotov now leaves fire of 4 m for 9 s instead of 1.5 m for 12 s. New throwables `flashbang`, `dynamite`, `c4` and `claymore` (`place` use for the last two). `ExplosiveDef` has `chain` (delays of the chain reaction of the world explosives) and the trigger `explosion`; `WeaponRules.explosives` holds gravity and bounce; `weapon.ts` is split into `weapon-core`, `weapon-commands`, `weapon-firearm` and `weapon` without change of behaviour.
- 9666008: Cooking a grenade: a throwable with a timer fuse takes the pin out on the pull and is thrown on `release(origin?, direction?)`, which now returns the throw with the fuse that is left (`WeaponState.release` returns `TriggerResult | null`, and `WeaponState.cooking` says a pin is out); holding past the fuse sets it off in the hand (`Use` `throw` with `inHand`, and `cooked` for the seconds held). Impact, remote and wire throwables, and a long-fuse dynamite, still act on the pull. The rule emits `{ type: 'cook', phase: 'start' | 'throw' | 'burst', fuse }`.

  BREAKING for exhaustive switches over `HostEvent`: the test room reports the same `cook` event to modules, and `toolAnimationStep` maps it to the new `TOOL_CLIP.COOK` clip (started with the fuse as `duration`, finished on throw or burst). The room throws what is being cooked on release (and when the tool changes).

  Fuses: `ExplosiveDef` gains `fuseRange` (sampled per throw from a stream of its own, so the spread is not moved: the flashbang is the M84 delay of 1.0 to 2.3 s) and `fuseLength` with `burnRate` and `burnTolerance` (the dynamite is 0.03 m of safety fuse at 131 s/m ±10%). `WeaponState.setFuseLength(metres)` and the area's `fuse_length` control set a longer one; from `rules.explosives.placeFuseFrom` (10 s) the explosive is set down lit instead of thrown. `nominalFuse` and `sampleFuse` are exported, and `checkArsenal` reports a bad fuse number.

- 9666008: Trip wire: `ExplosiveDef.tripwire` (`length`, `angleDeg`, `height`; default in `rules.explosives.tripwire`, 10 m ahead and 0.15 m above the charge, derived because no source gives the M18A1 kit length) is carried by the `place` use of a charge with the `wire` trigger (the Claymore), and `tripwireSegment(use)` gives the segment to stretch. The test room draws the wire (`charge_wire`), puts a marker (`charge_marker`) where any charge was set down and sets the charge off when a body (the player, an object of the room) crosses the wire; bodies already on the wire when it was set are let through until they step off. The Y key now fires only the charges for the remote detonator.
- 478c444: Real models and handling rules. `game-weapons` ships 79 real weapons with brand and measures (launchers and flamethrowers included; plus the 42 generic archetypes, which the models point to
  through `archetype`), 28 calibres, 17 explosives, all generated by `tools/weapons-catalog` from the team deliveries, and `createArsenal`
  takes `explosives`, `patch`, `remove`, `include`, `rules` and `strings` and reports every inconsistency at once (`checkArsenal`). The runtime gains
  per-weapon speed and noise, `timings` (draw, reload, empty reload, per round, manual cycle, clear), `draw()`, reload by kind with its steps
  (`RELOAD_STAGES`), `volley` and burst `roundTimes`, jams on their own random stream (`seed ^ 0x6a09e667`, so the spread of a seed does not change) with
  `clearFault()`, a safety, barrel heat, weapon condition and ammunition quality, the noise of a burst, a minimal launcher, and `drain()` for the events.
  Breaking: jams are on by default (`rules: { faults: false }` turns them off), `TriggerResult` has new fields, the calibre noise replaces the weapon noise
  of the archetypes, and `WeaponsStrings` has new keys. `game-test-room` passes `faults: false` for its arsenal until the clear key arrives, maps the weapon
  events to host events and fills `HostTool` `fault`, `safety` and `heat`. `game-weapons-three` lays only the archetypes on the counters (three counters
  hold 39 weapons) until the new layout.

### Patch Changes

- cd4aab5: `checkArsenal` (and so `createArsenal`) reports a `defaultCondition` or `defaultAmmoQuality` that the rules do not define, the rules patch ignores `__proto__`, `constructor` and `prototype` keys, and `weaponsLayout` throws when the weapons do not fit on the counters instead of stacking them on the last one.
- 462e8c6: Gunshot sound from the team game: `computeShotSound` (pure, no WebAudio) gives the sound class, gain, cutoff and duration from the calibre energy, the distance, a suppressor and indoors, using the game's class table and its distance muffling (`gain / (1 + d² × 0.004)`, `cutoff / (1 + d × 0.01)`, silent under 0.01). The game calibres sound exactly as in the game; the energy scales loudness, length and brightness around the class. Classes, curves, class picker and mechanical sounds are options of `createWeaponAudio(volume, options)`, and the noise is seeded (`seed`), so the same seed gives the same sound.

  New: `WeaponAudio.shotSound`, `mechanical(id)` (every `RELOAD_STAGES` id, `dry_fire`, `jam`, `safety_on`/`safety_off`, `clear_start`/`clear_end`...), `event(weaponEvent)`, `play(soundClass, volume, distance)`; `shot(energyJ, category, extras?)` takes the distance, suppressor and indoors. `game-weapons` exports `createRng`.

- Updated dependencies [d10c7f7]
- Updated dependencies [a569662]
- Updated dependencies [b3a5d99]
- Updated dependencies [9666008]
- Updated dependencies [9666008]
- Updated dependencies [f4da1a6]
- Updated dependencies [c0fcb62]
- Updated dependencies [85ac930]
  - @adatechnology/game-contracts@0.5.0

## 0.1.4

### Patch Changes

- Updated dependencies [71fb367]
  - @adatechnology/game-contracts@0.4.0

## 0.1.3

### Patch Changes

- Updated dependencies [6022fe5]
  - @adatechnology/game-contracts@0.3.0

## 0.1.2

### Patch Changes

- Updated dependencies [4babeca]
- Updated dependencies [5603151]
  - @adatechnology/game-contracts@0.2.0

## 0.1.1

### Patch Changes

- 3a094cc: Add the `kick` and `shove` melee tools (pt-BR "chute" and "empurrão") to the arsenal and the default loadout; in the test room V kicks whatever tool is selected, and a `kick_detaches_leg_via_tool` scenario covers the hotbar path.
- 5954706: Add `machete` and `utility_knife` to `DEFAULT_LOADOUT`.
- Updated dependencies [930b9ab]
- Updated dependencies [632a45a]
  - @adatechnology/game-contracts@0.1.1

## 0.1.0

### Minor Changes

- 1691ef2: New package `@adatechnology/game-contracts` (global `GameContracts`, no runtime dependencies): the destruction contract (`DestructibleImpl`, `IMPACT_CONTRACT`, `checkDestructible`, `checkHit`, hits, events, state), weapons (`Shot`, `Use`, `shotToHit`), fluids (`ContainerSpec`, `LiquidId`, `ItemUseDef`), item animations (`AnimationClipSpec`, `checkAnimation`) and the `TestableModule` a module hands the test room. The destruction, destruction-three, weapons, fluids and test-room packages depend on it and re-export the moved types, so existing imports keep working; their IIFE bundles now include the contracts. `game-test-room` gains `room.loadModule(module)` (items under the module group, scenarios as buttons, contract checks written to the log), `room.playAnimation` / `room.animations()` with an animations panel, and `TestRoomItem.impl` / `animations`. `game-destruction`: collapse events are computed after all losses (never for a broken part), brittle thin parts break from drops (`fragility`), and `checkDestructible` takes its material ids from the built-in table. `game-destruction-three`: `hardLanding` syncs the transform before the hit and `Piece.localCenter`. `game-fluids`: tap API (`addTap`, `setTap`, `removeTap`, `taps`, `tap` event).
- 5f99ace: Initial release (0.1.0): 18 real calibres and 45 generic weapon archetypes as data (firearms, melee, flame, heat, throwables, tools), a deterministic `WeaponState` runtime (magazines, fire modes, reload, spread and bloom, pellets, recoil, fuel) that produces `Shot`s and `Use`s, and an `en` / `pt-BR` locale table.

### Patch Changes

- Updated dependencies [1691ef2]
  - @adatechnology/game-contracts@0.1.0
