import { snapshotScene } from './sceneHash'
import type { DescribeSceneOptions, SceneNodeLike } from './sceneHash'
import type { GoldenEvent, GoldenRecord } from './types'

export type CreateGoldenRecordParams = {
  readonly name: string
  readonly seed: number
  readonly events?: readonly GoldenEvent[]
  readonly scenes?: { readonly [label: string]: SceneNodeLike }
  readonly hashOptions?: DescribeSceneOptions
}

/** Runs in the page (recorder) and in vitest (SDK build) alike: the same function produces both sides of a comparison. */
export function createGoldenRecord(params: CreateGoldenRecordParams): GoldenRecord {
  const scenes = Object.fromEntries(
    Object.entries(params.scenes ?? {}).map(([label, root]) => [label, snapshotScene(root, params.hashOptions)]),
  )
  return { schema: 1, name: params.name, seed: params.seed, events: params.events ?? [], scenes }
}
