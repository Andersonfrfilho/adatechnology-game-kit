import { isDudWithoutJam, rollFault } from './faults'
import { clearSeconds, drawSeconds, manualCycleSeconds, planRounds, weaponNoise, weaponSpeed } from './fire'
import { burstNoise, decayHeat, heatPerRound } from './heat'
import { isReloadable, planReload, reloadStages } from './reload'
import { createRng, normalize, sampleCone } from './rng'
import type {
  AmmoQualityDef,
  CaliberDef,
  ConditionDef,
  ExplosiveDef,
  FaultId,
  FireMode,
  FirearmAction,
  ReloadKind,
  ReloadRequest,
  Shot,
  TriggerResult,
  Use,
  Vec3,
  WeaponAction,
  WeaponDef,
  WeaponEvent,
  WeaponPhase,
  WeaponRules,
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
  rules: WeaponRules
  /** What a launcher shoots. */
  explosive?: ExplosiveDef | null
  condition?: string
  ammoQuality?: string
}

/** Something that happens at a later time of the weapon clock. */
interface Scheduled {
  readonly at: number
  readonly tag?: 'reload'
  readonly event: WeaponEvent
  readonly apply?: () => void
}

const FAULT_RNG_SALT = 0x6a09e667

const findById = <TEntry extends { readonly id: string }>(entries: readonly TEntry[], id: string, label: string): TEntry => {
  const found = entries.find((entry) => entry.id === id)
  if (!found) throw new Error(`game-weapons: unknown ${label} "${id}"`)
  return found
}

const result = (status: TriggerResult['status'], extra: Partial<TriggerResult> = {}): TriggerResult => ({
  shots: [],
  uses: [],
  status,
  recoil: [0, 0],
  noise: 0,
  rounds: 0,
  roundTimes: [],
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
  private readonly rules: WeaponRules
  private readonly faultRng: () => number
  private readonly explosive: ExplosiveDef | null

  private clock = 0
  /** Time already advanced by the other of update / trigger in the same frame (so calling both does not count `dt` twice). */
  private pend: { src: 'update' | 'trigger'; amt: number } | null = null
  private readyAt = 0
  private latched = false

  private _reloading = false
  private reloadEnd = 0
  /** Seconds per round while a one-by-one reload runs; null when the magazine goes in at once. */
  private loadStep: number | null = null
  private _locked = false
  private reloadKind: ReloadKind = 'tactical'
  private drawEnd = 0
  private _phase: WeaponPhase | null = null
  private _fault: FaultId | null = null
  private _clearing = false
  private _safety: boolean
  private _heat = 0
  private _condition: ConditionDef
  private _ammoQuality: AmmoQualityDef
  /** Times of the shots that still count for the noise of a burst. */
  private recentShots: number[] = []
  private events: WeaponEvent[] = []
  private scheduled: Scheduled[] = []

  /** Bloom degrees at `extraClock`. */
  private extra = 0
  private extraClock = 0

  constructor(init: WeaponStateInit) {
    this.def = init.def
    this.caliber = init.caliber
    this.action = init.def.action
    this.rules = init.rules
    this.rng = createRng(init.seed)
    this.faultRng = createRng((init.seed ^ FAULT_RNG_SALT) >>> 0)
    this.explosive = init.explosive ?? null
    this._safety = init.rules.startSafe
    this._condition = findById(init.rules.conditions, init.condition ?? init.rules.defaultCondition, 'condition')
    this._ammoQuality = findById(init.rules.ammoQualities, init.ammoQuality ?? init.rules.defaultAmmoQuality, 'ammo quality')
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
    this.initialReserve = init.reserve ?? (isReloadable(a) ? a.magazine * 3 : 0)
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
  get locked(): boolean {
    return this._locked
  }
  get phase(): WeaponPhase | null {
    const phase = this._phase
    return phase && this.clock < phase.end - EPS ? phase : null
  }
  get fault(): FaultId | null {
    return this._fault
  }
  get clearing(): boolean {
    return this._clearing
  }
  get safety(): boolean {
    return this._safety
  }
  get heat(): number {
    return this._heat
  }
  get heatLevel(): number {
    return Math.min(1, this._heat / this.rules.heat.displayMax)
  }
  get condition(): string {
    return this._condition.id
  }
  get ammoQuality(): string {
    return this._ammoQuality.id
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
    this.advance(eff)
    this.settle(this.clock)
  }

  private emit(event: WeaponEvent): void {
    this.events.push(event)
  }

  private schedule(item: Scheduled): void {
    const index = this.scheduled.findIndex((other) => other.at > item.at)
    if (index < 0) this.scheduled.push(item)
    else this.scheduled.splice(index, 0, item)
  }

  drain(): WeaponEvent[] {
    const drained = this.events.sort((a, b) => a.at - b.at)
    this.events = []
    return drained
  }

  private advance(seconds: number): void {
    if (seconds <= 0) return
    this._heat = decayHeat(this._heat, seconds, this.rules.heat)
    this.clock += seconds
  }

  /** Complete what falls at or before `t`: scheduled events and the reload steps. */
  private settle(t: number): void {
    while (this.scheduled[0] && this.scheduled[0].at <= t + EPS) {
      const item = this.scheduled.shift() as Scheduled
      item.apply?.()
      this.emit(item.event)
    }
    const a = this.action
    if (!isReloadable(a)) return
    while (this._reloading && this.reloadEnd <= t + EPS) {
      const doneAt = this.reloadEnd
      if (this.loadStep !== null) {
        if (this.reserve > 0 && this._ammo < this._capacity) {
          this._ammo += 1
          this.reserve -= 1
          this.emit({ type: 'feed', at: doneAt })
        }
        if (this._ammo >= this._capacity || this.reserve <= 0) this.finishReload(doneAt)
        else this.reloadEnd += this.loadStep
      } else {
        const take = Math.min(this._capacity - this._ammo, this.reserve)
        this._ammo += take
        this.reserve -= take
        this.finishReload(doneAt)
      }
    }
  }

  private finishReload(at: number): void {
    this._reloading = false
    this._locked = false
    this.emit({ type: 'reload', phase: 'end', kind: this.reloadKind, at })
  }

  private stopReload(at: number): void {
    this._reloading = false
    this._phase = null
    this.scheduled = this.scheduled.filter((item) => item.tag !== 'reload')
    this.emit({ type: 'reload', phase: 'end', kind: this.reloadKind, at })
  }

  // --- commands -------------------------------------------------------------------------------------------------------------------

  release(): void {
    this.latched = false
  }

  setSafety(on: boolean): boolean {
    if (!isReloadable(this.action) || on === this._safety) return this._safety
    this._safety = on
    this.emit({ type: 'safety', on, at: this.clock })
    return on
  }

  clearFault(): boolean {
    const fault = this._fault
    if (!fault || this._clearing) return false
    const endAt = this.clock + clearSeconds(this.action, this.rules)
    this._clearing = true
    this._phase = { id: 'clear', start: this.clock, end: endAt }
    this.emit({ type: 'clear', fault, phase: 'start', at: this.clock })
    const finish = (): void => {
      this._fault = null
      this._clearing = false
      if (fault === 'misfire') this._ammo = Math.max(0, this._ammo - 1) // the dud is ejected
    }
    this.schedule({ at: endAt, event: { type: 'clear', fault, phase: 'end', at: endAt }, apply: finish })
    return true
  }

  setCondition(id: string): void {
    this._condition = findById(this.rules.conditions, id, 'condition')
  }

  setAmmoQuality(id: string): void {
    this._ammoQuality = findById(this.rules.ammoQualities, id, 'ammo quality')
  }

  draw(): void {
    const seconds = drawSeconds(this.action, this.rules)
    this.drawEnd = this.clock + seconds
    this._phase = { id: 'draw', start: this.clock, end: this.drawEnd }
    this.emit({ type: 'draw', phase: 'start', at: this.clock })
    this.schedule({ at: this.drawEnd, event: { type: 'draw', phase: 'end', at: this.drawEnd } })
  }

  reload(request: ReloadRequest = 'auto'): boolean {
    const a = this.action
    if (a.kind === 'throwable') {
      if (this._ammo >= this._capacity || this.reserve <= 0) return false
      this._ammo += 1
      this.reserve -= 1
      return true
    }
    if (!isReloadable(a) || this._reloading || this._fault || this._clearing || this.clock < this.drawEnd - EPS) return false
    if ((this._ammo >= this._capacity && !this._locked) || this.reserve <= 0) return false
    const plan = planReload(a, this._ammo, this._capacity, this.reserve, request)
    this._reloading = true
    this.loadStep = plan.step
    this.reloadKind = plan.kind
    this.reloadEnd = this.clock + plan.first
    this._phase = { id: 'reload', start: this.clock, end: this.clock + plan.total }
    this.emit({ type: 'reload', phase: 'start', kind: plan.kind, at: this.clock })
    for (const { stage, at } of reloadStages(a, plan, this.clock)) this.schedule({ at, tag: 'reload', event: { type: 'reload_stage', stage, at } })
    return true
  }

  cycleMode(): FireMode {
    if (this.action.kind !== 'firearm') return this.mode
    const modes = this.action.modes
    const i = modes.indexOf(this.mode)
    this.mode = modes[(i + 1) % modes.length] ?? this.mode
    this.emit({ type: 'mode', mode: this.mode, at: this.clock })
    return this.mode
  }

  refill(): void {
    this._ammo = this._capacity
    this.reserve = this.initialReserve
    this._reloading = false
    this._locked = false
    this._fault = null
    this._clearing = false
    this._phase = null
    this.scheduled = []
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
    const gate = this.gateStatus(start)
    if (gate) res = gate
    else switch (a.kind) {
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
        res = this.fireLauncher(a, origin, dir, start, held)
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
    this.advance(Math.max(0, end - this.clock))
    this.settle(this.clock)
    return res
  }

  /** Why the trigger does nothing before the action even looks at it. */
  private gateStatus(start: number): TriggerResult | null {
    if (start < this.drawEnd - EPS) return result('drawing')
    if (!isReloadable(this.action)) return null
    if (this._safety) return result('safe')
    if (this._clearing) return result('clearing')
    if (this._fault) return result('fault', { fault: this._fault })
    return null
  }

  /** Semi-style gating: a held trigger that already fired does nothing until `release()` or a new pull (`held` false). */
  private oncePerPull(held: boolean): boolean {
    if (!held) this.latched = false
    if (this.latched) return false
    this.latched = true
    return true
  }

  private fireFirearm(a: FirearmAction, origin: Vec3, dir: Vec3, start: number, end: number, held: boolean, source?: string): TriggerResult {
    if (this._reloading) {
      if (this.loadStep !== null && this._ammo > 0) this.stopReload(start) // a tube reload is interrupted by the trigger
      else return result('reloading')
    }
    if (this.mode !== 'auto' && !this.oncePerPull(held)) return result('cooldown')
    if (this._ammo <= 0) {
      this.emit({ type: 'empty', at: start })
      return result('empty')
    }

    const t0 = Math.max(start, this.readyAt)
    if (t0 > end + EPS) return result('cooldown')

    const res = result('ok')
    const times = planRounds(a, this.mode, this._ammo, t0, end)
    let lastAt = t0
    for (const t of times) {
      const fault = rollFault({ def: this.def, caliber: this.caliber, condition: this._condition, ammoQuality: this._ammoQuality, heat: this._heat, rules: this.rules, random: this.faultRng })
      if (fault === 'misfire') {
        this.misfire(a, t, start, res)
        lastAt = t
        break
      }
      this.fireOne(a, origin, dir, t, res, source)
      res.roundTimes.push(t - start)
      res.rounds += 1
      lastAt = t
      if (fault) {
        this.jam(fault, t, res)
        break
      }
    }
    if (res.rounds > 0) this.afterRounds(a, lastAt)
    if (res.shots.length === 0) res.status = res.fault ? 'fault' : 'misfire'
    else this.emit({ type: 'shot', shots: res.shots.length, rounds: res.rounds, mode: this.mode, at: t0 })
    return res
  }

  private jam(fault: FaultId, at: number, res: TriggerResult): void {
    this._fault = fault
    res.fault = fault
    this.emit({ type: 'fault', fault, at })
  }

  private misfire(a: FirearmAction, at: number, start: number, res: TriggerResult): void {
    if (!isDudWithoutJam(a, 'misfire')) {
      this.jam('misfire', at, res)
      return
    }
    this._ammo -= 1
    res.rounds += 1
    res.roundTimes.push(at - start)
    this.emit({ type: 'misfire', at })
  }

  /** Cooldown, the cycle of a manual action and the pistol slide that stays back on the last round. */
  private afterRounds(a: FirearmAction, lastAt: number): void {
    const cycle = manualCycleSeconds(a, this.mode)
    if (cycle > 0) {
      this.readyAt = Math.max(this.readyAt, lastAt + cycle)
      this._phase = { id: 'cycle', start: lastAt, end: lastAt + cycle }
      this.emit({ type: 'cycle', phase: 'start', at: lastAt })
      this.schedule({ at: lastAt + cycle, event: { type: 'cycle', phase: 'end', at: lastAt + cycle } })
    }
    if (this._ammo === 0 && a.family === 'pistol') this._locked = true
  }

  private fireOne(a: FirearmAction, origin: Vec3, dir: Vec3, t: number, res: TriggerResult, source?: string): void {
    const cal = this.caliber as CaliberDef
    const speed = weaponSpeed(a, cal)
    const energy = 0.5 * (cal.bulletGrams / 1000) * speed * speed
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
    this._heat = Math.min(this.rules.heat.cap, this._heat + heatPerRound(a, cal, this.rules.heat))
    this.readyAt = t + 60 / a.rpm
    this.extra = Math.min(bloomNow + (a.bloomDeg ?? 0), a.spreadDeg * (BLOOM_CAP - 1))
    this.extraClock = t
    res.recoil = [res.recoil[0] + a.recoil[0], res.recoil[1] + (this.rng() * 2 - 1) * a.recoil[1]]
    const { window } = this.rules.noiseBurst
    this.recentShots = this.recentShots.filter((shotAt) => shotAt > t - window)
    res.noise = burstNoise(weaponNoise(a, cal), this.recentShots.length, this.rules.noiseBurst)
    this.recentShots.push(t)
  }

  private fireLauncher(a: Extract<WeaponAction, { kind: 'launcher' }>, origin: Vec3, dir: Vec3, start: number, held: boolean): TriggerResult {
    if (this._reloading) return result('reloading')
    if (!this.oncePerPull(held)) return result('cooldown')
    if (this._ammo <= 0) {
      this.emit({ type: 'empty', at: start })
      return result('empty')
    }
    const t = Math.max(start, this.readyAt)
    this._ammo -= 1
    this._heat = Math.min(this.rules.heat.cap, this._heat + heatPerRound(a, null, this.rules.heat))
    const velocity: Vec3 = [dir[0] * a.speed, dir[1] * a.speed, dir[2] * a.speed]
    const use: Use = { kind: 'throw', energy: this.explosive?.energy ?? 0, radius: this.explosive?.lethalRadius ?? 0, fuse: 0, velocity, origin }
    this.emit({ type: 'shot', shots: 0, rounds: 1, mode: this.mode, at: t })
    return result('ok', { uses: [use], recoil: [a.recoil[0], a.recoil[1]], noise: a.noise ?? 0, rounds: 1, roundTimes: [t - start] })
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
