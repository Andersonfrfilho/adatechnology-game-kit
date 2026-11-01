import { blastShove } from '@adatechnology/game-contracts'

import { SALT, unit } from '../identity'
import { BALANCE, FALL_CAUSE, MISSING, STATE } from '../types'
import type { CrowdBlast, Region } from '../types'
import type { Balance } from './balance'
import type { PhysicsContext } from './context'
import type { Thrown, ThrownCandidate } from './thrown'

const CENTRE_HEIGHT = 1
const DISMEMBER_SHARE = 0.5
const LIMB_CHANCE = 0.5
const STUN_BASE = 0.45
const BLOOD_PER_BODY = 60
const LIMBS = [
  { bit: MISSING.ARM_L, region: 2 },
  { bit: MISSING.ARM_R, region: 3 },
  { bit: MISSING.LEG_L, region: 4 },
  { bit: MISSING.LEG_R, region: 5 },
] as const

export type Blasts = {
  enqueue(blast: CrowdBlast): void
  /** Resolves up to `maxBlastsPerStep` blasts in one linear pass over the agents; the rest waits for the next step. */
  resolve(): void
  pending(): number
}

type BlastTally = { reached: number; killed: number; fallen: number; limbEffects: number; bloodEffects: number; bloodSum: number }

export type BlastHooks = {
  readonly balance: Balance | null
  readonly thrown: Thrown | null
  pileBlast(x: number, z: number, radius: number): void
}

export function createBlasts(ctx: PhysicsContext, hooks: BlastHooks): Blasts {
  const { store } = ctx
  const options = ctx.options.blast
  const queue: CrowdBlast[] = []

  const emitLimb = (tally: BlastTally, i: number, region: number): void => {
    if (tally.limbEffects++ >= options.limbEffectsPerBlast) return
    ctx.emit('effect', { effect: 'limb', point: [store.x[i]!, store.height[i]! * 0.9, store.z[i]!], agent: i, region, severed: true })
  }

  const emitBlood = (tally: BlastTally, i: number): void => {
    if (tally.bloodEffects++ >= options.bloodEffectsPerBlast) {
      tally.bloodSum += BLOOD_PER_BODY
      return
    }
    ctx.emit('effect', { effect: 'blood', point: [store.x[i]!, store.height[i]! * 1.2, store.z[i]!], agent: i, amount: BLOOD_PER_BODY, died: true })
  }

  const kill = (i: number, blast: CrowdBlast, distance: number, tally: BlastTally): void => {
    tally.killed++
    store.hp[i] = 0
    if (blast.lethalRadius !== undefined && distance < DISMEMBER_SHARE * blast.lethalRadius) {
      for (let k = 0; k < LIMBS.length; k++) {
        if (unit(store.identity[i]!, ctx.step, SALT.LIMB + k) >= LIMB_CHANCE) continue
        store.missing[i]! |= LIMBS[k]!.bit
        emitLimb(tally, i, LIMBS[k]!.region)
      }
    }
    emitBlood(tally, i)
    ctx.deferKill(i)
  }

  /** Damage by the falloff, and a blow to a limb with half of it; returns true when the agent died. */
  const hurt = (i: number, blast: CrowdBlast, distance: number, index: number): boolean => {
    const falloff = (1 - distance / blast.radius) ** 2
    const amount = (blast.energy / 1000) * options.pointsPerKilojoule * falloff
    const draw = (salt: number) => () => unit(store.identity[i]!, ctx.step, salt)
    if (ctx.damage(i, { region: 1, amount, distance, cut: falloff }, draw(SALT.JAW + index)).died) return true
    const region = Math.floor(unit(store.identity[i]!, ctx.step, SALT.REGION + index) * 6) as Region
    return ctx.damage(i, { region, amount: amount / 2, distance, cut: falloff }, draw(SALT.JAW + 8 + index)).died
  }

  /** Sums the shove of every blast on the agent: `[vx, vy, vz]` of the body, or undefined when no blast moves it. */
  const shoveOf = (i: number, blasts: readonly CrowdBlast[]): { vx: number; vy: number; vz: number; falloff: number } | undefined => {
    const position: [number, number, number] = [store.x[i]!, store.y[i]! + CENTRE_HEIGHT * store.height[i]!, store.z[i]!]
    let vx = 0
    let vy = 0
    let vz = 0
    let falloff = 0
    for (const blast of blasts) {
      const shove = blastShove({ point: blast.point as [number, number, number], energy: blast.energy, radius: blast.radius }, { position, mass: store.mass[i]! }, options.shove)
      if (!shove) continue
      vx += shove.speed * shove.direction[0]
      vy += shove.speed * shove.direction[1]
      vz += shove.speed * shove.direction[2]
      falloff = Math.max(falloff, shove.falloff)
    }
    return vx || vy || vz ? { vx, vy, vz, falloff } : undefined
  }

  const distanceTo = (i: number, blast: CrowdBlast): number => Math.hypot(store.x[i]! - blast.point[0], store.y[i]! + CENTRE_HEIGHT * store.height[i]! - blast.point[1], store.z[i]! - blast.point[2])

  const applyShove = (i: number, shove: { vx: number; vy: number; vz: number; falloff: number }, candidates: ThrownCandidate[], tallies: BlastTally[], blasts: readonly CrowdBlast[]): void => {
    const horizontal = Math.hypot(shove.vx, shove.vz)
    const speed = Math.hypot(horizontal, shove.vy)
    store.directShove[i] = horizontal
    store.blastStep[i] = ctx.step
    const { balance, thrown } = hooks
    if (thrown && speed >= options.throwSpeed && (store.x[i]! - ctx.centre.x) ** 2 + (store.z[i]! - ctx.centre.z) ** 2 <= ctx.options.thrown!.radius ** 2) {
      candidates.push({ index: i, speed, vx: shove.vx, vy: shove.vy, vz: shove.vz, distance: Math.hypot(store.x[i]! - ctx.centre.x, store.z[i]! - ctx.centre.z) })
      return
    }
    if (store.hp[i]! <= 0) return
    if (!balance) {
      store.state[i] = STATE.STUNNED
      store.stateTimer[i] = STUN_BASE + shove.falloff
      store.vx[i] = shove.vx
      store.vz[i] = shove.vz
      return
    }
    store.pushX[i]! += shove.vx
    store.pushZ[i]! += shove.vz
    balance.shove(i, horizontal, FALL_CAUSE.BLAST)
    for (let b = 0; b < blasts.length; b++) if (distanceTo(i, blasts[b]!) <= blasts[b]!.radius && horizontal > ctx.options.balance!.shoveFall) tallies[b]!.fallen++
  }

  const affect = (i: number, blasts: readonly CrowdBlast[], tallies: BlastTally[], candidates: ThrownCandidate[]): void => {
    let dead = store.hp[i]! <= 0
    for (let b = 0; b < blasts.length && !dead; b++) {
      const blast = blasts[b]!
      const distance = distanceTo(i, blast)
      if (distance > blast.radius) continue
      tallies[b]!.reached++
      if (blast.lethalRadius !== undefined && distance < blast.lethalRadius) kill(i, blast, distance, tallies[b]!)
      else if (hurt(i, blast, distance, b)) tallies[b]!.killed++
      dead = store.hp[i]! <= 0 || dead
    }
    const shove = shoveOf(i, blasts)
    if (shove) applyShove(i, shove, candidates, tallies, blasts)
  }

  const resolve = (): void => {
    if (!queue.length) return
    const blasts = queue.splice(0, options.maxBlastsPerStep)
    const tallies: BlastTally[] = blasts.map(() => ({ reached: 0, killed: 0, fallen: 0, limbEffects: 0, bloodEffects: 0, bloodSum: 0 }))
    const candidates: ThrownCandidate[] = []
    ctx.lastBlastStep = ctx.step
    ctx.stats.blastChecks = store.n * blasts.length
    for (let i = 0; i < store.n; i++) if (store.balance[i] !== BALANCE.THROWN) affect(i, blasts, tallies, candidates)
    const thrown = hooks.thrown?.assign(candidates) ?? 0
    blasts.forEach((blast, b) => {
      const tally = tallies[b]!
      if (tally.bloodSum > 0) ctx.emit('effect', { effect: 'blood', point: [blast.point[0], blast.point[1], blast.point[2]], amount: tally.bloodSum, died: true })
      hooks.pileBlast(blast.point[0], blast.point[2], blast.radius)
      ctx.emit('blasted', {
        point: [blast.point[0], blast.point[1], blast.point[2]],
        radius: blast.radius,
        reached: tally.reached,
        killed: tally.killed,
        thrown: b === 0 ? thrown : 0,
        fallen: tally.fallen,
        ...(blast.chain === undefined ? {} : { chain: blast.chain }),
      })
      if (blast.chain !== undefined) ctx.stats.chainLinks++
    })
  }

  return { enqueue: (blast) => void queue.push(blast), resolve, pending: () => queue.length }
}
