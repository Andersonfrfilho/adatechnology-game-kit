import { describe, expect, it } from 'vitest'

import { inputs, readOutput } from './helpers'

const { game, bestiary, elenco, decisions } = inputs

type SegmentsFile = {
  readonly segments: readonly { readonly id: string; readonly region: string; readonly hitPoints: number; readonly multiplier: number; readonly bleed: number }[]
  readonly regions: Readonly<Record<string, { readonly hitPoints: number; readonly segmentSum: number }>>
  readonly arsenalWeapons: Readonly<Record<string, { readonly dmg: number; readonly pel: number }>>
  readonly elenco: { readonly below: Readonly<Record<string, readonly string[]>>; readonly cutWeapons: readonly { readonly id: string; readonly cut: number }[] }
}

const segments = readOutput<SegmentsFile>('segments')

describe('the 11 segments (Arsenal) and the segment tree (Elenco)', () => {
  it('has the 11 Arsenal segments with the numbers of arsenal:856-860', () => {
    expect(segments.segments.map((segment) => segment.id)).toEqual(['head', 'jaw', 'neck', 'torso', 'pelvis', 'upperArm', 'forearm', 'hand', 'thigh', 'shin', 'foot'])
    const byId = Object.fromEntries(segments.segments.map((segment) => [segment.id, segment]))
    expect(byId.head).toMatchObject({ hitPoints: 40, multiplier: 3, bleed: 40, region: 'head' })
    expect(byId.torso).toMatchObject({ hitPoints: 150, multiplier: 1, bleed: 10, region: 'torso' })
    expect(byId.thigh).toMatchObject({ hitPoints: 55, multiplier: 0.7, bleed: 19, region: 'leg' })
    expect(byId.neck).toMatchObject({ hitPoints: 25, multiplier: 2, bleed: 46 })
  })

  it('reads the Arsenal damage table and keeps a destroyed torso at 150', () => {
    expect(segments.arsenalWeapons.pistola).toMatchObject({ dmg: 35, pel: 1 })
    expect(segments.arsenalWeapons.escopeta).toMatchObject({ dmg: 12, pel: 9 })
    expect(decisions.severity.value.splitAtDamage).toBe(150)
  })

  it('gives each game region the SEG hit points, rescaled from the sum of its segments (77, 87, 110)', () => {
    expect(game.segments).toEqual({ cabeca: 40, braco: 60, perna: 80 })
    expect(Object.values(segments.regions).map((region) => [region.hitPoints, region.segmentSum])).toEqual([[40, 77], [60, 87], [80, 110]])
  })

  it('has the Elenco cascades (what falls with a cut limb) and the cut table that decides a sever', () => {
    expect(segments.elenco.below).toEqual({ upperArm: ['forearm', 'hand'], forearm: ['hand'], thigh: ['shin'] })
    expect(elenco.segments).toMatchObject({ head: { hp: 40 }, torso: { hp: 120 }, pelvis: { hp: 90 }, upperArm: { hp: 60 }, forearm: { hp: 45 }, hand: { hp: 25 }, thigh: { hp: 80 }, shin: { hp: 55 } })
    const cuts = Object.fromEntries(elenco.cutWeapons.map((weapon) => [weapon.id, weapon.cut]))
    const ballistic = decisions.defaultCut.value as { ballistic: { pistol: number; buckshot: number; rifle: number } }
    expect([cuts.p9, cuts.e12, cuts.f762]).toEqual([ballistic.ballistic.pistol, ballistic.ballistic.buckshot, ballistic.ballistic.rifle])
  })

  it('agrees with the game on when a limb is severed: cut >= 0.5 or damage above 0.9 of the maximum', () => {
    expect(decisions.severity.value.severAtCut).toBe(0.5)
    expect(decisions.severity.value.severAtDamageFraction).toBe(0.9)
  })
})

describe('gait, body and appearance', () => {
  it('has the cascade of the Bestiário and the walk constants of the game', () => {
    const gait = readOutput<{ cascade: Record<string, number>; moves: Record<string, unknown>; walk: unknown }>('gait')
    expect(gait.cascade).toEqual({ hip: 16, spine: 11, shoulder: 9, elbow: 7, leg: 14, knee: 11, head: 6 })
    expect(Object.keys(gait.moves)).toEqual(['idle', 'walk', 'run', 'crouch', 'aim', 'turn'])
    expect(gait.walk).toEqual({ cadenceBase: 0.5, cadencePerSpeed: 0.3, stopBelowSpeed: 0.05, maxSine: 0.9, strideFactor: 4, legLengthFactor: 0.9 })
    expect(bestiary.cascade).toEqual(gait.cascade)
  })

  it('has the game joints (shoulders at 0.24 m) next to the guide proportions (shoulders 0.61 m)', () => {
    const body = readOutput<{ guide: { shoulderWidthMetres: number }; teamGame: { joints: Record<string, number[]> } }>('body')
    expect(body.teamGame.joints.ombroD).toEqual([0.24, 1.44, 0])
    expect(body.guide.shoulderWidthMetres).toBe(0.61)
  })

  it('keeps the zSpawn variance numbers and the ZVAR seed rule', () => {
    const appearance = readOutput<{ variance: { height: { min: number; max: number }; variantSeedBase: number }; corpses: { max: number } }>('appearance')
    expect(appearance.variance.height).toMatchObject({ min: 0.9, max: 1.1 })
    expect(appearance.variance.variantSeedBase).toBe(7000)
    expect(appearance.corpses.max).toBe(400)
  })
})
