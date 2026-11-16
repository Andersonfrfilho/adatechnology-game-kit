import { describe, expect, it } from 'vitest'

import { DEFAULT_MAX_WAIT_FRAMES, DEFAULT_WORK_BUDGET_MS, DEFAULT_WORK_UNITS_PER_MS, WORK_KINDS, WorkBudget, WorkQueue } from '../src/index'

describe('WorkBudget', () => {
  it('holds budgetMs × unitsPerMs / tier units a frame, with the measured defaults', () => {
    expect(new WorkBudget().unitsPerFrame).toBe(DEFAULT_WORK_BUDGET_MS * DEFAULT_WORK_UNITS_PER_MS)
    expect(new WorkBudget().maxWaitFrames).toBe(DEFAULT_MAX_WAIT_FRAMES)
    expect(new WorkBudget({ budgetMs: 4, unitsPerMs: 100, tier: 4 }).unitsPerFrame).toBe(100)
    expect(WORK_KINDS).toEqual(['event', 'split', 'fragment', 'prefit', 'ground', 'body', 'wake'])
  })

  it('takes what fits, refuses what does not, and forced work may go over until the next frame', () => {
    const budget = new WorkBudget({ budgetMs: 1, unitsPerMs: 100 })
    expect(budget.tryTake('split', 60)).toBe(true)
    expect(budget.tryTake('split', 60)).toBe(false)
    expect(budget.remaining).toBe(40)
    budget.take('event', 70)
    expect(budget.remaining).toBe(-30)
    expect(budget.fits(10)).toBe(0)
    expect(budget.spent('split')).toBe(60)
    budget.beginFrame()
    expect(budget.remaining).toBe(100)
    expect(budget.spent('split')).toBe(0)
    expect(budget.fits(10)).toBe(10)
  })

  it('saves and restores bit for bit', () => {
    const budget = new WorkBudget({ budgetMs: 1, unitsPerMs: 100 })
    budget.beginFrame()
    budget.take('wake', 33)
    const copy = new WorkBudget({ budgetMs: 1, unitsPerMs: 100 })
    copy.restoreState(budget.saveState())
    expect(copy.saveState()).toEqual(budget.saveState())
  })
})

describe('WorkQueue', () => {
  it('lets out the lowest priority first, then by key, while it fits; at least one a frame', () => {
    const budget = new WorkBudget({ budgetMs: 1, unitsPerMs: 100, maxWaitFrames: 10 })
    const queue = new WorkQueue<string>('split')
    queue.push('far', 9, 'a', 40)
    queue.push('near-b', 1, 'b', 40)
    queue.push('near-a', 1, 'a', 40)
    expect(queue.release(budget)).toEqual(['near-a', 'near-b'])
    budget.beginFrame()
    budget.take('event', 500)
    expect(queue.release(budget)).toEqual(['far'])
    expect(queue.size).toBe(0)
  })

  it('what waited maxWaitFrames goes whatever the budget, and the queue saves as data', () => {
    const budget = new WorkBudget({ budgetMs: 0, maxWaitFrames: 2 })
    const queue = new WorkQueue<{ id: number }>('split')
    for (let i = 0; i < 4; i++) queue.push({ id: i }, i, String(i), 10)
    expect(queue.release(budget).map((x) => x.id)).toEqual([0])
    const saved = queue.saveState()
    expect(JSON.parse(JSON.stringify(saved))).toEqual(saved)
    expect(queue.release(budget).map((x) => x.id)).toEqual([1])
    expect(queue.release(budget).map((x) => x.id)).toEqual([2, 3])
    const again = new WorkQueue<{ id: number }>('split')
    again.restoreState(saved)
    expect(again.release(budget).map((x) => x.id)).toEqual([1])
  })
})
