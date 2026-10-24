---
'@adatechnology/game-fluids-three': minor
'@adatechnology/game-test-room': minor
---

Bridges of the film (T5.3e, spec 001). `createFilmBridge({ fluids, manager, random })`: a `leak` of a liquid that has a film (blood, old blood, bile, motor oil, fuel; `liquids` maps others) throws drops from the hole into the film until the stream ends; `splat({ fluid, point, direction, tint })` throws drops in the colours of a splash (an infection age; the characters will use it for a wound); `setWeather({ rain })` is the rain hook for Phase 6. `tinted(profile, tint)` and `launch({ tint })` draw a grid in a splash's colours. The test room runs the film manager and the bridge (a punctured can of fuel drips into a grid on the floor). The `body` event is not in the contract yet, so the characters side is still to wire.
