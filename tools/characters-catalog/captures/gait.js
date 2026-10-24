/* global GoldenTool */
// Capture for the Bestiário page: the walking cycle of each of the 13 types (`animate0`, the page's own code) at t = 0 .. 2 s in quarter seconds,
// as the joint rotations it leaves on the rig. `__SLICES.types` has the 13 types as `{ id, name }`. The page's animation path draws no random numbers.
(() => {
  const { seed } = globalThis.__GOLDEN_PARAMS
  const { build, animate0 } = globalThis.__team
  const recorder = GoldenTool.createEventRecorder()
  const TIMES = Array.from({ length: 9 }, (_, step) => step * 0.25)
  const rotation = (object) => [object.rotation.x, object.rotation.y, object.rotation.z]
  for (const type of globalThis.__SLICES.types) {
    const object = build({ type: type.name, decay: 0, seed: 5, phase: 0.7 })
    const rig = object.userData.rig
    for (const time of TIMES) {
      animate0(object, time)
      recorder.record('pose', {
        type: type.id,
        time,
        hipY: rig.fig.position.y,
        upper: rotation(rig.upper),
        head: rotation(rig.headG),
        arms: rig.arms.map((arm) => [arm.g.rotation.x, arm.el.rotation.x]),
        legs: rig.legs.map((leg) => (leg.lost ? [0, 0] : [leg.g.rotation.x, leg.kn.rotation.x])),
      })
    }
  }
  return GoldenTool.createGoldenRecord({ name: 'bestiary-gait', seed: Number(seed), events: recorder.events() })
})()
