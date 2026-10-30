import type * as THREE_NS from 'three'
import type { Terrain, TerrainChunk } from '@adatechnology/game-terrain'
import { buildChunkGeometry, buildPristineGeometry } from './chunk-geometry'
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
const LOD_CHECK_METRES = 4
const REBAR_COLOUR = 0x4a3528

interface DrawnChunk {
  mesh: THREE_NS.Mesh
  rebar: THREE_NS.Mesh | null
  step: number
}

/** The ground of a `Terrain`: chunks nobody touched share one flat geometry, a dug one gets a mesh of its own that gets simpler far away. */
export function createTerrainRenderer(THREE: ThreeLib, options: TerrainRendererOptions): TerrainRenderer {
  const { terrain } = options
  const lodDistance = options.lodDistance ?? DEFAULT_LOD_DISTANCE
  const group = new THREE.Group()
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

  function drop(index: number): void {
    const entry = drawn.get(index)
    if (!entry) return
    group.remove(entry.mesh)
    entry.mesh.geometry.dispose()
    if (entry.rebar) {
      group.remove(entry.rebar)
      entry.rebar.geometry.dispose()
    }
    drawn.delete(index)
  }

  function draw(chunk: TerrainChunk, camera: { x: number; z: number }): void {
    drop(chunk.index)
    const step = stepFor(distanceTo(chunk, camera))
    const mesh = new THREE.Mesh(buildChunkGeometry(THREE, terrain, chunk, step), surface)
    mesh.receiveShadow = true
    group.add(mesh)
    const bars = buildRebarGeometry(THREE, terrain, chunk)
    let rebar: THREE_NS.Mesh | null = null
    if (bars) {
      rebar = new THREE.Mesh(bars, rebarMaterial)
      rebar.castShadow = true
      group.add(rebar)
    }
    drawn.set(chunk.index, { mesh, rebar, step })
  }

  function rebuildPristine(): void {
    const chunks: TerrainChunk[] = []
    for (let index = 0; index < terrain.chunksX * terrain.chunksZ; index++) {
      const chunk = terrain.chunk(index)
      if (chunk.pristine) chunks.push(chunk)
    }
    pristineMesh.geometry.dispose()
    pristineMesh.geometry = buildPristineGeometry(THREE, terrain, chunks)
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
      pristineMesh.geometry.dispose()
      surface.dispose()
      rebarMaterial.dispose()
      marks.dispose()
      debris.dispose()
      group.removeFromParent()
    },
  }
}
