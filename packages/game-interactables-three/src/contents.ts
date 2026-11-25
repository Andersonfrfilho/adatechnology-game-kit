import type { ItemStack, PartSpec, World } from '@adatechnology/game-interactables'
import { discardObject3D } from '@adatechnology/game-shapes-three'

import { applyPose } from './pose'
import type { ThreeLib, ThreeNS } from './types'

/** Draws one stack as the real item with the host's `THREE`: origin at the bottom centre, y up, metres (`createContainedItemModel` of `game-items-three`). Null draws nothing. */
export type ContentsItemBuilder = (stack: ItemStack, THREE: ThreeLib) => ThreeNS.Object3D | null

export interface ContentsViewOptions {
  world: World
  objectId: string
  /** The object's group, in the object-local frame (the `group` of `createMeshApi().finish`). The contents hang under it. */
  root: ThreeNS.Object3D
  /** The real model of each stack; the host injects it (the items catalogue's renderer), so this package never draws a stand-in. */
  buildItem: ContentsItemBuilder
}

/** One drawn stack. */
export interface ContentsViewItem {
  readonly container: string
  readonly slot: number
  readonly type: string
  readonly object: ThreeNS.Object3D
}

/** The items in an object's containers, drawn and moving with the part their slot rides on. */
export interface ContentsView {
  /** The group under `root` that holds every item. */
  readonly group: ThreeNS.Group
  /**
   * Brings the drawing in line with the world: draws the stacks that arrived, discards the ones taken, poses each slot's part at its current t and shows a
   * container from the first instant its access part leaves 0 (closed, it is hidden). Call it when the object is built and on every frame one of its parts moves.
   */
  sync(): void
  items(): ContentsViewItem[]
  /** Discards every item (`discardObject3D`) and the group. */
  dispose(): void
}

interface Drawn {
  type: string
  object: ThreeNS.Object3D
}

/**
 * The contents of an object's containers as real items. Each slot on a part (a drawer, a door shelf) hangs under a carrier posed with the engine's own pose of
 * that part, so the items slide or swing with it from the first frame of the motion and `world.slotPosition` always agrees; nothing is built when the motion ends.
 */
export function createContentsView(THREE: ThreeLib, options: ContentsViewOptions): ContentsView {
  const { world, objectId, root, buildItem } = options
  const group = new THREE.Group()
  group.name = `contents:${objectId}`
  root.add(group)
  const carriers = new Map<string, ThreeNS.Group>()
  const drawn = new Map<string, Drawn>()
  const spec = world.get(objectId)?.spec
  const partsById = new Map<string, PartSpec>((spec?.parts ?? []).map((p) => [p.id, p]))

  const carrierOf = (partId: string | undefined): ThreeNS.Object3D => {
    const part = partId === undefined ? undefined : partsById.get(partId)
    if (!part) return group
    let carrier = carriers.get(part.id)
    if (!carrier) {
      carrier = new THREE.Group()
      carrier.name = `contents:${part.id}`
      carrier.position.set(part.pivot[0], part.pivot[1], part.pivot[2])
      carrier.rotation.set(0, part.ry ?? 0, 0)
      group.add(carrier)
      carriers.set(part.id, carrier)
    }
    return carrier
  }

  const place = (object: ThreeNS.Object3D, carrier: ThreeNS.Object3D, pos: readonly [number, number, number], part: PartSpec | undefined): void => {
    carrier.add(object)
    if (!part) {
      object.position.set(pos[0], pos[1], pos[2])
      return
    }
    // object-local point at rest -> the carrier's rest frame (pivot at the origin, turned by ry)
    const ry = part.ry ?? 0
    const x = pos[0] - part.pivot[0]
    const z = pos[2] - part.pivot[2]
    const c = Math.cos(ry)
    const s = Math.sin(ry)
    object.position.set(c * x - s * z, pos[1] - part.pivot[1], s * x + c * z)
    object.rotation.set(0, -ry, 0)
  }

  function sync(): void {
    const live = new Set<string>()
    for (const c of spec?.containers ?? []) {
      const shown = c.access === undefined || world.partT(objectId, c.access) > 0
      const stacks = world.contents(objectId, c.id)
      c.slots.forEach((slot, i) => {
        const stack = stacks[i]
        const key = `${c.id}#${i}`
        const had = drawn.get(key)
        if (had && (!stack || stack.type !== had.type)) {
          discardObject3D(had.object)
          drawn.delete(key)
        }
        if (!stack) return
        live.add(key)
        let now = drawn.get(key)
        if (!now) {
          const object = buildItem(stack, THREE)
          if (!object) return
          object.name = `contents_${c.id}_${i}`
          object.userData.contents = { object: objectId, container: c.id, slot: i, item: stack.type, qty: stack.qty }
          place(object, carrierOf(slot.part), slot.pos, slot.part === undefined ? undefined : partsById.get(slot.part))
          now = { type: stack.type, object }
          drawn.set(key, now)
        }
        now.object.visible = shown
      })
    }
    for (const [key, d] of drawn) {
      if (live.has(key)) continue
      discardObject3D(d.object)
      drawn.delete(key)
    }
    for (const [partId, carrier] of carriers) {
      const part = partsById.get(partId)
      if (part) applyPose(THREE, carrier, part.motion, world.partT(objectId, partId))
    }
  }

  return {
    group,
    sync,
    items: () =>
      [...drawn].map(([key, d]) => {
        const cut = key.lastIndexOf('#')
        return { container: key.slice(0, cut), slot: Number(key.slice(cut + 1)), type: d.type, object: d.object }
      }),
    dispose() {
      discardObject3D(group)
      drawn.clear()
      carriers.clear()
    },
  }
}
