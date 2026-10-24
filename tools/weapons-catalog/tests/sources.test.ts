import { readFileSync } from 'node:fs'

import { beforeAll, describe, expect, it } from 'vitest'

import { DEFAULT_RULES } from '@adatechnology/game-weapons'

import { loadDecisions } from '../src/decisions'
import type { Decisions } from '../src/decisions'
import { extractArsenal } from '../src/extract-arsenal'
import type { ArsenalData } from '../src/extract-arsenal'
import { extractGallery, galleryCapacity, galleryFamily } from '../src/extract-gallery'
import type { GalleryData, GalleryWeaponRow } from '../src/extract-gallery'
import { extractGame } from '../src/extract-game'
import type { GameData } from '../src/extract-game'
import { extractLab } from '../src/extract-lab'
import type { LabProfile } from '../src/extract-lab'
import { OUTPUT_PATHS, SOURCE_PATHS } from '../src/paths'
import { slugOf } from '../src/weapon-rules'

type Timings = { readonly reload?: number; readonly reloadEmpty?: number; readonly perRound?: number; readonly draw?: number }
type WeaponRow = {
  readonly id: string
  readonly category: string
  readonly mass: number
  readonly dimensions: { readonly length: number; readonly barrel: number; readonly emptyMass: number; readonly lengthCollapsed?: number }
  readonly action: {
    readonly family: string
    readonly magazine: number
    readonly chamber?: number
    readonly rpm?: number
    readonly faultFactor?: number
    readonly muzzleSpeed?: number
    readonly moa?: number
    readonly patternCm?: number
    readonly timings: Timings
    readonly perRound?: boolean
  }
}
type CaliberRow = {
  readonly id: string
  readonly diameter: number
  readonly caseType: string
  readonly noise: number
  readonly cartridge: { readonly caseDiameter: number; readonly overallLength: number; readonly caseLength: number; readonly projectileDiameter: number }
}
type ExplosiveRow = { readonly id: string; readonly noise: number; readonly destructionLevel: number; readonly lethalRadius?: number; readonly injuryRadius?: number }

const hasId = (value: unknown): value is { id: string } => typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string'

/** The rows of a generated file, checked to be a list of objects with an id; the fields are the ones the tests read. */
const readOutput = <TRow extends { id: string }>(path: string): TRow[] => {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(parsed) || !parsed.every(hasId)) throw new Error(`${path} is not a list of rows with an id`)
  return parsed as TRow[]
}

let gallery: GalleryData
let arsenal: ArsenalData
let lab: Readonly<Record<string, LabProfile>>
let game: GameData
let decisions: Decisions
let weapons: Map<string, WeaponRow>
let calibers: Map<string, CaliberRow>
let explosives: Map<string, ExplosiveRow>

const idOf = (row: GalleryWeaponRow): string => decisions.weaponIds[row[0]]?.value ?? slugOf(row[0])
const weaponOf = (row: GalleryWeaponRow): WeaponRow => {
  const weapon = weapons.get(idOf(row))
  if (!weapon) throw new Error(`no generated weapon for ${row[0]}`)
  return weapon
}
const arsenalCatalogOf = (row: GalleryWeaponRow) => arsenal.catalog.find((entry) => entry.name === (decisions.arsenalCatalogNames[row[0]]?.value ?? row[0]))
const arsenalSheetOf = (row: GalleryWeaponRow) => arsenal.sheet.find((entry) => entry.name === (decisions.arsenalSheetNames[row[0]]?.value ?? row[0]))

// Independent reading of the gallery builder rules (galeria-3d-arsenal.js lines 82, 148, 252, 256, 269, 280, 296, 402), in the SDK's own family names.
const expectedFamily = (row: GalleryWeaponRow): string => {
  const [, , , , , , , builder, o] = row
  const direct: Record<string, string> = { pistol: 'pistol', revolver: 'revolver', p90: 'top_magazine', break: 'break', m2: 'belt' }
  if (direct[builder]) return direct[builder]
  if (builder === 'bullpup') return o.shot ? 'pump' : 'magazine'
  if (builder === 'launcher') return o.lt === 'flame' || o.lt === 'flameDIY' ? 'flame' : 'rocket'
  if (o.mag === 'belt') return 'belt'
  if (o.pump) return 'pump'
  if (o.lever) return 'lever'
  if (o.tube) return 'tube_semi'
  if (o.bolt) return o.mag === 'box' ? 'bolt_magazine' : 'bolt'
  return o.mag === 'internal' ? 'top_load_semi' : 'magazine'
}

beforeAll(() => {
  gallery = extractGallery()
  arsenal = extractArsenal()
  lab = extractLab()
  game = extractGame()
  decisions = loadDecisions()
  weapons = new Map([...readOutput<WeaponRow>(OUTPUT_PATHS.firearms), ...readOutput<WeaponRow>(OUTPUT_PATHS.launchers)].map((weapon) => [weapon.id, weapon]))
  calibers = new Map(readOutput<CaliberRow>(OUTPUT_PATHS.calibers).map((caliber) => [caliber.id, caliber]))
  explosives = new Map(readOutput<ExplosiveRow>(OUTPUT_PATHS.explosives).map((explosive) => [explosive.id, explosive]))
})

describe('Gallery WEAP', () => {
  it('has a generated weapon for every row, with the gallery capacity, dimensions, rate, reliability and family', () => {
    expect(gallery.weapons).toHaveLength(77)
    for (const row of gallery.weapons) {
      const weapon = weaponOf(row)
      const action = weapon.action
      expect(weapon.dimensions.length, row[0]).toBeCloseTo(row[4] / 1000, 9)
      expect(weapon.dimensions.barrel, row[0]).toBeCloseTo(row[5] / 1000, 9)
      expect(weapon.dimensions.emptyMass, row[0]).toBe(row[6])
      expect(action.family, row[0]).toBe(expectedFamily(row))
      expect(galleryFamily(row), row[0]).toBeTruthy()
      if (row[7] === 'launcher') continue
      expect(action.magazine + (action.chamber ?? 0), row[0]).toBe(galleryCapacity(row[3]))
      if (typeof row[8].rpm === 'number') expect(action.rpm, row[0]).toBe(row[8].rpm)
      expect(action.faultFactor ?? 1, row[0]).toBe(row[8].rel ?? 1)
    }
  })

  it('keeps the Taurus 82 as reliable as the page says (owner decision: not especially reliable) and gives the revolver model the chambers of the data', () => {
    const taurus = gallery.weapons.find((row) => row[0] === 'Taurus 82')
    if (!taurus) throw new Error('no Taurus 82')
    expect(weaponOf(taurus).action.faultFactor ?? 1).toBe(decisions.reliability['Taurus 82']?.value)
    expect(decisions.reliability['Taurus 82']?.value).toBe(1)
    const models = JSON.parse(readFileSync(OUTPUT_PATHS.models, 'utf8')) as Record<string, { options: { chambers?: number } }>
    expect(models.sw_686?.options.chambers).toBe(7)
    expect(models.taurus_82?.options.chambers).toBeUndefined()
  })

  it('maps the gallery categories', () => {
    const expected: Record<string, string> = { pis: 'pistol', rev: 'revolver', smg: 'smg', esc: 'shotgun', fuz: 'rifle', dmr: 'dmr', snp: 'sniper', cac: 'hunting', mtr: 'machine_gun', lan: 'launcher' }
    expect(Object.keys(gallery.categories).sort()).toEqual(Object.keys(expected).sort())
    for (const row of gallery.weapons) expect(weaponOf(row).category, row[0]).toBe(expected[row[1]])
  })

  it('has unique snake_case ids', () => {
    const ids = gallery.weapons.map(idOf)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(_[a-z0-9]+)*$/)
  })
})

describe('Gallery AMMO', () => {
  const KNOWN_DEVIATIONS = [{ caliber: '50bmg', field: 'projectileDiameter', reason: 'A6: the real .50 BMG bullet is 12.7 mm, the gallery says 13.0' }]

  it('matches the generated cartridges and diameters, except the recorded deviations', () => {
    for (const row of gallery.ammo) {
      const entry = Object.entries(decisions.calibers).filter(([, decision]) => decision.ammoRow?.value === row[0])
      expect(entry.length, row[0]).toBeGreaterThan(0)
      for (const [id] of entry) {
        const caliber = calibers.get(id)
        if (!caliber) throw new Error(`no generated caliber ${id}`)
        const deviated = (field: string): boolean => KNOWN_DEVIATIONS.some((deviation) => deviation.caliber === id && deviation.field === field)
        expect(caliber.cartridge.caseDiameter, id).toBe(row[1])
        expect(caliber.cartridge.overallLength, id).toBe(row[2])
        expect(caliber.cartridge.caseLength, id).toBe(row[3])
        if (!deviated('projectileDiameter')) expect(caliber.cartridge.projectileDiameter, id).toBe(row[4])
        if (caliber.caseType !== 'shell' && !deviated('projectileDiameter')) expect(caliber.diameter, id).toBe(row[4])
      }
    }
    expect(calibers.get('50bmg')?.cartridge.projectileDiameter).toBe(12.7)
  })

  it('gives every calibre the shell, rim and noise decided', () => {
    expect(calibers.size).toBe(30)
    for (const [id, decision] of Object.entries(decisions.calibers)) {
      expect(calibers.get(id)?.noise, id).toBe(decision.noise.value)
    }
  })
})

describe('Arsenal tables', () => {
  it('§06: reload times and loaded mass match the generated weapons', () => {
    let matched = 0
    for (const row of gallery.weapons) {
      const entry = arsenalCatalogOf(row)
      if (!entry) continue
      matched += 1
      const { timings } = weaponOf(row).action
      const { reload } = entry
      if (row[1] === 'rev') expect(timings.reload, row[0]).toBe(reload.reload)
      else if (reload.perRound !== undefined) expect(timings.perRound, row[0]).toBe(reload.perRound)
      else expect(timings.reload, row[0]).toBe(reload.reload)
      if (reload.reloadEmpty !== undefined) expect(timings.reloadEmpty, row[0]).toBe(reload.reloadEmpty)
      expect(weaponOf(row).mass, row[0]).toBe(entry.loadedMass)
    }
    expect(matched).toBe(67)
  })

  it('§07: length, barrel, empty mass, muzzle speed and accuracy match the gallery and the generated weapons', () => {
    let matched = 0
    for (const row of gallery.weapons) {
      const entry = arsenalSheetOf(row)
      if (!entry) continue
      matched += 1
      const weapon = weaponOf(row)
      if (entry.length !== undefined) expect(entry.length, row[0]).toBeCloseTo(row[4] / 1000, 9)
      if (entry.lengthRange) expect(row[4] / 1000, row[0]).toBeGreaterThanOrEqual(entry.lengthRange[0])
      if (entry.lengthRange) expect(row[4] / 1000, row[0]).toBeLessThanOrEqual(entry.lengthRange[1])
      expect(entry.barrel, row[0]).toBeCloseTo(row[5] / 1000, 9)
      expect(entry.emptyMass, row[0]).toBe(row[6])
      expect(weapon.action.muzzleSpeed, row[0]).toBe(entry.muzzleSpeed)
      expect(weapon.dimensions.lengthCollapsed, row[0]).toBe(entry.lengthCollapsed ?? decisions.stocks[weapon.id]?.value.lengthCollapsed)
      expect(weapon.action.moa, row[0]).toBe(entry.moa)
      expect(weapon.action.patternCm, row[0]).toBe(entry.patternCm)
    }
    expect(matched).toBe(67)
  })

  it('§12: calibre noise follows the attraction radius', () => {
    const radius = (source: string): number => arsenal.noise.find((row) => row.source === source)?.radius ?? -1
    const expected: Record<string, string> = {
      '22lr': '.22 LR sem supressor', '9x19': 'Pistola 9×19', '5_56x45': 'Fuzil 5,56 / 7,62×39', '7_62x39': 'Fuzil 5,56 / 7,62×39',
      '12ga_00buck': 'Escopeta 12 ga', '12ga_slug': 'Escopeta 12 ga', '12ga_birdshot': 'Escopeta 12 ga', '7_62x51': '.308 / .30-06', '30_06': '.308 / .30-06', '50bmg': '.50 BMG',
    }
    for (const [id, source] of Object.entries(expected)) expect(calibers.get(id)?.noise, id).toBe(radius(source))
  })

  it('§13: radii, noise and destruction level match the generated explosives', () => {
    for (const [id, decision] of Object.entries(decisions.explosives)) {
      const name = decision.sources.value.arsenal
      if (!name) continue
      const row = arsenal.explosives.find((entry) => entry.name === name)
      const explosive = explosives.get(id)
      if (!explosive) throw new Error(`no generated explosive ${id}`)
      expect(row, id).toBeDefined()
      expect(explosive.noise, id).toBe(row?.noise)
      expect(explosive.destructionLevel, id).toBe(row?.destructionLevel)
      if (row?.lethalRadius !== undefined) expect(explosive.lethalRadius, id).toBe(row.lethalRadius)
      if (row?.injuryRadius !== undefined) expect(explosive.injuryRadius, id).toBe(row.injuryRadius)
    }
  })
})

describe('game and Laboratory', () => {
  it('the game weapons use the Arsenal reload times', () => {
    const ids: Record<string, string> = { glock: 'glock_17', r870: 'remington_870', ak47: 'ak_47', r700: 'remington_700' }
    expect(game.weapons).toHaveLength(4)
    for (const gameWeapon of game.weapons) {
      const action = weapons.get(ids[gameWeapon.id] ?? '')?.action
      if (!action) throw new Error(`no generated weapon for ${gameWeapon.id}`)
      const { timings, perRound } = action
      if (gameWeapon.porCartucho) expect(timings.perRound, gameWeapon.id).toBe(gameWeapon.rec)
      else expect(timings.reload, gameWeapon.id).toBe(gameWeapon.rec)
      if (gameWeapon.recVazio !== undefined) expect(timings.reloadEmpty, gameWeapon.id).toBe(gameWeapon.recVazio)
      expect(Boolean(perRound), gameWeapon.id).toBe(Boolean(gameWeapon.porCartucho))
    }
  })

  it('weapon switch time is the draw time', () => {
    for (const weapon of weapons.values()) if (weapon.action.timings) expect(weapon.action.timings.draw, weapon.id).toBe(game.drawSeconds)
  })

  it('Laboratory and game blast radii equal the explosives', () => {
    const KNOWN_DEVIATIONS = [{ explosive: 'molotov', field: 'injury', source: 'game', reason: 'the game EXP has no wounding radius for the molotov (fire only); Laboratory and Arsenal say 4 m' }]
    for (const [id, decision] of Object.entries(decisions.explosives)) {
      const explosive = explosives.get(id)
      if (!explosive) throw new Error(`no generated explosive ${id}`)
      const labProfile = lab[decision.sources.value.lab ?? '']
      const gameExplosive = game.explosives[decision.sources.value.game ?? '']
      if (labProfile && !decision.copyOf) {
        expect(explosive.lethalRadius, id).toBe(labProfile.lethal)
        expect(explosive.injuryRadius, id).toBe(labProfile.injury)
      }
      if (gameExplosive) {
        expect(explosive.lethalRadius, id).toBe(gameExplosive.letal)
        const isKnown = KNOWN_DEVIATIONS.some((deviation) => deviation.explosive === id && deviation.field === 'injury' && deviation.source === 'game')
        if (!isKnown) expect(explosive.injuryRadius, id).toBe(gameExplosive.fer)
      }
    }
  })

  it('DEFAULT_RULES fault chances equal the gallery QUAL', () => {
    for (const [id, galleryKey] of Object.entries(decisions.conditions.value)) {
      const condition = DEFAULT_RULES.conditions.find((entry) => entry.id === id)
      expect(condition?.faultChance, id).toBeCloseTo((gallery.conditions[galleryKey]?.p ?? -1) / 100, 9)
    }
  })
})

describe('raw text of the sources', () => {
  it('the Gallery WEAP row of the Glock 17 reads the same as the source line', () => {
    const source = readFileSync(SOURCE_PATHS.gallery, 'utf8')
    expect(source).toContain("['Glock 17','pis','9×19','17',202,114,.63,'pistol',{st:'glock',rel:.7}]")
    expect(gallery.weapons.find((row) => row[0] === 'Glock 17')).toEqual(['Glock 17', 'pis', '9×19', '17', 202, 114, 0.63, 'pistol', { st: 'glock', rel: 0.7 }])
  })

  it('the Arsenal §06 row of the AK-47 reads the same as the source cells', () => {
    const html = readFileSync(SOURCE_PATHS.arsenal, 'utf8')
    expect(html).toContain('<td class="n">600 rpm</td><td class="n">2,6 s / 3,4 s vazio</td><td class="n">4,3 kg</td>')
    expect(arsenal.catalog.find((entry) => entry.name === 'AK-47')).toMatchObject({ cadence: '600 rpm', reload: { reload: 2.6, reloadEmpty: 3.4, isOneByOne: false }, loadedMass: 4.3 })
  })
})
