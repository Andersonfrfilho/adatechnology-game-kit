import { describe, expect, it } from 'vitest'
import { AREA_CAP_GAME, EVENT_BUDGET, LOD_GAME, LOD_LAB, PROFILES, createAreaCap, createGroundField, createSchedule, createScreenState, estimateCost, lehmer, lodScale, updateScreen } from '../src'
import { createLightPool, lightBlast, updateLights } from '../src/lights'
import { TEST_BLAST } from './fixtures'

describe('distance LOD', () => {
  it('the game bands are 15 / 40 / 80 m with scales 1 / .5 / .2 / .1', () => {
    expect([10, 14.9, 15, 39.9, 40, 79.9, 80, 500].map((distance) => lodScale(LOD_GAME, distance, 0))).toEqual([1, 1, 0.5, 0.5, 0.2, 0.2, 0.1, 0.1])
  })

  it('the Lab bands are 20 / 45 / 85 m, 0.08 far, minus three visual radii', () => {
    expect([19.9, 20, 44.9, 45, 84.9, 85].map((distance) => lodScale(LOD_LAB, distance, 0))).toEqual([1, 0.5, 0.5, 0.2, 0.2, 0.08])
    expect(lodScale(LOD_LAB, 25, 2)).toBe(1)
    expect(lodScale(LOD_LAB, 25, 1)).toBe(0.5)
  })
})

describe('area cap', () => {
  it('the game cap is 40 m, 4 s, 6 explosions and 0.3 for the extra ones', () => {
    expect(AREA_CAP_GAME).toEqual({ radius: 40, window: 4, count: 6, excessScale: 0.3 })
  })

  it('the 7th explosion within 40 m in 4 s gets 0.3; at 41 m or after 4 s it gets 1', () => {
    const tracker = createAreaCap(AREA_CAP_GAME)
    for (let index = 0; index < 6; index++) expect(tracker.register(index * 0.5, index, 0)).toBe(1)
    expect(tracker.register(3, 0, 0)).toBe(0.3)
    const far = createAreaCap(AREA_CAP_GAME)
    for (let index = 0; index < 6; index++) far.register(index * 0.5, 0, 0)
    expect(far.register(3, 41, 0)).toBe(1)
    const late = createAreaCap(AREA_CAP_GAME)
    for (let index = 0; index < 6; index++) late.register(0, 0, 0)
    expect(late.register(4, 0, 0)).toBe(1)
    const lateStill = createAreaCap(AREA_CAP_GAME)
    for (let index = 0; index < 6; index++) lateStill.register(0, 0, 0)
    expect(lateStill.register(3.99, 0, 0)).toBe(0.3)
  })

  it('measures on the ground plane: height does not count', () => {
    const tracker = createAreaCap(AREA_CAP_GAME)
    for (let index = 0; index < 6; index++) tracker.register(0, 39, 0)
    expect(tracker.register(1, 0, 0)).toBe(0.3)
    tracker.clear()
    expect(tracker.register(1, 0, 0)).toBe(1)
  })
})

describe('schedule', () => {
  it('runs what is due from the last added to the first', () => {
    const schedule = createSchedule()
    const order: string[] = []
    schedule.at(1, () => order.push('first'))
    schedule.at(2, () => order.push('second'))
    schedule.at(0.5, () => order.push('third'))
    schedule.at(9, () => order.push('later'))
    schedule.update(2)
    expect(order).toEqual(['third', 'second', 'first'])
    expect(schedule.pending).toBe(1)
    schedule.update(9)
    expect(order.at(-1)).toBe('later')
  })

  it('an action may schedule more, and clear drops everything', () => {
    const schedule = createSchedule()
    let ran = 0
    schedule.at(0, () => schedule.at(0, () => ran++))
    schedule.update(1)
    schedule.update(1)
    expect(ran).toBe(1)
    schedule.at(5, () => ran++)
    schedule.clear()
    schedule.update(10)
    expect(ran).toBe(1)
  })
})

describe('screen state', () => {
  it('decays with the Lab and Workshop constants', () => {
    const state = createScreenState()
    state.shake = 1
    state.flash = 1
    state.flashDecay = 7
    state.white = 1
    state.red = 1
    state.chroma = 1
    state.desat = 1
    state.gas = 1
    state.beat = 1
    updateScreen(state, 0.1)
    expect(state.shake).toBeCloseTo(Math.exp(-0.5), 12)
    expect(state.flash).toBeCloseTo(Math.exp(-0.7), 12)
    expect(state.white).toBeCloseTo(Math.exp(-0.7), 12)
    expect(state.red).toBeCloseTo(Math.exp(-0.22), 12)
    expect(state.chroma).toBeCloseTo(Math.exp(-0.3), 12)
    expect(state.desat).toBeCloseTo(Math.exp(-0.07), 12)
    expect(state.gas).toBeCloseTo(0.98, 12)
    expect(state.beat).toBeCloseTo(Math.exp(-0.6), 12)
  })
})

describe('lights', () => {
  const step = (dt: number, fires: Parameters<typeof updateLights>[1]['fires'] = []) => ({ dt, flashLayer: 1, clock: 1, fires })

  it('a blast light holds its peak for 50 ms, fades by (1 - age)^2.2 and goes out', () => {
    const pool = createLightPool()
    lightBlast(pool, { x: 1, y: 2, z: 3, peak: 30, distance: 20, life: 1, color: 0xffa050 })
    updateLights(pool, step(0.04))
    expect(pool.blast[0]!.level).toBeCloseTo(30 * (0.85 + 0.15 * Math.sin(0.04 * 60)), 10)
    updateLights(pool, step(0.46))
    expect(pool.blast[0]!.level).toBeCloseTo(30 * Math.pow(0.5, 2.2) * (0.85 + 0.15 * Math.sin(0.5 * 60)), 10)
    updateLights(pool, step(0.6))
    expect(pool.blast[0]!.intensity).toBe(0)
  })

  it('takes the blast lights round robin, four of them', () => {
    const pool = createLightPool()
    for (let index = 0; index < 5; index++) lightBlast(pool, { x: index, y: 0, z: 0, peak: 1, distance: 1, life: 1, color: 0xffffff })
    expect(pool.blast.map((light) => light.x)).toEqual([4, 1, 2, 3])
  })

  it('the two fire lights go to the two largest fires, and the glow follows the brightest blast', () => {
    const pool = createLightPool()
    const fires = [
      { x: 0, y: 0, z: 0, r: 1, fade: 1 },
      { x: 5, y: 0, z: 0, r: 3, fade: 1 },
      { x: 9, y: 0, z: 0, r: 2, fade: 1 },
    ]
    updateLights(pool, step(0.016, fires))
    expect(pool.fire[0]!.x).toBe(5)
    expect(pool.fire[1]!.x).toBe(9)
    expect(pool.fire[0]!.distance).toBe(10 + 3 * 4)
    expect(pool.glow.x).toBe(5)
    lightBlast(pool, { x: 7, y: 1, z: 1, peak: 50, distance: 30, life: 1, color: 0xffffff })
    updateLights(pool, step(0.016, fires))
    expect(pool.glow.x).toBe(7)
    updateLights(pool, step(0.016, []))
    expect(pool.fire[0]!.intensity).toBe(0)
  })

  it('the flash layer off puts the blast lights out', () => {
    const pool = createLightPool()
    lightBlast(pool, { x: 0, y: 0, z: 0, peak: 50, distance: 30, life: 1, color: 0xffffff })
    updateLights(pool, { dt: 0.016, flashLayer: 0, clock: 0, fires: [] })
    expect(pool.blast[0]!.intensity).toBe(0)
  })
})

describe('ground field', () => {
  it('a dent digs a bowl and raises the rim, repeatably', () => {
    const first = createGroundField()
    const second = createGroundField()
    first.dent(lehmer(5), 0, 0, 2, 0.5)
    second.dent(lehmer(5), 0, 0, 2, 0.5)
    expect(first.heights).toEqual(second.heights)
    expect(first.heightAt(0, 0)).toBeLessThan(-0.3)
    expect(first.heightAt(2.2, 0)).toBeGreaterThan(0)
    expect(first.heightAt(8, 8)).toBe(0)
    expect(first.version).toBe(1)
    first.reset()
    expect(first.heightAt(0, 0)).toBe(0)
    expect(first.version).toBe(2)
  })

  it('is 60 m of 33 cm cells, and flat outside', () => {
    const field = createGroundField()
    expect([field.size, field.segments, field.stride]).toEqual([60, 180, 181])
    expect(field.heightAt(100, 0)).toBe(0)
  })
})

describe('budget', () => {
  it('estimateCost adds fireballs, smoke, dust, shrapnel, mushroom and embers', () => {
    expect(estimateCost(TEST_BLAST)).toBe(10 + 8 + 10 + 20 + (10 + 5) + 6)
  })

  it('has the three pool profiles and the Lab per-event meters', () => {
    expect(PROFILES.high).toMatchObject({ puffs: 2600, sparks: 3200, glows: 320, chunks: 300, sprites: { add: 9000, normal: 9000 }, streaks: 3000, debris: 500 })
    expect(PROFILES.medium.puffs).toBe(1300)
    expect(PROFILES.low.puffs).toBe(260)
    expect(EVENT_BUDGET).toEqual({ particles: 400, debris: 40, blastLights: 4, fireLights: 2 })
  })
})
