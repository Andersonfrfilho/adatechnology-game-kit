import { decayHeat } from './heat'
import { isReloadable } from './reload'
import { createRng } from './rng'
import type { AmmoQualityDef, CaliberDef, ConditionDef, ExplosiveDef, FaultId, FireMode, ReloadKind, WeaponAction, WeaponDef, WeaponEvent, WeaponPhase, WeaponRules } from './types'
import { EPS, FAULT_RNG_SALT, FUSE_RNG_SALT, findById } from './weapon-shared'
import type { Scheduled, WeaponStateInit } from './weapon-shared'

const DEFAULT_THROWABLES = 3

/** State and clock of one weapon: ammunition, phases, scheduled events and reload settling. Commands and firing are layered on top. */
export abstract class WeaponCore {
  readonly def: WeaponDef
  readonly caliber: CaliberDef | null
  reserve: number
  mode: FireMode
  protected _ammo: number
  protected readonly _capacity: number
  protected readonly action: WeaponAction
  protected readonly rng: () => number
  protected readonly initialReserve: number
  protected readonly rules: WeaponRules
  protected readonly faultRng: () => number
  protected readonly fuseRng: () => number
  /** Metres of safety fuse set by the host; replaces the `fuseLength` of the explosive. */
  protected fuseLengthOverride: number | undefined
  protected readonly explosive: ExplosiveDef | null

  protected clock = 0
  /** Time already advanced by the other of update / trigger in the same frame (so calling both does not count `dt` twice). */
  protected pend: { src: 'update' | 'trigger'; amt: number } | null = null
  protected readyAt = 0
  protected latched = false

  protected _reloading = false
  protected reloadEnd = 0
  /** Seconds per round while a one-by-one reload runs; null when the magazine goes in at once. */
  protected loadStep: number | null = null
  protected _locked = false
  protected reloadKind: ReloadKind = 'tactical'
  protected drawEnd = 0
  protected _phase: WeaponPhase | null = null
  protected _fault: FaultId | null = null
  protected _clearing = false
  protected _safety: boolean
  protected _heat = 0
  protected _condition: ConditionDef
  protected _ammoQuality: AmmoQualityDef
  /** Times of the shots that still count for the noise of a burst. */
  protected recentShots: number[] = []
  protected events: WeaponEvent[] = []
  protected scheduled: Scheduled[] = []

  /** Bloom degrees at `extraClock`. */
  protected extra = 0
  protected extraClock = 0

  constructor(init: WeaponStateInit) {
    this.def = init.def
    this.caliber = init.caliber
    this.action = init.def.action
    this.rules = init.rules
    this.rng = createRng(init.seed)
    this.faultRng = createRng((init.seed ^ FAULT_RNG_SALT) >>> 0)
    this.fuseRng = createRng((init.seed ^ FUSE_RNG_SALT) >>> 0)
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

  protected extraAt(t: number): number {
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

  protected emit(event: WeaponEvent): void {
    this.events.push(event)
  }

  protected schedule(item: Scheduled): void {
    const index = this.scheduled.findIndex((other) => other.at > item.at)
    if (index < 0) this.scheduled.push(item)
    else this.scheduled.splice(index, 0, item)
  }

  drain(): WeaponEvent[] {
    const drained = this.events.sort((a, b) => a.at - b.at)
    this.events = []
    return drained
  }

  protected advance(seconds: number): void {
    if (seconds <= 0) return
    this._heat = decayHeat(this._heat, seconds, this.rules.heat)
    this.clock += seconds
  }

  /** Complete what falls at or before `t`: scheduled events and the reload steps. */
  protected settle(t: number): void {
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

  protected finishReload(at: number): void {
    this._reloading = false
    this._locked = false
    this.emit({ type: 'reload', phase: 'end', kind: this.reloadKind, at })
  }

  protected stopReload(at: number): void {
    this._reloading = false
    this._phase = null
    this.scheduled = this.scheduled.filter((item) => item.tag !== 'reload')
    this.emit({ type: 'reload', phase: 'end', kind: this.reloadKind, at })
  }

  release(): void {
    this.latched = false
  }
}
