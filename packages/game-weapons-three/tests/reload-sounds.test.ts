import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import { createToolClipPlayer } from '@adatechnology/game-contracts'
import { createArsenal } from '@adatechnology/game-weapons'
import { createWeaponsTestModule } from '../src'
import { RELOAD_CUES, RELOAD_CUE_IDS, reloadCueSteps, soundProfileOf } from '../src/audio'
import { buildToolClips } from '../src/animation/clip-set'
import { buildWeaponModelById } from '../src/models'
import { auditWeapons } from './support/weapon-audit'

const audit = auditWeapons()
const LAYERS = new Set(['metal', 'thud', 'scene_tone', 'scene_noise', 'class'])

/** The cues each family's reload makes, in order: the template its clips must follow. */
const MAGAZINE = ['mag_release', 'mag_out', 'mag_insert', 'mag_seat']
const TEMPLATES: Record<string, { tactical: string[]; empty: string[] }> = {
  pistol: { tactical: MAGAZINE, empty: [...MAGAZINE, 'slide_release'] },
  rifle: { tactical: MAGAZINE, empty: [...MAGAZINE, 'charging_handle_pull', 'charging_handle_release'] },
  p90: { tactical: MAGAZINE, empty: [...MAGAZINE, 'charging_handle_pull', 'charging_handle_release'] },
  boltmag: { tactical: [...MAGAZINE, 'bolt_lift', 'bolt_pull', 'bolt_push', 'bolt_lock'], empty: [...MAGAZINE, 'bolt_lift', 'bolt_pull', 'bolt_push', 'bolt_lock'] },
  belt: { tactical: ['belt_cover_open', 'belt_insert', 'belt_cover_close', 'charging_handle_pull', 'charging_handle_release'], empty: ['belt_cover_open', 'belt_insert', 'belt_cover_close', 'charging_handle_pull', 'charging_handle_release'] },
  bolt: { tactical: ['bolt_lift', 'bolt_pull', 'bolt_push', 'bolt_lock'], empty: ['bolt_lift', 'bolt_pull', 'bolt_push', 'bolt_lock'] },
  break: { tactical: ['barrels_open', 'casings_eject', 'shell_insert', 'shell_insert', 'barrels_close'], empty: ['barrels_open', 'casings_eject', 'shell_insert', 'shell_insert', 'barrels_close'] },
  pump: { tactical: [], empty: ['pump_back', 'pump_forward'] },
  lever: { tactical: [], empty: ['lever_open', 'lever_close'] },
  semi12: { tactical: [], empty: ['charging_handle_pull', 'charging_handle_release'] },
  semiint: { tactical: ['charging_handle_pull', 'charging_handle_release'], empty: ['charging_handle_pull', 'charging_handle_release'] },
}
const REVOLVER = (kind: string): string[] => ['cylinder_open', 'cylinder_eject', ...(kind === 'one_by_one' ? [] : ['speedloader']), 'cylinder_close']

describe('every cue has a recipe', () => {
  it('each cue id has layers the game-audio synth plays, and each layer has the numbers it needs', () => {
    expect(RELOAD_CUE_IDS.length).toBeGreaterThanOrEqual(30)
    for (const id of RELOAD_CUE_IDS) {
      const steps = RELOAD_CUES[id]!
      expect(steps.length, id).toBeGreaterThan(0)
      for (const step of steps) {
        expect(LAYERS.has(step.layer), `${id}: ${step.layer}`).toBe(true)
        expect(step.at, id).toBeGreaterThanOrEqual(0)
        expect(step.at, id).toBeLessThan(0.6)
      }
    }
  })

  it('every cue the clips carry has a recipe, and every recipe is used by some weapon', () => {
    const used = new Set<string>()
    for (const row of audit) for (const run of row.runs) for (const cue of run.clip?.cues ?? []) used.add(cue.id)
    for (const id of used) expect(RELOAD_CUES[id], id).toBeDefined()
    expect([...RELOAD_CUE_IDS].filter((id) => !used.has(id))).toEqual([])
  })

  it('a heavier weapon sounds lower and louder, a polymer frame duller and softer', () => {
    const pitch = (id: string, weapon: string, family: string): number => {
      const step = reloadCueSteps('slide_release', soundProfileOf(weapon, family))[0]!
      return step.layer === 'metal' ? step.frequency : 0
    }
    expect(pitch('slide_release', 'makarov_pm', 'pistol')).toBeGreaterThan(pitch('slide_release', 'colt_m4a1', 'rifle'))
    expect(pitch('slide_release', 'colt_m4a1', 'rifle')).toBeGreaterThan(pitch('slide_release', 'remington_870', 'pump'))
    expect(pitch('slide_release', 'glock_17', 'pistol')).toBeLessThan(pitch('slide_release', 'makarov_pm', 'pistol'))
    const gain = (weapon: string, family: string): number => {
      const step = reloadCueSteps('mag_seat', soundProfileOf(weapon, family)).find((entry) => entry.layer === 'scene_tone')
      return step?.layer === 'scene_tone' ? step.vol : 0
    }
    expect(gain('glock_17', 'pistol')).toBeLessThan(gain('makarov_pm', 'pistol'))
    expect(gain('remington_870', 'pump')).toBeGreaterThan(gain('colt_m4a1', 'rifle'))
  })

  it('the weapons listed as polymer exist', () => {
    const arsenal = createArsenal({ seed: 1 })
    for (const row of audit) expect(arsenal.weapons.has(row.id)).toBe(true)
    for (const id of ['glock_17', 'glock_18', 'glock_19', 'taurus_g2c', 'taurus_ts9', 'fn_five_seven', 'pistol_9mm', 'fn_p90', 'hk_ump_45']) expect(soundProfileOf(id, 'pistol').material).toBe('polymer')
  })
})

describe('the cues of every reload', () => {
  for (const row of audit) {
    if (row.runs.length === 0) continue
    describe(row.id, () => {
      for (const run of row.runs) {
        it(`${run.scenario} (${run.kind}): the cues come in order within the ${run.seconds} s of the reload`, () => {
          const cues = run.clip!.cues
          // loading round by round is heard as the rule feeds the rounds (the feed clip), so the clip of a tube weapon holds none
          const byFeed = run.kind === 'one_by_one' && ['pump', 'lever', 'semi12'].includes(row.modelFamily)
          if (!byFeed) expect(cues.length).toBeGreaterThan(0)
          for (const cue of cues) {
            expect(cue.at).toBeGreaterThanOrEqual(0)
            expect(cue.at).toBeLessThanOrEqual(run.seconds + 1e-6)
          }
          expect(cues.map((cue) => cue.at)).toEqual([...cues.map((cue) => cue.at)].sort((a, b) => a - b))
          if (row.modelFamily === 'revolver') {
            expect(cues.map((cue) => cue.id)).toEqual(REVOLVER(run.clip!.name === 'reload_one_by_one' ? 'one_by_one' : run.kind))
          } else if (row.modelFamily === 'rocket') {
            expect(cues.length).toBeGreaterThanOrEqual(2)
          } else {
            const template = TEMPLATES[row.modelFamily]
            expect(template, `no template for ${row.modelFamily}`).toBeDefined()
            // one by one weapons hear the rounds as the rule feeds them, not inside the clip
            const expected = run.kind === 'one_by_one' ? (template!.tactical.length === 0 ? [] : template!.tactical) : run.kind === 'empty' ? template!.empty : template!.tactical
            const heard = cues.map((cue) => cue.id)
            if (run.kind === 'one_by_one' && row.modelFamily !== 'bolt') expect(heard.every((id) => expected.includes(id) || id === 'shell_insert')).toBe(true)
            else expect(heard).toEqual(expected)
          }
        })
      }
    })
  }
})

describe('the cues follow the duration of the weapon', () => {
  it('the same clip played in twice the time puts every cue at twice the second', () => {
    const model = buildWeaponModelById(THREE, 'colt_m4a1')!
    const clips = buildToolClips({ parts: model.parts, family: model.parts.family, caseType: 'rifle', reloadFamily: 'magazine' })
    const at = (duration: number): number[] => {
      const player = createToolClipPlayer({ clips, rig: { setPartPose: () => undefined } })
      player.apply({ type: 'play', clip: 'reload', variant: 'empty', duration })
      return (player.running[0]!.clip.events ?? []).filter((event) => event.type === 'sound').map((event) => event.t)
    }
    const short = at(3)
    const long = at(6)
    expect(short.length).toBe(6)
    short.forEach((t, index) => expect(long[index]).toBeCloseTo(t * 2, 6))
  })
})

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}
const setup = (locale: 'en' | 'pt-BR'): TestRoom => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const arsenal = createArsenal({ seed: 1, rules: { faults: false } })
  const room = createTestRoom({ THREE, container, locale, catalog: [], renderer: stubRenderer(), ui: false, arsenal })
  expect(room.loadModule(createWeaponsTestModule({ locale, sound: false, arsenal })).problems).toEqual([])
  room.look([0, 1.7, 5], [0, 1.2, -11])
  return room
}
const step = (room: TestRoom, frames: number): void => {
  for (let i = 0; i < frames; i++) room.update(1 / 60)
}

describe('the test room logs a sound per cue', () => {
  const emptied = (room: TestRoom, weapon: string): void => {
    room.setTool(weapon)
    step(room, 40)
    for (let n = 0; room.tool.ammo > 0 && n < 120; n++) {
      room.use()
      step(room, 6)
    }
    step(room, 60)
  }

  it.each(['glock_17', 'colt_m4a1', 'ak_47'])('%s: an empty reload logs its cues in order, each at the second its clip gives it', (weapon) => {
    const room = setup('en')
    emptied(room, weapon)
    const before = room.log.entries().length
    const started = room.log.entries().at(-1)!.t
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))
    step(room, 60 * 6)
    const sounds = room.log.entries({ type: 'sound' }).slice(0)
    const mine = room.log.entries().slice(before).filter((entry) => entry.type === 'sound')
    expect(sounds.length).toBeGreaterThanOrEqual(mine.length)
    const row = audit.find((entry) => entry.id === weapon)!
    const run = row.runs.find((entry) => entry.scenario === 'empty')!
    expect(mine.map((entry) => (entry.data as { cue: string }).cue)).toEqual(run.clip!.cues.map((cue) => cue.id))
    const first = mine[0]!.t
    expect(first).toBeGreaterThanOrEqual(started)
    mine.forEach((entry, index) => {
      expect(Math.abs(entry.t - first - run.clip!.cues[index]!.at + run.clip!.cues[0]!.at)).toBeLessThan(0.1)
    })
    expect(mine.at(-1)!.t - first).toBeLessThanOrEqual(run.seconds + 0.1)
  })

  it('a tactical reload (a round chambered) never logs the charging cues', () => {
    const room = setup('en')
    room.setTool('colt_m4a1')
    step(room, 40)
    room.use()
    step(room, 20)
    const before = room.log.entries().length
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))
    step(room, 60 * 6)
    const heard = room.log.entries().slice(before).filter((entry) => entry.type === 'sound').map((entry) => (entry.data as { cue: string }).cue)
    expect(heard).toEqual(MAGAZINE)
  })

  it.each(['remington_870', 'winchester_1894', 'sw_686'])('%s: loading round by round sounds once per round', (weapon) => {
    const room = setup('en')
    room.setTool(weapon)
    step(room, 40)
    for (let shot = 0; shot < 3; shot++) {
      room.use()
      step(room, 60)
    }
    const missing = room.tool.capacity - room.tool.ammo
    expect(missing).toBeGreaterThanOrEqual(3)
    const before = room.log.entries().length
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))
    step(room, 60 * 12)
    expect(room.tool.ammo).toBe(room.tool.capacity)
    const heard = room.log.entries().slice(before).filter((entry) => entry.type === 'sound').map((entry) => (entry.data as { cue: string }).cue)
    expect(heard.filter((cue) => cue === 'shell_insert')).toHaveLength(missing)
  })

  it('names the cue in the language of the room', () => {
    const lines = (locale: 'en' | 'pt-BR'): string[] => {
      const room = setup(locale)
      room.setTool('glock_17')
      step(room, 40)
      room.use()
      step(room, 20)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))
      step(room, 60 * 4)
      return room.log.entries({ type: 'sound' }).map((entry) => entry.text)
    }
    const en = lines('en')
    const pt = lines('pt-BR')
    expect(en.length).toBe(4)
    expect(en[0]).toContain('Sound')
    expect(pt[0]).toContain('Som')
    expect(en[3]).toContain('seats')
    expect(pt[3]).toContain('encaixa')
  })
})
