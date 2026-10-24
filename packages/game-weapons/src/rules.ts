import type { FaultContext, WeaponRules } from './types'

const DEFAULT_HEAT: WeaponRules['heat'] = {
  cap: 140,
  displayMax: 120,
  decayBase: 1.6,
  decayPerPoint: 0.03,
  faultFrom: 60,
  faultSpan: 40,
  perShot: { shell: 6, big: 9, tiny: 1.2, pistol: 3, rifle: 4.5 },
  perRocket: 35,
}

/** Chance of a fault for one round: the wear of the weapon, scaled by its reliability and by how hot it is. */
const defaultFaultChance = (context: FaultContext): number => {
  const factor = context.def.action.kind === 'firearm' ? context.def.action.faultFactor ?? 1 : 1
  const overheat = 1 + Math.max(0, context.heat - DEFAULT_HEAT.faultFrom) / DEFAULT_HEAT.faultSpan
  return context.condition.faultChance * factor * overheat
}

/** The rules the kit ships with; a game overrides any of them through `ArsenalOptions.rules`. */
export const DEFAULT_RULES: WeaponRules = {
  faults: true,
  conditions: [
    { id: 'new', faultChance: 0.003 },
    { id: 'used', faultChance: 0.015 },
    { id: 'worn', faultChance: 0.05 },
    { id: 'rusty', faultChance: 0.12 },
  ],
  defaultCondition: 'new',
  ammoQualities: [
    { id: 'factory', faultChance: 0 },
    { id: 'reloaded', faultChance: 0.08 },
  ],
  defaultAmmoQuality: 'factory',
  faultChance: defaultFaultChance,
  heat: DEFAULT_HEAT,
  noiseBurst: { step: 0.05, window: 3, cap: 0.5 },
  // jogo.js (Jogo) explosionsUpdate 68300-68312: vy -= 9,8·dt; chão vy·-0,35 e vx,vz·0,6; parede v·-0,4
  explosives: { gravity: 9.8, groundRestitution: 0.35, groundFriction: 0.6, wallRestitution: 0.4 },
  draw: 0.35,
  clear: 1.2,
  startSafe: false,
}
