import crowdData from './data/crowd.json'

/**
 * The 13 undead types as a crowd pack for `@adatechnology/game-crowd` (`createCrowd({ pack })`): the team game's numbers (`jogo.js` CATS, IDADES,
 * ROUPAS, SEG, CIVIL_COR) and each special move as a trait. The shape is `game-crowd`'s `CrowdPack`; this package does not import it.
 */
export type UndeadCrowdPack = Omit<typeof crowdData, 'sources'>

export const UNDEAD_CROWD_SOURCES: Readonly<Record<string, string>> = crowdData.sources

/** A fresh copy of the pack, so a game can change a type's numbers or drop a type without touching the next call. */
export const undeadCrowdPack = (): UndeadCrowdPack => {
  const { sources: _sources, ...pack } = structuredClone(crowdData)
  return pack
}
