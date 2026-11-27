/**
 * What is inside a piece of furniture (`userData.contents` of a drawn stack: a carton of milk on the shelf of an open fridge) taken with the hand: the eye looks into the
 * open piece, the aim lands on the stack and E takes it, before the door it stands behind is worked. A stack behind a shut door is not drawn (`visible` false) and is not
 * taken. The stack leaves the shelf and becomes an object of the world in the hand (`ModuleHost.takeInHand`), weighed and measured by its catalogue entry when the room has
 * one.
 */
import type * as THREE_NS from 'three'
import type { CarryHands, HostTakenItem, Vec3 } from '@adatechnology/game-contracts'
import { interactionHandsFor } from '@adatechnology/game-player'

/** What `userData.contents` of a drawn stack says: the catalogue id of the item and how many. */
export interface ContentsTag {
  readonly item: string
  readonly qty?: number
}

export interface ContentsHit {
  /** The drawn stack (the node that carries `userData.contents`). */
  readonly node: THREE_NS.Object3D
  readonly tag: ContentsTag
  /** Where the aim landed on it, world space. */
  readonly point: Vec3
  readonly distance: number
}

/** How far the hand reaches for something to take (m): the aim of E. */
export const GRAB_REACH = 3.2

const tagOf = (node: THREE_NS.Object3D | null): { node: THREE_NS.Object3D; tag: ContentsTag } | null => {
  for (let at = node; at; at = at.parent) {
    const tag = at.userData?.contents as ContentsTag | undefined
    if (tag && typeof tag.item === 'string') return { node: at, tag }
  }
  return null
}

const shown = (node: THREE_NS.Object3D): boolean => {
  for (let at: THREE_NS.Object3D | null = node; at; at = at.parent) if (!at.visible) return false
  return true
}

/** The nearest drawn stack of `root` the aim lands on within `max` metres, or null. */
export function aimedContents(THREE: typeof THREE_NS, root: THREE_NS.Object3D, origin: Vec3, direction: Vec3, max: number): ContentsHit | null {
  const ray = new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction).normalize(), 0, max)
  root.updateMatrixWorld(true)
  for (const hit of ray.intersectObject(root, true)) {
    if (!shown(hit.object)) continue
    const found = tagOf(hit.object)
    if (found) return { ...found, point: [hit.point.x, hit.point.y, hit.point.z], distance: hit.distance }
  }
  return null
}

/** A catalogue entry of the room for a stack: the id itself, or the room's entry that ends with it (`item_milk_carton` for `milk_carton`). */
export interface ContentsCatalogEntry {
  readonly id: string
  readonly name: string
  readonly physical?: { readonly weightKg: number; readonly size: readonly [number, number, number] }
}

/**
 * The stack as an item handed to the player: drawn as it stood on the shelf (a copy sharing its geometry), at the point taken, with the hands its weight and size take.
 * The drawn stack leaves the shelf (it is in the hand now); its geometry stays, the copy draws with it.
 */
export function takeContents(THREE: typeof THREE_NS, hit: ContentsHit, entry: ContentsCatalogEntry | undefined): HostTakenItem {
  const box = new THREE.Box3().setFromObject(hit.node)
  const size = box.getSize(new THREE.Vector3())
  const at = box.getCenter(new THREE.Vector3())
  const physical = entry?.physical
  const hands: CarryHands = interactionHandsFor({ massKg: physical?.weightKg ?? 0.5, size: physical?.size ?? [size.x, size.y, size.z] })
  const drawn = hit.node.clone(true)
  drawn.position.set(0, 0, 0)
  drawn.rotation.set(0, 0, 0)
  drawn.scale.copy(hit.node.getWorldScale(new THREE.Vector3()))
  delete drawn.userData.contents
  // eslint-disable-next-line kit/no-bare-remove -- its geometry and materials draw on in the copy in the hand; the room releases them when that object leaves
  hit.node.removeFromParent()
  return {
    itemId: entry?.id ?? hit.tag.item,
    name: entry?.name ?? hit.tag.item,
    position: [at.x, box.min.y, at.z],
    build: () => drawn.clone(true),
    hands,
    ...(physical ? { physical: { weightKg: physical.weightKg, size: [physical.size[0], physical.size[1], physical.size[2]] } } : {}),
  }
}

/** What the room lends the hand that takes from inside a piece. */
export interface ContentsHandHost {
  readonly THREE: typeof THREE_NS
  /** The aim now: origin and direction. */
  aim(): { readonly origin: Vec3; readonly direction: Vec3 }
  /** The world object the aim lands on first within `max` metres, with its drawing. */
  aimed(origin: Vec3, direction: Vec3, max: number): { readonly objectId: string; readonly root: THREE_NS.Object3D } | null
  /** The room's catalogue entry for a stack's item id, if it has one. */
  entryOf(item: string): ContentsCatalogEntry | undefined
  /** The stack is out of the piece: the room logs it and the hand closes on it. */
  taken(item: HostTakenItem, objectId: string): boolean
}

/** E on a stack inside a piece: it leaves the shelf and comes to the hand. False with none where the aim lands. */
export function createContentsHand(host: ContentsHandHost): () => boolean {
  return () => {
    const { origin, direction } = host.aim()
    const aimed = host.aimed(origin, direction, GRAB_REACH)
    const hit = aimed ? aimedContents(host.THREE, aimed.root, origin, direction, GRAB_REACH) : null
    if (!aimed || !hit) return false
    return host.taken(takeContents(host.THREE, hit, host.entryOf(hit.tag.item)), aimed.objectId)
  }
}
