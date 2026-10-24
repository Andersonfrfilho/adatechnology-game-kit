import { describe, expect, it } from 'vitest'

import { AppearancePalette, createCharacters, createConditionTimeline, createCorpseLedger, createRng, drawAppearance, drawBodyVariance, variantCountFor, variantDecay, variantSeed } from '../src'
import infection from '../../game-characters-undead/src/data/infection.json'

describe('ConditionTimeline', () => {
  const phases = infection.stages.map((stage, index) => ({
    id: String(index),
    startsAt: index === 0 ? 0 : (stage.fromHours ?? 48),
    effects: { skin: stage.skin, hunch: stage.hunch, arms: stage.arms },
  }))

  it('walks the Elenco stages on an hours clock', () => {
    const timeline = createConditionTimeline({ phases, unitsPerSecond: 1 / 3600 })
    expect(timeline.sample().phase.id).toBe('0')
    expect(timeline.advance(3 * 3600).phase.id).toBe('1')
    expect(timeline.advance(10 * 3600).effects.skin).toBe(0.42)
    expect(timeline.seek(31).effects.arms).toBe(0.25)
    const last = timeline.seek(49)
    expect(last.isFinal).toBe(true)
    expect(last.effects.skin).toBe(1)
  })

  it('an accelerated clock is just another unit rate', () => {
    const { accelerated } = infection
    const timeline = createConditionTimeline({
      unitsPerSecond: 1,
      phases: [
        { id: 'well', startsAt: 0 },
        { id: 'fever', startsAt: accelerated.feverSeconds },
        { id: 'delirium', startsAt: accelerated.deliriumSeconds },
        { id: 'dead', startsAt: accelerated.deathSeconds },
        { id: 'turned', startsAt: accelerated.deathSeconds + accelerated.reanimateSeconds },
      ],
    })
    expect(timeline.advance(29.9).phase.id).toBe('well')
    expect(timeline.advance(0.1).phase.id).toBe('fever')
    expect(timeline.advance(100).phase.id).toBe('turned')
    timeline.reset()
    expect(timeline.sample().index).toBe(0)
  })

  it('blends effects toward the next phase when asked', () => {
    const timeline = createConditionTimeline({ blend: true, phases: [{ id: 'a', startsAt: 0, effects: { skin: 0 } }, { id: 'b', startsAt: 10, effects: { skin: 1 } }] })
    expect(timeline.seek(5).effects.skin).toBe(0.5)
  })

  it('needs a phase', () => {
    expect(() => createConditionTimeline({ phases: [] })).toThrow()
  })
})

describe('corpses', () => {
  it('replaces the oldest when full, and removes by swapping with the last, as the game does', () => {
    const ledger = createCorpseLedger<string>({ max: 3, seconds: 10 })
    ledger.add('a')
    ledger.update(4)
    ledger.add('b')
    ledger.update(4)
    ledger.add('c')
    expect(ledger.count).toBe(3)
    expect(ledger.add('d')).toBe('a')
    expect(ledger.entries.map((entry) => entry.data)).toEqual(['d', 'b', 'c'])
    expect(ledger.update(7)).toEqual(['b'])
    expect(ledger.entries.map((entry) => entry.data)).toEqual(['d', 'c'])
    expect(ledger.update(100).sort()).toEqual(['c', 'd'])
    expect(ledger.count).toBe(0)
  })

  it('takes one corpse away by swapping the last into its place (the devourer eats one)', () => {
    const ledger = createCorpseLedger<string>({ max: 5, seconds: 10 })
    for (const id of ['a', 'b', 'c', 'd']) ledger.add(id)
    expect(ledger.remove(1)).toBe('b')
    expect(ledger.entries.map((entry) => entry.data)).toEqual(['a', 'd', 'c'])
    expect(ledger.remove(9)).toBeUndefined()
  })

  it('the kit makes a ledger with its own cap and lifetime (400 bodies, 900 s)', () => {
    const kit = createCharacters()
    const ledger = kit.createCorpses<number>()
    for (let index = 0; index < 401; index++) ledger.add(index)
    expect(ledger.count).toBe(400)
    expect(ledger.update(901)).toHaveLength(400)
    expect(createCharacters({ corpses: { max: 2 } }).createCorpses<number>().add(1)).toBeUndefined()
  })
})

describe('appearance', () => {
  it('draws the body variance in the order of zSpawn: three height draws, the band, the build, the speed and the wander speed', () => {
    const draws: number[] = []
    const random = createRng(7)
    const recording = (): number => {
      const value = random()
      draws.push(value)
      return value
    }
    const variance = drawBodyVariance(recording, { height: 1.42 })
    expect(draws).toHaveLength(7)
    const [h1, h2, h3, band, inside, speed, wander] = draws as [number, number, number, number, number, number, number]
    expect(variance.height).toBe(Math.min(1.1, Math.max(0.9, 1 + (h1 + h2 + h3 - 1.5) * 0.09)) * 1.42)
    const lean = band < 0.3
    const heavy = band >= 0.8
    expect(variance.buildClass).toBe(lean ? 'lean' : heavy ? 'heavy' : 'average')
    expect(variance.build).toBe(lean ? 0.85 + inside * 0.1 : heavy ? 1.08 + inside * 0.17 : 0.95 + inside * 0.13)
    expect(variance.speedFactor).toBe((lean ? 1.05 : heavy ? 0.9 : 1) * (0.92 + speed * 0.16))
    expect(variance.wanderFactor).toBe(0.8 + wander * 0.4)
  })

  it('the ZVAR rule: variant counts, seeds and decay', () => {
    expect(['walker', 'runner', 'crawler', 'brute', 'screamer'].map(variantCountFor)).toEqual([4, 3, 2, 2, 1])
    expect(variantSeed(2, 1)).toBe(7000 + 202 + 13)
    expect([0, 1, 2, 3, 4].map(variantDecay)).toEqual([1, 2, 1, 2, 1])
  })

  it('the v17 look draws in the builder order and hands the stream on', () => {
    const { traits, random } = drawAppearance({ seed: 5 })
    const mirror = createRng(5)
    const female = mirror() < 0.42
    expect(traits.female).toBe(female)
    expect(traits.tone).toBe(AppearancePalette.SKIN_TONES[Math.floor(mirror() * 6)])
    expect(traits.topColor).toBe(AppearancePalette.TOP_COLORS[Math.floor(mirror() * 16)])
    expect(traits.pantsColor).toBe(AppearancePalette.PANTS_COLORS[Math.floor(mirror() * 7)])
    expect(traits.sleeve).toBe(AppearancePalette.SLEEVES[Math.floor(mirror() * 4)])
    expect(random).toBeTypeOf('function')
    expect(drawAppearance({ seed: 5 }).traits).toEqual(traits)
  })

  it('a woman skips the beard roll, an outfit with a hat skips the cap roll, and a brute never rolls its sex', () => {
    const woman = drawAppearance({ seed: 1, female: true })
    const man = drawAppearance({ seed: 1, female: false })
    expect(woman.traits.beard).toBe(false)
    expect(woman.random()).not.toBe(man.random())
    const hatted = drawAppearance({ seed: 3, outfit: { cloth: 0x123456, pants: 0x654321, hat: 'cap' } })
    expect(hatted.traits.cap).toBe(false)
    expect(hatted.traits.topColor).toBe(0x123456)
    expect(drawAppearance({ seed: 3, allowFemale: false }).traits.female).toBe(false)
  })

  it('a baked crowd variant has the fixed look', () => {
    const { traits } = drawAppearance({ seed: 7000, uniform: true, typeIndex: 2 })
    expect(traits).toMatchObject({ female: false, hair: 'short', headWidth: 1, bag: false, topColor: 0x5d4a3a })
  })
})
