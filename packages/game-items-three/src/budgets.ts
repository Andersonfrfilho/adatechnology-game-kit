import type * as THREE_NS from 'three'

export type Vec3Like = readonly [number, number, number]

/** The draw budgets of the Itens do Vale Cinzento page (section "Desempenho com hordas"). */
export interface ItemBudgets {
  /** Draw calls of all the items in a frame. */
  drawCalls: number
  /** A small item: at most this many triangles, and it disappears at `cullDistance`. */
  small: { triangles: number; cullDistance: number }
  /** A large item. */
  large: { triangles: number; cullDistance: number }
  /** The second level of detail has this share of the triangles of the first. */
  lod1Ratio: number
  /** Longest side (m) from which an item counts as large: the page does not say where small ends, so this is the kit's reading and a game can change it. */
  largeFrom: number
}

export const ITEM_BUDGETS: ItemBudgets = {
  drawCalls: 30,
  small: { triangles: 400, cullDistance: 30 },
  large: { triangles: 1200, cullDistance: 60 },
  lod1Ratio: 0.5,
  largeFrom: 0.6,
}

export type ItemSizeClass = 'small' | 'large'

export const sizeClassOf = (size: Vec3Like, budgets: ItemBudgets = ITEM_BUDGETS): ItemSizeClass => (Math.max(...size) >= budgets.largeFrom ? 'large' : 'small')

export const triangleBudgetOf = (size: Vec3Like, budgets: ItemBudgets = ITEM_BUDGETS): number => budgets[sizeClassOf(size, budgets)].triangles

export const cullDistanceOf = (size: Vec3Like, budgets: ItemBudgets = ITEM_BUDGETS): number => budgets[sizeClassOf(size, budgets)].cullDistance

/** Triangles under `root`: visible meshes only, indexed or not. */
export function countTriangles(root: THREE_NS.Object3D): number {
  let total = 0
  root.traverse((object) => {
    const mesh = object as THREE_NS.Mesh
    if (!mesh.isMesh || !mesh.visible) return
    const geometry = mesh.geometry
    total += geometry.index ? geometry.index.count / 3 : geometry.getAttribute('position').count / 3
  })
  return Math.round(total)
}

/** Draw calls under `root`: one per visible mesh (a mesh with a material list counts once per group). */
export function countDrawCalls(root: THREE_NS.Object3D): number {
  let total = 0
  root.traverse((object) => {
    const mesh = object as THREE_NS.Mesh
    if (!mesh.isMesh || !mesh.visible) return
    total += Array.isArray(mesh.material) ? Math.max(1, mesh.geometry.groups.length) : 1
  })
  return total
}

export interface BudgetReport {
  triangles: number
  limit: number
  drawCalls: number
  sizeClass: ItemSizeClass
  ok: boolean
}

/** How an item's model measures against its triangle budget (a model of the team above it is a known deviation, not an error). */
export function checkBudget(root: THREE_NS.Object3D, size: Vec3Like, budgets: ItemBudgets = ITEM_BUDGETS): BudgetReport {
  const triangles = countTriangles(root)
  const limit = triangleBudgetOf(size, budgets)
  return { triangles, limit, drawCalls: countDrawCalls(root), sizeClass: sizeClassOf(size, budgets), ok: triangles <= limit }
}
