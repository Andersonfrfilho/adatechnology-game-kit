import type * as THREE_NS from 'three'
import type { ModelKit, Parent } from './kit'

const PI = Math.PI

/** A picatinny rail: a dark base and the cross slots, on a pivot so that it can lie on any side of the handguard. */
export function rail(kit: ModelKit, parent: Parent, x: number, length: number, y: number, z: number, width: number, rotationX = 0): THREE_NS.Group {
  const { M, box } = kit
  const pivot = kit.pivot(parent, 0, y, z)
  pivot.rotation.x = rotationX
  box(pivot, length, 0.005, width, M.dark, x + length / 2, 0, 0)
  const slots = Math.floor(length / 0.0095)
  for (let i = 0; i < slots; i++) box(pivot, 0.0052, 0.0035, width * 1.12, M.metal, x + 0.006 + i * 0.0095, 0.0035, 0)
  return pivot
}

/** Cooling slots along a handguard. */
export function vents(kit: ModelKit, parent: Parent, x: number, length: number, y: number, z: number, count: number, height: number): void {
  for (let i = 0; i < count; i++) kit.box(parent, (length / count) * 0.45, height, 0.003, kit.M.hole, x + ((i + 0.5) * length) / count, y, z)
}

/** An optic: 1 red dot, 2 short scope, 3 and 4 long scopes with their rings. */
export function scope(kit: ModelKit, parent: Parent, kind: number, cx: number, cy: number, cz = 0): void {
  const { M, box, cylinderX, cylinderY, cylinderZ, THREE } = kit
  if (kind === 1) {
    box(parent, 0.044, 0.01, 0.028, M.dark, cx, cy + 0.005, cz)
    cylinderX(parent, 0.0155, 0.034, M.dark, cx + 0.004, cy + 0.026, cz, 18)
    cylinderX(parent, 0.0125, 0.002, M.lens, cx + 0.022, cy + 0.026, cz, 18)
    cylinderY(parent, 0.004, 0.006, M.dark, cx + 0.004, cy + 0.044, cz, 10)
    return
  }
  if (kind === 2) {
    box(parent, 0.07, 0.012, 0.026, M.dark, cx, cy + 0.006, cz)
    cylinderX(parent, 0.016, 0.1, M.dark, cx - 0.01, cy + 0.032, cz, 18)
    cylinderX(parent, 0.016, 0.035, M.dark, cx + 0.055, cy + 0.032, cz, 18, 0.02)
    cylinderX(parent, 0.017, 0.002, M.lens, cx + 0.073, cy + 0.032, cz, 18)
    cylinderY(parent, 0.007, 0.012, M.dark, cx, cy + 0.052, cz, 12)
    box(parent, 0.03, 0.01, 0.012, M.dark, cx - 0.01, cy + 0.054, cz)
    return
  }
  const sleeve = kind === 4 ? 0.2 : 0.32
  cylinderX(parent, 0.0135, sleeve * 0.55, M.dark, cx, cy + 0.045, cz, 18)
  cylinderX(parent, 0.0135, sleeve * 0.25, M.dark, cx + sleeve * 0.36, cy + 0.045, cz, 18, 0.026)
  cylinderX(parent, 0.026, 0.05, M.dark, cx + sleeve * 0.5, cy + 0.045, cz, 18)
  cylinderX(parent, 0.024, 0.002, M.lens, cx + sleeve * 0.5 + 0.026, cy + 0.045, cz, 18)
  cylinderX(parent, 0.019, 0.06, M.dark, cx - sleeve * 0.38, cy + 0.045, cz, 18, 0.0135)
  cylinderX(parent, 0.019, 0.035, M.rubber, cx - sleeve * 0.38 - 0.045, cy + 0.045, cz, 18)
  cylinderX(parent, 0.017, 0.002, M.lens, cx - sleeve * 0.38 - 0.063, cy + 0.045, cz, 18)
  cylinderY(parent, 0.01, 0.022, M.dark, cx, cy + 0.066, cz, 14)
  cylinderY(parent, 0.011, 0.004, M.metal, cx, cy + 0.078, cz, 14)
  cylinderZ(parent, 0.01, 0.022, M.dark, cx, cy + 0.045, cz + 0.022, 14)
  for (const offset of [-0.07, 0.07]) {
    const ring = kit.torus(parent, new THREE.TorusGeometry(0.0155, 0.003, 8, 20), M.dark, cx + offset, cy + 0.045, cz)
    ring.rotation.y = PI / 2
    box(parent, 0.016, 0.03, 0.022, M.dark, cx + offset, cy + 0.018, cz)
  }
}

export const buttpad = (kit: ModelKit, parent: Parent, x: number, y: number, height: number, width: number): void => void kit.box(parent, 0.012, height, width, kit.M.rubber, x, y, 0)

export const swivel = (kit: ModelKit, parent: Parent, x: number, y: number): void => void kit.torus(parent, new kit.THREE.TorusGeometry(0.006, 0.0015, 6, 12), kit.M.metal, x, y, 0)
