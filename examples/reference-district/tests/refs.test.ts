import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { listTypes } from '@adatechnology/game-props3d'
import { fleetVehicleIds } from '@adatechnology/game-vehicles-fleet'

import { plan, rectsOverlap, scripts, site } from './helpers'

const PACKAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../packages')
const packageFolders = new Set(readdirSync(PACKAGES_DIR).filter((name) => existsSync(join(PACKAGES_DIR, name, 'package.json'))))
const propIds = new Set(listTypes().map((type) => type.id))

/**
 * What the design maps from the "Falta" table of specs/011-cena-de-referencia/plan.md to a `missing` entry, with the task of the Fase 3 that replaces it.
 * Left out on purpose: the host, the audio occlusion, the overcast preset and the post processing (not places).
 */
const EXPECTED_MISSING: Readonly<Record<string, string>> = {
  mixed_use_house: 'T3.2',
  mid_rise_building: 'T3.1',
  bridge: 'T3.3',
  river: 'T3.4',
  riverbank_forest: 'T3.10',
  fish_and_heron: 'T3.10',
  road_cones: 'T3.9',
  traffic_signals: 'T3.9',
  alley: 'T3.5',
  bar: 'T3.6',
  henhouse: 'T3.8',
  exposed_rebar: 'T3.7',
  plan_line_drawing: 'T3.13',
  note_story: 'T3.11',
}

describe('references of the site', () => {
  it('every vehicle ref is in the fleet and every prop ref is in game-props3d', () => {
    expect(site.props.length).toBeGreaterThan(0)
    for (const prop of site.props) {
      if (prop.kind === 'vehicle') expect(fleetVehicleIds as readonly string[], `${prop.id}: ${prop.ref}`).toContain(prop.ref)
      else expect([...propIds], `${prop.id}: ${prop.ref}`).toContain(prop.ref)
    }
  })

  it('every vehicle a script drives is in the fleet', () => {
    const driven = scripts.scripts.flatMap((script) => script.events).flatMap((event) => (event.kind === 'vehicle_drive' ? [event.vehicle] : []))
    expect(driven.length).toBeGreaterThan(0)
    for (const vehicle of driven) expect(fleetVehicleIds as readonly string[], vehicle).toContain(vehicle)
  })

  it('every horde zone a script releases exists in the site', () => {
    const zones = new Set(site.hordes.map((zone) => zone.id))
    const released = scripts.scripts.flatMap((script) => script.events).flatMap((event) => (event.kind === 'horde_release' ? [event.zone] : []))
    for (const zone of released) expect(zones.has(zone), zone).toBe(true)
  })
})

describe('props', () => {
  it('sit inside the districts of the plan and outside every lot', () => {
    const [x0, z0, x1, z1] = [Math.min(...plan.districts!.map((d) => d.rect[0])), Math.min(...plan.districts!.map((d) => d.rect[1])), Math.max(...plan.districts!.map((d) => d.rect[2])), Math.max(...plan.districts!.map((d) => d.rect[3]))]
    for (const prop of site.props) {
      expect(prop.at[0], prop.id).toBeGreaterThanOrEqual(x0)
      expect(prop.at[0], prop.id).toBeLessThanOrEqual(x1)
      expect(prop.at[1], prop.id).toBeGreaterThanOrEqual(z0)
      expect(prop.at[1], prop.id).toBeLessThanOrEqual(z1)
      for (const lot of site.lots) expect(rectsOverlap([prop.at[0], prop.at[1], prop.at[0] + 0.01, prop.at[1] + 0.01], lot.rect), `${prop.id} x ${lot.id}`).toBe(false)
    }
  })
})

describe('missing', () => {
  it('every owner is a folder of packages/', () => {
    for (const entry of site.missing) {
      expect(entry.owner.length, entry.id).toBeGreaterThan(0)
      for (const owner of entry.owner) expect(packageFolders.has(owner), `${entry.id}: ${owner}`).toBe(true)
    }
  })

  it('matches the Falta table of plan.md: the same ids, each with its task', () => {
    expect(Object.fromEntries(site.missing.map((entry) => [entry.id, entry.task]))).toEqual(EXPECTED_MISSING)
  })

  it('has a warning box that is a real volume, outside every lot except the note in the house', () => {
    for (const entry of site.missing) {
      expect(entry.height, entry.id).toBeGreaterThan(0)
      if (entry.id === 'note_story') continue
      for (const lot of site.lots) expect(rectsOverlap(entry.rect, lot.rect), `${entry.id} x ${lot.id}`).toBe(false)
    }
  })

  it('the note is inside the house the player enters', () => {
    const house = site.lots.find((lot) => lot.id === 'street_south_3')!
    const note = site.missing.find((entry) => entry.id === 'note_story')!
    expect(rectsOverlap(note.rect, house.rect)).toBe(true)
  })
})
