import { describe, expect, it } from 'vitest'
import { SCENARIOS, scenariosFor } from '../src'
import { makeRoom } from './helpers'

describe('built-in scenarios (headless)', () => {
  it('lists the documented scenarios, in English and Portuguese', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(20)
    expect(SCENARIOS.map((s) => s.id)).toEqual(expect.arrayContaining(['steel_through_hole', 'glass_shatters', 'screwdriver_shelf_board', 'fuel_stain_burns', 'two_columns_roof_collapses']))
    expect(scenariosFor('pt-BR').find((s) => s.id === 'one_column_roof_stands')?.name).toBe('Pilar destruído: a laje fica de pé')
  })

  it('all pass, and every check is explained in the log with a mark', async () => {
    const room = makeRoom()
    const report = await room.runScenarios()
    const failed = report.results.filter((r) => !r.ok).map((r) => `${r.id}: ${r.checks.filter((c) => !c.ok).map((c) => c.label).join(' | ')}`)
    expect(failed).toEqual([])
    expect(report.failed).toBe(0)
    expect(report.passed).toBe(room.scenarios.length)
    const checks = room.log.entries({ channel: 'check' })
    expect(checks.filter((c) => c.type === 'pass').every((c) => c.text.startsWith('✓ '))).toBe(true)
    expect(checks.filter((c) => c.type === 'scenario_pass')).toHaveLength(report.passed)
    // readable log: right singular/plural, no per-joint spam, no empty parentheses or dangling commas
    const text = room.log.entries().map((e) => e.text)
    expect(text.filter((x) => /\b1 (pieces|joints|peças|encaixes)\b/.test(x))).toEqual([])
    expect(text.filter((x) => /\(\)|, $|surface\./.test(x))).toEqual([])
    expect(room.log.entries({ type: 'detach' }).filter((e) => (e.data?.parts as unknown[] | undefined)?.length && e.data?.by === 'part_lost' && !e.data?.jointsOpened)).toEqual([])
    expect(room.log.entries({ type: 'landing' }).every((e) => Number(e.data?.speedMs) >= 3)).toBe(true)
  }, 120000)

  it('is deterministic: two rooms give the same checks and the same event counts', async () => {
    const run = async () => {
      const room = makeRoom()
      const report = await room.runScenarios(room.scenarios.filter((s) => ['glass_shatters', 'shotgun_splinters_crate', 'jerrycan_leaks_fuel', 'throw_chair_at_wall'].includes(s.id)))
      return { labels: report.results.flatMap((r) => r.checks.map((c) => c.label)), summary: room.log.summary() }
    }
    const a = await run()
    const b = await run()
    expect(b).toEqual(a)
  }, 60000)

  it('a scenario starts from a clean world whatever ran before', async () => {
    const room = makeRoom()
    const one = room.scenarios.find((s) => s.id === 'steel_through_hole')!
    const first = await room.runScenarios([one])
    room.spawn('chair')
    room.setTool('hammer')
    room.update(0.4)
    const second = await room.runScenarios([one])
    expect(second.results[0].checks.map((c) => c.label)).toEqual(first.results[0].checks.map((c) => c.label))
    expect(room.spawned().map((s) => s.itemId)).toEqual(['steel_sheet'])
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

  it('writes the checks in the room locale', async () => {
    const room = makeRoom({ locale: 'pt-BR' })
    const report = await room.runScenarios(room.scenarios.filter((s) => s.id === 'steel_through_hole'))
    expect(report.results[0].name).toBe('Tiro de 9 mm em chapa de aço faz furo que atravessa')
    expect(report.results[0].checks[0].label).toContain('atravessou: sim')
  })
})
