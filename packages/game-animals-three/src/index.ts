/**
 * @adatechnology/game-animals-three: the three.js drawing of the animals, a literal port of the Bichos do Vale builders (`quad`, `bird`, `snake`) and
 * their animation, with the alive / infected / dead looks for every species, the joints and split views, and a GPU node skin for crowds.
 */

export { ANIMAL_SOUND_BANK, ANIMAL_SOUNDS, COW_MOO, DOG_BARK, HEN_CLUCK, LAPWING_CALL } from './audio/recipes'
export { ANIMAL_CALLS, ANIMAL_CALL_SOURCES, createAnimalSound } from './audio/sound'
export type { AnimalCall, AnimalSound, AnimalSoundOptions, AnimalSoundSink } from './audio/sound'
export type { AnimalLeg, AnimalPivot, AnimalRig, AnimalWing, AnimalsThreeOptions, CanvasLike, DocumentLike, Three } from './types'
export type { AnimateParams } from './animate-types'
export type { BirdExtra, BirdParts, ExtraContext, QuadrupedExtra, QuadrupedParts } from './extras'
export { BIRD_EXTRAS, QUADRUPED_EXTRAS } from './extras'
export { lineUpAnimals } from './line-up'
export type { LineUpOptions } from './line-up'
export { profileGeometry } from './profile'
export { createCoatTexture } from './textures'
export { applyVisualState } from './visual-state'
export { setJointView, setSplit, updateSplit } from './views'

export type { AnimalsThree } from './animals-three'
export { createAnimalsThree } from './animals-three'
/** @deprecated import from '@adatechnology/game-animals-three/testing' */
export { createAnimalsTestModule, ANIMALS_AREA_ID, ANIMAL_ITEM_PREFIX } from './testing'
/** @deprecated import from '@adatechnology/game-animals-three/testing' */
export type { AnimalsContext } from './testing'
/** @deprecated import from '@adatechnology/game-animals-three/testing' */
export type { AnimalsTestOptions, OutbreakLike } from './testing'
