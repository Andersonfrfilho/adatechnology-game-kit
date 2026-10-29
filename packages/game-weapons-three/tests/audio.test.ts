import { describe, expect, it } from 'vitest'

import { CALIBERS, RELOAD_STAGES } from '@adatechnology/game-weapons'
import type { CaliberDef, ReloadStageId } from '@adatechnology/game-weapons'

import { computeShotSound, createWeaponAudio, MECHANICAL_SOUNDS, mechanicalSoundOf } from '../src'

const caliberOf = (id: string): CaliberDef => {
  const found = CALIBERS.find((caliber) => caliber.id === id)
  if (!found) throw new Error(`calibre ${id}`)
  return found
}

// the game: att = 1 / (1 + d² × 0.004), cutoff = P[0] / (1 + d × 0.01), gain = P[1] × att, seconds = P[2]; jogo.js L62092, L62105-L62108
const gameShot = (cutoff: number, gain: number, seconds: number, distance: number) => ({
  cutoff: cutoff / (1 + distance * 0.01),
  gain: gain / (1 + distance * distance * 0.004),
  duration: seconds,
})

describe('computeShotSound: the game classes and distance at the game calibres', () => {
  // jogo.js L68697: 12ga escopeta [900, 1.2, 0.35], 9x19 pistola [1800, 0.9, 0.18], 308 rifle [1100, 1.3, 0.45], the rest fuzil [1400, 1.1, 0.28]
  const cases = [
    { id: '9x19', soundClass: 'pistol', row: [1800, 0.9, 0.18] },
    { id: '12ga_00buck', soundClass: 'shotgun', row: [900, 1.2, 0.35] },
    { id: '7_62x39', soundClass: 'rifle', row: [1400, 1.1, 0.28] },
    { id: '7_62x51', soundClass: 'long_rifle', row: [1100, 1.3, 0.45] },
  ] as const

  for (const { id, soundClass, row } of cases) {
    for (const distance of [0, 10, 60, 120]) {
      it(`${id} at ${distance} m equals the game formulas`, () => {
        const sound = computeShotSound({ caliber: caliberOf(id), distance })
        const expected = gameShot(row[0], row[1], row[2], distance)
        expect(sound.soundClass).toBe(soundClass)
        expect(sound.cutoff).toBeCloseTo(expected.cutoff, 0)
        expect(sound.gain).toBeCloseTo(expected.gain, 2)
        expect(sound.duration).toBeCloseTo(expected.duration, 2)
      })
    }
  }

  it('is silent past the game threshold (gain under 0.01: about 157 m)', () => {
    expect(computeShotSound({ energyJ: 500, distance: 150 }).audible).toBe(true)
    expect(computeShotSound({ energyJ: 500, distance: 160 }).audible).toBe(false)
  })
})

describe('computeShotSound: monotonic', () => {
  const energies = [100, 160, 300, 500, 800, 1200, 1800, 2400, 3200, 4000, 7000, 12000, 18000]

  it('louder, longer and duller as the energy grows (non-shotgun)', () => {
    const sounds = energies.map((energyJ) => computeShotSound({ energyJ }))
    for (let i = 1; i < sounds.length; i++) {
      expect(sounds[i]!.gain).toBeGreaterThanOrEqual(sounds[i - 1]!.gain)
      expect(sounds[i]!.duration).toBeGreaterThanOrEqual(sounds[i - 1]!.duration)
      expect(sounds[i]!.cutoff).toBeLessThanOrEqual(sounds[i - 1]!.cutoff)
      expect(sounds[i]!.body.gain).toBeGreaterThanOrEqual(sounds[i - 1]!.body.gain)
    }
  })

  it('quieter and duller with distance', () => {
    const sounds = [0, 5, 20, 50, 100, 150].map((distance) => computeShotSound({ energyJ: 1800, distance }))
    for (let i = 1; i < sounds.length; i++) {
      expect(sounds[i]!.gain).toBeLessThan(sounds[i - 1]!.gain)
      expect(sounds[i]!.cutoff).toBeLessThan(sounds[i - 1]!.cutoff)
      expect(sounds[i]!.crack.gain).toBeLessThan(sounds[i - 1]!.crack.gain)
    }
  })

  it('a suppressor is quieter and duller without crack, and indoors rings longer', () => {
    const open = computeShotSound({ energyJ: 500, category: 'pistol' })
    const suppressed = computeShotSound({ energyJ: 500, category: 'pistol', suppressed: true })
    const indoors = computeShotSound({ energyJ: 500, category: 'pistol', indoors: true })
    expect(suppressed.gain).toBeLessThan(open.gain)
    expect(suppressed.cutoff).toBeLessThan(open.cutoff)
    expect(suppressed.crack.gain).toBe(0)
    expect(indoors.duration).toBeGreaterThan(open.duration)
  })

  it('a game can replace the classes, the curves and the class picker', () => {
    const custom = computeShotSound({ energyJ: 500, distance: 10 }, { classes: { pistol: [1000, 2, 1] }, distance: { gainFalloff: 0 }, classOf: () => 'pistol' })
    expect(custom.cutoff).toBeCloseTo(1000 / 1.1, 0)
    expect(custom.gain).toBeCloseTo(2, 2)
    expect(custom.duration).toBeCloseTo(1, 2)
  })

  it('is deterministic', () => {
    const input = { caliber: caliberOf('5_56x45'), distance: 33 }
    expect(computeShotSound(input)).toEqual(computeShotSound(input))
  })
})

describe('mechanical sounds', () => {
  it('has a sound for every reload stage of the rule', () => {
    const stages = new Set<ReloadStageId>()
    for (const table of Object.values(RELOAD_STAGES)) for (const list of Object.values(table)) for (const entry of list) stages.add(entry.stage)
    for (const stage of stages) expect(MECHANICAL_SOUNDS[stage], stage).toBeDefined()
  })

  it('maps the weapon events to sounds', () => {
    expect(mechanicalSoundOf({ type: 'reload_stage', stage: 'bolt_open', at: 0 })).toBe('bolt_open')
    expect(mechanicalSoundOf({ type: 'empty', at: 0 })).toBe('dry_fire')
    expect(mechanicalSoundOf({ type: 'fault', fault: 'stovepipe', at: 0 })).toBe('jam')
    expect(mechanicalSoundOf({ type: 'clear', fault: 'stovepipe', phase: 'end', at: 0 })).toBe('clear_end')
    expect(mechanicalSoundOf({ type: 'safety', on: true, at: 0 })).toBe('safety_on')
    expect(mechanicalSoundOf({ type: 'draw', phase: 'start', at: 0 })).toBeUndefined()
  })
})

// a minimal AudioContext that records what is built
const createFakeContext = () => {
  const starts: Array<{ kind: string; at: number; offset: number | undefined; filter: number | undefined }> = []
  const buffers: Float32Array[] = []
  /** Where in the noise buffer each burst starts and for how long it plays (the stop adds 0.05 s of tail). */
  const spans: Array<{ offset: number; seconds: number }> = []
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} })
  const node = <T extends object>(extra: T) => {
    const self: Record<string, unknown> = { connect: (next: unknown) => next, ...extra }
    return self as unknown as T & { connect: <N>(next: N) => N }
  }
  const context = {
    currentTime: 0,
    sampleRate: 8000,
    state: 'running',
    destination: {},
    resume: async () => {},
    close: async () => {},
    createGain: () => node({ gain: param() }),
    createBiquadFilter: () => node({ type: 'lowpass', frequency: param(), Q: param() }),
    createOscillator: () => node({ type: 'sine', frequency: param(), start: (at: number) => starts.push({ kind: 'osc', at, offset: undefined, filter: undefined }), stop() {} }),
    createBuffer: (_channels: number, length: number) => {
      const data = new Float32Array(length)
      buffers.push(data)
      return { getChannelData: () => data }
    },
    createBufferSource: () => {
      let begin = 0
      let offset = 0
      return node({
        buffer: null,
        start: (at: number, from?: number) => {
          begin = at
          offset = from ?? 0
          starts.push({ kind: 'noise', at, offset: from, filter: undefined })
        },
        stop: (at: number) => void spans.push({ offset, seconds: at - begin - 0.05 }),
      })
    },
  }
  return { context: context as unknown as AudioContext, starts, buffers, spans }
}

describe('createWeaponAudio with a fake AudioContext', () => {
  const play = (seed: number) => {
    const fake = createFakeContext()
    const audio = createWeaponAudio(0.6, { seed, createContext: () => fake.context })
    audio.shot(500, 'pistol', { distance: 20 })
    audio.event({ type: 'reload_stage', stage: 'magazine_out', at: 0 })
    audio.event({ type: 'empty', at: 0 })
    audio.clink()
    audio.play('glass', 1, 10)
    audio.dispose()
    return fake
  }

  it('builds nodes for a shot, the mechanical sounds and the game classes', () => {
    const { starts } = play(7)
    expect(starts.filter((entry) => entry.kind === 'noise').length).toBeGreaterThanOrEqual(6)
    // 4 since T6.1e2: the art scene's casing is one ring, not the two the SDK made up
    expect(starts.filter((entry) => entry.kind === 'osc').length).toBeGreaterThanOrEqual(4)
  })

  it('is silent past the audible distance and without a context', () => {
    const fake = createFakeContext()
    createWeaponAudio(0.6, { createContext: () => fake.context }).shot(500, 'pistol', { distance: 500 })
    expect(fake.starts).toHaveLength(0)
    expect(() => createWeaponAudio(0.6, { createContext: () => null as unknown as AudioContext }).shot(500, 'pistol')).not.toThrow()
  })

  it('starts a noise burst far enough from the end of the buffer for the burst to play whole', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const fake = createFakeContext()
      const audio = createWeaponAudio(0.6, { seed, createContext: () => fake.context })
      audio.play('explosion', 1, 0)
      audio.play('glass', 1, 0)
      audio.shot(12000, 'sniper', { distance: 0 })
      expect(fake.spans.length).toBeGreaterThan(0)
      for (const span of fake.spans) expect(span.offset + span.seconds).toBeLessThanOrEqual(1.5 + 1e-9)
    }
  })

  it('repeats exactly with the same seed and differs with another', () => {
    const a = play(7)
    const b = play(7)
    const c = play(8)
    expect(a.starts).toEqual(b.starts)
    expect(Array.from(a.buffers[0]!.slice(0, 64))).toEqual(Array.from(b.buffers[0]!.slice(0, 64)))
    expect(Array.from(a.buffers[0]!.slice(0, 64))).not.toEqual(Array.from(c.buffers[0]!.slice(0, 64)))
  })
})
