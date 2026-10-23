import { createRng, normalize, sampleCone } from './rng'
import type {
  CaliberDef,
  FireMode,
  Shot,
  TriggerResult,
  Use,
  Vec3,
  WeaponAction,
  WeaponDef,
  WeaponState,
} from './types'

const EPS = 1e-9
const DEFAULT_THROWABLES = 3
/** Total spread (base + bloom) never exceeds this many times the base spread. */
export const BLOOM_CAP = 4
/** Fraction of the throw speed added upwards so a throw arcs. */
const THROW_LIFT = 0.15

/** Muzzle energy in joules of ONE projectile (a bullet, or one pellet): 0.5 × mass × speed², speed scaled by the barrel factor. */
export const muzzleEnergy = (caliber: CaliberDef, barrel = 1): number => {
  const v = caliber.muzzleSpeed * barrel
  return 0.5 * (caliber.bulletGrams / 1000) * v * v
}

export interface WeaponStateInit {
  def: WeaponDef
  caliber: CaliberDef | null
  seed: number
  reserve?: number
}

const result = (status: TriggerResult['status'], extra: Partial<TriggerResult> = {}): TriggerResult => ({
  shots: [],
  uses: [],
  status,
  recoil: [0, 0],
  noise: 0,
  ...extra,
})

/** Runtime of one weapon. See `WeaponState` for the contract. */
export class WeaponRuntime implements WeaponState {
  readonly def: WeaponDef
  readonly caliber: CaliberDef | null
  reserve: number
  mode: FireMode
  private _ammo: number
  private readonly _capacity: number
  private readonly action: WeaponAction
  private readonly rng: () => number
  private readonly initialReserve: number

  private clock = 0
  /** Time already advanced by the other of update / trigger in the same frame (so calling both does not count `dt` twice). */
  private pend: { src: 'update' | 'trigger'; amt: number } | null = null
  private readyAt = 0
  private latched = false

  private _reloading = false
  private reloadEnd = 0

  /** Bloom degrees at `extraClock`. */
  private extra = 0
  private extraClock = 0

  constructor(init: WeaponStateInit) {
    this.def = init.def
    this.caliber = init.caliber
    this.action = init.def.action
    this.rng = createRng(init.seed)
    const a = this.action
    this.mode = a.kind === 'firearm' ? a.modes[0] ?? 'single' : 'single'
    switch (a.kind) {
      case 'firearm':
      case 'launcher':
        this._capacity = a.magazine
        break
      case 'flame':
      case 'heat':
        this._capacity = a.fuel
        break
      case 'extinguisher':
        this._capacity = a.charge
        break
      case 'throwable':
        this._capacity = a.count ?? DEFAULT_THROWABLES
        break
      default:
        this._capacity = 0
    }
    this._ammo = this._capacity
    this.initialReserve = init.reserve ?? (a.kind === 'firearm' ? a.magazine * 3 : 0)
    this.reserve = this.initialReserve
  }

  get ammo(): number {
    return this._ammo
  }
  get capacity(): number {
    return this._capacity
  }
  get reloading(): boolean {
    return this._reloading
  }
  get spread(): number {
    if (this.action.kind !== 'firearm') return 0
    return this.action.spreadDeg + this.extraAt(this.clock)
  }

  private extraAt(t: number): number {
    if (this.action.kind !== 'firearm') return 0
    const rec = this.action.recoveryDegPerS ?? 4
    return Math.max(0, this.extra - rec * Math.max(0, t - this.extraClock))
  }

  // --- time -----------------------------------------------------------------------------------------------------------------------

  update(dt: number): void {
    const d = Math.max(0, dt)
    let eff = d
    if (this.pend && this.pend.src === 'trigger') {
      eff = Math.max(0, d - this.pend.amt)
      this.pend = null
    } else {
      this.pend = { src: 'update', amt: d }
    }
    this.clock += eff
    this.settle(this.clock)
  }

  /** Complete the reload steps that finish at or before `t`. */
  private settle(t: number): void {
    const a = this.action
    if (a.kind !== 'firearm') return
    while (this._reloading && this.reloadEnd <= t + EPS) {
      if (a.perRound) {
        if (this.reserve > 0 && this._ammo < this._capacity) {
          this._ammo += 1
          this.reserve -= 1
        }
        if (this._ammo >= this._capacity || this.reserve <= 0) this._reloading = false
        else this.reloadEnd += a.reload
      } else {
        const take = Math.min(this._capacity - this._ammo, this.reserve)
        this._ammo += take
        this.reserve -= take
        this._reloading = false
      }
    }
  }

  // --- commands -------------------------------------------------------------------------------------------------------------------

  release(): void {
    this.latched = false
  }

  reload(): boolean {
    const a = this.action
    if (a.kind === 'throwable') {
      if (this._ammo >= this._capacity || this.reserve <= 0) return false
      this._ammo += 1
      this.reserve -= 1
      return true
    }
    if (a.kind !== 'firearm' || this._reloading) return false
    if (this._ammo >= this._capacity || this.reserve <= 0) return false
    this._reloading = true
    this.reloadEnd = this.clock + a.reload
    return true
  }

  cycleMode(): FireMode {
    if (this.action.kind !== 'firearm') return this.mode
    const modes = this.action.modes
    const i = modes.indexOf(this.mode)
    this.mode = modes[(i + 1) % modes.length] ?? this.mode
    return this.mode
  }

  refill(): void {
    this._ammo = this._capacity
    this.reserve = this.initialReserve
    this._reloading = false
    this.readyAt = this.clock
    this.latched = false
    this.extra = 0
  }

  // --- trigger --------------------------------------------------------------------------------------------------------------------

  trigger(origin: Vec3, direction: Vec3, dt: number, held = false, source?: string): TriggerResult {
    const d = Math.max(0, dt)
    let overlap = 0
    if (this.pend && this.pend.src === 'update') {
      overlap = Math.min(this.pend.amt, d)
      this.pend = null
    } else {
      this.pend = { src: 'trigger', amt: d }
    }
    const start = this.clock - overlap
    const end = start + d
    this.settle(start)

    const dir = normalize(direction)
    let res: TriggerResult
    const a = this.action
    switch (a.kind) {
      case 'firearm':
        res = this.fireFirearm(a, origin, dir, start, end, held, source)
        break
      case 'melee':
        res = this.fireMelee(a, origin, dir, start, end)
        break
      case 'flame':
      case 'heat':
        res = this.fireFuel(a, origin, dir, d)
        break
      case 'extinguisher':
        res = this.fireExtinguisher(a, origin, dir, d)
        break
      case 'throwable':
        res = this.fireThrowable(a, origin, dir, held)
        break
      case 'launcher':
        res = result('empty')
        break
      case 'tool':
        res = d > 0 ? result('ok', { uses: [{ kind: 'tool', tool: a.tool, reach: a.reach, duration: d, origin, direction: dir }], noise: a.noise }) : result('ok')
        break
      case 'hand':
        res = this.oncePerPull(held)
          ? result('ok', { uses: [{ kind: 'hand', reach: a.reach, origin, direction: dir }] })
          : result('cooldown')
        break
    }
    this.clock = Math.max(this.clock, end)
    this.settle(this.clock)
    return res
  }

  /** Semi-style gating: a held trigger that already fired does nothing until `release()` or a new pull (`held` false). */
  private oncePerPull(held: boolean): boolean {
    if (!held) this.latched = false
    if (this.latched) return false
    this.latched = true
    return true
  }

  private fireFirearm(a: Extract<WeaponAction, { kind: 'firearm' }>, origin: Vec3, dir: Vec3, start: number, end: number, held: boolean, source?: string): TriggerResult {
    if (this._reloading) {
      if (a.perRound && this._ammo > 0) this._reloading = false // a tube reload is interrupted by the trigger
      else return result('reloading')
    }
    const auto = this.mode === 'auto'
    if (!auto && !this.oncePerPull(held)) return result('cooldown')
    if (this._ammo <= 0) return result('empty')

    const iv = 60 / a.rpm
    const t0 = Math.max(start, this.readyAt)
    if (t0 > end + EPS) return result('cooldown')

    const res = result('ok')
    const fire = (t: number): void => {
      this.fireOne(a, origin, dir, t, res, source)
    }
    if (auto) {
      for (let t = t0, n = 0; this._ammo > 0 && (n === 0 ? t <= end + EPS : t < end - EPS); t += iv, n++) fire(t)
    } else if (this.mode === 'burst') {
      const count = Math.min(a.burst ?? 3, this._ammo)
      for (let k = 0; k < count; k++) fire(t0 + k * iv)
    } else {
      fire(t0)
    }
    return res
  }

  private fireOne(a: Extract<WeaponAction, { kind: 'firearm' }>, origin: Vec3, dir: Vec3, t: number, res: TriggerResult, source?: string): void {
    const cal = this.caliber as CaliberDef
    const barrel = a.barrel ?? 1
    const speed = cal.muzzleSpeed * barrel
    const energy = muzzleEnergy(cal, barrel)
    const drag = cal.dragPer100m ?? 0.1
    const energyAt = (distance: number): number => {
      const f = Math.pow(1 - drag, Math.max(0, distance) / 100)
      return energy * f * f
    }
    const bloomNow = this.extraAt(t)
    const spread = a.spreadDeg + bloomNow
    const aim = sampleCone(dir, spread, this.rng)
    const pellets = cal.pellets ?? 1
    const pelletSpread = pellets > 1 ? a.pelletSpreadDeg ?? 3 : 0
    for (let p = 0; p < pellets; p++) {
      const shot: Shot = {
        origin: [origin[0], origin[1], origin[2]],
        direction: sampleCone(aim, pelletSpread, this.rng),
        energy,
        caliber: cal.diameter,
        caliberId: cal.id,
        speed,
        energyAt,
        pellet: p,
        weapon: this.def.id,
      }
      if (source !== undefined) shot.source = source
      res.shots.push(shot)
    }
    this._ammo -= 1
    this.readyAt = t + 60 / a.rpm
    this.extra = Math.min(bloomNow + (a.bloomDeg ?? 0), a.spreadDeg * (BLOOM_CAP - 1))
    this.extraClock = t
    res.recoil = [res.recoil[0] + a.recoil[0], res.recoil[1] + (this.rng() * 2 - 1) * a.recoil[1]]
    res.noise = a.noise ?? cal.noise ?? 0
  }

  private fireMelee(a: Extract<WeaponAction, { kind: 'melee' }>, origin: Vec3, dir: Vec3, start: number, end: number): TriggerResult {
    const t0 = Math.max(start, this.readyAt)
    if (t0 > end + EPS) return result('cooldown')
    this.readyAt = t0 + 60 / a.rpm
    const use: Use = { kind: 'melee', damage: a.damage, energy: a.energy, radius: a.radius, reach: a.reach, origin, direction: dir }
    return result('ok', { uses: [use], noise: a.noise })
  }

  private fireFuel(a: Extract<WeaponAction, { kind: 'flame' | 'heat' }>, origin: Vec3, dir: Vec3, dt: number): TriggerResult {
    if (this._ammo <= EPS) return result('no_fuel')
    if (dt <= 0) return result('ok')
    const need = a.fuelPerSecond * dt
    let duration = dt
    if (need > this._ammo) {
      duration = dt * (this._ammo / need)
      this._ammo = 0
    } else {
      this._ammo -= need
    }
    const use: Use =
      a.kind === 'flame'
        ? { kind: 'flame', temperature: a.temperature, radius: a.radius, range: a.range, cone: a.cone ?? false, duration, origin, direction: dir }
        : { kind: 'heat', temperature: a.temperature, radius: a.radius, range: a.range, duration, origin, direction: dir }
    return result('ok', { uses: [use], noise: a.noise })
  }

  private fireExtinguisher(a: Extract<WeaponAction, { kind: 'extinguisher' }>, origin: Vec3, dir: Vec3, dt: number): TriggerResult {
    if (this._ammo <= EPS) return result('no_fuel')
    if (dt <= 0) return result('ok')
    const duration = Math.min(dt, this._ammo)
    this._ammo -= duration
    return result('ok', { uses: [{ kind: 'extinguish', range: a.range, coolC: a.coolC, duration, origin, direction: dir }], noise: a.noise })
  }

  private fireThrowable(a: Extract<WeaponAction, { kind: 'throwable' }>, origin: Vec3, dir: Vec3, held: boolean): TriggerResult {
    if (!this.oncePerPull(held)) return result('cooldown')
    if (this._ammo <= 0) return result('empty')
    this._ammo -= 1
    const velocity: Vec3 = [dir[0] * a.throwSpeed, dir[1] * a.throwSpeed + a.throwSpeed * THROW_LIFT, dir[2] * a.throwSpeed]
    const use: Use = { kind: 'throw', energy: a.energy, radius: a.radius, fuse: a.fuse, velocity, origin }
    if (a.fire) use.fire = { ...a.fire }
    return result('ok', { uses: [use], noise: a.noise })
  }
}
