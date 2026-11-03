/**
 * The player's graphics choices: a preset and the individual options. Every option but the frame cap and the counter may be left on `auto`, and the
 * auto tuner (`createAutoTuner`) then picks its value from the frame time; an option the player fixes by hand stays as it is.
 */

export const GRAPHICS_PRESETS = ['auto', 'low', 'medium', 'high', 'ultra'] as const
/** `custom` is what the preset reads once the player changes an option by hand. */
export type GraphicsPreset = (typeof GRAPHICS_PRESETS)[number] | 'custom'

export const SHADOW_LEVELS = ['off', 'near', 'all'] as const
export type ShadowLevel = (typeof SHADOW_LEVELS)[number]

export const VIEW_DISTANCES = ['short', 'medium', 'long'] as const
export type ViewDistance = (typeof VIEW_DISTANCES)[number]

/** Frames a second the loop may draw; 0 is no cap (the display's own rate). */
export const FPS_CAPS = [30, 60, 120, 0] as const
export type FpsCap = (typeof FPS_CAPS)[number]

export type Auto = 'auto'

export interface GraphicsSettings {
  readonly preset: GraphicsPreset
  /** Share of the native resolution drawn, 0.5 to 1. */
  readonly resolutionScale: Auto | number
  /** Share of the horde's level-of-detail budget, 0.1 to 1 (`auto`: the crowd renderer's own `budget.adapt`). */
  readonly hordeDetail: Auto | number
  readonly shadows: Auto | ShadowLevel
  readonly viewDistance: Auto | ViewDistance
  readonly fpsCap: FpsCap
  readonly showFps: boolean
}

/** What the screen draws with this frame: every `auto` replaced by the tuner's value (the horde keeps `auto`: its renderer adapts by itself). */
export interface EffectiveGraphics {
  readonly resolutionScale: number
  readonly hordeDetail: Auto | number
  readonly shadows: ShadowLevel
  readonly viewDistance: ViewDistance
  readonly fpsCap: FpsCap
  readonly showFps: boolean
}

export const RESOLUTION_RANGE = { min: 0.5, max: 1 } as const
export const HORDE_DETAIL_RANGE = { min: 0.1, max: 1 } as const

/** The option keys a player may set by hand; the ones in `AUTO_KEYS` also take `auto`. */
export type GraphicsOption = Exclude<keyof GraphicsSettings, 'preset'>
export const AUTO_KEYS = ['resolutionScale', 'hordeDetail', 'shadows', 'viewDistance'] as const
export type AutoKey = (typeof AUTO_KEYS)[number]

type PresetValues = Omit<GraphicsSettings, 'preset'>

/**
 * The fixed presets. Baixa draws two thirds of the pixels and no shadow; Ultra draws every pixel, every shadow and the whole horde budget. The frame cap of
 * every preset is 60: the cap is the player's to raise.
 */
export const PRESET_VALUES: Readonly<Record<Exclude<GraphicsPreset, 'custom'>, PresetValues>> = {
  auto: { resolutionScale: 'auto', hordeDetail: 'auto', shadows: 'auto', viewDistance: 'auto', fpsCap: 60, showFps: false },
  low: { resolutionScale: 0.6, hordeDetail: 0.3, shadows: 'off', viewDistance: 'short', fpsCap: 60, showFps: false },
  medium: { resolutionScale: 0.8, hordeDetail: 0.6, shadows: 'near', viewDistance: 'medium', fpsCap: 60, showFps: false },
  high: { resolutionScale: 1, hordeDetail: 0.8, shadows: 'all', viewDistance: 'medium', fpsCap: 60, showFps: false },
  ultra: { resolutionScale: 1, hordeDetail: 1, shadows: 'all', viewDistance: 'long', fpsCap: 60, showFps: false },
}

export const DEFAULT_GRAPHICS: GraphicsSettings = { preset: 'auto', ...PRESET_VALUES.auto }

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
const isAuto = (v: unknown): v is Auto => v === 'auto'

/** Picks a preset: every option takes its value, and the frame cap and the counter keep the player's. */
export function applyPreset(settings: GraphicsSettings, preset: Exclude<GraphicsPreset, 'custom'>): GraphicsSettings {
  return { ...PRESET_VALUES[preset], fpsCap: settings.fpsCap, showFps: settings.showFps, preset }
}

/**
 * Sets one option by hand. An option that a preset owns (all but the frame cap and the counter) turns the preset into `custom`; under Automático the other
 * `auto` options stay `auto`, so the tuner keeps adjusting only what the player left to it.
 */
export function setOption<K extends GraphicsOption>(settings: GraphicsSettings, key: K, value: GraphicsSettings[K]): GraphicsSettings {
  const next = { ...settings, [key]: value } as GraphicsSettings
  if (key === 'fpsCap' || key === 'showFps') return sanitizeGraphics(next)
  return sanitizeGraphics({ ...next, preset: matchPreset(next) })
}

/** The preset whose values these are, or `custom`. The frame cap and the counter do not count. */
export function matchPreset(settings: Omit<GraphicsSettings, 'preset'>): GraphicsPreset {
  for (const name of GRAPHICS_PRESETS) {
    const p = PRESET_VALUES[name]
    if (AUTO_KEYS.every((k) => p[k] === settings[k])) return name
  }
  return 'custom'
}

/** Whether any option is left to the tuner. */
export const anyAuto = (settings: GraphicsSettings): boolean => AUTO_KEYS.some((k) => isAuto(settings[k]))

/** Reads a stored or hand-written value: anything out of range or unknown falls back to the default of that option. */
export function sanitizeGraphics(value: unknown): GraphicsSettings {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const d = DEFAULT_GRAPHICS
  const num = (x: unknown, range: { min: number; max: number }, fallback: Auto | number): Auto | number =>
    isAuto(x) ? 'auto' : typeof x === 'number' && Number.isFinite(x) ? clamp(x, range.min, range.max) : fallback
  const pick = <T extends string>(x: unknown, list: readonly T[], fallback: Auto | T): Auto | T => (isAuto(x) ? 'auto' : list.includes(x as T) ? (x as T) : fallback)
  const out: Omit<GraphicsSettings, 'preset'> = {
    resolutionScale: num(v.resolutionScale, RESOLUTION_RANGE, d.resolutionScale),
    hordeDetail: num(v.hordeDetail, HORDE_DETAIL_RANGE, d.hordeDetail),
    shadows: pick(v.shadows, SHADOW_LEVELS, d.shadows),
    viewDistance: pick(v.viewDistance, VIEW_DISTANCES, d.viewDistance),
    fpsCap: (FPS_CAPS as readonly number[]).includes(v.fpsCap as number) ? (v.fpsCap as FpsCap) : d.fpsCap,
    showFps: typeof v.showFps === 'boolean' ? v.showFps : d.showFps,
  }
  const preset = v.preset === 'custom' || (GRAPHICS_PRESETS as readonly unknown[]).includes(v.preset) ? (v.preset as GraphicsPreset) : matchPreset(out)
  // a preset that does not match its values (an edited store) reads as custom
  return { ...out, preset: preset !== 'custom' && matchPreset(out) !== preset ? 'custom' : preset }
}

/** The frame time the tuner aims at for a frame cap: the cap's own frame, and 60 frames a second without a cap. */
export const targetFrameMs = (fpsCap: FpsCap): number => 1000 / (fpsCap === 0 ? 60 : fpsCap)
