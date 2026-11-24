import { describe, expect, it } from 'vitest'

import { DataError } from '../src/game/read'
import { parsePlan } from '../src/game/plan'
import { parseSite } from '../src/game/site'
import { parseScripts } from '../src/test/scripts'
import { plan, readJson, scripts, site } from './helpers'

/** The message of the error a parser throws for a document. */
function errorOf(parse: (json: unknown) => unknown, json: unknown): string {
  try {
    parse(json)
  } catch (error) {
    expect(error).toBeInstanceOf(DataError)
    return (error as DataError).message
  }
  throw new Error('expected the parser to throw')
}

/** A copy of a parsed-from-disk document, to break one field of it. */
const copyOf = (name: string): Record<string, unknown> => structuredClone(readJson(name)) as Record<string, unknown>

describe('the three files of recorte 1', () => {
  it('parse into typed values', () => {
    expect(plan.districts?.map((district) => district.kind)).toEqual(['mixed', 'residential_popular'])
    expect(site.plan).toBe(plan.id)
    expect(site.lots).toHaveLength(14)
    expect(scripts.scripts.map((script) => script.id)).toEqual(['street', 'crossing'])
  })

  it('give every lot, prop, zone and missing box a unique id', () => {
    for (const list of [site.lots, site.props, site.hordes, site.missing]) {
      const ids = list.map((item) => item.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe('a malformed file names the field', () => {
  it('site: a lot rect with the wrong shape', () => {
    const json = copyOf('recorte-1.site.json')
    ;(json.lots as { rect: unknown }[])[3]!.rect = [1, 2, 3]
    expect(errorOf(parseSite, json)).toBe('$.lots[3].rect: expected [x0, z0, x1, z1]')
  })

  it('site: a front outside n, s, e, w', () => {
    const json = copyOf('recorte-1.site.json')
    ;(json.lots as { front: unknown }[])[0]!.front = 'up'
    expect(errorOf(parseSite, json)).toContain('$.lots[0].front')
  })

  it('site: a missing owner that is not text', () => {
    const json = copyOf('recorte-1.site.json')
    ;(json.missing as { owner: unknown }[])[2]!.owner = ['game-urban', 7]
    expect(errorOf(parseSite, json)).toContain('$.missing[2].owner[1]')
  })

  it('site: a root that is not an object', () => {
    expect(errorOf(parseSite, [])).toBe('$: expected an object')
  })

  it('scripts: an unknown event kind', () => {
    const json = copyOf('recorte-1.scripts.json')
    ;((json.scripts as { events: { kind: unknown }[] }[])[1] as { events: { kind: unknown }[] }).events[2]!.kind = 'teleport'
    expect(errorOf(parseScripts, json)).toContain('$.scripts[1].events[2].kind')
  })

  it('scripts: a phase that ends before it starts', () => {
    const json = copyOf('recorte-1.scripts.json')
    ;(json.scripts as { phases: { to: unknown }[] }[])[0]!.phases[1]!.to = -5
    expect(errorOf(parseScripts, json)).toContain('$.scripts[0].phases[1].to')
  })

  it('scripts: a release share above 1', () => {
    const json = copyOf('recorte-1.scripts.json')
    const releases = (json.scripts as { events: { kind: string; share?: number }[] }[])[1]!.events.filter((event) => event.kind === 'horde_release')
    releases[0]!.share = 3
    expect(errorOf(parseScripts, json)).toContain('.share')
  })

  it('plan: a district rect with a negative size', () => {
    const json = copyOf('recorte-1.plan.json')
    ;(json.districts as { rect: unknown }[])[1]!.rect = [10, 10, 0, 0]
    expect(errorOf(parsePlan, json)).toContain('$.districts[1].rect')
  })

  it('a typo in a key is an unknown field with its path', () => {
    const scriptsJson = copyOf('recorte-1.scripts.json')
    const event = (scriptsJson.scripts as { events: Record<string, unknown>[] }[])[1]!.events[1]!
    event.pendng = event.pending
    delete event.pending
    expect(errorOf(parseScripts, scriptsJson)).toContain('$.scripts[1].events[1].pendng: unknown field')
    const siteJson = copyOf('recorte-1.site.json')
    ;(siteJson.lots as Record<string, unknown>[])[2]!.typologyy = 'x'
    expect(errorOf(parseSite, siteJson)).toContain('$.lots[2].typologyy: unknown field')
  })

  it('plan size must be two positive numbers', () => {
    const json = copyOf('recorte-1.plan.json')
    json.size = [445, 0]
    expect(errorOf(parsePlan, json)).toBe('$.size: expected [width, depth], both above 0')
  })

  it('seed, zombies and shots are integers', () => {
    const siteJson = copyOf('recorte-1.site.json')
    siteJson.seed = 1.5
    expect(errorOf(parseSite, siteJson)).toContain('$.seed: expected an integer')
    const scriptsJson = copyOf('recorte-1.scripts.json')
    ;(scriptsJson.scenarios as { tipico: { zombies: number } }).tipico.zombies = 10.5
    expect(errorOf(parseScripts, scriptsJson)).toContain('$.scenarios.tipico.zombies')
    const shots = copyOf('recorte-1.scripts.json')
    ;(shots.scripts as { events: { kind: string; shots?: number }[] }[])[0]!.events.find((e) => e.kind === 'shoot')!.shots = 2.5
    expect(errorOf(parseScripts, shots)).toContain('.shots: expected an integer')
  })

  it('a fire line and a drive path need two points', () => {
    const json = copyOf('recorte-1.scripts.json')
    const crossingEvents = (json.scripts as { events: { kind: string; points?: unknown; path?: unknown }[] }[])[1]!.events
    crossingEvents.find((e) => e.kind === 'fire_line')!.points = [[0, 0]]
    expect(errorOf(parseScripts, json)).toContain('.points: expected at least 2 items')
    const drive = copyOf('recorte-1.scripts.json')
    ;(drive.scripts as { events: { kind: string; path?: unknown }[] }[])[0]!.events.find((e) => e.kind === 'vehicle_drive')!.path = []
    expect(errorOf(parseScripts, drive)).toContain('.path: expected at least 2 items')
  })

  it('a horde zone share above 1 is rejected in the site too', () => {
    const json = copyOf('recorte-1.site.json')
    ;(json.hordes as { share: number }[])[0]!.share = 2
    expect(errorOf(parseSite, json)).toContain('$.hordes[0].share: expected a share up to 1')
  })
})
