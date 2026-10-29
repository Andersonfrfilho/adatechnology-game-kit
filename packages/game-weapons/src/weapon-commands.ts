import { ammoId } from './ammo'
import { clearSeconds, drawSeconds } from './fire'
import { isReloadable, planReload, reloadStages } from './reload'
import type { AmmoKind, FireMode, ReloadRequest } from './types'
import { WeaponCore } from './weapon-core'
import { EPS, findById } from './weapon-shared'

/** Commands that change the state of a weapon: safety, fault clearing, condition, draw, reload, fire mode and refill. */
export abstract class WeaponCommands extends WeaponCore {
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

  setAmmoKind(kind: AmmoKind): void {
    const cal = this.caliber
    if (!cal) throw new Error(`game-weapons: "${this.def.id}" has no calibre to load`)
    if (!this.ammoTable?.has(ammoId(cal.id, kind))) throw new Error(`game-weapons: no ammo "${ammoId(cal.id, kind)}" in the table`)
    this._ammoKind = kind
  }

  setFuseLength(metres: number | undefined): void {
    this.fuseLengthOverride = metres
  }

  /** Seconds to put the weapon in hand. */
  protected drawDuration(): number {
    return drawSeconds(this.action, this.rules)
  }

  draw(): void {
    const seconds = this.drawDuration()
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
    this.cook = null
    this.extra = 0
  }
}
