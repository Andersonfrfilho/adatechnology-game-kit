---
'@adatechnology/game-destruction': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-vfx-three': patch
---

`game-destruction-three` draws blasts and fires with the effects world (T5.1f). A new `RendererOptions.vfx` takes the world the host shares (stepped by the host's `VfxRenderer`); without it the renderer makes its own world and `game-vfx-three` layer and steps them in `update`, so existing callers keep working. An `explode` event plays `ev.effect ?? 'generic'` (the M67 scaled by `radius / 15`; an id the catalogue does not know falls back to it), the five old bursts and the point light are gone, and a burning part gets one `vfx.fire` that follows it and stops when the part stops burning. `explode(point, energy, radius, options?)` takes `{ effect, direction, visual }`; `visual: false` keeps only the shove and the sound. `RendererOptions.explosionLight` is removed (the light belongs to the effects world) and `RendererOptions.camera` is new. Debris, sparks, drips and leaks still use the package's point sprites until `game-vfx` gets the shared sprite pool; `particles.ts` stays until then.

`game-destruction` gets `blastFrontSpeed` (default off): glass an explosion reaches breaks `distance / speed` seconds later, in `update`. The `explode` event now carries `effect` from `explodes.effect`.

`game-vfx-three` names its puff, spark and glow meshes (`vfx-puffs`, `vfx-sparks`, `vfx-glows`) and draws blank mark textures when there is no DOM, so it runs headless.
