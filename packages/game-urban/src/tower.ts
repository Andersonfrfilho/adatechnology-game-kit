import type { BlockBuilding, BuildingOptions } from './block'
import type { UrbanBuilder } from './scene'

/**
 * One kind of tower the city can put on a tall lot: the numbers of a typology of `game-floorplan-commercial` (office) or `game-floorplan-residential`
 * (residential), which the tests keep equal to theirs. The city only draws the outside; the plan of the inside is the typology's.
 */
export type TowerPreset = {
  id: string
  /** Chance weight among the presets (the one the random picks). */
  weight: number
  /** Floor to floor in metres: the clear height of the typology plus its slab. */
  storeyHeight: number
  /** A plant floor (darker band, no windows) every this many storeys; `false` none. */
  mechanicalEvery: number | false
  /** A glass curtain wall (a ribbon of tall windows on a tinted skin) or a punched facade (a window in each bay of the masonry). */
  glass: boolean
  /** Fewest and most storeys this preset's towers have (the lot height is raised or cut to it); omitted: no minimum, and `TowerOptions.maxStoreys` for the top. */
  minStoreys?: number
  maxStoreys?: number
  /** Colour of the skin; omitted: the facade colour the block drew for the lot (glass: a blue tint of it). */
  color?: number
}

/** The two typologies: the office tower (4.0 m storeys: 3.6 clear and 0.4 slab, a plant floor every 20, glass) and the residential tower (3.1 m, every 25, masonry). */
export const DEFAULT_TOWER_PRESETS: readonly TowerPreset[] = [
  { id: 'office', weight: 0.6, storeyHeight: 4, mechanicalEvery: 20, glass: true, color: 0x3c5a73 },
  { id: 'residential', weight: 0.4, storeyHeight: 3.1, mechanicalEvery: 25, glass: false },
]

/**
 * A preset from the layout of a typology (`officeTowerLayout(opts)`, `residentialTowerLayout(opts)`), so the city draws the tower the game configured:
 * the storey pitch and the facade come from the layout, the storey range from its `range` when given.
 */
export const towerPresetOf = (
  id: string,
  weight: number,
  layout: { pitch: number; facade: 'curtain' | 'punched' },
  extra: Partial<Omit<TowerPreset, 'id' | 'weight' | 'storeyHeight' | 'glass'>> = {},
): TowerPreset => ({ id, weight, storeyHeight: layout.pitch, mechanicalEvery: 20, glass: layout.facade === 'curtain', ...extra })

/** What a game asks a tower provider to put on the ground: the lot, the height, the preset the random chose and the facade colour. */
export type TowerRequest = { x: number; z: number; width: number; depth: number; height: number; color: number; preset: TowerPreset; lit: number; use?: string; storeys?: number }
/** Draws a tower in place of the default one (the game's own model, or the plan of the typology rendered by `game-floorplan-three`). */
export type TowerProvider = (request: TowerRequest, b: UrbanBuilder) => void

export type TowerOptions = {
  /** A building at least this tall (metres) is drawn as a tower. Default 60. */
  minHeight?: number
  /** Kinds of tower and their weights. Default `DEFAULT_TOWER_PRESETS`. */
  presets?: readonly TowerPreset[]
  /** Replaces the default drawing. */
  provider?: TowerProvider
  /** The crown: height of the mast over the roof as a share of the tower (default 0.06, at most 25 m), 0 for none. */
  mast?: number
  /** Most storeys a tower may have (default 60, the structural limit of the kit): a taller lot is drawn at this many storeys of its preset. */
  maxStoreys?: number
  /** Chance that a window is lit when the block did not say (default 0.12). */
  lit?: number
}

export const TOWER_DEFAULTS = { minHeight: 60, maxStoreys: 60, mast: 0.06, lit: 0.12 } as const

const PODIUM = 1.5
const PLANT = 0x2c2f33
const PODIUM_COLOR = 0x2a2d31
const PARAPET = 0x2a2a2c
const MAST = 0x9aa0a6
const MAX_MAST = 25
const GLASS_COLUMN = 1.6
const MASONRY_COLUMN = 3

/** The preset the random picks by weight; draws once. */
export function pickTowerPreset(b: UrbanBuilder, presets: readonly TowerPreset[]): TowerPreset {
  const total = presets.reduce((sum, p) => sum + p.weight, 0)
  let r = b.random() * total
  for (const preset of presets) {
    r -= preset.weight
    if (r < 0) return preset
  }
  return presets[presets.length - 1] as TowerPreset
}

/** Storeys of a tower of this height, the podium (a taller ground storey) included. */
export const towerStoreys = (height: number, preset: TowerPreset): number => Math.max(3, Math.round(height / preset.storeyHeight))

/**
 * A tower: a podium with a taller ground storey, the shaft with a row of windows on every storey of its four faces, darker bands where the plant
 * floors are (no windows), the top plant floor set back, the parapet and the mast. Draws one random per window (lit or not), after the preset's.
 */
export function drawTower(b: UrbanBuilder, request: TowerRequest, options: Pick<TowerOptions, 'mast'> = {}): BlockBuilding {
  const { x, z, width: w, depth: d, preset } = request
  const storeys = towerStoreys(request.height, preset)
  const h = preset.storeyHeight
  const podium = h * PODIUM
  const skin = preset.color ?? request.color
  const mechanical = new Set<number>()
  if (preset.mechanicalEvery) for (let k = preset.mechanicalEvery; k < storeys - 1; k += preset.mechanicalEvery) if (storeys - 1 - k >= preset.mechanicalEvery / 2) mechanical.add(k)
  mechanical.add(storeys - 1)
  b.box(x, 0, z, w + 0.6, podium, d + 0.6, PODIUM_COLOR)
  const shaftTop = (storeys - 1) * h
  b.box(x, podium, z, w, shaftTop - podium + (podium - h), d, skin)
  for (const k of mechanical) {
    if (k === storeys - 1) b.box(x, k * h + (podium - h), z, w * 0.82, h, d * 0.82, PLANT)
    else b.box(x, k * h + (podium - h), z, w + 0.4, h, d + 0.4, PLANT)
  }
  const top = storeys * h + (podium - h)
  b.box(x, top, z, w * 0.82 + 0.3, 0.35, d * 0.82 + 0.3, PARAPET)
  const mast = Math.min(MAX_MAST, top * (options.mast ?? TOWER_DEFAULTS.mast))
  if (mast > 0.5) b.cylinder(x, top + 0.35, z, 0.12, 0.2, mast, MAST, -1, 6)
  // windows: a row a storey, on the four faces, none on the plant floors and the podium
  const column = preset.glass ? GLASS_COLUMN : MASONRY_COLUMN
  const winHeight = preset.glass ? h * 0.62 : 1.5
  const winWidth = preset.glass ? column * 0.86 : 1.3
  const faces: [number, number, number, number][] = [[0, d / 2 + 0.03, w, 0], [0, -d / 2 - 0.03, w, Math.PI], [w / 2 + 0.03, 0, d, Math.PI / 2], [-w / 2 - 0.03, 0, d, -Math.PI / 2]]
  for (const [ox, oz, faceWidth, ry] of faces) {
    const columns = Math.max(1, Math.floor(faceWidth / column))
    for (let storey = 1; storey < storeys; storey++) {
      if (mechanical.has(storey)) continue
      const y = storey * h + (podium - h) + h * (preset.glass ? 0.2 : 0.35)
      for (let c = 0; c < columns; c++) {
        const u = (c - (columns - 1) / 2) * column
        const lit = b.random() < request.lit
        ;(lit ? b.windows.lit : b.windows.dark).push({ x: ox ? x + ox : x + u, y, z: ox ? z + u : z + oz, ry, width: winWidth, height: winHeight, isLit: lit })
      }
    }
  }
  return { x, z, width: w, depth: d, height: top + 0.35 + (mast > 0.5 ? mast : 0), color: request.color }
}

/** The drawer a kit uses for a building of the block or the avenue: a tower from the minimum height up, the plain city building under it. */
export function createTowerDrawer(towers: TowerOptions, plain: (b: UrbanBuilder, x: number, z: number, width: number, depth: number, height: number, color: number, o?: BuildingOptions) => BlockBuilding) {
  const minHeight = towers.minHeight ?? TOWER_DEFAULTS.minHeight
  const presets = towers.presets ?? DEFAULT_TOWER_PRESETS
  return (b: UrbanBuilder, x: number, z: number, width: number, depth: number, height: number, color: number, o: BuildingOptions = {}): BlockBuilding => {
    if (height < minHeight || presets.length === 0) return plain(b, x, z, width, depth, height, color, o)
    const preset = (o.preset ? presets.find((p) => p.id === o.preset) : undefined) ?? pickTowerPreset(b, presets)
    const top = (preset.maxStoreys ?? towers.maxStoreys ?? TOWER_DEFAULTS.maxStoreys) * preset.storeyHeight
    const bottom = (preset.minStoreys ?? 0) * preset.storeyHeight
    const request: TowerRequest = { x, z, width, depth, height: Math.min(Math.max(height, bottom), top), color, preset, lit: o.lit ?? towers.lit ?? TOWER_DEFAULTS.lit, ...(o.use ? { use: o.use } : {}), ...(o.storeys ? { storeys: o.storeys } : {}) }
    if (towers.provider) {
      towers.provider(request, b)
      return { x, z, width, depth, height: request.height, color }
    }
    return drawTower(b, request, towers)
  }
}
