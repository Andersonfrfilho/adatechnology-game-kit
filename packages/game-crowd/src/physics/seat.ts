import { identityOf } from '../identity'
import { applyNeutralPersonality, applyPersonality } from '../personality'
import type { CrowdStore } from '../store'
import { BALANCE } from '../types'
import type { CrowdPersonalityOptions } from './options'

/** The fields of the physics of a newborn: identity, mass and personality, all without a draw from the shared stream. */
export function seatPhysics(store: CrowdStore, i: number, born: { readonly seed: number; readonly serial: number; readonly baseMass: number; readonly personality: Required<CrowdPersonalityOptions> | null }): void {
  store.identity[i] = identityOf(born.seed, born.serial)
  store.mass[i] = born.baseMass * store.height[i]! * store.build[i]! ** 2
  store.balance[i] = BALANCE.STANDING
  store.balanceTimer[i] = store.pushX[i] = store.pushZ[i] = store.pressure[i] = store.field[i] = store.fieldPrev[i] = store.aimX[i] = store.aimZ[i] = store.directShove[i] = store.leanX[i] = store.leanZ[i] = 0
  store.fallCause[i] = 0
  store.blastStep[i] = -1
  store.thrown[i] = -1
  store.wounds[i] = 0
  store.stepDir[i] = 0
  store.prevX[i] = store.x[i]!
  store.prevZ[i] = store.z[i]!
  store.prevY[i] = 0
  if (born.personality) applyPersonality(store, i, born.personality)
  else applyNeutralPersonality(store, i)
}
