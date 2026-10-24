import { createEventRecorder, createGoldenRecord, createSeededRandom } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'

import { evaluateGameSlice } from './game-context'
import type { GameContext } from './game-context'

type Field = { [index: number]: number }
type PenetrationContext = {
  readonly Z: { n: number } & Readonly<Record<string, Field>>
  readonly CAT: Readonly<Record<string, number>>
  readonly CALIBRES: Readonly<Record<string, { readonly alc: number; readonly pen: number; readonly dano: number }>>
  readonly zSpawn: (x: number, z: number, forcedType?: number) => number
  readonly shootRay: (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, caliber: unknown, weapon: unknown) => unknown
} & GameContext

type Body = { readonly type: string; readonly distance: number; readonly region: number }
type Line = { readonly id: string; readonly caliber: string; readonly bodies: readonly Body[] }

const torso = (type: string, distance: number): Body => ({ type, distance, region: 1 })
const WALKERS = [3, 4, 5, 6, 7].map((distance) => torso('lento', distance))
const LINES: readonly Line[] = [
  ...['9x19', '12ga', '762x39', '308'].map((caliber) => ({ id: `walkers_${caliber}`, caliber, bodies: WALKERS })),
  { id: 'brute_first_762', caliber: '762x39', bodies: [torso('brutamonte', 3), ...WALKERS.slice(1)] },
  { id: 'brute_second_308', caliber: '308', bodies: [torso('lento', 3), torso('brutamonte', 4), ...WALKERS.slice(2)] },
  { id: 'mixed_9mm', caliber: '9x19', bodies: [torso('corredor', 3), torso('inchado', 4), torso('rastejante', 5), torso('lento', 6), torso('cego', 7)] },
  { id: 'limbs_308', caliber: '308', bodies: [{ type: 'lento', distance: 3, region: 4 }, { type: 'lento', distance: 4, region: 2 }, { type: 'lento', distance: 5, region: 3 }, { type: 'lento', distance: 6, region: 5 }, torso('lento', 7)] },
  { id: 'heads_762', caliber: '762x39', bodies: [{ type: 'lento', distance: 3, region: 0 }, { type: 'lento', distance: 4, region: 0 }, { type: 'lento', distance: 5, region: 0 }, torso('lento', 6), torso('lento', 7)] },
  { id: 'far_walkers_762', caliber: '762x39', bodies: [10, 260, 270, 280, 290].map((distance) => torso('lento', distance)) },
]

/** G-penetration: the game's `shootRay` (and `zDamage`) against lines of five bodies; the world and the hit list are stubs, the bodies die in place. */
export const recordPenetrationGolden = (): GoldenRecord => {
  const recorder = createEventRecorder()
  let stream = createSeededRandom(1)
  const dead = new Set<number>()
  let slots: readonly Body[] = []
  const events: Record<string, number | string | boolean>[] = []
  const noop = () => undefined
  const scope = {
    R: () => stream(),
    worldRay: () => null,
    rayExplo: () => null,
    rayZombies: (ox: number) =>
      slots.map((body, index) => ({ i: index, t: body.distance - ox, reg: body.region })).filter((entry) => !dead.has(entry.i) && entry.t > 0),
    fxSpark: noop, sfx: noop, fxBlood: noop, fxLimb: noop, hudHit: noop, zKill: (index: number) => void dead.add(index),
    __log: (index: number, region: number, damage: number, dist: number) => events.push({ body: index + 1, region, damage, distance: dist }),
  }
  const context = evaluateGameSlice<PenetrationContext>({
    functions: ['zSpawn', 'zSpecialSpawn', 'zDamage', 'shootRay'],
    exports: ['Z', 'CAT', 'CALIBRES', 'zSpawn', 'shootRay'],
    scope: { ...scope, ZMAX: 8 },
    tail: 'const __realZDamage = zDamage; zDamage = function (i, reg, dmg, cal, t, corte) { __log(i, reg, dmg, t); return __realZDamage(i, reg, dmg, cal, t, corte) }',
  })
  const { Z, CAT, CALIBRES, zSpawn, shootRay } = context
  const REGIONS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR']
  for (const line of LINES) {
    slots = line.bodies
    dead.clear()
    events.length = 0
    stream = createSeededRandom(1)
    Z.n = 0
    line.bodies.forEach((body, slot) => {
      zSpawn(slot, 0, CAT[body.type])
      Z.age![slot] = 0
      Z.roupa![slot] = 0
      Z.capacete![slot] = 0
    })
    const caliber = CALIBRES[line.caliber]
    if (!caliber) throw new Error(`no game calibre ${line.caliber}`)
    const hpBefore = line.bodies.map((_, slot) => Z.hp![slot] ?? 0)
    shootRay(0, 1.4, 0, 1, 0, 0, { ...caliber }, { cal: line.caliber })
    const hit = events.map((entry) => entry.body as number)
    line.bodies.forEach((body, slot) => {
      const step = events.find((entry) => entry.body === slot + 1)
      recorder.record('body', {
        line: line.id,
        caliber: line.caliber,
        body: slot + 1,
        type: body.type,
        region: REGIONS[body.region] ?? '',
        distance: body.distance,
        reached: step !== undefined,
        damage: step ? (step.damage as number) : 0,
        health: Z.hp![slot] ?? 0,
        healthBefore: hpBefore[slot] ?? 0,
        died: dead.has(slot),
      })
    })
    recorder.record('line', { line: line.id, caliber: line.caliber, bodiesHit: hit.length, stoppedAt: hit.length === 0 ? 0 : Math.max(...hit) })
  }
  return createGoldenRecord({ name: 'game-penetration', seed: 1, events: recorder.events() })
}
