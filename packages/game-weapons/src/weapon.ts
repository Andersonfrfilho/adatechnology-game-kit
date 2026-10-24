import { isPlaced, launcherUses, throwableUse } from './explosive-use'
import { sampleFuse } from './fuse'
import { heatPerRound } from './heat'
import { isReloadable } from './reload'
import { normalize } from './rng'
import type { TriggerResult, Use, Vec3, WeaponAction, WeaponState } from './types'
import { WeaponFirearm } from './weapon-firearm'
import type { WeaponCore } from './weapon-core'
import { EPS, result } from './weapon-shared'

export { BLOOM_CAP, muzzleEnergy } from './weapon-shared'
export type { WeaponStateInit } from './weapon-shared'

/** Runtime of one weapon. See `WeaponState` for the contract. */
export class WeaponRuntime extends WeaponFirearm implements WeaponState {
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
        res = this.fireThrowable(a, origin, dir, held, start, end)
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
  protected gateStatus(start: number): TriggerResult | null {
    if (start < this.drawEnd - EPS) return result('drawing')
    if (this.isWorking()) return result('busy')
    if (!isReloadable(this.action)) return null
    if (this._safety) return result('safe')
    if (this._clearing) return result('clearing')
    if (this._fault) return result('fault', { fault: this._fault })
    return null
  }

  protected fireLauncher(a: Extract<WeaponAction, { kind: 'launcher' }>, origin: Vec3, dir: Vec3, start: number, held: boolean): TriggerResult {
    if (this._reloading) return result('reloading')
    if (!this.oncePerPull(held)) return result('cooldown')
    if (this._ammo <= 0) {
      this.emit({ type: 'empty', at: start })
      return result('empty')
    }
    const t = Math.max(start, this.readyAt)
    this._ammo -= 1
    this._heat = Math.min(this.rules.heat.cap, this._heat + heatPerRound(a, null, this.rules.heat))
    this.emit({ type: 'shot', shots: 0, rounds: 1, mode: this.mode, at: t })
    return result('ok', { uses: launcherUses(a, this.explosive, origin, dir), recoil: [a.recoil[0], a.recoil[1]], noise: a.noise ?? 0, rounds: 1, roundTimes: [t - start] })
  }

  protected fireMelee(a: Extract<WeaponAction, { kind: 'melee' }>, origin: Vec3, dir: Vec3, start: number, end: number): TriggerResult {
    const t0 = Math.max(start, this.readyAt)
    if (t0 > end + EPS) return result('cooldown')
    this.readyAt = t0 + 60 / a.rpm
    const use: Use = { kind: 'melee', damage: a.damage, energy: a.energy, radius: a.radius, reach: a.reach, origin, direction: dir }
    return result('ok', { uses: [use], noise: a.noise })
  }

  protected fireFuel(a: Extract<WeaponAction, { kind: 'flame' | 'heat' }>, origin: Vec3, dir: Vec3, dt: number): TriggerResult {
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

  protected fireExtinguisher(a: Extract<WeaponAction, { kind: 'extinguisher' }>, origin: Vec3, dir: Vec3, dt: number): TriggerResult {
    if (this._ammo <= EPS) return result('no_fuel')
    if (dt <= 0) return result('ok')
    const duration = Math.min(dt, this._ammo)
    this._ammo -= duration
    return result('ok', { uses: [{ kind: 'extinguish', range: a.range, coolC: a.coolC, duration, origin, direction: dir }], noise: a.noise })
  }

  /** The fuse of this throw: sampled from the explosive when it has a range or a burn, else the fixed one of the action. */
  protected sampleThrowFuse(a: Extract<WeaponAction, { kind: 'throwable' }>): number {
    return (this.explosive ? sampleFuse(this.explosive, this.fuseRng, this.fuseLengthOverride) : undefined) ?? a.fuse
  }

  protected throwUse(a: Extract<WeaponAction, { kind: 'throwable' }>, origin: Vec3, dir: Vec3, fuse: number, extra: { cooked?: number; inHand?: boolean } = {}): TriggerResult {
    return result('ok', { uses: [throwableUse({ action: a, explosive: this.explosive, origin, direction: dir, fuse, rules: this.rules.explosives, ...extra })], noise: a.noise })
  }

  /** A timer throwable is cooked from the pull; impact, remote and wire ones (and a long fuse that sets down) act at once. */
  protected fireThrowable(a: Extract<WeaponAction, { kind: 'throwable' }>, origin: Vec3, dir: Vec3, held: boolean, start: number, end: number): TriggerResult {
    if (this.cook) return this.cookStep(a, origin, dir, end)
    if (!this.oncePerPull(held)) return result('cooldown')
    if (this._ammo <= 0) return result('empty')
    const fuse = this.sampleThrowFuse(a)
    if (fuse <= 0 || isPlaced(this.explosive, fuse, this.rules.explosives)) {
      this._ammo -= 1
      return this.throwUse(a, origin, dir, fuse)
    }
    this.cook = { start, fuse, origin, direction: dir }
    this.emit({ type: 'cook', phase: 'start', fuse, at: start })
    return this.cookStep(a, origin, dir, end)
  }

  /** The trigger stays down on a cooked throwable: nothing happens until the fuse runs out in the hand. */
  protected cookStep(a: Extract<WeaponAction, { kind: 'throwable' }>, origin: Vec3, dir: Vec3, now: number): TriggerResult {
    const cook = this.cook as NonNullable<WeaponCore['cook']>
    cook.origin = origin
    cook.direction = dir
    if (now - cook.start < cook.fuse - EPS) return result('ok')
    return this.burstInHand(a, cook, origin, dir)
  }

  protected burstInHand(a: Extract<WeaponAction, { kind: 'throwable' }>, cook: NonNullable<WeaponCore['cook']>, origin: Vec3, dir: Vec3): TriggerResult {
    this.cook = null
    this._ammo -= 1
    this.emit({ type: 'cook', phase: 'burst', fuse: 0, at: cook.start + cook.fuse })
    return this.throwUse(a, origin, dir, 0, { cooked: cook.fuse, inHand: true })
  }

  release(origin?: Vec3, direction?: Vec3): TriggerResult | null {
    super.release()
    const cook = this.cook
    const a = this.action
    if (!cook || a.kind !== 'throwable') return null
    const from = origin ?? cook.origin
    const dir = direction ? normalize(direction) : cook.direction
    const held = this.clock - cook.start
    if (held >= cook.fuse - EPS) return this.burstInHand(a, cook, from, dir)
    this.cook = null
    this._ammo -= 1
    const remaining = cook.fuse - held
    this.emit({ type: 'cook', phase: 'throw', fuse: remaining, at: this.clock })
    return this.throwUse(a, from, dir, remaining, { cooked: held })
  }
}
