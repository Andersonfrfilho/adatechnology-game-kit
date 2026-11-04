/**
 * What a door takes off the body the first time it opens, cut so that nothing of it stays across the opening or hangs under the door: the strip along
 * the side is cut at the door's two edges, the skin keeps only the depth of a door, and the shut line drawn on the body is told apart from the door's trim.
 */
import type * as THREE_NS from 'three'

type Three = typeof THREE_NS
type Mesh = THREE_NS.Mesh<THREE_NS.BufferGeometry, THREE_NS.Material | THREE_NS.Material[]>
type Geometry = THREE_NS.BufferGeometry
/** A cut of the kit's `cutMesh`: a negative distance is what it takes away. */
type CutTest = { readonly sdf: (x: number, y: number, z: number) => number }
/** What the strip cut needs of the vehicle kit. */
export type StripCutKit = {
  readonly THREE: Three
  cutMesh(mesh: Mesh, tests: CutTest[], smoothDeg: number, options: Record<string, never>): unknown
}

/** A strip keeps its smooth shading where it is cut: no hard edge between the long slivers of the cut. */
const STRIP_SMOOTH_DEG = 180
/** The skin's outer surface is looked for in bands this tall: the side of a car leans in towards the roof. */
const SKIN_BAND = 0.05
/** Deep in the cut, a face turned down or along the car this much (the normal's component) is the body behind the door. */
const BODY_FACING = 0.5
/** Per triangle: the centre's height and depth across the car, and the normal's height and length components. */
const FIELDS = 4
/** A shut line is a dark groove this thin, within this of the door's edge, and at least this share of the door's height. */
const SEAM_THIN = 0.03
const SEAM_AT_EDGE = 0.04
const SEAM_TALL = 0.4
/** A triangle of less area than this, square metres, is a sliver of the cut. */
const SLIVER_AREA = 1e-10

export type StripCutParams = {
  /** The strip on the body (a mesh), cut in place: it keeps what is before and after the door. */
  readonly strip: Mesh
  /** From the strip's own coordinates to the vehicle's. */
  readonly toVehicle: THREE_NS.Matrix4
  /** The door's edges along the vehicle's length. */
  readonly x0: number
  readonly x1: number
}

export type SkinSplitResult = {
  /** The triangles within a door's depth of its outer surface, or null when there are none. */
  readonly skin: Geometry | null
  /** The rest: what the cut took from inside the body (the wheel house behind a rear door, the floor), or null. */
  readonly deep: Geometry | null
}

export type DoorSeamParams = {
  /** The mesh's box in the vehicle's coordinates. */
  readonly box: THREE_NS.Box3
  /** The door's zone box and side. */
  readonly zone: { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number }
  readonly side: number
  /** Whether the mesh is drawn in the dark material of the body's grooves. */
  readonly dark: boolean
}

/**
 * Cuts the part of a strip over a door out of it and answers that part as a new mesh in the strip's frame. Each cut is along one plane: a strip drawn
 * with few, long triangles crosses both edges of the door in one triangle, and the corner of two planes put in one cut lands the edge at the wrong place.
 */
export function cutStripOverDoor(kit: StripCutKit, params: StripCutParams): Mesh {
  const { strip, toVehicle, x0, x1 } = params
  const THREE = kit.THREE
  const at = new THREE.Vector3()
  const along = (x: number, y: number, z: number): number => at.set(x, y, z).applyMatrix4(toVehicle).x
  const piece = (tests: CutTest[]): Mesh => {
    const mesh = new THREE.Mesh(strip.geometry.clone(), strip.material)
    kit.cutMesh(mesh, tests, STRIP_SMOOTH_DEG, {})
    return mesh
  }
  // a negative distance is what a cut takes away
  const over = piece([{ sdf: (x, y, z) => along(x, y, z) - x0 }, { sdf: (x, y, z) => x1 - along(x, y, z) }])
  const after = piece([{ sdf: (x, y, z) => along(x, y, z) - x1 }])
  kit.cutMesh(strip, [{ sdf: (x: number, y: number, z: number) => x0 - along(x, y, z) }], STRIP_SMOOTH_DEG, {})
  const joined = joinTriangles(THREE, strip.geometry, after.geometry)
  strip.geometry.dispose()
  after.geometry.dispose()
  strip.geometry = joined
  return over
}

/**
 * The triangles of two geometries with the same attributes in one non-indexed geometry. The cut keeps the slivers of no area it makes at an edge as they
 * are, so they are left out here: a point of one would stay over the door.
 */
export function joinTriangles(THREE: Three, first: Geometry, second: Geometry): Geometry {
  const a = first.index ? first.toNonIndexed() : first
  const b = second.index ? second.toNonIndexed() : second
  const flags = [...solidTriangles(THREE, a), ...solidTriangles(THREE, b)]
  const both = new THREE.BufferGeometry()
  for (const name of Object.keys(a.attributes)) {
    const p = a.getAttribute(name)
    const q = b.getAttribute(name)
    if (!q || q.itemSize !== p.itemSize) continue
    const array = new Float32Array(p.array.length + q.array.length)
    array.set(p.array, 0)
    array.set(q.array, p.array.length)
    both.setAttribute(name, new THREE.Float32BufferAttribute(array, p.itemSize))
  }
  if (a !== first) a.dispose()
  if (b !== second) b.dispose()
  const out = pickTriangles(THREE, both, flags, true) ?? new THREE.BufferGeometry()
  both.dispose()
  return out
}

/** Whether each triangle of a non-indexed geometry has an area. */
function solidTriangles(THREE: Three, geometry: Geometry): boolean[] {
  const pos = geometry.getAttribute('position')
  const triangle = new THREE.Triangle()
  const flags: boolean[] = []
  for (let t = 0; t * 3 + 2 < pos.count; t++) {
    triangle.a.fromBufferAttribute(pos, t * 3)
    triangle.b.fromBufferAttribute(pos, t * 3 + 1)
    triangle.c.fromBufferAttribute(pos, t * 3 + 2)
    flags.push(triangle.getArea() > SLIVER_AREA)
  }
  return flags
}

/**
 * Splits the pieces cut for a door's skin into what is the door (within `depth` of the outer surface at each height) and what the cut reached inside the
 * body. `toVehicle` gives each piece's matrix to the vehicle's coordinates; `side` is the sign of the door's side across the vehicle.
 */
export function splitDoorSkin(THREE: Three, pieces: Mesh[], toVehicle: (mesh: Mesh) => THREE_NS.Matrix4, side: number, depth: number): SkinSplitResult[] {
  const v = new THREE.Vector3()
  const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const triangle = new THREE.Triangle()
  const centres = pieces.map((mesh) => {
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry
    const matrix = toVehicle(mesh)
    const pos = geometry.getAttribute('position')
    const out = new Float32Array((pos.count / 3) * FIELDS)
    for (let t = 0; t * 3 + 2 < pos.count; t++) {
      let y = 0
      let across = 0
      for (let k = 0; k < 3; k++) {
        corners[k]!.fromBufferAttribute(pos, t * 3 + k).applyMatrix4(matrix)
        y += corners[k]!.y / 3
        across += (side * corners[k]!.z) / 3
      }
      out[t * FIELDS] = y
      out[t * FIELDS + 1] = across
      triangle.set(corners[0]!, corners[1]!, corners[2]!).getNormal(v)
      out[t * FIELDS + 2] = v.y
      out[t * FIELDS + 3] = v.x
    }
    return { geometry, out }
  })
  const outer = new Map<number, number>()
  for (const { out } of centres)
    for (let t = 0; t * FIELDS < out.length; t++) {
      const band = Math.floor(out[t * FIELDS]! / SKIN_BAND)
      outer.set(band, Math.max(outer.get(band) ?? -Infinity, out[t * FIELDS + 1]!))
    }
  const surfaceAt = (y: number): number => {
    const band = Math.floor(y / SKIN_BAND)
    return Math.max(outer.get(band - 1) ?? -Infinity, outer.get(band) ?? -Infinity, outer.get(band + 1) ?? -Infinity)
  }
  return centres.map(({ geometry, out }, i) => {
    const near: boolean[] = []
        // deep inside, what faces down (the top of a wheel house) or along the car (its walls) is the body's; the door's own lip along its top, turned up or in, stays on it
    for (let t = 0; t * FIELDS < out.length; t++) {
      const f = t * FIELDS
      const body = out[f + 1]! < surfaceAt(out[f]!) - depth && (out[f + 2]! < -BODY_FACING || Math.abs(out[f + 3]!) > BODY_FACING)
      near.push(!body)
    }
    const result = { skin: pickTriangles(THREE, geometry, near, true), deep: pickTriangles(THREE, geometry, near, false) }
    if (geometry !== pieces[i]!.geometry) geometry.dispose()
    return result
  })
}

export type DeepSkinParams = {
  /** From world coordinates to the vehicle's. */
  readonly toVehicle: THREE_NS.Matrix4
  readonly side: number
  readonly depth: number
}

/** Splits each piece cut for a door (see `splitDoorSkin`): the piece keeps the door's skin, and what lay deeper goes back to the body, where it was, as a mesh of its own. */
export function leaveDeepSkinOnBody(THREE: Three, pieces: Mesh[], params: DeepSkinParams): void {
  const { toVehicle, side, depth } = params
  const split = splitDoorSkin(THREE, pieces, (mesh) => new THREE.Matrix4().multiplyMatrices(toVehicle, mesh.matrixWorld), side, depth)
  split.forEach(({ skin, deep }, i) => {
    const piece = pieces[i]!
    if (!deep || !skin || !piece.parent) return
    const body = new THREE.Mesh(deep, piece.material)
    body.position.copy(piece.position)
    body.quaternion.copy(piece.quaternion)
    body.scale.copy(piece.scale)
    body.castShadow = piece.castShadow
    body.receiveShadow = piece.receiveShadow
    piece.parent.add(body)
    piece.geometry.dispose()
    piece.geometry = skin
  })
}

/** The triangles of a non-indexed geometry whose flag is `wanted`, with every attribute, or null when there are none. */
function pickTriangles(THREE: Three, geometry: Geometry, flags: boolean[], wanted: boolean): Geometry | null {
  const count = flags.filter((flag) => flag === wanted).length
  if (!count) return null
  const out = new THREE.BufferGeometry()
  for (const name of Object.keys(geometry.attributes)) {
    const attribute = geometry.getAttribute(name)
    const size = attribute.itemSize
    const source = attribute.array as Float32Array
    const array = new Float32Array(count * 3 * size)
    let w = 0
    flags.forEach((flag, t) => {
      if (flag !== wanted) return
      array.set(source.subarray(t * 3 * size, (t + 1) * 3 * size), w)
      w += 3 * size
    })
    out.setAttribute(name, new THREE.Float32BufferAttribute(array, size))
  }
  out.computeBoundingBox()
  out.computeBoundingSphere()
  return out
}

/** The shut line the body draws at a door's edge: the gap of a closed door, gone while the door stands open, never a rod swinging with it. */
export function isDoorSeam(THREE: Three, params: DoorSeamParams): boolean {
  const { box, zone, side, dark } = params
  if (!dark || box.isEmpty()) return false
  const size = box.getSize(new THREE.Vector3())
  const centre = box.getCenter(new THREE.Vector3())
  if (Math.sign(centre.z) !== Math.sign(side) || size.x > SEAM_THIN || size.z > SEAM_THIN || size.y < (zone.y1 - zone.y0) * SEAM_TALL) return false
  if (centre.y < zone.y0 || centre.y > zone.y1) return false
  return Math.abs(centre.x - zone.x0) < SEAM_AT_EDGE || Math.abs(centre.x - zone.x1) < SEAM_AT_EDGE
}
