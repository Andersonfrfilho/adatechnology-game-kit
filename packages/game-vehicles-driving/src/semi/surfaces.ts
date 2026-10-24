import { applyPatches, mergeById, removeIds } from '@adatechnology/game-contracts'

/** A kind of ground the tyres run on. */
export interface Surface {
  id: string
  /** Multiplier of the tyre grip (dry asphalt = 1). */
  grip: number
  /** Above this speed (km/h) the tyres float: grip drops linearly to `grip * aquaplaningFactor` over `aquaplaningBand` km/h. */
  aquaplaningKmh?: number
  aquaplaningFactor?: number
  aquaplaningBand?: number
  /** A vehicle without four-wheel drive sinks: its rolling resistance becomes the spec's `bogResistance`. */
  bogs?: boolean
}

/** The table of the Frota document, section 03 (Surfaces). Every number is a default a game can replace. */
export const defaultSurfaces: readonly Surface[] = [
  { id: 'dry_asphalt', grip: 1 },
  { id: 'wet_asphalt', grip: 0.75, aquaplaningKmh: 90, aquaplaningFactor: 0.4, aquaplaningBand: 30 },
  { id: 'dirt', grip: 0.65 },
  { id: 'grass', grip: 0.55 },
  { id: 'mud', grip: 0.4, bogs: true },
  /** Blood and bodies after a run-over; a driver applies it for a few seconds with `contaminate`. */
  { id: 'blood', grip: 0.5 },
]

export interface SurfaceOptions {
  packs?: ReadonlyArray<{ surfaces?: readonly Surface[] }>
  patch?: Readonly<Record<string, Partial<Surface>>>
  remove?: readonly string[]
}

export interface SurfaceRegistry {
  get(id: string): Surface
  readonly surfaces: readonly Surface[]
}

/** The registry of surfaces: the document's table, plus packs, patches and removals by id. An unknown id falls back to dry asphalt. */
export function createSurfaces(options: SurfaceOptions = {}): SurfaceRegistry {
  const entries = mergeById(defaultSurfaces, options.packs?.flatMap((pack) => pack.surfaces ?? []))
  applyPatches(entries, options.patch)
  removeIds(entries, options.remove)
  const fallback = entries.get('dry_asphalt') ?? ({ id: 'dry_asphalt', grip: 1 } as Surface)
  return {
    get: (id) => entries.get(id) ?? fallback,
    get surfaces() {
      return [...entries.values()]
    },
  }
}

/** Grip of a surface at a speed, with aquaplaning. */
export function surfaceGrip(surface: Surface, speedMetresPerSecond: number): number {
  if (surface.aquaplaningKmh == null) return surface.grip
  const kmh = Math.abs(speedMetresPerSecond) * 3.6
  const band = surface.aquaplaningBand ?? 30
  const t = Math.max(0, Math.min(1, (kmh - surface.aquaplaningKmh) / band))
  return surface.grip * (1 - (1 - (surface.aquaplaningFactor ?? 0.4)) * t)
}
