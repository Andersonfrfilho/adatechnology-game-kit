import type { Crowd } from './crowd'

/**
 * A corpse lies elsewhere than where it died (a blast pushed it): the ledger takes the new place and so does the mound, which is made again from it every fixed step, so
 * the horde climbs it where the body is drawn and where the engine has it. Call it inside the fixed step (the physics applier's `onSettled`); false when no corpse has that id.
 */
export const relocateCorpse = (crowd: Pick<Crowd, 'corpses'>, move: { readonly id: number; readonly x: number; readonly z: number; readonly yaw: number }): boolean => {
  const entry = crowd.corpses.entries.find((candidate) => candidate.id === move.id)
  return entry !== undefined && crowd.corpses.replace(move.id, { ...entry.data, x: move.x, z: move.z, yaw: move.yaw })
}
