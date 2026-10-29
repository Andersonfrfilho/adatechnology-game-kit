import type { ScatterRule } from '@adatechnology/game-vegetation'
import { getSpecies, pickForContext } from './index'
import type { Region, Species } from './types'

/** The four groups the picked species are split into, each planted by its own scatter rule. */
export type PlantGroup = 'trees' | 'hedges' | 'mid' | 'ground'

export interface ScatterRulesOptions {
  /** How many different species to pick for the context (default 12). */
  n?: number
  /** How many draws of the regional table to try to find `n` usable species (default 60). */
  draws?: number
  /** Archetypes left out of the picks (default `['vine']`: a vine needs a support to climb). */
  skipArchetypes?: readonly string[]
  /** Leave out the big trees (size `l`, or a tree that is not of size `s`): the front yard and the narrow strips beside the house. */
  noLarge?: boolean
  /** Cap on the plants of each group (the page's `trees`, `hedges`, `mid`, `ground`); no cap when absent. */
  maxCount?: Partial<Record<PlantGroup, number>>
  /** Trees per square metre (default 0.03). */
  treeDensity?: number
  /** Replaces or extends the rule of a group (the defaults are the Viveiro's numbers). */
  groupRules?: Partial<Record<PlantGroup, Partial<Omit<ScatterRule, 'species'>>>>
  /** Which species form each group. Defaults: trees are tagged `tree` and not size `s`; hedges are shrubs tagged `hedge`; ground is grass tufts and ferns; mid is the rest. */
  classify?: (species: Species) => PlantGroup
}

export interface ScatterRulesResult {
  /** One rule for each group that has species, in the order trees, hedges, mid, ground. */
  rules: ScatterRule[]
  /** The distinct species picked, in the order they were drawn. */
  picks: Species[]
}

const isTree = (s: Species): boolean => s.tags.includes('tree') && s.size !== 's'

/** The Viveiro's split: trees, then hedges, then ground cover (grass and ferns), then the rest. */
export const defaultClassify = (s: Species): PlantGroup => (isTree(s) ? 'trees' : s.archetype === 'shrub' && s.tags.includes('hedge') ? 'hedges' : s.archetype === 'grass_tuft' || s.archetype === 'fern' ? 'ground' : 'mid')

const DEFAULT_RULES: Record<PlantGroup, Omit<ScatterRule, 'species' | 'maxCount'>> = {
  trees: { density: 0.03, minDistance: 4.2, scale: [0.85, 1.05], prefer: 'any' },
  hedges: { density: 0.5, minDistance: 1.1, prefer: 'edge', edgeWidth: 0.6, scale: [0.9, 1.1] },
  mid: { density: 0.45, minDistance: 0.9, scale: [0.85, 1.15] },
  ground: { density: 1.2, minDistance: 0.5, scale: [0.8, 1.2] },
}

const ORDER: PlantGroup[] = ['trees', 'hedges', 'mid', 'ground']

/**
 * Turns the regional planting table of a context into scatter rules for `scatter` of `@adatechnology/game-vegetation`: draws species from the table (the same seed draws the same),
 * leaves out what cannot be planted alone (vines) and, when asked, the big trees, and splits the picks into trees, hedges, the middle layer and the ground cover, each with its own
 * density, spacing and scale. Port of the Viveiro's `rulesFor` (vegetacao__viveiro.js 77943-77963); every number of it is an option.
 */
export function scatterRulesFor(region: Region, context: string, seed: number | string, options: ScatterRulesOptions = {}): ScatterRulesResult {
  const n = options.n ?? 12
  const draws = options.draws ?? 60
  const skip = new Set(options.skipArchetypes ?? ['vine'])
  const classify = options.classify ?? defaultClassify
  const seen = new Set<string>()
  const picks: Species[] = []
  for (let i = 0; i < draws && picks.length < n; i++) {
    const id = pickForContext(region, context, `${seed}:${context}:${i}`)
    const species = getSpecies(id)
    if (!species || seen.has(id) || skip.has(species.archetype)) continue
    if (options.noLarge && (species.size === 'l' || isTree(species))) continue
    seen.add(id)
    picks.push(species)
  }
  const groups: Record<PlantGroup, string[]> = { trees: [], hedges: [], mid: [], ground: [] }
  for (const species of picks) groups[classify(species)].push(species.id)
  const rules: ScatterRule[] = []
  for (const group of ORDER) {
    const ids = groups[group]
    if (ids.length === 0) continue
    const base = { ...DEFAULT_RULES[group], ...(group === 'trees' && options.treeDensity !== undefined ? { density: options.treeDensity } : {}), ...options.groupRules?.[group] }
    const maxCount = options.maxCount?.[group]
    rules.push({ species: ids, ...base, ...(maxCount === undefined ? {} : { maxCount }) })
  }
  return { rules, picks }
}
