import { quadrupedLayout } from '@adatechnology/game-animals'
import { getSpecies } from '@adatechnology/game-animals-species'
import { undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { create } from '@adatechnology/game-infection'
import { describe, expect, it } from 'vitest'

import { HERD_ROLES, STATE, bindInfection, carrionCenter, createCivilians, createCrowd, createFlock, createHerd, createNavGrid } from '../src'
import type { CrowdPack, CrowdTarget } from '../src'

const pack = undeadCrowdPack() as unknown as CrowdPack
const target = (x = 0, z = 0): CrowdTarget => ({
  state: { x, z, y: 0, floor: 0, alive: true, turned: false, crouch: false, bleeding: 0, scentTimer: 0, screamBoost: 0, grabbedBy: -1, blind: 0, burnTimer: 0, yaw: 0 },
  grab() {},
  hurt() {},
  knock() {},
  release() {},
})
const BLOCK = {
  home: { x: -6, z: 10, w: 8, d: 10, house: true, front: 1 as const },
  shop: { x: 20, z: 10, w: 10, d: 10, front: 1 as const },
}

describe('createCivilians', () => {
  it('keeps the routine of the hour and walks the route between buildings', () => {
    let hour = 9
    const crowd = createCrowd({ pack, seed: 1, capacity: 8, grid: createNavGrid({ size: 128 }), flow: { clock: () => 0 }, target: target(0, -40) })
    const civilians = createCivilians(crowd, { people: [{ id: 'a', home: 'home', routine: [[10, 'shop']] }], buildings: BLOCK, hour: () => hour })
    expect(civilians.route('home', 'shop').length).toBe(9)
    for (let f = 0; f < 20; f++) civilians.update(0.05)
    expect(civilians.get('a')!.state).toBe('home')
    hour = 10
    for (let f = 0; f < 1200; f++) civilians.update(0.05)
    const a = civilians.get('a')!
    expect(a.state).toBe('home')
    expect(a.goal).toBe('shop')
    expect(Math.hypot(a.x - 25, a.z - 12.5)).toBeLessThan(1)
  })

  it('a hunting agent bites; the bitten one turns after the bite time and the agent carries its name', () => {
    const crowd = createCrowd({ pack, seed: 7, capacity: 8, grid: createNavGrid({ size: 128 }), flow: { clock: () => 0 }, target: target(0, -60) })
    const civilians = createCivilians(crowd, { people: [{ id: 'b', home: 'home', routine: [[0, 'shop']] }], buildings: BLOCK, hour: () => 0.5, numbers: { biteSeconds: 5 } })
    const events: string[] = []
    civilians.on('bitten', () => events.push('bitten'))
    civilians.on('turned', () => events.push('turned'))
    civilians.on('died', () => events.push('died'))
    for (const [x, z] of [[0, 7], [2, 7], [-2, 6], [4, 8]] as const) crowd.store.state[crowd.spawn(x, z, 0)] = STATE.CHASE
    for (let f = 0; f < 4000 && !events.includes('turned'); f++) {
      civilians.update(0.1)
      crowd.update(0.1)
    }
    expect(events).toContain('turned')
    const b = civilians.get('b')!
    expect(b.state).toBe('undead')
    expect(crowd.store.named[b.agent]).toBe(0)
  })

  it('in a group it follows the target; leaving, it walks the path and is gone', () => {
    const crowd = createCrowd({ pack, seed: 2, capacity: 4, target: target(0, 6) })
    const civilians = createCivilians(crowd, { people: [{ id: 'c', home: 'home' }], buildings: BLOCK })
    civilians.join('c')
    for (let f = 0; f < 200; f++) civilians.update(0.05)
    const c = civilians.get('c')!
    expect(Math.hypot(c.x - 0, c.z - 6)).toBeLessThan(2.5)
    const gone: string[] = []
    civilians.on('gone', (e) => gone.push(e.id))
    civilians.flee('c', [[5, 6], [10, 6]])
    for (let f = 0; f < 400; f++) civilians.update(0.05)
    expect(c.state).toBe('gone')
    expect(gone).toEqual(['c'])
  })
})

describe('createHerd and createFlock', () => {
  const cow = getSpecies('cow')!
  const cowSize = cow.body.kind === 'quadruped' ? quadrupedLayout(cow.body).size : 1

  it('gives the game speeds from the species gait and size, and the cow calls the crowd', () => {
    const crowd = createCrowd({ pack, seed: 3, capacity: 4, target: target(0, 0) })
    const herd = createHerd(crowd)
    const E = herd.add({ ...HERD_ROLES.cow, species: 'cow', x: 10, z: 0, walkHz: cow.walkHz, runHz: cow.runHz, size: cowSize })
    expect(E.walkSpeed).toBeCloseTo(cow.walkHz * cowSize * 1.05 + 0.25, 10)
    expect(E.runSpeed).toBeCloseTo(cow.runHz * cowSize * 2.2 + 0.8, 10)
    const noises: number[] = []
    herd.on('noise', (e) => noises.push(e.radius))
    for (let f = 0; f < 20 * 600; f++) herd.update(0.05)
    expect(noises).toContain(80)
  })

  it('the hen flees from an agent and clucks; the lapwing raises the alarm', () => {
    const crowd = createCrowd({ pack, seed: 4, capacity: 4, target: target(0, 0) })
    const herd = createHerd(crowd)
    const hen = herd.add({ ...HERD_ROLES.chicken, species: 'chicken', x: 20, z: 0, walkHz: 2.2, runHz: 4, size: 0.4 })
    herd.add({ ...HERD_ROLES.southern_lapwing, species: 'southern_lapwing', x: 5, z: 0, walkHz: 2.5, runHz: 1.6, size: 0.35 })
    crowd.spawn(21.5, 0, 0)
    const sounds: string[] = []
    herd.on('sound', (e) => sounds.push(e.sound))
    for (let f = 0; f < 40; f++) herd.update(0.05)
    expect(sounds).toContain('cluck')
    expect(sounds).toContain('lapwing')
    expect(hen.x).toBeLessThan(20)
  })

  it('the vultures circle the bodies on the ground; the live map ring follows its formula', () => {
    expect(carrionCenter([{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 0, z: 3 }], null)).toEqual([1, 1])
    expect(carrionCenter([], [5, 6])).toEqual([5, 6])
    const vultures = createFlock({ count: 3, mode: 'carrion' })
    vultures.update(10, 0.05, [1, 1], [0, 0])
    const a1 = 10 * (0.18 + 0.04) + 2.1
    expect(vultures.birds[1]!.x).toBeCloseTo(1 + Math.cos(a1) * 9, 10)
    expect(vultures.birds[1]!.y).toBe(18.5)
    const ring = createFlock({ count: 40, mode: 'orbit' })
    ring.update(2, 0.05, [0, 0])
    const a = 2 * 0.3 + 9 * 0.4
    expect(ring.birds[9]!.z).toBeCloseTo(Math.sin(a) * (20 + 2 * 4), 10)
    expect(ring.birds[9]!.y).toBeCloseTo(25 + Math.sin(2 + 9) * 2, 10)
  })
})

describe('bindInfection', () => {
  const model = () =>
    create({
      seed: 5,
      incubationHours: 48,
      startHour: 0,
      regions: [{ id: 'town', pop: 2000, density: 1, police: 2 }],
      links: [],
      phases: [{ id: 'routine', dayMin: -99, dayMax: -99, threshold: 0, awareness: 0, cullFixed: 0, cullFraction: 0, shelter: 0, flee: 0, exit: 0, focusTransfer: 0 }],
      events: [{ id: 'seed', hour: 0, action: 'seed', region: 'town', n: 400 }],
    })

  it('materialises the region numbers as agents, a kill is a removal, the far ones go back', () => {
    const infection = model()
    infection.advance(96)
    const before = infection.region('town').active
    expect(before).toBeGreaterThan(10)
    const crowd = createCrowd({ pack, seed: 6, capacity: 64, target: target(0, 0) })
    const binding = bindInfection(crowd, infection, { place: (_r, seed, k) => [(seed % 100) - 50 + k * 0.01, 500 + k] })
    const born = binding.materialize('town', 10)
    expect(born).toHaveLength(10)
    expect(infection.region('town').active).toBe(before - 10)
    crowd.kill(born[0]!)
    expect(infection.region('town').removed).toBeGreaterThan(0)
    crowd.update(0.1)
    const back = binding.giveBack('town')
    expect(back).toBe(9)
    expect(crowd.store.n).toBe(0)
    expect(infection.region('town').active).toBe(before - 1)
    binding.unbind()
  })
})
