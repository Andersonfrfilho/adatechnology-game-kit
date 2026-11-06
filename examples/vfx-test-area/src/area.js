// The effects area: the bench module of @adatechnology/game-vfx-three with scenarios that play the catalogue the room lends it.
import { buildScenarios } from './scenarios.js'

const isEn = (/** @type {string} */ locale) => locale === 'en'

/** @typedef {import('@adatechnology/game-contracts').EffectSink} EffectSink */
/** @typedef {typeof import('@adatechnology/game-vfx-three/testing').createVfxTestModule} CreateVfxTestModule */

/**
 * Wraps the module (`createVfxTestModule`) with the scenarios; they walk the catalogue the room's effects play.
 * @param {{ createVfxTestModule: CreateVfxTestModule; recipeIds: string[] } & NonNullable<Parameters<CreateVfxTestModule>[0]>} options
 */
export function createVfxArea({ createVfxTestModule, recipeIds, locale = 'pt-BR', ...options }) {
  const module = createVfxTestModule({ ...options, locale })
  /** @type {EffectSink | undefined} */
  let sink
  return {
    ...module,
    scenarios: (/** @type {string} */ loc) => buildScenarios(isEn(loc) ? 'en' : 'pt-BR', () => sink, () => splitCatalog(sink, recipeIds)),
    /** @param {import('@adatechnology/game-contracts').ModuleHost} host */
    attach(host) {
      sink = host.effects
      const detach = module.attach?.(host)
      return () => {
        detach?.()
        sink = undefined
      }
    },
    area: () => ({ placements: [], view: { eye: /** @type {[number, number, number]} */ ([8.4, 6.3, 11.2]), target: /** @type {[number, number, number]} */ ([0, 1.2, 0]) } }),
  }
}

// the sink's catalogue is the explosions and the recipes; `recipeIds` tells them apart (an id both have is played as the explosion)
/**
 * @param {EffectSink | undefined} sink
 * @param {string[]} recipeIds
 */
function splitCatalog(sink, recipeIds) {
  const recipes = new Set(recipeIds)
  const all = sink?.catalog?.() ?? []
  return { explosions: all.filter((id) => !recipes.has(id)), recipes: all.filter((id) => recipes.has(id)) }
}
