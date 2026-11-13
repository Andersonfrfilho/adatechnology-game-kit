import { createArsenal } from '@adatechnology/game-weapons'
import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import { casingFlight, fragmentDrag, mottMass, reflectedLoad, waveWork } from '../src/blast-wave'
import type { BlastCharge, DestructibleSpec } from '../src'

const m67 = createArsenal().explosives.get('m67')!
const GRENADE: BlastCharge = { tnt: m67.tnt!, casing: m67.casing! }
const ORIGIN: [number, number, number] = [0, 1, 0]

const target = (id: string, at: [number, number, number], material = 'steel', size: [number, number, number] = [0.3, 0.3, 0.003]): [DestructibleSpec, { id: string; position: [number, number, number] }] => [
  { parts: [{ id: 'sheet', material, shape: { kind: 'box', size }, position: [0, 0, 0], thickness: size[2], anchored: true }] },
  { id, position: at },
]

/** Holes through the sheets of a ring of targets `distance` metres from the grenade, summed over `seeds` worlds (one world per seed). */
const holesAt = (distance: number, seeds: number[]): number => {
  let holes = 0
  for (const seed of seeds) {
    const world = createDestruction({ seed })
    const ids: string[] = []
    // 12 sheets round the charge, each facing it
    for (let k = 0; k < 12; k++) {
      const angle = (k / 12) * Math.PI * 2
      const [spec, opts] = target(`s${k}`, [Math.cos(angle) * distance, 1, Math.sin(angle) * distance])
      ids.push(world.add({ parts: [{ ...spec.parts[0]!, rotation: [0, Math.PI / 2 - angle, 0] }] }, opts))
    }
    world.explode(ORIGIN, m67.energy, 15, 'test', { charge: GRENADE })
    for (const id of ids) holes += world.part(id, 'sheet')!.holes.length
  }
  return holes
}

describe('the case of a charge', () => {
  it('breaks into fragments by Mott: the masses drawn add up to the case, the heaviest is a few grams', () => {
    const { mottScale } = casingFlight(m67.casing!)
    expect(mottScale).toBeCloseTo(0.19 / 2000, 9)
    let total = 0
    let heaviest = 0
    const count = 20000
    for (let i = 0; i < count; i++) {
      const mass = mottMass((i + 0.5) / count, mottScale, m67.casing!.fragments)
      total += mass
      heaviest = Math.max(heaviest, mass)
    }
    // 20000 draws of a 1000-piece case: the mean piece is 2 mu, so a thousand pieces weigh the case
    expect((total / count) * m67.casing!.fragments).toBeGreaterThan(0.19 * 0.8)
    expect((total / count) * m67.casing!.fragments).toBeLessThan(0.19 * 1.05)
    expect(heaviest).toBeGreaterThan(0.002)
    expect(heaviest).toBeLessThan(0.01)
  })

  it('leaves the M67 at about 2.1 km/s (Gurney, sphere: 2700 / sqrt(M/C + 3/5)) and a piece slows with the air', () => {
    const { speed } = casingFlight(m67.casing!)
    expect(speed).toBeGreaterThan(2000)
    expect(speed).toBeLessThan(2200)
    // a 0.2 g piece loses about a fifth of its speed in 5 m and a 5 g piece much less
    expect(Math.exp(-fragmentDrag(0.0002) * 5)).toBeGreaterThan(0.7)
    expect(Math.exp(-fragmentDrag(0.0002) * 5)).toBeLessThan(0.9)
    expect(fragmentDrag(0.005)).toBeLessThan(fragmentDrag(0.0002) / 2)
  })

  it('is the same every time for a seed, and not for another', () => {
    const run = (seed: number) => {
      const world = createDestruction({ seed })
      const [spec, opts] = target('sheet', [1, 1, 0])
      world.add(spec, opts)
      return JSON.stringify(world.explode(ORIGIN, m67.energy, 15, 'test', { charge: GRENADE }).map((r) => r.events.filter((e) => e.type === 'hole')))
    }
    expect(run(3)).toBe(run(3))
  })
})

describe('fragments of a grenade', () => {
  it('hole a steel sheet 1 m away and fewer 3 m away, and far fewer 8 m away: they spread over the sphere (1/d^2) and slow in the air', () => {
    const seeds = [1, 2, 3]
    const near = holesAt(1, seeds)
    const mid = holesAt(3, seeds)
    const far = holesAt(8, seeds)
    expect(near).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(far)
    expect(near).toBeGreaterThan(0)
  })

  it('stop at a block wall: the sheet behind it is holed in the open and not behind 30 cm of concrete, and the wave on it is cut', () => {
    const scene = (withWall: boolean) => {
      const world = createDestruction({ seed: 2 })
      const wall = world.add({ parts: [{ id: 'wall', material: 'concrete', shape: { kind: 'box', size: [3, 3, 0.3] }, position: [0, 0, 0], anchored: true }] }, { id: 'wall', position: [0, 1.5, 1.5 + (withWall ? 0 : 50)] })
      const behind = world.add({ parts: [{ id: 'sheet', material: 'steel', shape: { kind: 'box', size: [1, 1, 0.003] }, position: [0, 0, 0], thickness: 0.003, anchored: true }] }, { id: 'behind', position: [0, 1, 3] })
      const results = world.explode(ORIGIN, m67.energy, 15, 'test', { charge: GRENADE, shelter: true })
      return { holes: world.part(behind, 'sheet')!.holes.length, shelter: results.find((r) => r.object === 'behind')?.blast?.shelter ?? 1, wall: world.part(wall, 'wall')! }
    }
    const open = scene(false)
    const shielded = scene(true)
    expect(open.holes).toBeGreaterThan(0)
    expect(shielded.holes).toBe(0)
    expect(shielded.shelter).toBeLessThan(0.1)
    expect(shielded.wall.holes.length + shielded.wall.dents.length).toBeGreaterThan(0)
  })

  it('cast no more rays than the charge allows', () => {
    const world = createDestruction({ seed: 2 })
    for (let k = 0; k < 30; k++) world.add({ parts: [{ id: 'sheet', material: 'steel', shape: { kind: 'box', size: [1, 1, 0.003] }, position: [0, 0, 0], anchored: true }] }, { id: `t${k}`, position: [(k % 6) - 3, 1 + Math.floor(k / 6) * 0.2, 1 + Math.floor(k / 6)] })
    const results = world.explode(ORIGIN, m67.energy, 15, 'test', { charge: { ...GRENADE, maxRays: 12 } })
    const holes = results.flatMap((r) => r.events).filter((e) => e.type === 'hole').length
    expect(holes).toBeLessThanOrEqual(12 * 4)
  })
})

describe('the wave of a grenade', () => {
  it('falls with distance (Hopkinson-Cranz): the same sheet takes less work and less pressure the farther it stands', () => {
    const at = (distance: number) => waveWork({ tnt: 0.24, distance, reach: 1, area: 0.09, mass: 0.2, thickness: 0.003 })
    expect(at(1).energy).toBeGreaterThan(at(2).energy)
    expect(at(2).energy).toBeGreaterThan(at(4).energy)
    expect(reflectedLoad(0.24, 1).pressure).toBeGreaterThan(reflectedLoad(0.24, 3).pressure)
    // Hopkinson-Cranz: 8 times the charge at twice the distance is the same scaled distance, with the same pressure and twice the impulse (the cube root of 8)
    expect(reflectedLoad(1.92, 2).pressure / reflectedLoad(0.24, 1).pressure).toBeCloseTo(1, 6)
    expect(reflectedLoad(1.92, 2).impulse / reflectedLoad(0.24, 1).impulse).toBeCloseTo(2, 6)
  })
})

describe('the wave on a part given as the box of its slope', () => {
  it('loads the solid share of the box: a 181 kg rafter in its 0.08 x 3.18 x 5.7 m box 2 m from a grenade keeps its bolts', () => {
    // 181 kg of softwood (500 kg/m3) is 0.36 m3 in a 1.45 m3 box: the wave meets a quarter of the 18 m2 the box shows. With 86 Pa s reflected at 2 m, over the
    // whole box (14.5 m2 loaded, a disc as wide as the standoff) J^2 / 2m = (86 x 14.5)^2 / 362 = 5.3 kJ go into the rafter and tear its bolt; over the wood,
    // 4.5 m2, it is 0.41 kJ, and the joint keeps it
    const world = createDestruction({ seed: 1 })
    const id = world.add({
      parts: [
        { id: 'plate', material: 'concrete', shape: { kind: 'box', size: [6, 0.3, 0.3] }, position: [0, 2.5, 3], anchored: true },
        { id: 'rafter', material: 'wood_soft', shape: { kind: 'box', size: [0.08, 3.18, 5.7] }, position: [0, 4.1, 0], mass: 181 },
      ],
      joints: [{ id: 'rafter~plate', a: 'rafter', b: 'plate', kind: 'bolt' }],
    })
    world.explode([2, 3, 0], m67.energy, 15, 'test', { charge: { tnt: m67.tnt! } })
    expect(world.state(id)!.joints.find((joint) => joint.id === 'rafter~plate')!.open).toBe(false)
  })
})
