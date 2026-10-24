export { createDestructionRenderer } from './renderer'
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
