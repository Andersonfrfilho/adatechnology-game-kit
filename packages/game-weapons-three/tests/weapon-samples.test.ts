// The recorded shots and reload steps (game-audio's assets/sfx/armas): the bank, the shot and the cue playing the files once they are loaded,
// the synthesized sound until then, and the reload clips starting each recorded step early by the time its takes take to reach the hit.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createToolClipPlayer } from '@adatechnology/game-contracts'
import { createSoundRegistry } from '@adatechnology/game-audio'
import type { AudioEngine, PlayOptions, SampleStatus, SfxManifest, SoundBank } from '@adatechnology/game-audio'
import { registerFittedSounds } from '@adatechnology/game-audio/fitted'
import { createArsenal } from '@adatechnology/game-weapons'
import type { CaliberDef } from '@adatechnology/game-weapons'

import { buildWeaponModelById, createWeaponFx } from '../src'
import { CUES_IN_SAMPLE, GUNSHOT_SAMPLE_IDS, RELOAD_CUE_IDS, RELOAD_SAMPLE_HITS, SPEED_OF_SOUND, createWeaponAudio, weaponSampleBank } from '../src/audio'
import { GUNSHOT_IDS } from '../src/audio/recipes'
import { buildToolClips } from '../src/animation/clip-set'

const manifest = JSON.parse(readFileSync(join(__dirname, '../../game-audio/assets/sfx/manifest.json'), 'utf8')) as SfxManifest
const arsenal = createArsenal()
const caliber = (id: string): CaliberDef => {
  const found = arsenal.calibers.get(id)
  if (!found) throw new Error(`no calibre ${id}`)
  return found
}
const armas = manifest.sounds.filter((sound) => sound.category === 'armas')

/** An engine that records what is asked of it; `ready` says which sample sounds have their files. */
const fakeEngine = (ready: ReadonlySet<string>) => {
  const plays: Array<{ id: string; options: PlayOptions }> = []
  const banks: SoundBank[] = []
  let loads = 0
  let calls = 0
  const random = () => ((calls = (calls * 9301 + 49297) % 233280), calls / 233280)
  const registry = createSoundRegistry()
  const engine = {
    registry,
    register: (bank: SoundBank) => void (banks.push(bank), registry.register(bank)),
    channel: () => ({ random, play: (id: string, options: PlayOptions = {}) => (plays.push({ id, options }), null), plan: () => null }),
    sampleStatus: (id: string): SampleStatus => (ready.has(id) ? 'ready' : 'none'),
    loadSamples: async () => {
      loads++
      return { loaded: [], failed: [] }
    },
    setBus: () => undefined,
    dispose: () => undefined,
  } as unknown as AudioEngine
  return { engine, plays, banks, loads: () => loads }
}

describe('the recorded files of the firearms', () => {
  it('cover every calibre profile with near and far takes, and only reload cues the clips play', () => {
    const ids = new Set(armas.map((sound) => sound.id))
    for (const id of GUNSHOT_SAMPLE_IDS.filter((id) => !['revolver_44_50ae', 'antimateriel_50bmg'].includes(id))) {
      const sound = armas.find((entry) => entry.id === id)
      expect(sound, id).toBeDefined()
      expect(sound!.layers.close!.length, `${id} close`).toBeGreaterThanOrEqual(2)
      expect(sound!.layers.far!.length, `${id} far`).toBeGreaterThanOrEqual(2)
    }
    for (const surface of ['concreto', 'terra', 'metal']) expect(ids.has(`casing_drop_${surface}`), surface).toBe(true)
    for (const id of ids) {
      if (GUNSHOT_SAMPLE_IDS.includes(id) || id.startsWith('casing_drop_')) continue
      const cue = id.replace(/_(light|medium|heavy)$/, '')
      expect(RELOAD_CUE_IDS as readonly string[], id).toContain(cue)
      expect(RELOAD_SAMPLE_HITS[cue], `hit of ${cue}`).toBeGreaterThan(0)
      expect(RELOAD_SAMPLE_HITS[cue]).toBeLessThan(0.5)
    }
  })

  it('are CC0 or CC-BY, 48 kHz mono, peak near −1 dBFS, with their source', () => {
    for (const sound of armas) {
      for (const entry of Object.values(sound.layers).flat()) {
        expect(['CC0', 'CC-BY']).toContain(entry!.license)
        expect(entry!.sampleRate).toBe(48000)
        expect(entry!.channels).toBe(1)
        expect(entry!.peak).toBeLessThanOrEqual(-0.5)
        expect(entry!.source).toMatch(/^https:\/\//)
      }
    }
  })

  it('make a bank on the weapons bus: shots with far takes and a choke of three voices, reload steps in tiers by weight, every url mapped', () => {
    const bank = weaponSampleBank({ manifest, url: (file) => `data:${file}` })
    const pistol = bank.samples!.find((sample) => sample.id === 'pistol_9mm')!
    expect(pistol.bus).toBe('weapons')
    expect(pistol.far!.length).toBeGreaterThan(0)
    expect(pistol.choke).toEqual({ voices: 3, fade: 0.06 })
    expect(pistol.close[0]!.url).toMatch(/^data:armas\/pistol_9mm_close_/)
    const seat = bank.samples!.find((sample) => sample.id === 'mag_seat')!
    expect(seat.tiers!.map((tier) => tier.name)).toEqual(['light', 'medium', 'heavy'])
    expect(seat.gain).toBeLessThan(pistol.gain!)
    expect(seat.choke).toBeUndefined()
    expect(seat.tiers![0]!.close[0]!.url).toMatch(/^data:armas\/mag_seat_light_/)
  })
})

describe('createWeaponAudio with samples', () => {
  it('plays the synthesized shot until the files are loaded, and starts loading them once', () => {
    const fake = fakeEngine(new Set())
    const audio = createWeaponAudio(0.6, { engine: fake.engine, samples: { manifest } })
    audio.shot(500, 'pistol', { caliber: caliber('9x19') })
    audio.shot(500, 'pistol', { caliber: caliber('9x19') })
    expect(fake.plays.some((play) => play.id === 'pistol_9mm')).toBe(false)
    expect(fake.plays.some((play) => (Object.values(GUNSHOT_IDS) as string[]).includes(play.id))).toBe(true)
    expect(fake.loads()).toBe(1)
  })

  it('plays the recording of the calibre once loaded: the speed of sound delay, the space, a room tail indoors, and says so', () => {
    const fake = fakeEngine(new Set(['pistol_9mm', 'rifle_5_56']))
    const heard: string[] = []
    const audio = createWeaponAudio(0.6, { engine: fake.engine, samples: { manifest }, onGunshot: (_shot, _input, played) => void heard.push(played.kind) })
    audio.shot(500, 'pistol', { caliber: caliber('9x19'), distance: 170, position: [0, 0, -170] })
    const shot = fake.plays.find((play) => play.id === 'pistol_9mm')!
    expect(shot.options.delay).toBeCloseTo(170 / SPEED_OF_SOUND, 6)
    expect(shot.options.environment).toBe('outdoor')
    expect(shot.options.distance).toBe(170)
    expect(fake.plays.filter((play) => play.id !== 'pistol_9mm')).toEqual([])
    fake.plays.length = 0
    audio.shot(1700, 'rifle', { caliber: caliber('5_56x45'), space: 'indoor' })
    expect(fake.plays[0]!.id).toBe('rifle_5_56')
    expect(fake.plays[0]!.options.environment).toBe('indoor')
    expect(fake.plays.length).toBeGreaterThan(1)
    expect(heard).toEqual(['sample', 'sample'])
  })

  it('plays a reload cue from the takes of the weapon weight, silences the steps the recording carries, and delays the synthesized steps by the lead', () => {
    const fake = fakeEngine(new Set(['mag_seat', 'mag_out']))
    const audio = createWeaponAudio(0.6, { engine: fake.engine, samples: { manifest } })
    audio.cue('mag_seat', { weight: 'light', material: 'polymer' }, 0.094)
    expect(fake.plays).toEqual([{ id: 'mag_seat', options: { intensity: 0.1 } }])
    fake.plays.length = 0
    for (const [cue] of Object.entries(CUES_IN_SAMPLE)) audio.cue(cue, { weight: 'heavy', material: 'steel' })
    expect(fake.plays).toEqual([])
    audio.cue('pump_back', { weight: 'heavy', material: 'steel' }, 0.094)
    expect(fake.plays.length).toBeGreaterThan(0)
    for (const play of fake.plays) expect(play.options.delay ?? 0).toBeGreaterThanOrEqual(0.094 - 1e-9)
  })
})

describe('the fitted copies of the recordings', () => {
  it('play under the recorded id while the files load, instead of the synthesized layers, and say so', () => {
    const fake = fakeEngine(new Set())
    const shots: string[] = []
    const cases: string[] = []
    const audio = createWeaponAudio(0.6, { engine: fake.engine, samples: { manifest }, onGunshot: (_shot, _input, played) => void shots.push(played.kind), onCasing: (_sound, played) => void cases.push(played) })
    registerFittedSounds(fake.engine)
    audio.shot(500, 'pistol', { caliber: caliber('9x19') })
    expect(fake.plays.map((play) => play.id)).toEqual(['pistol_9mm'])
    expect(shots).toEqual(['fitted'])
    fake.plays.length = 0
    expect(audio.cue('mag_seat', { weight: 'light', material: 'polymer' })).toBe('fitted')
    expect(fake.plays.map((play) => play.id)).toEqual(['mag_seat'])
    fake.plays.length = 0
    audio.casing({ caseType: 'pistol', surface: 'concrete', bounce: 0 })
    expect(fake.plays.map((play) => play.id)).toEqual(['casing_drop_concreto'])
    expect(cases).toEqual(['fitted'])
    expect(fake.loads()).toBe(1)
  })
})

describe('a case landing with samples', () => {
  it('plays the bounces of its floor once, on the first hit; wood and a shell hull stay synthesized', () => {
    const fake = fakeEngine(new Set(['casing_drop_concreto', 'casing_drop_metal']))
    const heard: string[] = []
    const audio = createWeaponAudio(0.6, { engine: fake.engine, samples: { manifest }, onCasing: (_sound, played) => void heard.push(played) })
    audio.casing({ caseType: 'pistol', surface: 'concrete', bounce: 0 })
    audio.casing({ caseType: 'pistol', surface: 'concrete', bounce: 1 })
    expect(fake.plays.map((play) => play.id)).toEqual(['casing_drop_concreto'])
    fake.plays.length = 0
    audio.casing({ caseType: 'shell', surface: 'steel' })
    audio.casing({ caseType: 'rifle', surface: 'wood_hard' })
    expect(fake.plays.some((play) => play.id.startsWith('casing_drop_'))).toBe(false)
    expect(heard).toEqual(['sample', 'sample', 'synth', 'synth'])
  })
})

describe('the reload clips follow the recordings', () => {
  it('start each recorded step its hit early, in real time, so the click lands where the part stops', () => {
    const model = buildWeaponModelById(THREE, 'colt_m4a1')!
    const clips = buildToolClips({ parts: model.parts, family: model.parts.family, caseType: 'rifle', reloadFamily: 'magazine' })
    const written = (clips.reload_empty ?? clips.reload)!.events!.filter((event) => event.type === 'sound')
    const seat = written.find((event) => event.data?.id === 'mag_seat')!
    expect(seat.lead).toBe(RELOAD_SAMPLE_HITS.mag_seat)
    for (const duration of [2.5, 5]) {
      const player = createToolClipPlayer({ clips, rig: { setPartPose: () => undefined } })
      player.apply({ type: 'play', clip: 'reload', variant: 'empty', duration })
      const clip = player.running[0]!.clip
      const played = clip.events!.find((event) => event.data?.id === 'mag_seat')!
      const factor = duration / (clips.reload_empty ?? clips.reload)!.duration
      expect(played.t + Number(played.data!.lead)).toBeCloseTo(seat.t * factor, 6)
      expect(played.data!.lead).toBeCloseTo(RELOAD_SAMPLE_HITS.mag_seat!, 6)
      const times = clip.events!.map((event) => event.t)
      expect(times).toEqual([...times].sort((a, b) => a - b))
    }
  })

  it('loads the recordings as the weapon comes to the hands, before the first shot', () => {
    const fake = fakeEngine(new Set())
    const audio = createWeaponAudio(0.6, { engine: fake.engine, samples: { manifest } })
    const weapon = 'glock_17'
    const tool = { weapon, category: 'handgun', ammo: 10, capacity: 17, reserve: 40, reloading: false }
    const fx = createWeaponFx({ THREE, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), arsenal, groundAt: () => 0, audio, tool: () => tool })
    expect(fake.loads()).toBe(0)
    fx.handle({ type: 'tool', weapon }, tool)
    expect(fake.loads()).toBe(1)
    fx.dispose()
  })
})
