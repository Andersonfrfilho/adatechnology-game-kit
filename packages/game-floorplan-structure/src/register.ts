import type { FloorplanEngine, ResultExtensionContext } from '@adatechnology/game-floorplan'

import { constructionFor } from './construction'
import enLocale from './locales/en.json'
import ptBrLocale from './locales/pt-BR.json'
import type { ConstructionBuild } from './registry'
import { buildStructure } from './structure'
import type { TankPlanOptions } from './water-tank'
import { planWaterTank } from './water-tank'
import { structureLayer } from './viewer-layer'
import type { Roof, StructureOptions, WallDetail } from './types'

export interface StructurePackOptions {
  /** Litres of the tank by template id or style id. */
  tankCapacities?: Record<string, number>
}

type Cache = { build: ConstructionBuild; roof?: Roof }
const CACHE = new WeakMap<object, Cache>()

const cacheOf = (result: object): Cache => {
  const cache = CACHE.get(result)
  if (!cache) throw new Error('The construction extension did not run for this plan')
  return cache
}

function constructionExtension(context: ResultExtensionContext): unknown {
  const build = constructionFor({ result: context.result as never, seed: context.seed, template: context.plan.tpl as never, options: context.options })
  CACHE.set(context.result, { build })
  return build.construction
}

function structureExtension(context: ResultExtensionContext): unknown {
  const cache = cacheOf(context.result)
  const options: StructureOptions = { construction: cache.build.construction, extras: cache.build.extras ?? {}, tank: context.result.waterTank ?? null, wallDetail: (context.options.wallDetail ?? 'panels') as WallDetail }
  const { roof, ...structure } = buildStructure(context.result, options)
  cache.roof = roof
  for (const part of structure.parts) {
    if (part.door === undefined || part.steps === undefined) continue
    const door = context.result.doors.find((d: { id: string }) => d.id === part.door)
    if (door) door.steps = part.steps
  }
  return structure
}

/**
 * Registers the structure into the engine: `result.construction`, `result.structureExtras`, `result.waterTank`, `result.structure` and `result.roof` of every plan,
 * and the structure layer of the 2D viewer. Register the content packs first.
 */
export function register(engine: FloorplanEngine, options: StructurePackOptions = {}): void {
  engine.registerLocale('en', enLocale)
  engine.registerLocale('pt-BR', ptBrLocale)
  engine.registerResultExtension('construction', constructionExtension)
  engine.registerResultExtension('structureExtras', (context) => cacheOf(context.result).build.extras ?? {}, { after: ['construction'] })
  engine.registerResultExtension(
    'waterTank',
    (context) => {
      const tank: TankPlanOptions = { capacities: options.tankCapacities, custom: context.plan.tpl.tank, location: context.plan.tpl.tankLocation }
      return planWaterTank(context.result as never, context.rng, tank)
    },
    { after: ['construction'], seedKey: 'caixa' },
  )
  engine.registerResultExtension('structure', structureExtension, { after: ['construction', 'structureExtras', 'waterTank'] })
  engine.registerResultExtension('roof', (context) => cacheOf(context.result).roof ?? null, { after: ['structure'] })
  engine.registerViewerLayer(structureLayer)
}
