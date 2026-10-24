import { describe, expect, it } from 'vitest'

import { inputs, numbersIn, readOutput } from './helpers'
import type { TypeRow } from './helpers'

const { game, bestiary, elenco, bench, decisions } = inputs
const types = readOutput<TypeRow[]>('undeadTypes')
const typeOf = (name: string): TypeRow => {
  const row = types.find((entry) => entry.name['pt-BR'] === name)
  if (!row) throw new Error(`no generated type for ${name}`)
  return row
}

describe('the 13 types', () => {
  it('has one generated type per game category and per Bestiário card, in the game order, with English ids', () => {
    expect(game.categories).toHaveLength(13)
    expect(bestiary.types).toHaveLength(13)
    expect(types.map((type) => type.name['pt-BR'])).toEqual(game.categories.map((category) => category.nome))
    expect(bestiary.types.map((card) => card.n).sort()).toEqual(game.categories.map((category) => category.nome).sort())
    expect(types.map((type) => type.id)).toEqual(['walker', 'runner', 'crawler', 'brute', 'sniffer', 'leaper', 'bloater', 'stalker', 'blind', 'screamer', 'charred', 'drowned', 'devourer'])
  })

  it('equals the Bestiário Z values: health, damage, bite chance, speeds, damage multipliers (the game wins the Devorador limbs: 0.9, not 1.0)', () => {
    for (const card of bestiary.types) {
      const type = typeOf(card.n)
      const [wander, chase] = numbersIn(card.spd)
      expect(type.health, card.n).toBe(card.hp)
      expect(type.damage, card.n).toBe(card.dmg)
      expect(type.biteChance, card.n).toBeCloseTo(numbersIn(card.bite)[0]! / 100, 9)
      expect(type.speed.wander, card.n).toBe(wander)
      // P3: for the four types the Bancada value is `chase` and the Bestiário chase is `frenzy`
      expect(type.speed.frenzy ?? type.speed.chase, card.n).toBe(chase ?? wander)
      const [torso, arms, legs] = numbersIn(card.mult)
      const expected = card.n === 'Rastejante' ? [1, 1, 1] : card.n === 'Devorador' ? [1, 0.9, 0.9] : [torso, arms, legs]
      expect([type.multipliers.torso, type.multipliers.arms, type.multipliers.legs], card.n).toEqual(expected.map((value) => value ?? 1))
    }
  })

  it('spawns at the Bestiário share, except the Drowned (1, near water) that the game has at 0', () => {
    for (const card of bestiary.types) {
      const type = typeOf(card.n)
      if (type.id === 'drowned') expect(type).toMatchObject({ spawnWeight: 1, requires: 'water' })
      else expect(type.spawnWeight, card.n).toBe(card.pct)
    }
    expect(game.categories.find((category) => category.id === 'afogado')?.peso).toBe(0)
  })

  it('takes the P3 speeds: the Bancada chase values and the runner at 5.5 sustained, 6.0 sprint', () => {
    expect(['Cego', 'Carbonizado', 'Afogado', 'Devorador'].map((name) => typeOf(name).speed.chase)).toEqual([1.6, 1.6, 1.2, 2.4])
    expect(['Cego', 'Carbonizado', 'Afogado', 'Devorador'].map((name) => typeOf(name).speed.frenzy)).toEqual([3, 2.2, 2.5, 3])
    expect(bench.filter((row) => ['Cego', 'Carbonizado', 'Afogado', 'Devorador'].includes(row[0])).map((row) => row[2])).toEqual([1.6, 1.6, 1.2, 2.4])
    expect(typeOf('Corredor').speed).toMatchObject({ chase: 5.5, sprint: 6 })
    expect(typeOf('Afogado').speed.water).toBe(3)
  })

  it('uses the v17 eye colours: the game values, which differ from the page v0.1 only where P4 says', () => {
    const differing = bestiary.types.filter((card) => card.eye.replace('#', '').toUpperCase() !== typeOf(card.n).eye.color).map((card) => card.n)
    for (const category of game.categories) expect(typeOf(category.nome).eye.color, category.nome).toBe(category.olho.toString(16).toUpperCase().padStart(6, '0'))
    expect(differing).toEqual(['Devorador'])
    expect(typeOf('Devorador').eye.color).toBe('B0122A')
  })

  it('has every ability numbers in the Bestiário text of its type (the evidence snippet is still there)', () => {
    for (const [id, ability] of Object.entries(decisions.abilities.value)) {
      const card = bestiary.types.find((entry) => decisions.typeIds.value[game.categories.find((category) => category.nome === entry.n)?.id ?? ''] === id)
      expect(card, id).toBeDefined()
      expect(card?.ai, id).toContain(ability.evidence)
    }
  })

  it('carries the gait profile of the page and the v17 posture of the game for every type', () => {
    for (const card of bestiary.types) {
      expect(typeOf(card.n).gait, card.n).toEqual(bestiary.gaits[card.n])
      expect(typeOf(card.n).posture, card.n).toEqual(game.bestTypes[card.n])
    }
  })
})

describe('infection age, outfits and infection', () => {
  it('has the game ages, whose speed, health and limb damage equal the Bestiário table; blood stays the game values', () => {
    const table = bestiary.visibleText
    expect(table).toContain('Velocidade +10% base −10% −25%')
    expect(table).toContain('Vida 100% 100% 85% 65%')
    expect(table).toContain('Dano nos membros ×0,8 ×1,0 ×1,3 ×1,8')
    expect(table).toContain('Percepção base base audição −10% visão −40%, olfato −30%')
    expect(game.ages.map((age) => age.vel)).toEqual([1.1, 1, 0.9, 0.75])
    expect(game.ages.map((age) => age.vida)).toEqual([1, 1, 0.85, 0.65])
    expect(game.ages.map((age) => age.membro)).toEqual([0.8, 1, 1.3, 1.8])
    expect(game.ages.map((age) => age.sangue)).toEqual([1, 0.6, 0.25, 0])
    expect(game.ages.reduce((sum, age) => sum + age.p, 0)).toBeCloseTo(1, 9)
  })

  it('keeps the game outfits: shares add up to 1, the vest pair equals the protection preset, the helmet and fire gear exist', () => {
    expect(game.outfits.reduce((sum, outfit) => sum + outfit.p, 0)).toBeCloseTo(1, 9)
    const presets = decisions.protectionPresets.value
    expect(game.outfits[1]?.colete).toEqual({ pistola: presets.police?.blunt, fuzil: presets.police?.pass })
    expect(game.outfits[2]?.colete).toEqual({ pistola: presets.military?.blunt, fuzil: presets.military?.blunt })
    expect(game.outfits[2]?.capacete).toBe(1)
    expect(game.outfits[3]).toMatchObject({ fogo: presets.firefighter?.fire, membro: presets.firefighter?.limbs })
  })

  it('has the game wounds (shares add up to 1), the accelerated clock and the Elenco hours', () => {
    expect(Object.values(game.wounds).reduce((sum, [share]) => sum + share, 0)).toBeCloseTo(1, 9)
    expect(game.wounds.mordida).toEqual([0.1, 1])
    expect(game.infection).toEqual({ febre: 30, delirio: 70, morte: 120, reanima: 8 })
    expect(elenco.stages.map((stage) => stage.t)).toEqual(['Saudável', 'Mal-estar (2 a 12 h)', 'Febre alta (12 a 30 h)', 'Delírio (30 a 48 h)', 'Reanimado: corredor'])
    expect(bestiary.visibleText).toContain('Arranhão tem 20% de chance')
    const infection = readOutput<{ stages: { fromHours?: number; toHours?: number }[] }>('undeadInfection')
    expect(infection.stages.slice(1, 4).map((stage) => [stage.fromHours, stage.toHours])).toEqual([[2, 12], [12, 30], [30, 48]])
  })

  it('keeps the corpse limits and the LOD distances of the game', () => {
    expect(game.corpses).toEqual({ max: 400, lifeSeconds: 900 })
    expect(game.lodDistances).toEqual([18, 55])
  })
})
