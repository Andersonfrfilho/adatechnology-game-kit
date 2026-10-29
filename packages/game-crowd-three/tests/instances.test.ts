import { undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { MISSING, STATE, createCrowd } from '@adatechnology/game-crowd'
import type { CrowdPack } from '@adatechnology/game-crowd'
import { describe, expect, it } from 'vitest'

import { CROWD_RENDER_DEFAULTS, createCrowdInstances } from '../src'
import type { CrowdInstance } from '../src'

const pack = undeadCrowdPack() as unknown as CrowdPack
const eyes = pack.types.map((type) => type.eye ?? null)
const sizes = Array.from({ length: 20 }, () => ({ s: 1.7, bulk: 1 }))
const frame = { camera: { x: 0, z: 0 }, viewYaw: 0, target: { x: 0, z: 0, alive: true } }
const draw = (crowd: ReturnType<typeof createCrowd>, options: Parameters<typeof createCrowdInstances>[0] = { eyes }) => {
  const out: { v: number; l: number; i: CrowdInstance }[] = []
  createCrowdInstances(options).agents(crowd.store, sizes, frame, (v, l, i) => out.push({ v, l, i }))
  return out
}

describe('createCrowdInstances (G hordeRender)', () => {
  it('culls behind the view and past 200 m, keeps the near ones behind', () => {
    const crowd = createCrowd({ pack, seed: 1, capacity: 8 })
    crowd.spawn(0, -10, 0) // in front
    crowd.spawn(0, 10, 0) // behind, 10 m: out
    crowd.spawn(0, 4, 0) // behind but within √30 m: in
    crowd.spawn(0, -210, 0) // too far
    expect(draw(crowd).map((d) => d.i.a[1])).toEqual([-10, 4])
  })

  it('gives each state its pose and the bloater its swelling', () => {
    const crowd = createCrowd({ pack, seed: 1, capacity: 16 })
    const cases: [number, string][] = [
      [STATE.DORMANT, 'fallen'],
      [STATE.AIRBORNE, 'leap'],
      [STATE.EATING, 'eat'],
      [STATE.PILE_STEP, 'attack'],
      [STATE.SWING, 'scream'],
      [STATE.GRAB, 'attack'],
      [STATE.CALLING, 'scream'],
      [STATE.WANDER, 'walk'],
    ]
    cases.forEach(([st], k) => (crowd.store.state[crowd.spawn(k, -10, 0)] = st))
    const poses = draw(crowd).map((d) => d.i.b[3])
    expect(poses).toEqual([2, 6, 7, 3, 4, 3, 4, 0])
    const b = crowd.spawn(0, -12, pack.types.findIndex((t) => t.id === 'bloater'))
    crowd.store.state[b] = STATE.SWELLING
    crowd.store.stateTimer[b] = 0.2
    const swollen = draw(crowd).at(-1)!.i
    expect(swollen.b[1]).toBeCloseTo(crowd.store.build[b]! * (1 + 0.3 * 0.9), 6)
  })

  it('puts the eyes out without the skull and on a dormant body', () => {
    const crowd = createCrowd({ pack, seed: 1, capacity: 4 })
    crowd.spawn(0, -10, 0)
    crowd.store.missing[crowd.spawn(1, -10, 0)] = MISSING.SKULL
    crowd.store.state[crowd.spawn(2, -10, 0)] = STATE.DORMANT
    expect(draw(crowd).map((d) => d.i.eye)).toEqual([pack.types[0]!.eye, null, null])
  })

  it('takes other numbers and poses by option', () => {
    const crowd = createCrowd({ pack, seed: 1, capacity: 4 })
    crowd.spawn(0, -30, 0)
    expect(draw(crowd)[0]!.l).toBe(1)
    expect(draw(crowd, { eyes, numbers: { lodDistances: [40, 80] } })[0]!.l).toBe(0)
    crowd.store.state[0] = STATE.CALLING
    expect(draw(crowd, { eyes, poses: { calling: 'crouch' } })[0]!.i.b[3]).toBe(5)
    expect(CROWD_RENDER_DEFAULTS.numbers.lodDistances).toEqual([18, 55])
  })

  it('draws the civilians as the game (a child smaller, the bite showing)', () => {
    const out: CrowdInstance[] = []
    const civilian = { id: 'a', k: 2, x: 1, z: 2, yaw: 0, phase: 0, vx: 0, vz: 0, biteTimer: 3, state: 'home', spec: { id: 'a', home: 'h', child: true } }
    createCrowdInstances({ eyes }).civilians([civilian, { ...civilian, id: 'b', state: 'undead' }] as never, () => 0x123456, (_n, i) => out.push(i))
    expect(out).toHaveLength(1)
    expect(out[0]!.b.slice(0, 2)).toEqual([0.66, 0.75])
    expect(out[0]!.c).toEqual([0, 0.3, 0, 0.5])
    expect(out[0]!.color).toBe(0x123456)
  })
})
