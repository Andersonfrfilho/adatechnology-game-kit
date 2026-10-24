import { FORCES, RANKS } from './data'
import type { ForceId, Rank } from './types'

export type Member = {
  readonly id: string
  readonly force: ForceId
  /** Rank id of the ladder of the force. */
  readonly rank: string
  readonly courage: number
  readonly loyalty: number
  readonly alive?: boolean
}

const ladderIdOf = (force: ForceId): string | undefined => FORCES.find((entry) => entry.id === force)?.ranks

/** The ladder of a force, lowest rank first. */
export const ranksOf = (force: ForceId): readonly Rank[] => {
  const ladderId = ladderIdOf(force)
  return ladderId === undefined ? [] : (RANKS.ladders[ladderId] ?? [])
}

/** Position of a rank in the ladder of a force; -1 when the force or the rank is unknown. */
export const rankOrder = (force: ForceId, rankId: string): number => ranksOf(force).find((rank) => rank.id === rankId)?.order ?? -1

/** Who takes command when the leader falls: the highest rank alive with courage + loyalty at or above the rule's minimum. Ties go to the first listed. */
export const pickCommander = (members: readonly Member[]): Member | undefined => {
  const minimum = RANKS.rule.commander.minimumCourageAndLoyalty
  let commander: Member | undefined
  let commanderOrder = -1
  for (const member of members) {
    if (member.alive === false || member.courage + member.loyalty < minimum) continue
    const order = rankOrder(member.force, member.rank)
    if (order <= commanderOrder) continue
    commander = member
    commanderOrder = order
  }
  return commander
}

export type OrderParams = {
  readonly superior: Pick<Member, 'force' | 'rank'>
  readonly subordinate: Pick<Member, 'force' | 'rank'>
  /** The subordinate's opinion of the superior. */
  readonly opinion: number
}

/**
 * A higher rank beats opinion, unless the subordinate's opinion of the superior is below the rule's limit: then the order is not obeyed (the game picks
 * disobey, desert or mutiny). Ranks of different ladders have no authority over each other.
 */
export const obeysOrder = ({ superior, subordinate, opinion }: OrderParams): boolean => {
  if (ladderIdOf(superior.force) !== ladderIdOf(subordinate.force)) return false
  if (rankOrder(superior.force, superior.rank) <= rankOrder(subordinate.force, subordinate.rank)) return false
  return opinion >= RANKS.rule.disobeyBelowOpinion
}
