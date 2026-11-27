/**
 * @adatechnology/game-contracts: the contracts every game module (vehicles, furniture, plants, houses, weapons) depends on, and nothing else.
 * Types plus tiny pure checkers, no runtime dependencies. The default destruction world, the renderers and the test room are optional.
 */
export type {
  ChainDelay,
  Crack,
  DamageStage,
  DamageType,
  DebrisKind,
  BendHinge,
  Dent,
  DestructibleSpec,
  BlastCasing,
  BlastCharge,
  BlastOptions,
  BlastReport,
  ConfinementOptions,
  ExplosionChain,
  FragmentHitOptions,
  ShelterOptions,
  DestructionEvent,
  DestructionEventType,
  FluidKind,
  Fragment,
  FragmentMark,
  FractureStyle,
  BallisticExtras,
  Hit,
  HitIgnition,
  HitResult,
  Hole,
  JointKind,
  JointSpec,
  JointState,
  MaterialId,
  ObjectState,
  PartAperture,
  PartShape,
  PartSpec,
  CarryHands,
  PartBreach,
  PartState,
  PartStatus,
  PartUnits,
  Quat,
  RayHit,
  Reinforcement,
  TensionRebar,
  TunedMassDamper,
  WindExposure,
  WindState,
  PileSpec,
  GroundLoss,
  PartSettlement,
  SoilLayer,
  SoilProfile,
  SoilState,
  StructureRole,
  SurfaceLayer,
  ToolKind,
  Vec3,
} from './destruction'
export type { BusyOptions, BusySink, BusyTask } from './busy'
export { blastShove, DEFAULT_BLAST_SHOVE } from './blast-shove'
export { chargeFireball, fireballDose, fuelFireball, ignitionDose } from './fireball'
export { TNT_JOULES, reflectedLoad, waveWork } from './blast-wave'
export type { WaveLoad, WaveWork, WaveWorkInput } from './blast-wave'
export type { Fireball } from './fireball'
export { bodyMass, FRAGMENT_COVER, KNOCK_CHEST, KNOCK_DOWN_SPEED, KNOCKED_DOWN_ANGLE, knockOf, launchBody, stepKnock, takeLaunch } from './blast-knock'
export { blastBodySpeed, bodyImpulse, DEFAULT_BLAST_IMPULSE, sideOnImpulse, sideOnOverpressure } from './blast-impulse'
export type { BlastImpulseOptions } from './blast-impulse'
export type { Knock } from './blast-knock'
export type { BlastShove, BlastShoveOptions, BlastSource } from './blast-shove'
export { IMPACT_CONTRACT, checkDestructible, checkHit } from './impact'
export type { CheckOptions, DestructibleImpl, DrawnCollider, ImpactContract, SurfaceRay, SurfaceRayHit } from './impact'
export type { CostOptions } from './impact-cost'
export type { ToolCondition } from './tool-condition'
export { MISSING_BITS } from './body'
export type { BodyRegion, BodySlot, SegmentKind } from './body'
export { FIT_REJECT_REASONS, SEAT_ROLES } from './body-measures'
export type { BodyMeasures, DoorOpening, FitRejectReason, FitResult, SeatRole, SeatSpace } from './body-measures'
export { checkSpec } from './spec'
export type { CheckSpecOptions, SpecReport } from './spec'
export { shotToHit, shotExtras, useToHit } from './weapons'
export { DEFAULT_IGNITION_RULES, fillFactor, ignitionChance, resolveIgnitionRules, sparkTargetFactor } from './ignition'
export type { IgnitionRules } from './ignition'
export type { Shot, Use } from './weapons'
export type { ContainerSpec, ItemUseDef, LiquidId } from './fluids'
export { sealBlock, sealOpener } from './seal'
export type { SealBlock, SealSpec, SealState } from './seal'
export type { HandPose, HandTargetSource, HandTargets, MuzzlePose, MuzzleSource, ToolHand } from './hands'
export { FIRST_PERSON_LAYER } from './hands'
export { TWIST_LIFT, twistStroke } from './twist'
export type { TwistOptions, TwistStroke } from './twist'
export type { EffectHandle, EffectPose, EffectRequest, EffectSink, Enclosure, EnclosureBox } from './effects'
export type { WarmUpProbes } from './warm-up'
export { checkAnimation } from './animation'
export type { AnimationClipSpec, AnimationEventSpec, AnimationKey, AnimationPose, ItemAnimationContract } from './animation'
export { STAGE_EVENT, TOOL_CLIP, checkToolClips, createToolClipPlayer, leadClipEvents, sampleClip, scaleClip, toolAnimationStep } from './tool-animation'
export type { ToolAnimationStep, ToolAnimator, ToolClipId, ToolClipPlayer, ToolClipPlayerOptions, ToolClipSet, ToolRig } from './tool-animation'
export { DEFERRED_PRIORITY, DEFERRED_QUEUE_ID, FRAME_PHASES, MUST_DRAIN_QUEUE_IDS, checkDeferredQueue, drainDetached } from './frame'
export type { DeferredQueue, DeferredQueueOptions, DeferredQueueReport, FramePhase } from './frame'
export type { FrameOptions, AreaPlacement, GroundExcavation, GroundLayout, GroundZone, HostEvent, HostGraphics, HostTool, HostToolAttachment, CornerImage, ModuleArea, ModuleHost, HostMovable, HostShove, ModuleView, ModuleItemFluid, ModuleItemSeal, ModuleScenario, PlayerState, ItemSeat, ItemSounds, TestableItem, TestableModule, Thumbnail, ToolCommand, ToolCommandResult, HostReach, HostTakenItem, HostTap } from './module'
export { applyPatches, deepMerge, mergeById, removeIds } from './registry'
export type { DeepPartial } from './registry'
import { resetWarnOnce as resetWarnOnceForTests } from './warn'

export { warnOnce } from './warn'
/** @deprecated Import it from `@adatechnology/game-contracts/testing`. */
export const resetWarnOnce = resetWarnOnceForTests
export { checkBench } from './bench'
export type {
  ActionControl,
  BenchChange,
  BenchDeclaration,
  BenchReport,
  BenchSheet,
  BooleanControl,
  ChoiceControl,
  ChoiceOption,
  ControlPatch,
  ControlValue,
  ModuleBench,
  ModuleControl,
  ModuleLayer,
  ModuleMetric,
  NumberControl,
} from './bench'
export type { AudioListener, AudioSink, LoopHandle, SoundHandle, SoundRequest } from './audio'
export { DEFAULT_ENVIRONMENT, createEnvironmentBus } from './environment'
export type { EnvironmentBus, EnvironmentKey, EnvironmentState } from './environment'
export { checkCategorized, defineCategories, resolveEntry } from './categories'
export type { CategorizedOptions, CategorizedReport, CategoryDef, CategoryOptions, CategoryRegistry, ContractChecker, ContractContext } from './categories'
export { KIT_ORIGIN_KEY, kitOriginOf, markKitOrigin, unmarkedDrawings } from './origin'
export type { KitOrigin, UnmarkedDrawing } from './origin'
export { footprintBlocker, footprintSolid } from './footprint'
export { createFixedFootprintRainCover, createFootprintRainCover, createGridRainCover, createRainCover, rainCoverTopOf } from './rain-cover'
export type { FootprintRainCoverSource, GridRainCoverOptions, GridRainCoverSource, RainCover, RainCoverBounds, RainCoverFootprint, RainCoverHole, RainCoverRect, RainCoverSource } from './rain-cover'
export type { UtilityConnection, UtilityNetwork } from './utility'
export type { Footprint, FootprintObject, HostSolid } from './footprint'
export { NAV_OBSTACLE_KIND } from './nav-obstacles'
export type { NavObstacle, NavObstacleBox, NavObstacleKind, NavObstacleSource } from './nav-obstacles'
export {
  BLOW_IDS,
  BODY_FOLEY_IDS,
  BODY_SOUND_IDS,
  DEFAULT_SURFACE,
  FOOTSTEP_SOUND_IDS,
  GAIT_IDS,
  HEAVY_LANDING_SPEED,
  LANDING_IDS,
  LAND_SOUND_IDS,
  MATERIAL_SURFACES,
  SURFACE_IDS,
  SWING_LEAD_SECONDS,
  footstepSoundId,
  hitSoundId,
  isSurfaceId,
  landSoundId,
  surfaceOfMaterial,
  swingSoundId,
} from './foley'
export type { BlowId, BlowTarget, BodyFoleyId, BodySoundId, FootstepSoundId, GaitId, LandSoundId, LandingId, SurfaceId } from './foley'
export { WORKER_INPUT_LOST, WORKER_KIND_DEFAULTS, WORKER_KIND_ID, WORKER_LANES, WORKER_LATE_RULES, isWorkerInputLost } from './workers'
export type { AnyResidentKind, AnySimModule, AnyTaskKind, AnyWorkerKind, ResidentHandle, ResidentInstance, ResidentKind, SimInstance, SimModule, TaskHandle, TaskKind, WorkerCoordinator, WorkerCoordinatorStats, WorkerKindSchedule, WorkerKindStats, WorkerLane, WorkerLateRule, WorkerResultSource } from './workers'
