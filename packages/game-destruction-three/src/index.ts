export { impactKey, dragSoundKey, createDestructionRenderer } from './renderer'
export { specFromObject3D } from './spec'
export type { PartHint } from './spec'
export { heatColor } from './heat'
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
  Quality,
  Quat,
  RendererOptions,
  SpecFromObjectOptions,
  SpecFromObjectResult,
  ThreeNamespace,
  Vec3,
} from './types'
export { BURN_LOOP, DESTRUCTION_SOUND_BANK, DRAG_SOUNDS, EXPLOSION_BOOM, SCENE_SOUNDS } from './audio/recipes'
export { DEFAULT_FIRE, DESTRUCTION_SOUND_KEYS, createDestructionSound } from './audio/sound'
export type { DestructionSound, DestructionSoundOptions, DestructionSoundStyle, SoundKeyRule } from './audio/sound'
