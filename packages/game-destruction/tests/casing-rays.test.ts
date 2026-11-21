import { createArsenal } from '@adatechnology/game-weapons'
import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'
import { FRAGMENT_MIN_SPEED, casingFlight, fragmentDrag } from '../src/blast-wave'
import type { BlastCharge, DestructibleImpl, Hit, PartSpec, Vec3 } from '../src'

const arsenal = createArsenal()
const chargeOf = (id: string): { energy: number; charge: BlastCharge } => {
  const explosive = arsenal.explosives.get(id)!
  return { energy: explosive.energy, charge: { tnt: explosive.tnt!, casing: explosive.casing! } }
}
const M67 = chargeOf('m67')
const PIPE_BOMB = chargeOf('pipe_bomb')
const ORIGIN: Vec3 = [0, 0, 0]
const STEEL_DENSITY = 7850
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]

/** A hosted body that keeps every hit it takes and stops every round (it reports no hole): each fragment that reaches it is one hit. */
const witness = (id: string, parts: readonly PartSpec[], position: Vec3 = [0, 0, 0]) => {
  const hits: Hit[] = []
  const impl: DestructibleImpl = {
    id,
    describe: () => ({ parts: [...parts] }),
    hit(h) {
      hits.push(h)
      return []
    },
    state: () => ({ id, parts: [], joints: [], groups: [], destroyed: false }) as never,
  }
  return { impl, position, fragments: () => hits.filter((h) => h.type === 'ballistic') }
}

const panel = (id: string, size: Vec3, position: Vec3): PartSpec => ({ id, material: 'concrete', shape: { kind: 'box', size }, position })

/** A closed box room round the charge, each face a hosted body of `split x split` panels: every direction meets a panel, so every fragment cast is one hit. */
const closedRoom = (half: number, split: number) => {
  const bodies: ReturnType<typeof witness>[] = []
  const step = (2 * half) / split
  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [-1, 1]) {
      for (let i = 0; i < split; i++) {
        for (let j = 0; j < split; j++) {
          const at: Vec3 = [0, 0, 0]
          const size: Vec3 = [step, step, step]
          at[axis] = sign * (half + 0.1)
          size[axis] = 0.2
          at[(axis + 1) % 3] = -half + step * (i + 0.5)
          at[(axis + 2) % 3] = -half + step * (j + 0.5)
          bodies.push(witness(`w${axis}${sign}-${i}-${j}`, [panel('p', size, [0, 0, 0])], at))
        }
      }
    }
  }
  return bodies
}

const fragmentsInRoom = (seed: number, strike: { energy: number; charge: BlastCharge }, split = 1): Hit[] => {
  const world = createDestruction({ seed })
  const bodies = closedRoom(3, split)
  for (const body of bodies) world.register(body.impl, { position: body.position })
  world.explode(ORIGIN, strike.energy, 15, 'test', { charge: strike.charge })
  return bodies.flatMap((body) => body.fragments())
}

/** The mass of the steel sphere of the hole's calibre (the inverse of `fragmentCaliberMm`). */
const massOfCaliber = (caliberMm: number): number => ((4 / 3) * Math.PI * (caliberMm / 2000) ** 3) * STEEL_DENSITY

const rangeOf = (mass: number, speed: number): number => Math.log(speed / FRAGMENT_MIN_SPEED) / fragmentDrag(mass)

describe('the rays of a case', () => {
  it('a case never throws more pieces than it has: the pipe bomb (60 pieces) casts at most 60 in a closed room', () => {
    for (const seed of SEEDS) expect(fragmentsInRoom(seed, PIPE_BOMB).length).toBeLessThanOrEqual(PIPE_BOMB.charge.casing!.fragments)
  })

  it('the M67 casts at most the default cap of 256 in a closed room of many panels', () => {
    for (const seed of SEEDS) expect(fragmentsInRoom(seed, M67, 3).length).toBeLessThanOrEqual(256)
  })

  it('the cap holds after rounding: never more rays than `maxRays`, however many targets share them', () => {
    for (const seed of SEEDS) {
      for (const maxRays of [5, 13, 40]) {
        const hits = fragmentsInRoom(seed, { energy: M67.energy, charge: { ...M67.charge, maxRays } }, 3)
        expect({ seed, maxRays, rays: hits.length }).toEqual({ seed, maxRays, rays: Math.min(hits.length, maxRays) })
      }
    }
  })

  it('the pieces carry no more energy than the case was given (half its mass times the square of its first speed)', () => {
    for (const strike of [PIPE_BOMB, M67]) {
      const { speed } = casingFlight(strike.charge.casing!)
      const budget = 0.5 * strike.charge.casing!.mass * speed * speed
      for (const seed of SEEDS) {
        const delivered = fragmentsInRoom(seed, strike).reduce((sum, hit) => sum + (hit.energy ?? 0), 0)
        expect(delivered).toBeGreaterThan(0)
        // all of a closed room's pieces can land: then the sum is the budget itself, up to the rounding of a float sum
        expect(delivered).toBeLessThanOrEqual(budget * (1 + 1e-12))
      }
    }
  })
})

describe('a piece of the case slows in the air', () => {
  it('reaches a part with the energy the drag leaves after the distance it flew (exp(-2 k d)), near and far', () => {
    const { speed } = casingFlight(M67.charge.casing!)
    const world = createDestruction({ seed: 4 })
    const near = witness('near', [panel('p', [2, 2, 0.2], [0, 0, 0])], [0, 0, 1.5])
    const far = witness('far', [panel('p', [16, 16, 0.2], [0, 0, 0])], [0, 0, -12])
    world.register(near.impl, { position: near.position })
    world.register(far.impl, { position: far.position })
    world.explode(ORIGIN, M67.energy, 15, 'test', { charge: M67.charge })
    const ratios = (hits: Hit[]) => hits.map((hit) => {
      const mass = massOfCaliber(hit.caliber!)
      const distance = Math.hypot(hit.point[0] - ORIGIN[0], hit.point[1] - ORIGIN[1], hit.point[2] - ORIGIN[2])
      return { ratio: hit.energy! / (0.5 * mass * speed * speed), drag: Math.exp(-2 * fragmentDrag(mass) * distance) }
    })
    const nearHits = ratios(near.fragments())
    const farHits = ratios(far.fragments())
    expect(nearHits.length).toBeGreaterThan(0)
    expect(farHits.length).toBeGreaterThan(0)
    for (const { ratio, drag } of [...nearHits, ...farHits]) expect(ratio).toBeCloseTo(drag, 6)
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
    expect(mean(farHits.map((hit) => hit.ratio))).toBeLessThan(mean(nearHits.map((hit) => hit.ratio)))
  })

  it('has a finite range: no piece lands past the distance where it falls under the speed that does anything, and a wall far past every range takes none', () => {
    const { speed } = casingFlight(M67.charge.casing!)
    for (const seed of SEEDS) {
      const world = createDestruction({ seed })
      // a thin pole near the charge: most pieces cast at its bounding sphere miss it and fly on, towards a huge wall 600 m away, past the reach of the heaviest piece
      const pole = witness('pole', [panel('p', [0.02, 3, 0.02], [0, 0, 0])], [2, 0, 0])
      const wall = witness('wall', [panel('p', [0.5, 400, 400], [0, 0, 0])], [600, 0, 0])
      world.register(pole.impl, { position: pole.position })
      world.register(wall.impl, { position: wall.position })
      world.explode(ORIGIN, M67.energy, 15, 'test', { charge: M67.charge })
      expect(wall.fragments()).toHaveLength(0)
      for (const hit of pole.fragments()) {
        const distance = Math.hypot(hit.point[0], hit.point[1], hit.point[2])
        expect(distance).toBeLessThan(rangeOf(massOfCaliber(hit.caliber!), speed))
      }
    }
  })
})

describe('the pieces of a case are seeded', () => {
  it('the same seed throws the same pieces: the same event stream twice', () => {
    const run = (): string => {
      const world = createDestruction({ seed: 9 })
      world.add({ parts: [{ id: 'sheet', material: 'steel', shape: { kind: 'box', size: [2, 2, 0.003] }, position: [0, 0, 0], thickness: 0.003, anchored: true }] }, { id: 'sheet', position: [0, 1, 2] })
      world.add({ parts: [{ id: 'wall', material: 'brick', shape: { kind: 'box', size: [4, 3, 0.2] }, position: [0, 0, 0], anchored: true }] }, { id: 'wall', position: [0, 1.5, -3] })
      const results = world.explode([0, 1, 0], PIPE_BOMB.energy, 10, 'test', { charge: PIPE_BOMB.charge })
      return JSON.stringify(results.map((result) => result.events))
    }
    const first = run()
    expect(first.length).toBeGreaterThan(100)
    expect(run()).toBe(first)
  })
})

/** `count` directions spread evenly over the sphere (Fibonacci lattice): a deterministic way to measure the share of the sphere a set of shapes covers. */
const evenDirections = (count: number): Vec3[] => {
  const golden = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / count
    const ring = Math.sqrt(1 - y * y)
    return [Math.cos(golden * i) * ring, y, Math.sin(golden * i) * ring] as Vec3
  })
}

/** The share of the directions from `from` whose line meets one of the axis-aligned `boxes` (slab test). */
const shareOfBoxes = (from: Vec3, boxes: readonly { centre: Vec3; size: Vec3 }[], directions: readonly Vec3[]): number => {
  const meets = (d: Vec3) => boxes.some(({ centre, size }) => {
    let near = 0
    let far = Infinity
    for (let k = 0; k < 3; k++) {
      const lo = centre[k]! - size[k]! / 2 - from[k]!
      const hi = centre[k]! + size[k]! / 2 - from[k]!
      if (Math.abs(d[k]!) < 1e-12) {
        if (lo > 0 || hi < 0) return false
        continue
      }
      const a = lo / d[k]!, b = hi / d[k]!
      near = Math.max(near, Math.min(a, b))
      far = Math.min(far, Math.max(a, b))
    }
    return near <= far
  })
  return directions.filter(meets).length / directions.length
}

describe('a hosted body is aimed at part by part', () => {
  // a long body of four 2 m sections, its side 3 m from the charge: the sphere round the whole body (radius 4.2 m) holds the charge, the sphere of each section does not
  const SECTIONS = [-3, -1, 1, 3].map((z) => ({ centre: [3.9, 0.75, z] as Vec3, size: [1.8, 1.5, 2] as Vec3 }))
  const longBody = () => witness('long', SECTIONS.map((section, index) => panel(`s${index}`, section.size, section.centre)))

  it('takes the pieces its own parts cover from the charge, not a cut share of every piece of the case', () => {
    const pieces = M67.charge.casing!.fragments
    const share = shareOfBoxes([0, 0.75, 0], SECTIONS, evenDirections(200_000))
    const expected = pieces * share
    const sigma = Math.sqrt(pieces * share * (1 - share))
    const counts = SEEDS.map((seed) => {
      const world = createDestruction({ seed })
      const body = longBody()
      world.register(body.impl)
      world.explode([0, 0.75, 0], M67.energy, 15, 'test', { charge: M67.charge })
      return body.fragments().length
    })
    for (const count of counts) expect(Math.abs(count - expected)).toBeLessThan(4 * sigma)
    const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length
    expect(Math.abs(mean - expected)).toBeLessThan((4 * sigma) / Math.sqrt(counts.length))
  })
})

/** cyrb53: a 53-bit hash of a string, to pin an event stream. */
const hashOf = (text: string): string => {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}

/** A closed box room of world objects round the charge (`split x split` panels a face): more pieces qualify than the cap casts. */
const objectRoom = (world: ReturnType<typeof createDestruction>, options: { half: number; split: number; material: string; thickness: number }): string[] => {
  const ids: string[] = []
  const step = (2 * options.half) / options.split
  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [-1, 1]) {
      for (let i = 0; i < options.split; i++) {
        for (let j = 0; j < options.split; j++) {
          const at: Vec3 = [0, 0, 0]
          const size: Vec3 = [step, step, step]
          at[axis] = sign * (options.half + options.thickness / 2)
          size[axis] = options.thickness
          at[(axis + 1) % 3] = -options.half + step * (i + 0.5)
          at[(axis + 2) % 3] = -options.half + step * (j + 0.5)
          ids.push(world.add({ parts: [{ id: 'p', material: options.material, shape: { kind: 'box', size }, position: [0, 0, 0], thickness: options.thickness, anchored: true }] }, { id: `o${axis}${sign}-${i}-${j}`, position: at }))
        }
      }
    }
  }
  return ids
}

/** The case alone: a charge of no wave (1 J, a microgram of TNT), so what the room takes is what the pieces bring. */
const caseOnly = (strike: { charge: BlastCharge }, maxRays?: number): BlastCharge => ({ tnt: 1e-9, casing: strike.charge.casing!, ...(maxRays !== undefined ? { maxRays } : {}) })

describe('pieces past the cap stand for the ones left out', () => {
  const damageInRoom = (seed: number, maxRays: number): number => {
    const world = createDestruction({ seed })
    objectRoom(world, { half: 3, split: 3, material: 'concrete', thickness: 0.3 })
    return world.explode(ORIGIN, 1, 15, 'test', { charge: caseOnly(M67, maxRays) }).reduce((sum, result) => sum + result.damage, 0)
  }

  it('the damage of a closed room with the cap of 256 is the damage of all its pieces, on average over 20 throws (within 10%)', () => {
    const seeds = Array.from({ length: 20 }, (_, index) => index + 1)
    const mean = (maxRays: number) => seeds.reduce((sum, seed) => sum + damageInRoom(seed, maxRays), 0) / seeds.length
    const capped = mean(256)
    const all = mean(1000)
    expect(all).toBeGreaterThan(0)
    expect(Math.abs(capped - all) / all).toBeLessThan(0.1)
  })

  it('a piece that stands for four goes through what it would alone: the same holes, through or not, with the same exits', () => {
    const holesOf = (maxRays: number) => {
      const world = createDestruction({ seed: 5 })
      objectRoom(world, { half: 3, split: 6, material: 'steel', thickness: 0.002 })
      const holes = world.explode(ORIGIN, 1, 15, 'test', { charge: caseOnly(PIPE_BOMB, maxRays) }).flatMap((result) => result.events).filter((event) => event.type === 'hole')
      return new Map(holes.map((event) => [`${event.object}|${(event as { worldPoint: Vec3 }).worldPoint.join(',')}`, JSON.stringify([(event as { hole: { through: boolean } }).hole.through, (event as { exitPoint?: Vec3 }).exitPoint ?? null])]))
    }
    // 60 pieces in the room, 15 cast: each stands for four
    const weighted = holesOf(15)
    const alone = holesOf(60)
    expect(weighted.size).toBeGreaterThan(0)
    for (const [where, hole] of weighted) expect({ where, hole: alone.get(where) }).toEqual({ where, hole })
  })

  it('a hosted body takes every piece that flies at it, however many the cap leaves out round it', () => {
    const hitsOnBody = (maxRays: number) => {
      const world = createDestruction({ seed: 3 })
      objectRoom(world, { half: 3, split: 3, material: 'concrete', thickness: 0.3 })
      const body = witness('body', [panel('p', [1, 1.6, 0.4], [0, 0, 0])], [1.5, 0, 0])
      world.register(body.impl, { position: body.position })
      world.explode(ORIGIN, 1, 15, 'test', { charge: caseOnly(M67, maxRays) })
      return body.fragments().map((hit) => JSON.stringify([hit.point, hit.energy, hit.caliber]))
    }
    expect(hitsOnBody(256)).toEqual(hitsOnBody(1000))
  })

  it('never casts more than the cap, weighted or not', () => {
    for (const seed of SEEDS) expect(fragmentsInRoom(seed, { energy: M67.energy, charge: { ...M67.charge, maxRays: 40 } }, 3).length).toBeLessThanOrEqual(40)
  })

  it('under the cap nothing is weighted: the event stream of a pipe bomb in a closed room is the one before the weights', () => {
    const world = createDestruction({ seed: 2 })
    objectRoom(world, { half: 3, split: 3, material: 'steel', thickness: 0.004 })
    const events = world.explode(ORIGIN, PIPE_BOMB.energy, 10, 'test', { charge: PIPE_BOMB.charge }).map((result) => result.events)
    expect(hashOf(JSON.stringify(events))).toBe('11cf3a2ddf9b7')
  })
})
