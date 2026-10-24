import { isDudWithoutJam, rollFault } from './faults'
import { manualCycleSeconds, planRounds, weaponNoise, weaponSpeed } from './fire'
import { burstNoise, heatPerRound } from './heat'
import { sampleCone } from './rng'
import type { CaliberDef, FaultId, FirearmAction, Shot, TriggerResult, Vec3, WeaponRules } from './types'
import { WeaponAttachments } from './weapon-attachments'
import { BLOOM_CAP, EPS, result } from './weapon-shared'

// frames of one pull follow each other closely; a longer gap means the trigger was let go and the barrels start from rest again
const SPIN_PULL_GAP = 0.1

/** Pulling the trigger of a firearm: rounds, faults, heat, bloom and noise. */
export abstract class WeaponFirearm extends WeaponAttachments {
  /** Semi-style gating: a held trigger that already fired does nothing until `release()` or a new pull (`held` false). */
  private spinSince: number | undefined
  private spinFrameEnd = Number.NEGATIVE_INFINITY
  private lastRoundAt = Number.NEGATIVE_INFINITY

  /** When the barrels of a rotary gun are at speed: `upSeconds` after the pull began, and at once while they still spin from the last round. */
  private spunUpAt(spin: FirearmAction['spin'], start: number, end: number): number {
    if (!spin || start - this.lastRoundAt <= spin.holdSeconds + EPS) return 0
    if (this.spinSince === undefined || start - this.spinFrameEnd > SPIN_PULL_GAP) this.spinSince = start
    this.spinFrameEnd = end
    return this.spinSince + spin.upSeconds
  }

  protected oncePerPull(held: boolean): boolean {
    if (!held) this.latched = false
    if (this.latched) return false
    this.latched = true
    return true
  }

  protected fireFirearm(a: FirearmAction, origin: Vec3, dir: Vec3, start: number, end: number, held: boolean, source?: string): TriggerResult {
    if (this._reloading) {
      if (this.loadStep !== null && this._ammo > 0) this.stopReload(start) // a tube reload is interrupted by the trigger
      else return result('reloading')
    }
    if (this.mode !== 'auto' && !this.oncePerPull(held)) return result('cooldown')
    if (this._ammo <= 0) {
      this.emit({ type: 'empty', at: start })
      return result('empty')
    }

    const t0 = Math.max(start, this.readyAt, this.spunUpAt(a.spin, start, end))
    if (t0 > end + EPS) return result('cooldown')

    const res = result('ok')
    const times = planRounds(a, this.mode, this._ammo, t0, end)
    let lastAt = t0
    for (const t of times) {
      const fault = rollFault({ def: this.def, caliber: this.caliber, condition: this._condition, ammoQuality: this._ammoQuality, heat: this._heat, rules: this.faultRules(), random: this.faultRng })
      if (fault === 'misfire') {
        this.misfire(a, t, start, res)
        lastAt = t
        break
      }
      this.fireOne(this.action.kind === 'firearm' ? this.action : a, origin, dir, t, res, source)
      res.roundTimes.push(t - start)
      res.rounds += 1
      lastAt = t
      if (fault) {
        this.jam(fault, t, res)
        break
      }
    }
    if (res.shots.length === 0) res.status = res.fault ? 'fault' : 'misfire'
    else this.emit({ type: 'shot', shots: res.shots.length, rounds: res.rounds, mode: this.mode, at: t0, ...(res.suppressed ? { suppressed: true } : {}) })
    if (res.rounds > 0) {
      this.lastRoundAt = lastAt
      this.spinSince = undefined
      this.afterRounds(a, lastAt)
    }
    return res
  }

  /** The rules with the chance of a fault scaled by the accessories (a drum magazine jams more); the very rules when nothing scales it. */
  private faultRules(): WeaponRules {
    const factor = this.load.faultFactor
    if (factor === 1) return this.rules
    return { ...this.rules, faultChance: (context) => this.rules.faultChance(context) * factor }
  }

  protected jam(fault: FaultId, at: number, res: TriggerResult): void {
    this._fault = fault
    res.fault = fault
    this.emit({ type: 'fault', fault, at })
  }

  protected misfire(a: FirearmAction, at: number, start: number, res: TriggerResult): void {
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
  protected afterRounds(a: FirearmAction, lastAt: number): void {
    const cycle = manualCycleSeconds(a, this.mode)
    if (cycle > 0) {
      this.readyAt = Math.max(this.readyAt, lastAt + cycle)
      this._phase = { id: 'cycle', start: lastAt, end: lastAt + cycle }
      this.emit({ type: 'cycle', phase: 'start', at: lastAt })
      this.schedule({ at: lastAt + cycle, event: { type: 'cycle', phase: 'end', at: lastAt + cycle } })
    }
    if (this._ammo === 0 && a.family === 'pistol') this._locked = true
  }

  protected fireOne(a: FirearmAction, origin: Vec3, dir: Vec3, t: number, res: TriggerResult, source?: string): void {
    const cal = this.caliber as CaliberDef
    const isFirstRound = res.shots.length === 0
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
    this._heat = Math.min(this.rules.heat.cap, this._heat + heatPerRound(a, cal, this.rules.heat) * this.load.heatFactor)
    this.readyAt = t + 60 / a.rpm
    this.extra = Math.min(bloomNow + (a.bloomDeg ?? 0), a.spreadDeg * (BLOOM_CAP - 1))
    this.extraClock = t
    res.recoil = [res.recoil[0] + a.recoil[0], res.recoil[1] + (this.rng() * 2 - 1) * a.recoil[1]]
    const { window } = this.rules.noiseBurst
    this.recentShots = this.recentShots.filter((shotAt) => shotAt > t - window)
    res.noise = burstNoise(weaponNoise(a, cal), this.recentShots.length, this.rules.noiseBurst)
    this.recentShots.push(t)
    if (!this.load.suppressed) delete res.suppressed
    else if (isFirstRound) res.suppressed = true
    this.wearAttachments(t)
  }

}
