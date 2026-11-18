import { WORKER_KIND_DEFAULTS, WORKER_KIND_ID } from '@adatechnology/game-contracts'
import type { TaskKind } from '@adatechnology/game-contracts'

import { generate } from './generate'
import { transferablesOf } from './merge'
import type { GenerateOptions, ShapeBuffers, ShapeSchema } from './types'

/** One shape to generate: the schema and its options without `generators` (functions do not cross threads). */
export interface ShapeGenerateJob {
  readonly schema: ShapeSchema
  readonly options?: Omit<GenerateOptions, 'generators'>
}

const WARMUP: ShapeGenerateJob = { schema: { version: 1, root: { kind: 'box', size: [1, 1, 1] } } }

/**
 * `generate` as a task kind of the worker coordinator (`shapes.generate`, lane `build`, CLAUDE.md §14): the schema in, the buffers per
 * material out with their normals made in the same kernel, every array transferred back. Pure and deterministic, so a job the coordinator
 * runs on the main thread gives the same bytes. `createShapePool({ workers })` hands its jobs to it; a game's worker file lists it in
 * `installWorkerHost` (the kit's worker does, `KIT_WORKER_KINDS`). Custom generators registered globally in the worker apply there too.
 */
export const shapesGenerateKind: TaskKind<ShapeGenerateJob, ShapeBuffers> = Object.freeze({
  id: WORKER_KIND_ID.SHAPES_GENERATE,
  kind: 'task' as const,
  ...WORKER_KIND_DEFAULTS[WORKER_KIND_ID.SHAPES_GENERATE],
  run: (job: ShapeGenerateJob): ShapeBuffers => generate(job.schema, job.options ?? {}),
  transferOutput: (buffers: ShapeBuffers): ArrayBuffer[] => transferablesOf(buffers),
  warmup: WARMUP,
})
