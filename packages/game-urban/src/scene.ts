import { boxRadius } from '@adatechnology/game-floorplan'

import { createLightBudget } from './budget'
import type { ItemBox, LightBudget, LightPart, PartStyle, RandomSource, Silhouette, UrbanPart, UrbanScene } from './types'

const ROOT = -1
const DEFAULT_CYLINDER_SEGMENTS = 14
const DEFAULT_CONE_SEGMENTS = 6
const DEFAULT_FENCE_WIRE = 0x8a8c8e
const DEFAULT_FENCE_POST = 0x6a6c6e
const DEFAULT_LABEL_FONT = '700 56px "Arial Narrow", Arial, sans-serif'

type BoxOptions = { parent?: number; ry?: number; rz?: number; emissive?: boolean; style?: PartStyle }

export type UrbanBuilderOptions = {
  /** Lights the scene may spend; omitted means no limit. */
  budget?: LightBudget
}

/**
 * Collects the parts of an urban scene the way the team's page adds them to its root: every helper appends in call order, so a
 * scene drawn with the same seeded random has the same parts, the same instances and the same windows.
 * Heights follow the page: `y` is the base of a box, a cylinder, a cone and a prism, and the centre of a crown.
 */
export function createUrbanBuilder(random: RandomSource, options: UrbanBuilderOptions = {}) {
  const parts: UrbanPart[] = []
  const items: ItemBox[] = []
  const windows: UrbanScene['windows'] = { lit: [], dark: [] }
  const lights = options.budget ?? createLightBudget(Number.POSITIVE_INFINITY)
  const pick = <TEntry>(list: readonly TEntry[]): TEntry => list[Math.floor(random() * list.length)] as TEntry

  const group = (x: number, y: number, z: number, ry = 0, parent = ROOT): number => parts.push({ shape: 'group', parent, x, y, z, ry }) - 1
  const box = (x: number, y: number, z: number, width: number, height: number, depth: number, color: number, o: BoxOptions = {}): void => {
    const part: UrbanPart = { shape: 'box', parent: o.parent ?? ROOT, x, y: y + height / 2, z, width, height, depth, color, emissive: o.emissive ?? false, ry: o.ry ?? 0, rz: o.rz ?? 0, radius: boxRadius(width, height, depth) }
    if (o.style) part.style = o.style
    parts.push(part)
  }
  const cylinder = (x: number, y: number, z: number, radiusTop: number, radiusBottom: number, height: number, color: number, parent = ROOT, segments = DEFAULT_CYLINDER_SEGMENTS, style?: PartStyle): void => {
    const part: UrbanPart = { shape: 'cylinder', parent, x, y: y + height / 2, z, radiusTop, radiusBottom, height, color, segments }
    if (style) part.style = style
    parts.push(part)
  }
  const cone = (x: number, y: number, z: number, radius: number, height: number, color: number, parent = ROOT, segments = DEFAULT_CONE_SEGMENTS): void => {
    parts.push({ shape: 'cone', parent, x, y: y + height / 2, z, radius, height, color, segments })
  }
  const prism = (x: number, y: number, z: number, width: number, height: number, depth: number, color: number, parent = ROOT, ry = 0): void => {
    parts.push({ shape: 'prism', parent, x, y, z, width, height, depth, color, ry })
  }
  const plane = (x: number, y: number, z: number, width: number, depth: number, color: number, style?: PartStyle, parent = ROOT): void => {
    const part: UrbanPart = { shape: 'plane', parent, x, y, z, width, depth, color }
    if (style) part.style = style
    parts.push(part)
  }
  const vault = (part: Omit<Extract<UrbanPart, { shape: 'vault' }>, 'shape' | 'parent'> & { parent?: number }): void => {
    parts.push({ shape: 'vault', ...part, parent: part.parent ?? ROOT })
  }
  const crown = (x: number, y: number, z: number, radius: number, color: number, parent = ROOT): void => {
    parts.push({ shape: 'crown', parent, x, y, z, radius, color })
  }
  const line = (points: [number, number, number][], color: number, parent = ROOT): void => {
    parts.push({ shape: 'line', parent, points, color })
  }
  const label = (lines: string[], x: number, y: number, z: number, width: number, height: number, ry: number, o: { background: string; foreground: string; font?: string; canvas?: { width: number; height: number } }, parent = ROOT): void => {
    parts.push({ shape: 'label', parent, x, y, z, width, height, ry, lines, background: o.background, foreground: o.foreground, font: o.font ?? DEFAULT_LABEL_FONT, canvas: o.canvas ?? { width: 512, height: 128 } })
  }
  const light = (part: Omit<Extract<LightPart, { kind: 'point' }>, 'shape' | 'kind' | 'parent' | 'decay' | 'flicker'> & { flicker?: boolean; decay?: number }): void => {
    parts.push({ shape: 'light', kind: 'point', parent: ROOT, decay: 2, flicker: false, ...part })
  }
  const spot = (part: Omit<Extract<LightPart, { kind: 'spot' }>, 'shape' | 'kind' | 'parent'>): void => {
    parts.push({ shape: 'light', kind: 'spot', parent: ROOT, ...part })
  }
  const item = (x: number, y: number, z: number, width: number, height: number, depth: number, color: number, ry = 0, rx = 0, rz = 0): void => {
    items.push({ x, y, z, width, height, depth, color, rx, ry, rz })
  }
  /** Cylinder posts every 3 m (at least two) and three wires, as the team's fence. */
  const fence = (x0: number, z0: number, x1: number, z1: number, height: number, color = DEFAULT_FENCE_POST): void => {
    const count = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 3)
    for (let index = 0; index <= count; index++) {
      const t = index / count
      cylinder(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, 0.05, 0.05, height, color, ROOT, 5)
    }
    for (const level of [height * 0.35, height * 0.65, height * 0.98]) line([[x0, level, z0], [x1, level, z1]], DEFAULT_FENCE_WIRE)
  }
  /** Adds a silhouette of game-floorplan (a house far away, a city building): its parts keep their order and their groups are re-indexed, its windows join the scene's. */
  const add = (silhouette: Silhouette): void => {
    const offset = parts.length
    for (const part of silhouette.parts) parts.push(part.parent < 0 ? part : { ...part, parent: part.parent + offset })
    for (const window of silhouette.windows) (window.isLit ? windows.lit : windows.dark).push(window)
  }
  const scene = (): UrbanScene => ({ parts, items, windows })
  return { random, pick, lights, parts, items, windows, group, box, cylinder, cone, prism, plane, vault, crown, line, label, light, spot, item, fence, add, scene }
}

export type UrbanBuilder = ReturnType<typeof createUrbanBuilder>
