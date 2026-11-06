import { DEFAULT_IGNITION_RULES } from '@adatechnology/game-contracts'
import type { FaultContext, WeaponRules } from './types'

// Physical model (2026-11-05): temperature above ambient in °C. Steel is 490 J/(kg·K); the shares, kg per metre and cooling constants are the kit's
// calibration against real references (an M4 reaches the warning in about 130 rounds of rapid fire, a pistol never does, a minigun shares six barrels).
const DEFAULT_HEAT: WeaponRules['heat'] = {
  cap: 900,
  displayMax: 750,
  faultFrom: 350,
  faultSpan: 200,
  specificHeat: 490,
  barrelShare: { shell: 0.48, big: 0.48, tiny: 0.3, pistol: 0.3, rifle: 0.48 },
  barrelKilogramsPerMetre: {
    pistol: 1.0,
    revolver: 1.4,
    smg: 1.2,
    carbine: 1.6,
    rifle: 1.6,
    dmr: 2.4,
    sniper: 2.4,
    hunting: 2.4,
    machine_gun: 3.0,
    shotgun: 1.1,
  },
  barrelFallback: { metres: 0.4, kilogramsPerMetre: 1.6 },
  cooling: { baseSeconds: 30, secondsPerKilogram: 250 },
  perRocket: 35,
  visual: { smokeFrom: 250, smokeSpan: 300, smokeSeconds: 2.5, glowFrom: 450, glowSpan: 300 },
}

/** The heat the Galeria 3D do Arsenal recorded (abstract units, hotter per round: a magazine was enough to glow); kept so the recorded runs stay reproducible. */
export const GALLERY_HEAT: WeaponRules['heat'] = {
  ...DEFAULT_HEAT,
  cap: 140,
  displayMax: 120,
  faultFrom: 60,
  faultSpan: 40,
  visual: { smokeFrom: 70, smokeSpan: 100, smokeSeconds: 2.5, glowFrom: 80, glowSpan: 40 },
  gallery: {
    perShot: { shell: 6, big: 9, tiny: 1.2, pistol: 3, rifle: 4.5 },
    decayBase: 1.6,
    decayPerPoint: 0.03,
  },
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
  aim: {
    base: 0.15,
    perKg: 0.05,
    hipSpread: 1,
    // the iron sights close the view in a little: more for a long gun, whose sights sit farther from the eye, than for a handgun
    ironSightZoom: { pistol: 1.1, revolver: 1.1, smg: 1.2, carbine: 1.25, shotgun: 1.15, rifle: 1.3, hunting: 1.35, dmr: 1.4, sniper: 1.4, machine_gun: 1.2, launcher: 1.15, bow: 1.15, crossbow: 1.25 },
  },
  // a weapon in each hand: the handguns, the machine pistols short and light enough for one hand, and the one-hand blades; one hand and no sight picture open the cone and lift the muzzle more
  dualWield: {
    categories: ['pistol', 'revolver'],
    weapons: ['mini_uzi', 'uzi', 'mac_10', 'vz61', 'hk_mp7a1', 'knife', 'tactical_knife', 'machete', 'hatchet'],
    exclude: [],
    spread: 1.8,
    recoil: 1.35,
  },
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
  // Modelo do kit (2026-10-24, decisão do dono): não existe tabela pública de ignição por cartucho. Ordem de grandeza: bala comum (chumbo com camisa de
  // cobre) quase nunca acende um tanque; núcleo de aço e perfurante (aço temperado, carbeto de tungstênio) faíscam em aço; incendiária e traçante
  // acendem por conta própria (a literatura de vulnerabilidade de tanques de combustível cita API como a munição que acende de fato). Troque por jogo.
  ignition: {
    core: { lead: 0.005, lead_steel: 0.04, steel: 0.12, hardened_steel: 0.25, tungsten_carbide: 0.25, copper: 0.01, none: 0 },
    jacket: { gilding_metal: 0.005, copper: 0.005, brass: 0.01, steel: 0.08, none: 0 },
    flame: { incendiary: DEFAULT_IGNITION_RULES.flameDefaults.incendiary, tracer: DEFAULT_IGNITION_RULES.flameDefaults.tracer },
  },
  draw: 0.35,
  clear: 1.2,
  startSafe: false,
}
