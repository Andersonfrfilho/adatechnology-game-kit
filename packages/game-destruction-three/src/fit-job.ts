import { fitOrientedBoxes } from '@adatechnology/game-shapes'
import type { OrientedBox } from '@adatechnology/game-shapes'

/**
 * One fit posted to the fit worker (`FitWorkerPort`): the points of a part drawn by a range of a merged mesh, in the frame its object stands in (x y z triples), and the triangles
 * joining them (vertex numbers of the points, three each). Typed arrays so they cross by transfer; the numbers are the very ones the main thread would fit (float64 points,
 * whole vertex numbers), so the boxes are the same bits.
 */
export interface FitJob {
  readonly id: number
  readonly points: Float64Array
  readonly triangles: Uint32Array
}

/** The answer: the boxes (or why there are none), with the job's own arrays handed back for the main thread's pool. */
export type FitResult =
  | { readonly id: number; readonly ok: true; readonly boxes: OrientedBox[]; readonly points: Float64Array; readonly triangles: Uint32Array }
  | { readonly id: number; readonly ok: false; readonly error: string; readonly points: Float64Array; readonly triangles: Uint32Array }

/** `fitOrientedBoxes` of the job, read as the plain number lists the main thread fits (`Array.from` copies the numbers exactly). */
export const computeFit = (job: FitJob): FitResult => {
  try {
    const boxes = fitOrientedBoxes(Array.from(job.points), Array.from(job.triangles))
    return { id: job.id, ok: true, boxes, points: job.points, triangles: job.triangles }
  } catch (error) {
    return { id: job.id, ok: false, error: error instanceof Error ? error.message : String(error), points: job.points, triangles: job.triangles }
  }
}

/** The buffers a job or its answer carries, to transfer. */
export const fitTransferOf = (carrier: { readonly points: Float64Array; readonly triangles: Uint32Array }): ArrayBuffer[] => [carrier.points.buffer as ArrayBuffer, carrier.triangles.buffer as ArrayBuffer]
