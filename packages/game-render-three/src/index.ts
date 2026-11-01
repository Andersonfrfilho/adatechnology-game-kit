export type { ThreeLib } from './three-lib'

export { createLightBudget } from './lights/budget'
export { LIGHT_PRIORITY } from './lights/types'
export type {
  FogState,
  LightBudget,
  LightBudgetOptions,
  LightBudgetStats,
  LightCheck,
  LightHandle,
  LightKind,
  LightLease,
  LightPatch,
  LightRequest,
  LightSource,
  LinearRgb,
  RendererState,
  SealOptions,
  SourceHandle,
  ThreeForLights,
} from './lights/types'
export { isLightBudget } from './lights/guard'

export { NEUTRAL_FOG_FAR, NEUTRAL_FOG_NEAR, createFog, isNeutralFog } from './fog'
export type { FogController, FogOptions } from './fog'

export { createProgramWarmup } from './warmup'
export { spriteProbes } from './probes'
export type { EffectWarmup, ProgramWarmup, WarmupContext, WarmupOptions, WarmupProbe, WarmupReport, WarmupRenderer } from './warmup-types'
export { programKeysOf } from './program-key'
export type { PropertiesReader } from './program-key'

export { createGeometryPool, geometryKey } from './pools/geometry'
export type { GeometryPool } from './pools/geometry'
export { createMaterialPool, materialKey } from './pools/material'
export type { MaterialPool, MaterialPoolOptions } from './pools/material'
export { createMaterialAnchors } from './pools/anchors'
export { isRenderPools } from './pools/render-pools'
export type { RenderPools } from './pools/render-pools'
export type { MaterialAnchors } from './pools/anchors'

export { createFramePacer } from './frame-pacer'
export type { FramePacer, FramePacerContext, FramePacerOptions } from './frame-pacer'
