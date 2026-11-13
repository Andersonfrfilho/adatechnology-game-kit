import { expect, it } from 'vitest'
import { loadEngine } from './engines'

/** A pendulum on a hinge about +x with range [0, 0.5]: kicked both ways, where does it stop, and with which sign does the relative rotation read? */
it('hinge limit and sign', async () => {
  const { engine } = await loadEngine()
  const out: string[] = []
  for (const spin of [3, -3]) {
    const w = engine.createWorld({ gravity: [0, 0, 0] })
    const a = w.createBody({ kind: 'fixed', position: [0, 1, 0], colliders: [] })
    const b = w.createBody({ kind: 'dynamic', position: [0, 0.75, 0], mass: 3, inertia: [0.06, 0.01, 0.06], spin: [spin, 0, 0], colliders: [{ shape: { kind: 'capsule', halfHeight: 0.2, radius: 0.05 }, tag: 1 }] })
    w.createJoint({ kind: 'hinge', a, b, anchorA: [0, 0, 0], anchorB: [0, 0.25, 0], axis: [1, 0, 0], range: [0, 0.5] })
    const p = new Float64Array(7)
    let lo = Infinity
    let hi = -Infinity
    for (let f = 0; f < 120; f++) {
      w.step(1 / 60)
      w.readPose(b, p)
      const s = p[6] < 0 ? -1 : 1
      const angle = 2 * Math.atan2(p[3] * s, p[6] * s)
      lo = Math.min(lo, angle)
      hi = Math.max(hi, angle)
    }
    out.push(`kick ${spin}: angle about +x stayed in [${lo.toFixed(3)}, ${hi.toFixed(3)}]`)
  }
  console.log(`hinge ${out.join('; ')}`)
  expect(out.length).toBe(2)
})
