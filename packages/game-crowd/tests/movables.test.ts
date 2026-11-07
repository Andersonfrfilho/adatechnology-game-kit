import { undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { describe, expect, it } from 'vitest'

import { createCivilians, createCrowd, createMovableContacts, createNavGrid } from '../src'
import type { CrowdPack, CrowdTarget } from '../src'

const pack = undeadCrowdPack() as unknown as CrowdPack
const target = (x: number, z: number): CrowdTarget => ({
  state: { x, z, y: 0, floor: 0, alive: true, turned: false, crouch: false, bleeding: 0, scentTimer: 0, screamBoost: 0, grabbedBy: -1, blind: 0, burnTimer: 0, yaw: 0 },
  grab: () => undefined,
  hurt: () => undefined,
  knock: () => undefined,
  release: () => undefined,
})

describe('movable contacts', () => {
  const sofa = { id: 'sofa', minX: -1, minZ: -2.4, maxX: 1, maxZ: -1.6, top: 0.9 }

  it('finds the box a body runs into, grown by its radius, and not over its top', () => {
    const contacts = createMovableContacts()
    contacts.set([sofa])
    expect(contacts.at(0, -1.4, 0, 0.3)?.index).toBe(0)
    expect(contacts.at(0, -1.2, 0, 0.3)).toBeNull()
    expect(contacts.at(0, -1.4, 1, 0.3)).toBeNull()
  })

  it('adds up the forces of the bodies, each once, along their walk', () => {
    const contacts = createMovableContacts()
    contacts.set([sofa])
    contacts.lean(0, 1, 0, -1, 450)
    contacts.lean(0, 1, 0, -1, 450)
    contacts.lean(0, 2, 0, -1, 450)
    contacts.lean(0, 3, 0.2, -1, 450)
    const [shove] = contacts.flush()
    expect(shove?.pushers).toBe(3)
    expect(shove?.forceN).toBeGreaterThan(1300)
    expect(shove?.dirZ).toBeLessThan(-0.99)
    expect(contacts.flush()).toEqual([])
  })
})

describe('agents walking into a movable piece', () => {
  it('stop at its face and lean their force on it, the push pose on', () => {
    const crowd = createCrowd({ pack, seed: 3, grid: createNavGrid({ size: 64, border: false }), flow: { clock: () => 0 } })
    crowd.setMovables([{ id: 'sofa', minX: -1, minZ: -2.4, maxX: 1, maxZ: -1.6, top: 0.9 }])
    const i = crowd.spawn(0, 2, 0)
    const forces: number[] = []
    const prey = target(0, -6)
    for (let k = 0; k < 600; k++) {
      crowd.update(1 / 60, { target: prey })
      for (const s of crowd.shoves) forces.push(s.forceN)
    }
    expect(crowd.store.z[i]).toBeGreaterThan(-1.6)
    expect(forces.length).toBeGreaterThan(0)
    expect(forces[0]).toBeCloseTo(450 * crowd.store.build[i]!, 0)
    expect(crowd.store.shoveZ[i]).toBeLessThan(-0.9)
  })
})

describe('civilians and movable furniture', () => {
  it('a civilian walks round a sofa in the way: never in it, never shoving it', () => {
    const crowd = createCrowd({ pack, seed: 1, capacity: 8, grid: createNavGrid({ size: 128 }), flow: { clock: () => 0 }, target: target(0, -40) })
    const civilians = createCivilians(crowd, { people: [{ id: 'a', home: 'home', routine: [] }], buildings: { home: { x: -6, z: 10, w: 8, d: 10, house: true, front: 1 } }, hour: () => 3 })
    const a = civilians.get('a')!
    // out of the house first, onto open ground
    civilians.flee('a', [[0, -5]])
    for (let f = 0; f < 600 && Math.hypot(a.x, a.z + 5) > 0.5; f++) civilians.update(0.05)
    const [x0, z0] = [a.x, a.z]
    const sofa = { id: 'sofa', minX: x0 - 1, minZ: z0 - 3.4, maxX: x0 + 1, maxZ: z0 - 2.6, top: 0.9 }
    crowd.setMovables([sofa])
    civilians.flee('a', [[x0, z0 - 6]])
    let inside = 0
    for (let f = 0; f < 600; f++) {
      civilians.update(0.05)
      crowd.update(0.05)
      if (a.x > sofa.minX && a.x < sofa.maxX && a.z > sofa.minZ && a.z < sofa.maxZ) inside++
      expect(crowd.shoves).toEqual([])
    }
    expect(inside).toBe(0)
    expect(a.z).toBeLessThan(z0 - 4)
  })
})
