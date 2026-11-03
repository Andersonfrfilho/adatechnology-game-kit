import { createVehicleDestructible } from '@adatechnology/game-vehicles'
import type { VehicleContext, VehicleKit } from '@adatechnology/game-vehicles'
import { conditionFromDamage } from '@adatechnology/game-vehicles-driving'
import type { SemiDriver } from '@adatechnology/game-vehicles-driving'
import type { Vec3 } from '@adatechnology/game-contracts'

/** What the drive lane's car starts with: a tyre burst by a rifle round, that tyre already torn off, the same burst on an armoured car (run-flat), the brake fluid drained. */
export const LANE_DAMAGE = ['none', 'flat_tyre', 'torn_tyre', 'run_flat', 'no_brake_fluid'] as const
export type LaneDamage = (typeof LANE_DAMAGE)[number]

const RIFLE = { energy: 3500, caliber: 7.8, penetration: { steel: 18 } }
/** Far enough on a flat tyre to tear it off. */
const TEAR_OFF_M = 5000
/** Seconds the drained brake lines are left to empty. */
const DRAIN_S = 600

export type LaneDamageModel = {
  /** Drives the damage `dt` seconds at `speed` m/s and `throttle`, and gives the driver the condition it leaves. Answers where rims grind on the road. */
  step(params: { readonly dt: number; readonly speed: number; readonly throttle: number; readonly driver: SemiDriver }): Vec3[]
}

export type CreateLaneDamageParams = {
  readonly kit: VehicleKit
  /** The lane car drawn in full (the lite build has no parts to show the damage on), and the group that carries it. */
  readonly context: VehicleContext
  readonly frame: unknown
  readonly damage: Exclude<LaneDamage, 'none'>
}

/** The lane car's damage model, drawn on the car (the tyre sags or is gone), only while the lane has a damage set. */
export function createLaneDamage(params: CreateLaneDamageParams): LaneDamageModel {
  const d = createVehicleDestructible(params.kit, params.context, { id: 'lane', frame: params.frame, armour: params.damage === 'run_flat' ? 'IIIA' : null })
  const part = (prefix: string): string | undefined => (d.describe().parts as Array<{ id: string }>).find((p) => p.id.startsWith(prefix))?.id
  const shoot = (id: string | undefined): void => {
    if (id) d.hit({ type: 'ballistic', point: d.partWorldCenter(id), part: id, direction: [0, 0, 1], ...RIFLE })
  }
  if (params.damage === 'no_brake_fluid') {
    shoot(part('brakes'))
    for (let t = 0; t < DRAIN_S; t++) d.update?.(1)
  } else {
    shoot(part('tyre_front_left'))
    if (params.damage === 'torn_tyre') d.rollFlat(TEAR_OFF_M, 8)
  }
  return {
    step({ dt, speed, throttle, driver }) {
      d.rollFlat(speed * dt, speed)
      d.runEngine(dt, throttle)
      const events = d.update?.(dt) ?? []
      driver.condition = conditionFromDamage(driver.spec, d.driveReport())
      return events.flatMap((e) => (e.type === 'debris' && e.kind === 'sparks' ? [e.point] : []))
    },
  }
}
