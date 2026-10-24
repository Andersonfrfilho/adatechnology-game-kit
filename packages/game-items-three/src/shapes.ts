import type * as THREE_NS from 'three'

import type { ItemKit, Vec3Tuple } from './kit'

/** The simple shapes the kit draws at the real size of an item, by the `shape` hint of its definition. */
export const SHAPES = [
  'can', 'bag', 'box', 'bottle', 'tool', 'roll', 'dish', 'cloth', 'shoe', 'jar', 'paper', 'fruit', 'cup', 'tube',
  'blade', 'long_tool', 'garment', 'backpack', 'jerrycan', 'tank', 'book', 'key', 'battery', 'plank', 'device',
] as const
export type ShapeId = (typeof SHAPES)[number]

/** What a shape drawer is given: the kit, the size in metres, the colour of the item and the level of detail (1 full, 0.5 half the segments). */
export interface ShapeContext {
  k: ItemKit
  w: number
  h: number
  d: number
  color: number
  detail: number
}
type Drawer = (c: ShapeContext) => THREE_NS.Group

const DEFAULT_COLOR = 0x8a8f94
const PI = Math.PI

/** The colour `factor` times lighter (above 1) or darker (below 1), per channel. */
export function shade(color: number, factor: number): number {
  const channel = (shift: number): number => Math.max(0, Math.min(255, Math.round(((color >> shift) & 255) * factor)))
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

/** Segments of a round part at a level of detail: never below 5. */
const seg = (c: ShapeContext, n: number): number => Math.max(5, Math.round(n * c.detail))

/** The long axis of a size and the three sides in the frame where that axis is x: `L` long, `a` the next, `b` the shortest of the other two in their own order. */
export function canonicalFrame(size: Vec3Tuple): { axis: 0 | 1 | 2; L: number; a: number; b: number } {
  const [w, h, d] = size
  if (h >= w && h >= d) return { axis: 1, L: h, a: w, b: d }
  if (d >= w && d >= h) return { axis: 2, L: d, a: h, b: w }
  return { axis: 0, L: w, a: h, b: d }
}

/** Turns a group drawn with its long side on x so that the long side lies on the given axis. */
function orient(c: ShapeContext, group: THREE_NS.Group, axis: 0 | 1 | 2): THREE_NS.Group {
  if (axis === 0) return group
  const holder = c.k.G(group)
  if (axis === 1) holder.rotation.z = PI / 2
  else holder.rotation.y = -PI / 2
  return holder
}

/** A shape drawn along x in the frame `(L, a, b)`, then turned onto the long axis of the size. */
const alongLong = (draw: (c: ShapeContext, L: number, a: number, b: number) => THREE_NS.Group): Drawer => (c) => {
  const { axis, L, a, b } = canonicalFrame([c.w, c.h, c.d])
  return orient(c, draw(c, L, a, b), axis)
}

/** A group drawn with a radius of 0.5 and stretched to the width and depth of the item (an oval can fills its box). */
const across = (c: ShapeContext, group: THREE_NS.Group): THREE_NS.Group => {
  group.scale.set(c.w, 1, c.d)
  return c.k.G(group)
}

const can: Drawer = (c) => {
  const { k, h } = c
  const body = k.metal(0x8d9096)
  return across(c, k.G(k.mesh(k.cyl(0.5, 0.5, h * 0.94, seg(c, 14)), body), k.mesh(k.cyl(0.5, 0.5, h * 0.5, seg(c, 14)), k.food(c.color), [0, 0, 0], [0, 0, 0], [1.0, 1, 1.0]), k.mesh(k.cyl(0.5, 0.5, h * 0.03, seg(c, 14)), body, [0, h * 0.485, 0]), k.mesh(k.cyl(0.5, 0.5, h * 0.03, seg(c, 14)), body, [0, -h * 0.485, 0])))
}

const bottle: Drawer = (c) => {
  const { k, h } = c
  const r = 0.5
  const profile: Array<[number, number]> = [[0, -h / 2], [r, -h / 2], [r, h * 0.12], [r * 0.45, h * 0.3], [r * 0.4, h * 0.4], [0, h * 0.4]]
  return across(c, k.G(k.mesh(k.lathe(profile, seg(c, 14)), k.glass(c.color, 0.6)), k.mesh(k.cyl(r * 0.42, r * 0.42, h * 0.1, seg(c, 10)), k.plastic(shade(c.color, 0.5)), [0, h * 0.45, 0])))
}

const jar: Drawer = (c) => {
  const { k, h } = c
  return across(c, k.G(k.mesh(k.cyl(0.5, 0.5, h * 0.82, seg(c, 14)), k.glass(c.color, 0.55), [0, -h * 0.09, 0]), k.mesh(k.cyl(0.5, 0.5, h * 0.18, seg(c, 14)), k.metal(0xb8913a), [0, h * 0.41, 0])))
}

const bag: Drawer = (c) => {
  const { k, w, h, d } = c
  return k.G(k.mesh(k.bx(w, h * 0.88, d), k.paper(c.color), [0, -h * 0.06, 0]), k.mesh(k.bx(w * 1.0, h * 0.12, d * 0.5), k.paper(shade(c.color, 0.85)), [0, h * 0.44, 0]), k.mesh(k.bx(w * 0.7, h * 0.3, d * 1.0), k.paper(shade(c.color, 1.2)), [0, 0, 0]))
}

const box: Drawer = (c) => {
  const { k, w, h, d } = c
  return k.G(k.mesh(k.bx(w, h, d), k.paper(c.color)), k.mesh(k.bx(w, h * 0.12, d), k.paper(shade(c.color, 0.8)), [0, h * 0.44, 0]), k.mesh(k.bx(w * 0.62, h * 0.4, d), k.paper(shade(c.color, 1.25)), [0, -h * 0.02, 0]))
}

const cloth: Drawer = (c) => {
  const { k, w, h, d } = c
  const material = k.cloth(c.color)
  return k.G(k.mesh(k.bx(w, h * 0.55, d), material, [0, -h * 0.225, 0]), k.mesh(k.bx(w * 0.96, h * 0.45, d * 0.96), k.cloth(shade(c.color, 0.9)), [0, h * 0.275, 0]))
}

const paper: Drawer = (c) => {
  const { k, w, h, d } = c
  const sheet = k.paper(c.color)
  return k.G(k.mesh(k.bx(w, h / 3, d), sheet, [0, -h / 3, 0]), k.mesh(k.bx(w * 0.98, h / 3, d * 0.98), k.paper(shade(c.color, 0.95)), [0, 0, 0]), k.mesh(k.bx(w, h / 3, d), sheet, [0, h / 3, 0]))
}

const fruit: Drawer = (c) => {
  const { k, w, h, d } = c
  const sphere = new k.T.SphereGeometry(0.5, seg(c, 12), seg(c, 8))
  return k.G(k.mesh(sphere, k.food(c.color), [0, -h * 0.04, 0], [0, 0, 0], [w, h * 0.92, d]), k.mesh(k.cyl(h * 0.02, h * 0.02, h * 0.1, 6), k.wood(0x5a3a22), [0, h * 0.45, 0]))
}

const dish: Drawer = (c) => {
  const { k, w, h, d } = c
  return k.G(k.mesh(k.cyl(0.5, 0.35, h, seg(c, 16)), k.plastic(c.color), [0, 0, 0], [0, 0, 0], [w, 1, d]))
}

const cup: Drawer = (c) => {
  const { k, w, h, d } = c
  const profile: Array<[number, number]> = [[0, -h / 2], [0.38, -h / 2], [0.5, h / 2], [0.44, h / 2], [0.33, -h / 2 + h * 0.06], [0, -h / 2 + h * 0.06]]
  return k.G(k.mesh(k.lathe(profile, seg(c, 14)), k.plastic(c.color), [0, 0, 0], [0, 0, 0], [w, 1, d]))
}

const tube: Drawer = (c) => {
  const { k, h } = c
  const material = k.plastic(c.color)
  return across(c, k.G(k.mesh(k.cyl(0.5, 0.42, h * 0.86, seg(c, 12)), material, [0, -h * 0.04, 0]), k.mesh(k.cyl(0.35, 0.35, h * 0.12, seg(c, 12)), k.plastic(shade(c.color, 0.6)), [0, h * 0.44, 0]), k.mesh(k.bx(1, h * 0.06, 0.25), material, [0, -h * 0.47, 0])))
}

const roll: Drawer = (c) => {
  const { k, w, h, d } = c
  // the roll lies with its axis along the shortest side; the other two sides are the (oval) section
  const body = k.G(k.mesh(k.cyl(0.5, 0.5, 1, seg(c, 18)), k.paper(c.color)), k.mesh(k.cyl(0.18, 0.18, 0.98, seg(c, 12)), k.paper(0xb59d78)))
  if (h <= w && h <= d) body.scale.set(w, h, d)
  else if (w <= d) {
    body.rotation.z = PI / 2
    body.scale.set(h, w, d)
  } else {
    body.rotation.x = PI / 2
    body.scale.set(w, d, h)
  }
  return k.G(body)
}

const shoe: Drawer = (c) => {
  const { k, w, h, d } = c
  const upper = k.cloth(c.color)
  return k.G(k.mesh(k.bx(w, h * 0.22, d), k.plastic(0x22251f), [0, -h * 0.39, 0]), k.mesh(k.bx(w * 0.42, h * 0.78, d * 0.96), upper, [-w * 0.29, h * 0.11, 0]), k.mesh(k.bx(w * 0.5, h * 0.5, d * 0.96), upper, [w * 0.25, -h * 0.03, 0]))
}

const tool: Drawer = alongLong((c, L, a, b) => {
  const { k } = c
  const radius = Math.max(0.004, Math.min(a, b) / 2)
  return k.G(k.mesh(k.cyl(radius, radius, L * 0.74, seg(c, 10)), k.wood(0x8a643c), [-L * 0.13, 0, 0], [0, 0, PI / 2]), k.mesh(k.bx(L * 0.26, a, b), k.metal(shade(c.color, 1)), [L * 0.37, 0, 0]))
})

const longTool: Drawer = alongLong((c, L, a, b) => {
  const { k } = c
  const radius = Math.max(0.004, Math.min(a, b) / 2) * 0.55
  return k.G(k.mesh(k.cyl(radius, radius, L * 0.94, seg(c, 10)), k.wood(0x9a7448), [0, 0, 0], [0, 0, PI / 2]), k.mesh(k.bx(L * 0.12, a, b), k.metal(c.color), [L * 0.44, 0, 0]))
})

const blade: Drawer = alongLong((c, L, a, b) => {
  const { k } = c
  const edge = Math.min(0.0002, b * 0.05)
  const steel = k.extrude([[0, 0], [L * 0.66, 0], [L * 0.68, a * 0.4], [0, a]], Math.max(0.0005, b * 0.4 - 2 * edge), edge)
  return k.G(k.mesh(steel, k.metal(0xa9adb0), [-L * 0.18, -a / 2, -b * 0.2 + edge]), k.mesh(k.bx(L * 0.34, a * 0.6, b), k.wood(0x3b2a20), [-L * 0.33, 0, 0]))
})

const garment: Drawer = (c) => {
  const { k, w, h, d } = c
  const material = k.cloth(c.color)
  return k.G(k.mesh(k.bx(w * 0.56, h, d), material), k.mesh(k.bx(w * 0.22, h * 0.42, d * 0.9), material, [-w * 0.39, h * 0.29, 0]), k.mesh(k.bx(w * 0.22, h * 0.42, d * 0.9), material, [w * 0.39, h * 0.29, 0]))
}

const backpack: Drawer = (c) => {
  const { k, w, h, d } = c
  const material = k.cloth(c.color)
  const dome = new k.T.SphereGeometry(0.5, seg(c, 12), seg(c, 6), 0, PI * 2, 0, PI / 2)
  const strap = k.cloth(shade(c.color, 0.6))
  return k.G(k.mesh(k.bx(w, h * 0.78, d * 0.68), material, [0, -h * 0.11, -d * 0.14]), k.mesh(dome, material, [0, h * 0.28, -d * 0.14], [0, 0, 0], [w, h * 0.22, d * 0.68]), k.mesh(k.bx(w * 0.7, h * 0.4, d * 0.3), k.cloth(shade(c.color, 0.75)), [0, -h * 0.18, d * 0.35]), k.mesh(k.bx(w * 0.1, h * 0.7, d * 0.04), strap, [-w * 0.25, -h * 0.05, -d * 0.48]), k.mesh(k.bx(w * 0.1, h * 0.7, d * 0.04), strap, [w * 0.25, -h * 0.05, -d * 0.48]))
}

const jerrycan: Drawer = (c) => {
  const { k, w, h, d } = c
  const material = k.plastic(c.color)
  return k.G(k.mesh(k.bx(w, h * 0.86, d), material, [0, -h * 0.07, 0]), k.mesh(k.bx(w * 0.4, h * 0.1, d * 0.5), material, [-w * 0.2, h * 0.45, 0]), k.mesh(k.cyl(d * 0.14, d * 0.18, h * 0.12, seg(c, 10)), k.plastic(0xd9a441), [w * 0.3, h * 0.44, 0]))
}

const tank: Drawer = (c) => {
  const { k, h } = c
  const r = 0.5
  const profile: Array<[number, number]> = [[0, -h / 2], [r * 0.9, -h / 2], [r, -h * 0.4], [r, h * 0.22], [r * 0.6, h * 0.36], [r * 0.2, h * 0.4], [0, h * 0.4]]
  const metal = k.metal(c.color)
  return across(c, k.G(k.mesh(k.lathe(profile, seg(c, 14)), metal), k.mesh(k.cyl(r * 0.62, r * 0.62, h * 0.05, seg(c, 14)), metal, [0, h * 0.3, 0]), k.mesh(k.cyl(r * 0.18, r * 0.18, h * 0.12, seg(c, 8)), k.metal(0xb8913a), [0, h * 0.44, 0])))
}

const book: Drawer = (c) => {
  const { k, w, h, d } = c
  const cover = k.paper(c.color)
  return k.G(k.mesh(k.bx(w, h, d * 0.14), cover, [0, 0, d * 0.43]), k.mesh(k.bx(w, h, d * 0.14), cover, [0, 0, -d * 0.43]), k.mesh(k.bx(w * 0.94, h * 0.96, d * 0.72), k.paper(0xe9e1cc), [w * 0.02, 0, 0]), k.mesh(k.bx(w * 0.08, h, d), k.paper(shade(c.color, 0.8)), [-w * 0.46, 0, 0]))
}

const key: Drawer = alongLong((c, L, a, b) => {
  const { k } = c
  const metal = k.metal(0xb8913a)
  const ring = a * 0.5
  const tube = Math.min(b * 0.4, ring * 0.2)
  return k.G(k.mesh(new c.k.T.TorusGeometry(ring * 0.8, tube, 5, seg(c, 10)), k.metal(0x9a9da0), [-L / 2 + ring * 0.8 + tube, 0, 0]), k.mesh(k.bx(L * 0.62, a * 0.28, b), metal, [L * 0.12, 0, 0]), k.mesh(k.bx(L * 0.08, a * 0.22, b), metal, [L * 0.36, -a * 0.2, 0]), k.mesh(k.bx(L * 0.06, a * 0.22, b), metal, [L * 0.2, -a * 0.2, 0]))
})

const battery: Drawer = alongLong((c, L, a, b) => {
  const { k } = c
  const r = Math.min(a, b) / 2
  return k.G(k.mesh(k.cyl(r, r, L * 0.94, seg(c, 14)), k.metal(c.color), [0, 0, 0], [0, 0, PI / 2]), k.mesh(k.cyl(r * 0.36, r * 0.36, L * 0.06, seg(c, 8)), k.metal(0xb9bdc0), [L * 0.47, 0, 0], [0, 0, PI / 2]))
})

const plank: Drawer = alongLong((c, L, a, b) => {
  const { k } = c
  const nail = k.metal(0x7d8186)
  return k.G(k.mesh(k.bx(L, a, b), k.wood(0xa88459)), k.mesh(k.cyl(Math.min(a, b) * 0.1, Math.min(a, b) * 0.1, b * 0.98, 6), nail, [-L * 0.4, 0, 0], [PI / 2, 0, 0]), k.mesh(k.cyl(Math.min(a, b) * 0.1, Math.min(a, b) * 0.1, b * 0.98, 6), nail, [L * 0.4, 0, 0], [PI / 2, 0, 0]))
})

const device: Drawer = (c) => {
  const { k, w, h, d } = c
  const screen = k.M(0x9fbf8a, 'glass', { emissive: 0x2f4a22, emissiveIntensity: 0.6, roughness: 0.2 })
  return k.G(k.mesh(k.bx(w, h, d * 0.96), k.plastic(c.color), [0, 0, -d * 0.02]), k.mesh(k.bx(w * 0.7, h * 0.32, d * 0.06), screen, [0, h * 0.22, d * 0.47]), k.mesh(k.cyl(Math.min(w, h) * 0.08, Math.min(w, h) * 0.08, d * 0.1, seg(c, 8)), k.metal(0xb9bdc0), [w * 0.25, -h * 0.18, d * 0.45], [PI / 2, 0, 0]))
}

const DRAWERS: Readonly<Record<ShapeId, Drawer>> = {
  can, bag, box, bottle, tool, roll, dish, cloth, shoe, jar, paper, fruit, cup, tube, blade, long_tool: longTool, garment, backpack, jerrycan, tank, book, key, battery, plank, device,
}

export const isShape = (value: string | undefined): value is ShapeId => value !== undefined && value in DRAWERS

/** The item fields the shape choice reads. */
export interface ShapeSubject {
  category: string
  size: Vec3Tuple
  shape?: string
  color?: number
}

/**
 * The shape an item is drawn with: its own `shape` when it names one of the 25, else a box. The hints the household catalog uses (`tool`, `cloth`, `bag`, `box`, `paper`) are
 * refined by the category and the proportions, so that a rake is a long tool, a jacket a garment, a rucksack a backpack, a phone a device and a diary a book.
 */
export function shapeOf(subject: ShapeSubject): ShapeId {
  const hint = subject.shape
  if (!isShape(hint)) return 'box'
  const [w, h, d] = subject.size
  const { L, a, b } = canonicalFrame(subject.size)
  const long = L / Math.max(a, b, 1e-6) >= 4
  const flat = Math.min(w, h, d) / Math.max(w, h, d) <= 0.2
  switch (hint) {
    case 'tool':
      if (subject.category === 'keys') return 'key'
      if (subject.category === 'electronics') return 'device'
      if (long) return subject.category === 'melee' && Math.min(a, b) / L <= 0.1 && flat ? 'blade' : 'long_tool'
      return hint
    case 'cloth':
      return subject.category === 'clothing' ? 'garment' : hint
    case 'bag':
      return subject.category === 'bags' ? 'backpack' : hint
    case 'box':
      if (subject.category === 'electronics') return 'device'
      if (subject.category === 'books') return 'book'
      if (subject.category === 'keys') return 'key'
      return hint
    case 'paper':
      return subject.category === 'books' ? 'book' : hint
    default:
      return hint
  }
}

/** Draws the simple shape of an item at its real size, centred on the origin (the long side of long shapes lies on the long axis of `size`). */
export function drawShape(k: ItemKit, shape: ShapeId, size: Vec3Tuple, options: { color?: number; detail?: number } = {}): THREE_NS.Group {
  const [w, h, d] = size
  return DRAWERS[shape]({ k, w, h, d, color: options.color ?? DEFAULT_COLOR, detail: options.detail ?? 1 })
}
