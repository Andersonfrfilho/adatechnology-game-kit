import { describe, expect, it } from 'vitest'

import { EVENT_KINDS } from '../src/test/scripts'
import { scripts } from './helpers'

const street = scripts.scripts.find((script) => script.id === 'street')!
const crossing = scripts.scripts.find((script) => script.id === 'crossing')!

/** Phase ids and times of spec 011, section 4.1 (the street) and 4.2 (the crossing); `load` is before second 0. */
const STREET_PHASES: readonly (readonly [string, number, number])[] = [
  ['load', -1, 0],
  ['walk', 0, 25],
  ['enter', 25, 45],
  ['shoot', 45, 65],
  ['grenade', 65, 80],
  ['horde', 80, 120],
  ['drive', 120, 150],
]
const CROSSING_PHASES: readonly (readonly [string, number, number])[] = [
  ['caos_calm', 0, 6],
  ['caos_breach', 6, 14],
  ['caos_fire', 14, 22],
  ['caos_blast', 22, 30],
  ['caos_armor', 30, 40],
]

const phasesOf = (script: typeof street): (readonly [string, number, number])[] => script.phases.map((phase) => [phase.id, phase.from, phase.to] as const)

describe('scripts of recorte 1', () => {
  it('the street script has the phases of the spec, with the exact ids and times', () => {
    expect(phasesOf(street)).toEqual(STREET_PHASES)
    expect(street.scenarios).toEqual(['tipico', 'pior'])
  })

  it('the crossing script has the phases of the spec and runs only the caos scenario', () => {
    expect(phasesOf(crossing)).toEqual(CROSSING_PHASES)
    expect(crossing.scenarios).toEqual(['caos'])
  })

  it('phases follow one another with no gap', () => {
    for (const script of scripts.scripts) {
      script.phases.slice(1).forEach((phase, index) => expect(phase.from, `${script.id}/${phase.id}`).toBe(script.phases[index]!.to))
    }
  })

  it('the three scenarios give the numbers of the spec: 500, 2000 and the caos crossing', () => {
    expect(scripts.scenarios.tipico).toMatchObject({ zombies: 500, weather: 'overcast', timeOfDay: 'day' })
    expect(scripts.scenarios.pior).toMatchObject({ zombies: 2000, weather: 'rain', timeOfDay: 'night' })
    expect(scripts.scenarios.caos.zombies).toBeGreaterThan(0)
  })
})

describe('events', () => {
  it('fall inside a phase after load, in time order, with a known kind', () => {
    for (const script of scripts.scripts) {
      const start = script.phases.find((phase) => phase.from >= 0)!.from
      const end = script.phases.at(-1)!.to
      script.events.forEach((event, index) => {
        expect(EVENT_KINDS).toContain(event.kind)
        expect(event.at, `${script.id}[${index}]`).toBeGreaterThanOrEqual(start)
        expect(event.at, `${script.id}[${index}]`).toBeLessThan(end)
        if (index > 0) expect(event.at, `${script.id}[${index}]`).toBeGreaterThanOrEqual(script.events[index - 1]!.at)
      })
    }
  })

  it('release at most the whole horde of the scenario', () => {
    for (const script of scripts.scripts) {
      const total = script.events.reduce((sum, event) => sum + (event.kind === 'horde_release' ? event.share : 0), 0)
      expect(total, script.id).toBeCloseTo(1, 5)
    }
  })

  it('mark the events that need L15, L16 and L17 as pending, and no others', () => {
    const pending = Object.fromEntries(crossing.events.filter((event) => event.pending).map((event) => [event.kind, event.pending]))
    expect(pending).toEqual({ fire_line: 'L15', shoot: 'L16', horde_release: 'L17' })
    expect(street.events.filter((event) => event.pending)).toEqual([])
  })

  it('run the explosions of the crossing: an M67 and a C4 in the blast phase', () => {
    const blast = crossing.phases.find((phase) => phase.id === 'caos_blast')!
    const inBlast = crossing.events.filter((event) => event.at >= blast.from && event.at < blast.to)
    expect(inBlast.map((event) => [event.kind, 'explosive' in event ? event.explosive : ''])).toEqual([['throw', 'm67'], ['detonate', 'c4']])
  })

  it('the armoured truck crosses in the last phase', () => {
    const drive = crossing.events.find((event) => event.kind === 'vehicle_drive')
    expect(drive?.at).toBe(30)
  })
})

describe('camera and path', () => {
  it('cues start at the first second and never use a top-down view', () => {
    for (const script of scripts.scripts) {
      expect(script.camera[0]?.at).toBe(0)
      for (const cue of script.camera) expect(['shoulder', 'first', 'vehicle']).toContain(cue.mode)
    }
  })

  it('the street cues follow the spec: shoulder, first inside the house, shoulder, vehicle for the drive', () => {
    expect(street.camera.map((cue) => cue.mode)).toEqual(['shoulder', 'first', 'shoulder', 'vehicle'])
    expect(street.camera.at(-1)?.at).toBe(120)
  })

  it('the player walks 60 m along the street in the walk phase', () => {
    const [start, end] = [street.path.find((point) => point.at === 0)!, street.path.find((point) => point.at === 25)!]
    expect(Math.hypot(end.x - start.x, end.z - start.z)).toBe(60)
  })

  it('the path is in time order and the crossing path stays behind the barricade, west of x = -112', () => {
    for (const script of scripts.scripts) script.path.slice(1).forEach((point, index) => expect(point.at).toBeGreaterThan(script.path[index]!.at))
    for (const point of crossing.path) expect(point.x).toBeLessThan(-112)
  })
})
