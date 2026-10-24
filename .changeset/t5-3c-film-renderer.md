---
'@adatechnology/game-fluids-three': minor
---

The running film on screen (T5.3c, spec 001). `createFilmManager(THREE, { scene, camera, random, fluids?, gpu? })` draws the film of `game-fluids` with the Fluid Standard's shader over the host's surfaces (transparent where nothing is wet), strips per layout region, instanced drops in flight and the swelling bead of a drip. It keeps the film near the player: at most 6 grids of 2 x 2 m, only within 30 m, simulated inside a millisecond budget and uploaded by the dirty rectangle (`copyTextureToTexture` when `gpu` is given). A grid that is far, still or squeezed out is baked into the fluid world's stain decals (`fluids.splash` with the film's colours) and freed. `launch`, `drip`, `setWeather({ rain })`, `update`, `stats`, `clear`. Additive: the existing renderer is unchanged.
