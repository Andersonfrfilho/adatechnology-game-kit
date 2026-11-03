import { describe, expect, it } from 'vitest'

import { createArsenal } from '@adatechnology/game-weapons'
import type { CaliberDef } from '@adatechnology/game-weapons'

import { GUNSHOT_CALIBER_PROFILES, GUNSHOT_PROFILES, GUNSHOT_TAKES, SPEED_OF_SOUND, computeGunshot, createWeaponAudio, pickTake } from '../src/audio'
import type { Gunshot } from '../src/audio'
import { createFakeContext } from './support/fake-audio'

const arsenal = createArsenal()
const caliber = (id: string): CaliberDef => {
  const found = arsenal.calibers.get(id)
  if (!found) throw new Error(`no calibre ${id}`)
  return found
}
const part = (shot: Gunshot, group: string, name: string) => shot.voices.find((voice) => voice.group === group && voice.part === name)
const total = (shot: Gunshot, group: string): number => shot.voices.filter((voice) => voice.group === group).reduce((sum, voice) => sum + voice.gain, 0)
const db = (ratio: number): number => 20 * Math.log10(ratio)

describe('computeGunshot: the right sound for the calibre (C2)', () => {
  it('links every firearm calibre of the arsenal to a profile of the table', () => {
    for (const weapon of arsenal.weapons.values()) {
      if (weapon.action.kind !== 'firearm') continue
      const cal = arsenal.calibers.get(weapon.action.caliber)
      if (!cal || cal.id === 'arrow' || cal.id === 'crossbow_bolt') continue
      expect(GUNSHOT_CALIBER_PROFILES[cal.id], `${weapon.id} (${cal.id})`).toBeDefined()
      expect(GUNSHOT_PROFILES[GUNSHOT_CALIBER_PROFILES[cal.id]!]).toBeDefined()
    }
  })

  it('gives each family its own character: a .45 is lower and longer than a 9 mm, a 7.62x39 lower than a 5.56, a shotgun the widest', () => {
    const shot = (id: string, category: string): Gunshot => computeGunshot({ caliber: caliber(id), category })
    const p9 = shot('9x19', 'pistol')
    const p45 = shot('45acp', 'pistol')
    const r556 = shot('5_56x45', 'rifle')
    const r762 = shot('7_62x39', 'rifle')
    const sg = shot('12ga_00buck', 'shotgun')
    expect(p9.profile).toBe('pistol_9mm')
    expect(p45.profile).toBe('pistol_45')
    expect(part(p45, 'close', 'blast')!.frequency).toBeLessThan(part(p9, 'close', 'blast')!.frequency)
    expect(part(p45, 'close', 'body')!.seconds).toBeGreaterThan(part(p9, 'close', 'body')!.seconds)
    expect(part(r762, 'close', 'blast')!.frequency).toBeLessThan(part(r556, 'close', 'blast')!.frequency)
    expect(part(r556, 'close', 'crack')!.frequency).toBeGreaterThan(part(p9, 'close', 'crack')!.frequency)
    expect(part(sg, 'close', 'blast')!.seconds).toBeGreaterThan(part(r556, 'close', 'blast')!.seconds)
    expect(part(sg, 'close', 'blast')!.frequency).toBeLessThan(part(r762, 'close', 'blast')!.frequency)
  })

  it('makes a slug drier than buckshot and a .357 louder than a .38 of the same family', () => {
    const buck = computeGunshot({ caliber: caliber('12ga_00buck'), category: 'shotgun' })
    const slug = computeGunshot({ caliber: caliber('12ga_slug'), category: 'shotgun' })
    expect(part(slug, 'close', 'blast')!.seconds).toBeLessThan(part(buck, 'close', 'blast')!.seconds)
    const s38 = computeGunshot({ caliber: caliber('38spl'), category: 'revolver' })
    const s357 = computeGunshot({ caliber: caliber('357mag'), category: 'revolver' })
    expect(s357.profile).toBe(s38.profile)
    expect(total(s357, 'close')).toBeGreaterThan(total(s38, 'close'))
  })
})

describe('computeGunshot: distance and delay (C1, C3)', () => {
  const rifle = (distance: number): Gunshot => computeGunshot({ caliber: caliber('5_56x45'), category: 'rifle', distance })

  it('starts the close sound on the trigger at 0 m and arrives d / 343 s late far away', () => {
    expect(part(rifle(0), 'close', 'crack')!.at).toBe(0)
    expect(part(rifle(0), 'close', 'blast')!.at).toBe(0)
    const far = rifle(200)
    expect(far.delay).toBeCloseTo(200 / SPEED_OF_SOUND, 6)
    for (const voice of far.voices) expect(voice.at).toBeGreaterThanOrEqual(far.delay)
  })

  it('gets quieter and duller at 1, 10, 50 and 200 m, and swaps to the far boom past ~50 m', () => {
    const levels = [1, 10, 50, 200].map((d) => rifle(d))
    for (let i = 1; i < levels.length; i++) {
      const before = total(levels[i - 1]!, 'close') + total(levels[i - 1]!, 'far')
      const after = total(levels[i]!, 'close') + total(levels[i]!, 'far')
      expect(after).toBeLessThan(before)
    }
    expect(levels[0]!.closeMix).toBe(1)
    expect(levels[3]!.closeMix).toBe(0)
    expect(total(levels[3]!, 'close')).toBe(0)
    expect(total(levels[3]!, 'far')).toBeGreaterThan(0)
    expect(part(levels[3]!, 'far', 'boom')!.frequency).toBeLessThan(part(levels[0]!, 'close', 'blast')!.frequency)
    // the crack (the highs) is gone before the boom
    expect(part(levels[2]!, 'close', 'crack')?.gain ?? 0).toBeLessThan(part(levels[1]!, 'close', 'crack')!.gain / 2)
  })

  it('still carries a rifle at 800 m, and a .22 fades sooner than a .50 BMG', () => {
    expect(rifle(800).audible).toBe(true)
    const small = computeGunshot({ caliber: caliber('22lr'), category: 'pistol', distance: 600 })
    const big = computeGunshot({ caliber: caliber('50bmg'), category: 'sniper', distance: 600 })
    expect(total(big, 'far')).toBeGreaterThan(total(small, 'far') * 2)
  })
})

describe('computeGunshot: room and field (C8)', () => {
  it('answers indoors at once with a short tail sent to the reverb, outdoors late with a long tail and echoes', () => {
    const outdoor = computeGunshot({ caliber: caliber('9x19'), category: 'pistol', space: 'outdoor' })
    const indoor = computeGunshot({ caliber: caliber('9x19'), category: 'pistol', space: 'indoor' })
    const inTail = part(indoor, 'tail', 'tail')!
    const outTail = part(outdoor, 'tail', 'tail')!
    expect(inTail.wet).toBeGreaterThan(0)
    expect(outTail.wet).toBeUndefined()
    expect(inTail.seconds).toBeLessThan(outTail.seconds)
    expect(indoor.voices.some((voice) => voice.part === 'reflection' && voice.at < 0.03)).toBe(true)
    expect(outdoor.voices.filter((voice) => voice.part === 'echo').every((voice) => voice.at > 0.3)).toBe(true)
    expect(indoor.samples.tail).toBe('gunshot_tail_indoor')
    expect(outdoor.samples.tail).toBe('gunshot_tail_outdoor')
  })
})

describe('computeGunshot: suppressor', () => {
  it('takes the blast at least 15 dB down, keeps the crack of a supersonic rifle and makes the action stand out', () => {
    const open = computeGunshot({ caliber: caliber('5_56x45'), category: 'rifle' })
    const quiet = computeGunshot({ caliber: caliber('5_56x45'), category: 'rifle', suppressed: true })
    expect(db(part(quiet, 'close', 'blast')!.gain / part(open, 'close', 'blast')!.gain)).toBeLessThan(-15)
    expect(part(quiet, 'close', 'crack')!.gain).toBeGreaterThan(part(open, 'close', 'crack')!.gain * 0.3)
    expect(part(quiet, 'mech', 'action')!.gain).toBeGreaterThan(part(open, 'mech', 'action')!.gain)
    expect(quiet.samples.close).toBe('suppressed_rifle')
    const pistol = computeGunshot({ caliber: caliber('9x19'), category: 'pistol', suppressed: true })
    expect(pistol.samples.close).toBe('suppressed_pistol')
  })
})

describe('takes and pitch (C5)', () => {
  it('never picks the same take twice in a row and uses all of them', () => {
    let seed = 1
    const random = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    let last: number | undefined
    const seen = new Set<number>()
    for (let i = 0; i < 1000; i++) {
      const take = pickTake(last, random)
      expect(take).not.toBe(last)
      seen.add(take)
      last = take
    }
    expect(seen.size).toBe(GUNSHOT_TAKES)
  })

  it('plays ten shots of the same weapon with no two consecutive alike, pitch within ±4 %', () => {
    const fake = createFakeContext()
    const audio = createWeaponAudio(0.6, { seed: 3, createContext: () => fake.context })
    const shots: Gunshot[] = []
    let last: number | undefined
    for (let i = 0; i < 10; i++) {
      const take = pickTake(last, Math.random)
      last = take
      shots.push(audio.gunshot({ caliber: caliber('9x19'), category: 'pistol', take, pitch: 0.96 + i * 0.008 }))
      audio.shot(500, 'pistol', { caliber: caliber('9x19') })
    }
    for (let i = 1; i < shots.length; i++) expect(part(shots[i]!, 'close', 'blast')!.frequency).not.toBe(part(shots[i - 1]!, 'close', 'blast')!.frequency)
    expect(fake.starts.length).toBeGreaterThan(30)
  })
})

describe('computeCasingSound (casing_drop_<surface>)', () => {
  it('rings brass on concrete and longer on steel, knocks short on wood, taps on dirt, and a shotgun hull toks', async () => {
    const { computeCasingSound } = await import('../src/audio')
    const ring = (s: ReturnType<typeof computeCasingSound>): number => Math.max(0, ...s.voices.filter((v) => v.kind === 'tone').map((v) => v.seconds))
    const concrete = computeCasingSound({ caseType: 'pistol', surface: 'concrete' })
    const steel = computeCasingSound({ caseType: 'pistol', surface: 'steel' })
    const wood = computeCasingSound({ caseType: 'pistol', surface: 'wood_hard' })
    const dirt = computeCasingSound({ caseType: 'pistol', surface: 'soil' })
    const shell = computeCasingSound({ caseType: 'shell', surface: 'concrete' })
    expect(ring(steel)).toBeGreaterThan(ring(concrete))
    expect(ring(concrete)).toBeGreaterThan(ring(wood))
    expect(ring(dirt)).toBe(0)
    expect(shell.voices.some((v) => v.kind === 'noise' && v.filter === 'bandpass')).toBe(true)
    expect(ring(shell)).toBeLessThan(ring(concrete))
    expect(concrete.sample).toBe('casing_drop_concreto_pistol')
    expect(computeCasingSound({ caseType: 'rifle', surface: 'soil' }).sample).toBe('casing_drop_terra_rifle')
    // a rifle case rings lower than a pistol case; each bounce is softer
    const lowest = (s: ReturnType<typeof computeCasingSound>): number => Math.min(...s.voices.filter((v) => v.kind === 'tone').map((v) => v.frequency))
    expect(lowest(computeCasingSound({ caseType: 'rifle', surface: 'concrete' }))).toBeLessThan(lowest(concrete))
    const second = computeCasingSound({ caseType: 'pistol', surface: 'concrete', bounce: 1 })
    expect(second.voices[0]!.gain).toBeLessThan(concrete.voices[0]!.gain)
  })
})

describe('computeFlyby (bullet_crack_by / bullet_whiz)', () => {
  it('cracks for a supersonic bullet, whizzes for a subsonic one, and is silent past 6 m', async () => {
    const { computeFlyby } = await import('../src/audio')
    const crack = computeFlyby({ speed: 900, miss: 1 })!
    const whiz = computeFlyby({ speed: 300, miss: 1 })!
    expect(crack.sample).toBe('bullet_crack_by')
    expect(whiz.sample).toBe('bullet_whiz')
    expect(Math.max(...crack.voices.map((v) => v.seconds))).toBeLessThan(Math.max(...whiz.voices.map((v) => v.seconds)))
    expect(computeFlyby({ speed: 900, miss: 7 })).toBeNull()
    expect(computeFlyby({ speed: 900, miss: 0.5 })!.voices[0]!.gain).toBeGreaterThan(computeFlyby({ speed: 900, miss: 4 })!.voices[0]!.gain)
  })
})

describe('computeGunshot: behind a wall (C4)', () => {
  it('is quieter and duller when occluded', () => {
    const open = computeGunshot({ caliber: caliber('9x19'), category: 'pistol', distance: 10 })
    const wall = computeGunshot({ caliber: caliber('9x19'), category: 'pistol', distance: 10, occlusion: 1 })
    expect(total(wall, 'close')).toBeLessThan(total(open, 'close'))
    expect(part(wall, 'close', 'blast')!.frequency).toBeLessThan(part(open, 'close', 'blast')!.frequency * 0.5)
  })
})
