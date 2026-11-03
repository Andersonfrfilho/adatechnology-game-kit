/**
 * @adatechnology/game-graphics: the player's graphics settings without any engine. Presets (Automático, Baixa, Média, Alta, Ultra), the individual options,
 * the automatic mode that moves what is left on `auto` by the frame time, the short calibration of the loading screen and the choice kept in the browser.
 * The screen is at `@adatechnology/game-graphics/screen`; applying the values to three.js is `@adatechnology/game-graphics-three`.
 */
export {
  AUTO_KEYS,
  DEFAULT_GRAPHICS,
  FPS_CAPS,
  GRAPHICS_PRESETS,
  HORDE_DETAIL_RANGE,
  PRESET_VALUES,
  RESOLUTION_RANGE,
  SHADOW_LEVELS,
  VIEW_DISTANCES,
  anyAuto,
  applyPreset,
  matchPreset,
  sanitizeGraphics,
  setOption,
  targetFrameMs,
} from './settings'
export type { Auto, AutoKey, EffectiveGraphics, FpsCap, GraphicsOption, GraphicsPreset, GraphicsSettings, ShadowLevel, ViewDistance } from './settings'
export { createAutoTuner, tunerLadder } from './tuner'
export type { AutoTuner, AutoTunerOptions, AutoTunerState, GraphicsTier, TunerStep } from './tuner'
export { createBenchmark, tierOf } from './benchmark'
export type { Benchmark, BenchmarkOptions, BenchmarkResult } from './benchmark'
export { createFpsMeter, frameLoad, minFrameMs } from './fps'
export type { FpsMeter } from './fps'
export { createGraphicsStore } from './store'
export type { GraphicsCalibration, GraphicsStore, GraphicsStoreOptions, StorageLike } from './store'
export { createGraphicsController } from './controller'
export type { GraphicsController, GraphicsControllerOptions, GraphicsPhase } from './controller'
