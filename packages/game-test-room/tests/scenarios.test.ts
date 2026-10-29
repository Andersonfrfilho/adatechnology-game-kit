import { describe, expect, it } from 'vitest'
import { makeRoom } from './helpers'

describe('scenarios (headless)', () => {
  it('the room ships no scenario of its own: every one comes from the host or from a loaded module', () => {
    expect(makeRoom().scenarios).toEqual([])
  })

  it('hosts add their own scenarios; a throwing scenario is reported, not thrown', async () => {
    const room = makeRoom({
      scenarios: [
        { id: 'mine', name: 'Mine', run: ({ expect: e, room: r }) => e(r.spawned().length === 0, 'nothing is spawned at the start') },
        {
          id: 'boom',
          name: 'Boom',
          run: () => {
            throw new Error('nope')
          },
        },
      ],
    })
    const report = await room.runScenarios(room.scenarios.filter((s) => s.id === 'mine' || s.id === 'boom'))
    expect(report.results.map((r) => [r.id, r.ok])).toEqual([
      ['mine', true],
      ['boom', false],
    ])
    expect(report.results[1].checks[0].label).toContain('nope')
  })

  it('a scenario starts from a clean world whatever ran before', async () => {
    const room = makeRoom({ scenarios: [{ id: 'empty_start', name: 'Empty start', run: ({ expect: e, room: r }) => e(r.spawned().length === 0, 'nothing is spawned at the start') }] })
    room.spawn('chair')
    const report = await room.runScenarios()
    expect(report.results[0].ok).toBe(true)
  })

  it('writes the checks in the room locale', async () => {
    const room = makeRoom({ locale: 'pt-BR', scenarios: [{ id: 'x', name: 'X', run: ({ expect: e }) => e(true, 'ok') }] })
    const report = await room.runScenarios()
    expect(report.passed).toBe(1)
  })
})
