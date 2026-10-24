import { valueOf } from './decisions'
import type { IteContainer } from './extract-ite'
import type { GameContainerRule } from './extract-game'
import { categoryIdOf } from './item-ids'
import type { Sources } from './sources'

export type ContainerRecord = {
  id: string
  teamName?: string
  gameKey?: string
  places: string[]
  /** Words of the team's "Lugares" column that are not place tags ("rua", "casa rica (classe D)"). */
  otherPlaces?: string[]
  /** Stacks the container holds: the game's `CONT_TAB` range where it has one (the engine ports its draw), else the team's. */
  count: [number, number]
  teamCount?: [number, number]
  categories?: Record<string, number>
  /** `CONT_TAB` entries without categories draw by place: this is its fallback. */
  categoriesByPlace?: Record<string, Record<string, number>>
  teamCategories?: string
  rule?: string
}

const RANGE = /^(\d+)–(\d+)$/

const readRange = (text: string, name: string): [number, number] => {
  const match = RANGE.exec(text)
  if (!match) throw new Error(`items-catalog: cannot read the stack range "${text}" of "${name}"`)
  return [Number(match[1]), Number(match[2])]
}

const weightsOf = (rule: GameContainerRule, sources: Sources): Record<string, number> | undefined =>
  rule.cats === null ? undefined : Object.fromEntries(Object.entries(rule.cats).map(([code, weight]) => [categoryIdOf(code, sources), weight]))

/** Where `rollItems` goes when a container has no categories: the pharmacy sells medicine, any other place food and drink (jogo.js L68799). */
const placeFallback = (sources: Sources): Record<string, Record<string, number>> => ({
  [valueOf(sources.decisions.placeMap, 'farm', 'place').id]: { [categoryIdOf('med', sources)]: 1 },
  '*': { [categoryIdOf('com', sources)]: 0.6, [categoryIdOf('beb', sources)]: 0.4 },
})

const splitPlaces = (text: string, sources: Sources): { places: string[]; otherPlaces: string[] } => {
  const places: string[] = []
  const otherPlaces: string[] = []
  for (const token of text.split(', ')) {
    const decision = sources.decisions.placeMap[token]
    if (decision) places.push(decision.value.id)
    else otherPlaces.push(token)
  }
  return { places, otherPlaces }
}

const teamRecord = (container: IteContainer, gameKey: string | undefined, sources: Sources): ContainerRecord => {
  const id = valueOf(sources.decisions.containerIds, container.nome, 'container')
  const teamCount = readRange(container.itens, container.nome)
  const gameRule = gameKey ? sources.game.containers[gameKey] : undefined
  const { places, otherPlaces } = splitPlaces(container.onde, sources)
  const weights = gameRule ? weightsOf(gameRule, sources) : undefined
  return {
    id,
    teamName: container.nome,
    ...(gameKey ? { gameKey } : {}),
    places,
    ...(otherPlaces.length > 0 ? { otherPlaces } : {}),
    count: gameRule ? [...gameRule.n] : teamCount,
    teamCount,
    ...(weights ? { categories: weights } : {}),
    ...(gameRule && !weights ? { categoriesByPlace: placeFallback(sources) } : {}),
    teamCategories: container.categorias,
    ...(container.regra ? { rule: container.regra } : {}),
  }
}

export const buildContainers = (sources: Sources): ContainerRecord[] => {
  const gameKeyOf = new Map(Object.entries(sources.decisions.gameContainers).map(([key, decision]) => [decision.value, key]))
  const records = sources.ite.conteineres.map((container) => teamRecord(container, gameKeyOf.get(valueOf(sources.decisions.containerIds, container.nome, 'container')), sources))
  const known = new Set(records.map((record) => record.id))
  const gameOnly = [...gameKeyOf].filter(([id]) => !known.has(id)).map(([id, key]) => {
    const rule = sources.game.containers[key]
    if (!rule) throw new Error(`items-catalog: CONT_TAB has no "${key}"`)
    const weights = weightsOf(rule, sources)
    return { id, gameKey: key, places: [], count: [...rule.n] as [number, number], ...(weights ? { categories: weights } : {}) }
  })
  return [...records, ...gameOnly]
}
