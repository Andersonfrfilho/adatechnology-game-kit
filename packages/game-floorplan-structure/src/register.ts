import type { FloorplanEngine, ResultExtensionContext } from '@adatechnology/game-floorplan'

import { constructionFor } from './construction'
import enLocale from './locales/en.json'
import ptBrLocale from './locales/pt-BR.json'
import type { ConstructionBuild } from './registry'
import { buildStructure } from './structure'
import { contentOf } from './utilities/content'
import { planContents, planUtilities } from './utilities'
import { addOutbuildingPaths, planOutbuildings } from './utilities/outbuildings'
import type { EnergyConfig } from './utilities/electrical'
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

const COOKING_CYLINDER = { type: 'cooking_gas_cylinder', category: 'cooking_gas_cylinder', w: 0.36, d: 0.36, h: 0.48 }

function energyOf(context: ResultExtensionContext): EnergyConfig | undefined {
  const energy = context.plan.tpl.energy
  return typeof energy === 'function' ? energy(context.options, context.plan.w, context.plan.d) : undefined
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
  engine.registerItem(COOKING_CYLINDER)
  engine.registerResultExtension('contents', (context) => planContents({ items: context.result.items, state: context.result.state, place: context.plan.tpl.place ?? 'house', rngFor: (key) => engine.createRng(context.seed, key), findsFor: (query) => { const answered = engine.findsFor(query); return answered.length ? answered : contentOf({ container: query.container, state: query.state, rng: query.rng, footprint: query.footprint ?? 0.5 }) } }))
  engine.registerResultExtension('outbuildings', (context) => {
    const outbuildings = planOutbuildings({ plan: context.plan, items: context.result.items, catalog: engine.catalog, rngFor: (key) => engine.createRng(context.seed, key) })
    if (context.result.lot) addOutbuildingPaths(context.result.lot, outbuildings, context.result.items)
    return outbuildings
  }, { after: ['contents'] })
  engine.registerResultExtension('utilities', (context) => planUtilities({ plan: context.plan, items: context.result.items, stateItems: context.result.stateItems, tank: context.result.waterTank ?? null, ...(energyOf(context) ? { energy: energyOf(context) } : {}), rngFor: (key) => engine.createRng(context.seed, key) }), { after: ['outbuildings', 'waterTank'] })
}
