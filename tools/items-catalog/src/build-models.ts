import { readFileSync } from 'node:fs'

import { SOURCE_PATHS } from './paths'
import type { Sources } from './sources'

export type ModelRecord = {
  /** Catalog id of the item the model draws. */
  id: string
  /** Id in the `MODELS` of the showcase page. */
  teamId: string
  /** Box of the builder's group in the units of the page (what `Box3.setFromObject` measures). */
  teamBox: [number, number, number]
  /** Metres per unit of the page, from one real measure (`decisions.json.dimensions[id].modelScaleRef`). */
  scale: number
}

/** The ids of `MODELS` in the order of the showcase page (`const MODELS = [` up to `const STAGE_TARGET`). */
export const teamModelIds = (): string[] => {
  const source = readFileSync(SOURCE_PATHS.ite, 'utf8')
  const text = source.slice(source.indexOf('const MODELS = ['), source.indexOf('const STAGE_TARGET'))
  return [...text.matchAll(/^\s*\["([a-z0-9_]+)", \(\) =>/gm)].map((match) => match[1] as string)
}

/** `models.json` of `game-items-three`: the 24 models of the showcase in the page's order, with the scale that gives the item its real size, then the models authored in this kit (`decisions.json.kitModels`). */
export const buildModels = (sources: Sources): ModelRecord[] => {
  const byTeamId = new Map<string, ModelRecord>()
  for (const [id, decision] of Object.entries(sources.decisions.dimensions)) {
    const reference = decision.modelScaleRef
    if (!reference) continue
    byTeamId.set(reference.teamId, { id, teamId: reference.teamId, teamBox: [reference.teamBox[0] ?? 0, reference.teamBox[1] ?? 0, reference.teamBox[2] ?? 0], scale: reference.scale })
  }
  const showcase = teamModelIds().map((teamId) => {
    const record = byTeamId.get(teamId)
    if (!record) throw new Error(`items-catalog: the showcase model "${teamId}" has no modelScaleRef in decisions.json`)
    return record
  })
  const kit = Object.entries(sources.decisions.kitModels).map(([id, { value }]): ModelRecord => {
    if (!sources.decisions.dimensions[id]) throw new Error(`items-catalog: the kit model "${id}" is not an item with a measure in decisions.json`)
    return { id, teamId: value.teamId, teamBox: [value.teamBox[0], value.teamBox[1], value.teamBox[2]], scale: value.scale }
  })
  const ids = [...showcase, ...kit].map((record) => record.id)
  const repeated = ids.find((id, index) => ids.indexOf(id) !== index)
  if (repeated) throw new Error(`items-catalog: the model "${repeated}" is in the showcase and in kitModels`)
  return [...showcase, ...kit]
}
