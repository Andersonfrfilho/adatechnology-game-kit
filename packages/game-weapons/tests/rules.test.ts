import { describe, expect, it } from 'vitest'
import { createArsenal } from '../src'
import type { FaultId, Vec3, WeaponEvent, WeaponState } from '../src'

const ORIGIN: Vec3 = [0, 1.5, 0]
const AIM: Vec3 = [0, 0, -1]
const NO_FAULTS = { faults: false } as const

/** One pull from a cold, full weapon: the magazine is refilled and the barrel cooled so every pull is a fresh trial. */
const pullFresh = (weapon: WeaponState) => {
  weapon.refill()
  weapon.update(10)
  return weapon.trigger(ORIGIN, AIM, 0, false)
}

const faultOf = (result: ReturnType<WeaponState['trigger']>): FaultId | undefined => (result.status === 'misfire' ? 'misfire' : result.fault)

const eventTypes = (events: WeaponEvent[]): string[] => events.map((event) => event.type)

describe('fault rate', () => {
  const trials = 20_000
  const conditions = { new: 0.003, used: 0.015, worn: 0.05, rusty: 0.12 }
  for (const [condition, wear] of Object.entries(conditions)) {
    it(`a ${condition} Glock 17 jams as often as the gallery formula says`, () => {
      const weapon = createArsenal().create('glock_17', { seed: 11, condition })
      let faults = 0
      for (let i = 0; i < trials; i++) if (faultOf(pullFresh(weapon))) faults++
      const p = wear * 0.7
      const sigma = Math.sqrt(trials * p * (1 - p))
      expect(Math.abs(faults - trials * p)).toBeLessThanOrEqual(3 * sigma)
    })
  }

  it('reloaded ammunition misfires on top of the weapon', () => {
    const weapon = createArsenal({ rules: { faultChance: () => 0 } }).create('glock_17', { seed: 5, ammoQuality: 'reloaded' })
    let misfires = 0
    for (let i = 0; i < trials; i++) if (faultOf(pullFresh(weapon)) === 'misfire') misfires++
    expect(Math.abs(misfires - trials * 0.08)).toBeLessThanOrEqual(3 * Math.sqrt(trials * 0.08 * 0.92))
  })

  it('does not jam with faults off, nor a weapon without cartridges', () => {
    const off = createArsenal({ rules: { ...NO_FAULTS, faultChance: () => 1 } }).create('glock_17')
    const bow = createArsenal({ rules: { faultChance: () => 1 } }).create('bow_compound')
    for (let i = 0; i < 50; i++) {
      expect(faultOf(pullFresh(off))).toBeUndefined()
      expect(faultOf(pullFresh(bow))).toBeUndefined()
    }
  })

  it('does not change the spread sequence of a seed that already existed', () => {
    const shots = (rules: { faults: boolean }) => {
      const weapon = createArsenal({ rules }).create('pistol_9mm', { seed: 7 })
      return Array.from({ length: 5 }, () => pullFresh(weapon).shots.map((shot) => shot.direction))
    }
    expect(shots({ faults: true })).toEqual(shots(NO_FAULTS))
  })
})

describe('kinds of fault by family', () => {
  const tally = (id: string, condition: string, trials: number): Map<FaultId, number> => {
    const weapon = createArsenal({ rules: { faultChance: () => 1 } }).create(id, { seed: 3, condition })
    const counts = new Map<FaultId, number>()
    for (let i = 0; i < trials; i++) {
      const fault = faultOf(pullFresh(weapon))
      if (fault) counts.set(fault, (counts.get(fault) ?? 0) + 1)
    }
    return counts
  }

  it('a semi-automatic pistol mixes misfire (35%), stovepipe (45%) and double feed (20%)', () => {
    const counts = tally('glock_17', 'rusty', 4000)
    expect(counts.get('failure_to_extract')).toBeUndefined()
    expect((counts.get('misfire') ?? 0) / 4000).toBeCloseTo(0.35, 1)
    expect((counts.get('stovepipe') ?? 0) / 4000).toBeCloseTo(0.45, 1)
    expect((counts.get('double_feed') ?? 0) / 4000).toBeCloseTo(0.2, 1)
  })

  it('a manual action fails to extract instead of stovepiping or double feeding', () => {
    const counts = tally('remington_870', 'rusty', 2000)
    expect([...counts.keys()].sort()).toEqual(['failure_to_extract', 'misfire'])
  })

  it('a revolver only misfires', () => {
    expect([...tally('sw_686', 'rusty', 1000).keys()]).toEqual(['misfire'])
  })
})

describe('a fault in play', () => {
  const jamming = () => createArsenal({ rules: { faultChance: () => 1 } })

  it('a misfire in a revolver spends the round without a jam', () => {
    const weapon = jamming().create('sw_686')
    const result = weapon.trigger(ORIGIN, AIM, 0, false)
    expect(result).toMatchObject({ status: 'misfire', rounds: 1 })
    expect(result.shots).toHaveLength(0)
    expect(weapon.fault).toBeNull()
    expect(weapon.ammo).toBe(6)
    expect(eventTypes(weapon.drain())).toContain('misfire')
  })

  it('with a fault the trigger answers fault and the reload refuses', () => {
    const weapon = jamming().create('remington_870', { seed: 2 })
    expect(weapon.trigger(ORIGIN, AIM, 0, false).fault).toBeDefined()
    const stuck = weapon.fault
    weapon.update(1)
    expect(weapon.trigger(ORIGIN, AIM, 0, false)).toMatchObject({ status: 'fault', fault: stuck })
    weapon.release()
    expect(weapon.reload()).toBe(false)
  })

  it('clearing takes 1.2 s with a start and an end, and a dud is ejected', () => {
    let weapon: WeaponState | undefined
    for (let seed = 1; seed < 200 && weapon?.fault !== 'misfire'; seed++) {
      weapon = jamming().create('glock_17', { seed })
      weapon.trigger(ORIGIN, AIM, 0, false)
    }
    if (!weapon || weapon.fault !== 'misfire') throw new Error('no seed gave a misfire')
    expect(weapon.ammo).toBe(17)
    weapon.drain()
    expect(weapon.clearFault()).toBe(true)
    expect(weapon.clearing).toBe(true)
    expect(weapon.phase).toMatchObject({ id: 'clear', start: 0, end: 1.2 })
    expect(weapon.trigger(ORIGIN, AIM, 0, false).status).toBe('clearing')
    weapon.update(1.1)
    expect(weapon.fault).toBe('misfire')
    weapon.update(0.11)
    expect(weapon.fault).toBeNull()
    expect(weapon.clearing).toBe(false)
    expect(weapon.ammo).toBe(16)
    expect(weapon.drain()).toEqual([
      { type: 'clear', fault: 'misfire', phase: 'start', at: 0 },
      { type: 'clear', fault: 'misfire', phase: 'end', at: 1.2 },
    ])
    expect(weapon.clearFault()).toBe(false)
  })

  it('a stovepipe takes the shot and the round before jamming', () => {
    const weapon = jamming().create('glock_17', { seed: 4 })
    const result = weapon.trigger(ORIGIN, AIM, 0, false)
    if (weapon.fault === 'misfire') return
    expect(result.shots).toHaveLength(1)
    expect(weapon.ammo).toBe(16)
  })

  it('the safety makes the trigger answer safe and says so', () => {
    const weapon = createArsenal().create('glock_17')
    expect(weapon.setSafety(true)).toBe(true)
    expect(weapon.trigger(ORIGIN, AIM, 0, false).status).toBe('safe')
    expect(weapon.setSafety(false)).toBe(false)
    expect(weapon.trigger(ORIGIN, AIM, 0, false).status).toBe('ok')
    expect(weapon.drain().filter((event) => event.type === 'safety')).toEqual([
      { type: 'safety', on: true, at: 0 },
      { type: 'safety', on: false, at: 0 },
    ])
  })

  it('rejects unknown conditions and ammo qualities', () => {
    const weapon = createArsenal().create('glock_17')
    expect(() => weapon.setCondition('shiny')).toThrow()
    expect(() => weapon.setAmmoQuality('magic')).toThrow()
    weapon.setCondition('rusty')
    expect(weapon.condition).toBe('rusty')
  })
})

describe('rounds of one pull', () => {
  const calm = createArsenal({ rules: NO_FAULTS })

  it('the M16A2 burst is 3 rounds at the cyclic rate', () => {
    const weapon = calm.create('colt_m16a2')
    while (weapon.mode !== 'burst') weapon.cycleMode()
    const result = weapon.trigger(ORIGIN, AIM, 0, false)
    expect(result.rounds).toBe(3)
    expect(result.roundTimes).toHaveLength(3)
    result.roundTimes.forEach((time, k) => expect(time).toBeCloseTo((k * 60) / 800, 9))
  })

  it('the Boito volley fires both barrels at once', () => {
    const weapon = calm.create('boito_double_barrel')
    while (weapon.mode !== 'volley') weapon.cycleMode()
    const result = weapon.trigger(ORIGIN, AIM, 0, false)
    expect(result.rounds).toBe(2)
    expect(result.roundTimes).toEqual([0, 0])
    expect(weapon.ammo).toBe(0)
  })

  it('a pump gun cycles for 0.5 s between shots', () => {
    const weapon = calm.create('remington_870')
    weapon.trigger(ORIGIN, AIM, 0, false)
    weapon.update(0.4)
    expect(weapon.trigger(ORIGIN, AIM, 0, false).status).toBe('cooldown')
    weapon.update(0.11)
    expect(weapon.trigger(ORIGIN, AIM, 0, false).status).toBe('ok')
    expect(eventTypes(weapon.drain())).toEqual(['shot', 'cycle', 'cycle', 'shot', 'cycle'])
  })

  it('drawing takes 0.35 s and the trigger waits', () => {
    const weapon = calm.create('glock_17')
    weapon.draw()
    expect(weapon.trigger(ORIGIN, AIM, 0, false).status).toBe('drawing')
    weapon.update(0.36)
    expect(weapon.trigger(ORIGIN, AIM, 0, false).status).toBe('ok')
    expect(weapon.drain().slice(0, 2)).toEqual([
      { type: 'draw', phase: 'start', at: 0 },
      { type: 'draw', phase: 'end', at: 0.35 },
    ])
  })

  it('a rocket launcher throws its projectile with the explosive numbers and heats the tube', () => {
    const weapon = createArsenal().create('rpg_7')
    const result = weapon.trigger(ORIGIN, AIM, 0, false)
    const use = result.uses[0]
    expect(use).toMatchObject({ kind: 'throw', fuse: 0 })
    expect(use?.kind === 'throw' && use.velocity[2]).toBeCloseTo(-117, 6)
    expect(weapon.ammo).toBe(0)
    expect(weapon.heat).toBeCloseTo(35, 6)
  })
})

describe('heat', () => {
  const FRAME = 1 / 60
  const decayed = (heat: number): number => Math.max(0, heat - FRAME * (1.6 + heat * 0.03))

  it('adds the case heat per round and cools by the gallery step at 1/60 s', () => {
    const weapon = createArsenal({ rules: NO_FAULTS }).create('glock_17')
    let expected = 0
    for (let frame = 1; frame <= 150; frame++) {
      weapon.update(FRAME)
      expected = decayed(expected)
      if (frame % 15 === 0) {
        weapon.trigger(ORIGIN, AIM, 0, false)
        expected += createArsenal().rules.heat.perShot.pistol
      }
      expect(weapon.heat).toBeCloseTo(expected, 9)
    }
    expect(weapon.heatLevel).toBeCloseTo(Math.min(1, expected / 120), 9)
  })

  it('caps at 140 and the level at 1', () => {
    const weapon = createArsenal({ rules: NO_FAULTS }).create('browning_m2', { reserve: 1000 })
    for (let i = 0; i < 40; i++) {
      weapon.refill()
      weapon.trigger(ORIGIN, AIM, 1, true)
    }
    expect(weapon.heat).toBeLessThanOrEqual(140)
    expect(weapon.heatLevel).toBe(1)
  })

  it('a hot barrel jams more: the chance grows past 60', () => {
    const arsenal = createArsenal()
    const def = arsenal.weapons.get('sw_686')
    const condition = arsenal.rules.conditions[1]
    if (!def || !condition) throw new Error('missing data')
    const cold = arsenal.rules.faultChance({ def, condition, heat: 0 })
    expect(arsenal.rules.faultChance({ def, condition, heat: 100 })).toBeCloseTo(cold * 2, 9)
  })
})

describe('reload stages', () => {
  const stagesOf = (weapon: WeaponState): { kind: string; stages: string[] } => {
    weapon.update(30)
    const events = weapon.drain()
    const start = events.find((event) => event.type === 'reload' && event.phase === 'start')
    return {
      kind: start?.type === 'reload' ? start.kind : '',
      stages: events.flatMap((event) => (event.type === 'reload_stage' ? [event.stage] : [])),
    }
  }
  const calm = createArsenal({ rules: NO_FAULTS })

  it('a tactical pistol reload swaps the magazine, an empty one also charges', () => {
    const tactical = calm.create('glock_17')
    tactical.trigger(ORIGIN, AIM, 0, false)
    tactical.reload()
    expect(stagesOf(tactical)).toEqual({ kind: 'tactical', stages: ['magazine_out', 'magazine_in'] })
    const empty = calm.create('glock_17', { reserve: 100 })
    for (let i = 0; i < 17; i++) {
      empty.update(1)
      empty.trigger(ORIGIN, AIM, 0, false)
    }
    expect(empty.locked).toBe(true)
    empty.drain()
    empty.reload()
    expect(stagesOf(empty)).toEqual({ kind: 'empty', stages: ['magazine_out', 'magazine_in', 'charge'] })
    expect(empty.locked).toBe(false)
  })

  it('a revolver loads one by one, or all at once with a speed loader', () => {
    const slow = calm.create('sw_686')
    slow.trigger(ORIGIN, AIM, 0, false)
    slow.update(1)
    slow.drain()
    slow.reload()
    expect(stagesOf(slow)).toEqual({ kind: 'one_by_one', stages: ['cylinder_open', 'cylinder_eject', 'cylinder_close'] })
    const jet = calm.create('sw_686')
    jet.trigger(ORIGIN, AIM, 0, false)
    jet.update(1)
    jet.drain()
    jet.reload('full')
    expect(stagesOf(jet).stages).toEqual(['cylinder_open', 'cylinder_eject', 'cylinder_load', 'cylinder_close'])
  })

  it('a pump gun feeds one round per step and ends the reload after the last', () => {
    const weapon = calm.create('remington_870')
    weapon.trigger(ORIGIN, AIM, 0, false)
    weapon.update(1)
    weapon.trigger(ORIGIN, AIM, 0, false)
    weapon.update(1)
    weapon.drain()
    weapon.reload()
    weapon.update(30)
    const events = weapon.drain()
    expect(eventTypes(events).filter((type) => type === 'feed')).toHaveLength(2)
    expect(events[events.length - 1]).toMatchObject({ type: 'reload', phase: 'end', kind: 'one_by_one' })
  })

  it('a disposable launcher drops the tube and seats a new one', () => {
    const weapon = calm.create('m72_law', { reserve: 3 })
    weapon.trigger(ORIGIN, AIM, 0, false)
    weapon.drain()
    weapon.reload()
    expect(stagesOf(weapon)).toEqual({ kind: 'empty', stages: ['tube_drop', 'tube_seat'] })
  })
})

describe('noise of a burst', () => {
  it('rises with the shots of the last 3 s and stops at +50%', () => {
    const weapon = createArsenal({ rules: NO_FAULTS }).create('ak_47', { reserve: 1000 })
    const base = weapon.trigger(ORIGIN, AIM, 0, false).noise
    weapon.update(0.2)
    const noises: number[] = []
    for (let i = 0; i < 40; i++) {
      weapon.update(0.1)
      noises.push(weapon.trigger(ORIGIN, AIM, 0.1, true).noise)
    }
    expect(base).toBe(300)
    expect(Math.max(...noises)).toBeCloseTo(base * 1.5, 6)
    expect(Math.max(...noises)).toBeLessThanOrEqual(base * 1.5 + 1e-9)
    expect(noises[0]).toBeGreaterThan(base)
  })
})
