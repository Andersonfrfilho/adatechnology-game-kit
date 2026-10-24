import type { AmmoQualityDef, CaliberDef, ConditionDef, FaultId, ReloadFamily, WeaponDef, WeaponRules } from './types'

const MISFIRE_ONLY: ReadonlySet<ReloadFamily | undefined> = new Set(['revolver', 'break'])
const MANUAL: ReadonlySet<ReloadFamily | undefined> = new Set(['pump', 'bolt', 'bolt_magazine', 'lever'])
const MISFIRE_SHARE = 0.35
const STOVEPIPE_UPTO = 0.8

export interface FaultRoll {
  readonly def: WeaponDef
  readonly caliber: CaliberDef | null
  readonly condition: ConditionDef
  readonly ammoQuality: AmmoQualityDef
  readonly heat: number
  readonly rules: WeaponRules
  readonly random: () => number
}

/** Whether the round about to fire jams, and how. Only a weapon that fires cartridges can. */
export const rollFault = (roll: FaultRoll): FaultId | null => {
  const action = roll.def.action
  if (!roll.rules.faults || action.kind !== 'firearm' || !roll.caliber?.caseType) return null
  if (roll.random() < roll.rules.faultChance({ def: roll.def, condition: roll.condition, heat: roll.heat })) {
    const kind = roll.random()
    if (MISFIRE_ONLY.has(action.family) || kind < MISFIRE_SHARE) return 'misfire'
    if (MANUAL.has(action.family)) return 'failure_to_extract'
    return kind < STOVEPIPE_UPTO ? 'stovepipe' : 'double_feed'
  }
  return roll.ammoQuality.faultChance > 0 && roll.random() < roll.ammoQuality.faultChance ? 'misfire' : null
}

/** A dud in a revolver or a break-action just spends the round; anywhere else the round stays in the chamber and the weapon jams. */
export const isDudWithoutJam = (action: WeaponDef['action'], fault: FaultId): boolean => fault === 'misfire' && action.kind === 'firearm' && MISFIRE_ONLY.has(action.family)
