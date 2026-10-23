/**
 * @adatechnology/game-contracts: the contracts every game module (vehicles, furniture, plants, houses, weapons) depends on, and nothing else.
 * Types plus tiny pure checkers, no runtime dependencies. The default destruction world, the renderers and the test room are optional.
 */
export type {
  Crack,
  DamageType,
  DebrisKind,
  Dent,
  DestructibleSpec,
  DestructionEvent,
  DestructionEventType,
  FluidKind,
  Fragment,
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
  PartState,
  PartStatus,
  Quat,
  RayHit,
  StructureRole,
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
export type { ModuleItemFluid, ModuleScenario, TestableItem, TestableModule } from './module'
