// The effects area: the bench module of @adatechnology/game-vfx-three with scenarios that play the catalogue the room lends it.
import { buildScenarios } from './scenarios.js'

const isEn = (locale) => locale === 'en'

/** Wraps the module (`createVfxTestModule`) with the scenarios; they walk the catalogue the room's effects play. */
export function createVfxArea({ createVfxTestModule, recipeIds, locale = 'pt-BR', ...options }) {
  const module = createVfxTestModule({ ...options, locale })
  let sink
  return {
    ...module,
    scenarios: (loc) => buildScenarios(isEn(loc) ? 'en' : 'pt-BR', () => sink, () => splitCatalog(sink, recipeIds)),
    attach(host) {
      sink = host.effects
      const detach = module.attach?.(host)
      return () => {
        detach?.()
        sink = undefined
      }
    },
    area: () => ({ placements: [], view: { eye: [8.4, 6.3, 11.2], target: [0, 1.2, 0] } }),
  }
}

// the sink's catalogue is the explosions and the recipes; `recipeIds` tells them apart (an id both have is played as the explosion)
function splitCatalog(sink, recipeIds) {
  const recipes = new Set(recipeIds)
  const all = sink?.catalog?.() ?? []
  return { explosions: all.filter((id) => !recipes.has(id)), recipes: all.filter((id) => recipes.has(id)) }
}
