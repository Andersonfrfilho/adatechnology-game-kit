/**
 * @adatechnology/game-vfx-three: the three.js renderer of `@adatechnology/game-vfx`: the Explosion Lab's shaders, debris, shock, lights, marks and
 * screen overlay, plus a deformable ground patch and an `EffectSink` to lend to modules.
 */
export { createVfxRenderer, VFX_LAYERS } from './renderer'
/** @deprecated import from '@adatechnology/game-vfx-three/testing' */
export { createVfxTestModule } from './testing'
/** @deprecated import from '@adatechnology/game-vfx-three/testing' */
export type { VfxTestModuleOptions } from './testing'
/** @deprecated import from '@adatechnology/game-vfx-three/testing' */
export { benchText, benchTexts } from './testing'
/** @deprecated import from '@adatechnology/game-vfx-three/testing' */
export type { BenchText } from './testing'
export { createGroundPatch } from './ground-patch'
export type { GroundPatch, GroundPatchOptions } from './ground-patch'
export { createScreenOverlay } from './screen-overlay'
export type { ScreenOverlay } from './screen-overlay'
export { createSpriteLayer } from './sprites'
export type { SpriteLayer } from './sprites'
export { SPRITE_FRAGMENT, SPRITE_VERTEX } from './shaders/sprite'
export { createMarkLayer } from './marks'
export type { MarkLayer, MarkLayerOptions } from './marks'
export { PUFF_FRAGMENT, PUFF_VERTEX } from './shaders/puff'
export { SPARK_FRAGMENT, SPARK_VERTEX } from './shaders/spark'
export { GLOW_FRAGMENT, GLOW_VERTEX } from './shaders/glow'
export { RING_FRAGMENT, RING_VERTEX, SHELL_FRAGMENT, SHELL_VERTEX } from './shaders/shock'
export type { CanvasContextLike, CanvasLike, ThreeLib, VfxRenderer, VfxRendererOptions, VfxRendererStats } from './types'
