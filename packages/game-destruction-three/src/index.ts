export { impactKey, shotKey, dragSoundKey, createDestructionRenderer } from './renderer'
export { specFromObject3D } from './spec'
export type { PartHint } from './spec'
export { heatColor } from './heat'
export type { FragmentLifeRule } from './fragments'
import type { SpriteKind } from '@adatechnology/game-vfx'

/** Every particle kind the renderer can emit (the game's sprite kinds, see `@adatechnology/game-vfx`). */
export type ParticleKind = SpriteKind
export type {
  BindOptions,
  DestructionRenderer,
  ExplodeOptions,
  Mesh,
  MeshRange,
  Object3D,
  Piece,
  LooseBody,
  SolidBox,
  Quality,
  Quat,
  RendererOptions,
  SpecFromObjectOptions,
  SoundDetail,
  SpecFromObjectResult,
  ThreeNamespace,
  Vec3,
} from './types'
export { BURN_LOOP, DESTRUCTION_SOUND_BANK, DRAG_SOUNDS, EXPLOSION_BOOM, IMPACT_SOUNDS, SCENE_SOUNDS } from './audio/recipes'
export { IMPACT_FAMILY_TAGS, breakSoundKeys, impactFamily, impactSoundKeys, ricochetSoundKeys } from './audio/impact-keys'
export type { ImpactFamily, ImpactKeys } from './audio/impact-keys'
export { DEFAULT_CRACKLES, DEFAULT_FIRE, DEFAULT_INDOOR_CONFINEMENT, DESTRUCTION_SOUND_KEYS, IMPACT_SOUND_KEYS, createDestructionSound } from './audio/sound'
export {
  BIG_BLAST_RADIUS,
  BLAST_FALLOFF,
  BLAST_FAR_DISTANCE,
  BLAST_FAR_FALLOFF,
  BLAST_KINDS,
  BLAST_KIND_OF,
  BLAST_SOUNDS,
  BLAST_SOUND_OF,
  FIRE_FALLOFF,
  FIRE_LOOP,
  FIRE_SOUNDS,
} from './audio/blast-fire'
export type { BlastKind } from './audio/blast-fire'
export { BLAST_FIRE_SAMPLES, blastFireSampleBank } from './audio/samples'
export type { BlastFireSampleBankOptions, BlastFireSampleDefaults } from './audio/samples'
export type { DestructionSound, DestructionSoundOptions, DestructionSoundStyle, SoundKeyRule } from './audio/sound'
