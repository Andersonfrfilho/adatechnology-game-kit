/**
 * Presses a dent into the drawn sheet of a vehicle where a blow landed: the faces round the spot are split fine enough to bend, then the sheet is pushed in along the
 * panel's normal, deepest in the middle and easing out to the rim (an ellipse: round for a fist or a boot, long along a bat's barrel for a crease). The skin seen from
 * inside (an open door) bulges the same way, since it is the same sheet.
 */
import type { Mesh, Vector3 } from '../three-types'
import type { Three } from '../types'
import { subdivideNear } from './subdivide-near'

export interface DentSpec {
  /** The hit and the panel's normal there, world. */
  readonly point: Vector3
  readonly normal: Vector3
  /** The long axis of the dent on the panel (a crease's), world, unit. */
  readonly axis: Vector3
  /** Length along `axis` and width across it, metres. */
  readonly length: number
  readonly width: number
  /** Metres the sheet goes in at the middle. */
  readonly depth: number
}

/** Faces this far off the plane of the hit are another sheet (the inner panel of a door), metres: they are not pressed. */
const SHEET_REACH = 0.02
/** The faces split until no edge is longer than this share of the dent's narrow side. */
const FINENESS = 0.2
const FINEST_EDGE = 0.005

/** A face that lies on the sheet of the hit and reaches into the dent: its corners' box, grown by the dent, holds the hit, and the face is near the hit's plane. */
function reaches(corners: readonly Vector3[], spec: DentSpec, grow: number): boolean {
  let near = false
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (const c of corners) {
    minX = Math.min(minX, c.x); minY = Math.min(minY, c.y); minZ = Math.min(minZ, c.z)
    maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y); maxZ = Math.max(maxZ, c.z)
    if (Math.abs(c.clone().sub(spec.point).dot(spec.normal)) < SHEET_REACH) near = true
  }
  const p = spec.point
  return near && p.x >= minX - grow && p.x <= maxX + grow && p.y >= minY - grow && p.y <= maxY + grow && p.z >= minZ - grow && p.z <= maxZ + grow
}

/** Pushes the vertices of one mesh inside the dent's ellipse in along the normal; answers whether any moved. */
function press(THREE: Three, mesh: Mesh, spec: DentSpec): boolean {
  const positions = mesh.geometry.attributes.position
  if (!positions) return false
  const side = new THREE.Vector3().crossVectors(spec.normal, spec.axis).normalize()
  const inverse = mesh.matrixWorld.clone().invert()
  const v = new THREE.Vector3()
  let moved = false
  for (let i = 0; i < positions.count; i++) {
    v.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld)
    const d = v.clone().sub(spec.point)
    if (Math.abs(d.dot(spec.normal)) > SHEET_REACH) continue
    const r = Math.hypot(d.dot(spec.axis) / (spec.length / 2), d.dot(side) / (spec.width / 2))
    if (r >= 1) continue
    const t = 1 - r
    v.addScaledVector(spec.normal, -spec.depth * t * t * (3 - 2 * t)).applyMatrix4(inverse)
    positions.setXYZ(i, v.x, v.y, v.z)
    moved = true
  }
  if (!moved) return false
  positions.needsUpdate = true
  mesh.geometry.computeVertexNormals()
  mesh.geometry.computeBoundingSphere()
  mesh.geometry.computeBoundingBox()
  return true
}

/** Presses the dent into each mesh of the sheet; answers the meshes that changed (their normals want smoothing). */
export function pressDent(THREE: Three, meshes: readonly Mesh[], spec: DentSpec): Mesh[] {
  const grow = Math.max(spec.length, spec.width) / 2
  const maxLen = Math.max(FINEST_EDGE, Math.min(spec.length, spec.width) * FINENESS)
  const changed: Mesh[] = []
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false)
    subdivideNear(THREE, { mesh, maxLen, near: (corners) => reaches(corners, spec, grow) })
    if (press(THREE, mesh, spec)) changed.push(mesh)
  }
  return changed
}

/** Rays at the middle and round the rim of the dent, from just outside the panel: what they meet first is the sheet to press (the door's skin, the body's side). */
const SHEET_PROBE = 0.03
const RIM_PROBES = 8

/** The meshes of the sheet under a dent: the first drawn surface each probe meets (no marks, no glass, no copies of the batcher). */
export function sheetMeshesAt(THREE: Three, root: Object3DLike, spec: DentSpec): Mesh[] {
  const ray = new THREE.Raycaster()
  ray.layers.enableAll()
  ray.far = SHEET_PROBE * 2
  const side = new THREE.Vector3().crossVectors(spec.normal, spec.axis).normalize()
  const found = new Set<Mesh>()
  const inward = spec.normal.clone().negate()
  for (let k = 0; k <= RIM_PROBES; k++) {
    const a = (k / RIM_PROBES) * Math.PI * 2
    const at = spec.point.clone()
    if (k > 0) at.addScaledVector(spec.axis, Math.cos(a) * spec.length * 0.45).addScaledVector(side, Math.sin(a) * spec.width * 0.45)
    ray.set(at.addScaledVector(spec.normal, SHEET_PROBE), inward)
    const hit = ray.intersectObject(root as never, true).find((h) => isSheet(h.object))
    if (hit) found.add(hit.object as Mesh)
  }
  return [...found]
}

type Object3DLike = { readonly isObject3D?: boolean }

function isSheet(o: { readonly visible: boolean; readonly userData: Record<string, unknown>; readonly parent: { readonly name: string } | null; readonly isMesh?: boolean; readonly isInstancedMesh?: boolean }): boolean {
  if (!o.isMesh || o.isInstancedMesh || !o.visible) return false
  if (o.userData.decal || o.userData.glass || o.userData.noSurfaceRay) return false
  return o.parent?.name !== 'static-batches'
}

/** The node of a hinged panel (a door, a lid) an object hangs from, if any. */
function plateOf(o: { readonly parent: unknown; readonly userData: Record<string, unknown> } | null): unknown {
  for (let q = o; q; q = q.parent as typeof q) if (q.userData.plateOf) return q
  return null
}

/** What a path meets behind a sheet within `reach`: the first drawn surface (its normal facing back along the path) and the far face of the same panel (a door's card seen from the cabin), where the path leaves it. */
export function surfaceAlong(THREE: Three, root: Object3DLike, path: { readonly origin: Vector3; readonly direction: Vector3; readonly reach: number }): { point: Vector3; normal: Vector3; far: Vector3 } | null {
  const ray = new THREE.Raycaster(path.origin, path.direction, 0, path.reach)
  ray.layers.enableAll()
  const hits = ray.intersectObject(root as never, true).filter((h) => h.face && isSheet(h.object))
  const first = hits[0]
  if (!first || !first.face) return null
  const normal = first.face.normal.clone().transformDirection(first.object.matrixWorld)
  if (normal.dot(path.direction) > 0) normal.negate()
  // the panel's far face (the cabin side of a door's card): it faces away from the path, so a ray along it never meets it; a ray back from beyond the card does
  const panel = plateOf(first.object)
  const back = new THREE.Raycaster(first.point.clone().addScaledVector(path.direction, CARD_DEPTH), path.direction.clone().negate(), 0, CARD_DEPTH)
  back.layers.enableAll()
  const last = back.intersectObject(root as never, true).find((h) => h.face && isSheet(h.object) && (panel ? plateOf(h.object) === panel : true)) ?? first
  return { point: first.point.clone(), normal, far: last.point.clone() }
}

/** What stands behind a sheet (a door's card) is at most this thick, metres. */
const CARD_DEPTH = 0.06
