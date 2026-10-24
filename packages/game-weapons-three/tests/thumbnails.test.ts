import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createArsenal } from '@adatechnology/game-weapons'
import { BODY_ACTIONS, createWeaponsTestModule, DEFAULT_THUMBNAIL_BASE, WEAPON_THUMBNAILS, weaponThumbnailUrl } from '../src'

// vitest runs inside the package folder
const FOLDER = join(process.cwd(), 'assets/weapon-svg')
const arsenal = createArsenal({ locale: 'en' })
const weaponIds = [...arsenal.weapons.keys()].filter((id) => !BODY_ACTIONS.has(id))

describe('weapon thumbnails', () => {
  it('has one for every weapon of the arsenal but the body actions', () => {
    expect(weaponIds.filter((id) => !(id in WEAPON_THUMBNAILS))).toEqual([])
    for (const id of ['fuel_barrel', 'propane_p13', 'car_fuel_tank']) expect(WEAPON_THUMBNAILS[id], id).toBeDefined()
  })

  it('points every entry to a file that exists, is an SVG without active content, and gives a licence to each Commons file', () => {
    for (const [id, entry] of Object.entries(WEAPON_THUMBNAILS)) {
      expect(existsSync(join(FOLDER, entry.file)), id).toBe(true)
      const svg = readFileSync(join(FOLDER, entry.file), 'utf8')
      expect(svg, id).toMatch(/^<svg /)
      expect(svg, id).not.toMatch(/<script|foreignObject|\son\w+=|javascript:|xlink:href|<!ENTITY/i)
      if (entry.source === 'commons') for (const field of ['author', 'license', 'licenseUrl', 'page'] as const) expect(entry[field], `${id} ${field}`).toBeTruthy()
    }
  })

  it('keeps in every file nothing but the root and one or two paths: no markup of a download is ever published', () => {
    for (const [id, entry] of Object.entries(WEAPON_THUMBNAILS)) expect(readFileSync(join(FOLDER, entry.file), 'utf8'), id).toMatch(/^<svg [^<>]*><path [^<>]*\/>(<path [^<>]*\/>)?<\/svg>\n$/)
  })

  it('prefers the Commons file when one was kept', () => {
    const commons = Object.entries(WEAPON_THUMBNAILS).filter(([, entry]) => entry.source === 'commons')
    expect(commons.length).toBeGreaterThan(0)
    for (const [id] of commons) expect(existsSync(join(FOLDER, 'generated', `${id}.svg`)), id).toBe(true)
    for (const [id, entry] of commons) expect(entry.file, id).toBe(`commons/${id}.svg`)
  })

  it('resolves to the folder the site serves, or to the base the host gives', () => {
    expect(weaponThumbnailUrl('glock_17')).toBe(`${DEFAULT_THUMBNAIL_BASE}${WEAPON_THUMBNAILS.glock_17?.file}`)
    expect(weaponThumbnailUrl('glock_17', '../weapon-svg/')).toMatch(/^\.\.\/weapon-svg\/(commons|generated)\/glock_17\.svg$/)
    expect(weaponThumbnailUrl('no_such_weapon')).toBeUndefined()
  })
})

describe('thumbnails in the weapons module', () => {
  const mod = createWeaponsTestModule({ locale: 'en', sound: false })

  it('fills the thumbnail of every weapon item, of the world explosives and of the mounted M134', () => {
    const items = mod.items('en')
    const weapons = items.filter((item) => item.weapon !== undefined)
    expect(weapons.length).toBeGreaterThan(140)
    expect(weapons.filter((item) => !item.thumbnail).map((item) => item.id)).toEqual([])
    expect(items.find((item) => item.id === 'weapon_glock_17')?.thumbnail).toBe(weaponThumbnailUrl('glock_17'))
    expect(items.find((item) => item.id === 'world_fuel_barrel')?.thumbnail).toBe(weaponThumbnailUrl('fuel_barrel'))
    expect(items.find((item) => item.id === 'counter_weapons')?.thumbnail).toBeUndefined()
  })

  it('serves them from the base the host gives, or from none', () => {
    const elsewhere = createWeaponsTestModule({ locale: 'en', sound: false, thumbnailBase: '/img/' }).items('en')
    expect(elsewhere.find((item) => item.id === 'weapon_glock_17')?.thumbnail?.startsWith('/img/')).toBe(true)
    const bare = createWeaponsTestModule({ locale: 'en', sound: false, thumbnailBase: false }).items('en')
    expect(bare.some((item) => item.thumbnail)).toBe(false)
  })
})
