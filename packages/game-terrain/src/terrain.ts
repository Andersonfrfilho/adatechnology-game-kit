import type { Hit } from '@adatechnology/game-contracts'
import { DEFAULT_BAR_DIAMETER, DEFAULT_BAR_YIELD_JOULES, DEFAULT_BAR_YIELD_PA, DEFAULT_PROFILE, TERRAIN_MATERIALS, TERRAIN_PROFILES } from './catalog'
import { createCrackStore, CRACK_REFERENCE_JOULES } from './cracks'
import { createDebrisStore } from './debris'
import { lossOf, SLIDE_LOSS_MIN_LOWERING, tallyLowered, voidUnder } from './ground-loss'
import type { HeightGrid, LossTally } from './ground-loss'
import { createMarkStore } from './marks'
import { createRandom } from './random'
import type { GroundExcavation, GroundLayout, Terrain, TerrainBlow, TerrainBlowResult, TerrainBudget, TerrainChunk, TerrainColumn, TerrainDebris, TerrainDecal, TerrainLoad, TerrainMark, TerrainMaterial, TerrainOptions, TerrainProfile, TerrainRegion, TerrainSnapshot, TerrainStratum, TerrainStrike } from './types'

export const DEFAULT_TERRAIN_BUDGET: TerrainBudget = {
  markAreaSize: 2,
  maxMarksPerArea: 24,
  maxMarks: 800,
  maxDirtyChunksPerFrame: 6,
  maxDebris: 400,
  maxDebrisPerBlow: 36,
  maxSlideCellsPerFrame: 2500,
  maxBurningCells: 300,
  maxCracks: 120,
  maxDecals: 300,
}

const GRAVITY = 9.81
/** A bowl narrower than this many cells cannot be drawn by the height field: it stays a fine mark. */
const FINE_CELLS = 1.5
/** A hole deeper than this many cells is no longer a mark on the surface. */
const FINE_DEPTH_CELLS = 0.4
const RIGID_WIDENING = 2.5
/** Calibre (mm) a round's crater has the material's own shape at: a thinner round goes deeper and opens less for the same energy, a thicker one opens more. */
const REFERENCE_CALIBER = 7.62
/** How far a calibre bends the crater's depth over its radius: (reference / calibre) to this power, kept within `CALIBER_ASPECT_RANGE`. */
const CALIBER_ASPECT_POWER = 0.5
const CALIBER_ASPECT_RANGE = [0.6, 1.6] as const
/** A round's crater is at least this many calibres across. */
const CALIBERS_ACROSS = 2.5

/** Depth-over-radius factor of a round's crater: 1 without a calibre or at the reference one. */
const caliberAspect = (caliber: number | undefined): number =>
  caliber && caliber > 0 ? Math.min(CALIBER_ASPECT_RANGE[1], Math.max(CALIBER_ASPECT_RANGE[0], (REFERENCE_CALIBER / caliber) ** CALIBER_ASPECT_POWER)) : 1
/** The smallest crater radius (m) a round of `caliber` mm leaves. */
const caliberRadius = (caliber: number | undefined): number => (caliber && caliber > 0 ? (caliber / 1000) * CALIBERS_ACROSS / 2 : 0)
/** Bars alone do not drop a slab that still has this share of its concrete to lose. */
const COLLAPSE_DEPTH_SHARE = 0.75
const COLLAPSE_SPREAD_BEND = 0.5
/** Metres around a weight over which bare bars share it with the weights beside it. */
const BARS_SHARE_REACH = 0.6
const RIM_REACH = 1.45
/** Under this temperature (°C) a flame does nothing to the ground. */
const FLAME_MINIMUM = 200
/** How far over the ground a flame still touches it, beyond its radius. */
const FLAME_REACH = 0.6
/** How far a blast above the ground still reaches it, as a share of its radius. */
const BLAST_HEIGHT_REACH = 0.35
/**
 * Metres of ground the fireball of a 1 MJ blast blackens, growing with the cube root of the energy (a frag grenade, 200 kJ: about 0.7 m), and the share of
 * the material's darkest char (`TerrainFireResponse.maxScorch`) it leaves at the centre, fading to the edge: concrete only soots, turf chars.
 */
const BLAST_SOOT_REACH = 1.2
const BLAST_SOOT = 0.9
/** Share of a blow's energy that throws the pieces. */
const THROW_SHARE = 0.02
/** Side of a square of ground that burns as one, in metres. */
const FIRE_CELL = 0.5
const FIRE_SECONDS = 7
const FIRE_SPREAD_PER_SECOND = 0.35
const SLIDE_SHARE = 0.4
const SLIDE_EPSILON = 0.002
/** Radius of a thrown piece per kind: a clod is a fist of soil, a chip is a thumb of concrete. */
const PIECE_RADIUS: Record<TerrainMaterial['debris'], number> = { clods: 0.045, chips: 0.022, shards: 0.028, splinters: 0.02, dust: 0.012, blocks: 0.08 }
/** Metres per second the fastest piece of a blow leaves at: a blast throws, a dropped weight only kicks. */
const MAX_PIECE_SPEED: Record<TerrainBlow, number> = { explosive: 14, ballistic: 5, blunt: 2.5, slash: 1.5 }

/** Cells the bed takes to go from the bank down to the full depth, so that a body wades in instead of falling. */
const BANK_CELLS = 6
const CRACK_MIN_RADIUS = 0.18
const RIPPLE_SECONDS = 1.6
/** Water thinner than this at the bank neither splashes nor floats anything. */
const WATER_MINIMUM = 0.02

const clampIndex = (value: number, max: number): number => Math.max(0, Math.min(max, value))
const sparse = (array: Float32Array): [number, number][] => {
  const entries: [number, number][] = []
  array.forEach((value, index) => {
    if (value !== 0) entries.push([index, value])
  })
  return entries
}
const fillSparse = (array: Float32Array, entries: readonly (readonly [number, number])[]): void => {
  array.fill(0)
  for (const [index, value] of entries) array[index] = value
}

/** Layer a depth falls in; past the end, the last one. */
function stratumAtDepth(profile: TerrainProfile, depth: number): { index: number; stratum: TerrainStratum; top: number } {
  let top = 0
  for (let index = 0; index < profile.strata.length; index++) {
    const stratum = profile.strata[index]!
    if (depth < top + stratum.thickness - 1e-6) return { index, stratum, top }
    top += stratum.thickness
  }
  const index = profile.strata.length - 1
  const stratum = profile.strata[index]!
  return { index, stratum, top: top - stratum.thickness }
}

/** Same stratum as `stratumAtDepth`, without allocating: per-read paths (state(), fire per vertex) must not create garbage. */
function stratumMaterialAtDepth(profile: TerrainProfile, depth: number): string {
  const strata = profile.strata
  let top = 0
  for (let index = 0; index < strata.length; index++) {
    const stratum = strata[index]!
    if (depth < top + stratum.thickness - 1e-6) return stratum.material
    top += stratum.thickness
  }
  return strata[strata.length - 1]!.material
}
const totalThickness = (profile: TerrainProfile): number => profile.strata.reduce((sum, stratum) => sum + stratum.thickness, 0)

export function createTerrain(options: TerrainOptions): Terrain {
  const [x0, z0, x1, z1] = options.bounds
  const cellSize = options.cellSize ?? 0.1
  const chunkCells = options.chunkCells ?? 32
  const columns = Math.max(1, Math.ceil((x1 - x0) / cellSize))
  const rows = Math.max(1, Math.ceil((z1 - z0) / cellSize))
  const stride = columns + 1
  const vertexCount = stride * (rows + 1)
  const chunksX = Math.ceil(columns / chunkCells)
  const chunksZ = Math.ceil(rows / chunkCells)
  const budget: TerrainBudget = { ...DEFAULT_TERRAIN_BUDGET, ...options.budget }
  const gravity = options.gravity ?? GRAVITY
  const materials = new Map<string, TerrainMaterial>([...TERRAIN_MATERIALS, ...(options.materials ?? [])].map((material) => [material.id, material]))
  const profileMap = new Map<string, TerrainProfile>([...TERRAIN_PROFILES, ...(options.profiles ?? [])].map((profile) => [profile.id, profile]))
  const profileList = [...profileMap.values()]
  for (const profile of profileList) {
    for (const stratum of profile.strata) if (!materials.has(stratum.material)) throw new Error(`game-terrain: profile "${profile.id}" uses material "${stratum.material}", which has no ground behaviour`)
  }
  const indexOfProfile = new Map(profileList.map((profile, index) => [profile.id, index]))
  const maxDepthOf = profileList.map(totalThickness)

  // `surface` is the ground as the map has it; `base` is that less the water standing on it, so that everything that stands on the ground stands on the bed
  const surface = new Float32Array(vertexCount)
  if (options.baseHeight) {
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) surface[row * stride + column] = options.baseHeight(x0 + column * cellSize, z0 + row * cellSize)
  }
  const base = Float32Array.from(surface)
  const hasWater = profileList.some((profile) => profile.water)
  const dug = new Float32Array(vertexCount)
  const loose = new Float32Array(vertexCount)
  const scorch = new Float32Array(vertexCount)
  const barBend = new Float32Array(vertexCount)
  const profileIndex = new Uint8Array(vertexCount)
  const touched = new Uint8Array(chunksX * chunksZ)
  const mixed = new Uint8Array(chunksX * chunksZ)
  const dirty = new Set<number>()
  const marks = createMarkStore(budget)
  const cracks = createCrackStore()
  const decalList: TerrainDecal[] = []
  let decalSerial = 0
  let decalsVersion = 0
  const unitDamage = new Map<string, number>()
  const debrisStore = createDebrisStore(() => budget.maxDebris)
  const sliding = new Set<number>()
  const burning = new Map<number, number>()
  const seed = options.seed ?? 1
  let random = createRandom(seed)
  let currentLayout: GroundLayout = options.layout ?? { surface: DEFAULT_PROFILE }

  const deformListeners = new Set<(region: TerrainRegion) => void>()
  const emitDeform = (x: number, z: number, radius: number): void => {
    for (const listener of deformListeners) listener({ x, z, radius })
  }
  const grid: HeightGrid = { x0, z0, cellSize, stride, columns, rows, dug }
  /** Sand that is still sliding: what it lowered so far, told once it comes to rest. */
  const slideTally: LossTally = new Map()
  const emitGroundLoss = (tally: LossTally, source: string, minLowering: number): void => {
    if (!options.onGroundLoss) return
    const loss = lossOf(grid, tally, { source, minLowering, shape: source === 'slab' ? 'flat' : 'bowl' })
    if (loss) options.onGroundLoss(loss)
  }
  /** Lowers a vertex to `depth` under the untouched surface, counting it in `tally`. */
  const dropVertex = (index: number, depth: number, tally: LossTally): void => {
    tallyLowered(tally, index, depth - dug[index]!)
    dug[index] = depth
  }

  const chunkOfVertex = (column: number, row: number): number => Math.min(chunksZ - 1, Math.floor(row / chunkCells)) * chunksX + Math.min(chunksX - 1, Math.floor(column / chunkCells))
  /** A vertex on a chunk's edge belongs to its neighbours as well. */
  function touchVertex(column: number, row: number): void {
    const chunk = chunkOfVertex(column, row)
    touched[chunk] = 1
    dirty.add(chunk)
    if (column % chunkCells === 0 && column > 0) markChunk(chunk - 1)
    if (row % chunkCells === 0 && row > 0) markChunk(chunk - chunksX)
    if (column % chunkCells === 0 && row % chunkCells === 0 && column > 0 && row > 0) markChunk(chunk - chunksX - 1)
  }
  function markChunk(chunk: number): void {
    touched[chunk] = 1
    dirty.add(chunk)
  }

  const profileId = (id: string): number => indexOfProfile.get(id) ?? indexOfProfile.get(DEFAULT_PROFILE) ?? 0

  function applyLayout(layout: GroundLayout): void {
    currentLayout = layout
    profileIndex.fill(profileId(layout.surface))
    for (const zone of layout.zones ?? []) {
      const index = profileId(zone.surface)
      const [zx0, zz0, zx1, zz1] = zone.rect
      const column0 = clampIndex(Math.round((zx0 - x0) / cellSize), columns)
      const column1 = clampIndex(Math.round((zx1 - x0) / cellSize), columns)
      const row0 = clampIndex(Math.round((zz0 - z0) / cellSize), rows)
      const row1 = clampIndex(Math.round((zz1 - z0) / cellSize), rows)
      for (let row = row0; row <= row1; row++) profileIndex.fill(index, row * stride + column0, row * stride + column1 + 1)
    }
    if (hasWater) layBeds()
    for (let chunkZ = 0; chunkZ < chunksZ; chunkZ++) {
      for (let chunkX = 0; chunkX < chunksX; chunkX++) {
        const chunk = chunkZ * chunksX + chunkX
        const first = profileIndex[(chunkZ * chunkCells) * stride + chunkX * chunkCells]
        const firstDrop = surface[(chunkZ * chunkCells) * stride + chunkX * chunkCells]! - base[(chunkZ * chunkCells) * stride + chunkX * chunkCells]!
        let isMixed = 0
        const lastRow = Math.min(rows, (chunkZ + 1) * chunkCells)
        const lastColumn = Math.min(columns, (chunkX + 1) * chunkCells)
        for (let row = chunkZ * chunkCells; row <= lastRow && !isMixed; row++) {
          for (let column = chunkX * chunkCells; column <= lastColumn; column++) {
            if (profileIndex[row * stride + column] !== first || surface[row * stride + column]! - base[row * stride + column]! !== firstDrop) {
              isMixed = 1
              break
            }
          }
        }
        mixed[chunk] = isMixed
        dirty.add(chunk)
      }
    }
    for (const excavation of layout.excavations ?? []) excavate(excavation)
  }

  /**
   * Digs a construction's trench or pit: every vertex over the rectangle (the cell it starts in to the one it ends in, so the full depth spans the whole
   * rectangle and the wall slopes in the cell outside it) down to its depth, never less deep than it already was. A planned dig is no ground loss.
   */
  function excavate(excavation: GroundExcavation): void {
    const [ex0, ez0, ex1, ez1] = excavation.rect
    const column0 = clampIndex(Math.floor((ex0 - x0) / cellSize + 1e-6), columns)
    const column1 = clampIndex(Math.ceil((ex1 - x0) / cellSize - 1e-6), columns)
    const row0 = clampIndex(Math.floor((ez0 - z0) / cellSize + 1e-6), rows)
    const row1 = clampIndex(Math.ceil((ez1 - z0) / cellSize - 1e-6), rows)
    const alongX = (excavation.along ?? (ex1 - ex0 >= ez1 - ez0 ? 'x' : 'z')) === 'x'
    const from = alongX ? ex0 : ez0, length = Math.max(1e-6, alongX ? ex1 - ex0 : ez1 - ez0)
    const far = excavation.toDepth ?? excavation.depth
    for (let row = row0; row <= row1; row++) {
      for (let column = column0; column <= column1; column++) {
        const index = row * stride + column
        const at = alongX ? x0 + column * cellSize : z0 + row * cellSize
        const t = Math.max(0, Math.min(1, (at - from) / length))
        const depth = excavation.depth + (far - excavation.depth) * t
        if (depth <= dug[index]!) continue
        dug[index] = depth
        touchVertex(column, row)
      }
    }
  }

  /** Lowers the ground under the water, in a bank from the edge of each pool. */
  function layBeds(): void {
    const steps = new Uint8Array(vertexCount)
    for (let index = 0; index < vertexCount; index++) steps[index] = profileList[profileIndex[index]!]!.water ? BANK_CELLS : 0
    for (let pass = 0; pass < BANK_CELLS; pass++) {
      for (let row = 0; row <= rows; row++) {
        for (let column = 0; column <= columns; column++) {
          const index = row * stride + column
          if (steps[index] === 0) continue
          const lowest = Math.min(column > 0 ? steps[index - 1]! : BANK_CELLS, column < columns ? steps[index + 1]! : BANK_CELLS, row > 0 ? steps[index - stride]! : BANK_CELLS, row < rows ? steps[index + stride]! : BANK_CELLS)
          steps[index] = Math.min(steps[index]!, lowest + 1)
        }
      }
    }
    for (let index = 0; index < vertexCount; index++) base[index] = surface[index]! - (profileList[profileIndex[index]!]!.water?.depth ?? 0) * (steps[index]! / BANK_CELLS)
  }

  const vertexHeight = (column: number, row: number): number => {
    const index = row * stride + column
    return base[index]! - dug[index]! + loose[index]!
  }
  const contains = (x: number, z: number): boolean => x >= x0 && x <= x1 && z >= z0 && z <= z1

  function addDecal(spec: Omit<TerrainDecal, 'id' | 'age'>): void {
    if (decalList.length >= budget.maxDecals) decalList.shift()
    decalList.push({ ...spec, id: ++decalSerial, age: 0 })
    decalsVersion++
  }
  function clearDecalsInside(x: number, z: number, radius: number): void {
    const before = decalList.length
    for (let i = before - 1; i >= 0; i--) {
      const decal = decalList[i]!
      if (decal.kind !== 'ripple' && decal.kind !== 'splat' && decal.kind !== 'crack' && Math.hypot(decal.x - x, decal.z - z) < radius) decalList.splice(i, 1)
    }
    if (decalList.length !== before) decalsVersion++
  }

  function heightAt(x: number, z: number): number {
    // beyond the terrain the ground is untouched: no blow can dig it and a piece thrown out lands on it
    if (!contains(x, z)) return options.baseHeight?.(x, z) ?? 0
    const fx = Math.max(0, Math.min(columns - 1e-6, (x - x0) / cellSize))
    const fz = Math.max(0, Math.min(rows - 1e-6, (z - z0) / cellSize))
    const column = fx | 0
    const row = fz | 0
    const tx = fx - column
    const tz = fz - row
    const index = row * stride + column
    const h = (i: number): number => base[i]! - dug[i]! + loose[i]!
    return (h(index) * (1 - tx) + h(index + 1) * tx) * (1 - tz) + (h(index + stride) * (1 - tx) + h(index + stride + 1) * tx) * tz
  }

  const vertexOf = (x: number, z: number): { column: number; row: number; index: number } => {
    const column = clampIndex(Math.round((x - x0) / cellSize), columns)
    const row = clampIndex(Math.round((z - z0) / cellSize), rows)
    return { column, row, index: row * stride + column }
  }

  function waterAt(x: number, z: number): { liquid: string; level: number; depth: number } | null {
    if (!hasWater || !contains(x, z)) return null
    const { index } = vertexOf(x, z)
    const water = profileList[profileIndex[index]!]!.water
    if (!water) return null
    const level = surface[index]!
    const depth = level - heightAt(x, z)
    return depth > WATER_MINIMUM ? { liquid: water.liquid, level, depth } : null
  }
  const exposedAt = (x: number, z: number): TerrainMaterial => {
    const { column, row } = vertexOf(x, z)
    return vertexMaterial(column, row)
  }
  const footAt = (x: number, z: number): number => {
    if (!contains(x, z)) return heightAt(x, z)
    return heightAt(x, z) - (exposedAt(x, z).footing?.sink ?? 0)
  }
  function walkFactorAt(x: number, z: number): number {
    if (!contains(x, z)) return 1
    const water = waterAt(x, z) ? profileList[profileIndex[vertexOf(x, z).index]!]!.water : null
    return Math.min(water?.drag ?? 1, exposedAt(x, z).footing?.drag ?? 1)
  }
  function ripple(x: number, z: number, radius: number): void {
    addDecal({ kind: 'ripple', x, z, radius, angle: 0, material: exposedAt(x, z).id })
  }
  function press(spec: { x: number; z: number; radius: number; angle?: number; kind?: 'print' | 'rut' }): boolean {
    if (!contains(spec.x, spec.z)) return false
    if (waterAt(spec.x, spec.z)) {
      ripple(spec.x, spec.z, spec.radius * 2)
      return true
    }
    const material = exposedAt(spec.x, spec.z)
    if (!material.footing?.prints) return false
    addDecal({ kind: spec.kind ?? 'print', x: spec.x, z: spec.z, radius: spec.radius, angle: spec.angle ?? 0, material: material.id })
    return true
  }

  function vertexMaterial(column: number, row: number): TerrainMaterial {
    const index = row * stride + column
    return materials.get(stratumMaterialAtDepth(profileList[profileIndex[index]!]!, dug[index]!))!
  }

  function columnAt(x: number, z: number): TerrainColumn {
    const { index } = vertexOf(x, z)
    const which = profileIndex[index]!
    const profile = profileList[which]!
    const depth = Math.min(maxDepthOf[which]!, dug[index]! + marks.depthAt(x, z))
    const layer = stratumAtDepth(profile, depth)
    return { profile: profile.id, material: layer.stratum.material, stratum: layer.index, depth, remaining: maxDepthOf[which]! - depth, scorch: scorch[index]!, loose: loose[index]! }
  }

  /** Removes from a vertex: what is heaped first, then the column, never past its limit. Returns what came off. */
  function removeFromVertex(index: number, amount: number): number {
    const fromLoose = Math.min(loose[index]!, amount)
    loose[index] = loose[index]! - fromLoose
    const fromColumn = Math.min(maxDepthOf[profileIndex[index]!]! - dug[index]!, amount - fromLoose)
    if (fromColumn > 0) dug[index] = dug[index]! + fromColumn
    return fromLoose + Math.max(0, fromColumn)
  }
  /** Adds to a vertex: a soft floor fills what was dug, then heaps; on a rigid one the rubble just heaps. */
  function addToVertex(index: number, amount: number, fillsColumn: boolean): void {
    const filled = fillsColumn ? Math.min(dug[index]!, amount) : 0
    dug[index] = dug[index]! - filled
    loose[index] = loose[index]! + amount - filled
  }
  const isSoftExposed = (index: number): boolean => materials.get(stratumAtDepth(profileList[profileIndex[index]!]!, dug[index]!).stratum.material)!.reposeDegrees !== undefined

  /** Digs a lobed bowl into the height field, heaps the rim share around it. */
  function stampBowl(x: number, z: number, radius: number, depth: number, rimVolume: number, lossSource: string | null = 'crater'): void {
    const reach = radius * RIM_REACH
    const column0 = clampIndex(Math.floor((x - reach - x0) / cellSize), columns)
    const column1 = clampIndex(Math.ceil((x + reach - x0) / cellSize), columns)
    const row0 = clampIndex(Math.floor((z - reach - z0) / cellSize), rows)
    const row1 = clampIndex(Math.ceil((z + reach - z0) / cellSize), rows)
    const phaseA = random() * 6.283
    const phaseB = random() * 6.283
    const shapeOf = (px: number, pz: number): number => {
      const angle = Math.atan2(pz - z, px - x)
      return Math.hypot(px - x, pz - z) / (radius * (1 + 0.12 * Math.sin(angle * 5 + phaseA) + 0.06 * Math.sin(angle * 11 + phaseB)))
    }
    let rimWeight = 0
    if (rimVolume > 0) {
      for (let row = row0; row <= row1; row++) {
        for (let column = column0; column <= column1; column++) {
          const q = shapeOf(x0 + column * cellSize, z0 + row * cellSize)
          if (q >= 1 && q < RIM_REACH) rimWeight += Math.sin(((q - 1) / (RIM_REACH - 1)) * Math.PI)
        }
      }
    }
    const cellArea = cellSize * cellSize
    const tally: LossTally = new Map()
    for (let row = row0; row <= row1; row++) {
      for (let column = column0; column <= column1; column++) {
        const q = shapeOf(x0 + column * cellSize, z0 + row * cellSize)
        const index = row * stride + column
        if (q < 1) {
          const before = dug[index]!
          removeFromVertex(index, depth * (1 - q * q) * (0.92 + random() * 0.16))
          tallyLowered(tally, index, dug[index]! - before)
          sliding.add(index)
          touchVertex(column, row)
        } else if (q < RIM_REACH && rimWeight > 0) {
          loose[index] = loose[index]! + (rimVolume * Math.sin(((q - 1) / (RIM_REACH - 1)) * Math.PI)) / (rimWeight * cellArea)
          sliding.add(index)
          touchVertex(column, row)
        }
      }
    }
    marks.removeInside(x, z, radius)
    clearDecalsInside(x, z, radius)
    emitDeform(x, z, reach)
    if (lossSource) emitGroundLoss(tally, lossSource, 0)
  }

  function throwPieces(spec: { x: number; y: number; z: number; volume: number; material: TerrainMaterial; energy: number; direction?: readonly number[]; quota: number; bowlRadius: number; blow: TerrainBlow }): void {
    const radius = PIECE_RADIUS[spec.material.debris]
    const pieceVolume = (4 / 3) * Math.PI * radius ** 3
    const count = Math.min(spec.quota, Math.max(1, Math.round(spec.volume / pieceVolume)))
    const mass = Math.max(1e-3, spec.volume * 1500)
    const launch = Math.min(MAX_PIECE_SPEED[spec.blow], Math.sqrt((2 * spec.energy * THROW_SHARE) / mass))
    for (let i = 0; i < count; i++) {
      const angle = random() * 6.283
      const out = spec.bowlRadius * Math.sqrt(random()) * 0.8
      const speed = launch * (0.5 + random() * 0.7)
      const spread = 0.35 + random() * 0.65
      const backX = spec.direction ? -(spec.direction[0] ?? 0) * 0.4 : 0
      const backZ = spec.direction ? -(spec.direction[2] ?? 0) * 0.4 : 0
      debrisStore.throwPiece({
        material: spec.material.id,
        kind: spec.material.debris,
        radius: radius * (0.6 + random() * 0.9),
        position: [spec.x + Math.cos(angle) * out, spec.y + 0.03, spec.z + Math.sin(angle) * out],
        velocity: [(Math.cos(angle) * spread + backX) * speed, (0.6 + random() * 0.7) * speed, (Math.sin(angle) * spread + backZ) * speed],
        spin: [(random() - 0.5) * 14, (random() - 0.5) * 14, (random() - 0.5) * 14],
      })
    }
  }

  function strike(blow: TerrainBlow, spec: TerrainStrike): TerrainBlowResult {
    const { x, z } = spec
    const start = columnAt(x, z)
    const profile = profileMap.get(start.profile)!
    const waterHere = waterAt(x, z)
    const waterResult = waterHere ? { water: { liquid: waterHere.liquid, level: waterHere.level } } : {}
    if (waterHere) ripple(x, z, Math.min(1.5, 0.15 + Math.cbrt(spec.energy) / 40))
    const removed: { material: string; volume: number }[] = []
    const point: [number, number, number] = [x, heightAt(x, z), z]
    const startLayer = stratumAtDepth(profile, start.depth)
    if (start.loose <= 0 && materials.get(startLayer.stratum.material)!.units) return strikeUnits(blow, spec, startLayer, profile, point)
    const blowEnergy = spec.energy * (waterHere ? (profile.water?.blowShare[blow] ?? 1) : 1)
    let energy = blowEnergy
    let depth = start.depth
    let radius = 0
    let carved = 0
    let breached = false
    const firstMaterial = materials.get(start.material)!
    if (start.loose <= 0) {
      for (;;) {
        const layer = stratumAtDepth(profile, depth)
        const bottom = layer.top + layer.stratum.thickness
        const room = bottom - depth
        if (room <= 1e-6) break
        const material = materials.get(layer.stratum.material)!
        const response = material.hits[blow]
        if (!response || energy < (response.thresholdJoules ?? 0)) break
        const bars = layer.stratum.reinforcement
        // a contact charge with enough for the whole thickness of a rigid layer breaks it right through: the shock spalls the far face and the layer goes in one piece, bars or not
        const breach = blow === 'explosive' ? material.breach : undefined
        const breachJoules = breach ? breach.joulesPerCubedThickness * layer.stratum.thickness ** 3 : Infinity
        if (breach && depth <= layer.top + 1e-6 && energy >= breachJoules) {
          const takenRadius = layer.stratum.thickness * breach.radiusOverThickness * Math.cbrt(energy / breachJoules)
          const takenVolume = (Math.PI * takenRadius * takenRadius * room) / 2
          energy -= breachJoules
          depth += room
          carved += room
          breached = true
          radius = Math.max(radius, takenRadius)
          removed.push({ material: material.id, volume: takenVolume })
          continue
        }
        const pastCover = bars !== undefined && depth - layer.top >= bars.cover - 1e-6
        const specificEnergy = response.specificEnergy * (pastCover ? bars.resistance : 1)
        const limit = bars && !pastCover ? Math.min(room, layer.top + bars.cover - depth) : room
        const aspect = response.aspect * caliberAspect(spec.caliber)
        const volume = energy / specificEnergy
        const wanted = Math.cbrt((2 * volume) / (Math.PI * aspect))
        const wantedDepth = wanted * aspect
        const takenDepth = Math.min(wantedDepth, limit)
        const takenRadius = takenDepth < wantedDepth ? takenDepth / aspect : wanted
        const takenVolume = (Math.PI * takenRadius * takenRadius * takenDepth) / 2
        energy -= takenVolume * specificEnergy
        depth += takenDepth
        carved += takenDepth
        radius = Math.max(radius, takenRadius, response.minRadius ?? 0, spec.contactRadius ?? 0, caliberRadius(spec.caliber))
        const last = removed[removed.length - 1]
        if (last?.material === material.id) (last as { volume: number }).volume += takenVolume
        else removed.push({ material: material.id, volume: takenVolume })
        if (energy <= 1e-6 || takenDepth >= wantedDepth - 1e-9) break
      }
    } else {
      // a loose heap has no strength: it takes the blow as soft ground before the column does
      const response = firstMaterial.hits[blow]
      if (response && energy >= (response.thresholdJoules ?? 0)) {
        const volume = energy / response.specificEnergy
        radius = Math.cbrt((2 * volume) / (Math.PI * response.aspect))
        carved = radius * response.aspect
        removed.push({ material: firstMaterial.id, volume })
      }
    }
    let collapsed = loadBars(blow, spec.energy, x, z, profile)
    const crack = crackAround(blow, spec.energy, x, z, start.loose > 0 ? undefined : firstMaterial)
    const extra = { ...(crack ? { crack } : {}), ...(breached ? { breached } : {}), ...waterResult }
    // a weight that lands flat (its contact as wide as the dent) presses the ground down: it packs the soil under it, it does not take it away
    const pressed = spec.contactRadius !== undefined && spec.contactRadius >= radius
    if (radius <= 0) return { point, radius: 0, depth: 0, totalDepth: columnAt(x, z).depth, removed: [], exposed: start.material, atLimit: start.remaining <= 1e-6, rebarExposed: rebarShowing(profile, start.depth), collapsed, fine: true, ...extra }

    // a rigid floor cannot go down any more where it is already deep: the next blow breaks the edge of the hole, so a hole in a slab opens as it deepens
    if (firstMaterial.reposeDegrees === undefined && start.loose <= 0) radius *= 1 + RIGID_WIDENING * (start.depth / maxDepthOfProfile(profile))

    const volumeTotal = removed.reduce((sum, entry) => sum + entry.volume, 0)
    const fine = radius < cellSize * FINE_CELLS
    if (fine) depositMark({ x, z, radius, depth: carved, blow, profile, cap: maxDepthOfProfile(profile) })
    else {
      const rimShare = materials.get(removed[0]!.material)!.rimShare ?? 0
      stampBowl(x, z, radius, carved, volumeTotal * rimShare, pressed ? null : 'crater')
    }
    if (firstMaterial.cracks) addDecal({ kind: 'crack', x, z, radius: Math.max(CRACK_MIN_RADIUS, radius * firstMaterial.cracks), angle: random() * 6.283, material: firstMaterial.id })
    // under water what comes off stays a cloud at the bottom, unless a blast opens the water
    let quota = waterHere && blow !== 'explosive' ? 0 : budget.maxDebrisPerBlow
    for (const entry of removed) {
      const material = materials.get(entry.material)!
      const thrown = entry.volume * (1 - (fine ? 0 : (material.rimShare ?? 0)))
      if (thrown <= 0 || quota <= 0) continue
      const share = Math.max(1, Math.round((quota * entry.volume) / volumeTotal))
      throwPieces({ x, y: point[1], z, volume: thrown, material, energy: spec.energy * (entry.volume / volumeTotal), direction: spec.direction, quota: share, bowlRadius: radius, blow })
      quota -= share
    }
    // a breach bares the bars under the same blow that broke the concrete, so they take that blow's load at once and, over a void, may let the floor go
    if (breached) collapsed = loadBars(blow, spec.energy, x, z, profile) || collapsed
    const after = columnAt(x, z)
    return { point, radius, depth: carved, totalDepth: after.depth, removed, exposed: after.material, atLimit: after.remaining <= 1e-4, rebarExposed: rebarShowing(profile, after.depth), collapsed, fine, ...extra }
  }

  /** A rigid surface cracks around a hard enough blow, the lines running out with the cube root of the energy; a soft one (soil, sand, turf) only gives way. */
  function crackAround(blow: TerrainBlow, energy: number, x: number, z: number, material: TerrainMaterial | undefined): ReturnType<typeof cracks.add> | undefined {
    const response = material?.crack
    if (!material || !response || energy < response.thresholdJoules) return undefined
    // a cut does not crack a slab; a bullet, a hammer and a blast do
    if (blow === 'slash') return undefined
    const scale = Math.cbrt(energy / CRACK_REFERENCE_JOULES)
    return cracks.add({ x, z, reach: response.reach * scale, width: response.width * scale, material: material.id, seed: Math.floor(random() * 2 ** 31) }, budget.maxCracks)
  }

  /**
   * A floor of separate pieces: a blow does not dig them, it shakes them. Each takes the energy that reaches it, added blow by blow, and past its limit it comes off the bed whole and is thrown.
   * Under the limit the blow only chips it.
   */
  function strikeUnits(blow: TerrainBlow, spec: TerrainStrike, layer: { stratum: TerrainStratum; top: number }, profile: TerrainProfile, point: [number, number, number]): TerrainBlowResult {
    const { x, z, energy } = spec
    const material = materials.get(layer.stratum.material)!
    const units = material.units!
    const response = material.hits[blow]
    const bottom = layer.top + layer.stratum.thickness
    const miss: TerrainBlowResult = { point, radius: 0, depth: 0, totalDepth: layer.top, removed: [], exposed: material.id, atLimit: false, rebarExposed: false, collapsed: false, fine: true }
    if (!response || energy < (response.thresholdJoules ?? 0)) return miss
    const reach = Math.max(spec.contactRadius ?? 0, response.minRadius ?? 0, caliberRadius(spec.caliber), Math.cbrt((2 * energy) / response.specificEnergy / (Math.PI * response.aspect * caliberAspect(spec.caliber))))
    const rowFirst = Math.floor((z - reach) / units.width)
    const rowLast = Math.floor((z + reach) / units.width)
    let loosened = 0
    for (let row = rowFirst; row <= rowLast; row++) {
      const shift = Math.abs(row % 2) * cellSize
      const unitFirst = Math.floor((x - reach - shift) / units.length)
      const unitLast = Math.floor((x + reach - shift) / units.length)
      for (let unit = unitFirst; unit <= unitLast; unit++) {
        const minX = unit * units.length + shift
        const minZ = row * units.width
        const near = Math.hypot(Math.max(minX - x, 0, x - minX - units.length), Math.max(minZ - z, 0, z - minZ - units.width))
        if (near > reach) continue
        const key = `${unit}:${row}`
        const taken = (unitDamage.get(key) ?? 0) + energy * (1 - (near / (reach + 1e-6)) ** 2)
        unitDamage.set(key, taken)
        if (taken >= units.looseJoules && liftUnit(minX, minZ, units, bottom, material, profile)) {
          loosened++
          const speed = Math.min(MAX_PIECE_SPEED[blow], Math.sqrt((2 * energy * THROW_SHARE) / Math.max(1, loosened * 15)))
          const angle = random() * 6.283
          debrisStore.throwPiece({ material: material.id, kind: 'blocks', radius: units.length / 2, position: [minX + units.length / 2, point[1] + 0.05, minZ + units.width / 2], velocity: [Math.cos(angle) * speed * 0.6, speed * (0.5 + random() * 0.5), Math.sin(angle) * speed * 0.6], spin: [(random() - 0.5) * 8, (random() - 0.5) * 8, (random() - 0.5) * 8] })
        }
      }
    }
    if (loosened === 0) {
      // not enough to lift a piece: a chip off its face and a hairline
      addDecal({ kind: 'crack', x, z, radius: Math.max(0.05, reach * 2), angle: random() * 6.283, material: material.id })
      throwPieces({ x, y: point[1], z, volume: 1e-5, material: { ...material, debris: 'chips' }, energy, ...(spec.direction ? { direction: spec.direction } : {}), quota: 3, bowlRadius: 0.02, blow })
      return { ...miss, radius: Math.max(0.02, Math.min(reach, 0.06)) }
    }
    emitDeform(x, z, reach + units.length)
    clearDecalsInside(x, z, reach)
    const volume = loosened * units.length * units.width * layer.stratum.thickness
    const after = columnAt(x, z)
    return { point, radius: reach, depth: layer.stratum.thickness, totalDepth: after.depth, removed: [{ material: material.id, volume }], exposed: after.material, atLimit: false, rebarExposed: false, collapsed: false, fine: false }
  }

  /** Takes one piece off its bed. False when it had already gone. */
  function liftUnit(minX: number, minZ: number, units: { length: number; width: number }, bottom: number, material: TerrainMaterial, profile: TerrainProfile): boolean {
    const column0 = clampIndex(Math.round((minX - x0) / cellSize), columns)
    const column1 = clampIndex(Math.round((minX + units.length - x0) / cellSize), columns)
    const row0 = clampIndex(Math.round((minZ - z0) / cellSize), rows)
    const row1 = clampIndex(Math.round((minZ + units.width - z0) / cellSize), rows)
    let lifted = false
    for (let row = row0; row <= row1; row++) {
      for (let column = column0; column <= column1; column++) {
        const index = row * stride + column
        if (profileList[profileIndex[index]!]!.id !== profile.id || dug[index]! >= bottom) continue
        if (materials.get(stratumAtDepth(profile, dug[index]!).stratum.material) !== material) continue
        dug[index] = bottom
        lifted = true
        touchVertex(column, row)
      }
    }
    return lifted
  }

  /**
   * A blow loads the bars that are bare around it: they bend, and past their limit they give way. The bowl a blow would open tells how far it reaches. Where the slab has nothing under it, the floor goes with them.
   */
  function loadBars(blow: TerrainBlow, energy: number, x: number, z: number, profile: TerrainProfile): boolean {
    const bars = profile.strata.find((stratum) => stratum.reinforcement)
    if (!bars?.reinforcement) return false
    const response = materials.get(bars.material)!.hits[blow]
    if (!response || energy < (response.thresholdJoules ?? 0)) return false
    const yieldJoules = bars.reinforcement.yieldJoules ?? DEFAULT_BAR_YIELD_JOULES
    let cover = bars.reinforcement.cover
    for (const stratum of profile.strata) {
      if (stratum === bars) break
      cover += stratum.thickness
    }
    const reach = Math.max(cellSize * FINE_CELLS, Math.cbrt((2 * energy) / response.specificEnergy / (Math.PI * response.aspect)) * (1 + RIGID_WIDENING))
    const column0 = clampIndex(Math.floor((x - reach - x0) / cellSize), columns)
    const column1 = clampIndex(Math.ceil((x + reach - x0) / cellSize), columns)
    const row0 = clampIndex(Math.floor((z - reach - z0) / cellSize), rows)
    const row1 = clampIndex(Math.ceil((z + reach - z0) / cellSize), rows)
    const limit = maxDepthOfProfile(profile)
    let collapsed = false
    const tally: LossTally = new Map()
    for (let row = row0; row <= row1; row++) {
      for (let column = column0; column <= column1; column++) {
        const index = row * stride + column
        if (dug[index]! < cover) continue
        const q = Math.hypot(x0 + column * cellSize - x, z0 + row * cellSize - z) / reach
        if (q >= 1) continue
        barBend[index] = barBend[index]! + (energy / yieldJoules) * (1 - q * q)
        touchVertex(column, row)
        if (barBend[index]! >= 1 && profile.drop !== undefined && dug[index]! >= limit * COLLAPSE_DEPTH_SHARE && dug[index]! < limit + profile.drop) {
          dropVertex(index, limit + profile.drop, tally)
          collapsed = true
        }
      }
    }
    if (collapsed) giveWay({ x, z, reach, profile, tally })
    emitGroundLoss(tally, 'slab', 0)
    return collapsed
  }

  /** What gave way takes down what was already bending around it, and what stood there must look again. */
  function giveWay(spec: { x: number; z: number; reach: number; profile: TerrainProfile; tally: LossTally }): void {
    const { x, z, reach, profile, tally } = spec
    emitDeform(x, z, reach)
    if (profile.drop === undefined) return
    const limit = maxDepthOfProfile(profile)
    const column0 = clampIndex(Math.floor((x - reach - x0) / cellSize), columns)
    const column1 = clampIndex(Math.ceil((x + reach - x0) / cellSize), columns)
    const row0 = clampIndex(Math.floor((z - reach - z0) / cellSize), rows)
    const row1 = clampIndex(Math.ceil((z + reach - z0) / cellSize), rows)
    for (let row = row0; row <= row1; row++) {
      for (let column = column0; column <= column1; column++) {
        const index = row * stride + column
        if (barBend[index]! >= COLLAPSE_SPREAD_BEND && dug[index]! < limit + profile.drop) {
          dropVertex(index, limit + profile.drop, tally)
          touchVertex(column, row)
        }
      }
    }
  }

  /** Depth under the surface of the bars of a profile, and the stratum that holds them. */
  function barsOf(profile: TerrainProfile): { stratum: TerrainStratum; cover: number } | null {
    const bars = profile.strata.find((stratum) => stratum.reinforcement)
    if (!bars?.reinforcement) return null
    let cover = bars.reinforcement.cover
    for (const stratum of profile.strata) {
      if (stratum === bars) break
      cover += stratum.thickness
    }
    return { stratum: bars, cover }
  }

  /**
   * Weights on bare bars. Each bar over the hole works as a beam that yields at its plastic moment fy·d³/6; the bars of a mesh crossing a hole of any size hold 8·Mp/spacing
   * on a spot, so the bend is the weight over that. Weights over the same bars add up (a stack, things side by side). The share of a footprint on intact concrete is carried
   * by the concrete. Bars do not spring back: the bend only grows.
   */
  function bearAll(loads: readonly TerrainLoad[]): boolean {
    const bends = new Map<number, number>()
    const touched: { load: TerrainLoad; reach: number; profile: TerrainProfile }[] = []
    for (const load of loads) {
      const spread = spreadLoad(load, bends)
      if (spread) touched.push({ load, ...spread })
    }
    let opened = false
    const tally: LossTally = new Map()
    for (const [index, bend] of bends) {
      if (barBend[index]! >= bend) continue
      barBend[index] = bend
      const column = index % stride
      const row = (index - column) / stride
      touchVertex(column, row)
      const profile = profileList[profileIndex[index]!]!
      const limit = maxDepthOfProfile(profile)
      if (bend >= 1 && profile.drop !== undefined && dug[index]! >= limit * COLLAPSE_DEPTH_SHARE && dug[index]! < limit + profile.drop) {
        dropVertex(index, limit + profile.drop, tally)
        opened = true
      }
    }
    if (opened) for (const { load, reach, profile } of touched) giveWay({ x: load.x, z: load.z, reach, profile, tally })
    emitGroundLoss(tally, 'slab', 0)
    return opened
  }

  /** Adds the bend one weight gives the bare bars under it to `bends`; null where it stands on no bare bars. */
  function spreadLoad(load: TerrainLoad, bends: Map<number, number>): { reach: number; profile: TerrainProfile } | null {
    if (!contains(load.x, load.z) || load.newtons <= 0) return null
    const profile = profileList[profileIndex[vertexOf(load.x, load.z).index]!]!
    const bars = barsOf(profile)
    if (!bars) return null
    const reinforcement = bars.stratum.reinforcement!
    const moment = ((reinforcement.yieldPa ?? DEFAULT_BAR_YIELD_PA) * (reinforcement.diameter ?? DEFAULT_BAR_DIAMETER) ** 3) / 6
    const holds = (8 * moment) / reinforcement.spacing
    // the footprint of a box reaches its corners: a disc of its half side would leave them standing on the slab
    const footprint = load.radius * Math.SQRT2 + cellSize
    // and the bars of a hole carry together what stands on it: weights side by side add up as a stack does
    const reach = Math.max(footprint, BARS_SHARE_REACH)
    const column0 = clampIndex(Math.floor((load.x - reach - x0) / cellSize), columns)
    const column1 = clampIndex(Math.ceil((load.x + reach - x0) / cellSize), columns)
    const row0 = clampIndex(Math.floor((load.z - reach - z0) / cellSize), rows)
    const row1 = clampIndex(Math.ceil((load.z + reach - z0) / cellSize), rows)
    const bare: number[] = []
    let under = 0
    let onBars = 0
    for (let row = row0; row <= row1; row++) {
      for (let column = column0; column <= column1; column++) {
        const distance = Math.hypot(x0 + column * cellSize - load.x, z0 + row * cellSize - load.z)
        if (distance >= reach) continue
        const index = row * stride + column
        const isBare = dug[index]! >= bars.cover
        if (isBare) bare.push(index)
        if (distance >= footprint) continue
        under++
        if (isBare) onBars++
      }
    }
    if (onBars === 0) return null
    const bend = (load.newtons * (onBars / under)) / holds
    for (const index of bare) bends.set(index, (bends.get(index) ?? 0) + bend)
    return { reach, profile }
  }

  const maxDepthOfProfile = (profile: TerrainProfile): number => maxDepthOf[indexOfProfile.get(profile.id)!]!
  function rebarShowing(profile: TerrainProfile, depth: number): boolean {
    const layer = stratumAtDepth(profile, depth)
    return layer.stratum.reinforcement !== undefined && depth - layer.top >= layer.stratum.reinforcement.cover - 1e-6
  }

  function depositMark(spec: { x: number; z: number; radius: number; depth: number; blow: TerrainBlow; profile: TerrainProfile; cap: number }): void {
    const { x, z, radius, depth, blow, profile, cap } = spec
    const dugHere = dug[vertexOf(x, z).index]!
    const existing = marks.near(x, z, radius)
    let mark: TerrainMark
    if (existing) {
      existing.radius = Math.hypot(existing.radius, radius)
      existing.depth = Math.min(cap - dugHere, existing.depth + depth)
      existing.count++
      existing.blow = blow
      mark = existing
    } else {
      mark = marks.add({ x, z, radius, depth: Math.min(cap - dugHere, depth), blow, material: '' })
    }
    mark.material = stratumAtDepth(profile, dugHere + mark.depth - 1e-6).stratum.material
    if (mark.radius >= cellSize * FINE_CELLS || mark.depth >= cellSize * FINE_DEPTH_CELLS) {
      const bowlRadius = Math.max(mark.radius, cellSize * FINE_CELLS)
      const bowlDepth = mark.depth
      marks.remove(mark)
      stampBowl(mark.x, mark.z, bowlRadius, bowlDepth, 0)
    }
  }

  function burn(spec: { x: number; z: number; radius: number; temperature: number; seconds: number }): void {
    if (spec.temperature < FLAME_MINIMUM) return
    const column0 = clampIndex(Math.floor((spec.x - spec.radius - x0) / cellSize), columns)
    const column1 = clampIndex(Math.ceil((spec.x + spec.radius - x0) / cellSize), columns)
    const row0 = clampIndex(Math.floor((spec.z - spec.radius - z0) / cellSize), rows)
    const row1 = clampIndex(Math.ceil((spec.z + spec.radius - z0) / cellSize), rows)
    let melted = false
    for (let row = row0; row <= row1; row++) {
      for (let column = column0; column <= column1; column++) {
        if (Math.hypot(x0 + column * cellSize - spec.x, z0 + row * cellSize - spec.z) > spec.radius) continue
        // water does not catch: only what floats on it could burn
        if (hasWater && base[row * stride + column]! < surface[row * stride + column]!) continue
        melted = burnVertex(column, row, spec.seconds) || melted
      }
    }
    if (melted) emitDeform(spec.x, spec.z, spec.radius)
  }

  /** The soot of a blast's fireball within `radius` of (x, z): darkest at the centre, by what each material takes (`fire.maxScorch`); it lights nothing. */
  function soot(x: number, z: number, radius: number): void {
    if (radius <= 0) return
    const column0 = clampIndex(Math.floor((x - radius - x0) / cellSize), columns)
    const column1 = clampIndex(Math.ceil((x + radius - x0) / cellSize), columns)
    const row0 = clampIndex(Math.floor((z - radius - z0) / cellSize), rows)
    const row1 = clampIndex(Math.ceil((z + radius - z0) / cellSize), rows)
    for (let row = row0; row <= row1; row++) {
      for (let column = column0; column <= column1; column++) {
        const distance = Math.hypot(x0 + column * cellSize - x, z0 + row * cellSize - z)
        const response = distance < radius ? vertexMaterial(column, row).fire : undefined
        if (!response) continue
        const index = row * stride + column
        const before = scorch[index]!
        scorch[index] = Math.max(before, response.maxScorch * BLAST_SOOT * Math.sqrt(1 - distance / radius))
        if (scorch[index] !== before) touchVertex(column, row)
      }
    }
  }

  /** True when the flame took ground away, so that what stood there must look again. */
  function burnVertex(column: number, row: number, seconds: number): boolean {
    const index = row * stride + column
    const material = vertexMaterial(column, row)
    const response = material.fire
    if (!response) return false
    const before = scorch[index]!
    scorch[index] = Math.max(before, Math.min(response.maxScorch, before + response.scorchPerSecond * seconds))
    if (response.burnsAway) removeFromVertex(index, response.burnsAway * seconds)
    if (scorch[index] !== before || response.burnsAway) touchVertex(column, row)
    if (response.flammable) ignite(x0 + column * cellSize, z0 + row * cellSize)
    return (response.burnsAway ?? 0) > 0
  }

  const fireKey = (x: number, z: number): number => Math.floor((z - z0) / FIRE_CELL) * 65536 + Math.floor((x - x0) / FIRE_CELL)
  function ignite(x: number, z: number): void {
    const key = fireKey(x, z)
    if (burning.has(key) || burning.size >= budget.maxBurningCells) return
    const index = vertexOf(x, z).index
    if (scorch[index]! >= 1) return
    burning.set(key, FIRE_SECONDS)
  }

  function updateFire(dt: number): void {
    for (const [key, remaining] of [...burning]) {
      const cellRow = Math.floor(key / 65536)
      const cellColumn = key - cellRow * 65536
      const x = x0 + (cellColumn + 0.5) * FIRE_CELL
      const z = z0 + (cellRow + 0.5) * FIRE_CELL
      burn({ x, z, radius: FIRE_CELL * 0.75, temperature: 600, seconds: dt })
      if (random() < FIRE_SPREAD_PER_SECOND * dt) {
        const angle = Math.floor(random() * 4) * (Math.PI / 2)
        const nextX = x + Math.cos(angle) * FIRE_CELL
        const nextZ = z + Math.sin(angle) * FIRE_CELL
        if (contains(nextX, nextZ)) {
          const { column, row, index } = vertexOf(nextX, nextZ)
          if (vertexMaterial(column, row).fire?.flammable && scorch[index]! < 1) ignite(nextX, nextZ)
        }
      }
      if (remaining - dt <= 0) burning.delete(key)
      else burning.set(key, remaining - dt)
    }
  }

  function updateSlides(): void {
    if (sliding.size === 0) return
    let budgetLeft = budget.maxSlideCellsPerFrame
    let minX = Infinity
    let minZ = Infinity
    let maxX = -Infinity
    let maxZ = -Infinity
    for (const index of sliding) {
      if (budgetLeft-- <= 0) break
      sliding.delete(index)
      const column = index % stride
      const row = (index - column) / stride
      if (!isSoftExposed(index)) continue
      const material = vertexMaterial(column, row)
      const slope = Math.tan(((material.reposeDegrees ?? 90) * Math.PI) / 180) * cellSize
      const height = vertexHeight(column, row)
      const neighbours: [number, number][] = [[column - 1, row], [column + 1, row], [column, row - 1], [column, row + 1]]
      for (const [nextColumn, nextRow] of neighbours) {
        if (nextColumn < 0 || nextRow < 0 || nextColumn > columns || nextRow > rows) continue
        const excess = height - vertexHeight(nextColumn, nextRow) - slope
        if (excess <= SLIDE_EPSILON) continue
        const before = dug[index]!
        const moved = removeFromVertex(index, excess * SLIDE_SHARE)
        if (moved <= 0) continue
        tallyLowered(slideTally, index, dug[index]! - before)
        const next = nextRow * stride + nextColumn
        const nextBefore = dug[next]!
        addToVertex(next, moved, isSoftExposed(next))
        tallyLowered(slideTally, next, dug[next]! - nextBefore)
        sliding.add(index)
        sliding.add(next)
        touchVertex(column, row)
        touchVertex(nextColumn, nextRow)
        const px = x0 + column * cellSize
        const pz = z0 + row * cellSize
        minX = Math.min(minX, px)
        maxX = Math.max(maxX, px)
        minZ = Math.min(minZ, pz)
        maxZ = Math.max(maxZ, pz)
      }
    }
    if (minX <= maxX) emitDeform((minX + maxX) / 2, (minZ + maxZ) / 2, Math.hypot(maxX - minX, maxZ - minZ) / 2 + cellSize * 2)
    if (sliding.size === 0 && slideTally.size > 0) {
      emitGroundLoss(slideTally, 'slide', SLIDE_LOSS_MIN_LOWERING)
      slideTally.clear()
    }
  }

  /** A piece of soft ground joins the height where it stops, so that what is thrown out piles up and can be walked on. */
  function settle(piece: TerrainDebris): boolean {
    const material = materials.get(piece.material)
    if (!material || material.reposeDegrees === undefined || material.scatters) return false
    if (material.splats && contains(piece.position[0], piece.position[2]) && !waterAt(piece.position[0], piece.position[2])) addDecal({ kind: 'splat', x: piece.position[0], z: piece.position[2], radius: piece.radius * 2.6, angle: piece.id * 2.399, material: material.id })
    if (!contains(piece.position[0], piece.position[2])) return true
    const { index, column, row } = vertexOf(piece.position[0], piece.position[2])
    addToVertex(index, ((4 / 3) * Math.PI * piece.radius ** 3) / (cellSize * cellSize), false)
    sliding.add(index)
    touchVertex(column, row)
    return true
  }

  function applyHit(hit: Hit): TerrainBlowResult | null {
    const [x, y, z] = hit.point
    switch (hit.type) {
      case 'ballistic':
      case 'blunt':
      case 'slash': {
        if (!hit.energy) return null
        const contactRadius = hit.type === 'blunt' ? hit.radius : undefined
        const caliber = hit.type === 'ballistic' ? hit.caliber : undefined
        return strike(hit.type, { x, z, energy: hit.energy, ...(hit.direction ? { direction: hit.direction } : {}), ...(contactRadius !== undefined ? { contactRadius } : {}), ...(caliber !== undefined ? { caliber } : {}) })
      }
      case 'explosive': {
        if (!hit.energy) return null
        const above = Math.max(0, y - heightAt(x, z))
        const reach = (hit.radius ?? 1) * BLAST_HEIGHT_REACH
        if (above >= reach) return null
        const share = (1 - above / reach) ** 2
        soot(x, z, BLAST_SOOT_REACH * Math.cbrt((hit.energy * share) / 1e6))
        return strike('explosive', { x, z, energy: hit.energy * share })
      }
      case 'fire':
      case 'heat':
        if (y - heightAt(x, z) > (hit.radius ?? 0.2) + FLAME_REACH) return null
        burn({ x, z, radius: hit.radius ?? 0.2, temperature: hit.temperature ?? 0, seconds: hit.duration ?? 0.016 })
        return null
      default:
        return null
    }
  }

  function raycast(origin: readonly number[], direction: readonly number[], maxDistance: number): { point: [number, number, number]; distance: number; normal: [number, number, number] } | null {
    const [ox = 0, oy = 0, oz = 0] = origin
    const [dx = 0, dy = 0, dz = 0] = direction
    const step = cellSize * 0.75
    let previous = 0
    for (let t = 0; t <= maxDistance; t += step) {
      const x = ox + dx * t
      const z = oz + dz * t
      if (contains(x, z) && oy + dy * t <= heightAt(x, z)) {
        let low = previous
        let high = t
        for (let i = 0; i < 6; i++) {
          const middle = (low + high) / 2
          if (oy + dy * middle <= heightAt(ox + dx * middle, oz + dz * middle)) high = middle
          else low = middle
        }
        const px = ox + dx * high
        const pz = oz + dz * high
        const gx = heightAt(px + cellSize, pz) - heightAt(px - cellSize, pz)
        const gz = heightAt(px, pz + cellSize) - heightAt(px, pz - cellSize)
        const length = Math.hypot(gx, 2 * cellSize, gz)
        return { point: [px, oy + dy * high, pz], distance: high, normal: [-gx / length, (2 * cellSize) / length, -gz / length] }
      }
      previous = t
    }
    return null
  }

  function chunk(index: number): TerrainChunk {
    const chunkZ = Math.floor(index / chunksX)
    const chunkX = index - chunkZ * chunksX
    return { index, column: chunkX * chunkCells, row: chunkZ * chunkCells, cells: chunkCells, pristine: !touched[index] && !mixed[index] && !options.baseHeight }
  }

  function reset(): void {
    dug.fill(0)
    loose.fill(0)
    scorch.fill(0)
    barBend.fill(0)
    touched.fill(0)
    marks.clear()
    cracks.clear()
    decalList.length = 0
    decalsVersion++
    unitDamage.clear()
    debrisStore.clear()
    sliding.clear()
    slideTally.clear()
    burning.clear()
    // the craters and clods draw from here: a reset ground digs the same as a new one
    random = createRandom(seed)
    applyLayout(currentLayout)
  }

  applyLayout(currentLayout)

  return {
    bounds: options.bounds,
    cellSize,
    columns,
    rows,
    stride,
    chunkCells,
    chunksX,
    chunksZ,
    budget,
    dug,
    loose,
    scorch,
    barBend,
    profileIndex,
    profileList,
    material: (id) => {
      const material = materials.get(id)
      if (!material) throw new Error(`game-terrain: unknown material "${id}"`)
      return material
    },
    layout: () => currentLayout,
    setLayout(layout) {
      currentLayout = layout
      reset()
    },
    heightAt,
    footAt,
    walkFactorAt,
    waterAt,
    press,
    ripple,
    decals: () => decalList,
    get decalsVersion() {
      return decalsVersion
    },
    vertexHeight,
    vertexMaterial,
    columnAt,
    contains,
    raycast,
    strike,
    burn,
    applyHit,
    bear: bearAll,
    voidUnder: (x, z, radius) => voidUnder(grid, { x, z, radius }),
    onDeform(listener) {
      deformListeners.add(listener)
      return () => deformListeners.delete(listener)
    },
    update(dt) {
      debrisStore.update(dt, { heightAt, gravity, settle })
      updateSlides()
      updateFire(dt)
      for (let i = decalList.length - 1; i >= 0; i--) {
        const decal = decalList[i]!
        decal.age += dt
        if (decal.kind === 'ripple' && decal.age > RIPPLE_SECONDS) {
          decalList.splice(i, 1)
          decalsVersion++
        }
      }
    },
    get dirtyChunkCount() {
      return dirty.size
    },
    drainDirtyChunks(max = budget.maxDirtyChunksPerFrame) {
      const taken: TerrainChunk[] = []
      for (const index of dirty) {
        if (taken.length >= max) break
        dirty.delete(index)
        taken.push(chunk(index))
      }
      return taken
    },
    chunk,
    marks: () => marks.list,
    cracks: () => cracks.list,
    get cracksVersion() {
      return cracks.version
    },
    debris: () => debrisStore.list,
    burningPoints: () => [...burning.keys()].map((key) => {
      const cellRow = Math.floor(key / 65536)
      const cellColumn = key - cellRow * 65536
      return [x0 + (cellColumn + 0.5) * FIRE_CELL, z0 + (cellRow + 0.5) * FIRE_CELL] as const
    }),
    get marksVersion() {
      return marks.version
    },
    stats: () => ({ marks: marks.list.length, debris: debrisStore.list.length, debrisMoving: debrisStore.list.filter((piece) => !piece.atRest).length, dirtyChunks: dirty.size, burning: burning.size }),
    reset,
    serialize(): TerrainSnapshot {
      return { layout: currentLayout, dug: sparse(dug), loose: sparse(loose), scorch: sparse(scorch), barBend: sparse(barBend), marks: marks.list.map((mark) => ({ ...mark })), cracks: cracks.list.map((crack) => ({ ...crack })), decals: decalList.filter((decal) => decal.kind !== 'ripple').map((decal) => ({ ...decal })) }
    },
    load(snapshot) {
      currentLayout = snapshot.layout
      reset()
      fillSparse(dug, snapshot.dug)
      fillSparse(loose, snapshot.loose)
      fillSparse(scorch, snapshot.scorch)
      fillSparse(barBend, snapshot.barBend ?? [])
      marks.load(snapshot.marks)
      cracks.load(snapshot.cracks ?? [])
      decalList.push(...(snapshot.decals ?? []).map((decal) => ({ ...decal })))
      decalSerial = decalList.reduce((highest, decal) => Math.max(highest, decal.id), decalSerial)
      for (let chunkIndex = 0; chunkIndex < touched.length; chunkIndex++) markChunk(chunkIndex)
    },
  }
}
