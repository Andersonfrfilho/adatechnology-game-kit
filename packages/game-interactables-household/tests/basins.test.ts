// What holds water holds it where it is drawn: every sink, tub and toilet says its bowl (`basins`), the stream of its tap or flush lands on that bowl's floor (not
// in the air over it, not through it) and splashes inside its walls; the flush button pressed stays over the lid.
import { describe, expect, it } from 'vitest'
import type { BasinSpec, EmitterSpec } from '@adatechnology/game-interactables'
import type { Primitive } from '@adatechnology/game-props3d'
import { cornersOf } from '../src'
import { bbox, build, closedPoints, partPoints } from './helpers'

const BOWLS: Readonly<Record<string, string>> = { sink_kitchen: 'tap_water', sink_bathroom: 'tap_water', utility_sink: 'tap_water', toilet: 'flush_water' }
const EPS = 1e-6

const inside = (basin: BasinSpec, x: number, z: number): boolean => x >= basin.from[0] - EPS && x <= basin.to[0] + EPS && z >= basin.from[2] - EPS && z <= basin.to[2] + EPS

describe('basins: the water stays in the bowl', () => {
  for (const [type, emitterId] of Object.entries(BOWLS)) {
    it(`${type}: says its bowl, and its stream lands on the bowl's floor inside its walls`, () => {
      const b = build(type)
      const basin = b.spec.basins?.[0]
      expect(basin, 'basin').toBeDefined()
      if (!basin) return
      for (let k = 0; k < 3; k++) expect(basin.to[k], `axis ${k}`).toBeGreaterThan(basin.from[k])
      // the bowl is within what is drawn of the piece
      const { min: lo, max: hi } = bbox(closedPoints(b))
      for (let k = 0; k < 3; k++) {
        expect(basin.from[k]).toBeGreaterThanOrEqual(lo[k] - EPS)
        expect(basin.to[k]).toBeLessThanOrEqual(hi[k] + EPS)
      }
      const stream = b.spec.emitters?.find((e: EmitterSpec) => e.id === emitterId)
      expect(stream, emitterId).toBeDefined()
      if (!stream || stream.reach === undefined || !stream.bowl) throw new Error(`${emitterId} has no reach or bowl`)
      // straight down onto the floor of the bowl
      expect(stream.pos[1] - stream.reach).toBeCloseTo(basin.from[1], 3)
      expect(inside(basin, stream.pos[0], stream.pos[2])).toBe(true)
      // the walls round it are where the bowl's walls are, and rise to its rim
      const room = Math.min(stream.pos[0] - basin.from[0], basin.to[0] - stream.pos[0], stream.pos[2] - basin.from[2], basin.to[2] - stream.pos[2])
      expect(stream.bowl.radius).toBeLessThanOrEqual(room + 1e-3)
      expect(stream.bowl.depth).toBeCloseTo(basin.to[1] - basin.from[1], 3)
      // a thin stream, never a column as wide as the bowl
      expect(stream.size ?? 0).toBeLessThan(0.1)
    })
  }

  it('toilet: the flush button pressed all the way keeps its top over the lid (no two faces on one plane)', () => {
    const b = build('toilet')
    const part = b.spec.parts?.find((p) => p.id === 'flush_button')
    expect(part?.motion.kind).toBe('slide')
    const travel = part?.motion.kind === 'slide' ? (part.motion.distance ?? 0) : 0
    const top = Math.max(...partPoints(b, 'flush_button').map((p) => p[1]))
    const lid = bbox(b.rec.primitives.flatMap((p) => cornersOf(p))).max[1]
    expect(top - travel).toBeGreaterThan(lid + 0.002)
  })
  it('toilet: its round bowl is under the china up to the rim, and the water stands inside the hollow (never through the china, never a square)', () => {
    const b = build('toilet')
    const basin = b.spec.basins?.[0]
    if (!basin) throw new Error('toilet has no bowl')
    expect(basin.shape).toBe('round')
    // the china: the solid of revolution that starts on the floor; its profile goes up outside to the rim and down inside to the trap
    const china = b.rec.primitives.find((p): p is Extract<Primitive, { kind: 'lathe' }> => p.kind === 'lathe' && Math.min(...p.points.map((q) => q[1])) === 0)
    if (!china) throw new Error('toilet has no hollow china')
    const top = Math.max(...china.points.map((q) => q[1]))
    const turn = china.points.findIndex((q) => q[1] === top)
    const outer = china.points.slice(0, turn + 1)
    const inner = china.points.slice(turn + 1)
    const radiusAt = (chain: readonly (readonly [number, number])[], y: number): number => {
      for (let i = 0; i + 1 < chain.length; i++) {
        const [r0, y0] = chain[i]
        const [r1, y1] = chain[i + 1]
        if ((y - y0) * (y - y1) <= 0 && y0 !== y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0)
      }
      return Number.NaN
    }
    const radius = (basin.to[0] - basin.from[0]) / 2
    // round, on the china's axis
    expect((basin.from[0] + basin.to[0]) / 2).toBeCloseTo(china.x, 6)
    expect((basin.from[2] + basin.to[2]) / 2).toBeCloseTo(china.z, 6)
    expect(basin.to[2] - basin.from[2]).toBeCloseTo(2 * radius, 6)
    // under the china at every height up to the rim: the water never shows through it
    for (let y = basin.from[1]; y <= Math.min(basin.to[1], top); y += 0.005) expect(radius, `y ${y.toFixed(3)}`).toBeLessThan(radiusAt(outer, y - china.y) - 0.005)
    // where its surface stands (two thirds to four fifths full), the water is inside the hollow, so it shows as a disc in the bowl
    const depth = basin.to[1] - basin.from[1]
    for (let f = 0.65; f <= 0.8 + EPS; f += 0.05) expect(radius, `fill ${f.toFixed(2)}`).toBeLessThanOrEqual(radiusAt(inner, basin.from[1] + f * depth - china.y) + EPS)
  })
})
