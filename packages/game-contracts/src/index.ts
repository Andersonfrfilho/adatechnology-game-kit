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
  ExplosionChain,
  DestructionEvent,
  DestructionEventType,
  FluidKind,
  Fragment,
  FragmentMark,
  FractureStyle,
  Hit,
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
  StructureRole,
  SurfaceLayer,
  ToolKind,
  Vec3,
} from './destruction'
export { IMPACT_CONTRACT, checkDestructible, checkHit } from './impact'
export type { CheckOptions, DestructibleImpl, ImpactContract } from './impact'
export { checkSpec } from './spec'
export type { CheckSpecOptions, SpecReport } from './spec'
export { shotToHit } from './weapons'
export type { Shot, Use } from './weapons'
export type { ContainerSpec, ItemUseDef, LiquidId } from './fluids'
export { checkAnimation } from './animation'
export type { AnimationClipSpec, AnimationEventSpec, AnimationKey, AnimationPose, ItemAnimationContract } from './animation'
export { STAGE_EVENT, TOOL_CLIP, checkToolClips, createToolClipPlayer, sampleClip, scaleClip, toolAnimationStep } from './tool-animation'
export type { ToolAnimationStep, ToolAnimator, ToolClipId, ToolClipPlayer, ToolClipPlayerOptions, ToolClipSet, ToolRig } from './tool-animation'
export type { AreaPlacement, HostEvent, HostTool, HostToolAttachment, ModuleArea, ModuleHost, ModuleItemFluid, ModuleScenario, TestableItem, TestableModule, Thumbnail, ToolCommand, ToolCommandResult } from './module'
export { applyPatches, deepMerge, mergeById, removeIds } from './registry'
export type { DeepPartial } from './registry'
export { checkBench } from './bench'
export type {
  ActionControl,
  BenchChange,
  BenchDeclaration,
  BenchReport,
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
