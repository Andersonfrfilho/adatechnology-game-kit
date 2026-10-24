import { hashText } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import goldenFile from './fixtures/team-golden/vc3-plans.json'
import detailFile from './fixtures/team-golden/vc3-plans-detail.json'
import { engine } from './support'
import { sdkStateOf, sdkTemplateOf, teamRowsOf } from './vc3-rows'
import type { PlanLists } from './vc3-rows'

/** Plans recorded from the Visor de casas 3D (PlantasSDK with the R rules): 17 templates x seeds 1-25 x 3 states, one hash per list. */
type PlanEvent = {
  readonly template: string
  readonly seed: number
  readonly state: string
  readonly hashes: { readonly [list: string]: string }
  readonly rows?: PlanLists
}

const LISTS = ['rooms', 'walls', 'openings', 'items', 'stateItems', 'lot'] as const
const plansOf = (file: unknown): PlanEvent[] => (file as GoldenRecord).events.map((event) => event.data as unknown as PlanEvent)
const allPlans = plansOf(goldenFile)

function sdkRows(plan: PlanEvent): PlanLists {
  return teamRowsOf(engine.generate(sdkTemplateOf.get(plan.template) as string, { seed: plan.seed, state: sdkStateOf.get(plan.state) }))
}

function explain(plan: PlanEvent, list: string): string {
  const detail = plansOf(detailFile).find((x) => x.template === plan.template && x.seed === plan.seed && x.state === plan.state)
  if (!detail?.rows) return `${list}: hash differs (detail rows are recorded for seed 1 only)`
  const want = detail.rows[list] as string[]
  const got = sdkRows(plan)[list] as string[]
  return `${list}\n  only team ${want.filter((line) => !got.includes(line)).slice(0, 3).join('\n            ')}\n  only sdk  ${got.filter((line) => !want.includes(line)).slice(0, 3).join('\n            ')}`
}

describe('plans against the Visor de casas 3D (VC3)', () => {
  const comparable = [...new Set(allPlans.map((plan) => plan.template))].filter((template) => sdkTemplateOf.has(template))

  for (const template of comparable) {
    it(`${template}: every list of 75 plans (25 seeds x 3 states) has the team's hash`, () => {
      const mismatches: string[] = []
      for (const plan of allPlans.filter((x) => x.template === template)) {
        const rows = sdkRows(plan)
        for (const list of LISTS) {
          if (hashText((rows[list] as string[]).join('\n')) !== plan.hashes[list]) mismatches.push(`${template}#${plan.seed}/${plan.state} ${explain(plan, list)}`)
        }
      }
      expect(mismatches.slice(0, 3)).toEqual([])
    })
  }

  it('every template of the team page has an SDK template (the five rural ones included)', () => {
    const missing = [...new Set(allPlans.map((plan) => plan.template))].filter((template) => !sdkTemplateOf.has(template)).sort()
    expect(missing).toEqual([])
    expect(comparable).toHaveLength(17)
  })

  it('a hash notices an item moved by 1 cm', () => {
    const plan = allPlans.find((x) => x.template === 'casaA') as PlanEvent
    const generated = engine.generate('single_storey_a', { seed: plan.seed, state: sdkStateOf.get(plan.state) })
    generated.items[0].x += 0.01
    const moved = (teamRowsOf(generated).items as string[]).join('\n')
    expect(hashText(moved)).not.toBe(plan.hashes.items)
  })
})
