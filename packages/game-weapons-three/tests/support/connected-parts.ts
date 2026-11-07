import * as THREE from 'three'

/** The world-space triangles and vertices of a mesh. */
const surfaceOf = (mesh: THREE.Mesh): { triangles: THREE.Triangle[]; points: THREE.Vector3[] } => {
  const geometry = mesh.geometry
  const position = geometry.getAttribute('position')
  const points: THREE.Vector3[] = []
  for (let i = 0; i < position.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld))
  const index = geometry.getIndex()
  const corner = (i: number): THREE.Vector3 => points[index ? index.getX(i) : i] as THREE.Vector3
  const count = index ? index.count : position.count
  const triangles: THREE.Triangle[] = []
  for (let i = 0; i + 2 < count; i += 3) triangles.push(new THREE.Triangle(corner(i), corner(i + 1), corner(i + 2)))
  return { triangles, points }
}

const UP = new THREE.Vector3(0.0123, 1, 0.0071).normalize()

/** Whether a point is inside a closed surface: a ray from it crosses the surface an odd number of times. */
const isInside = (point: THREE.Vector3, triangles: readonly THREE.Triangle[]): boolean => {
  const ray = new THREE.Ray(point, UP)
  const hit = new THREE.Vector3()
  let crossings = 0
  for (const { a, b, c } of triangles) if (ray.intersectTriangle(a, b, c, false, hit)) crossings++
  return crossings % 2 === 1
}

/** Whether a corner of one surface comes within `gap` of a face of the other, or lies inside it. */
const touches = (a: ReturnType<typeof surfaceOf>, b: ReturnType<typeof surfaceOf>, gap: number): boolean => {
  const closest = new THREE.Vector3()
  for (const point of a.points) {
    for (const triangle of b.triangles) if (triangle.closestPointToPoint(point, closest).distanceTo(point) <= gap) return true
    if (isInside(point, b.triangles)) return true
  }
  return false
}

/**
 * The visible meshes of a model that are not joined to the largest piece: two meshes are joined when a corner of one lies within `gap` of a face of the other or inside it (or the other
 * way round). Each entry names the geometry and the centre of a stray mesh. `skip` leaves meshes out (a fitting drawn on its own, for instance).
 */
export function strayParts(root: THREE.Object3D, gap = 0.0015, skip: (mesh: THREE.Mesh) => boolean = () => false): string[] {
  root.updateMatrixWorld(true)
  const meshes: THREE.Mesh[] = []
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    let shown = true
    for (let node: THREE.Object3D | null = object; node; node = node.parent) if (!node.visible) shown = false
    if (mesh.isMesh && shown && !skip(mesh)) meshes.push(mesh)
  })
  const surfaces = meshes.map(surfaceOf)
  const boxes = meshes.map((mesh) => new THREE.Box3().setFromObject(mesh).expandByScalar(gap))
  const parent = meshes.map((_, index) => index)
  const find = (index: number): number => (parent[index] === index ? index : (parent[index] = find(parent[index] as number)))
  for (let i = 0; i < meshes.length; i++) {
    for (let j = i + 1; j < meshes.length; j++) {
      if (find(i) === find(j) || !(boxes[i] as THREE.Box3).intersectsBox(boxes[j] as THREE.Box3)) continue
      const a = surfaces[i] as ReturnType<typeof surfaceOf>
      const b = surfaces[j] as ReturnType<typeof surfaceOf>
      if (touches(a, b, gap) || touches(b, a, gap)) parent[find(i)] = find(j)
    }
  }
  const groups = new Map<number, number[]>()
  meshes.forEach((_, index) => groups.set(find(index), [...(groups.get(find(index)) ?? []), index]))
  const sorted = [...groups.values()].sort((a, b) => b.length - a.length)
  return sorted.slice(1).flat().map((index) => {
    const centre = (boxes[index] as THREE.Box3).getCenter(new THREE.Vector3())
    return `${(meshes[index] as THREE.Mesh).geometry.type} at ${centre.x.toFixed(3)}, ${centre.y.toFixed(3)}, ${centre.z.toFixed(3)}`
  })
}
