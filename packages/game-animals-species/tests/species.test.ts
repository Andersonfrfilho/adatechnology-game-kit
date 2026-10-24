import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { createAnimals } from '@adatechnology/game-animals'
import { describe, expect, it } from 'vitest'

import { SPECIES, SPECIES_LOCALES, createSpeciesPack, getSpecies } from '../src'

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../game-animals-three/tests/fixtures/team-golden/animals-page.json', import.meta.url)), 'utf8'),
) as { events: { data: { species: string } }[] }

describe('species', () => {
  it('has the 13 species of the page in production order', () => {
    expect(SPECIES.map((species) => species.id)).toEqual(['cow', 'horse', 'pig', 'wild_boar', 'capybara', 'jaguar', 'dog', 'cat', 'chicken', 'southern_lapwing', 'vulture', 'lancehead', 'rat'])
    expect(SPECIES.map((species) => species.order)).toEqual([...SPECIES.keys()])
  })

  it('has the same 13 species as the golden of the page', () => {
    expect(new Set(fixture.events.map((event) => event.data.species))).toEqual(new Set(SPECIES.map((species) => species.id)))
  })

  it('splits the outcomes 6 turn, 3 die and 4 are immune, with the outbreak as data', () => {
    const count = (outcome: string): number => SPECIES.filter((species) => species.outcome === outcome).length
    expect([count('turns'), count('dies'), count('immune')]).toEqual([6, 3, 4])
    expect(getSpecies('rat')?.outbreak?.biteInfectionChance).toBe(0.05)
    expect(getSpecies('cow')?.outbreak?.carcass?.lureRadiusMetres).toBe(200)
    expect(getSpecies('chicken')?.outbreak).toBeUndefined()
  })

  it('has bodies of the three kinds and a name in both languages', () => {
    expect(new Set(SPECIES.map((species) => species.body.kind))).toEqual(new Set(['quadruped', 'bird', 'snake']))
    for (const species of SPECIES) {
      expect(species.name.en.length).toBeGreaterThan(0)
      expect(species.name['pt-BR'].length).toBeGreaterThan(0)
      expect(SPECIES_LOCALES.en.groups[species.group]).toBeDefined()
      expect(SPECIES_LOCALES['pt-BR'].phases[species.phase]).toBeDefined()
    }
  })

  it('keeps sound ranges as data and marks the species the page builds parts for', () => {
    expect(getSpecies('cow')?.soundRangeMetres).toBe(80)
    const extra = SPECIES.filter((species) => 'hasExtraBuilder' in species.body && species.body.hasExtraBuilder).map((species) => species.id)
    expect(extra).toEqual(['cow', 'horse', 'wild_boar', 'chicken', 'southern_lapwing'])
  })

  it('plugs into the engine as a pack', () => {
    const kit = createAnimals({ packs: [createSpeciesPack()], remove: ['rat'] })
    expect(kit.species).toHaveLength(12)
    expect(kit.get('dog')?.body.kind).toBe('quadruped')
  })
})
