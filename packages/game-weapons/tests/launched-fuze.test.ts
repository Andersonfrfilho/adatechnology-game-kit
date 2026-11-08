import { describe, expect, it } from 'vitest'
import { ExplosiveBody, createArsenal, sweepGround } from '../src'
import type { ExplosiveEvent, GroundHeight, SurfaceProbe, Use, Vec3 } from '../src'

const FRAME = 1 / 60
const arsenal = createArsenal({ rules: { faults: false, startSafe: false } })
const LAUNCHERS = [...arsenal.weapons.values()].filter((def) => def.action.kind === 'launcher' && def.action.projectile).map((def) => def.id)

/** Flat ground at y = 0, read along the whole step. */
const FLAT: GroundHeight = () => 0
const groundProbe =
  (groundAt: GroundHeight): SurfaceProbe =>
  (from, to) =>
    sweepGround(from, to, groundAt)

/** A wall on the plane z = `z` (facing +z), with flat ground under it. */
const wallAt =
  (z: number): SurfaceProbe =>
  (from, to) => {
    if (from[2] > z && to[2] <= z) {
      const k = (from[2] - z) / (from[2] - to[2])
      const point: Vec3 = [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, z]
      if (point[1] >= 0) return { point, normal: [0, 0, 1], ground: false }
    }
    return sweepGround(from, to, FLAT)
  }

/** A low kerb 0.3 m high and 0.2 m deep across the way at z = -5: thinner than one frame of a rocket's flight. */
const KERB: GroundHeight = (_x, z) => (z < -5 && z > -5.2 ? 0.3 : 0)

/** A crater 0.6 m deep and 1.5 m across at z = -6, as a blast leaves in loose ground. */
const CRATER_DEPTH = 0.6
const CRATER: GroundHeight = (x, z) => {
  const reach = Math.hypot(x, z + 6) / 1.5
  return reach >= 1 ? 0 : -CRATER_DEPTH * (1 - reach * reach)
}

const fire = (weaponId: string, origin: Vec3, direction: Vec3): ExplosiveBody => {
  const weapon = arsenal.create(weaponId)
  const use = weapon.trigger(origin, direction, 0, false).uses.find((one): one is Extract<Use, { kind: 'throw' }> => one.kind === 'throw')
  if (!use) throw new Error(`${weaponId} launched nothing`)
  const body = arsenal.explosiveBody(use)
  if (!body) throw new Error(`${weaponId} launched no explosive`)
  return body
}

const fly = (body: ExplosiveBody, probe: SurfaceProbe | undefined, limit = 30): ExplosiveEvent[] => {
  const events: ExplosiveEvent[] = []
  for (let t = 0; t < limit && !body.done; t += FRAME) events.push(...body.step(FRAME, probe))
  return events
}

const unit = (v: Vec3): Vec3 => {
  const size = Math.hypot(v[0], v[1], v[2])
  return [v[0] / size, v[1] / size, v[2] / size]
}
const downAt = (degrees: number): Vec3 => unit([0, -Math.tan((degrees * Math.PI) / 180), -1])

const expectBlast = (events: readonly ExplosiveEvent[], body: ExplosiveBody): Extract<ExplosiveEvent, { type: 'detonate' }> => {
  const blast = events.find((event): event is Extract<ExplosiveEvent, { type: 'detonate' }> => event.type === 'detonate')
  expect(blast, `events: ${events.map((event) => event.type).join(',')}`).toBeDefined()
  expect(events.some((event) => event.type === 'dud')).toBe(false)
  expect(body.done).toBe(true)
  return blast!
}

describe('every launched round goes off where it lands, whatever it hits and however close (no live round lying on the ground)', () => {
  it('the catalogue has the launchers the room hands out', () => {
    expect(LAUNCHERS).toEqual(expect.arrayContaining(['rpg_7', 'm72_law', 'at4', 'carl_gustaf_m4', 'm203', 'gp_25', 'ag36', 'm32_mgl', 'm79']))
  })

  for (const weaponId of LAUNCHERS) {
    describe(weaponId, () => {
      it('point blank into the ground at the feet', () => {
        const body = fire(weaponId, [0, 1.5, 0], downAt(80))
        const blast = expectBlast(fly(body, groundProbe(FLAT)), body)
        expect(blast.detonation.point[1]).toBeCloseTo(0, 3)
        expect(blast.detonation.cause).toBe('impact')
      })

      for (const degrees of [45, 15, 5, 1]) {
        it(`into flat ground ${degrees}° down (grazing at the shallow ones)`, () => {
          const body = fire(weaponId, [0, 1.5, 0], downAt(degrees))
          const blast = expectBlast(fly(body, groundProbe(FLAT)), body)
          expect(blast.detonation.point[1]).toBeCloseTo(0, 3)
        })
      }

      for (const distance of [1, 3, 8, 40]) {
        it(`into a wall ${distance} m away`, () => {
          const body = fire(weaponId, [0, 1.5, 0], [0, 0, -1])
          const blast = expectBlast(fly(body, wallAt(-distance)), body)
          expect(blast.detonation.point[2]).toBeCloseTo(-distance, 3)
        })
      }

      it('into a crater a blast dug: it goes off on the bottom, not on the rim nor under it', () => {
        const body = fire(weaponId, [0, 3, -3], unit([0, -3 - CRATER_DEPTH, -3]))
        const blast = expectBlast(fly(body, groundProbe(CRATER)), body)
        const [x, y, z] = blast.detonation.point
        expect(y).toBeCloseTo(CRATER(x, z), 3)
        expect(y).toBeLessThan(-CRATER_DEPTH * 0.8)
      })

      it('into a kerb thinner than one frame of its flight', () => {
        const body = fire(weaponId, [0, 0.2, 0], [0, 0, -1])
        const blast = expectBlast(fly(body, groundProbe(KERB)), body)
        expect(blast.detonation.point[2]).toBeLessThan(-4.9)
        expect(blast.detonation.point[2]).toBeGreaterThan(-5.25)
      })
    })
  }
})

describe('safety fuzes of a launched round', () => {
  const still = createArsenal({ rules: { faults: false, startSafe: false, explosives: { gravity: 0 } } })
  const pg7v = still.explosives.get('pg7v')
  if (!pg7v) throw new Error('no pg7v')
  const launched = (velocity: Vec3): ExplosiveBody => new ExplosiveBody({ explosive: pg7v, origin: [0, 1, 0], velocity, triggers: ['impact'], armDistance: 10, rules: still.rules.explosives })

  it('goes off when it is stopped where it is (a host that held it still)', () => {
    const body = launched([0, 0, -50])
    fly(body, undefined, 0.1)
    body.velocity = [0, 0, 0]
    const events = fly(body, undefined, 0.1)
    expect(expectBlast(events, body).detonation.cause).toBe('impact')
  })

  it('goes off when it barely moves for two steps: it came to rest on something', () => {
    const body = launched([0, 0, -0.001])
    const events = fly(body, undefined, 1)
    expect(expectBlast(events, body).at).toBeLessThan(3 * FRAME)
  })

  it('self-destructs after its flight time when it hits nothing', () => {
    const body = launched([0, 0, -100])
    const blast = expectBlast(fly(body, undefined, 60), body)
    expect(blast.detonation.cause).toBe('timer')
    expect(blast.at).toBeCloseTo(still.rules.explosives.selfDestructSeconds, 1)
  })

  it('does not go off at the top of a shot straight up: it stops there only for an instant', () => {
    const body = fire('m79', [0, 1.5, 0], [0, 1, 0])
    const blast = expectBlast(fly(body, undefined, 60), body)
    expect(blast.detonation.cause).toBe('timer')
  })
})

describe('sweepGround', () => {
  it('finds the ground in the middle of a step whose ends are both above it', () => {
    const hit = sweepGround([0, 0.2, 0], [0, 0.2, -10], KERB)
    expect(hit?.point[2]).toBeLessThan(-5)
    expect(hit?.point[2]).toBeGreaterThan(-5.01)
    expect(hit?.point[1]).toBeCloseTo(0.3, 6)
  })

  it('answers null for a step that stays above the ground, and the slope of the ground as the normal', () => {
    expect(sweepGround([0, 1, 0], [0, 1, -10], FLAT)).toBeNull()
    const slope: GroundHeight = (x) => x
    const hit = sweepGround([0, 1, 0], [2, 1, 0], slope)
    expect(hit?.normal[0]).toBeCloseTo(-Math.SQRT1_2, 3)
    expect(hit?.normal[1]).toBeCloseTo(Math.SQRT1_2, 3)
  })
})
