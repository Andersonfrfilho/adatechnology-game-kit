export { createVehicleKit } from './kit'
export { bulletHoleShape, holeStyleOf, GOUGE_COS, HEAVY_CALIBER_MM, RIFLE_ENERGY_DENSITY, RIFLE_SPEED } from './hole-shape'
export type { BulletHoleInput, BulletHoleShape, HoleStyle } from './hole-shape'
export { registerLocale, resolveStrings, listLocales, format, createTranslate } from './locale'
export type { LocaleStrings, PartialLocaleStrings, Translate } from './locale'
export { LEGACY_STATES, LEGACY_ZONE_IDS, SEED_SALTS, legacyZoneId, legacyGlassId, legacyLightId, registerLegacySeeds } from './legacy-seeds'
export { defaultLodSettings, createLod, wrapThreeForLod } from './lod'
export type { LodSettings } from './lod'
export type { SceneNode } from './types'
export { defaultDamageableKinds } from './damageables'
export type { DamageableKind, DamageableMaterial, DamageableSide } from './damageables'
export { hash, clamp, smooth, rng, strHash } from './util'
export { PLUME_PUFFS, SMOKE_LOOKS, SMOKE_WIND, SmokeCause, engineBayVent, smokeCauseOfEmitter, smokePuff, smokeRate } from './engine-smoke'
export type { BayBox, SmokeLook, SmokePuff, SmokePuffParams } from './engine-smoke'
export type {
  Band,
  BandId,
  BandIndex,
  BandOverride,
  BuildFunction,
  BuildOptions,
  Damageable,
  BuildState,
  DamageMapOptions,
  DamageZone,
  ExplodeOptions,
  FlagEffect,
  FluidDefinition,
  ImpactOptions,
  KitConfiguration,
  KitInternals,
  KitTexts,
  OverallHealth,
  PartLabel,
  Plugin,
  ResolvedConfiguration,
  ScenarioContext,
  ScenarioDefinition,
  ScenarioResult,
  SplatOptions,
  ThreeObject,
  ThreeVector,
  UiHelpers,
  VehicleContext,
  VehicleKit,
  ParticleMaterials,
  VehicleKitOptions,
  VehicleMeta,
  VehiclePart,
  VehicleSpec,
  VehicleLamp,
  RollState,
  HeadlightLens,
  ZoneDamageEntry,
  ZoneEffect,
  BuildZoneState,
  ZoneState,
} from './api'
export type { StrayLamp } from './stray-lamps'
export { strayLampsOf } from './stray-lamps'
export { DOOR_SHELL_DEPTH, DOOR_SHELL_MAX_DEPTH, doorShell, openEdgeCount } from './destructible/door-shell'
export type { DoorShellParams, DoorShellResult } from './destructible/door-shell'
export { ARMOUR_LEVELS, armourLevelOf, CRASH_RULES, crashDeltaV, crashVehicle, createCreaseQueue, createVehicleDestructible, buildVehicleItem, buildVehicleModel, JOINT_RULES, cabinEnclosure, cabinBoxOf, swingOf, CABIN_LEAK, createVehicleRainCover, RAIN_MOVE_STEP, RAIN_OPENING_DIAMETER, RAIN_TURN_STEP } from './destructible'
export type {
  DriveReport,
  ArmourLevel,
  ArmourLevelId,
  CrashOptions,
  CrashResult,
  CrashRules,
  CabinBox,
  CabinEnclosureOptions,
  CabinSource,
  VehicleRainCover,
  VehicleRainCoverOptions,
  CreaseQueue,
  CreaseWork,
  JointDef,
  LocalBox,
  PartDef,
  PartRole,
  VehicleDestructible,
  VehicleDestructibleOptions,
  PartSink,
  VehicleItem,
  VehicleItemOptions,
  VehicleModel,
  VehicleStatus,
} from './destructible'
export type { ParticleEffects, ParticleEffectRequest } from './routed-particles'
export type { WarpOptions, WarpFn, LoftRow, SmoothLoftOptions } from './warp'
export type { CutTest, PathItem, TumbleSpec, LoftStation } from './geometry'
export type { Greenhouse, ShellSpec } from './body'
export type { CarSpec, CarWheel, UnderbodySpec } from './car'
export type { GlassOptions, GlassQuad, PaneLook } from './glass'
export type { LabelArgument } from './context'
export type { HeadlightOptions, TaillightOptions, GrilleOptions } from './lights'
export type { EngineBaySpec } from './hood'
export type { SeatOptions, DashboardOptions, InteriorOptions, BusRowsOptions } from './interior'
export type { Puddle, PuddleLobe, Splat } from './fluids'
export type { ZoneDef } from './zone-derive'
export { crackedGlassMaterial } from './glass-damage'
export { CABIN_CATEGORIES, CABIN_MINIMUMS, CABIN_SOURCE, ENTRY_DUCK_FACTOR, cabinMinimumOf } from './cabin'
export type { CabinCategory, CabinDoorMinimum, CabinMinimum } from './cabin'
export { hullPlanKind, planHulls } from './hull-plan-kind'
export type { HullPlanJob, HullPlanLeaf, HullPlanPiece, HullPlanResult } from './hull-plan-kind'
export { newHullPlan, planDivision } from './hull-plan'
export type { HullPlan } from './hull-plan'
export { FLOATING_AREA } from './hull-excess'
export { leavesOf, protrusionsOf, unitsOf } from './hull-split'
export type { CutNode } from './hull-split'
export { FLAT_PAD, MAX_HULL_POINTS, hullOf } from './vehicle-hulls'
export type { HullSoup } from './vehicle-hulls'
export { convexFaces, hullVolume, reducePoints } from './hull-geometry'
export type { HullFace } from './hull-geometry'
