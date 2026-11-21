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

  it('a piece that stands for four goes through what it would alone: the same holes and dents where it lands, with the same exits', () => {
    const marksOf = (maxRays: number) => {
      const world = createDestruction({ seed: 5 })
      objectRoom(world, { half: 3, split: 6, material: 'steel', thickness: 0.025 })
      const marks = world.explode(ORIGIN, 1, 15, 'test', { charge: caseOnly(PIPE_BOMB, maxRays) }).flatMap((result) => result.events).filter((event) => event.type === 'hole' || event.type === 'dent')
      return new Map(marks.map((event) => [`${event.object}|${(event as { worldPoint: Vec3 }).worldPoint.join(',')}`, JSON.stringify([event.type, (event as { exitPoint?: Vec3 }).exitPoint ?? null])]))
    }
    // 60 pieces in the room, 15 cast: each stands for four. 25 mm of steel holds some 2.7 kJ, the energy of a heavy piece: some go through (a hole) and some stay (a
    // dent), so a weight that leaked into the energy of the round would turn some dents into holes
    const weighted = marksOf(15)
    const alone = marksOf(60)
    const kinds = [...weighted.values()].map((mark) => (JSON.parse(mark) as [string])[0])
    expect(kinds).toContain('hole')
    expect(kinds).toContain('dent')
    for (const [where, mark] of weighted) expect({ where, mark: alone.get(where) }).toEqual({ where, mark })
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

  it('over the cap the weighted path is what it is: the event stream of an M67 in a closed brick room, pinned', () => {
    const world = createDestruction({ seed: 2 })
    objectRoom(world, { half: 3, split: 3, material: 'brick', thickness: 0.2 })
    const events = world.explode(ORIGIN, M67.energy, 15, 'test', { charge: M67.charge }).map((result) => result.events)
    expect(hashOf(JSON.stringify(events))).toBe('7a32aad62c84c')
  })

  it('under the cap nothing is weighted: the event stream of a pipe bomb in a closed room, pinned (the weights never reach it; it changed once, when the drawn masses were scaled to the case both ways)', () => {
    const world = createDestruction({ seed: 2 })
    objectRoom(world, { half: 3, split: 3, material: 'brick', thickness: 0.2 })
    const events = world.explode(ORIGIN, PIPE_BOMB.energy, 10, 'test', { charge: PIPE_BOMB.charge }).map((result) => result.events)
    expect(hashOf(JSON.stringify(events))).toBe('898ce0ab96724')
  })
})

/** The world's hit points per joule of a round (`DMG_PER_J` in `world.ts`): concrete takes a stopped round's whole energy at this rate. */
const DAMAGE_PER_JOULE = 0.02
const SEEDS_20 = Array.from({ length: 20 }, (_, index) => index + 1)

describe('a car in a room past the cap', () => {
  const { speed } = casingFlight(M67.charge.casing!)
  const budget = 0.5 * M67.charge.casing!.mass * speed * speed
  // a car-sized body 2 m from the charge in a closed concrete room: some 60 pieces fly at the car, the other 940 at the room
  const CAR = { centre: [2, 0, 0] as Vec3, size: [0.6, 1.2, 1.6] as Vec3 }
  const throwIn = (seed: number, maxRays?: number) => {
    const world = createDestruction({ seed })
    objectRoom(world, { half: 3, split: 3, material: 'concrete', thickness: 0.3 })
    const car = witness('car', [panel('p', CAR.size, [0, 0, 0])], CAR.centre)
    world.register(car.impl, { position: car.position })
    const damage = world.explode(ORIGIN, 1, 15, 'test', { charge: caseOnly(M67, maxRays) }).reduce((sum, result) => sum + result.damage, 0)
    return { damage, carHits: car.fragments().length }
  }

  it('the car takes its own pieces, the room on average the damage of all of its, and no throw puts more than twice the case energy into the room', () => {
    const pieces = M67.charge.casing!.fragments
    const share = shareOfBoxes(ORIGIN, [CAR], evenDirections(200_000))
    const sigma = Math.sqrt(pieces * share * (1 - share))
    let capped = 0
    let all = 0
    for (const seed of SEEDS_20) {
      const run = throwIn(seed)
      expect(Math.abs(run.carHits - pieces * share), `seed ${seed}`).toBeLessThan(4 * sigma)
      // the room's weighted damage, as energy: one throw may draw heavy pieces among the weighted ones, but never more than twice the case
      expect(run.damage / DAMAGE_PER_JOULE, `seed ${seed}`).toBeLessThan(2 * budget)
      capped += run.damage
      all += throwIn(seed, pieces).damage
    }
    expect(all).toBeGreaterThan(0)
    expect(Math.abs(capped - all) / all).toBeLessThan(0.1)
  })

  it('a ray never stands for more than eight pieces: with a cap of 12 the room takes some 8 x 12 of its 1000 pieces, not all of them', () => {
    let capped = 0
    let all = 0
    for (const seed of SEEDS_20) {
      capped += throwIn(seed, 12).damage
      all += throwIn(seed, 1000).damage
    }
    // 12 rays (the car's dozen pieces get at most half the cap) each standing for at most 8: under a tenth of the room's 940 pieces, never all of them
    expect(capped / all).toBeLessThan(0.15)
    expect(capped).toBeGreaterThan(0)
  })

  it('a car right beside the charge gets half the cap, and the other half is kept for the room', () => {
    // a 4 m long single-part car 0.8 m off: its sphere holds the charge, its box takes a quarter of the sphere, some 250 pieces. A body part is tested as its box, so
    // those are the car's pieces; past the cap the room keeps half of it, and the car's 128 rays all land on it
    const CLOSE = { centre: [0.8, 0, 0] as Vec3, size: [0.6, 1.4, 4] as Vec3 }
    expect(shareOfBoxes(ORIGIN, [CLOSE], evenDirections(200_000)) * M67.charge.casing!.fragments).toBeGreaterThan(128)
    for (const seed of [1, 2, 3, 4]) {
      const world = createDestruction({ seed })
      objectRoom(world, { half: 3, split: 3, material: 'concrete', thickness: 0.3 })
      const car = witness('car', [panel('p', CLOSE.size, [0, 0, 0])], CLOSE.centre)
      world.register(car.impl, { position: car.position })
      const damage = world.explode(ORIGIN, 1, 15, 'test', { charge: caseOnly(M67) }).reduce((sum, result) => sum + result.damage, 0)
      expect(car.fragments().length, `seed ${seed}`).toBeLessThanOrEqual(128)
      expect(car.fragments().length, `seed ${seed}`).toBeGreaterThanOrEqual(124)
      expect(damage).toBeGreaterThan(0)
    }
  })
})
