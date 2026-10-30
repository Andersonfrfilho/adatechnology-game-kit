import type { Hit } from '@adatechnology/game-contracts'
import { DEFAULT_PROFILE, TERRAIN_MATERIALS, TERRAIN_PROFILES } from './catalog'
import { createDebrisStore } from './debris'
import { createMarkStore } from './marks'
import { createRandom } from './random'
import type { GroundLayout, Terrain, TerrainBlow, TerrainBlowResult, TerrainBudget, TerrainChunk, TerrainColumn, TerrainDebris, TerrainMark, TerrainMaterial, TerrainOptions, TerrainProfile, TerrainSnapshot, TerrainStratum } from './types'

export const DEFAULT_TERRAIN_BUDGET: TerrainBudget = {
  markAreaSize: 2,
  maxMarksPerArea: 24,
  maxMarks: 800,
  maxDirtyChunksPerFrame: 6,
  maxDebris: 400,
  maxDebrisPerBlow: 36,
  maxSlideCellsPerFrame: 2500,
  maxBurningCells: 300,
}

const GRAVITY = 9.81
/** A bowl narrower than this many cells cannot be drawn by the height field: it stays a fine mark. */
const FINE_CELLS = 1.5
/** A hole deeper than this many cells is no longer a mark on the surface. */
const FINE_DEPTH_CELLS = 0.4
const RIGID_WIDENING = 2.5
const RIM_REACH = 1.45
/** Under this temperature (°C) a flame does nothing to the ground. */
const FLAME_MINIMUM = 200
/** How far over the ground a flame still touches it, beyond its radius. */
const FLAME_REACH = 0.6
/** How far a blast above the ground still reaches it, as a share of its radius. */
const BLAST_HEIGHT_REACH = 0.35
/** Share of a blow's energy that throws the pieces. */
const THROW_SHARE = 0.02
/** Side of a square of ground that burns as one, in metres. */
const FIRE_CELL = 0.5
const FIRE_SECONDS = 7
const FIRE_SPREAD_PER_SECOND = 0.35
const SLIDE_SHARE = 0.4
const SLIDE_EPSILON = 0.002
/** Radius of a thrown piece per kind: a clod is a fist of soil, a chip is a thumb of concrete. */
const PIECE_RADIUS: Record<TerrainMaterial['debris'], number> = { clods: 0.045, chips: 0.022, shards: 0.028, splinters: 0.02, dust: 0.012 }
/** Metres per second the fastest piece of a blow leaves at: a blast throws, a dropped weight only kicks. */
const MAX_PIECE_SPEED: Record<TerrainBlow, number> = { explosive: 14, ballistic: 5, blunt: 2.5, slash: 1.5 }

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

  const base = new Float32Array(vertexCount)
  if (options.baseHeight) {
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) base[row * stride + column] = options.baseHeight(x0 + column * cellSize, z0 + row * cellSize)
  }
  const dug = new Float32Array(vertexCount)
  const loose = new Float32Array(vertexCount)
  const scorch = new Float32Array(vertexCount)
  const profileIndex = new Uint8Array(vertexCount)
  const touched = new Uint8Array(chunksX * chunksZ)
  const mixed = new Uint8Array(chunksX * chunksZ)
  const dirty = new Set<number>()
  const marks = createMarkStore(budget)
  const debrisStore = createDebrisStore(() => budget.maxDebris)
  const sliding = new Set<number>()
  const burning = new Map<number, number>()
  const random = createRandom(options.seed ?? 1)
  let currentLayout: GroundLayout = options.layout ?? { surface: DEFAULT_PROFILE }

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
    for (let chunkZ = 0; chunkZ < chunksZ; chunkZ++) {
      for (let chunkX = 0; chunkX < chunksX; chunkX++) {
        const chunk = chunkZ * chunksX + chunkX
        const first = profileIndex[(chunkZ * chunkCells) * stride + chunkX * chunkCells]
        let isMixed = 0
        const lastRow = Math.min(rows, (chunkZ + 1) * chunkCells)
        const lastColumn = Math.min(columns, (chunkX + 1) * chunkCells)
        for (let row = chunkZ * chunkCells; row <= lastRow && !isMixed; row++) {
          for (let column = chunkX * chunkCells; column <= lastColumn; column++) {
            if (profileIndex[row * stride + column] !== first) {
              isMixed = 1
              break
            }
          }
        }
        mixed[chunk] = isMixed
        dirty.add(chunk)
      }
    }
  }

  const vertexHeight = (column: number, row: number): number => {
    const index = row * stride + column
    return base[index]! - dug[index]! + loose[index]!
  }
  const contains = (x: number, z: number): boolean => x >= x0 && x <= x1 && z >= z0 && z <= z1

  function heightAt(x: number, z: number): number {
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

  function vertexMaterial(column: number, row: number): TerrainMaterial {
    const index = row * stride + column
    return materials.get(stratumAtDepth(profileList[profileIndex[index]!]!, dug[index]!).stratum.material)!
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
  function stampBowl(x: number, z: number, radius: number, depth: number, rimVolume: number): void {
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
    for (let row = row0; row <= row1; row++) {
      for (let column = column0; column <= column1; column++) {
        const q = shapeOf(x0 + column * cellSize, z0 + row * cellSize)
        const index = row * stride + column
        if (q < 1) {
          removeFromVertex(index, depth * (1 - q * q) * (0.92 + random() * 0.16))
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

  function strike(blow: TerrainBlow, spec: { x: number; z: number; energy: number; direction?: readonly number[]; contactRadius?: number }): TerrainBlowResult {
    const { x, z } = spec
    const start = columnAt(x, z)
    const profile = profileMap.get(start.profile)!
    const removed: { material: string; volume: number }[] = []
    const point: [number, number, number] = [x, heightAt(x, z), z]
    let energy = spec.energy
    let depth = start.depth
    let radius = 0
    let carved = 0
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
        const pastCover = bars !== undefined && depth - layer.top >= bars.cover - 1e-6
        const specificEnergy = response.specificEnergy * (pastCover ? bars.resistance : 1)
        const limit = bars && !pastCover ? Math.min(room, layer.top + bars.cover - depth) : room
        const volume = energy / specificEnergy
        const wanted = Math.cbrt((2 * volume) / (Math.PI * response.aspect))
        const wantedDepth = wanted * response.aspect
        const takenDepth = Math.min(wantedDepth, limit)
        const takenRadius = takenDepth < wantedDepth ? takenDepth / response.aspect : wanted
        const takenVolume = (Math.PI * takenRadius * takenRadius * takenDepth) / 2
        energy -= takenVolume * specificEnergy
        depth += takenDepth
        carved += takenDepth
        radius = Math.max(radius, takenRadius, response.minRadius ?? 0, spec.contactRadius ?? 0)
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
    if (radius <= 0) return { point, radius: 0, depth: 0, totalDepth: start.depth, removed: [], exposed: start.material, atLimit: start.remaining <= 1e-6, rebarExposed: rebarShowing(profile, start.depth), fine: true }

    // a rigid floor cannot go down any more where it is already deep: the next blow breaks the edge of the hole, so a hole in a slab opens as it deepens
    if (firstMaterial.reposeDegrees === undefined && start.loose <= 0) radius *= 1 + RIGID_WIDENING * (start.depth / maxDepthOfProfile(profile))

    const volumeTotal = removed.reduce((sum, entry) => sum + entry.volume, 0)
    const fine = radius < cellSize * FINE_CELLS
    if (fine) depositMark({ x, z, radius, depth: carved, blow, profile, cap: maxDepthOfProfile(profile) })
    else {
      const rimShare = materials.get(removed[0]!.material)!.rimShare ?? 0
      stampBowl(x, z, radius, carved, volumeTotal * rimShare)
    }
    let quota = budget.maxDebrisPerBlow
    for (const entry of removed) {
      const material = materials.get(entry.material)!
      const thrown = entry.volume * (1 - (fine ? 0 : (material.rimShare ?? 0)))
      if (thrown <= 0 || quota <= 0) continue
      const share = Math.max(1, Math.round((quota * entry.volume) / volumeTotal))
      throwPieces({ x, y: point[1], z, volume: thrown, material, energy: spec.energy * (entry.volume / volumeTotal), direction: spec.direction, quota: share, bowlRadius: radius, blow })
      quota -= share
    }
    const after = columnAt(x, z)
    return { point, radius, depth: carved, totalDepth: after.depth, removed, exposed: after.material, atLimit: after.remaining <= 1e-4, rebarExposed: rebarShowing(profile, after.depth), fine }
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
    for (let row = row0; row <= row1; row++) {
      for (let column = column0; column <= column1; column++) {
        if (Math.hypot(x0 + column * cellSize - spec.x, z0 + row * cellSize - spec.z) > spec.radius) continue
        burnVertex(column, row, spec.seconds)
      }
    }
  }

  function burnVertex(column: number, row: number, seconds: number): void {
    const index = row * stride + column
    const material = vertexMaterial(column, row)
    const response = material.fire
    if (!response) return
    const before = scorch[index]!
    scorch[index] = Math.max(before, Math.min(response.maxScorch, before + response.scorchPerSecond * seconds))
    if (response.burnsAway) removeFromVertex(index, response.burnsAway * seconds)
    if (scorch[index] !== before || response.burnsAway) touchVertex(column, row)
    if (response.flammable) ignite(x0 + column * cellSize, z0 + row * cellSize)
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
        const moved = removeFromVertex(index, excess * SLIDE_SHARE)
        if (moved <= 0) continue
        const next = nextRow * stride + nextColumn
        addToVertex(next, moved, isSoftExposed(next))
        sliding.add(index)
        sliding.add(next)
        touchVertex(column, row)
        touchVertex(nextColumn, nextRow)
      }
    }
  }

  /** A piece of soft ground joins the height where it stops, so that what is thrown out piles up and can be walked on. */
  function settle(piece: TerrainDebris): boolean {
    const material = materials.get(piece.material)
    if (!material || material.reposeDegrees === undefined) return false
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
        return strike(hit.type, { x, z, energy: hit.energy, ...(hit.direction ? { direction: hit.direction } : {}), ...(contactRadius !== undefined ? { contactRadius } : {}) })
      }
      case 'explosive': {
        if (!hit.energy) return null
        const above = Math.max(0, y - heightAt(x, z))
        const reach = (hit.radius ?? 1) * BLAST_HEIGHT_REACH
        if (above >= reach) return null
        return strike('explosive', { x, z, energy: hit.energy * (1 - above / reach) ** 2 })
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
    touched.fill(0)
    marks.clear()
    debrisStore.clear()
    sliding.clear()
    burning.clear()
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
    vertexHeight,
    vertexMaterial,
    columnAt,
    contains,
    raycast,
    strike,
    burn,
    applyHit,
    update(dt) {
      debrisStore.update(dt, { heightAt, gravity, settle })
      updateSlides()
      updateFire(dt)
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
      return { layout: currentLayout, dug: sparse(dug), loose: sparse(loose), scorch: sparse(scorch), marks: marks.list.map((mark) => ({ ...mark })) }
    },
    load(snapshot) {
      currentLayout = snapshot.layout
      reset()
      fillSparse(dug, snapshot.dug)
      fillSparse(loose, snapshot.loose)
      fillSparse(scorch, snapshot.scorch)
      marks.load(snapshot.marks)
      for (let chunkIndex = 0; chunkIndex < touched.length; chunkIndex++) markChunk(chunkIndex)
    },
  }
}
