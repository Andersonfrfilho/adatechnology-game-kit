export { MIN_PIECE_MASS_KG, impactKey, shotKey, dragSoundKey, createDestructionRenderer, SUGGESTED_MAX_AWAKE_FRAGMENTS, SUGGESTED_MAX_AWAKE_PIECES } from './renderer'
export { isPhysicsLoop } from '@adatechnology/game-physics'
export { EVENT_CLASS } from './event-class'
export { EVENT_APPLY_WEIGHT, STRUCTURAL_UNITS_PER_FRAME, eventApplyWeight } from './event-weight'
export { BLAST_RAYS_PER_FRAME, BLAST_WAVE_PARTS_PER_FRAME, createBlastPacer } from './blast-pacer'
export type { BlastPacer, BlastPacerOptions, PacedBlast } from './blast-pacer'
export type { EventClass } from './event-class'
export { PhysicsOptionError } from './physics-option'
export { warmUpDestructionJit } from './jit-warmup'
export { createCoordinatorGroundPort, createInlineGroundPort, createMainThreadGroundPort, createWorkerGroundPort, installGroundWorker } from './engine-ground-port'
export { groundTilesKind, staticCollidersKind } from './worker-kinds'
export { measureStaticPart } from './static-part-job'
export type { StaticPartJob } from './static-part-job'
export type { GroundWorkerPort } from './engine-ground-port'
export { computeGroundTile, readGroundBand, readGroundPatch, bandLength } from './engine-ground-job'
export type { GroundPatchRead, GroundTileJob, GroundTileResult } from './engine-ground-job'
export { GROUND_WORKER_FRAMES } from './engine-pieces'
export type { JitWarmUpOptions, JitWarmUpReport } from './jit-warmup'
export type { PiecePhysics } from './physics-option'
export { BLAST_DEBRIS_DEFAULTS, WORK_UNIT_DEFAULTS, resolveBlastDebris, resolveWorkUnitCosts, physicsPieceCount, splitWorkUnits } from './blast-debris'
export type { BlastDebrisOptions, BlastWake, DebrisCostOptions, DebrisCostSample, ExplosionWorkOptions, FarDebrisAction, FarDebrisOptions, ResolvedBlastDebris, WorkUnitCosts } from './blast-debris'
export { DEFAULT_WORK_BUDGET_MS } from '@adatechnology/game-physics'
export { SETTLED_BATCH_DEFAULTS, SETTLED_BATCH_ORIGIN } from './settled-batches'
export type { SettledBatchOptions, SettledBatchStats } from './settled-batches'
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
  LoosenCause,
  DeferredQueueRegistration,
  MakePieceOptions,
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
export { DEFAULT_CRACKLES, DEFAULT_FIRE, DEFAULT_INDOOR_CONFINEMENT, FIRE_FADE_SECONDS, DESTRUCTION_SOUND_KEYS, IMPACT_SOUND_KEYS, blastSoundIds, createDestructionSound, impactSoundIds } from './audio/sound'
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
  GRENADE_PIN_PULL,
  ROCKET_MOTOR_LOOP,
  SMOKE_HISS_LOOP,
} from './audio/blast-fire'
export type { BlastKind } from './audio/blast-fire'
export { DESTRUCTION_VOICE_GROUPS, IMPACT_BURST_GROUP } from './audio/voice-groups'
export { BLAST_FIRE_SAMPLES, blastFireSampleBank } from './audio/samples'
export type { BlastFireSampleBankOptions, BlastFireSampleDefaults } from './audio/samples'
export type { DestructionSound, DestructionSoundOptions, DestructionSoundStyle, SoundKeyRule } from './audio/sound'
