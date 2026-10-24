import { existsSync, readFileSync } from 'node:fs'

import type { GoldenRecord } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { CHROME_GOLDENS } from '../src/golden/chrome-goldens'
import { fixturePath } from '../src/paths'

const read = (package_: string, file: string): GoldenRecord => JSON.parse(readFileSync(fixturePath(package_, file), 'utf8')) as GoldenRecord
const eventsOf = (record: GoldenRecord, type: string): readonly Record<string, unknown>[] => record.events.filter((event) => event.type === type).map((event) => event.data ?? {})

// The Chrome captures run the team pages in headless Chrome (`pnpm --filter @adatechnology/characters-catalog-tool golden:chrome`; `golden:chrome:check`
// records each twice and compares). Vitest cannot start Chrome in CI, so these tests read the recorded fixtures and check what they must contain.
describe('Chrome golden fixtures', () => {
  it('has a fixture for each of the capture configurations', () => {
    expect(CHROME_GOLDENS.map((golden) => golden.id).sort()).toEqual(['animal-skin', 'animals', 'body', 'cut-hierarchy', 'damage-segments', 'gait', 'instanced', 'people'])
    for (const golden of CHROME_GOLDENS) expect(existsSync(golden.out), golden.id).toBe(true)
  })

  it('G-damage-segments: each Arsenal segment against four weapons, the grenade at 0.5 to 2 m, bleeders with rate, duration and spurt', () => {
    const golden = read('game-characters', 'arsenal-damage-segments.json')
    const hits = eventsOf(golden, 'hit')
    const find = (scenario: string, hit: number) => hits.find((entry) => entry.scenario === scenario && entry.hit === hit)
    expect(find('pistola_head', 1)).toMatchObject({ alive: false, why: 'Tiro na cabeça' })
    expect(find('fuzil_thigh_L', 2)).toMatchObject({ state: 'Rastejador' })
    expect(find('cinquenta_torso', 1)).toMatchObject({ alive: false, state: 'Morto' })
    expect(JSON.stringify(find('pistola_head', 1)?.bleeders)).toBe('[[60,45,1]]')
    expect(eventsOf(golden, 'grenade')).toHaveLength(12)
  })

  it('G-cut-hierarchy: an arm cut at the joint takes the forearm and hand; a broken leg limps; a fatal torso is human death', () => {
    const golden = read('game-characters', 'elenco-cut-hierarchy.json')
    const hits = eventsOf(golden, 'hit')
    const last = (scenario: string) => hits.filter((entry) => entry.scenario === scenario).at(-1)
    expect(String(last('facao_uArm0')?.message)).toContain('Cortado na junta: cai o braço inteiro')
    expect(String(last('facao_uArm0')?.states)).toContain('fArm0:cut')
    expect(String(last('facao_uArm0')?.states)).toContain('hand0:cut')
    expect(last('p9_shin1')).toMatchObject({ limp: [0, 1] })
    expect(last('p9_torso')).toMatchObject({ dead: 1 })
  })

  it('G-gait: 13 types at 9 instants; G-people: 44 portraits; G-animals: 13 species in 5 states', () => {
    expect(eventsOf(read('game-characters-three', 'bestiary-gait.json'), 'pose')).toHaveLength(13 * 9)
    expect(Object.keys(read('game-characters-three', 'portraits-people.json').scenes)).toHaveLength(44)
    expect(Object.keys(read('game-animals-three', 'animals-page.json').scenes)).toHaveLength(13 * 5)
  })

  it('G-body: 13 types x decay 0..3 x seeds 1..5 x 3 LODs as scene hashes, and the baked variants of the ZVAR rule', () => {
    const golden = read('game-characters-three', 'game-best-body.json')
    expect(Object.keys(golden.scenes)).toHaveLength(13 * 4 * 5 * 3)
    const bakes = eventsOf(golden, 'bake')
    expect(bakes).toHaveLength((4 + 3 + 2 + 2 + 9) * 3)
    expect(new Set(Object.values(golden.scenes).map((scene) => scene.hash)).size).toBeGreaterThan(500)
  })

  it('G-instanced: the body at 16, 10 and 5 segments; the game triangle counts are above the 2,500 / 800 / 250 horde budget at the lower LODs', () => {
    const bodies = eventsOf(read('game-characters-three', 'game-instanced-body.json'), 'body')
    expect(bodies.map((body) => body.triangles)).toEqual([2016, 952, 495])
    const budget = [2500, 800, 250]
    expect(bodies.map((body, index) => (body.triangles as number) <= (budget[index] ?? 0))).toEqual([true, false, false])
  })

  it('G-animals (skin): the 13 species merged into one skinned geometry, healthy and bitten', () => {
    const skins = eventsOf(read('game-props3d', 'game-animal-skin.json'), 'skin')
    expect(skins).toHaveLength(26)
    expect(skins.filter((skin) => skin.dead === true).map((skin) => skin.species).sort()).toEqual(['capybara', 'cow', 'horse'])
    expect(skins.filter((skin) => skin.infectedVisual === true)).toHaveLength(6)
  })
})
