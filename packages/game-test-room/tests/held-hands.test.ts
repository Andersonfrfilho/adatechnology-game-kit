import { describe, expect, it } from 'vitest'
import { HANDS_TIMING } from '@adatechnology/game-player'
import type { HandPose } from '@adatechnology/game-contracts'
import { createArsenal } from '@adatechnology/game-weapons'

import { createHeldHands, holsterEventOf } from '../src/held-hands'
import type { HeldHandsReport } from '../src/held-hands'

const SHOULDERS = { R: [-0.2, 1.4, 0], L: [0.2, 1.4, 0] } as const
const BOTTLE: HandPose = { position: [0.25, 0.9, -0.6], quaternion: [0, 0, 0, 1] }
const GUN_HAND: HandPose = { position: [-0.15, 1.25, -0.45], quaternion: [0, 0, 0, 1] }

const setup = (start: { R: string; L?: string | null }, slots: readonly string[]) => {
  const hands = { R: start.R, L: start.L ?? null }
  const reports: HeldHandsReport[] = []
  const placed: string[] = []
  const loadout = [start.R]
  const held = createHeldHands<{ readonly weaponId: string }>({
    arsenal: createArsenal(),
    loadout,
    catalog: [{ id: 'item_glock', name: 'Glock', weapon: 'glock_17' }],
    inHand: () => hands,
    equip: (hand, weapon) => {
      if (hand === 'R') hands.R = weapon ?? 'hand'
      else hands.L = weapon
    },
    handPose: (hand) => (hand === 'R' && hands.R !== 'hand' ? GUN_HAND : null),
    carried: { get: () => null, set: () => undefined, putDown: () => undefined },
    place: (entry) => placed.push(entry.itemId),
    report: (event) => reports.push(event),
    slots,
  })
  let taken = 0
  const take = { size: [0.07, 0.25, 0.07] as [number, number, number], item: () => BOTTLE, taken: () => (taken += 1) }
  const frame = (seconds: number): void => {
    for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
      held.update(1 / 60)
      held.carry({ shoulder: (side) => SHOULDERS[side], yaw: 0, tool: () => null })
    }
  }
  return { held, hands, reports, placed, take, frame, taken: () => taken }
}
const distance = (a: readonly number[], b: readonly number[]): number => Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0))

describe('taking a thing with a weapon in the hands, seen step by step (owner, 2026-11-25)', () => {
  it('a rifle swings onto its sling from the hand before the hand reaches the bottle; the bottle is held only once the fingers closed', () => {
    const { held, hands, reports, take, frame, taken } = setup({ R: 'ak_12' }, ['hip', 'sling'])
    const plan = held.begin({ massKg: 0.6, size: take.size }, take)
    expect(plan.hand).toBe('L')
    expect(hands.R).toBe('hand')
    expect(reports[0]).toMatchObject({ type: 'sling', weapon: 'ak_12', slot: 'sling', seconds: HANDS_TIMING.sling, from: GUN_HAND })
    expect(holsterEventOf(reports[0]!)).toMatchObject({ type: 'holster', slot: 'sling', on: true, seconds: HANDS_TIMING.sling })
    expect(held.busy).toBe(true)
    // while the rifle goes onto the sling, the left hand does not move yet
    frame(HANDS_TIMING.sling * 0.5)
    expect(held.targets).toBeNull()
    frame(HANDS_TIMING.sling * 0.5 + HANDS_TIMING.reach)
    // reached: the left hand is on the bottle, open
    const onBottle = held.targets?.L
    expect(onBottle).toBeTruthy()
    expect(taken()).toBe(0)
    frame(HANDS_TIMING.close + 0.02)
    expect(taken()).toBe(1)
    expect(held.busy).toBe(false)
    frame(HANDS_TIMING.lift)
    // held: the bottle's middle is under the palm by a palm and its radius, wherever the hand is
    const palm = held.targets?.L
    const bottle = held.item
    expect(palm && bottle).toBeTruthy()
    expect(distance(palm!.position, bottle!.position)).toBeCloseTo(0.011 + 0.035, 3)
    expect(held.targets?.gripL).toBeGreaterThan(0.7)
    // let go: the rifle stays on its sling
    held.end()
    frame(1)
    expect(hands.R).toBe('hand')
    expect(held.away).toEqual(['ak_12'])
    // H: it comes back to the hands, seen, and is in hand only at the end of the move
    expect(held.drawBack()).toBe(true)
    expect(reports.at(-1)).toMatchObject({ type: 'draw', weapon: 'ak_12', seconds: HANDS_TIMING.draw })
    expect(holsterEventOf(reports.at(-1)!)).toMatchObject({ on: false, seconds: HANDS_TIMING.draw })
    frame(HANDS_TIMING.draw * 0.5)
    expect(hands.R).toBe('hand')
    frame(HANDS_TIMING.draw * 0.5 + 0.02)
    expect(hands.R).toBe('ak_12')
    expect(held.away).toEqual([])
    expect(held.drawBack()).toBe(false)
  })

  it('the hand reaches from its carry pose to the bottle, never jumping', () => {
    const { held, take, frame } = setup({ R: 'hand' }, ['hip'])
    held.begin({ massKg: 0.6, size: take.size }, take)
    let last: readonly number[] | null = null
    for (let t = 0; t < HANDS_TIMING.reach + HANDS_TIMING.close + HANDS_TIMING.lift; t += 1 / 60) {
      frame(1 / 60)
      const now = held.targets?.R?.position ?? null
      if (now && last) expect(distance(now, last)).toBeLessThan(0.08)
      last = now
    }
  })

  it('a pistol with no holster is tossed, and lands as the world item at the end of the toss', () => {
    const { held, reports, placed, take, frame } = setup({ R: 'glock_17' }, [])
    held.begin(2, take)
    expect(reports[0]).toMatchObject({ type: 'toss', weapon: 'glock_17', from: GUN_HAND })
    expect(holsterEventOf(reports[0]!)).toMatchObject({ type: 'holster', slot: 'ground', on: true })
    expect(placed).toEqual([])
    frame(HANDS_TIMING.drop + 0.02)
    expect(placed).toEqual(['item_glock'])
    expect(reports.find((report) => report.type === 'drop')).toMatchObject({ fell: true })
    expect(holsterEventOf(reports.find((report) => report.type === 'drop')!)).toBeNull()
  })

  it('a holstered pistol comes back by itself when the hands let go, seen', () => {
    const { held, hands, reports, take, frame } = setup({ R: 'glock_17' }, ['hip'])
    held.begin(2, take)
    expect(reports[0]).toMatchObject({ type: 'holster', slot: 'hip' })
    frame(2)
    held.end()
    expect(reports.at(-1)).toMatchObject({ type: 'draw', weapon: 'glock_17' })
    expect(hands.R).toBe('hand')
    frame(HANDS_TIMING.draw + 0.02)
    expect(hands.R).toBe('glock_17')
  })

  it('a push (no thing to take) only frees the hands', () => {
    const { held, hands, frame } = setup({ R: 'ak_12' }, ['hip', 'sling'])
    held.begin(2)
    frame(1)
    expect(hands.R).toBe('hand')
    expect(held.targets).toBeNull()
    expect(held.busy).toBe(false)
  })
})

describe('the long gun brings its own sling', () => {
  it('every list of places gets the sling but the empty one, where everything drops', async () => {
    const { withSling, DEFAULT_BODY_SLOTS } = await import('../src/held-hands')
    expect(withSling(['hip', 'back'])).toEqual(['hip', 'back', 'sling'])
    expect(withSling(['sling'])).toEqual(['sling'])
    expect(withSling([])).toEqual([])
    expect(DEFAULT_BODY_SLOTS).toEqual(['hip', 'belt', 'sling'])
  })

  it('with ?bodySlots=hip,back a rifle still swings onto its sling, not across the back', () => {
    const { held, reports, take } = setup({ R: 'ak_12' }, ['hip', 'back'])
    held.begin({ massKg: 0.6, size: take.size }, take)
    expect(reports[0]).toMatchObject({ type: 'sling', slot: 'sling' })
  })
})

describe('a room with no body', () => {
  it('takes at once: there are no hands to see moving', async () => {
    const { createHeldHands: create } = await import('../src/held-hands')
    const hands = { R: 'ak_12', L: null as string | null }
    let taken = 0
    const held = create<{ readonly weaponId: string }>({
      arsenal: createArsenal(),
      loadout: ['ak_12'],
      catalog: [],
      inHand: () => hands,
      equip: (hand, weapon) => {
        if (hand === 'R') hands.R = weapon ?? 'hand'
      },
      carried: { get: () => null, set: () => undefined, putDown: () => undefined },
      place: () => undefined,
      report: () => undefined,
      instant: () => true,
    })
    held.begin({ massKg: 0.5 }, { size: [0.1, 0.2, 0.1], item: () => null, taken: () => (taken += 1) })
    expect(taken).toBe(1)
    expect(hands.R).toBe('hand')
    expect(held.busy).toBe(false)
  })
})
