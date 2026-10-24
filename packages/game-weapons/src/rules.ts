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
  explosives: { gravity: 9.8, groundRestitution: 0.35, groundFriction: 0.6, wallRestitution: 0.4, placeFuseFrom: 10, tripwire: { length: 10, angleDeg: 0, height: 0.15 } },
  // Arsenal §11: montar e desmontar exige chave de fenda ou bancada; 2/15/30 s e a troca do lança-granadas (0,8 s) são padrões aprovados pelo dono (2026-10-24)
  attachments: { fitSeconds: { field: 2, tool: 15, bench: 30 }, switchSeconds: 0.8, speedOfSound: 343 },
  // Arsenal §08: tempo de mira = 0,15 s + 0,05 s por kg. O quadril do Arsenal é ×6 (o ZombiAdA liga isso por configuração); o SDK é neutro (1)
  aim: { base: 0.15, perKg: 0.05, hipSpread: 1 },
  // Arsenal §08/§11: coronha retrátil saca mais rápido, mais recuo; os números são padrões aprovados pelo dono (2026-10-24)
  stock: {
    seconds: 0.6,
    collapsed: [
      { stat: 'draw', mul: 0.8 },
      { stat: 'aim', mul: 0.85 },
      { stat: 'recoilVertical', mul: 1.3 },
      { stat: 'spread', mul: 1.15 },
    ],
  },
  draw: 0.35,
  clear: 1.2,
  startSafe: false,
}
