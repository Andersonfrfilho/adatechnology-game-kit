import type { Primitive, PropItem } from '../src'

/** A canvas 2d context that accepts everything and does nothing. */
export function stubDocument() {
  const gradient = { addColorStop() {} }
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => gradient : () => {}), set: () => true })
  return {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
  } as unknown as Document
}

type V3 = [number, number, number]

// rotation order YXZ (ry last), like the api contract says
function rotate([x, y, z]: V3, rx: number, ry: number, rz: number): V3 {
  // Rz, then Rx, then Ry
  let [a, b, c] = [x, y, z]
  ;[a, b] = [a * Math.cos(rz) - b * Math.sin(rz), a * Math.sin(rz) + b * Math.cos(rz)]
  ;[b, c] = [b * Math.cos(rx) - c * Math.sin(rx), b * Math.sin(rx) + c * Math.cos(rx)]
  ;[a, c] = [a * Math.cos(ry) + c * Math.sin(ry), -a * Math.sin(ry) + c * Math.cos(ry)]
  return [a, b, c]
}

/** Horizontal (x, z) extent of one primitive, from its rotated corners. */
export function extentOf(p: Primitive): { x: [number, number]; z: [number, number] } | null {
  const pts: V3[] = []
  if (p.kind === 'box') {
    const cy = p.y + p.h / 2
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const r = rotate([(sx * p.w) / 2, (sy * p.h) / 2, (sz * p.d) / 2], p.rx, p.ry, p.rz)
      pts.push([p.x + r[0], cy + r[1], p.z + r[2]])
    }
  } else if (p.kind === 'cylinder') {
    const tilted = p.rx !== 0 || p.rz !== 0
    for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) {
      const local: V3 = tilted ? [sx * p.r, (sy - 0.5) * p.h, sz * p.r] : [sx * p.r, sy * p.h, sz * p.r]
      const r = rotate(local, p.rx, 0, p.rz)
      pts.push([p.x + r[0], (tilted ? p.y : p.y) + r[1], p.z + r[2]])
    }
  } else if (p.kind === 'leaf') {
    for (const sx of [-1, 1]) for (const sy of [0, 1]) {
      const r = rotate([(sx * p.w) / 2, sy * p.h, 0], p.rx, p.ry, 0)
      pts.push([p.x + r[0], p.y + r[1], p.z + r[2]])
    }
  } else if (p.kind === 'plane') {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const r = rotate([(sx * p.w) / 2, (sy * p.h) / 2, 0], p.rx, p.ry, p.rz)
      pts.push([p.x + r[0], p.y + r[1], p.z + r[2]])
    }
  } else {
    return null
  }
  const xs = pts.map((q) => q[0])
  const zs = pts.map((q) => q[2])
  return { x: [Math.min(...xs), Math.max(...xs)], z: [Math.min(...zs), Math.max(...zs)] }
}

export function footprintOf(prims: Primitive[]): { x: [number, number]; z: [number, number] } {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const p of prims) {
    const e = extentOf(p)
    if (!e) continue
    minX = Math.min(minX, e.x[0]); maxX = Math.max(maxX, e.x[1])
    minZ = Math.min(minZ, e.z[0]); maxZ = Math.max(maxZ, e.z[1])
  }
  return { x: [minX, maxX], z: [minZ, maxZ] }
}

export const itemFor = (w: number, d: number, h: number, extra: PropItem = {}): PropItem => ({ w, d, h, seed: 'test', ...extra })
