import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as species from '../src'
import { regions, scatterRulesFor } from '../src'
import type { ScatterRulesOptions } from '../src'

/**
 * G-rules: `rulesFor` of the Viveiro page (vegetacao__viveiro.js 77943-77963) is cut from the page and run on the species of the pack; `scatterRulesFor` must give the same rules and
 * the same picks for the four plantings of the page's yard (front yard, backyard, the side strips, the sidewalk tree) over many seeds.
 */
const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(here, '../../../specs/001-migracao-entregas-dos-times/sources/vegetacao__viveiro.js'), 'utf8')
const from = source.indexOf('function rulesFor(ctx, seed, opt) {')
const to = source.indexOf('function buildLotVeg() {', from)
const pageRulesFor = new Function('GVS', `${source.slice(from, to)}\nreturn rulesFor`)(species) as (ctx: string, seed: string, opt: Record<string, unknown>) => { rules: unknown[]; picks: { id: string }[] }

/** The four plantings of `buildLotVeg` (the page's options, then ours). */
const PLANTINGS: { context: string; page: Record<string, unknown> }[] = [
  { context: 'front_yard', page: { n: 12, trees: 1, hedges: 10, mid: 14, ground: 40, noLarge: true } },
  { context: 'backyard', page: { n: 14, trees: 3, hedges: 4, mid: 12, ground: 50 } },
  { context: 'front_yard', page: { n: 8, trees: 0, hedges: 4, mid: 6, ground: 14, noLarge: true } },
  { context: 'sidewalk_tree', page: { n: 4, trees: 2, hedges: 0, mid: 0, ground: 0, treeDensity: 0.3 } },
]
const ours = (page: Record<string, unknown>): ScatterRulesOptions => ({
  n: page.n as number,
  ...(page.noLarge ? { noLarge: true } : {}),
  ...(page.treeDensity ? { treeDensity: page.treeDensity as number } : {}),
  maxCount: { trees: page.trees as number, hedges: page.hedges as number, mid: page.mid as number, ground: page.ground as number },
})

describe('team golden: rulesFor of the Viveiro against scatterRulesFor', () => {
  const cases = PLANTINGS.flatMap((planting, index) => Array.from({ length: 12 }, (_, seed) => ({ ...planting, index, seed: `quintal-${seed + 1}` })))
  it.each(cases)('planting $index ($context) with seed $seed gives the same rules and picks', ({ context, page, seed }) => {
    const want = pageRulesFor(context, seed, page)
    const got = scatterRulesFor(regions.br, context, seed, ours(page))
    expect(got.picks.map((s) => s.id)).toEqual(want.picks.map((s) => s.id))
    expect(got.rules).toEqual(want.rules)
  })

  it('actually plants something in each place', () => {
    for (const { context, page } of PLANTINGS) {
      const { rules, picks } = scatterRulesFor(regions.br, context, 'quintal-1', ours(page))
      expect(rules.length, context).toBeGreaterThan(0)
      expect(picks.length, context).toBeGreaterThan(0)
    }
  })
})

describe('scatterRulesFor options', () => {
  it('drops vines, and the big trees when asked', () => {
    for (let seed = 0; seed < 30; seed++) {
      const open = scatterRulesFor(regions.br, 'backyard', `s${seed}`, { n: 14 })
      expect(open.picks.some((s) => s.archetype === 'vine')).toBe(false)
      const closed = scatterRulesFor(regions.br, 'front_yard', `s${seed}`, { n: 12, noLarge: true })
      expect(closed.picks.some((s) => s.size === 'l' || (s.tags.includes('tree') && s.size !== 's'))).toBe(false)
    }
    const vines = scatterRulesFor(regions.br, 'backyard', 'v', { n: 40, skipArchetypes: [] })
    expect(vines.picks.length).toBeGreaterThanOrEqual(scatterRulesFor(regions.br, 'backyard', 'v', { n: 40 }).picks.length)
  })

  it('is deterministic by seed and changes with it', () => {
    const a = scatterRulesFor(regions.br, 'backyard', 'one', { n: 14 })
    expect(scatterRulesFor(regions.br, 'backyard', 'one', { n: 14 })).toEqual(a)
    const others = ['two', 'three', 'four', 'five'].map((seed) => scatterRulesFor(regions.br, 'backyard', seed, { n: 14 }).picks.map((s) => s.id).join())
    expect(new Set([a.picks.map((s) => s.id).join(), ...others]).size).toBeGreaterThan(1)
  })

  it('takes the numbers of every group, the number of draws and its own classification', () => {
    const base = scatterRulesFor(regions.br, 'backyard', 'x', { n: 14 })
    const tuned = scatterRulesFor(regions.br, 'backyard', 'x', { n: 14, groupRules: { ground: { density: 3 }, trees: { minDistance: 8 } }, maxCount: { ground: 5 } })
    const groundOf = (rules: typeof base.rules): (typeof base.rules)[number] | undefined => rules.find((rule) => rule.density === 1.2 || rule.density === 3)
    expect(groundOf(tuned.rules)).toMatchObject({ density: 3, maxCount: 5 })
    expect(groundOf(base.rules)).toMatchObject({ density: 1.2 })
    expect(tuned.rules.find((rule) => rule.minDistance === 8)).toBeTruthy()
    expect(scatterRulesFor(regions.br, 'backyard', 'x', { n: 14, draws: 1 }).picks.length).toBeLessThanOrEqual(1)
    const all = scatterRulesFor(regions.br, 'backyard', 'x', { n: 14, classify: () => 'mid' })
    expect(all.rules).toHaveLength(1)
    expect(all.rules[0]).toMatchObject({ density: 0.45 })
  })

  it('has no rule for a group without species and fails clearly for an unknown context', () => {
    expect(scatterRulesFor(regions.br, 'sidewalk_tree', 'x', { n: 4, maxCount: { trees: 2 } }).rules.every((rule) => (rule.species as string[]).length > 0)).toBe(true)
    expect(() => scatterRulesFor(regions.br, 'moon', 'x')).toThrow(/moon/)
  })
})
