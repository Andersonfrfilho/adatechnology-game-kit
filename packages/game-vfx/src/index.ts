/**
 * @adatechnology/game-vfx: renderer-free visual effects, deterministic and testable in Node. The Explosion Lab's layer compositor and its pools, lights,
 * screen state, LOD and the game's area cap. The three.js renderer is `@adatechnology/game-vfx-three`.
 */
export { createVfx } from './world'
export type { ExplosionOptions, FireOptions, VfxOptions, VfxPoolsView, VfxWorld } from './world'
export { EXPLOSIONS, EXPLOSION_ALIASES, patchExplosions } from './catalog'
export { composeExplosion } from './explosion'
export type { ExplosionCall } from './explosion'
export { lehmer, lcg, streamFor } from './random'
export type { MutableVec3, RandomStream } from './random'
export { hexToLinearRgb, hexToRgb } from './color'
export { createGroundField } from './ground'
export type { GroundField, GroundFieldOptions } from './ground'
export { AREA_CAP_GAME, createAreaCap } from './area-cap'
export type { AreaCapTracker } from './area-cap'
export { LOD_GAME, LOD_LAB, lodScale } from './lod'
export { EVENT_BUDGET, PROFILES, estimateCost } from './budget'
export { createSchedule } from './schedule'
export type { Schedule } from './schedule'
export { createScreenState, updateScreen } from './screen'
export { OrderedPool } from './pool'
export { SMOKE_COLORS } from './constants'
export type { Mark, MarkStore, ScorchMark, DirtMark, RockMark, BloodMark } from './marks'
export type { BlastLight, FireLight, LightGlow, LightPool } from './lights'
export type { Puff, Ring } from './pools/puffs'
export type { Spark } from './pools/sparks'
export type { Glow } from './pools/glows'
export type { Chunk } from './pools/chunks'
export type { Shock } from './pools/shocks'
export type { Fire } from './emitters/fire'
export { VFX_LAYERS } from './types'
export type {
  AreaCap,
  ExplosionDef,
  FireSpec,
  Follow,
  LodBands,
  MushroomSpec,
  Rgb,
  ScreenState,
  Vec3Like,
  VfxLayer,
  VfxProfile,
  VfxProfileName,
  VfxSideRequest,
  VfxStats,
} from './types'
