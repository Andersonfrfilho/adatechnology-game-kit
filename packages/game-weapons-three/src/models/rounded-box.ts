import type * as THREE_NS from 'three'

type Three = typeof THREE_NS
type Axis = 'x' | 'y' | 'z'

// Port of three/examples/jsm/geometries/RoundedBoxGeometry (MIT, three.js authors) onto the host's THREE: the host lends its namespace, not the addon.
const uvAlong = (THREE: Three, faceDirection: THREE_NS.Vector3, normal: THREE_NS.Vector3, uvAxis: Axis, projectionAxis: Axis, radius: number, sideLength: number): number => {
  const arcLength = (2 * Math.PI * radius) / 4
  const centerLength = Math.max(sideLength - 2 * radius, 0)
  const halfArc = Math.PI / 4
  const projected = new THREE.Vector3().copy(normal)
  projected[projectionAxis] = 0
  projected.normalize()
  const arcUvRatio = (0.5 * arcLength) / (arcLength + centerLength)
  const arcAngleRatio = 1.0 - projected.angleTo(faceDirection) / halfArc
  if (Math.sign(projected[uvAxis]) === 1) return arcAngleRatio * arcUvRatio
  const centerUv = centerLength / (arcLength + centerLength)
  return centerUv + arcUvRatio + arcUvRatio * (1.0 - arcAngleRatio)
}

type Face = { direction: [number, number, number]; u: [Axis, Axis, boolean]; v: [Axis, Axis, boolean] }

// right, left, top, bottom, front, back: the axes each face reads its u and v from, and whether the value is mirrored
const FACES: readonly Face[] = [
  { direction: [1, 0, 0], u: ['z', 'y', false], v: ['y', 'z', true] },
  { direction: [-1, 0, 0], u: ['z', 'y', true], v: ['y', 'z', true] },
  { direction: [0, 1, 0], u: ['x', 'z', true], v: ['z', 'x', false] },
  { direction: [0, -1, 0], u: ['x', 'z', true], v: ['z', 'x', true] },
  { direction: [0, 0, 1], u: ['x', 'y', true], v: ['y', 'x', true] },
  { direction: [0, 0, -1], u: ['x', 'y', false], v: ['y', 'x', true] },
]

/** A box with rounded edges (`segments` per corner) made from the host's BoxGeometry, vertex for vertex like the three.js addon the gallery used. */
export function createRoundedBoxGeometry(THREE: Three, width: number, height: number, depth: number, segments: number, radius: number): THREE_NS.BufferGeometry {
  const count = segments * 2 + 1
  const rounding = Math.min(width / 2, height / 2, depth / 2, radius)
  const geometry = new THREE.BoxGeometry(1, 1, 1, count, count, count)
  const flat = geometry.toNonIndexed()
  geometry.setIndex(null)
  geometry.setAttribute('position', flat.attributes.position as THREE_NS.BufferAttribute)
  geometry.setAttribute('normal', flat.attributes.normal as THREE_NS.BufferAttribute)
  geometry.setAttribute('uv', flat.attributes.uv as THREE_NS.BufferAttribute)
  const position = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const box = new THREE.Vector3(width, height, depth).divideScalar(2).subScalar(rounding)
  const positions = geometry.attributes.position.array as Float32Array
  const normals = geometry.attributes.normal.array as Float32Array
  const uvs = geometry.attributes.uv.array as Float32Array
  const faceTriangles = positions.length / 6
  const halfSegment = 0.5 / count
  const sides: Record<Axis, number> = { x: width, y: height, z: depth }
  for (let i = 0, j = 0; i < positions.length; i += 3, j += 2) {
    position.fromArray(positions, i)
    normal.copy(position)
    normal.x -= Math.sign(normal.x) * halfSegment
    normal.y -= Math.sign(normal.y) * halfSegment
    normal.z -= Math.sign(normal.z) * halfSegment
    normal.normalize()
    positions[i] = box.x * Math.sign(position.x) + normal.x * rounding
    positions[i + 1] = box.y * Math.sign(position.y) + normal.y * rounding
    positions[i + 2] = box.z * Math.sign(position.z) + normal.z * rounding
    normals[i] = normal.x
    normals[i + 1] = normal.y
    normals[i + 2] = normal.z
    const face = FACES[Math.floor(i / faceTriangles)]
    if (!face) continue
    const direction = new THREE.Vector3(...face.direction)
    for (const [offset, [uvAxis, projectionAxis, mirrored]] of [[0, face.u], [1, face.v]] as const) {
      const value = uvAlong(THREE, direction, normal, uvAxis, projectionAxis, rounding, sides[uvAxis])
      uvs[j + offset] = mirrored ? 1 - value : value
    }
  }
  return geometry
}
