import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { WATER_BLASTS, WATER_SHOT_BY_CALIBER, WATER_SHOT_PROFILES, createWaterEffects, lehmer, planWaterBlast, planWaterShot, waterShotClassOf } from '../src'
import type { WaterEffects, WaterShotClass, WaterVec3 } from '../src'

const DOWN: WaterVec3 = [0, -1, 0]
const steep = (degrees: number): WaterVec3 => {
  const radians = (degrees * Math.PI) / 180
  return [Math.cos(radians), -Math.sin(radians), 0]
}
const shotPlan = (profile: WaterShotClass, direction: WaterVec3 = DOWN) => planWaterShot({ point: [0, 0, 0], direction, profile, depth: 2 }, lehmer(3))
const run = (effects: WaterEffects, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) effects.update(1 / 60)
}
const empty = (effects: WaterEffects): boolean => Object.values(effects.stats()).every((count) => count === 0)

describe('water shots by weapon', () => {
  it('every calibre of the weapons kit has a class of splash', () => {
    const calibers = JSON.parse(readFileSync(fileURLToPath(new URL('../../game-weapons/src/data/calibers.json', import.meta.url)), 'utf8')) as { id: string }[]
    const missing = calibers.map((caliber) => caliber.id).filter((id) => !WATER_SHOT_BY_CALIBER[id])
    expect(missing).toEqual([])
    for (const shotClass of Object.values(WATER_SHOT_BY_CALIBER)) expect(WATER_SHOT_PROFILES[shotClass]).toBeDefined()
  })

  it('a heavier round throws a taller column and a wider ring: pistol < rifle < battle rifle < sniper', () => {
    const order: WaterShotClass[] = ['pistol', 'rifle', 'battle_rifle', 'sniper']
    const plans = order.map((profile) => shotPlan(profile))
    for (let index = 1; index < plans.length; index++) {
      expect(plans[index]!.columnHeight).toBeGreaterThan(plans[index - 1]!.columnHeight)
      expect(plans[index]!.ringRadius).toBeGreaterThan(plans[index - 1]!.ringRadius)
    }
    // a rifle spout is tall and thin, a pistol's short and thicker
    expect(shotPlan('rifle').columnRadius).toBeLessThan(shotPlan('pistol').columnRadius)
    expect(shotPlan('rifle').drops).toBeGreaterThan(shotPlan('pistol').drops)
  })

  it('a buckshot pellet throws a small spout but a lot of shallow foam for its size', () => {
    const pellet = shotPlan('buckshot')
    const pistol = shotPlan('pistol')
    expect(pellet.columnHeight).toBeLessThan(pistol.columnHeight)
    expect(pellet.foamRadius / pellet.columnHeight).toBeGreaterThan(pistol.foamRadius / pistol.columnHeight)
  })

  it('a shotgun load is one splash per pellet, each small', () => {
    const effects = createWaterEffects({ seed: 5 })
    const pellets = 9
    for (let index = 0; index < pellets; index++) effects.shot({ point: [index * 0.12, 0, Math.sin(index) * 0.2], direction: DOWN, profile: WATER_SHOT_BY_CALIBER['12ga_00buck']! })
    expect(effects.columns.length).toBe(pellets)
    expect(effects.foam.length).toBe(pellets)
    for (const column of effects.columns) expect(column.peak).toBeLessThan(WATER_SHOT_PROFILES.pistol.columnHeight)
  })

  it('a burst of a rifle makes one splash per round', () => {
    const effects = createWaterEffects({ seed: 2 })
    for (let round = 0; round < 3; round++) effects.shot({ point: [round * 0.3, 0, 0], direction: steep(40), profile: 'rifle' })
    expect(effects.columns.length).toBe(3)
    expect(effects.rings.length).toBe(3 * WATER_SHOT_PROFILES.rifle.rings)
  })

  it('a grazing round skips off and throws a low spout leaning the way it went; a steep one goes in and leaves a trail', () => {
    const grazing = shotPlan('pistol', steep(4))
    expect(grazing.ricochet).not.toBeNull()
    expect(grazing.ricochet!.direction[1]).toBeGreaterThan(0)
    expect(grazing.ricochet!.direction[0]).toBeGreaterThan(0.9)
    expect(grazing.tilt[0]).toBeGreaterThan(0.5)
    expect(grazing.trailLength).toBe(0)
    const straight = shotPlan('pistol')
    expect(straight.ricochet).toBeNull()
    expect(grazing.columnHeight).toBeLessThan(straight.columnHeight)
    expect(straight.trailLength).toBeGreaterThan(0)
  })

  it('a round slows fast in water: a rifle bullet is spent in under two metres, and in shallow water the trail stops at the bed', () => {
    const rifle = shotPlan('rifle')
    expect(rifle.trailLength).toBeLessThan(2)
    expect(rifle.bedSpeed).toBe(0)
    const shallow = planWaterShot({ point: [0, 0, 0], direction: DOWN, profile: 'sniper', depth: 0.3 }, lehmer(1))
    expect(shallow.trailLength).toBeCloseTo(0.3, 5)
    expect(shallow.trailEnd[1]).toBeCloseTo(-0.3, 5)
    expect(shallow.bedSpeed).toBeGreaterThan(0)
    expect(shallow.bedSpeed).toBeLessThan(WATER_SHOT_PROFILES.sniper.speed)
  })

  it('a round the table does not know is classed by its weight and speed', () => {
    expect(waterShotClassOf({ grams: 7.5, speed: 365 })).toBe('pistol')
    expect(waterShotClassOf({ grams: 8, speed: 725 })).toBe('rifle')
    expect(waterShotClassOf({ grams: 42, speed: 925 })).toBe('sniper')
    expect(waterShotClassOf({ grams: 3.5, speed: 414, pellet: true })).toBe('buckshot')
    expect(waterShotClassOf({ grams: 25, speed: 90 })).toBe('arrow')
  })
})

describe('water blasts by charge', () => {
  const at = (explosive: string, depth = 0.6, water = 3) => planWaterBlast({ point: [0, -depth, 0], level: 0, depth: water, explosive })

  it('the column of any charge is taller than the column of any round, and grows with the charge', () => {
    const tallestShot = Math.max(...Object.values(WATER_SHOT_PROFILES).map((profile) => profile.columnHeight))
    expect(at('m79_40mm', 0).columnHeight).toBeGreaterThan(tallestShot)
    expect(at('m67').columnHeight).toBeGreaterThan(at('m79_40mm').columnHeight)
    expect(at('c4').columnHeight).toBeGreaterThan(at('m67').columnHeight)
    expect(at('c4').shockRadius).toBeGreaterThan(at('m67').shockRadius)
    expect(at('c4').waveAmplitude).toBeGreaterThan(at('m67').waveAmplitude)
  })

  it('under the water there is no fireball and a dome of white water; at the surface a fireball and no dome', () => {
    const under = at('m67', 0.6)
    expect(under.underwater).toBe(true)
    expect(under.domeRadius).toBeGreaterThan(0)
    expect(under.bubbles).toBeGreaterThan(0)
    const surface = at('m67', -0.05)
    expect(surface.underwater).toBe(false)
    expect(surface.domeRadius).toBe(0)
    expect(surface.fragments).toBeGreaterThan(0)
  })

  it('a deep burst is held down by the water: a lower column than a shallow one; a burst high over it throws no column', () => {
    expect(at('c4', 6, 10).columnHeight).toBeLessThan(at('c4', 0.6, 10).columnHeight)
    const high = at('m67', -3)
    expect(high.airburst).toBe(true)
    expect(high.columnHeight).toBe(0)
  })

  it('a shallow pool has not the water to throw a full column', () => {
    expect(at('m67', 0.3, 0.3).columnHeight).toBeLessThan(at('m67', 0.3, 3).columnHeight)
  })

  it('a fuel or gas burst barely throws the water but boils a lot of it into mist', () => {
    const gas = at('propane_p13', 0)
    const c4 = at('c4', 0)
    expect(gas.columnHeight).toBeLessThan(c4.columnHeight)
    expect(gas.mist).toBeGreaterThan(c4.mist)
  })

  it('every explosive of the table has a kind the water knows', () => {
    for (const id of Object.keys(WATER_BLASTS)) expect(at(id).kind.brisance).toBeGreaterThan(0)
  })
})

describe('water effects over time', () => {
  it('drops fall back under gravity and leave small rings where they land; everything is gone after its life', () => {
    const effects = createWaterEffects({ seed: 9 })
    effects.shot({ point: [0, 0, 0], direction: DOWN, profile: 'sniper' })
    const drops = effects.drops.length
    expect(drops).toBeGreaterThan(0)
    const startRings = effects.rings.length
    run(effects, 0.25)
    expect(effects.drops.some((drop) => drop.y > 0.05)).toBe(true)
    run(effects, 1.5)
    expect(effects.drops.length).toBeLessThan(drops)
    expect(effects.rings.length).toBeGreaterThan(startRings - WATER_SHOT_PROFILES.sniper.rings)
    run(effects, 12)
    expect(empty(effects)).toBe(true)
  })

  it('a column rises, peaks at its height and falls back', () => {
    const effects = createWaterEffects({ seed: 4 })
    effects.shot({ point: [0, 0, 0], direction: DOWN, profile: 'sniper' })
    const column = effects.columns[0]!
    let tallest = 0
    for (let t = 0; t < 3; t += 1 / 60) {
      effects.update(1 / 60)
      tallest = Math.max(tallest, column.height)
    }
    expect(tallest).toBeGreaterThan(WATER_SHOT_PROFILES.sniper.columnHeight * 0.9)
    expect(effects.columns.length).toBe(0)
  })

  it('a blast leaves rain, mist, foam, waves and bubbles that all expire', () => {
    const effects = createWaterEffects({ seed: 7 })
    const plan = effects.blast({ point: [0, -0.5, 0], level: 0, depth: 2, explosive: 'c4' })
    const stats = effects.stats()
    expect(stats.drops).toBeGreaterThan(50)
    expect(stats.mist).toBeGreaterThan(0)
    expect(stats.waves).toBeGreaterThan(0)
    expect(stats.bubbles).toBeGreaterThan(0)
    expect(effects.columns.some((column) => column.dome)).toBe(plan.domeRadius > 0)
    run(effects, 15)
    expect(empty(effects)).toBe(true)
  })

  it('the waves of a blast lift and push what floats outward as their crest passes, and calm down after', () => {
    const effects = createWaterEffects({ seed: 1 })
    const plan = effects.blast({ point: [0, -0.5, 0], level: 0, depth: 2, explosive: 'm67' })
    const distance = 2
    run(effects, distance / plan.waveSpeed)
    const sample = effects.waveAt(distance, 0)
    expect(sample.height).toBeGreaterThan(0)
    expect(sample.push[0]).toBeGreaterThan(0)
    expect(Math.abs(sample.push[1])).toBeLessThan(1e-6)
    run(effects, 8)
    expect(effects.waveAt(distance, 0).height).toBe(0)
  })

  it('rings, foam and waves stop at the shore', () => {
    const pond = (x: number, z: number): number | null => (Math.abs(x) < 1 && Math.abs(z) < 1 ? 0 : null)
    const effects = createWaterEffects({ seed: 3, levelAt: pond })
    effects.blast({ point: [0, -0.4, 0], level: 0, depth: 1.5, explosive: 'c4' })
    for (const ring of effects.rings) expect(ring.maxRadius).toBeLessThanOrEqual(1.01)
    for (const foam of effects.foam) expect(foam.maxRadius).toBeLessThanOrEqual(1.01)
    for (const wave of effects.waves) expect(wave.reach).toBeLessThanOrEqual(1.01)
  })

  it('no pool grows past its limit, however much is fired', () => {
    const limits = { drops: 120, rings: 40, foam: 10, columns: 6, bubbles: 80, mist: 12, waves: 4 }
    const effects = createWaterEffects({ seed: 11, limits })
    for (let round = 0; round < 300; round++) {
      effects.shot({ point: [round % 7, 0, 0], direction: steep(30 + (round % 50)), profile: 'battle_rifle' })
      if (round % 50 === 0) effects.blast({ point: [0, -0.4, 0], level: 0, depth: 2, explosive: 'm67' })
      effects.update(1 / 60)
      const stats = effects.stats()
      for (const key of Object.keys(limits) as (keyof typeof limits)[]) expect(stats[key]).toBeLessThanOrEqual(limits[key])
    }
  })

  it('far from the camera a shot throws fewer drops and bubbles', () => {
    const near = createWaterEffects({ seed: 1 })
    near.setCamera([0, 2, 3])
    near.shot({ point: [0, 0, 0], direction: DOWN, profile: 'sniper' })
    const far = createWaterEffects({ seed: 1 })
    far.setCamera([0, 2, 120])
    far.shot({ point: [0, 0, 0], direction: DOWN, profile: 'sniper' })
    expect(far.drops.length).toBeLessThan(near.drops.length)
    expect(far.bubbles.length).toBeLessThan(near.bubbles.length)
  })

  it('the same seed gives the same splash', () => {
    const a = createWaterEffects({ seed: 21 })
    const b = createWaterEffects({ seed: 21 })
    a.shot({ point: [0, 0, 0], direction: steep(50), profile: 'rifle' })
    b.shot({ point: [0, 0, 0], direction: steep(50), profile: 'rifle' })
    run(a, 0.5)
    run(b, 0.5)
    expect(a.drops.map((drop) => drop.y)).toEqual(b.drops.map((drop) => drop.y))
  })

  it('clear takes everything away', () => {
    const effects = createWaterEffects()
    effects.blast({ point: [0, 0, 0], level: 0, depth: 2, explosive: 'm67' })
    effects.clear()
    expect(empty(effects)).toBe(true)
  })
})
