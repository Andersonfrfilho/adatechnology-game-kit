import type * as THREE_NS from 'three'
import { markKitOrigin } from '@adatechnology/game-contracts'
import type { Terrain, TerrainChunk } from '@adatechnology/game-terrain'
import { buildChunkGeometry, buildPristineGeometry, chunkVertexCount } from './chunk-geometry'
import { createDebrisLayer, createMarkLayer } from './layers'
import { buildRebarGeometry } from './rebar'
import { createSurfaceMaterial } from './surface-material'

type ThreeLib = typeof THREE_NS

export interface TerrainRendererOptions {
  readonly terrain: Terrain
  /** Beyond this distance in metres a dug chunk draws half its vertices (default 30), twice this a quarter. */
  readonly lodDistance?: number
  /** Marks farther than this in metres are not drawn (default 45). */
  readonly markDistance?: number
  /** Metres the untouched ground goes on beyond the terrain, so that it has no edge in sight (default 300). */
  readonly skirt?: number
}

export interface TerrainRenderer {
  readonly group: THREE_NS.Group
  /** Call every frame with the camera's position. Redraws at most the terrain's budget of chunks. */
  sync(camera: { readonly x: number; readonly y: number; readonly z: number }): void
  /** What is on the screen, for a bench. */
  stats(): { readonly chunkMeshes: number; readonly pristineChunks: number; readonly marksDrawn: number; readonly debrisDrawn: number }
  dispose(): void
}

const DEFAULT_LOD_DISTANCE = 30
const DEFAULT_MARK_DISTANCE = 45
const DEFAULT_SKIRT = 300
const LOD_CHECK_METRES = 4
const REBAR_COLOUR = 0x4a3528
/** Geometries of chunks that went back to pristine or changed detail, kept to be refilled for the next dug chunk. */
const MAX_SPARE_GEOMETRIES = 24

interface DrawnChunk {
  mesh: THREE_NS.Mesh
  rebar: THREE_NS.Mesh | null
  step: number
}

/** The ground of a `Terrain`: chunks nobody touched share one flat geometry, a dug one gets a mesh of its own that gets simpler far away. */
export function createTerrainRenderer(THREE: ThreeLib, options: TerrainRendererOptions): TerrainRenderer {
  const { terrain } = options
  const lodDistance = options.lodDistance ?? DEFAULT_LOD_DISTANCE
  const skirt = options.skirt ?? DEFAULT_SKIRT
  const group = markKitOrigin(new THREE.Group(), { owner: 'game-terrain-three', kind: 'ground' })
  group.name = 'floor'
  const surface = createSurfaceMaterial(THREE)
  const rebarMaterial = new THREE.MeshStandardMaterial({ color: REBAR_COLOUR, roughness: 0.75, metalness: 0.35 })
  const pristineMesh = new THREE.Mesh(new THREE.BufferGeometry(), surface)
  pristineMesh.receiveShadow = true
  pristineMesh.name = 'terrain-pristine'
  pristineMesh.frustumCulled = false
  group.add(pristineMesh)
  const drawn = new Map<number, DrawnChunk>()
  const marks = createMarkLayer(THREE, terrain, options.markDistance ?? DEFAULT_MARK_DISTANCE)
  const debris = createDebrisLayer(THREE, terrain)
  group.add(marks.mesh, debris.mesh)
  let pristineStale = true
  let pristineBuilt = false
  let pristineCount = 0
  let lodX = Infinity
  let lodZ = Infinity
  let firstSync = true

  const distanceTo = (chunk: TerrainChunk, camera: { x: number; z: number }): number => {
    const half = (chunk.cells * terrain.cellSize) / 2
    const centreX = terrain.bounds[0] + chunk.column * terrain.cellSize + half
    const centreZ = terrain.bounds[1] + chunk.row * terrain.cellSize + half
    return Math.hypot(centreX - camera.x, centreZ - camera.z)
  }
  const stepFor = (distance: number): number => (distance > lodDistance * 2 ? 4 : distance > lodDistance ? 2 : 1)

  const spareGeometries: THREE_NS.BufferGeometry[] = []

  function keepSpare(geometry: THREE_NS.BufferGeometry): void {
    if (spareGeometries.length < MAX_SPARE_GEOMETRIES) spareGeometries.push(geometry)
    else geometry.dispose()
  }

  function takeSpare(chunk: TerrainChunk, step: number): THREE_NS.BufferGeometry | undefined {
    const count = chunkVertexCount(terrain, chunk, step)
    const found = spareGeometries.findIndex((geometry) => geometry.getAttribute('position').count === count)
    return found < 0 ? undefined : spareGeometries.splice(found, 1)[0]
  }

  function drop(index: number): void {
    const entry = drawn.get(index)
    if (!entry) return
    group.remove(entry.mesh)
    keepSpare(entry.mesh.geometry)
    if (entry.rebar) {
      group.remove(entry.rebar)
      entry.rebar.geometry.dispose()
    }
    drawn.delete(index)
  }

  function drawRebar(chunk: TerrainChunk, entry: DrawnChunk): void {
    const bars = buildRebarGeometry(THREE, terrain, chunk, entry.rebar?.geometry)
    if (!bars) {
      if (entry.rebar) entry.rebar.visible = false
      return
    }
    if (entry.rebar && entry.rebar.geometry === bars) {
      entry.rebar.visible = true
      return
    }
    if (entry.rebar) {
      group.remove(entry.rebar)
      entry.rebar.geometry.dispose()
    }
    entry.rebar = new THREE.Mesh(bars, rebarMaterial)
    entry.rebar.castShadow = true
    group.add(entry.rebar)
  }

  function draw(chunk: TerrainChunk, camera: { x: number; z: number }): void {
    const step = stepFor(distanceTo(chunk, camera))
    let entry = drawn.get(chunk.index)
    if (!entry) {
      const mesh = new THREE.Mesh(buildChunkGeometry(THREE, terrain, chunk, step, takeSpare(chunk, step)), surface)
      mesh.receiveShadow = true
      group.add(mesh)
      entry = { mesh, rebar: null, step }
      drawn.set(chunk.index, entry)
    } else {
      const previous = entry.mesh.geometry
      const sameDetail = previous.getAttribute('position').count === chunkVertexCount(terrain, chunk, step)
      entry.mesh.geometry = buildChunkGeometry(THREE, terrain, chunk, step, sameDetail ? previous : takeSpare(chunk, step))
      if (entry.mesh.geometry !== previous) keepSpare(previous)
      entry.step = step
    }
    drawRebar(chunk, entry)
  }

  function rebuildPristine(): void {
    const chunks: TerrainChunk[] = []
    for (let index = 0; index < terrain.chunksX * terrain.chunksZ; index++) {
      const chunk = terrain.chunk(index)
      if (chunk.pristine) chunks.push(chunk)
    }
    if (!pristineBuilt) pristineMesh.geometry.dispose()
    pristineMesh.geometry = buildPristineGeometry(THREE, terrain, chunks, skirt, pristineBuilt ? pristineMesh.geometry : undefined)
    pristineBuilt = true
    pristineCount = chunks.length
    pristineStale = false
  }

  return {
    group,
    sync(camera) {
      // the first picture and a floor just laid have every chunk dirty: pristine ones need no work of their own, the rest are drawn at once so that the floor never has holes
      const limit = firstSync ? Infinity : undefined
      firstSync = false
      for (const chunk of terrain.drainDirtyChunks(limit)) {
        if (chunk.pristine) {
          if (drawn.has(chunk.index)) drop(chunk.index)
          pristineStale = true
        } else {
          if (!drawn.has(chunk.index)) pristineStale = true
          draw(chunk, camera)
        }
      }
      if (pristineStale) rebuildPristine()
      if (Math.hypot(camera.x - lodX, camera.z - lodZ) > LOD_CHECK_METRES) {
        lodX = camera.x
        lodZ = camera.z
        for (const [index, entry] of drawn) {
          const chunk = terrain.chunk(index)
          if (stepFor(distanceTo(chunk, camera)) !== entry.step) draw(chunk, camera)
        }
      }
      marks.sync(camera)
      debris.sync()
    },
    stats: () => ({ chunkMeshes: drawn.size, pristineChunks: pristineCount, marksDrawn: marks.mesh.count, debrisDrawn: debris.mesh.count }),
    dispose() {
      for (const index of [...drawn.keys()]) drop(index)
      for (const geometry of spareGeometries) geometry.dispose()
      pristineMesh.geometry.dispose()
      surface.dispose()
      rebarMaterial.dispose()
      marks.dispose()
      debris.dispose()
      group.removeFromParent()
    },
  }
}
