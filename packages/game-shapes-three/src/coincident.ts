import type * as THREE_NS from 'three'
import { coincidentFaces } from '@adatechnology/game-shapes'
import type { CoincidentBatch, CoincidentFaceHit, CoincidentFacesOptions } from '@adatechnology/game-shapes'

export { GAME_DEPTH_PRECISION, depthResolution, describeCoincidentFaces } from '@adatechnology/game-shapes'
export type { CoincidentFaceHit, DepthPrecision } from '@adatechnology/game-shapes'

import { isMesh } from './guards'

export interface CoincidentFacesOfOptions extends CoincidentFacesOptions {
  /** Also check meshes that are hidden now (a piece that only shows when the wall breaks). Default false: only what is drawn. */
  readonly includeHidden?: boolean
}

type Material = THREE_NS.Material & { polygonOffset?: boolean; name?: string }

/** A LOD draws one level at a time: only the nearest one is checked, the others never share a frame with it. */
function isFartherLevel(o: THREE_NS.Object3D): boolean {
  const lod = o.parent as (THREE_NS.LOD & { isLOD?: boolean }) | null
  return !!lod?.isLOD && lod.levels.length > 0 && lod.levels[0]!.object !== o
}

function isDrawn(node: THREE_NS.Object3D, root: THREE_NS.Object3D): boolean {
  for (let o: THREE_NS.Object3D | null = node; o; o = o.parent) {
    if (!o.visible || isFartherLevel(o)) return false
    if (o === root) return true
  }
  return true
}

/** A decal pushed forward with polygonOffset lies on its surface by design: the GPU orders it, it does not flicker. */
function isOffsetDecal(mesh: THREE_NS.Mesh): boolean {
  const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[]
  return materials.length > 0 && materials.every((m) => m?.polygonOffset === true)
}

function labelOf(mesh: THREE_NS.Mesh, root: THREE_NS.Object3D): string {
  const names: string[] = []
  for (let o: THREE_NS.Object3D | null = mesh; o && o !== root; o = o.parent) {
    const part = (o.userData as { destructionPart?: unknown } | undefined)?.destructionPart
    const name = o.name || (typeof part === 'string' ? part : '')
    if (name) names.unshift(name)
  }
  const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as Material | undefined
  const path = names.join('/') || mesh.type
  return material?.name ? `${path} [${material.name}]` : path
}

/** World-space positions of one mesh (or of one instance of an InstancedMesh). */
function worldPositions(position: THREE_NS.BufferAttribute | THREE_NS.InterleavedBufferAttribute, matrix: THREE_NS.Matrix4): Float64Array {
  const e = matrix.elements
  const out = new Float64Array(position.count * 3)
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i)
    const w = e[3]! * x + e[7]! * y + e[11]! * z + e[15]! || 1
    out[i * 3] = (e[0]! * x + e[4]! * y + e[8]! * z + e[12]!) / w
    out[i * 3 + 1] = (e[1]! * x + e[5]! * y + e[9]! * z + e[13]!) / w
    out[i * 3 + 2] = (e[2]! * x + e[6]! * y + e[10]! * z + e[14]!) / w
  }
  return out
}

/** three's DoubleSide. */
const DOUBLE_SIDE = 2

function isDoubleSided(mesh: THREE_NS.Mesh): boolean {
  const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE_NS.Material[]
  return materials.some((m) => m?.side === DOUBLE_SIDE)
}

type Shaded = THREE_NS.Material & { readonly vertexColors?: boolean; readonly map?: unknown; readonly normalMap?: unknown; readonly bumpMap?: unknown; readonly alphaMap?: unknown; readonly roughnessMap?: unknown }

const attributeValues = (attribute: THREE_NS.BufferAttribute | THREE_NS.InterleavedBufferAttribute, size: number): number[] => {
  const out = new Array<number>(attribute.count * size)
  const read = [(i: number): number => attribute.getX(i), (i: number): number => attribute.getY(i), (i: number): number => attribute.getZ(i)]
  for (let i = 0; i < attribute.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = read[k]!(i)
  return out
}

/** How the mesh is shaded, for the near mode's test of faces that draw the same pixels: one material (its identity), its vertex colours and, when textured, its UVs. */
function lookOf(mesh: THREE_NS.Mesh, geometry: THREE_NS.BufferGeometry): Pick<CoincidentBatch, 'look' | 'colors' | 'uvs'> {
  if (Array.isArray(mesh.material)) return {}
  const material = mesh.material as Shaded
  const color = material.vertexColors ? geometry.getAttribute('color') : undefined
  const textured = Boolean(material.map || material.normalMap || material.bumpMap || material.alphaMap || material.roughnessMap)
  const uv = textured ? geometry.getAttribute('uv') : undefined
  if (textured && !uv) return {}
  return { look: material.uuid, ...(color ? { colors: attributeValues(color, 3) } : {}), ...(uv ? { uvs: attributeValues(uv, 2) } : {}) }
}

// only what the GPU draws: a geometry that reuses bigger buffers keeps stale triangles past its draw range
function drawnIndices(geometry: THREE_NS.BufferGeometry): ArrayLike<number> | undefined {
  const { start, count } = geometry.drawRange
  const index = geometry.index?.array
  const total = index ? index.length : geometry.getAttribute('position').count
  const end = Math.min(total, start + (Number.isFinite(count) ? count : total))
  if (index) return start === 0 && end === index.length ? index : Array.from(index).slice(start, end)
  if (start === 0 && end === total) return undefined
  return Array.from({ length: end - start }, (_, i) => start + i)
}

function batchesOfMesh(mesh: THREE_NS.Mesh, label: string): CoincidentBatch[] {
  const doubleSided = isDoubleSided(mesh)
  const geometry = mesh.geometry as THREE_NS.BufferGeometry | undefined
  const position = geometry?.getAttribute('position')
  if (!geometry || !position) return []
  const indices = drawnIndices(geometry)
  const instanced = mesh as THREE_NS.InstancedMesh
  const look = lookOf(mesh, geometry)
  if (!instanced.isInstancedMesh) return [{ positions: worldPositions(position, mesh.matrixWorld), ...(indices ? { indices } : {}), label, doubleSided, ...look }]
  const batches: CoincidentBatch[] = []
  const instance = mesh.matrixWorld.clone()
  // instances of one colour each are told apart by it: an instance colour joins the look
  const tint = instanced.instanceColor
  for (let i = 0; i < instanced.count; i++) {
    instanced.getMatrixAt(i, instance)
    instance.premultiply(mesh.matrixWorld)
    const instanceLook = tint && look.look !== undefined ? { ...look, look: `${look.look}:${tint.getX(i)},${tint.getY(i)},${tint.getZ(i)}` } : look
    batches.push({ positions: worldPositions(position, instance), ...(indices ? { indices } : {}), label: `${label} #${i}`, doubleSided, ...instanceLook })
  }
  return batches
}

export interface MeshBatches {
  readonly batches: CoincidentBatch[]
  /** The mesh each batch came from, at the same index. */
  readonly meshes: THREE_NS.Mesh[]
}

/** The triangles of every drawn mesh under `root`, in world space, with the mesh of each batch. */
export function meshBatchesOf(root: THREE_NS.Object3D, options: Pick<CoincidentFacesOfOptions, 'includeHidden'> = {}): MeshBatches {
  root.updateMatrixWorld(true)
  const batches: CoincidentBatch[] = []
  const meshes: THREE_NS.Mesh[] = []
  root.traverse((node) => {
    if (!isMesh(node) || (node as THREE_NS.Object3D & { isSprite?: boolean }).isSprite) return
    if (!options.includeHidden && !isDrawn(node, root)) return
    if (isOffsetDecal(node)) return
    for (const batch of batchesOfMesh(node, labelOf(node, root))) {
      batches.push(batch)
      meshes.push(node)
    }
  })
  return { batches, meshes }
}

/** The triangles of every drawn mesh under `root`, in world space, ready for `coincidentFaces`. */
export function coincidentBatchesOf(root: THREE_NS.Object3D, options: Pick<CoincidentFacesOfOptions, 'includeHidden'> = {}): CoincidentBatch[] {
  return meshBatchesOf(root, options).batches
}

/**
 * Faces of `root` that z-fight: same plane, same facing, overlapping. Use it in the catalog test of every package that draws pieces, so a
 * piece that comes back with a lining flush to its body fails the test instead of flickering on screen.
 */
export function coincidentFacesOf(root: THREE_NS.Object3D, options: CoincidentFacesOfOptions = {}): CoincidentFaceHit[] {
  const { batches, meshes } = meshBatchesOf(root, options)
  return coincidentFaces(batches, options).filter((hit) => writesDepth(meshes[hit.batchA]!) || writesDepth(meshes[hit.batchB]!))
}

/** Two layers that both leave the depth buffer alone (smoke, glow, sparks) are blended in order: they never fight for a pixel. */
function writesDepth(mesh: THREE_NS.Mesh): boolean {
  const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE_NS.Material[]
  return materials.some((m) => m.depthWrite !== false && m.depthTest !== false)
}
