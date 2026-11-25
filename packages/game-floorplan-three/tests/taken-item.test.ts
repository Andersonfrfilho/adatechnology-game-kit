import * as GameInteractables from '@adatechnology/game-interactables'
import type { Interactable, ItemStack } from '@adatechnology/game-interactables'
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import * as GameInteractablesThree from '@adatechnology/game-interactables-three'
import { describe, expect, it } from 'vitest'

import type { HouseInteractives } from '../src'
import type { InteractionTarget, KitEntry } from '../src/kernel-types-systems'
import { takenItemOf } from '../src/test-area/taken-item'
import { THREE, houseOf, planOf } from './helpers/houses'

// What is taken out of a piece of furniture goes to the hand: the take says which catalogue item it is and with how many hands, and the item is drawn by the
// model the furniture showed it with. The room closes the hand on it (game-test-room, `ModuleHost.takeInHand`).

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
const SHIFT = [10, 0, -4] as const
const toWorld = (q: readonly number[]): [number, number, number] => [(q[0] ?? 0) + SHIFT[0], (q[1] ?? 0) + SHIFT[1], (q[2] ?? 0) + SHIFT[2]]

/** What E aims at, as the house's kit target makes it (`ivTarget` of the bridge). */
const aimAt = (iv: HouseInteractives, k: Interactable): InteractionTarget => {
  const object = iv.entries.get(k.object) as KitEntry
  return { score: 0, text: k.label, action: () => k.act('player'), target: { kit: true, id: k.id, type: `kit:${k.kind}`, object, item: k, floor: 0, pos: k.pos.slice(), text: () => k.label } as InteractionTarget['target'] }
}

/** An open wardrobe of the townhouse with something on its shelves. */
function openWardrobe(): { iv: HouseInteractives; takes: Interactable[] } {
  const { house } = houseOf(planOf('sobrado', 3), { interactives: kit })
  const iv = house.interactives
  if (!iv) throw new Error('no interactives')
  for (const E of iv.entries.values()) {
    if (E.type !== 'wardrobe') continue
    const shelves = E.spec.containers?.find((c) => c.id === 'shelves')
    if (!shelves?.access || !iv.world.contents(E.id, 'shelves').some((s) => s !== null)) continue
    iv.world.setPart(E.id, shelves.access, 1)
    // the doors swing open over the frames, as in the room
    for (let i = 0; i < 600 && iv.world.partT(E.id, shelves.access) < 1; i++) house.update(1 / 120)
    const takes = iv.world.interactables().filter((k) => k.kind === 'take' && k.object === E.id)
    return { iv, takes }
  }
  throw new Error('no wardrobe with something on its shelves')
}

describe('an item taken out of the furniture goes to the hand', () => {
  it('a take of the wardrobe names its catalogue item and asks for one hand', () => {
    const { takes } = openWardrobe()
    expect(takes.length).toBeGreaterThan(0)
    for (const k of takes) {
      expect(k.hands).toBe(1)
      expect(k.itemType, k.id).toMatch(/^[a-z0-9_]+$/)
    }
  })

  it('hands over the item it aims at, where it was, drawn by the furniture model; the take still empties the slot', () => {
    const { iv, takes } = openWardrobe()
    const k = takes[0] as Interactable
    const taken = takenItemOf({ target: aimAt(iv, k), itemModel, toWorld })
    expect(taken).not.toBeNull()
    expect(taken?.itemId).toBe(k.itemType)
    expect(taken?.name).toBe(k.noun)
    expect(taken?.hands).toBe(1)
    expect(taken?.position).toEqual(toWorld(k.pos))
    const drawn = taken?.build(THREE) as THREE.Object3D
    expect(drawn.getObjectByName(REAL)?.userData.realItem).toBe(k.itemType)
    expect(k.act('player')).toBe(true)
    expect(iv.world.interactables().some((x) => x.id === k.id)).toBe(false)
  })

  it('hands over nothing for a door, a switch or without the item model', () => {
    const { iv, takes } = openWardrobe()
    const other = iv.world.interactables().find((k) => k.kind !== 'take')
    expect(other).toBeDefined()
    expect(takenItemOf({ target: aimAt(iv, other as Interactable), itemModel, toWorld })).toBeNull()
    expect(takenItemOf({ target: aimAt(iv, takes[0] as Interactable), itemModel: undefined, toWorld })).toBeNull()
    expect(takenItemOf({ target: null, itemModel, toWorld })).toBeNull()
  })
})
