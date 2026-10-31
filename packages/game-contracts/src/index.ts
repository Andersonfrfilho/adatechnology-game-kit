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
  Dent,
  DestructibleSpec,
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
  PartShape,
  PartSpec,
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
export type { BlastShove, BlastShoveOptions, BlastSource } from './blast-shove'
export { IMPACT_CONTRACT, checkDestructible, checkHit } from './impact'
export type { CheckOptions, DestructibleImpl, ImpactContract } from './impact'
export { MISSING_BITS } from './body'
export type { BodyRegion, BodySlot, SegmentKind } from './body'
export { checkSpec } from './spec'
export type { CheckSpecOptions, SpecReport } from './spec'
export { shotToHit, shotExtras, useToHit } from './weapons'
export { DEFAULT_IGNITION_RULES, fillFactor, ignitionChance, resolveIgnitionRules, sparkTargetFactor } from './ignition'
export type { IgnitionRules } from './ignition'
export type { Shot, Use } from './weapons'
export type { ContainerSpec, ItemUseDef, LiquidId } from './fluids'
export { sealBlock, sealOpener } from './seal'
export type { SealBlock, SealSpec, SealState } from './seal'
export type { HandPose, HandTargetSource, HandTargets } from './hands'
export type { EffectHandle, EffectRequest, EffectSink } from './effects'
export type { WarmUpProbes } from './warm-up'
export { checkAnimation } from './animation'
export type { AnimationClipSpec, AnimationEventSpec, AnimationKey, AnimationPose, ItemAnimationContract } from './animation'
export { STAGE_EVENT, TOOL_CLIP, checkToolClips, createToolClipPlayer, sampleClip, scaleClip, toolAnimationStep } from './tool-animation'
export type { ToolAnimationStep, ToolAnimator, ToolClipId, ToolClipPlayer, ToolClipPlayerOptions, ToolClipSet, ToolRig } from './tool-animation'
export type { AreaPlacement, GroundLayout, GroundZone, HostEvent, HostTool, HostToolAttachment, ModuleArea, ModuleHost, ModuleItemFluid, ModuleItemSeal, ModuleScenario, PlayerState, ItemSeat, TestableItem, TestableModule, Thumbnail, ToolCommand, ToolCommandResult } from './module'
export { applyPatches, deepMerge, mergeById, removeIds } from './registry'
export type { DeepPartial } from './registry'
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
export { footprintBlocker } from './footprint'
export type { Footprint, FootprintObject } from './footprint'
