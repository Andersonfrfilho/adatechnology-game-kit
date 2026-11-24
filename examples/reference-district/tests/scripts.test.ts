import { describe, expect, it } from 'vitest'

import { fleetDims } from '@adatechnology/game-vehicles-fleet'

import { EVENT_KINDS } from '../src/test/scripts'
import { scripts, site } from './helpers'

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

  it('release the horde of the scenario in shares: each at most 1, and the sum of a script is exactly 1', () => {
    for (const script of scripts.scripts) {
      const shares = script.events.flatMap((event) => (event.kind === 'horde_release' ? [event.share] : []))
      for (const share of shares) expect(share, script.id).toBeLessThanOrEqual(1)
      expect(shares.reduce((sum, share) => sum + share, 0), script.id).toBeCloseTo(1, 9)
    }
  })

  it('end every drive inside the phase it starts in, at the end of its path', () => {
    for (const script of scripts.scripts) {
      for (const event of script.events) {
        if (event.kind !== 'vehicle_drive') continue
        const metres = event.path.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - event.path[index]![0], point[1] - event.path[index]![1]), 0)
        const end = event.at + metres / event.speed
        const phase = script.phases.find((item) => event.at >= item.from && event.at < item.to)!
        expect(end, `${script.id}/${phase.id}`).toBeLessThanOrEqual(phase.to)
        // the player rides the vehicle: the last waypoint of the player path is where it stops
        const stop = script.path.at(-1)!
        if (script.id === 'street') expect(Math.hypot(stop.x - event.path.at(-1)![0], stop.z - event.path.at(-1)![1])).toBeLessThan(1)
      }
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
  it('cues start at the first second and every cue falls inside the script, in increasing time', () => {
    for (const script of scripts.scripts) {
      const end = script.phases.at(-1)!.to
      expect(script.camera[0]?.at).toBe(0)
      script.camera.forEach((cue, index) => {
        expect(cue.at, `${script.id}[${index}]`).toBeGreaterThanOrEqual(0)
        expect(cue.at, `${script.id}[${index}]`).toBeLessThan(end)
        if (index > 0) expect(cue.at, `${script.id}[${index}]`).toBeGreaterThan(script.camera[index - 1]!.at)
      })
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

  it('every path point keeps 1.5 m from every prop (a vehicle is a circle of half its longest side), but the one the player drives', () => {
    for (const script of scripts.scripts) {
      const drive = script.events.find((event) => event.kind === 'vehicle_drive')
      for (const point of script.path) {
        for (const prop of site.props) {
          const driven = prop.kind === 'vehicle' && drive?.kind === 'vehicle_drive' && drive.vehicle === prop.ref && script.id === 'street' && point.at >= drive.at - 1
          if (driven) continue
          const dims = prop.kind === 'vehicle' ? fleetDims(prop.ref) : undefined
          const radius = dims ? Math.max(dims.length, dims.width) / 2 : 1
          expect(Math.hypot(point.x - prop.at[0], point.z - prop.at[1]), `${script.id} t=${point.at} x ${prop.id}`).toBeGreaterThanOrEqual(radius + 1.5)
        }
      }
    }
  })
})
