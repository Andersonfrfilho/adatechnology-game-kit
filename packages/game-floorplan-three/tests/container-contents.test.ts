import * as GameInteractables from '@adatechnology/game-interactables'
import type { ItemStack } from '@adatechnology/game-interactables'
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import * as GameInteractablesThree from '@adatechnology/game-interactables-three'
import { describe, expect, it } from 'vitest'

import type { House, HouseInteractives } from '../src'
import { THREE, houseOf, planOf } from './helpers/houses'

// The contents of a piece of furniture are there, in their real model, from the first frame its drawer or door moves, and ride the drawer: nothing pops in at
// full open, nothing is a coloured box. The item model is injected (game-items-three draws it in the room; here a marked group stands in for that renderer).
const REAL = 'real-item'
const itemModel = (stack: ItemStack, T: typeof THREE): THREE.Object3D => {
  const root = new T.Group()
  const mesh = new T.Mesh(new T.BoxGeometry(0.05, 0.05, 0.05), new T.MeshStandardMaterial())
  mesh.name = REAL
  mesh.userData.realItem = stack.type
  root.add(mesh)
  return root
}
const kit = { GameInteractables, GameInteractablesHousehold, GameInteractablesThree, itemModel }
/** Furniture with contents behind a drawer (slide) or a door (hinge), as the townhouse plan holds them. */
const CASES: ReadonlyArray<{ type: string; container: string }> = [
  { type: 'dresser', container: 'drawer_1' },
  { type: 'nightstand', container: 'drawer' },
  { type: 'kitchen_cabinet_base', container: 'drawer' },
  { type: 'kitchen_cabinet_base', container: 'cupboard' },
  { type: 'wardrobe', container: 'drawer_1' },
  { type: 'wardrobe', container: 'shelves' },
  { type: 'fridge', container: 'fridge' },
  { type: 'pantry', container: 'shelves' },
  { type: 'bathroom_cabinet', container: 'cabinet' },
]

type V3 = [number, number, number]

function build(): { house: House; iv: HouseInteractives } {
  const { house } = houseOf(planOf('sobrado', 3), { interactives: kit })
  const iv = house.interactives
  if (!iv) throw new Error('no interactives')
  return { house, iv }
}

/** The first object of `type` whose `container` holds something. */
function pick(iv: HouseInteractives, type: string, container: string): { id: string; access: string; stacks: Array<ItemStack | null> } {
  for (const E of iv.entries.values()) {
    if (E.type !== type) continue
    const c = E.spec.containers?.find((x) => x.id === container)
    const stacks = iv.world.contents(E.id, container)
    if (c?.access && stacks.some((s) => s !== null)) return { id: E.id, access: c.access, stacks }
  }
  throw new Error(`no ${type}/${container} with contents`)
}

function shownInScene(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false
  return true
}

/** What the house draws for the contents of one container: every object tagged with it, and whether a merged box batch (`iv-items`) exists. */
function drawnOf(house: House, objectId: string, container: string): { items: THREE.Object3D[]; boxes: boolean } {
  const items: THREE.Object3D[] = []
  let boxes = false
  house.group.traverse((o) => {
    if (o.name === 'iv-items') boxes = true
    const tag = o.userData.contents as { object?: string; container?: string } | undefined
    if (tag?.object === objectId && tag.container === container) items.push(o)
  })
  return { items, boxes }
}

/** Steps the house until the part passes `t` (opening) or falls under it (closing). */
function stepTo(house: House, iv: HouseInteractives, id: string, part: string, t: number, opening: boolean): number {
  for (let i = 0; i < 600; i++) {
    const now = iv.world.partT(id, part)
    if (opening ? now >= t : now <= t) return now
    house.update(1 / 120)
  }
  throw new Error(`${id}.${part} never reached ${t}`)
}

/** House-local position of an object (the frame `world.slotPosition` answers in). */
function local(house: House, o: THREE.Object3D): V3 {
  house.group.updateMatrixWorld(true)
  const p = o.getWorldPosition(new THREE.Vector3())
  house.house.worldToLocal(p)
  return [p.x, p.y, p.z]
}

describe('contents of furniture follow their drawer or door from the first frame (no pop-in, no coloured boxes)', () => {
  it.each(CASES)('$type/$container', ({ type, container }) => {
    const { house, iv } = build()
    const { id, access, stacks } = pick(iv, type, container)
    const filled = stacks.flatMap((s, slot) => (s ? [{ slot, type: s.type }] : []))
    iv.world.setPart(id, access, 1)
    const offsets = new Map<number, V3>()
    const check = (phase: string, expectShown: boolean): void => {
      const { items, boxes } = drawnOf(house, id, container)
      expect(boxes, `${phase}: a merged box batch is drawn`).toBe(false)
      expect(items.length, `${phase}: items drawn`).toBe(filled.length)
      for (const { slot, type: itemType } of filled) {
        const item = items.find((o) => (o.userData.contents as { slot: number }).slot === slot)
        expect(item, `${phase}: slot ${slot}`).toBeDefined()
        if (!item) continue
        expect(shownInScene(item), `${phase}: slot ${slot} shown`).toBe(expectShown)
        const real = item.getObjectByName(REAL)
        expect(real?.userData.realItem, `${phase}: slot ${slot} is the real model of the stack`).toBe(itemType)
        const at = local(house, item)
        const slotAt = iv.world.slotPosition(id, container, slot)
        const offset: V3 = [at[0] - slotAt[0], at[1] - slotAt[1], at[2] - slotAt[2]]
        const first = offsets.get(slot)
        if (!first) offsets.set(slot, offset)
        else for (let k = 0; k < 3; k++) expect(Math.abs(offset[k] - first[k]), `${phase}: slot ${slot} keeps its offset to the part`).toBeLessThan(1e-3)
        for (let k = 0; k < 3; k++) expect(Math.abs(offset[k]), `${phase}: slot ${slot} sits on its slot`).toBeLessThan(1e-3)
      }
    }
    for (const f of [0.25, 0.5]) {
      const t = stepTo(house, iv, id, access, f, true)
      expect(t, `still opening at ${f}`).toBeLessThan(1)
      check(`opening ${f}`, true)
    }
    stepTo(house, iv, id, access, 1, true)
    check('open', true)
    iv.world.setPart(id, access, 0)
    const back = stepTo(house, iv, id, access, 0.5, false)
    expect(back).toBeGreaterThan(0)
    check('closing 0.5', true)
    stepTo(house, iv, id, access, 0, false)
    check('closed', false)
  })
})

describe('items inside an open wardrobe are picked up one by one, with one hand', () => {
  it('a garment and a pair of shoes come out of the wardrobe and leave the drawing', () => {
    const { house, iv } = build()
    const { id, access } = pick(iv, 'wardrobe', 'shelves')
    const drawerOf = pick(iv, 'wardrobe', 'drawer_1')
    iv.world.setPart(id, access, 1)
    iv.world.setPart(drawerOf.id, drawerOf.access, 1)
    stepTo(house, iv, id, access, 1, true)
    stepTo(house, iv, drawerOf.id, drawerOf.access, 1, true)
    const takes = iv.world.interactables().filter((k) => k.kind === 'take' && (k.object === id || k.object === drawerOf.id))
    const categoryOf = (k: { id: string; object: string }): string => {
      const [container, slot] = k.id.slice(k.object.length + 1 + 'take.'.length).split('.')
      const stack = iv.world.contents(k.object, container as string)[Number(slot)]
      return stack ? `${iv.kit.A.household.items[stack.type]?.shape}` : ''
    }
    const garment = takes.find((k) => categoryOf(k) === 'cloth')
    const shoes = takes.find((k) => categoryOf(k) === 'shoe')
    expect(garment, 'a garment can be taken').toBeDefined()
    expect(shoes, 'an item that is not a garment can be taken').toBeDefined()
    if (!garment || !shoes) return
    for (const k of [garment, shoes]) {
      expect(k.available).toBe(true)
      expect(k.hands).toBe(1)
      const [container, slot] = k.id.slice(k.object.length + 1 + 'take.'.length).split('.') as [string, string]
      const before = drawnOf(house, k.object, container).items.length
      const near = iv.world.slotPosition(k.object, container, Number(slot))
      expect(Math.hypot(k.pos[0] - near[0], k.pos[1] - near[1], k.pos[2] - near[2])).toBeLessThan(1e-6)
      expect(iv.world.act(k.id, 'player')).toBe(true)
      expect(iv.world.contents(k.object, container)[Number(slot)]).toBeNull()
      house.update(1 / 60)
      expect(drawnOf(house, k.object, container).items.length, 'the taken item leaves the drawing').toBe(before - 1)
    }
  })

  it('nothing is taken from a closed wardrobe', () => {
    const { iv } = build()
    const { id } = pick(iv, 'wardrobe', 'shelves')
    expect(iv.world.interactables().some((k) => k.kind === 'take' && k.object === id)).toBe(false)
  })
})
