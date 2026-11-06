import { engine } from '@adatechnology/game-floorplan'
import type { FloorplanResult } from '@adatechnology/game-floorplan'
import type { AdapterSource, ContentStack, SourceChimney } from '../../src'

/** A plan of the engine with the structure pack's extensions, which the tests read and change. */
export type TestPlan = FloorplanResult & {
  contents: Record<string, ContentStack[]>
  utilities: NonNullable<AdapterSource['utilities']> & { electrical: NonNullable<NonNullable<AdapterSource['utilities']>['electrical']> }
  structureExtras?: { chimney?: SourceChimney } | null
}
import { register as registerCommercial } from '@adatechnology/game-floorplan-commercial'
import { register as registerPostApocalyptic } from '@adatechnology/game-floorplan-post-apocalyptic'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { register as registerRural } from '@adatechnology/game-floorplan-rural'
import { register as registerStructure } from '@adatechnology/game-floorplan-structure'
import * as GameInteractables from '@adatechnology/game-interactables'
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'

registerResidential(engine)
registerCommercial(engine)
registerRural(engine)
registerPostApocalyptic(engine)
registerStructure(engine)

export { engine, GameInteractables, GameInteractablesHousehold }

/** A plan of the engine with every pack registered. */
export const planOf = (template: string, seed: number, state = 'normal', extra: Record<string, unknown> = {}): TestPlan => engine.generate(template, { seed, state, ...extra }) as TestPlan

/** Templates of the residential, commercial and rural packs the tests walk through. */
export const TEMPLATES = [
  'single_storey_a', 'townhouse', 'apartment_basic', 'budget_slab_house', 'budget_semi_detached', 'mid_modern_single_storey', 'mid_modern_townhouse', 'high_end_contemporary', 'mansion', 'apartment_modern',
  'market', 'pharmacy', 'wood_frame_house', 'a_frame_chalet', 'log_cabin', 'shack', 'campsite',
]
