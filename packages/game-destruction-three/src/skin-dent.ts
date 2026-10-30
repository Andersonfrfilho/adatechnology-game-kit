import type * as THREE_NS from 'three'

/** A shell mesh with its vertex positions before and after a dent, both in its own local space. */
export type ShellSnapshot = {
  readonly mesh: THREE_NS.Mesh
  readonly before: ArrayLike<number>
  readonly after: ArrayLike<number>
}

/**
 * How far the surface of the shells moved where `worldPoint` (a vertex of a skin: a label, a coat) lies on it, as a world vector: the displacement of the
 * nearest shell triangle, interpolated by barycentric weights. A skin that takes it moves with the shell, whatever the two meshes' vertex grids are.
 * Returns the distance (world metres) from the point to that triangle, how high above the shell the skin lies.
 */
export function shellDisplacementAt(THREE: typeof THREE_NS, worldPoint: THREE_NS.Vector3, shells: readonly ShellSnapshot[], out: THREE_NS.Vector3): number {
  const triangle = new THREE.Triangle()
  const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] as const
  const local = new THREE.Vector3()
  const closest = new THREE.Vector3()
  const weights = new THREE.Vector3()
  const moved = new THREE.Vector3()
  let nearest = Infinity
  out.set(0, 0, 0)
  let nearestScale = 1
  for (const shell of shells) {
    shell.mesh.updateWorldMatrix(true, false)
    shell.mesh.worldToLocal(local.copy(worldPoint))
    const index = shell.mesh.geometry.index
    const triangles = index ? index.count / 3 : shell.before.length / 9
    for (let t = 0; t < triangles; t++) {
      const ids = [0, 1, 2].map((corner) => (index ? index.getX(t * 3 + corner) : t * 3 + corner))
      ids.forEach((id, corner) => corners[corner]!.set(shell.before[id * 3]!, shell.before[id * 3 + 1]!, shell.before[id * 3 + 2]!))
      triangle.set(corners[0], corners[1], corners[2])
      // a degenerate triangle (the tip of a lathe on its axis, the doubled rim of a can) has no surface to follow and no closest point (NaN must never win)
      if (triangle.getArea() <= 1e-14) continue
      triangle.closestPointToPoint(local, closest)
      const distance = closest.distanceToSquared(local)
      if (!(distance < nearest)) continue
      nearest = distance
      nearestScale = shell.mesh.matrixWorld.getMaxScaleOnAxis() || 1
      triangle.getBarycoord(closest, weights)
      moved.set(0, 0, 0)
      ids.forEach((id, corner) => {
        const weight = corner === 0 ? weights.x : corner === 1 ? weights.y : weights.z
        moved.x += weight * (shell.after[id * 3]! - shell.before[id * 3]!)
        moved.y += weight * (shell.after[id * 3 + 1]! - shell.before[id * 3 + 1]!)
        moved.z += weight * (shell.after[id * 3 + 2]! - shell.before[id * 3 + 2]!)
      })
      out.copy(moved).transformDirection(shell.mesh.matrixWorld)
      out.multiplyScalar(moved.length() * (shell.mesh.matrixWorld.getMaxScaleOnAxis() || 1))
    }
  }
  return Math.sqrt(nearest) * nearestScale
}
