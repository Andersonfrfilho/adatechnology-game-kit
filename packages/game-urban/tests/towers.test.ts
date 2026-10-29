import { describe, expect, it } from 'vitest'
import { engine } from '@adatechnology/game-floorplan'
import { register as registerResidential, residentialTowerLayout, RESIDENTIAL_TOWER_DEFAULTS } from '@adatechnology/game-floorplan-residential'
import { register as registerCommercial, officeTowerLayout, OFFICE_TOWER_DEFAULTS } from '@adatechnology/game-floorplan-commercial'

import { DEFAULT_TOWER_PRESETS, TOWER_DEFAULTS, TOWER_PATTERNS, TOWER_SAMPLE_CELLS, createTowerDrawer, createUrban, drawTower, towerPresetOf, towerStoreys } from '../src'
import type { TowerOptions, TowerRequest } from '../src'

registerResidential(engine)
registerCommercial(engine)

const block = (kit: ReturnType<typeof createUrban>, seed = 7, maxHeight = 220) => {
  const b = kit.builder({ seed })
  const placed = kit.block.fill(b, { cx: 0, cz: 0, size: 100, minHeight: 20, maxHeight, k: 4, gap: 0 })
  return { scene: b.scene(), placed }
}

/** The city draws the tall lots as towers (design T10-estrutura-real.md §11.7). */
describe('towers in the city', () => {
  it('are off by default: the block is the same with towers false, and a tall building is a box', () => {
    const plain = block(createUrban())
    expect(block(createUrban({ towers: false })).scene).toEqual(plain.scene)
    expect(plain.scene.parts.some((p) => p.shape === 'box' && p.color === 0x2a2d31)).toBe(false)
  })

  it('on, a building from the minimum height up is a tower: podium, shaft, plant floors, parapet, mast and a row of windows on every storey', () => {
    const { scene, placed } = block(createUrban({ towers: true }))
    const towers = placed.filter((p) => p.height >= 60)
    expect(towers.length).toBeGreaterThan(0)
    expect(scene.parts.filter((p) => p.shape === 'box' && p.color === 0x2a2d31)).toHaveLength(towers.length)
    expect(scene.parts.some((p) => p.shape === 'cylinder' && p.color === 0x9aa0a6)).toBe(true)
    expect(scene.windows.lit.length + scene.windows.dark.length).toBeGreaterThan(towers.length * 100)
    expect(scene.parts.length).toBeGreaterThan(block(createUrban()).scene.parts.length)
  })

  it('below the minimum height nothing changes: the same block, byte for byte', () => {
    const low = block(createUrban(), 7, 50)
    expect(block(createUrban({ towers: true }), 7, 50).scene).toEqual(low.scene)
    expect(block(createUrban({ towers: { minHeight: 300 } })).scene).toEqual(block(createUrban()).scene)
  })

  it('the minimum height, the presets and their weights are options', () => {
    const lower = block(createUrban({ towers: { minHeight: 30 } })).scene.parts.filter((p) => p.shape === 'box' && p.color === 0x2a2d31).length
    const upper = block(createUrban({ towers: { minHeight: 120 } })).scene.parts.filter((p) => p.shape === 'box' && p.color === 0x2a2d31).length
    expect(lower).toBeGreaterThan(upper)
    const seen: string[] = []
    block(createUrban({ towers: { presets: [{ id: 'only', weight: 1, storeyHeight: 3, mechanicalEvery: false, glass: false }], provider: (r) => seen.push(r.preset.id) } }))
    expect(seen.length).toBeGreaterThan(0)
    expect(new Set(seen)).toEqual(new Set(['only']))
    const mix = new Set<string>()
    for (let seed = 1; seed <= 12; seed++) block(createUrban({ towers: { provider: (r) => mix.add(r.preset.id) } }), seed)
    expect(mix).toEqual(new Set(['office', 'residential']))
  })

  it('a provider draws the tower itself and sees the lot, the height and the facade colour', () => {
    const requests: TowerRequest[] = []
    const kit = createUrban({ towers: { provider: (request, b) => { requests.push(request); b.box(request.x, 0, request.z, request.width, request.height, request.depth, 0x123456) } } })
    const { scene, placed } = block(kit)
    expect(requests.length).toBe(placed.filter((p) => p.height >= 60).length)
    expect(requests.every((r) => r.height >= 60 && r.width > 10 && r.preset.id.length > 0)).toBe(true)
    expect(scene.parts.filter((p) => p.shape === 'box' && p.color === 0x123456)).toHaveLength(requests.length)
  })

  it('the tower has the storeys of its height, none of its windows on the plant floors and its top above the lot height', () => {
    const kit = createUrban()
    const office = DEFAULT_TOWER_PRESETS[0]
    const b = kit.builder({ seed: 3 })
    const placed = drawTower(b, { x: 0, z: 0, width: 24, depth: 24, height: 160, color: 0x445566, preset: office, lit: 0.1 })
    const storeys = towerStoreys(160, office)
    expect(storeys).toBe(40)
    expect(placed.height).toBeGreaterThan(160)
    const plantY = 20 * office.storeyHeight + 0.5 * office.storeyHeight
    const windows = [...b.windows.lit, ...b.windows.dark]
    expect(windows.some((w) => w.y > plantY && w.y < plantY + office.storeyHeight)).toBe(false)
    expect(windows.filter((w) => w.y > plantY - office.storeyHeight && w.y < plantY).length).toBeGreaterThan(10)
    // every window is on the skin, none above the roof
    expect(windows.every((w) => w.y < placed.height)).toBe(true)
  })

  it('the default presets are the numbers of the office and residential typologies', () => {
    const [office, residential] = DEFAULT_TOWER_PRESETS
    expect(office.storeyHeight).toBeCloseTo(officeTowerLayout().pitch, 9)
    expect(office.mechanicalEvery).toBe(OFFICE_TOWER_DEFAULTS.mechanicalEvery)
    expect(office.glass).toBe(OFFICE_TOWER_DEFAULTS.facade === 'curtain')
    expect(residential.storeyHeight).toBeCloseTo(residentialTowerLayout().pitch, 9)
    expect(residential.mechanicalEvery).toBe(RESIDENTIAL_TOWER_DEFAULTS.mechanicalEvery)
    expect(residential.glass).toBe(RESIDENTIAL_TOWER_DEFAULTS.facade === 'curtain')
    expect(TOWER_DEFAULTS.minHeight).toBe(60)
  })

  it('a lot taller than 60 storeys is drawn at 60 storeys by default; maxStoreys, a preset range and towerPresetOf configure it from the game', () => {
    expect(TOWER_DEFAULTS.maxStoreys).toBe(60)
    const office = DEFAULT_TOWER_PRESETS[0]
    const heights = (towers: TowerOptions, lot = 400) => {
      const seen: number[] = []
      const draw = createTowerDrawer({ ...towers, provider: (r) => { seen.push(r.height) } }, () => ({ x: 0, z: 0, width: 1, depth: 1, height: 1, color: 0 }))
      draw(createUrban().builder({ seed: 1 }), 0, 0, 24, 24, lot, 0x445566)
      return seen[0]
    }
    expect(heights({ presets: [office] })).toBe(240)
    expect(heights({ presets: [office], maxStoreys: 80 })).toBe(320)
    expect(heights({ presets: [{ ...office, maxStoreys: 30 }] })).toBe(120)
    expect(heights({ presets: [{ ...office, minStoreys: 25 }] }, 70)).toBe(100)
    const mine = towerPresetOf('mine', 1, officeTowerLayout({ storeys: 40, height: 3 }), { mechanicalEvery: 10 })
    expect(mine).toMatchObject({ id: 'mine', storeyHeight: officeTowerLayout({ storeys: 40, height: 3 }).pitch, glass: true, mechanicalEvery: 10 })
    // weights mix the typologies: only residential when the office has weight 0
    const only = createUrban({ towers: { presets: [{ ...DEFAULT_TOWER_PRESETS[0], weight: 0 }, { ...DEFAULT_TOWER_PRESETS[1], weight: 1 }] } })
    expect(only.towers.options!.presets!.map((p) => p.weight)).toEqual([0, 1])
  })

  it('the financial district pack puts towers on the avenue; without the option the same numbers draw tall boxes', () => {
    const on = createUrban({ packs: { neighbourhoods: TOWER_PATTERNS }, towers: true })
    expect(on.neighbourhoods.ids()).toContain('financial_district')
    const plan = on.neighbourhoods.get('financial_district').compose(on.builder(), { x: 0, z: 0 })
    expect(plan.buildings).toHaveLength(8)
    expect(plan.buildings.every((p) => p.height >= 70)).toBe(true)
    const sceneOn = (() => { const b = on.builder(); on.neighbourhoods.get('financial_district').compose(b, { x: 0, z: 0 }); return b.scene() })()
    const off = createUrban({ packs: { neighbourhoods: TOWER_PATTERNS } })
    const sceneOff = (() => { const b = off.builder(); off.neighbourhoods.get('financial_district').compose(b, { x: 0, z: 0 }); return b.scene() })()
    expect(sceneOn.parts.some((p) => p.shape === 'box' && p.color === 0x2a2d31)).toBe(true)
    expect(sceneOff.parts.some((p) => p.shape === 'box' && p.color === 0x2a2d31)).toBe(false)
    expect(TOWER_SAMPLE_CELLS.financial_district).toBeDefined()
    // the Galeria's own sheet is untouched by the pack
    expect(createUrban().neighbourhoods.ids()).not.toContain('financial_district')
  })

  it('the downtown avenue turns into towers when a game raises its heights and turns them on', () => {
    const kit = createUrban({ towers: true, patch: { neighbourhoods: { downtown: { params: { buildings: { north: { minHeight: 70, range: 100 } } } } } } })
    const b = kit.builder()
    const plan = kit.neighbourhoods.get('downtown').compose(b, { x: 0, z: 0 })
    expect(plan.buildings.slice(0, 1).every((p) => p.height >= 70)).toBe(true)
    expect(b.scene().parts.some((p) => p.shape === 'box' && p.color === 0x2a2d31)).toBe(true)
  })
})

/** `block.fill` takes the storeys and the uses of each building, as a city block's `building` gives them. */
describe('block.fill with floors and uses', () => {
  const fill = (kit: ReturnType<typeof createUrban>, extra: object, seed = 7) => {
    const b = kit.builder({ seed })
    const requests: TowerRequest[] = []
    const placed = kit.block.fill(b, { cx: 0, cz: 0, size: 100, minHeight: 20, maxHeight: 220, k: 4, gap: 0, ...extra })
    return { b, placed, requests }
  }

  it('without floors and uses the output is the same as before', () => {
    const a = fill(createUrban(), {}), b = fill(createUrban(), { floors: undefined, uses: undefined })
    expect(b.placed).toEqual(a.placed)
    expect(b.b.scene()).toEqual(a.b.scene())
  })

  it('floors give the height as storeys times the storey height of the use, a single number is that many storeys', () => {
    const [office, residential] = DEFAULT_TOWER_PRESETS
    const one = fill(createUrban(), { floors: 5, uses: { commercial: 1 } }).placed
    expect(one.every((p) => Math.abs(p.height - 5 * office.storeyHeight) < 1e-9)).toBe(true)
    const res = fill(createUrban(), { floors: [3, 9], uses: { residential: 1 } }).placed
    expect(res.every((p) => { const n = p.height / residential.storeyHeight; return Math.abs(n - Math.round(n)) < 1e-9 && n >= 3 && n <= 9 })).toBe(true)
    const noUse = fill(createUrban(), { floors: [3, 9], storeyHeight: 3 }).placed
    expect(noUse.every((p) => Math.abs(p.height / 3 - Math.round(p.height / 3)) < 1e-9)).toBe(true)
  })

  it('tall commercial lots are office towers, tall residential lots residential towers, low ones keep the plain building', () => {
    const seen: TowerRequest[] = []
    const kit = createUrban({ towers: { provider: (r) => { seen.push(r) } } })
    fill(kit, { floors: [30, 40], uses: { commercial: 1 } })
    expect(seen.length).toBeGreaterThan(8)
    expect(seen.every((r) => r.preset.id === 'office' && r.use === 'commercial' && r.storeys! >= 30)).toBe(true)
    seen.length = 0
    fill(kit, { floors: 40, uses: { residential: 1 } })
    expect(seen.every((r) => r.preset.id === 'residential' && r.storeys === 40)).toBe(true)
    seen.length = 0
    fill(kit, { floors: [2, 6], uses: { commercial: 1, residential: 1 } })
    expect(seen).toHaveLength(0)
    seen.length = 0
    fill(kit, { floors: 80, uses: { commercial: 1 } })
    expect(seen.every((r) => r.height === 60 * r.preset.storeyHeight)).toBe(true)
  })

  it('the mix of uses follows the weights, and storeyPresets maps a use to another preset', () => {
    const seen: TowerRequest[] = []
    const kit = createUrban({ towers: { provider: (r) => { seen.push(r) } } })
    fill(kit, { floors: 30, uses: { commercial: 1, residential: 1 } })
    expect(new Set(seen.map((r) => r.preset.id))).toEqual(new Set(['office', 'residential']))
    seen.length = 0
    fill(kit, { floors: 30, uses: { industrial: 1 }, storeyPresets: { industrial: 'office' } })
    expect(seen.every((r) => r.preset.id === 'office')).toBe(true)
  })
})
