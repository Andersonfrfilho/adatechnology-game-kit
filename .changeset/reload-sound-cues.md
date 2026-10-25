---
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-contracts': minor
'@adatechnology/game-test-room': patch
---

Reload sounds follow the animation: the reload clips carry `sound` cues (mag release/out/insert/seat, slide release, charging handle pull and release, bolt lift/pull/push/lock, a shell per round, pump, lever, cylinder, speed loader, barrels, belt cover, rocket, grenade, breech and tube) and the viewmodel plays each one at its second, scaled to the weapon's reload time. The recipes are data (`reload-sounds.json`), with a weight and material profile per weapon; `WeaponAudio.cue`, the `reloadCues` option and `createWeaponFx({ onSound })` are new. `ModuleHost.log` takes an optional entry `type` (the weapons area logs one `sound` entry per cue).
