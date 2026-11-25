import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { HostTakenItem, ModuleHost, Vec3 } from '@adatechnology/game-contracts'

import { makeRoom } from './helpers'

const AT: Vec3 = [-2, 1.1, -1]

/** A pair of jeans folded on a shelf, as the houses hand it over (`ModuleHost.takeInHand`). */
const jeans = (position: Vec3 = AT): HostTakenItem => ({
  itemId: 'jeans',
  name: 'Calça jeans',
  position,
  hands: 1,
  physical: { weightKg: 0.6, size: [0.3, 0.06, 0.25] },
  build: (T) => {
    const three = T as typeof THREE
    const root = new three.Group()
    root.add(new three.Mesh(new three.BoxGeometry(0.3, 0.06, 0.25), new three.MeshStandardMaterial()))
    return root
  },
})

/** A room with a module that keeps the host it is lent, as the houses' module does. */
function roomWithHost(): { room: ReturnType<typeof makeRoom>; host: ModuleHost } {
  const room = makeRoom()
  let lent: ModuleHost | null = null
  room.loadModule({ id: 'shelf', name: 'Shelf', group: 'Test', items: () => [], attach: (host) => {
      lent = host
      return () => undefined
    },
  })
  if (!lent) throw new Error('the module was not attached')
  return { room, host: lent }
}

describe('an item a module hands over goes to the hand', () => {
  it('the hand closes on it with one hand and the weapon stays in the other', () => {
    const { room, host } = roomWithHost()
    room.setTool('pistol_9mm')
    room.look([AT[0], AT[1] + 0.4, AT[2] + 1], AT)

    expect(host.takeInHand?.(jeans())).toBe(true)
    for (let frame = 0; frame < 5; frame++) room.update(1 / 60)

    const grabs = room.log.entries({ type: 'grab' })
    expect(grabs).toHaveLength(1)
    expect(grabs[0]?.text).toContain('Calça jeans')
    expect(grabs[0]?.data).toMatchObject({ hands: 1 })
    // one hand: nothing put away, nothing dropped, the pistol still in hand
    expect(room.log.entries({ type: 'hands_holster' })).toEqual([])
    expect(room.log.entries({ type: 'hands_drop' })).toEqual([])
    expect(room.tool.def.id).toBe('pistol_9mm')
    // it is held: it can be thrown
    expect(room.throwHeld()).toBe(true)
  })

  it('a second one of the same item is another object of the one catalogue entry', () => {
    const { room, host } = roomWithHost()
    room.look([AT[0], AT[1] + 0.4, AT[2] + 1], AT)
    expect(host.takeInHand?.(jeans())).toBe(true)
    expect(room.throwHeld()).toBe(true)
    expect(host.takeInHand?.(jeans([AT[0] + 0.4, AT[1], AT[2]]))).toBe(true)
    const spawned = room.log.entries({ type: 'spawn' })
    expect(new Set(spawned.map((e) => e.itemId))).toEqual(new Set(['taken_jeans']))
    expect(new Set(spawned.map((e) => e.objectId)).size).toBe(2)
  })
})
