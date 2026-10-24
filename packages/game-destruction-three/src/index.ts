export { createDestructionRenderer } from './renderer'
export { specFromObject3D } from './spec'
export type { PartHint } from './spec'
export { heatColor } from './heat'
export type { ParticleKind } from './particles'
export type {
  BindOptions,
  DestructionRenderer,
  Mesh,
  MeshRange,
  Object3D,
  Piece,
  Quality,
  Quat,
  RendererOptions,
  SpecFromObjectOptions,
  SpecFromObjectResult,
  ThreeNamespace,
  Vec3,
} from './types'
export { BURN_LOOP, DESTRUCTION_SOUND_BANK, EXPLOSION_BOOM, SCENE_SOUNDS } from './audio/recipes'
export { DEFAULT_FIRE, DESTRUCTION_SOUND_KEYS, createDestructionSound } from './audio/sound'
export type { DestructionSound, DestructionSoundOptions, DestructionSoundStyle, SoundKeyRule } from './audio/sound'
