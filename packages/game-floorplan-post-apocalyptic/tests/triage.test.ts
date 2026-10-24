import { describe, expect, it } from 'vitest'

import { triageFindsHints } from '../src'
import { engine } from './support'

const SEEDS = Array.from({ length: 25 }, (_, index) => index + 1)
const STATES = ['normal', 'fortified', 'abandoned']

/** The program of `buildTriagem` of the gallery (mapa__galeria-vale-cinzento.js L1096): two 8 x 10 m sides, 6 cots on each, 6 medical crates, a rifle trestle. */
describe('triage tent', () => {
  it('has the size, ceiling, place and construction of the scene', () => {
    const template = engine.templates.triage_tent!
    expect(template.place).toBe('triage')
    expect(template.construction).toBe('canvas')
    const plan = engine.generate('triage_tent', { seed: 1, state: 'normal' })
    expect([plan.w, plan.d]).toEqual([16, 10])
    expect(plan.floors[0].ceiling).toBe(3.4)
  })

  it('has the clean and the bitten side, 8 by 10 m each', () => {
    const plan = engine.generate('triage_tent', { seed: 1, state: 'normal' })
    expect(plan.rooms.map((room: any) => [room.id, room.parts[0][2] - room.parts[0][0], room.parts[0][3] - room.parts[0][1]])).toEqual([['clean_side', 8, 10], ['bitten_side', 8, 10]])
  })

  it('has 12 cots (6 on each side), 6 medical crates on the bitten side and the rifle trestle on the clean side, for every seed', () => {
    for (const seed of SEEDS) {
      const plan = engine.generate('triage_tent', { seed, state: 'normal' })
      const where = (type: string) => plan.items.filter((item: any) => item.type === type).map((item: any) => item.room)
      expect(where('cot').sort(), `seed ${seed}`).toEqual([...Array(6).fill('bitten_side'), ...Array(6).fill('clean_side')])
      expect(where('medical_crate'), `seed ${seed}`).toEqual(Array(6).fill('bitten_side'))
      expect(where('rifle_trestle'), `seed ${seed}`).toEqual(['clean_side'])
    }
  })

  it('is valid for every seed and every state', () => {
    for (const state of STATES) for (const seed of SEEDS) expect(engine.validate(engine.generate('triage_tent', { seed, state })), `${state} ${seed}`).toEqual([])
  })

  it('turns every loot pin of the scene into a finds hint backed by a fixture in that room', () => {
    const plan = engine.generate('triage_tent', { seed: 1, state: 'normal' })
    const pins = [['Caixas médicas', 'bitten_side', 'medical_crate'], ['Fuzis no cavalete', 'clean_side', 'rifle_trestle']]
    for (const [label, room, container] of pins) {
      expect(triageFindsHints.some((hint) => hint.room === room && hint.container === container), label).toBe(true)
      expect(plan.items.some((item: any) => item.room === room && item.category === container), label).toBe(true)
    }
    expect(triageFindsHints.length).toBe(pins.length)
  })

  it('names the template and the sides in en and pt-BR (LIMPO and MORDIDO)', () => {
    const portuguese = engine.generate('triage_tent', { seed: 1, state: 'normal', locale: 'pt-BR' })
    expect(portuguese.name).toBe('Tenda de triagem')
    expect(portuguese.rooms.map((room: any) => room.name)).toEqual(['Lado LIMPO', 'Lado MORDIDO'])
    expect(engine.generate('triage_tent', { seed: 1, state: 'normal' }).rooms.map((room: any) => room.name)).toEqual(['Clean side', 'Bitten side'])
  })
})
