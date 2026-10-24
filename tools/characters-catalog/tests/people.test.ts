import { describe, expect, it } from 'vitest'

import { buildAccessories, buildAgePresets, buildProfessions } from '../src/build-people'
import { buildInputs, buildPeopleInputs } from '../src/build'

const inputs = buildPeopleInputs(buildInputs())

describe('people data against the sources', () => {
  it('turns the 12 PROFS of the Elenco into the 12 professions, in order', () => {
    const professions = buildProfessions(inputs) as { id: string; name: { 'pt-BR': string } }[]
    expect(professions.map((profession) => profession.name['pt-BR'])).toEqual(inputs.elenco.professions.map((profession) => profession.n))
    expect(professions).toHaveLength(12)
  })

  it('finds the child range of the portraits page: height 0.52 to 0.70, build 0.68 to 0.76', () => {
    const child = (buildAgePresets(inputs) as { id: string; height: number[]; build: number[] }[]).find((preset) => preset.id === 'child')
    expect(child).toMatchObject({ height: [0.52, 0.7], build: [0.68, 0.76] })
  })

  it('lists every case of the hand-item and worn switches of the page', () => {
    const accessories = buildAccessories(inputs) as { id: string; slot: string }[]
    expect(accessories.filter((accessory) => accessory.slot === 'hand').length).toBeGreaterThanOrEqual(15)
    expect(accessories.filter((accessory) => accessory.slot === 'worn').length).toBeGreaterThanOrEqual(50)
    expect(accessories.length).toBeGreaterThanOrEqual(80)
  })
})
