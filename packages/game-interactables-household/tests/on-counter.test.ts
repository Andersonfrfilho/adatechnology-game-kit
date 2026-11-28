// What stands on a counter (a microwave) is a loose body of its own: it has a collider round what is drawn, so the host lays it on the counter as a body that
// rests on the top and goes with it (pushed, shot, knocked), never a fixed drawing left hanging in the air when the counter moves.
import { describe, expect, it } from 'vitest'
import { bbox, build, closedPoints } from './helpers'
import types from '../src/data/types.json'

const ON_A_COUNTER = ['microwave']

describe('what stands on a counter is a body that rests on it', () => {
  for (const id of ON_A_COUNTER) {
    it(`${id}: solid, with a collider from its feet to its top`, () => {
      const def = types.find((t) => t.id === id)
      expect(def?.solid, 'solid').toBe(true)
      const b = build(id)
      const body = b.spec.colliders?.find((c) => c.id === 'body')
      expect(body, 'body collider').toBeDefined()
      if (!body) return
      const { min, max } = bbox(closedPoints(b))
      // its feet stand on the counter's top: the collider starts where the drawing starts, so nothing is drawn under the body or over it
      expect(Math.abs(body.center[1] - body.half[1] - min[1])).toBeLessThan(1e-6)
      expect(Math.abs(body.center[1] + body.half[1] - max[1])).toBeLessThan(0.01)
    })
  }
})
