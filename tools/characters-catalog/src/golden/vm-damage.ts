import { createEventRecorder, createGoldenRecord, createSeededRandom } from '@adatechnology/golden-tool'
import type { EventRecorder, GoldenRecord } from '@adatechnology/golden-tool'

import { evaluateGameSlice } from './game-context'

type Field = { [index: number]: number }
export type DamageContext = {
  readonly Z: { n: number } & Readonly<Record<string, Field>>
  readonly CAT: Readonly<Record<string, number>>
  readonly zSpawn: (x: number, z: number, forcedType?: number) => number
  readonly zDamage: (index: number, region: number, damage: number, caliber: string | null, distance: number, cut?: number) => { morreu?: boolean; headshot?: boolean }
}
export type DamageHarness = { readonly context: DamageContext; readonly setSeed: (seed: number) => void; readonly effects: string[] }

/** The game's damage code with the effects as stubs that only note that they were called, and a kill that records instead of removing. */
export const createDamageHarness = (): DamageHarness => {
  let stream = createSeededRandom(1)
  const effects: string[] = []
  const note = (name: string) => () => void effects.push(name)
  const context = evaluateGameSlice<DamageContext>({
    functions: ['zSpawn', 'zSpecialSpawn', 'zDamage'],
    exports: ['Z', 'CAT', 'zSpawn', 'zDamage'],
    scope: { R: () => stream(), fxSpark: note('spark'), sfx: note('sound'), fxBlood: note('blood'), fxLimb: note('limb'), zKill: note('kill') },
  })
  return { context, setSeed: (seed) => void (stream = createSeededRandom(seed)), effects }
}

const REGIONS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR']

/** What a hit left on the zombie in slot 0, in the fields the game keeps. */
export const readState = ({ Z }: DamageContext, effects: readonly string[]) => ({
  health: Z.hp?.[0] ?? 0,
  headHp: Z.segH?.[0] ?? 0,
  armHp: [Z.segA?.[0] ?? 0, Z.segA?.[1] ?? 0],
  legHp: [Z.segL?.[0] ?? 0, Z.segL?.[1] ?? 0],
  missing: Z.miss?.[0] ?? 0,
  limp: Z.limp?.[0] ?? 0,
  crawl: Z.crawl?.[0] ?? 0,
  helmet: Z.capacete?.[0] ?? 0,
  state: Z.st?.[0] ?? 0,
  stunSeconds: Z.stT?.[0] ?? 0,
  killed: effects.includes('kill'),
  limbEffect: effects.includes('limb'),
  effects: effects.join('+'),
})

type Hit = { readonly region: number; readonly damage: number; readonly caliber: string | null; readonly distance: number; readonly cut?: number }
type Scenario = {
  readonly id: string
  readonly type: string
  readonly seed: number
  readonly age: number
  readonly outfit: number
  readonly hits: readonly Hit[]
}

const hit = (region: number, damage: number, caliber: string | null, distance = 5, cut?: number): Hit => (cut === undefined ? { region, damage, caliber, distance } : { region, damage, caliber, distance, cut })
const repeat = (count: number, value: Hit): Hit[] => Array.from({ length: count }, () => value)

const OUTFIT = { civilian: 0, police: 1, military: 2, firefighter: 3 }
const SCENARIOS: readonly Scenario[] = [
  { id: 'helmet_then_9mm', type: 'lento', seed: 3, age: 0, outfit: OUTFIT.military, hits: [hit(0, 35, '9x19'), hit(0, 35, '9x19')] },
  { id: 'police_vest_762', type: 'lento', seed: 4, age: 1, outfit: OUTFIT.police, hits: repeat(4, hit(1, 55, '762x39')) },
  { id: 'police_vest_9mm', type: 'corredor', seed: 5, age: 0, outfit: OUTFIT.police, hits: repeat(3, hit(1, 35, '9x19')) },
  { id: 'military_vest_308', type: 'brutamonte', seed: 6, age: 0, outfit: OUTFIT.military, hits: repeat(3, hit(1, 75, '308')) },
  { id: 'leg_to_limp_then_crawl', type: 'lento', seed: 7, age: 1, outfit: OUTFIT.civilian, hits: repeat(5, hit(4, 35, '9x19')) },
  { id: 'both_legs_rifle', type: 'corredor', seed: 8, age: 0, outfit: OUTFIT.civilian, hits: [...repeat(2, hit(4, 55, '762x39')), ...repeat(2, hit(5, 55, '762x39'))] },
  { id: 'arm_severed_by_machete', type: 'lento', seed: 9, age: 2, outfit: OUTFIT.civilian, hits: [hit(2, 70, null, 1, 0.85), hit(3, 40, null, 1, 0.2), hit(3, 40, null, 1, 0.2)] },
  { id: 'arm_broken_not_severed', type: 'lento', seed: 10, age: 1, outfit: OUTFIT.civilian, hits: repeat(3, hit(2, 30, null, 1, 0.1)) },
  { id: 'shotgun_3m_head', type: 'lento', seed: 11, age: 0, outfit: OUTFIT.civilian, hits: repeat(9, hit(0, 12, '12ga', 3)) },
  { id: 'shotgun_12m_head', type: 'inchado', seed: 12, age: 0, outfit: OUTFIT.civilian, hits: repeat(9, hit(0, 12, '12ga', 12)) },
  { id: 'head_9mm_kills', type: 'lento', seed: 13, age: 0, outfit: OUTFIT.civilian, hits: [hit(0, 35, '9x19')] },
  { id: 'head_308_takes_the_skull', type: 'lento', seed: 14, age: 0, outfit: OUTFIT.civilian, hits: [hit(0, 75, '308')] },
  { id: 'melee_head_blows', type: 'lento', seed: 15, age: 0, outfit: OUTFIT.civilian, hits: repeat(4, hit(0, 10, null, 1)) },
  { id: 'firefighter_arm_rifle', type: 'lento', seed: 16, age: 3, outfit: OUTFIT.firefighter, hits: repeat(3, hit(3, 55, '762x39')) },
  { id: 'torso_to_death_brute', type: 'brutamonte', seed: 17, age: 0, outfit: OUTFIT.civilian, hits: repeat(5, hit(1, 55, '762x39')) },
  { id: 'bloater_torso', type: 'inchado', seed: 18, age: 0, outfit: OUTFIT.civilian, hits: repeat(4, hit(1, 35, '9x19')) },
  { id: 'heavy_hit_stuns', type: 'lento', seed: 19, age: 0, outfit: OUTFIT.civilian, hits: [hit(1, 55, '762x39')] },
  { id: 'crawler_leg', type: 'rastejante', seed: 20, age: 0, outfit: OUTFIT.civilian, hits: repeat(3, hit(5, 35, '9x19')) },
]

const runScenario = (harness: DamageHarness, recorder: EventRecorder, scenario: Scenario): void => {
  const { context, effects, setSeed } = harness
  context.Z.n = 0
  setSeed(scenario.seed)
  context.zSpawn(0, 0, context.CAT[scenario.type])
  context.Z.age![0] = scenario.age
  context.Z.roupa![0] = scenario.outfit
  context.Z.capacete![0] = scenario.outfit === OUTFIT.military ? 1 : 0
  effects.length = 0
  recorder.record('start', { scenario: scenario.id, type: scenario.type, seed: scenario.seed, age: scenario.age, outfit: scenario.outfit, ...readState(context, effects) })
  scenario.hits.forEach((step, index) => {
    effects.length = 0
    const result = context.zDamage(0, step.region, step.damage, step.caliber, step.distance, step.cut)
    recorder.record('hit', { scenario: scenario.id, step: index + 1, region: REGIONS[step.region] ?? '', damage: step.damage, caliber: step.caliber ?? 'melee', distance: step.distance, cut: step.cut ?? 0, died: result.morreu === true, headshot: result.headshot === true, ...readState(context, effects) })
  })
}

const JAW_SEEDS = 20

/** G-damage-regions: scripted hit sequences on the game's `zDamage` (6 regions, bitmask, helmet, vest, limp, crawl, jaw). */
export const recordDamageRegionsGolden = (): GoldenRecord => {
  const harness = createDamageHarness()
  const recorder = createEventRecorder()
  for (const scenario of SCENARIOS) runScenario(harness, recorder, scenario)
  for (let seed = 1; seed <= JAW_SEEDS; seed++) {
    runScenario(harness, recorder, { id: `jaw_roll_${seed}`, type: 'lento', seed, age: 0, outfit: OUTFIT.civilian, hits: [hit(0, 30, '12ga', 12)] })
  }
  return createGoldenRecord({ name: 'game-damage-regions', seed: 1, events: recorder.events() })
}
