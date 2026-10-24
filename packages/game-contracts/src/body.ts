/** The slots of a body an item can cover (the item slot vocabulary: game-items imports it from here). */
export type BodySlot = 'head' | 'eyes' | 'torso' | 'arms' | 'hands' | 'legs' | 'feet' | 'over'

/** The 11 segments of the detailed body model (the Arsenal ids). */
export type SegmentKind = 'head' | 'jaw' | 'neck' | 'torso' | 'pelvis' | 'upperArm' | 'forearm' | 'hand' | 'thigh' | 'shin' | 'foot'

/** The 6 regions of the crowd model (the game regions 0..5). */
export type BodyRegion = 'head' | 'torso' | 'armL' | 'armR' | 'legL' | 'legR'

/** Bits of the `missing` mask of a body. The instanced body shader reads them, so the values are part of the contract. */
export const MISSING_BITS = {
  head: 1,
  armL: 2,
  armR: 4,
  legL: 8,
  legR: 16,
  armLBroken: 32,
  armRBroken: 64,
  legLBroken: 128,
  legRBroken: 256,
  jaw: 512,
} as const
