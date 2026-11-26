/**
 * @adatechnology/game-animals: animals without an engine. The body spec of quadrupeds, birds and snakes, the gait phase tables, the alive / infected /
 * dead visual states, the rest-pose layout math and a species registry (packs, patch, remove). Species come from `game-animals-species`; the drawing is
 * `game-animals-three`.
 */
export type * from './types'
export { GAIT_PHASES } from './gaits'
export { birdSize, lineUpLength, quadrupedLayout } from './layout'
export type { QuadrupedLayout } from './layout'
export { createAnimals, visualStateOf } from './kit'
export type { AnimalKit } from './kit'
export { mergeById, applyPatches, removeIds } from './registry'
export type { Bone, Point, QuadrupedAnatomy } from './anatomy'
export { anatomyOf } from './anatomy'
export { ANIMAL_RAGDOLL_LIMITS, ragdollOfAnimal } from './ragdoll'
export type { SwingLimit } from './ragdoll'
export type { RagdollOfAnimalParams } from './ragdoll'
export { chainOfAnimal } from './chain'
export { corpseBodyKitOfAnimal } from './corpse-kit'
