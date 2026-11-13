import * as THREE from 'three'
import type { Piece } from '../src/types'

const centreY = (p: Piece, v: THREE.Vector3): number => {
  p.root.updateMatrixWorld(true)
  return v.set(p.localCenter[0], p.localCenter[1], p.localCenter[2]).applyMatrix4(p.root.matrixWorld).y
}

/**
 * Measures, around each `renderer.update`, how far each piece's centre of mass rose beyond what its own upward speed carries it (`lift`, summed per piece) and the
 * upward speed an update left on a piece that it did not have before (`fastestUp`). Gravity only takes speed up away, so both come from contacts. Independent of how
 * the system resolves contacts.
 */
export const measureLift = (pieces: () => Piece[], update: (dt: number) => void, dt: number, frames: number, between?: () => void): Map<string, { lift: number; up: number }> => {
  const v = new THREE.Vector3()
  const out = new Map<string, { lift: number; up: number }>()
  for (let f = 0; f < frames; f++) {
    between?.()
    const before = pieces().map((p) => ({ p, y: centreY(p, v), vy: p.velocity[1] }))
    update(dt)
    for (const { p, y, vy } of before) {
      const r = out.get(p.objectId) ?? { lift: 0, up: 0 }
      r.lift += Math.max(0, centreY(p, v) - y - Math.max(0, vy) * dt)
      if (p.velocity[1] > Math.max(0, vy) + 1e-9) r.up = Math.max(r.up, p.velocity[1])
      out.set(p.objectId, r)
    }
  }
  return out
}
