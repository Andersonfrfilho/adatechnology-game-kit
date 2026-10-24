import type { RandomSource, Silhouette, SilhouettePart, SilhouetteWindow } from './types'

const ROOT = -1
const MAX_BOX_RADIUS = 0.15
const BOX_RADIUS_RATIO = 0.22
const PLAIN_BOX_RADIUS = 0.012

type Options = { parent?: number; ry?: number; rz?: number; emissive?: boolean }

/** Rounded-box radius the team page gives a box; below 1.2 cm it is a plain box. */
function boxRadius(width: number, height: number, depth: number): number {
  const radius = Math.min(Math.min(width, height, depth) * BOX_RADIUS_RATIO, MAX_BOX_RADIUS)
  return radius < PLAIN_BOX_RADIUS ? 0 : radius
}

/** Collects the parts of one silhouette; the generators call it the way the team page calls its own helpers. */
export function createSilhouetteBuilder(random: RandomSource) {
  const parts: SilhouettePart[] = []
  const windows: SilhouetteWindow[] = []
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T
  const group = (x: number, y: number, z: number, ry = 0, parent = ROOT): number => parts.push({ shape: 'group', parent, x, y, z, ry }) - 1
  const box = (x: number, y: number, z: number, width: number, height: number, depth: number, color: number, o: Options = {}): void => {
    parts.push({ shape: 'box', parent: o.parent ?? ROOT, x, y: y + height / 2, z, width, height, depth, color, emissive: o.emissive ?? false, ry: o.ry ?? 0, rz: o.rz ?? 0, radius: boxRadius(width, height, depth) })
  }
  const prism = (x: number, y: number, z: number, width: number, height: number, depth: number, color: number, parent = ROOT): void => {
    parts.push({ shape: 'prism', parent, x, y, z, width, height, depth, color, ry: 0 })
  }
  const cylinder = (x: number, y: number, z: number, radiusTop: number, radiusBottom: number, height: number, color: number, parent = ROOT, segments = 14): void => {
    parts.push({ shape: 'cylinder', parent, x, y: y + height / 2, z, radiusTop, radiusBottom, height, color, segments })
  }
  const line = (points: [number, number, number][], color: number, parent = ROOT): void => {
    parts.push({ shape: 'line', parent, points, color })
  }
  const sign = (text: string, x: number, y: number, z: number, width: number, height: number, ry: number, colors: { background: string; foreground: string }, parent = ROOT): void => {
    parts.push({ shape: 'sign', parent, x, y, z, width, height, ry, text, ...colors })
  }
  const fence = (x0: number, z0: number, x1: number, z1: number, height: number, color: number, parent = ROOT): void => {
    const length = Math.hypot(x1 - x0, z1 - z0)
    const count = Math.ceil(length / 3)
    for (let index = 0; index <= count; index++) {
      const t = index / count
      cylinder(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, 0.05, 0.05, height, color, parent, 5)
    }
    for (const level of [height * 0.35, height * 0.65, height * 0.98]) line([[x0, level, z0], [x1, level, z1]], 0x8a8c8e, parent)
  }
  const finish = (footprint: Silhouette['footprint']): Silhouette => ({ parts, windows, footprint })
  return { random, pick, group, box, prism, cylinder, line, sign, fence, windows, finish }
}

export type SilhouetteBuilder = ReturnType<typeof createSilhouetteBuilder>
