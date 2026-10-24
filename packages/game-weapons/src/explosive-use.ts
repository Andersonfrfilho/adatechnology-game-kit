import type { ExplosiveDef, Use, Vec3, WeaponAction, WeaponRules } from './types'
import { negate } from './vec'

type LauncherAction = Extract<WeaponAction, { kind: 'launcher' }>
type ThrowableAction = Extract<WeaponAction, { kind: 'throwable' }>

/** Fraction of the throw speed added upwards so a throw arcs. */
const THROW_LIFT = 0.15

const PLACED_TRIGGERS: ReadonlySet<string> = new Set(['wire', 'remote'])

const blastNumbers = (explosive: ExplosiveDef): Pick<Extract<Use, { kind: 'throw' }>, 'energy' | 'injuryRadius'> => ({
  energy: explosive.energy,
  injuryRadius: explosive.injuryRadius,
})

/** The rocket or grenade a launcher fires, plus the blast behind the tube when the launcher has one. */
export const launcherUses = (action: LauncherAction, explosive: ExplosiveDef | null, origin: Vec3, direction: Vec3): Use[] => {
  const velocity: Vec3 = [direction[0] * action.speed, direction[1] * action.speed, direction[2] * action.speed]
  const projectile: Use = {
    kind: 'throw',
    energy: explosive?.energy ?? 0,
    radius: explosive?.lethalRadius ?? 0,
    fuse: 0,
    velocity,
    origin,
    explosive: action.projectile,
    trigger: 'impact',
    armDistance: action.minArmDistance,
    ...(explosive ? { injuryRadius: explosive.injuryRadius } : {}),
  }
  if (action.backblast <= 0) return [projectile]
  return [projectile, { kind: 'backblast', radius: action.backblast, halfAngleDeg: action.backblastHalfAngleDeg ?? 180, origin, direction: negate(direction) }]
}

const TIMER_TRIGGERS: ReadonlySet<string> = new Set(['timer', ...PLACED_TRIGGERS])

/** Whether the explosive is set down instead of thrown: it waits for a trip wire or a detonator, or its fuse is so long that holding it makes no sense. */
export const isPlaced = (explosive: ExplosiveDef | null, fuse: number, rules: Pick<WeaponRules['explosives'], 'placeFuseFrom'>): boolean => {
  if (!explosive) return false
  if (explosive.triggers?.some((trigger) => PLACED_TRIGGERS.has(trigger))) return true
  return (explosive.triggers?.includes('timer') ?? false) && fuse >= rules.placeFuseFrom
}

export type ThrowableUseParams = {
  readonly action: ThrowableAction
  readonly explosive: ExplosiveDef | null
  readonly origin: Vec3
  readonly direction: Vec3
  /** Seconds of fuse of this throw (sampled, or what is left after cooking). */
  readonly fuse: number
  readonly rules: Pick<WeaponRules['explosives'], 'placeFuseFrom'>
}

const placedUse = ({ action, explosive, origin, direction, fuse }: ThrowableUseParams & { explosive: ExplosiveDef }): Use => ({
  kind: 'place',
  explosive: explosive.id,
  triggers: (explosive.triggers ?? []).filter((trigger): trigger is 'timer' | 'wire' | 'remote' => TIMER_TRIGGERS.has(trigger)),
  energy: explosive.energy,
  radius: explosive.lethalRadius,
  injuryRadius: explosive.injuryRadius,
  ...(explosive.cone ? { cone: { halfAngleDeg: explosive.cone.halfAngleDeg, length: explosive.cone.length } } : {}),
  ...(fuse > 0 && action.fuse > 0 ? { fuse } : {}),
  origin,
  direction,
})

/** One throw (or one charge set down) of a throwable: a fuse that counts from the throw, or an impact trigger when the fuse is 0. */
export const throwableUse = (params: ThrowableUseParams): Use => {
  const { action, explosive, origin, direction, fuse } = params
  if (explosive && isPlaced(explosive, fuse, params.rules)) return placedUse({ ...params, explosive })
  const velocity: Vec3 = [direction[0] * action.throwSpeed, direction[1] * action.throwSpeed + action.throwSpeed * THROW_LIFT, direction[2] * action.throwSpeed]
  const use: Extract<Use, { kind: 'throw' }> = { kind: 'throw', energy: action.energy, radius: action.radius, fuse, velocity, origin }
  if (action.fire) use.fire = { ...action.fire }
  if (!explosive) return use
  return {
    ...use,
    ...blastNumbers(explosive),
    radius: action.radius,
    explosive: explosive.id,
    trigger: fuse > 0 ? 'timer' : 'impact',
    armDistance: 0,
    ...(explosive.stunSeconds !== undefined ? { stunSeconds: explosive.stunSeconds } : {}),
  }
}
