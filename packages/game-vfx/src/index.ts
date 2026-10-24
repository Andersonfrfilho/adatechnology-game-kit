/**
 * @adatechnology/game-vfx: renderer-free visual effects, deterministic and testable in Node. The Explosion Lab's layer compositor and its pools, lights,
 * screen state, LOD and the game's area cap. The three.js renderer is `@adatechnology/game-vfx-three`.
 */
export { createVfx } from './world'
export type { ExplosionOptions, FireOptions, VfxOptions, VfxPoolsView, VfxWorld } from './world'
export { EXPLOSIONS, EXPLOSION_ALIASES, patchExplosions } from './catalog'
export { GAME_EFFECTS, WORKSHOP_EFFECTS, patchEffects } from './effects/catalog'
export { EVENT_EFFECTS } from './effects/events'
export { EVENT_EFFECTS_MAP, effectForEvent } from './effects/event-map'
export type { GameEvent } from './effects/event-map'
export { locales, resolveStrings } from './locale'
export type { EffectTexts, SheetLabels, VfxLocale, VfxStrings } from './locale'
export { createEffectPlayer } from './effects/player'
export type { EffectPlayer, EffectPlayerOptions, PlayOptions } from './effects/player'
export { EffectRunner } from './effects/runner'
export type { EffectRunnerOptions } from './effects/runner'
export { EffectInstance } from './effects/instance'
export type { EffectView, InstanceDeps, InstanceSetup } from './effects/instance'
export { EffectCamera } from './effects/camera'
export { WORKSHOP_BEHAVIORS, createWorkshopBehaviors } from './effects/behaviors'
export type { Behavior, BehaviorHost } from './effects/behavior'
export type { CueRequest, EffectDef, EffectStep } from './effects/types'
export { WorkshopEngine, workshopGround } from './workshop/engine'
export { RAIN_CAPACITY, RainField, WORKSHOP_PUDDLES, inPuddle } from './workshop/rain'
export type { Puddle } from './workshop/rain'
export type { LensBlob, Placement, PostProcess, WorkshopOptions } from './workshop/engine'
export type { Decal } from './workshop/decals'
export type { DebrisSpawn, DecalOptions, SpriteSpawn, SpriteSystem, Vec3Tuple, WorkshopContext, WorkshopTrace } from './workshop/types'
export { SPRITE_KINDS, patchSpriteKinds } from './sprites/kinds'
export type { SpriteGround, SpriteKind, SpriteKindDef } from './sprites/kinds'
export { SpriteKindPool } from './sprites/kind-pool'
export type { KindPoolHost, SpriteSpawnOptions } from './sprites/kind-pool'
export { SpriteKindSystem } from './sprites/system'
export type { LandListener, SpriteKindSystemOptions } from './sprites/system'
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
export type { Mark, MarkEvent, MarkStore, ScorchMark, DirtMark, RockMark, BloodMark } from './marks'
export type { BlastLight, FireLight, LightGlow, LightPool } from './lights'
export type { VfxTrace } from './trace'
export type { Puff, Ring } from './pools/puffs'
export type { Spark } from './pools/sparks'
export type { Glow } from './pools/glows'
export type { Chunk } from './pools/chunks'
export { colorOfChunk } from './pools/chunks'
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
