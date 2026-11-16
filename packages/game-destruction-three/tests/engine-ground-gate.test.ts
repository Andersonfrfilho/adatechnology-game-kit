import { describe, expect, it } from 'vitest'
import { WorkBudget } from '@adatechnology/game-physics'

import { GroundGate } from '../src/engine-ground-gate'
import type { GroundNeed } from '../src/engine-ground-gate'

/** Spec 008 (§5 G, §7 F3/F4): the ground under the pieces draws from the frame's work budget, in a fixed order, never past the ceiling. */
const COSTS = { perTile: 10, perTileRead: 100, perBody: 0 }
const gateOf = (budget: WorkBudget): GroundGate => new GroundGate({ budget, costs: COSTS, openFrame: () => budget.beginFrame() })
const need = (id: string, tiles: number[], distance = 0, canWait = true): GroundNeed => ({ id, distance, tiles, canWait })
const tenEach = (): number => 10

describe('GroundGate', () => {
  it('lays each piece whole while its units fit: the one that waited longest first, then the nearest, then by id; the rest wait', () => {
    const budget = new WorkBudget({ budgetMs: 0.2, unitsPerMs: 100, maxWaitFrames: 10 })
    const gate = gateOf(budget)
    // 20 units a frame: two tiles
    let turn = gate.decide([need('c', [1, 2], 5), need('b', [3], 1), need('a', [4], 1)], tenEach)
    expect([...turn.laid]).toEqual([4, 3])
    expect([...turn.waiting]).toEqual(['c'])
    expect(budget.spent('ground')).toBe(20)
    budget.beginFrame()
    // 'c' waited a frame: it goes before a nearer newcomer, though its two tiles take the whole frame
    turn = gate.decide([need('c', [1, 2], 5), need('d', [5], 0)], tenEach)
    expect([...turn.laid]).toEqual([1, 2])
    expect([...turn.waiting]).toEqual(['d'])
  })

  it('a tile two pieces share is charged once, and nothing is charged for a tile already laid this frame', () => {
    const budget = new WorkBudget({ budgetMs: 0.3, unitsPerMs: 100, maxWaitFrames: 10 })
    const turn = gateOf(budget).decide([need('a', [1, 2, 2]), need('b', [2, 3])], tenEach)
    expect([...turn.laid].sort()).toEqual([1, 2, 3])
    expect(turn.waiting.size).toBe(0)
    expect(budget.spent('ground')).toBe(30)
  })

  it('at least one piece a frame, whatever the budget; every piece by its maxWaitFrames-th frame', () => {
    const budget = new WorkBudget({ budgetMs: 0, maxWaitFrames: 3 })
    const gate = gateOf(budget)
    const needs = ['a', 'b', 'c', 'd', 'e'].map((id, index) => need(id, [index]))
    const laidBy: string[][] = []
    let left = needs
    for (let frame = 0; frame < 3; frame++) {
      budget.beginFrame()
      const turn = gate.decide(left, tenEach)
      laidBy.push(left.filter((n) => !turn.waiting.has(n.id)).map((n) => n.id))
      left = left.filter((n) => turn.waiting.has(n.id))
    }
    // the first frame lets one go though nothing fits; the third is the ceiling: all the rest go
    expect(laidBy).toEqual([['a'], ['b'], ['c', 'd', 'e']])
    expect(gate.size).toBe(0)
  })

  it('a piece that may not wait (held in a hand) is laid whatever the budget', () => {
    const budget = new WorkBudget({ budgetMs: 0, maxWaitFrames: 10 })
    const turn = gateOf(budget).decide([need('free', [1]), need('held', [2], 0, false)], tenEach)
    expect(turn.laid.has(2)).toBe(true)
    expect(turn.waiting.has('held')).toBe(false)
    // the held one counted as this frame's one: the free one waits
    expect(turn.waiting.has('free')).toBe(true)
  })

  it('a burst of tiles is spread over frames within the budget, the same frames every run', () => {
    const run = (): number[] => {
      const budget = new WorkBudget({ budgetMs: 0.3, unitsPerMs: 100, maxWaitFrames: 12 })
      const gate = gateOf(budget)
      let left = Array.from({ length: 12 }, (_, index) => need(`p${String(index).padStart(2, '0')}`, [index], 12 - index))
      const perFrame: number[] = []
      while (left.length > 0) {
        budget.beginFrame()
        const turn = gate.decide(left, tenEach)
        expect(budget.spent('ground')).toBeLessThanOrEqual(budget.unitsPerFrame)
        perFrame.push(turn.laid.size)
        left = left.filter((n) => turn.waiting.has(n.id))
      }
      return perFrame
    }
    const first = run()
    expect(first).toEqual([3, 3, 3, 3])
    expect(run()).toEqual(first)
  })

  it('saves the waits as data, and a gate given them back orders as the first would', () => {
    const budget = new WorkBudget({ budgetMs: 0, maxWaitFrames: 10 })
    const gate = gateOf(budget)
    gate.decide([need('a', [1]), need('b', [2]), need('c', [3])], tenEach)
    const saved = gate.saveState()
    expect(JSON.parse(JSON.stringify(saved))).toEqual(saved)
    expect(saved).toEqual([['b', 1], ['c', 1]])
    const again = gateOf(budget)
    again.restoreState(saved)
    // 'z' is nearer, but 'b' and 'c' waited: 'b' goes (by id)
    const turn = again.decide([need('z', [9], 0), need('c', [3], 5), need('b', [2], 5)], tenEach)
    expect([...turn.laid]).toEqual([2])
  })
})
