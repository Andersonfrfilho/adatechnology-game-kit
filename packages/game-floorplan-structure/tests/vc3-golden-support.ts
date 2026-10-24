/** Shared by the two VC3 golden files (structure, installations), split so each runs in its own worker and CI can shard them. */
import type { GoldenRecord } from '@adatechnology/golden-tool'

import goldenFile from './fixtures/team-golden/vc3-structure.json'
import detailFile from './fixtures/team-golden/vc3-structure-detail.json'
import itemIdsFile from './fixtures/team-golden/vc3-item-ids.json'
import { engine } from './support'
import { sdkStateOf, sdkTemplateOf, teamConstruction, teamRoof, teamTank, text } from './team-vocabulary'
export { hashOf, hashRows, sdkTemplateOf, teamLists, text } from './team-vocabulary'
import type { TeamStructureLists } from './team-vocabulary'

/** Structure of the plans recorded from the Visor de casas 3D: 17 templates x seeds 1-25 x 3 states, one hash per list. */
export type StructureEvent = {
  readonly template: string
  readonly seed: number
  readonly state: string
  readonly counts: { readonly [list: string]: number }
  readonly hashes: { readonly [list: string]: string }
  readonly utilities: { readonly [name: string]: string }
  readonly rows?: { readonly [name: string]: string[] }
}

export const eventsOf = (file: unknown): StructureEvent[] => (file as GoldenRecord).events.map((event) => event.data as unknown as StructureEvent)
export const allEvents = eventsOf(goldenFile)
export const LISTS = ['pieces', 'supports', 'coarseParts', 'coarseJoints', 'enclosureParts', 'enclosureJoints'] as const
export const SINGLES = ['levels', 'construction', 'roof', 'waterTank'] as const

/** Five seeds at a time, so no test holds the worker for long. */
export const chunksOf = (templates: string[]): [string, number, number][] => templates.flatMap((template) => [1, 6, 11, 16, 21].map((from): [string, number, number] => [template, from, from + 4]))

export function generate(event: StructureEvent) {
  return engine.generate(sdkTemplateOf.get(event.template) as string, { seed: event.seed, state: sdkStateOf.get(event.state), wallDetail: 'coarse' })
}

export function singlesOf(result: any): Record<(typeof SINGLES)[number], unknown> {
  return {
    levels: [result.structure.levels, result.structure.elevation],
    construction: teamConstruction(result.construction),
    roof: teamRoof(result.roof),
    waterTank: teamTank(result.waterTank),
  }
}

export function explain(event: StructureEvent, list: string, lists: TeamStructureLists): string {
  const detail = eventsOf(detailFile).find((x) => x.template === event.template && x.seed === event.seed && x.state === event.state)
  const got = (lists[list as keyof TeamStructureLists] as unknown[]).map(text)
  const want = detail?.rows?.[list] ?? []
  return `${list} (${got.length} vs ${event.counts[list]})\n  only team ${want.filter((line) => !got.includes(line)).slice(0, 3).join('\n            ')}\n  only sdk  ${got.filter((line) => !want.includes(line)).slice(0, 3).join('\n            ')}`
}

/** Items of each recorded plan, as ids in the order of the team's list. */
export const itemIds = new Map(eventsOf(itemIdsFile as unknown).map((event) => [`${event.template}#${event.seed}/${event.state}`, (event as unknown as { ids: string }).ids.split('|')]))
export const INSTALLATIONS = ['gas', 'gasBottles', 'electrical', 'solar', 'plumbing', 'outbuildings', 'outbuildingPaths'] as const
