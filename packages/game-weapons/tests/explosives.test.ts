import { describe, expect, it } from 'vitest'
import { backblastEffect, blastEffect, createArsenal } from '../src'
import type { Detonation, ExplosiveBody, ExplosiveEvent, SurfaceProbe, Use, Vec3 } from '../src'

const FRAME = 1 / 60
const ORIGIN: Vec3 = [0, 1.5, 0]
const AIM: Vec3 = [0, 0, -1]
const arsenal = createArsenal({ rules: { faults: false, startSafe: false } })

const GROUND: SurfaceProbe = (from, to) => {
  if (to[1] > 0) return null
  const k = from[1] === to[1] ? 1 : from[1] / (from[1] - to[1])
  return { point: [from[0] + (to[0] - from[0]) * k, 0, from[2] + (to[2] - from[2]) * k], normal: [0, 1, 0], ground: true }
}

/** A wall on the plane z = `z` (facing +z). */
const wallAt =
  (z: number): SurfaceProbe =>
  (from, to) => {
    if (from[2] > z && to[2] <= z) {
      const k = (from[2] - z) / (from[2] - to[2])
      return { point: [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, z], normal: [0, 0, 1], ground: false }
    }
    return null
  }

const useOf = (weaponId: string, index = 0): Use => {
  const weapon = arsenal.create(weaponId)
  const result = weapon.trigger(ORIGIN, AIM, 0, false)
  const use = (weapon.release(ORIGIN, AIM) ?? result).uses[index] ?? result.uses[index]
  if (!use) throw new Error(`${weaponId} gave no use at ${index}`)
  return use
}

const bodyOf = (use: Use): ExplosiveBody => {
  const body = arsenal.explosiveBody(use)
  if (!body) throw new Error('the use carries no explosive')
  return body
}

/** Steps the body until it is done (or `limit` seconds); returns every event in order. */
const run = (body: ExplosiveBody, probe: SurfaceProbe | undefined, limit = 30): ExplosiveEvent[] => {
  const events: ExplosiveEvent[] = []
  for (let t = 0; t < limit && !body.done; t += FRAME) events.push(...body.step(FRAME, probe))
  return events
}

const detonationOf = (events: readonly ExplosiveEvent[]): Detonation | undefined => {
  const found = events.find((event) => event.type === 'detonate')
  return found?.type === 'detonate' ? found.detonation : undefined
}

describe('rocket launcher (Arsenal §13: arming distance 10 m, backblast 5 m, a real projectile with flight time and drop)', () => {
  it('fires the projectile at the launcher speed with the explosive numbers and the arming distance', () => {
    const use = useOf('rpg_7')
    expect(use).toMatchObject({ kind: 'throw', explosive: 'pg7v', trigger: 'impact', armDistance: 10, fuse: 0, energy: 200000, radius: 5, injuryRadius: 16 })
    expect(use.kind === 'throw' && use.velocity).toEqual([0, 0, -117])
  })

  it('does not explode before the arming distance: it hits the wall and is a dud', () => {
    const body = bodyOf(useOf('at4'))
    const events = run(body, wallAt(-6))
    expect(events.map((event) => event.type)).toEqual(['impact', 'dud'])
    expect(body.dud).toBe(true)
    expect(detonationOf(events)).toBeUndefined()
  })

  it('arms after 10 m and explodes on impact at the wall', () => {
    const body = bodyOf(useOf('at4'))
    const events = run(body, wallAt(-40))
    expect(events.map((event) => event.type)).toEqual(['armed', 'impact', 'detonate'])
    const detonation = detonationOf(events)
    expect(detonation?.cause).toBe('impact')
    expect(detonation?.point[2]).toBeCloseTo(-40, 6)
    expect(body.travelled).toBeGreaterThanOrEqual(10)
  })

  it('drops with gravity (9.8 m/s², jogo.js 68303) and bursts on the ground with the flight time of the speed', () => {
    const use = useOf('rpg_7')
    const body = bodyOf(use)
    const events = run(body, GROUND)
    const detonation = detonationOf(events)
    const fallTime = Math.sqrt((2 * ORIGIN[1]) / 9.8)
    expect(detonation?.cause).toBe('impact')
    expect(detonation?.at).toBeGreaterThan(fallTime - 2 * FRAME)
    expect(detonation?.at).toBeLessThan(fallTime + 2 * FRAME)
    expect(detonation?.point[2]).toBeCloseTo(-117 * (detonation?.at ?? 0), 0)
  })

  it('is a dud when the ground is closer than the arming distance, armed when farther', () => {
    const low = bodyOf(arsenal.create('rpg_7').trigger(ORIGIN, [0, -1, 0], 0, false).uses[0] as Use)
    expect(run(low, GROUND).some((event) => event.type === 'dud')).toBe(true)
    const high = bodyOf({ ...useOf('rpg_7'), origin: [0, 40, 0] } as Use)
    expect(detonationOf(run(high, GROUND))?.point[1]).toBeCloseTo(0, 6)
  })

  it('has a backblast behind the tube: radius 5 m, cone of 19°, pointing away from the target', () => {
    const blast = useOf('rpg_7', 1)
    expect(blast).toMatchObject({ kind: 'backblast', radius: 5, halfAngleDeg: 19, direction: [0, 0, 1] })
    if (blast.kind !== 'backblast') throw new Error('not a backblast')
    expect(backblastEffect(blast, [0, 1.5, 3])).toBeCloseTo(1 - 3 / 5, 9)
    expect(backblastEffect(blast, [0, 1.5, 6])).toBe(0)
    expect(backblastEffect(blast, [0, 1.5, -3])).toBe(0)
    expect(backblastEffect(blast, [2.5, 1.5, 2.5])).toBe(0)
    expect(backblastEffect(blast, [0.9, 1.5, 3])).toBeGreaterThan(0)
  })

  it('has no backblast on the M79 grenade launcher and keeps disposable tubes as such', () => {
    expect(arsenal.create('m79').trigger(ORIGIN, AIM, 0, false).uses).toHaveLength(1)
    expect(arsenal.weapons.get('at4')?.action).toMatchObject({ disposable: true })
    expect(arsenal.weapons.get('m72_law')?.action).toMatchObject({ disposable: true })
    expect(arsenal.weapons.get('rpg_7')?.action).not.toHaveProperty('disposable')
  })
})

describe('throwables', () => {
  it('a M67 explodes exactly at its 4 s fuse (Arsenal §13), bouncing on the way, and not a frame before', () => {
    const body = bodyOf(useOf('frag_grenade'))
    const early: ExplosiveEvent[] = []
    for (let t = 0; t < 3.9; t += FRAME) early.push(...body.step(FRAME, GROUND))
    expect(early.some((event) => event.type === 'detonate')).toBe(false)
    expect(early.filter((event) => event.type === 'impact').length).toBeGreaterThan(0)
    const detonation = detonationOf(run(body, GROUND))
    expect(detonation?.cause).toBe('timer')
    expect(detonation?.at).toBeCloseTo(4, 6)
    expect(detonation).toMatchObject({ lethalRadius: 5, injuryRadius: 15, energy: 200000 })
  })

  it('the fuse is cut by the step: one big step past it detonates once', () => {
    const body = bodyOf(useOf('pipe_bomb'))
    const events = body.step(10, undefined)
    expect(events.filter((event) => event.type === 'detonate')).toHaveLength(1)
    expect(detonationOf(events)?.at).toBeCloseTo(3, 9)
    expect(body.step(1)).toEqual([])
  })

  it('a molotov explodes on the first hit and leaves fire on an area of 4 m for 9 s (jogo.js fogoRes, 68068)', () => {
    const use = useOf('molotov')
    expect(use).toMatchObject({ kind: 'throw', trigger: 'impact', fuse: 0, fire: { radius: 4, seconds: 9 } })
    const detonation = detonationOf(run(bodyOf(use), GROUND))
    expect(detonation?.cause).toBe('impact')
    expect(detonation?.fire).toEqual({ temperature: 700, radius: 4, seconds: 9 })
    expect(detonation?.lethalRadius).toBe(0)
  })

  it('a flashbang stuns for 4 s inside 10 m and hurts nobody (Arsenal §13)', () => {
    const detonation = detonationOf(run(bodyOf(useOf('flashbang')), GROUND))
    if (!detonation) throw new Error('no detonation')
    expect(detonation.stunSeconds).toBe(4)
    const near = blastEffect(detonation, [detonation.point[0] + 6, detonation.point[1], detonation.point[2]])
    expect(near.zone).toBe('injury')
    expect(near.stunSeconds).toBe(4)
    expect(blastEffect(detonation, [detonation.point[0] + 11, detonation.point[1], detonation.point[2]]).zone).toBe('none')
    expect(detonation.energy).toBe(0)
  })

  it('bounces with the game restitution: the ground keeps 35% of the fall speed and 60% along the ground', () => {
    const body = bodyOf(useOf('frag_grenade'))
    body.step(FRAME, undefined)
    body.velocity = [0, -10, 5]
    body.position = [0, 0.05, 0]
    body.step(FRAME, GROUND)
    expect(body.velocity[1]).toBeCloseTo(0.35 * (10 + 9.8 * FRAME), 6)
    expect(body.velocity[2]).toBeCloseTo(0.6 * 5, 6)
  })
})

describe('placed charges', () => {
  it('a claymore waits for its wire and throws steel only inside a cone of 60° up to 50 m (Arsenal §13, Laboratório PROF)', () => {
    const use = useOf('claymore')
    expect(use).toMatchObject({ kind: 'place', triggers: ['wire'], cone: { halfAngleDeg: 30, length: 50 }, radius: 15, injuryRadius: 50 })
    const body = bodyOf(use)
    expect(run(body, GROUND, 60)).toEqual([])
    expect(body.trigger('remote')).toBeUndefined()
    const event = body.trigger('wire')
    expect(event?.type === 'detonate' && event.detonation.cause).toBe('wire')
    const detonation = event?.type === 'detonate' ? event.detonation : undefined
    if (!detonation) throw new Error('no detonation')
    const at = (forward: number, side: number): Vec3 => [detonation.point[0] + side, detonation.point[1], detonation.point[2] - forward]
    expect(blastEffect(detonation, at(10, 0)).zone).toBe('lethal')
    expect(blastEffect(detonation, at(30, 0))).toMatchObject({ zone: 'injury' })
    expect(blastEffect(detonation, at(30, 0)).falloff).toBeCloseTo(1 - (30 - 15) / (50 - 15), 9)
    expect(blastEffect(detonation, at(60, 0)).zone).toBe('none')
    expect(blastEffect(detonation, at(10, 10)).zone).toBe('none')
    expect(blastEffect(detonation, at(10, 5)).zone).toBe('lethal')
    expect(blastEffect(detonation, at(-5, 0)).zone).toBe('none')
    expect(body.trigger('wire')).toBeUndefined()
  })

  it('C4 only answers to the remote detonator (Arsenal §13) and keeps waiting without it', () => {
    const body = bodyOf(useOf('c4'))
    expect(run(body, GROUND, 120)).toEqual([])
    expect(body.trigger('timer')).toBeUndefined()
    expect(body.trigger('wire')).toBeUndefined()
    const event = body.trigger('remote')
    expect(event?.type === 'detonate' && event.detonation).toMatchObject({ cause: 'remote', energy: 345600, lethalRadius: 6, injuryRadius: 18, destructionLevel: 3 })
  })

  it('dynamite is thrown with a short safety fuse, about 4 s (0.03 m at 131 s/m, ±10%)', () => {
    const use = useOf('dynamite')
    expect(use).toMatchObject({ kind: 'throw', trigger: 'timer' })
    const fuse = use.kind === 'throw' ? use.fuse : 0
    expect(fuse).toBeGreaterThanOrEqual(0.03 * 131 * 0.9)
    expect(fuse).toBeLessThanOrEqual(0.03 * 131 * 1.1)
    expect(detonationOf(run(bodyOf(use), GROUND))?.at).toBeCloseTo(fuse, 6)
  })
})

describe('flamethrower (Galeria 3D: 9 s of fuel for the M2 and 5 s for the improvised one; range 6 m and ×0.6)', () => {
  it('streams at the range of the weapon, in a cone, and drains fuel per second until empty', () => {
    const weapon = arsenal.create('m2_flamethrower')
    expect(weapon.capacity).toBe(9)
    const first = weapon.trigger(ORIGIN, AIM, 1, true)
    expect(first.uses[0]).toMatchObject({ kind: 'flame', range: 6, cone: true, duration: 1, temperature: 900 })
    for (let second = 2; second <= 9; second++) expect(weapon.trigger(ORIGIN, AIM, 1, true).status).toBe('ok')
    expect(weapon.ammo).toBeCloseTo(0, 9)
    expect(weapon.trigger(ORIGIN, AIM, 1, true).status).toBe('no_fuel')
  })

  it('the improvised one reaches 60% as far and burns for 5 s; the last tick is cut to the fuel left', () => {
    const weapon = arsenal.create('improvised_flamethrower')
    expect(weapon.trigger(ORIGIN, AIM, 4, true).uses[0]).toMatchObject({ range: 3.6, duration: 4 })
    expect(weapon.trigger(ORIGIN, AIM, 4, true).uses[0]).toMatchObject({ duration: 1 })
    expect(weapon.ammo).toBe(0)
  })
})

describe('determinism', () => {
  it('the same throw gives the same events on every run', () => {
    const events = (): string => JSON.stringify(run(bodyOf(useOf('frag_grenade')), GROUND))
    expect(events()).toBe(events())
  })
})
