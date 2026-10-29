import { normalize } from './rng'
import type { ExplosiveDef, ExplosiveId, ExplosiveTrigger, Use, Vec3, WeaponRules } from './types'
import { distance, dot, length } from './vec'

const EPS = 1e-9

/** Everything a host needs to apply a blast: where, how big, in which direction, and what else it does. */
export interface Detonation {
  readonly explosive: ExplosiveId
  readonly cause: ExplosiveTrigger
  readonly point: Vec3
  /** The way a directional charge faces; for everything else the direction the body was moving (or facing when placed). */
  readonly direction: Vec3
  /** Seconds on the clock of the body. */
  readonly at: number
  readonly energy: number
  readonly lethalRadius: number
  readonly injuryRadius: number
  readonly noise: number
  readonly destructionLevel: ExplosiveDef['destructionLevel']
  readonly cone?: ExplosiveDef['cone']
  readonly stunSeconds?: number
  readonly fire?: ExplosiveDef['fire']
}

export type ExplosiveEvent =
  | { type: 'armed'; at: number; distance: number }
  | { type: 'impact'; at: number; point: Vec3; armed: boolean }
  /** Hit something before it was armed: it does not explode. */
  | { type: 'dud'; at: number; point: Vec3 }
  | { type: 'detonate'; at: number; detonation: Detonation }

/** The first surface the segment `from` to `to` crosses: where, its normal and whether it is ground (default: normal pointing up). */
export type SurfaceProbe = (from: Vec3, to: Vec3) => { point: Vec3; normal: Vec3; ground?: boolean } | null

export interface ExplosiveBodyInit {
  readonly explosive: ExplosiveDef
  readonly origin: Vec3
  /** Initial velocity in m/s; absent for something set down. */
  readonly velocity?: Vec3
  /** Facing of a placed charge (the cone of a mine). */
  readonly direction?: Vec3
  /** `timer`: explodes `fuse` seconds after it leaves the hand; `impact`: explodes on the first hit once armed; `wire`/`remote`: waits for `trigger()`. */
  readonly triggers: readonly ExplosiveTrigger[]
  readonly fuse?: number
  /** Metres to fly before an impact sets it off (rockets); 0 arms it at once. */
  readonly armDistance?: number
  readonly rules: WeaponRules['explosives']
}

const bounce = (velocity: Vec3, normal: Vec3, ground: boolean, rules: WeaponRules['explosives']): Vec3 => {
  const along = dot(velocity, normal)
  if (along >= 0) return velocity
  const restitution = ground ? rules.groundRestitution : rules.wallRestitution
  const friction = ground ? rules.groundFriction : 1
  const normalPart: Vec3 = [normal[0] * along, normal[1] * along, normal[2] * along]
  return [
    (velocity[0] - normalPart[0]) * friction - normalPart[0] * restitution,
    (velocity[1] - normalPart[1]) * friction - normalPart[1] * restitution,
    (velocity[2] - normalPart[2]) * friction - normalPart[2] * restitution,
  ]
}

/**
 * One explosive in flight or set down. `step` flies it (gravity, bounces off what `probe` finds) and counts the fuse; `trigger` sets off what waits
 * for a wire, a remote detonator, a bullet, fire or a nearby blast. Same inputs, same events: there is no randomness.
 */
export class ExplosiveBody {
  position: Vec3
  velocity: Vec3
  readonly explosive: ExplosiveDef
  private readonly triggers: ReadonlySet<ExplosiveTrigger>
  private readonly armDistance: number
  private readonly rules: WeaponRules['explosives']
  private facing: Vec3
  private clock = 0
  private flown = 0
  private fuseLeft: number | undefined
  private isArmed: boolean
  private isDone = false
  private isDud = false

  constructor(init: ExplosiveBodyInit) {
    this.explosive = init.explosive
    this.position = [init.origin[0], init.origin[1], init.origin[2]]
    this.velocity = init.velocity ? [init.velocity[0], init.velocity[1], init.velocity[2]] : [0, 0, 0]
    this.facing = normalize(init.direction ?? (init.velocity ? init.velocity : [0, 0, -1]))
    this.triggers = new Set(init.triggers)
    this.armDistance = init.armDistance ?? 0
    this.isArmed = this.armDistance <= 0
    this.fuseLeft = this.triggers.has('timer') ? init.fuse : undefined
    this.rules = init.rules
  }

  get age(): number {
    return this.clock
  }
  /** Metres flown so far. */
  get travelled(): number {
    return this.flown
  }
  get armed(): boolean {
    return this.isArmed
  }
  /** Exploded or turned out a dud: nothing more happens. */
  get done(): boolean {
    return this.isDone
  }
  get dud(): boolean {
    return this.isDud
  }
  /** Seconds until the timer sets it off, or undefined without one. */
  get fuseRemaining(): number | undefined {
    return this.fuseLeft
  }

  step(dt: number, probe?: SurfaceProbe): ExplosiveEvent[] {
    const events: ExplosiveEvent[] = []
    if (this.isDone) return events
    const seconds = Math.max(0, dt)
    const slice = this.fuseLeft === undefined ? seconds : Math.min(seconds, this.fuseLeft)
    this.fly(slice, probe, events)
    if (this.isDone) return events
    if (this.fuseLeft !== undefined) {
      this.fuseLeft -= slice
      if (this.fuseLeft <= EPS) events.push(this.detonate('timer'))
    }
    return events
  }

  /** Sets it off from outside; undefined when this explosive does not answer to `cause` or is already done. */
  trigger(cause: ExplosiveTrigger): ExplosiveEvent | undefined {
    if (this.isDone || !this.triggers.has(cause)) return undefined
    if (cause === 'impact' && !this.isArmed) return undefined
    return this.detonate(cause)
  }

  private moves(): boolean {
    return length(this.velocity) > EPS
  }

  private fly(seconds: number, probe: SurfaceProbe | undefined, events: ExplosiveEvent[]): void {
    if (seconds <= 0 || !this.moves()) {
      this.clock += Math.max(0, seconds)
      return
    }
    this.velocity = [this.velocity[0], this.velocity[1] - this.rules.gravity * seconds, this.velocity[2]]
    const next: Vec3 = [this.position[0] + this.velocity[0] * seconds, this.position[1] + this.velocity[1] * seconds, this.position[2] + this.velocity[2] * seconds]
    const hit = probe?.(this.position, next) ?? null
    const target = hit ? hit.point : next
    const moved = distance(this.position, target)
    const planned = distance(this.position, next)
    this.flown += moved
    this.position = [target[0], target[1], target[2]]
    const hitAt = this.clock + (hit && planned > EPS ? seconds * Math.min(1, moved / planned) : seconds)
    this.clock += seconds
    if (length(this.velocity) > EPS) this.facing = normalize(this.velocity)
    this.checkArmed(events)
    if (hit) this.onImpact(hit, hitAt, events)
  }

  private checkArmed(events: ExplosiveEvent[]): void {
    if (this.isArmed || this.flown < this.armDistance) return
    this.isArmed = true
    events.push({ type: 'armed', at: this.clock, distance: this.flown })
  }

  private onImpact(hit: NonNullable<ReturnType<SurfaceProbe>>, at: number, events: ExplosiveEvent[]): void {
    events.push({ type: 'impact', at, point: hit.point, armed: this.isArmed })
    if (this.triggers.has('impact')) {
      if (this.isArmed) events.push(this.detonate('impact', at))
      else {
        this.isDone = true
        this.isDud = true
        events.push({ type: 'dud', at, point: hit.point })
      }
      return
    }
    this.velocity = bounce(this.velocity, hit.normal, hit.ground ?? hit.normal[1] > 0.7, this.rules)
  }

  private detonate(cause: ExplosiveTrigger, at = this.clock): ExplosiveEvent {
    this.isDone = true
    const def = this.explosive
    const detonation: Detonation = {
      explosive: def.id,
      cause,
      point: [this.position[0], this.position[1], this.position[2]],
      direction: this.facing,
      at,
      energy: def.energy,
      lethalRadius: def.lethalRadius,
      injuryRadius: def.injuryRadius,
      noise: def.noise,
      destructionLevel: def.destructionLevel,
      ...(def.cone ? { cone: def.cone } : {}),
      ...(def.stunSeconds !== undefined ? { stunSeconds: def.stunSeconds } : {}),
      ...(def.fire ? { fire: def.fire } : {}),
    }
    return { type: 'detonate', at, detonation }
  }
}

/** The body of the explosive a `throw` or `place` use carries; undefined for any other use or an unknown explosive id. */
export const createExplosiveBody = (use: Use, explosives: ReadonlyMap<ExplosiveId, ExplosiveDef>, rules: WeaponRules['explosives']): ExplosiveBody | undefined => {
  if (use.kind === 'throw' && use.explosive !== undefined) {
    const explosive = explosives.get(use.explosive)
    if (!explosive) return undefined
    return new ExplosiveBody({
      explosive,
      origin: use.origin,
      velocity: use.velocity,
      triggers: [use.trigger ?? (use.fuse > 0 ? 'timer' : 'impact')],
      fuse: use.fuse,
      ...(use.armDistance !== undefined ? { armDistance: use.armDistance } : {}),
      rules,
    })
  }
  if (use.kind !== 'place') return undefined
  const explosive = explosives.get(use.explosive)
  if (!explosive) return undefined
  return new ExplosiveBody({ explosive, origin: use.origin, direction: use.direction, triggers: use.triggers, ...(use.fuse !== undefined ? { fuse: use.fuse } : {}), rules })
}
