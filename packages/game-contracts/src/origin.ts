/**
 * Where a drawn object comes from. Every builder of the kit that draws a piece (a car of the fleet, a house or a wall, a piece of furniture, a person, an
 * animal, a plant, an item, a weapon) marks the root it returns, and every renderer that draws for the room (effects, debris, liquids, the room itself)
 * marks its own roots, so a host can tell a piece of the kit from something drawn on the spot. Duck-typed on three.js objects (`userData`, `parent`,
 * `children`), so the contracts stay free of three.js.
 */
export const KIT_ORIGIN_KEY = 'kitOrigin'

/** What drew an object: the package and the kind of piece (`vehicle`, `structure`, `furniture`, `person`... or `effect`, `room` for what is not a piece). */
export interface KitOrigin {
  readonly owner: string
  readonly kind: string
  /** The catalogue id of the piece, when it has one. */
  readonly id?: string
  /** Drawn as a simple stand-in shape because the kit has no model of the piece yet (an item with no team model): a model still to make. */
  readonly standIn?: boolean
}

interface Node {
  userData?: Record<string, unknown>
  parent?: Node | null
  children?: readonly Node[]
  name?: string
  visible?: boolean
  isMesh?: boolean
  isPoints?: boolean
  isLine?: boolean
  isSprite?: boolean
}

/** Marks `object` as drawn by `origin.owner` and returns it. */
export function markKitOrigin<T>(object: T, origin: KitOrigin): T {
  const node = object as unknown as Node
  node.userData = node.userData ?? {}
  node.userData[KIT_ORIGIN_KEY] = { ...origin }
  return object
}

/** The origin of the object or of its nearest marked ancestor; null when nothing up the tree is marked. */
export function kitOriginOf(object: unknown): KitOrigin | null {
  for (let node = object as Node | null | undefined; node; node = node.parent) {
    const origin = node.userData?.[KIT_ORIGIN_KEY] as KitOrigin | undefined
    if (origin && typeof origin.owner === 'string') return origin
  }
  return null
}

/** A drawn thing that no builder of the kit marked: what was drawn on the spot. */
export interface UnmarkedDrawing {
  /** The names of the object and its named ancestors, outermost first. */
  readonly path: string
  readonly object: unknown
}

/** Every visible mesh, line, point cloud or sprite under `root` with no marked ancestor (`root` itself not counted as one). */
export function unmarkedDrawings(root: unknown): UnmarkedDrawing[] {
  const out: UnmarkedDrawing[] = []
  const pathOf = (node: Node): string => {
    const names: string[] = []
    for (let n: Node | null | undefined = node; n && n !== root; n = n.parent) if (n.name) names.push(n.name)
    return names.reverse().join(' > ') || '(no name)'
  }
  const walk = (node: Node, marked: boolean): void => {
    if (node.visible === false) return
    const here = marked || (node !== root && Boolean((node.userData?.[KIT_ORIGIN_KEY] as KitOrigin | undefined)?.owner))
    if (!here && (node.isMesh || node.isPoints || node.isLine || node.isSprite)) out.push({ path: pathOf(node), object: node })
    for (const child of node.children ?? []) walk(child, here)
  }
  walk(root as Node, false)
  return out
}
