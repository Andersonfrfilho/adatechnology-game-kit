import { createWorld, fitsSlot } from '@adatechnology/game-interactables'
import type { ItemStack, World } from '@adatechnology/game-interactables'
import { createHousehold } from '@adatechnology/game-interactables-household'
import { createContentsView, createMeshApi } from '@adatechnology/game-interactables-three'
import { GOODS_ITEMS } from '@adatechnology/game-items-goods'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createContainedItemModel } from '../src'

// Every piece of household furniture with a door, lid or drawer in front of its contents: the items are the catalogue's real items, there from the first frame
// the part moves, riding it (a drawer slides them out, a door shelf swings them), and hidden only once it is shut again.
const hh = createHousehold({ region: 'br', locale: 'pt-BR' })
const itemModel = createContainedItemModel(GOODS_ITEMS)
const withModel = new Set(GOODS_ITEMS.filter((i) => i.model !== undefined).map((i) => i.id))

interface Furnished {
  world: World
  root: THREE.Object3D
  /** Each container with an access part and the stacks put in it. */
  filled: Array<{ container: string; access: string; slots: number[] }>
}

/** One piece of furniture, its containers emptied and then filled with the first catalogue items that fit, shut. */
function furnish(type: string): Furnished {
  const world = createWorld({ locale: 'pt-BR', strings: hh.strings, items: hh.items, loot: hh.loot, seed: 4 })
  const mesh = createMeshApi(THREE)
  const spec = hh.build(type, { seed: 4 }, mesh.api)
  const { group } = mesh.finish(spec)
  world.add(type, spec, { x: 0, y: 0, z: 0, ry: 0 })
  const filled: Furnished['filled'] = []
  for (const c of spec.containers ?? []) {
    if (!c.access) continue
    world.setPart(type, c.access, 1, true)
    world.contents(type, c.id).forEach((stack, slot) => {
      if (stack) world.take(type, c.id, slot)
    })
    const slots: number[] = []
    for (const def of Object.values(hh.items)) {
      if (slots.length >= 2) break
      if (!c.slots.some((s) => fitsSlot(def.id, s, hh.items))) continue
      const slot = world.put(type, c.id, { type: def.id, qty: 1 })
      if (slot !== null && !slots.includes(slot)) slots.push(slot)
    }
    world.setPart(type, c.access, 0, true)
    if (slots.length) filled.push({ container: c.id, access: c.access, slots })
  }
  return { world, root: group, filled }
}

/** The household types whose containers sit behind a part. */
const TYPES = hh.types
  .map((t) => t.id)
  .filter((type) => {
    const probe = createMeshApi(THREE)
    return (hh.build(type, { seed: 4 }, probe.api).containers ?? []).some((c) => c.access !== undefined)
  })

function shown(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false
  return true
}

describe('contained items: real catalogue models, riding their drawer or door from the first frame', () => {
  it('covers drawers, wardrobes, cupboards and the fridge (the microwave and the oven hold nothing in the household catalogue)', () => {
    for (const type of ['dresser', 'nightstand', 'wardrobe', 'kitchen_cabinet_base', 'kitchen_cabinet_wall', 'pantry', 'fridge']) expect(TYPES, type).toContain(type)
  })

  it.each(TYPES)('%s', (type) => {
    const { world, root, filled } = furnish(type)
    expect(filled.length, `${type} holds something`).toBeGreaterThan(0)
    const view = createContentsView(THREE, { world, objectId: type, root, buildItem: itemModel })
    view.sync()
    for (const { container, access, slots } of filled) {
      const stacks = world.contents(type, container)
      const offsets = new Map<number, THREE.Vector3>()
      const check = (phase: string, visible: boolean): void => {
        view.sync()
        root.updateMatrixWorld(true)
        const drawn = view.items().filter((i) => i.container === container)
        expect(drawn.length, `${type}/${container} ${phase}: drawn`).toBe(slots.length)
        for (const slot of slots) {
          const item = drawn.find((i) => i.slot === slot)
          const stack = stacks[slot] as ItemStack
          expect(item, `${phase}: slot ${slot}`).toBeDefined()
          if (!item) continue
          expect(shown(item.object), `${type}/${container} ${phase}: slot ${slot} shown`).toBe(visible)
          const drew = item.object.userData.item as { id: string; kind: string }
          expect(drew.id, `${phase}: the stack's own item`).toBe(stack.type)
          if (withModel.has(stack.type)) expect(drew.kind, `${stack.type} is the team's model`).toBe('model')
          let meshes = 0
          item.object.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) meshes++
          })
          expect(meshes, `${stack.type} has a drawing`).toBeGreaterThan(0)
          const at = item.object.getWorldPosition(new THREE.Vector3())
          const want = world.slotPosition(type, container, slot)
          const offset = at.clone().sub(new THREE.Vector3(want[0], want[1], want[2]))
          expect(offset.length(), `${type}/${container} ${phase}: slot ${slot} on the part`).toBeLessThan(1e-3)
          const first = offsets.get(slot)
          if (first) expect(offset.distanceTo(first), `${phase}: constant offset to the part`).toBeLessThan(1e-3)
          else offsets.set(slot, offset)
        }
      }
      check('closed', false)
      world.setPart(type, access, 1)
      for (const f of [0.25, 0.5]) {
        while (world.partT(type, access) < f) world.update(1 / 240)
        expect(world.partT(type, access)).toBeLessThan(1)
        check(`opening ${f}`, true)
      }
      while (world.partT(type, access) < 1) world.update(1 / 60)
      check('open', true)
      world.setPart(type, access, 0)
      while (world.partT(type, access) > 0.5) world.update(1 / 240)
      check('closing 0.5', true)
      while (world.partT(type, access) > 0) world.update(1 / 60)
      check('shut', false)
    }
    view.dispose()
    expect(root.getObjectByName(`contents:${type}`)).toBeUndefined()
  })
})
