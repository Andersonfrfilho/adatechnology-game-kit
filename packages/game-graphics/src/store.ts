import { DEFAULT_GRAPHICS, sanitizeGraphics } from './settings'
import type { GraphicsSettings } from './settings'
import type { BenchmarkResult } from './benchmark'
import type { GraphicsTier } from './tuner'

/** The part of the Web Storage API the store uses (`localStorage`, or a stand-in in tests). */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

/** The last calibration: which tier the machine came out as and on which GPU (another GPU calibrates again). */
export interface GraphicsCalibration extends BenchmarkResult {
  readonly gpu: string
  readonly at: number
}

export interface GraphicsStoreOptions {
  /** Where it keeps the choice (default `localStorage` when there is one; without, it keeps it in memory). */
  readonly storage?: StorageLike | null
  /** The key under which it keeps it (default `adatechnology.graphics`). */
  readonly key?: string
}

export interface GraphicsStore {
  readonly settings: GraphicsSettings
  set(settings: GraphicsSettings): void
  readonly calibration: GraphicsCalibration | null
  /** The calibration for this GPU, or null when there is none (or it was another GPU's). */
  calibrationFor(gpu: string): GraphicsCalibration | null
  setCalibration(calibration: GraphicsCalibration | null): void
  /** The tier to start from on this GPU (default `high`). */
  tierFor(gpu: string): GraphicsTier
  /** Called with the settings after each `set`. Returns the unsubscribe function. */
  subscribe(listener: (settings: GraphicsSettings) => void): () => void
}

const defaultStorage = (): StorageLike | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** The player's choice, kept in the browser. A storage that throws (a private window, blocked site data) is read as empty and the game runs on the defaults. */
export function createGraphicsStore(options: GraphicsStoreOptions = {}): GraphicsStore {
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const key = options.key ?? 'adatechnology.graphics'
  const listeners = new Set<(s: GraphicsSettings) => void>()
  let settings: GraphicsSettings = DEFAULT_GRAPHICS
  let calibration: GraphicsCalibration | null = null
  try {
    const raw = storage?.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw) as { settings?: unknown; calibration?: GraphicsCalibration | null }
      settings = sanitizeGraphics(parsed.settings)
      const c = parsed.calibration
      calibration = c && typeof c.gpu === 'string' && typeof c.tier === 'string' && Number.isFinite(c.p50Ms) ? c : null
    }
  } catch {
    // unreadable: the defaults
  }
  const save = (): void => {
    try {
      storage?.setItem(key, JSON.stringify({ settings, calibration }))
    } catch {
      // full or blocked: the choice still holds for this session
    }
  }
  return {
    get settings() {
      return settings
    },
    set(next) {
      settings = sanitizeGraphics(next)
      save()
      for (const l of listeners) l(settings)
    },
    get calibration() {
      return calibration
    },
    calibrationFor: (gpu) => (calibration && calibration.gpu === gpu ? calibration : null),
    setCalibration(c) {
      calibration = c
      save()
    },
    tierFor: (gpu) => (calibration && calibration.gpu === gpu ? calibration.tier : 'high'),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
