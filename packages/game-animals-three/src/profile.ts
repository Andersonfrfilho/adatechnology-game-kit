import type * as THREE_NS from 'three'

import type { Three } from './types'

/** A body of revolution whose radius follows `profile` along the length, rear to front, closed by a point at each end. */
export const profileGeometry = (THREE: Three, length: number, profile: readonly number[], segments?: number): THREE_NS.LatheGeometry => {
  const points = profile.map((radius, index) => new THREE.Vector2(index / (profile.length - 1), radius))
  const curve = new THREE.SplineCurve(points)
  const outline: THREE_NS.Vector2[] = []
  outline.push(new THREE.Vector2(0.001, -length / 2 - 0.0))
  for (let step = 0; step <= 30; step++) {
    const point = curve.getPoint(step / 30)
    outline.push(new THREE.Vector2(Math.max(0.001, point.y), -length / 2 + point.x * length))
  }
  outline.push(new THREE.Vector2(0.001, length / 2))
  return new THREE.LatheGeometry(outline, segments || 22).rotateX(Math.PI / 2)
}
