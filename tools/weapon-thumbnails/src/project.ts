import type * as THREE_NS from 'three'

import { TONE_METAL, TONE_SOLID, TRIANGLE_STRIDE } from './raster'
import type { Tone } from './raster'

/** `side`: seen from the +z side, muzzle to the right (a weapon standing as it is held). `top`: seen from above (a flat prop lying on a counter). */
export type View = 'side' | 'top'

// metalness of the kit: steel .85, metal .75, dark .5; polymer, wood and paint stay under .3
const METAL_THRESHOLD = 0.4
const MIN_OPACITY = 0.5

type MaterialFlags = THREE_NS.Material & { isMeshBasicMaterial?: boolean; metalness?: number }

const toneOf = (material: MaterialFlags): Tone | undefined => {
  if (material.isMeshBasicMaterial) return undefined // fire and flash
  if (material.transparent && material.opacity < MIN_OPACITY) return undefined // glass
  return (material.metalness ?? 0) >= METAL_THRESHOLD ? TONE_METAL : TONE_SOLID
}

const isShown = (object: THREE_NS.Object3D): boolean => {
  for (let node: THREE_NS.Object3D | null = object; node; node = node.parent) if (!node.visible) return false
  return true
}

/** The triangles of every visible mesh under `root`, in model units, as `rasterize` wants them (x, y on the screen of `view`, z the depth). */
export function collectTriangles(THREE: typeof THREE_NS, root: THREE_NS.Object3D, view: View): number[] {
  root.updateMatrixWorld(true)
  const out: number[] = []
  const corner = new THREE.Vector3()
  root.traverse((object) => {
    const mesh = object as THREE_NS.Mesh
    if (!mesh.isMesh || !isShown(mesh)) return
    const position = mesh.geometry.getAttribute('position')
    if (!position) return
    const index = mesh.geometry.getIndex()
    const count = index ? index.count : position.count
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const groups = mesh.geometry.groups
    const vertexOf = (at: number): number => (index ? index.getX(at) : at)
    const world = (vertex: number): [number, number, number] => {
      corner.fromBufferAttribute(position, vertex).applyMatrix4(mesh.matrixWorld)
      return view === 'side' ? [corner.x, -corner.y, corner.z] : [corner.x, corner.z, corner.y]
    }
    for (let at = 0; at + 2 < count; at += 3) {
      const group = groups.find((entry) => at >= entry.start && at < entry.start + entry.count)
      const material = Array.isArray(mesh.material) ? materials[group?.materialIndex ?? 0] : materials[0]
      const tone = material ? toneOf(material as MaterialFlags) : undefined
      if (tone === undefined) continue
      out.push(...world(vertexOf(at)), ...world(vertexOf(at + 1)), ...world(vertexOf(at + 2)), tone)
    }
  })
  return out
}

export interface Box2 {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export function boundsOf(triangles: readonly number[]): Box2 | undefined {
  if (triangles.length === 0) return undefined
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let at = 0; at < triangles.length; at += TRIANGLE_STRIDE) {
    for (let corner = 0; corner < 3; corner++) {
      const x = triangles[at + corner * 3] as number
      const y = triangles[at + corner * 3 + 1] as number
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  return { minX, minY, maxX, maxY }
}

/** Maps model units to cells: uniform scale that fits the box inside the padded raster, centred. Mutates `triangles` in place. */
export function fitTriangles(triangles: number[], box: Box2, width: number, height: number, padding: number): void {
  const boxWidth = Math.max(box.maxX - box.minX, 1e-6)
  const boxHeight = Math.max(box.maxY - box.minY, 1e-6)
  const scale = Math.min((width - 2 * padding) / boxWidth, (height - 2 * padding) / boxHeight)
  const offsetX = (width - boxWidth * scale) / 2 - box.minX * scale
  const offsetY = (height - boxHeight * scale) / 2 - box.minY * scale
  for (let at = 0; at < triangles.length; at += TRIANGLE_STRIDE) {
    for (let corner = 0; corner < 3; corner++) {
      triangles[at + corner * 3] = (triangles[at + corner * 3] as number) * scale + offsetX
      triangles[at + corner * 3 + 1] = (triangles[at + corner * 3 + 1] as number) * scale + offsetY
    }
  }
}
