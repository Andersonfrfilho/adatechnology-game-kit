import { engine } from '@adatechnology/game-floorplan'
import { register as registerCommercial } from '@adatechnology/game-floorplan-commercial'
import { postApocalypticStates, register as registerPostApocalyptic } from '@adatechnology/game-floorplan-post-apocalyptic'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { register as registerRural } from '@adatechnology/game-floorplan-rural'
import { register as registerStructure } from '@adatechnology/game-floorplan-structure'
import { GAME_DEPTH_PRECISION, coincidentFacesOf } from '@adatechnology/game-shapes-three'
import type { CoincidentFaceHit } from '@adatechnology/game-shapes-three'

import { THREE, houseOf } from './houses'
import type { HousePlan } from '../../src'

registerResidential(engine, { region: 'br' })
registerCommercial(engine, { region: 'br' })
registerStructure(engine)
registerRural(engine)
registerPostApocalyptic(engine)

/** The seeds the plan tests (all-plans.test.ts) use. */
export const ZFIGHT_SEEDS = [1, 2, 3] as const
export const ZFIGHT_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const
void postApocalypticStates

interface TemplateInfo { readonly id: string; readonly floorRange: readonly [number, number] | null }

/** Every template the engine lists (towers are 20 to 60 storeys of frame: their own package checks them at height, as the plan tests do). */
export function houseTemplates(): string[] {
  return (engine.listTemplates() as unknown as readonly TemplateInfo[]).filter((t) => (t.floorRange?.[0] ?? 1) < 10).map((t) => t.id)
}

/** The templates of a comma-separated list (every house template when empty). */
export function selectedTemplates(list: string | undefined): string[] {
  const asked = (list ?? '').split(',').map((id) => id.trim()).filter(Boolean)
  return asked.length ? asked : houseTemplates()
}

type StagedHouse = ReturnType<typeof houseOf>['house'] & { setConstructionLevel?(level: number, options?: { waterLayer?: boolean; roofLayer?: boolean; lotLayer?: boolean }): number }

export interface HouseConflict {
  readonly template: string
  readonly seed: number
  readonly level: number
  readonly hit: CoincidentFaceHit
}

/** Stable name of a part for the ledger: ids and indices dropped, so `wall_12` and `wall_3` are one kind of part. */
export const kindOf = (label: string): string => label.replace(/\d+(\.\d+)?/g, '#')

export const pairKey = (hit: CoincidentFaceHit): string => {
  const [a, b] = [kindOf(hit.labelA), kindOf(hit.labelB)].sort()
  return `${a} × ${b} (${hit.kind})`
}

/** One line of the report: where the two faces are and how far apart. */
export function describeConflict({ template, seed, level, hit }: HouseConflict): string {
  const gap = hit.separation === undefined ? '' : ` ${(hit.separation * 1000).toFixed(2)} mm apart`
  return `${template} #${seed} level ${level}: ${hit.labelA} × ${hit.labelB} (${hit.kind ?? 'coplanar'}${gap}) at (${hit.point.map((v) => v.toFixed(2)).join(', ')}), ${(hit.area * 1e4).toFixed(1)} cm²`
}

/** Every drawn mesh of one house at one level (structure, roof, gutters, installations, interactables, terrain, spoil heaps), through the near-coplanar detector. */
export function conflictsAt(house: StagedHouse, level: number, cap: number): CoincidentFaceHit[] {
  house.setConstructionLevel?.(level, { roofLayer: true, lotLayer: true, waterLayer: true })
  return coincidentFacesOf(house.group as never, { depth: GAME_DEPTH_PRECISION, maxHits: 50_000, maxPerPair: cap })
}

/** Builds one plan with the construction stages and walks the levels. A template that cannot be built staged returns the reason. */
export function houseConflicts(template: string, seed: number, cap: number): { conflicts: HouseConflict[]; skipped?: string } {
  const plan = engine.generate(template, { seed, state: 'normal' }) as unknown as HousePlan
  let house: StagedHouse
  try {
    house = houseOf(plan, {}, { quality: 'game', constructionStages: true, constructionLevel: 8 }).house as StagedHouse
  } catch (error) {
    return { conflicts: [], skipped: String((error as Error).message).slice(0, 120) }
  }
  if (!house.setConstructionLevel) return { conflicts: [], skipped: 'no construction stages' }
  const conflicts = ZFIGHT_LEVELS.flatMap((level) => conflictsAt(house, level, cap).map((hit) => ({ template, seed, level, hit })))
  return { conflicts }
}

export { THREE }
