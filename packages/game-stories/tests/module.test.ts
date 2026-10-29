import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { BenchChange, BenchSheet, ModuleHost } from '@adatechnology/game-contracts'
import { checkBench } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { createStoriesTestModule } from '../src/bench/module'
import type { StoriesContent } from '../src/bench/module'

const SLICE = join(__dirname, '../../../specs/001-migracao-entregas-dos-times/game-slice/stories')
const slice = <T>(file: string): T => JSON.parse(readFileSync(join(SLICE, file), 'utf8')) as T

const fakeHost = () => {
  let listener: ((change: BenchChange) => void) | null = null
  const sheets: (BenchSheet | null)[] = []
  const host = {
    THREE: null, scene: null, camera: null, locale: 'pt-BR', groundAt: () => 0, tool: () => ({ kind: 'none' }), on: () => () => {}, onFrame: () => () => {}, log: () => {},
    bench: { value: () => undefined, layer: () => true, onChange: (l: (change: BenchChange) => void) => ((listener = l), () => (listener = null)), patch: () => {}, look: () => {}, sheet: (s: BenchSheet | null) => void sheets.push(s) },
  } as unknown as ModuleHost
  return { host, sheets, send: (change: BenchChange) => listener?.(change) }
}

describe('the stories test module', () => {
  for (const locale of ['pt-BR', 'en']) {
    it(`[${locale}] follows the contract and its six scenarios pass on the example content`, async () => {
      const module = createStoriesTestModule({ locale })
      const report = checkBench({ controls: module.controls?.(locale), metrics: module.metrics?.(locale) })
      expect(report.problems).toEqual([])
      for (const scenario of module.scenarios!(locale)) {
        const failures: string[] = []
        await scenario.run({ expect: (ok: boolean, label: string) => void (ok || failures.push(label)) } as never)
        expect(failures, scenario.id).toEqual([])
      }
    })
  }

  it('shows a sheet on the panel and follows the day, the seed and the actions', () => {
    const module = createStoriesTestModule()
    const { host, sheets, send } = fakeHost()
    module.attach!(host)
    send({ kind: 'control', id: 'day', value: 20 })
    expect(module.world.day).toBe(20)
    expect(sheets.at(-1)?.title.length).toBeGreaterThan(0)
    const before = module.world.chronicle.entries.map((e) => e.text).join('|')
    send({ kind: 'control', id: 'act_welcome', value: true })
    expect(module.world.chronicle.entries.map((e) => e.text).join('|')).not.toBe(before)
    send({ kind: 'action', id: 'next_day' })
    expect(module.world.day).toBe(21)
  })

  it('loads a game’s content: the zombiada slice runs its 90 days', () => {
    const module = createStoriesTestModule()
    const content: StoriesContent = { people: slice('cast.json'), stories: [...slice<StoriesContent['stories']>('stories.json'), slice('roles.json')], life: slice('life.json'), playerBase: 'jogador', days: 90 }
    module.load(content)
    const { host, send } = fakeHost()
    module.attach!(host)
    send({ kind: 'control', id: 'day', value: 90 })
    expect(module.world.chronicle.entries.filter((e) => e.kind === 'story').length).toBeGreaterThan(30)
    expect(module.world.person('cicero')?.name.endsWith('Tavares')).toBe(true)
  })
})
