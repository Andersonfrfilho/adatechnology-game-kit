import type { PhysicsContext } from './context'

const KNOCK_SECONDS = 1.5
const KNOCK_COOLDOWN = 2
const CRUSH_BLOW_EVERY = 0.25

export type PlayerPressure = {
  /** `load` is the N the horde passed on to the target in this step. */
  step(load: number): void
}

/**
 * The pressure of the horde on the target (D13.2): the exponential mean of what the agents pass on to it; above `knockThreshold` it knocks the target down, and the excess
 * crushes at `crushDamagePerSecond` through the same `CrowdTarget` verbs the agents already use. Off, nothing is called.
 */
export function createPlayerPressure(ctx: PhysicsContext): PlayerPressure {
  const options = ctx.options.playerPressure
  const tau = ctx.options.balance?.pressureTau ?? 0.3
  let knockCooldown = 0
  let crushed = 0
  let crushClock = 0

  const crush = (excess: number): void => {
    crushed += options.crushDamagePerSecond * excess * ctx.h
    crushClock += ctx.h
    if (crushClock < CRUSH_BLOW_EVERY) return
    crushClock = 0
    if (crushed <= 0) return
    ctx.target()?.hurt(crushed)
    crushed = 0
  }

  const step = (load: number): void => {
    ctx.stats.playerPressure += (load - ctx.stats.playerPressure) * (1 - Math.exp(-ctx.h / tau))
    if (!options.enabled) return
    const target = ctx.target()
    knockCooldown = Math.max(0, knockCooldown - ctx.h)
    if (!target || !target.state.alive || ctx.stats.playerPressure <= options.knockThreshold) {
      crushed = 0
      return
    }
    if (knockCooldown === 0) {
      target.knock(KNOCK_SECONDS)
      knockCooldown = KNOCK_COOLDOWN
    }
    crush(ctx.stats.playerPressure / options.knockThreshold - 1)
  }

  return { step }
}
