/**
 * A vehicle running into something: the energy of the crash, from the masses and the closing speed, becomes blunt hits spread over the
 * contact. A wide wall crushes the whole front evenly; a pillar or a post goes deep into a narrow strip; a lighter object takes most of
 * the change of speed and the vehicle little. Every number is configurable through `CrashRules`.
 */
import type { DestructionEvent, Vec3 } from '@adatechnology/game-contracts'
import type { VehicleDestructible } from './impl'

export type CrashRules = {
  /** Share of the deformation energy each blunt hit carries into the parts (the rest is the crumple of the structure itself). */
  readonly energyToDamage: number
  /** Width one blunt hit stands for, metres. */
  readonly hitSpacing: number
  /** Below this closing speed nothing deforms (a nudge), m/s. */
  readonly minSpeed: number
  /** Heights over the contact point the blow also lands at, metres: the bumper takes it first, the front above it (hood, lights, grille) after. */
  readonly rows: readonly number[]
  /** How far the front crushes per m/s of change of speed, metres (a car into a wall at 50 km/h folds about half a metre), and at most. */
  readonly crushPerMs: number
  readonly maxCrush: number
}

export const CRASH_RULES: CrashRules = { energyToDamage: 0.3, hitSpacing: 0.6, minSpeed: 1.5, rows: [0, 0.3], crushPerMs: 0.035, maxCrush: 0.6 }

export type CrashOptions = {
  /** Where the vehicle touched the obstacle, world space. */
  readonly point: Vec3
  /** The way the vehicle was moving into the obstacle, world space. */
  readonly direction: Vec3
  /** Closing speed, m/s. */
  readonly speed: number
  /** Mass of this vehicle, kg. */
  readonly massKg: number
  /** Mass of what it hit, kg (`Infinity` for a wall, a pillar or anything anchored). */
  readonly otherMassKg: number
  /** How wide the contact is, metres (a post 0.2, a wall the whole front). */
  readonly contactWidth: number
  readonly source?: string
  readonly rules?: Partial<CrashRules>
}

export type CrashResult = {
  /** Change of speed this vehicle takes, m/s. */
  readonly deltaV: number
  /** Deformation energy this vehicle takes, joules. */
  readonly energy: number
  readonly events: DestructionEvent[]
}

/** Change of speed of each body in a plastic collision: the lighter one takes more. */
export function crashDeltaV(speed: number, massKg: number, otherMassKg: number): number {
  if (!Number.isFinite(otherMassKg)) return speed
  return (speed * otherMassKg) / (massKg + otherMassKg)
}

export function crashVehicle(d: VehicleDestructible, crash: CrashOptions): CrashResult {
  const rules = { ...CRASH_RULES, ...crash.rules }
  const deltaV = crashDeltaV(crash.speed, crash.massKg, crash.otherMassKg)
  const energy = 0.5 * crash.massKg * deltaV * deltaV
  if (crash.speed < rules.minSpeed) return { deltaV, energy, events: [] }
  const [dx, , dz] = crash.direction
  const length = Math.hypot(dx, dz) || 1
  const across: Vec3 = [-dz / length, 0, dx / length]
  const hits = Math.max(1, Math.round(crash.contactWidth / rules.hitSpacing))
  const each = (energy * rules.energyToDamage) / (hits * rules.rows.length)
  const events: DestructionEvent[] = []
  for (const up of rules.rows)
    for (let i = 0; i < hits; i++) {
      const offset = hits === 1 ? 0 : (i / (hits - 1) - 0.5) * crash.contactWidth
      const point: Vec3 = [crash.point[0] + across[0] * offset, crash.point[1] + up, crash.point[2] + across[2] * offset]
      events.push(...d.hit({ type: 'blunt', point, direction: [dx / length, 0, dz / length], energy: each, radius: rules.hitSpacing / 2, ...(crash.source ? { source: crash.source } : {}) }))
    }
  // the drawn body folds by the crush the change of speed gives, over the contact
  const crush = Math.min(rules.maxCrush, deltaV * rules.crushPerMs)
  d.crumple(crash.point, [dx / length, 0, dz / length], crush)
  return { deltaV, energy, events }
}
