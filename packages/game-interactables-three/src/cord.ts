import type { ThreeLib, ThreeNS, Vec3 } from './types'

/**
 * Points of a hanging cord between `a` and `b` (n points including both ends, n >= 2). The deepest point sits `sag` meters below
 * the straight line between the ends, on a real catenary (y = a cosh(x/a)); when the ends differ in height the curve is
 * measured against the straight line between them.
 */
export function catenary(a: Vec3, b: Vec3, sag: number, n = 12): Vec3[] {
  const count = Math.max(2, Math.floor(n))
  const span = Math.hypot(b[0] - a[0], b[2] - a[2]) || Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const depth = Math.max(0, sag)
  const out: Vec3[] = []
  // Solve depth = c (cosh(span / 2c) - 1) for c by bisection (depth grows as c shrinks).
  let shape: (s: number) => number = () => 0
  if (depth > 1e-6 && span > 1e-6) {
    let lo = 1e-4
    let hi = span * 1000
    for (let i = 0; i < 80; i++) {
      const c = (lo + hi) / 2
      const d = c * (Math.cosh(span / (2 * c)) - 1)
      if (d > depth) lo = c
      else hi = c
    }
    const c = (lo + hi) / 2
    shape = (s) => c * (Math.cosh(((s - 0.5) * span) / c) - Math.cosh(span / (2 * c)))
  }
  for (let i = 0; i < count; i++) {
    const s = i / (count - 1)
    out.push([a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s + shape(s), a[2] + (b[2] - a[2]) * s])
  }
  return out
}

/** A thin tube through `points` (Catmull-Rom smoothed) for wires, cords and conduits. */
export function createCord(THREE: ThreeLib, points: readonly Vec3[], radius: number, material: ThreeNS.Material, radialSegments = 5): ThreeNS.Mesh {
  if (points.length < 2) throw new Error('createCord needs at least two points')
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal')
  const segments = Math.max(4, (points.length - 1) * 4)
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, radialSegments, false), material)
  mesh.name = 'cord'
  mesh.castShadow = true
  return mesh
}
