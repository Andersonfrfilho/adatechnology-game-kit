import { valueOf } from './decisions'
import type { IteItem } from './extract-ite'
import type { Sources } from './sources'

export type IdSource = 'household' | 'merge' | 'decision'

/** The team's items that stay in the SDK; the story items only the game has are `scope: 'game'` in decisions.json. */
export const sdkIteItems = ({ ite, decisions }: Sources): IteItem[] => ite.itens.filter((item) => !decisions.scope[item.id])

export const gameIteItems = ({ ite, decisions }: Sources): IteItem[] => ite.itens.filter((item) => decisions.scope[item.id])

/** Final id of a team item and where the id comes from. */
export const finalIdOf = (item: IteItem, { decisions }: Sources): { id: string; idSource: IdSource } => {
  const merged = decisions.merge[item.id]
  if (merged) return { id: merged.value, idSource: 'merge' }
  return { id: valueOf(decisions.ids, item.id, 'team item id'), idSource: 'decision' }
}

export type IdIndex = {
  readonly iteToFinal: ReadonlyMap<string, string>
  readonly finalIds: ReadonlySet<string>
}

export const buildIdIndex = (sources: Sources): IdIndex => {
  const iteToFinal = new Map(sdkIteItems(sources).map((item) => [item.id, finalIdOf(item, sources).id]))
  const finalIds = new Set(iteToFinal.values())
  for (const id of Object.keys(sources.household)) finalIds.add(id)
  for (const id of Object.keys(sources.decisions.extraItems)) finalIds.add(id)
  return { iteToFinal, finalIds }
}

/** An id of the team, of the household or already final, as the final item id; `isKnown` is false when the catalog has no such item yet. */
export const resolveReference = (reference: string, index: IdIndex): { id: string; isKnown: boolean } => {
  const id = index.iteToFinal.get(reference) ?? reference
  return { id, isKnown: index.finalIds.has(id) }
}

export const placeIdOf = (code: string, { decisions }: Sources): string => valueOf(decisions.placeMap, code, 'place').id

/** Category id of a team code (the 14) or of one the game adds (`mun`, `arma`, `arr`). */
export const categoryIdOf = (code: string, { decisions }: Sources): string => (decisions.categoryMap[code] ?? decisions.gameCategoryMap[code] ?? valueOf(decisions.categoryMap, code, 'category')).value.id
