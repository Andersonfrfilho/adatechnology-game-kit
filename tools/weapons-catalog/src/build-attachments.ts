import type { Decision, Decisions } from './decisions'
import type { ArsenalAccessoryRow } from './extract-arsenal'

export type AttachmentRecord = Readonly<Record<string, unknown>> & { readonly id: string }

const hasUrl = (text: string): boolean => /https?:\/\//.test(text)

const problemsOf = (id: string, decision: Decision<unknown>, rows: readonly ArsenalAccessoryRow[], arsenalName: string | undefined, sources: readonly string[]): string[] => {
  const problems: string[] = []
  if (sources.length === 0) problems.push(`attachment "${id}" has no sources`)
  if (decision.reason.trim() === '') problems.push(`attachment "${id}" has no reason`)
  if ((decision.source === 'reference' || sources.includes('reference')) && !hasUrl(decision.reason)) problems.push(`attachment "${id}" is a reference but its reason has no URL`)
  if (arsenalName !== undefined && !rows.some((row) => row.name === arsenalName)) problems.push(`attachment "${id}" names the Arsenal line "${arsenalName}", which is not in §11`)
  if (arsenalName !== undefined && !sources.includes('arsenal')) problems.push(`attachment "${id}" implements an Arsenal line but does not list the arsenal as a source`)
  if (arsenalName === undefined && sources.includes('arsenal')) problems.push(`attachment "${id}" lists the arsenal as a source but names no §11 line`)
  return problems
}

const effectProblems = (id: string, effects: readonly { readonly from?: string }[], row: ArsenalAccessoryRow | undefined): string[] =>
  effects.flatMap((effect) => (effect.from !== undefined && !(row?.effect.includes(effect.from) ?? false) ? [`attachment "${id}" cites "${effect.from}", which is not in the Arsenal line "${row?.name ?? '?'}"`] : []))

/** The lines of §11 that no accessory and no listed feature implements. */
const unclaimedRows = (rows: readonly ArsenalAccessoryRow[], decisions: Decisions): string[] => {
  const claimed = new Set([...Object.values(decisions.attachments).map((decision) => decision.value.arsenal), ...Object.keys(decisions.arsenalFeatures.value)])
  return rows.filter((row) => !claimed.has(row.name)).map((row) => `Arsenal §11 line "${row.name}" is implemented by no accessory and no feature`)
}

/** The accessories of the catalogue: the numbers of `decisions.attachments`, each checked against the §11 line it comes from. */
export const buildAttachments = (rows: readonly ArsenalAccessoryRow[], decisions: Decisions): AttachmentRecord[] => {
  const problems = unclaimedRows(rows, decisions)
  const records = Object.entries(decisions.attachments).map(([id, decision]) => {
    const { arsenal, effects, ...rest } = decision.value
    problems.push(...problemsOf(id, decision, rows, arsenal, decision.value.sources), ...effectProblems(id, effects, rows.find((row) => row.name === arsenal)))
    return { id, ...rest, effects: effects.map(({ from: _from, ...effect }) => effect) }
  })
  if (problems.length > 0) throw new Error(`weapons-catalog: attachments are not consistent:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`)
  return records
}
