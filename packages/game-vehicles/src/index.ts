export { createVehicleKit } from './kit'
export { registerLocale, resolveStrings, listLocales, format, createTranslate } from './locale'
export type { LocaleStrings, PartialLocaleStrings, Translate } from './locale'
export { LEGACY_STATES, LEGACY_ZONE_IDS, SEED_SALTS, legacyZoneId, legacyGlassId, legacyLightId, registerLegacySeeds } from './legacy-seeds'
export { defaultLodSettings, createLod, wrapThreeForLod } from './lod'
export type { LodSettings } from './lod'
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
  VehicleKitOptions,
  VehicleMeta,
  VehiclePart,
  VehicleSpec,
  ZoneDamageEntry,
  ZoneEffect,
  BuildZoneState,
  ZoneState,
} from './api'
export { createVehicleDestructible, buildVehicleItem, buildVehicleModel, JOINT_RULES } from './destructible'
export type {
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
