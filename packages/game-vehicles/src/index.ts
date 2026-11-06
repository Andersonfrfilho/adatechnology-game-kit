export { createVehicleKit } from './kit'
export { registerLocale, resolveStrings, listLocales, format, createTranslate } from './locale'
export type { LocaleStrings, PartialLocaleStrings, Translate } from './locale'
export { LEGACY_STATES, LEGACY_ZONE_IDS, SEED_SALTS, legacyZoneId, legacyGlassId, legacyLightId, registerLegacySeeds } from './legacy-seeds'
export { defaultLodSettings, createLod, wrapThreeForLod } from './lod'
export type { LodSettings } from './lod'
export type { SceneNode } from './types'
export { defaultDamageableKinds } from './damageables'
export type { DamageableKind, DamageableMaterial, DamageableSide } from './damageables'
export { hash, clamp, smooth, rng, strHash } from './util'
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
export { ARMOUR_LEVELS, armourLevelOf, CRASH_RULES, crashDeltaV, crashVehicle, createCreaseQueue, createVehicleDestructible, buildVehicleItem, buildVehicleModel, JOINT_RULES, cabinEnclosure, cabinBoxOf, swingOf, CABIN_LEAK } from './destructible'
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
  CreaseQueue,
  CreaseWork,
  JointDef,
  LocalBox,
  PartDef,
  PartRole,
  VehicleDestructible,
  VehicleDestructibleOptions,
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
