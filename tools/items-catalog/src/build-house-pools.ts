import { valueOf } from './decisions'
import type { Sources } from './sources'

export type HousePoolRecord = {
  /** Viewer pool type (`tipo`): the key of the provenance and of the aliases of decisions.json. */
  type: string
  /** Final item id, or null while the catalog has no item for it. */
  item: string | null
  name: string
  qty: [number, number]
  viewerCategory: string
  /** The viewer lets a person pick the entry up (a plate in a cupboard is scenery). */
  isTakeable: boolean
  weight: number
  /** A fortified house stocks up on these (`COMIDA_SUP`). */
  isSupply: boolean
}

export type HousePoolsRecord = {
  pools: Record<string, HousePoolRecord[]>
  /** Pools the viewer shares with another (`CONTEUDO.guarda_g = CONTEUDO.guarda`). */
  aliasOf: Record<string, string>
}

export const buildHousePools = (sources: Sources, resolve: (reference: string) => string): HousePoolsRecord => {
  const supply = new Set(sources.house.supplyCategories)
  const pools: Record<string, HousePoolRecord[]> = {}
  const aliasOf: Record<string, string> = {}
  const owners = new Map<unknown, string>()
  for (const [key, entries] of Object.entries(sources.house.pools)) {
    const owner = owners.get(entries)
    if (owner) {
      aliasOf[key] = owner
      continue
    }
    owners.set(entries, key)
    pools[key] = entries.map((entry) => {
      const alias = valueOf(sources.decisions.aliases, entry.tipo, 'viewer item type')
      return {
        type: entry.tipo,
        item: alias === null ? null : resolve(alias),
        name: entry.nome_pt,
        qty: [entry.qtd[0], entry.qtd[1]],
        viewerCategory: entry.categoria,
        isTakeable: entry.pegavel,
        weight: entry.peso,
        isSupply: supply.has(entry.categoria),
      }
    })
  }
  return { pools, aliasOf }
}
