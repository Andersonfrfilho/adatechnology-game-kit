---
'@adatechnology/game-weapons-three': patch
'@adatechnology/game-test-room': patch
---

The muzzle flash and the tracer leave the tip of the barrel as the screen shows it, in both views, at the hip and aimed, a shot or a burst. The flash was played on the clip's event, before the frame posed the gun with its kick, and the tracer stayed where the round left while the kick moved the gun away (13 to 70 px on screen, more in a burst). The flash is now played once the clips have posed the gun (`FxWorld.afterPose`), and a tracer from a muzzle a module draws keeps its start on that muzzle while it lives. `muzzle-screen.test.ts` measures every firearm with a model and fails past 6 px.
