---
'@adatechnology/game-weapons': minor
'@adatechnology/game-vfx': minor
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-vfx-three': patch
---

Drive first-person muzzle smoke and flash scale from per-weapon data profiles (`smokeless`, `black_powder`, `suppressed`, `none`). Add `propellant` to `CaliberDef`, `.45-70 Government (black powder)` (`45_70_bp`), `MUZZLE_SMOKE` and `muzzleSmokeOf({ caliber, weapon, suppressed })` in `game-weapons`, parameterize `viewmodel_muzzle_flash` in `game-vfx` with smokeless defaults, pass the resolved profile through `createEffects().muzzleFlash` and `viewmodel-events.ts` in `game-weapons-three`, and refine the hot-barrel smoke wisp into a thin rising thread.

Add a `gallery` smoke profile (never chosen by default) and optional `driftSpread`, `riseSpread`, `sideSpread` and `lifeSpread` values so the recipe can still reproduce the Arsenal gallery's original muzzle smoke exactly.
