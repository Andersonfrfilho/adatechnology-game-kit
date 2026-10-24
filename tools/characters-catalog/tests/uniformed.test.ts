import { describe, expect, it } from 'vitest'

import { buildForces, buildLootPools, buildRanks } from '../src/build-uniformed'
import { buildInputs } from '../src/build'
import { extractLiving } from '../src/extract-living'

const inputs = { living: extractLiving(), decisions: buildInputs().decisions }

describe('uniformed data against Os Vivos do Vale', () => {
  it('takes the rank rule thresholds from the text of RANKRULE', () => {
    const ranks = buildRanks(inputs) as { rule: { commander: { minimumCourageAndLoyalty: number }; disobeyBelowOpinion: number } }
    expect(inputs.living.rankRule).toContain('≥ 100')
    expect(inputs.living.rankRule).toContain('−20')
    expect(ranks.rule.commander.minimumCourageAndLoyalty).toBe(100)
    expect(ranks.rule.disobeyBelowOpinion).toBe(-20)
  })

  it('has every non-unique LOOT row in a pool and no unique one', () => {
    const rows = inputs.living.loot as readonly (readonly string[])[]
    const pools = buildLootPools(inputs) as Record<string, unknown[]>
    expect(Object.values(pools).flat()).toHaveLength(rows.filter((row) => row[6] !== 'único').length)
    expect(rows.filter((row) => row[6] === 'único')).toHaveLength(9)
  })

  it('names the ladders of the page: every pt-BR rank name appears in the source ladder text', () => {
    const ladderText = Object.fromEntries((inputs.living.ranks as readonly (readonly string[])[]).map((row) => [row[0] ?? '', row[1] ?? '']))
    const ranks = (buildRanks(inputs) as { ladders: Record<string, { name: { 'pt-BR': string } }[]> }).ladders
    const sourceOf: Record<string, string> = { army: 'Exército', military_police: 'Polícia Militar', civil_police: 'Polícia Civil', highway_police: 'PRF', prison_police: 'Polícia Penal' }
    for (const [ladder, source] of Object.entries(sourceOf)) {
      const text = ladderText[source] ?? ''
      for (const rank of ranks[ladder] ?? []) expect(text.toLowerCase()).toContain(rank.name['pt-BR'].replace(/^\d+º /, '').toLowerCase())
    }
  })

  it('has the 7 forces with the colours of FACT', () => {
    expect(buildForces(inputs)).toHaveLength(7)
  })
})
