import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createVehicleKit, listLocales } from '@adatechnology/game-vehicles'
import * as THREE from 'three'
import { enLocale, fleetVehicleIds, installFleet, ptBrLocale } from '../src'
import original from './fixtures/original-pt.json'
import { fakeDocument } from './helpers/fake-dom'
import { makeFleetKit, strings } from './helpers/kit'

const en = enLocale.fleet as Record<string, any>
const pt = ptBrLocale.fleet as Record<string, any>
const ORIGINAL = original as unknown as Record<string, any>

function paths(value: unknown): string[] {
  return [...strings(value)].map(([path]) => path)
}

describe('the two tables', () => {
  it('have the same keys', () => {
    expect(paths(pt)).toEqual(paths(en))
  })

  it('have no empty text', () => {
    for (const [name, table] of [
      ['en', en],
      ['pt-BR', pt],
    ] as const) {
      for (const [path, text] of strings(table)) if (path.indexOf('.article') < 0) expect(text.trim(), `${name} ${path}`).not.toBe('')
    }
  })

  it('use the same placeholders', () => {
    const tokens = (s: string) => (s.match(/\{[a-z]+\}/gi) || []).sort().join()
    const e = [...strings(en)]
    const p = [...strings(pt)]
    e.forEach(([path, text], i) => expect(tokens(p[i][1]), path).toBe(tokens(text)))
  })

  it('keep Portuguese out of the English table (parody names and lettering painted on a vehicle may keep their accents)', () => {
    const ptStrings = new Map([...strings(pt)])
    for (const [path, text] of strings(en)) {
      if (/^vehicles\.[a-z0-9_]+\.(name|inspired)$/.test(path) || text === ptStrings.get(path)) continue
      expect(text, path).not.toMatch(/[áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/)
    }
  })

  it('keep a parody name in both languages, unless it holds a Portuguese word', () => {
    const different = fleetVehicleIds.filter((key) => en.vehicles[key].name !== pt.vehicles[key].name)
    expect([...different].sort()).toEqual([
      'adventure_bike',
      'ambulance',
      'amphibian_turboprop',
      'armored_truck',
      'battle_tank',
      'bicycle',
      'box_truck',
      'cargo_van',
      'commuter_motorcycle',
      'compact_pickup',
      'crossover_pickup',
      'delivery_bike',
      'fishing_boat',
      'highway_police_bike',
      'highway_police_sedan',
      'hybrid_suv',
      'midsize_pickup',
      'patrol_boat',
      'police_helicopter',
      'police_sedan',
      'rescue_dinghy',
      'sailboat',
      'school_bus',
      'tanker_truck',
      'taxi',
      'transport_helicopter',
      'troop_truck',
      'turbine_helicopter',
    ])
  })

  it('carry no story: nothing about zombies, hordes or blood, no game plate', () => {
    const re = /zumb|horda|mordid|sangue|morto-vivo|zombie|horde|blood|\bbitten?\b|ZMB/i
    for (const [name, table] of [
      ['en', en],
      ['pt-BR', pt],
    ] as const) {
      for (const [path, text] of strings(table)) expect(text, `${name} ${path}`).not.toMatch(re)
    }
  })

  it('leave no source file with Portuguese comments or story words', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (p.endsWith('.ts')) files.push(p)
      }
    }
    walk(join(__dirname, '..', 'src'))
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
      expect(text, f).not.toMatch(/zumb|horda\b|sangue|zombie|horde|bloodstain|ZMB/i)
      if (!f.endsWith('legacy-seeds.ts')) expect(text, f).not.toMatch(/[áéíóúâêôãõç]/)
    }
  })
})

describe('pt-BR reads exactly like the original', () => {
  it('has the original group names', () => {
    expect(pt.groups).toEqual(ORIGINAL.groups)
  })

  it('has the original fuel texts', () => {
    expect(pt.fuels).toEqual(ORIGINAL.fuels)
  })

  it('has the original scenario names', () => {
    expect(pt.scenarios).toEqual(ORIGINAL.scenarios)
  })

  it('has the original part and zone effect texts (the ones left to the game apart)', () => {
    expect(pt.part_effects).toEqual(ORIGINAL.part_effects)
    expect(pt.zone_effects).toEqual(ORIGINAL.zone_effects)
  })

  it('has the original text of every vehicle (descriptions that spoke of zombies lose that sentence)', () => {
    expect(Object.keys(pt.vehicles).sort()).toEqual([...fleetVehicleIds].sort())
    expect(ORIGINAL.stripped).toHaveLength(16)
    for (const key of fleetVehicleIds) {
      const want = { ...ORIGINAL.vehicles[key] }
      const got = { ...pt.vehicles[key] }
      if (ORIGINAL.stripped.includes(key)) {
        expect(got.description, key).not.toBe(want.description)
        delete want.description
        delete got.description
      }
      expect(got, key).toEqual(want)
    }
  })

  it('shows the original names on the vehicles of a pt-BR kit', () => {
    const kit = makeFleetKit('pt-BR')
    for (const v of kit.fleet) {
      expect(v.name, v.key).toBe(ORIGINAL.vehicles[v.key].name)
      expect(v.inspired, v.key).toBe(ORIGINAL.vehicles[v.key].inspired)
      expect(v.category, v.key).toBe(ORIGINAL.vehicles[v.key].category)
    }
    expect(kit.fuels.gasoline.name).toBe('Gasolina')
    expect(kit.scenarios.map((s) => s.name)).toEqual(['Batida frontal', 'Batida lateral esquerda', 'Capotado', 'Abandonado', 'Queimado'])
  })
})

describe('locales of a kit', () => {
  it('reads English on an English kit', () => {
    const kit = makeFleetKit('en')
    expect(kit.fuels.diesel.name).toBe('Diesel')
    expect(kit.t('fleet.groups.heavy')).toBe('Trucks and buses')
    expect(kit.scenarios[0].name).toBe('Front crash')
  })

  it('falls back to English for a locale the pack does not know', () => {
    const kit = makeFleetKit('fr')
    expect(kit.t('fleet.groups.heavy')).toBe('Trucks and buses')
    expect(kit.find('large_suv')?.description).toBe(en.vehicles.large_suv.description)
  })

  it('registers its tables for the engine locale list', () => {
    makeFleetKit('en')
    expect(listLocales()).toEqual(expect.arrayContaining(['en', 'pt-BR']))
  })

  it('keeps the locale of the kit when the pack is installed late', () => {
    const kit = createVehicleKit({ THREE, document: fakeDocument, locale: 'pt-BR' })
    installFleet(kit, { vehicles: ['taxi'] })
    expect(kit.find('taxi')?.name).toBe('Ônyx Plus Táxi')
  })
})
