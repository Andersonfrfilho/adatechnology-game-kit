import { describe, expect, it } from 'vitest'
import { createTerrain } from '../src'

const BOUNDS = [-10, -10, 10, 10] as const
const make = (surface: string, budget = {}) => createTerrain({ bounds: BOUNDS, layout: { surface }, budget })
const GRENADE = 800_000
const PISTOL = 500

const settle = (terrain: ReturnType<typeof make>, seconds = 6): void => {
  for (let t = 0; t < seconds; t += 1 / 60) terrain.update(1 / 60)
}

describe('digging by strata', () => {
  it('a grenade digs a real crater in soil and only spalls a slab', () => {
    const soil = make('dirt')
    const slab = make('concrete_slab')
    const a = soil.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    const b = slab.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    expect(a.depth).toBeGreaterThan(0.2)
    expect(a.radius).toBeGreaterThan(0.45)
    expect(b.depth).toBeLessThan(0.03)
    expect(soil.heightAt(0, 0)).toBeLessThan(slab.heightAt(0, 0))
  })

  it('never goes through a slab, however many blows', () => {
    const slab = make('concrete_slab')
    for (let i = 0; i < 400; i++) slab.strike('explosive', { x: 0, z: 0, energy: GRENADE * 4 })
    expect(slab.heightAt(0, 0)).toBeGreaterThanOrEqual(-0.12 - 1e-4)
    const column = slab.columnAt(0, 0)
    expect(column.remaining).toBeLessThan(1e-3)
    expect(slab.strike('explosive', { x: 0, z: 0, energy: GRENADE }).atLimit).toBe(true)
  })

  it('exposes the rebar past the cover and the bars slow the digging', () => {
    const slab = make('concrete_slab')
    let first = 0
    let result = slab.strike('explosive', { x: 0, z: 0, energy: GRENADE * 6 })
    first = result.depth
    expect(result.rebarExposed).toBe(first >= 0.03)
    while (!result.rebarExposed) result = slab.strike('explosive', { x: 0, z: 0, energy: GRENADE * 6 })
    const past = slab.strike('explosive', { x: 0, z: 0, energy: GRENADE * 6 })
    expect(past.depth).toBeLessThan(0.03)
    expect(past.exposed).toBe('concrete')
  })

  it('lawn: turf first, soil next, and rock is the end', () => {
    const lawn = make('lawn')
    const first = lawn.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    expect(first.removed.map((entry) => entry.material)).toEqual(['turf', 'soil'])
    expect(first.exposed).toBe('soil')
    for (let i = 0; i < 60; i++) lawn.strike('explosive', { x: 0, z: 0, energy: GRENADE * 3 })
    expect(lawn.columnAt(0, 0).material).toBe('stone')
    expect(lawn.heightAt(0, 0)).toBeGreaterThanOrEqual(-2.05 - 1e-4)
  })

  it('tile comes off exposing the mortar, then the slab; asphalt exposes the gravel', () => {
    const tile = make('tile_floor')
    const shot = tile.strike('ballistic', { x: 1, z: 1, energy: 3400 })
    expect(shot.radius).toBeGreaterThanOrEqual(0.05)
    expect(shot.removed[0]!.material).toBe('ceramic')
    expect(shot.exposed).toBe('mortar')
    const road = make('road')
    const blast = road.strike('explosive', { x: 0, z: 0, energy: GRENADE * 12 })
    expect(blast.removed.map((entry) => entry.material)).toContain('gravel')
  })

  it('a punch does nothing to concrete but dents soil', () => {
    expect(make('concrete_slab').strike('blunt', { x: 0, z: 0, energy: 100 }).radius).toBe(0)
    expect(make('dirt').strike('blunt', { x: 0, z: 0, energy: 100 }).radius).toBeGreaterThan(0)
  })

  it('a bigger round makes a bigger mark at the exact point', () => {
    const results = [PISTOL, 1700, 3400, 18000].map((energy) => make('concrete_slab').strike('ballistic', { x: 2, z: -3, energy }))
    for (let i = 1; i < results.length; i++) expect(results[i]!.radius).toBeGreaterThan(results[i - 1]!.radius)
    const terrain = make('concrete_slab')
    terrain.strike('ballistic', { x: 2, z: -3, energy: PISTOL })
    expect(terrain.marks()[0]).toMatchObject({ x: 2, z: -3 })
  })
})

describe('repeated blows', () => {
  it('the same point goes deeper, one stage at a time, up to the limit', () => {
    const terrain = make('dirt')
    const depths: number[] = []
    for (let i = 0; i < 80; i++) {
      terrain.strike('explosive', { x: 0, z: 0, energy: GRENADE })
      depths.push(terrain.columnAt(0, 0).depth)
    }
    expect(depths[1]!).toBeGreaterThan(depths[0]!)
    expect(depths[10]!).toBeGreaterThan(depths[1]!)
    expect(Math.max(...depths)).toBeLessThanOrEqual(2.3 + 1e-4)
  })

  it('pocks merge into one mark that grows and is dug into the height field', () => {
    const terrain = make('concrete_slab')
    for (let i = 0; i < 3; i++) terrain.strike('ballistic', { x: 0, z: 0, energy: PISTOL })
    expect(terrain.marks()).toHaveLength(1)
    expect(terrain.marks()[0]!.count).toBe(3)
    for (let i = 0; i < 300; i++) terrain.strike('ballistic', { x: 0, z: 0, energy: PISTOL })
    expect(terrain.heightAt(0, 0)).toBeLessThan(0)
    expect(terrain.heightAt(0, 0)).toBeGreaterThanOrEqual(-0.12 - 1e-4)
  })
})

describe('budget', () => {
  it('keeps the marks of an area under its limit by merging', () => {
    const terrain = make('concrete_slab', { maxMarksPerArea: 8 })
    for (let i = 0; i < 60; i++) terrain.strike('ballistic', { x: 0.1 + (i % 10) * 0.17, z: 0.1 + Math.floor(i / 10) * 0.28, energy: PISTOL })
    expect(terrain.marks().length).toBeLessThanOrEqual(8)
    expect(terrain.marks().reduce((sum, mark) => sum + mark.count, 0)).toBeGreaterThan(8)
  })

  it('past the global limit the oldest mark goes', () => {
    const terrain = make('concrete_slab', { maxMarks: 10 })
    for (let i = 0; i < 40; i++) terrain.strike('ballistic', { x: -9 + i * 0.45, z: 0, energy: PISTOL })
    expect(terrain.marks().length).toBeLessThanOrEqual(10)
    expect(Math.min(...terrain.marks().map((mark) => mark.x))).toBeGreaterThan(-9)
  })

  it('redraws only the budget of chunks per frame', () => {
    const terrain = make('dirt', { maxDirtyChunksPerFrame: 2 })
    terrain.drainDirtyChunks(1e6)
    terrain.strike('explosive', { x: 0, z: 0, energy: GRENADE * 40 })
    expect(terrain.drainDirtyChunks().length).toBe(2)
    expect(terrain.stats().dirtyChunks).toBeGreaterThan(0)
  })

  it('thrown pieces stay under the limit', () => {
    const terrain = make('concrete_slab', { maxDebris: 30 })
    for (let i = 0; i < 30; i++) terrain.strike('explosive', { x: i * 0.5 - 7, z: 0, energy: GRENADE })
    expect(terrain.debris().length).toBeLessThanOrEqual(30)
  })
})

describe('what is thrown and the rim', () => {
  it('soil heaps a rim and the clods land and join the ground; nothing is created', () => {
    const terrain = make('dirt')
    const result = terrain.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    expect(terrain.heightAt(result.radius * 1.2, 0)).toBeGreaterThan(0)
    expect(terrain.debris().length).toBeGreaterThan(4)
    settle(terrain)
    expect(terrain.stats().debrisMoving).toBe(0)
    expect(terrain.debris().filter((piece) => piece.material === 'soil')).toHaveLength(0)
    let added = 0
    terrain.loose.forEach((value) => {
      added += value
    })
    let taken = 0
    terrain.dug.forEach((value) => {
      taken += value
    })
    expect(added).toBeGreaterThan(0)
    expect(added).toBeLessThanOrEqual(taken * 1.05)
  })

  it('concrete has no rim: its chips stay as rubble on the ground', () => {
    const terrain = make('concrete_slab')
    terrain.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    settle(terrain)
    const pieces = terrain.debris()
    expect(pieces.length).toBeGreaterThan(0)
    expect(pieces.every((piece) => piece.atRest)).toBe(true)
    let heaped = 0
    terrain.loose.forEach((value) => {
      heaped += value
    })
    expect(heaped).toBe(0)
    for (const piece of pieces) expect(piece.position[1]).toBeGreaterThanOrEqual(terrain.heightAt(piece.position[0], piece.position[2]) - 1e-3)
  })

  it('a sand crater slides back to the slope sand holds', () => {
    const terrain = make('sand')
    terrain.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    settle(terrain, 8)
    const limit = Math.tan((34 * Math.PI) / 180)
    let steepest = 0
    for (let x = -1.5; x <= 1.5; x += 0.1) steepest = Math.max(steepest, Math.abs(terrain.heightAt(x + 0.1, 0) - terrain.heightAt(x, 0)) / 0.1)
    expect(steepest).toBeLessThan(limit + 0.25)
  })
})

describe('fire', () => {
  it('chars turf and wood and only soots concrete', () => {
    for (const [surface, least, most] of [['lawn', 0.9, 1], ['wood_floor', 0.9, 1], ['concrete_slab', 0.3, 0.45]] as const) {
      const terrain = make(surface)
      terrain.burn({ x: 0, z: 0, radius: 0.5, temperature: 900, seconds: 8 })
      const column = terrain.columnAt(0, 0)
      expect(column.scorch).toBeGreaterThanOrEqual(least)
      expect(column.scorch).toBeLessThanOrEqual(most)
    }
  })

  it('wood burns away, concrete does not', () => {
    const wood = make('wood_floor')
    wood.burn({ x: 0, z: 0, radius: 0.5, temperature: 900, seconds: 8 })
    expect(wood.heightAt(0, 0)).toBeLessThan(0)
    const slab = make('concrete_slab')
    slab.burn({ x: 0, z: 0, radius: 0.5, temperature: 900, seconds: 8 })
    expect(slab.heightAt(0, 0)).toBe(0)
  })

  it('spreads over dry grass and not over concrete, and a cold flame does nothing', () => {
    const lawn = make('lawn')
    lawn.burn({ x: 0, z: 0, radius: 0.3, temperature: 900, seconds: 2 })
    settle(lawn, 12)
    let burnt = 0
    lawn.scorch.forEach((value) => {
      if (value > 0.5) burnt++
    })
    const slab = make('concrete_slab')
    slab.burn({ x: 0, z: 0, radius: 0.3, temperature: 900, seconds: 2 })
    expect(slab.stats().burning).toBe(0)
    expect(burnt).toBeGreaterThan(100)
    const cold = make('lawn')
    cold.burn({ x: 0, z: 0, radius: 1, temperature: 100, seconds: 10 })
    expect(cold.columnAt(0, 0).scorch).toBe(0)
  })
})

describe('layout, ray and snapshot', () => {
  it('zones hold their own profile, unknown ids fall to the default, and laying again resets', () => {
    const terrain = createTerrain({ bounds: BOUNDS, layout: { surface: 'nothing_like_this', zones: [{ rect: [0, 0, 5, 5], surface: 'sand' }] } })
    expect(terrain.columnAt(-3, -3).profile).toBe('concrete_slab')
    expect(terrain.columnAt(2, 2).material).toBe('sand')
    terrain.strike('explosive', { x: 2, z: 2, energy: GRENADE })
    terrain.setLayout({ surface: 'lawn' })
    expect(terrain.heightAt(2, 2)).toBe(0)
    expect(terrain.columnAt(2, 2).material).toBe('turf')
  })

  it('a chunk is pristine until touched, and a chunk of two profiles is not', () => {
    const terrain = createTerrain({ bounds: BOUNDS, layout: { surface: 'lawn', zones: [{ rect: [-10, -10, -9, -9], surface: 'sand' }] } })
    expect(terrain.chunk(0).pristine).toBe(false)
    const middle = Math.floor(terrain.chunksZ / 2) * terrain.chunksX + Math.floor(terrain.chunksX / 2)
    expect(terrain.chunk(middle).pristine).toBe(true)
    terrain.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    expect(terrain.chunk(middle).pristine).toBe(false)
  })

  it('a ray finds the floor of a crater, not the old surface', () => {
    const terrain = make('dirt')
    terrain.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    const hit = terrain.raycast([0, 5, 0], [0, -1, 0], 10)!
    expect(hit.point[1]).toBeCloseTo(terrain.heightAt(0, 0), 2)
    expect(hit.point[1]).toBeLessThan(-0.1)
  })

  it('a snapshot brings the same ground back', () => {
    const terrain = make('lawn')
    terrain.strike('explosive', { x: 1, z: 1, energy: GRENADE })
    terrain.strike('ballistic', { x: -3, z: 2, energy: PISTOL })
    const saved = JSON.parse(JSON.stringify(terrain.serialize()))
    const height = terrain.heightAt(1, 1)
    terrain.reset()
    expect(terrain.heightAt(1, 1)).toBe(0)
    terrain.load(saved)
    expect(terrain.heightAt(1, 1)).toBeCloseTo(height, 5)
    expect(terrain.marks()).toHaveLength(1)
  })

  it('a blast high in the air leaves the ground alone', () => {
    const terrain = make('dirt')
    expect(terrain.applyHit({ type: 'explosive', point: [0, 6, 0], energy: GRENADE, radius: 8 })).toBeNull()
    expect(terrain.applyHit({ type: 'explosive', point: [0, 0.2, 0], energy: GRENADE, radius: 8 })!.radius).toBeGreaterThan(0.3)
  })
})
