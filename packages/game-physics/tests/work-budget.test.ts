import { describe, expect, it } from 'vitest'

import { DEFAULT_MAX_WAIT_FRAMES, DEFAULT_WORK_BUDGET_MS, DEFAULT_WORK_UNITS_PER_MS, WORK_KINDS, WorkBudget, WorkBudgetOptionError, WorkQueue } from '../src/index'

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

  it('refuses an option that is not a finite number instead of turning the budget off', () => {
    for (const option of ['budgetMs', 'unitsPerMs', 'tier', 'maxWaitFrames'] as const) {
      for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        expect(() => new WorkBudget({ [option]: value })).toThrow(WorkBudgetOptionError)
      }
    }
    expect(() => new WorkBudget({ budgetMs: 0, tier: 0.5, maxWaitFrames: 0 })).not.toThrow()
  })

  it('work that leads to more needs room for both, and what it leads to is held for its kind until that kind takes it', () => {
    const budget = new WorkBudget({ budgetMs: 1, unitsPerMs: 100 })
    expect(budget.tryTake('split', 60, { kind: 'body', units: 50 })).toBe(false)
    expect(budget.remaining).toBe(100)
    expect(budget.tryTake('split', 60, { kind: 'body', units: 20 })).toBe(true)
    // 40 left, 20 of them held for the body: another split of 30 does not fit
    expect(budget.remaining).toBe(20)
    expect(budget.tryTake('split', 30)).toBe(false)
    expect(budget.fits(10)).toBe(2)
    budget.take('body', 20)
    expect(budget.remaining).toBe(20)
    expect(budget.spent('body')).toBe(20)
    const copy = new WorkBudget({ budgetMs: 1, unitsPerMs: 100 })
    budget.reserve({ kind: 'body', units: 5 })
    copy.restoreState(budget.saveState())
    expect(copy.remaining).toBe(15)
    budget.beginFrame()
    expect(budget.remaining).toBe(100)
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

  it('what reaches its maxWaitFrames-th release goes whatever the budget, and the queue saves as data', () => {
    const budget = new WorkBudget({ budgetMs: 0, maxWaitFrames: 3 })
    const queue = new WorkQueue<{ id: number }>('split')
    for (let i = 0; i < 4; i++) queue.push({ id: i }, i, String(i), 10)
    expect(queue.release(budget).map((x) => x.id)).toEqual([0])
    const saved = queue.saveState()
    expect(JSON.parse(JSON.stringify(saved))).toEqual(saved)
    expect(queue.release(budget).map((x) => x.id)).toEqual([1])
    // the third release since they were queued: none of them waits longer
    expect(queue.release(budget).map((x) => x.id)).toEqual([2, 3])
    const again = new WorkQueue<{ id: number }>('split')
    again.restoreState(saved)
    expect(again.release(budget).map((x) => x.id)).toEqual([1])
  })

  it('an item runs on its fit only with room for the work it leads to, which it reserves; the saved queue keeps it', () => {
    const budget = new WorkBudget({ budgetMs: 1, unitsPerMs: 100, maxWaitFrames: 10 })
    const queue = new WorkQueue<string>('split')
    queue.push('first', 1, 'a', 40, { kind: 'body', units: 20 })
    queue.push('second', 2, 'b', 40, { kind: 'body', units: 20 })
    // 40 + 20 fits in 100; then 40 + 20 does not fit in the 40 free (60 left, 20 of them the first one's body)
    expect(queue.release(budget)).toEqual(['first'])
    expect(budget.remaining).toBe(40)
    const saved = queue.saveState()
    expect(saved).toEqual([{ item: 'second', priority: 2, key: 'b', units: 40, then: { kind: 'body', units: 20 }, waited: 1 }])
    expect(JSON.parse(JSON.stringify(saved))).toEqual(saved)
  })

  it('with the default ceiling an item queued before frame F+1 is out by its 12th release, whatever the budget', () => {
    const budget = new WorkBudget({ budgetMs: 0 })
    const queue = new WorkQueue<number>('split')
    for (let i = 0; i < 20; i++) queue.push(i, i, String(i).padStart(2, '0'), 10)
    let releases = 0
    while (queue.size > 0) {
      queue.release(budget)
      releases++
    }
    expect(releases).toBe(DEFAULT_MAX_WAIT_FRAMES)
  })
})
