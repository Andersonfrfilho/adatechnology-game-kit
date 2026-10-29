import type { CaseType, ReloadFamily } from '@adatechnology/game-weapons'
import type { ModelFamily, ModelParts } from '../models/types'

/** What the clips of a weapon are written from: its model (parts and mechanism), its calibre's case and how its rule reloads it. */
export interface ClipContext {
  readonly parts: ModelParts
  readonly family: ModelFamily
  readonly caseType: CaseType
  readonly reloadFamily: ReloadFamily | undefined
}

/** Recoil strength by case size, when the model has none of its own (the page's `kickOf`). */
export const KICK_BY_CASE: Record<CaseType, number> = { shell: 1.6, big: 2.4, tiny: 0.3, pistol: 0.7, rifle: 1.1 }

export const kickOf = (context: ClipContext): number => context.parts.kick ?? KICK_BY_CASE[context.caseType]

/** Families whose slide or bolt blows back with each shot. */
export const BLOWBACK: ReadonlySet<ModelFamily> = new Set(['pistol', 'rifle', 'semiint', 'semi12', 'p90', 'belt'])
export const HAS_CYCLE: ReadonlySet<ModelFamily> = new Set(['pump', 'bolt', 'boltmag', 'lever'])
// the gallery's travel of the pump, of the bolt and of the lever, and the bolt handle's turn (page values)
export const PUMP_TRAVEL = -0.075
export const BOLT_TRAVEL = -0.07
export const BOLT_TURN = -1.15
export const LEVER_TURN = -0.85

/** How far the slide or bolt travels back (the page's `-(P.stroke || .06)`). */
export const strokeOf = (parts: ModelParts): number => -(parts.stroke || 0.06)

/** The part that blows back: the slide of a pistol, the bolt of the rest. */
export const blowbackPart = (context: ClipContext): 'slide' | 'bolt' => (context.family === 'pistol' ? 'slide' : 'bolt')
