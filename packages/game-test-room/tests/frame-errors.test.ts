import { describe, expect, it } from 'vitest'
import type { ModuleHost, TestableModule } from '@adatechnology/game-contracts'
import type { ScenarioContext } from '../src'
import { makeRoom } from './helpers'

const moduleThatThrows = (id: string, message: string): TestableModule<ScenarioContext> => ({
  id,
  name: id,
  group: id,
  items: () => [],
  attach: (host: ModuleHost) => {
    const off = host.onFrame(() => {
      throw new Error(message)
    })
    return () => off()
  },
})

describe('errors of a frame', () => {
  it('room.update throws what a module frame threw, after the frame ran', () => {
    const room = makeRoom()
    const after: number[] = []
    room.loadModule({ ...moduleThatThrows('boom', 'boom'), attach: (host) => {
      const offs = [host.onFrame(() => { throw new Error('boom') }), host.onFrame(() => after.push(1), { order: 5 })]
      return () => offs.forEach((off) => off())
    } })
    expect(() => room.update(1 / 60)).toThrow('boom')
    expect(after).toEqual([1])
  })

  it('two modules that throw in the same frame both surface', () => {
    const room = makeRoom()
    room.loadModule(moduleThatThrows('first', 'first broke'))
    room.loadModule(moduleThatThrows('second', 'second broke'))
    let caught: unknown
    try {
      room.update(1 / 60)
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(AggregateError)
    expect((caught as AggregateError).errors.map((error: Error) => error.message).sort()).toEqual(['first broke', 'second broke'])
  })

  it('does not keep an old error for the next frame', () => {
    const room = makeRoom()
    let broken = true
    room.loadModule({ id: 'once', name: 'once', group: 'once', items: () => [], attach: (host) => host.onFrame(() => { if (broken) throw new Error('once') }) })
    expect(() => room.update(1 / 60)).toThrow('once')
    broken = false
    expect(() => room.update(1 / 60)).not.toThrow()
  })

  it('a scenario whose step throws fails, and the next scenario still runs', async () => {
    const room = makeRoom()
    let armed = false
    room.loadModule({ id: 'bad_step', name: 'Bad step', group: 'Bad step', items: () => [], attach: (host) => host.onFrame(() => { if (armed) throw new Error('step broke') }) })
    const report = await room.runScenarios([
      { id: 'throws', name: 'Throws', run: ({ step, expect: check }: ScenarioContext) => { armed = true; step(1 / 60); check(true, 'unreachable') } },
      { id: 'fine', name: 'Fine', run: ({ expect: check }: ScenarioContext) => { armed = false; check(true, 'runs') } },
    ] as never)
    expect(report.results.map((result) => [result.id, result.ok])).toEqual([['throws', false], ['fine', true]])
    expect(report.results[0]?.checks[0]?.label).toContain('step broke')
  })

  it('a headless frame throws the error to the caller and does not also log it', () => {
    const logged: unknown[][] = []
    const original = console.error
    console.error = (...args: unknown[]) => void logged.push(args)
    try {
      const room = makeRoom()
      room.loadModule(moduleThatThrows('loud', 'loud'))
      for (let frame = 0; frame < 3; frame++) {
        try {
          room.update(1 / 60)
        } catch {
          /* headless callers see it */
        }
      }
    } finally {
      console.error = original
    }
    expect(logged).toHaveLength(0)
  })
})

describe('a host that owns the loop', () => {
  it('drains the queues it lent to the budget only when it calls update', () => {
    const room = makeRoom()
    let units = 4
    const queue = { id: 'host.queue', pending: () => units, run: () => (units--, 1), flush: () => (units = 0) }
    room.loadModule({ id: 'q', name: 'q', group: 'q', items: () => [], attach: (host) => host.defer?.(queue, { priority: 1, phase: 'present' }) ?? (() => undefined) })
    expect(units).toBe(4)
    room.update(1 / 60)
    expect(units).toBeLessThan(4)
  })
})
