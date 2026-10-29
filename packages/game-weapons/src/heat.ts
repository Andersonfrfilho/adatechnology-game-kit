import type { CaliberDef, WeaponAction, WeaponRules } from './types'

const SUBSTEP_SECONDS = 1 / 60

/** Cools a barrel: each step loses `decayBase + heat × decayPerPoint` per second (explicit Euler, in steps of at most 1/60 s). */
export const decayHeat = (heat: number, seconds: number, rules: WeaponRules['heat']): number => {
  const steps = Math.max(1, Math.ceil(seconds / SUBSTEP_SECONDS - 1e-9))
  const step = seconds / steps
  let current = heat
  for (let i = 0; i < steps && current > 0; i++) current = Math.max(0, current - step * (rules.decayBase + current * rules.decayPerPoint))
  return current
}

/** Heat one round adds: by the cartridge case, or a fixed amount for a rocket. A bow has no cartridge and adds none. */
export const heatPerRound = (action: WeaponAction, caliber: CaliberDef | null, rules: WeaponRules['heat']): number => {
  if (action.kind === 'launcher') return rules.perRocket
  return caliber?.caseType ? rules.perShot[caliber.caseType] : 0
}

/** Each shot in the last few seconds makes the next one louder, up to a cap. */
export const burstNoise = (base: number, recentShots: number, rules: WeaponRules['noiseBurst']): number => base * (1 + Math.min(rules.cap, rules.step * recentShots))
