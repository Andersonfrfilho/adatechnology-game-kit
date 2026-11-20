// PROTÓTIPO DESCARTÁVEL (spec 018 T0.2): custo da fronteira para um worker. Não vai para a main.
//
// Ligado só quando o host põe `globalThis.__destructionBoundaryProbe = { now, records }` antes de criar o mundo. `world.explode` mede, antes de
// aplicar a explosão, o que custa levar a casa a um worker: `serialize`, `structuredClone`, tamanho em bytes e a montagem da entrada plana.
// O relógio vem do host (`now`): o pacote não cria relógio próprio.

export type BoundaryTiming = {
  /** First call alone, cold for this operation (ms). */
  readonly first: number
  /** Repetitions inside each sample (the page clock steps by 0.1 ms, so a sample is a batch). */
  readonly repetitions: number
  readonly samples: number
  readonly median: number
  readonly min: number
  readonly max: number
}

export type BoundaryRecord = {
  readonly counts: Record<string, number>
  readonly bytes: Record<string, number>
  readonly timings: Record<string, BoundaryTiming>
}

export type BoundaryHost = {
  readonly now: () => number
  readonly records: BoundaryRecord[]
}

export const BOUNDARY_SAMPLES = 15

export function readBoundaryHost(): BoundaryHost | undefined {
  const host: unknown = (globalThis as { __destructionBoundaryProbe?: unknown }).__destructionBoundaryProbe
  if (typeof host !== 'object' || host === null || !('now' in host) || typeof host.now !== 'function' || !('records' in host) || !Array.isArray(host.records)) return undefined
  return host as BoundaryHost
}

let sink: unknown

/** Times `run` (ms per call): first call alone, then `BOUNDARY_SAMPLES` batches sized to last at least ~3 ms. `prepare` builds the inputs of a batch outside the clock. */
export function benchmark<TInput>(host: BoundaryHost, prepare: (count: number) => TInput[], run: (input: TInput) => unknown, maxRepetitions = 100000): BoundaryTiming {
  const now = host.now
  const [firstInput] = prepare(1)
  const started = now()
  sink = run(firstInput as TInput)
  const first = now() - started
  const batch = (count: number): number => {
    const inputs = prepare(count)
    const begin = now()
    for (let index = 0; index < count; index++) sink = run(inputs[index] as TInput)
    return now() - begin
  }
  let repetitions = 1
  let spent = batch(repetitions)
  while (spent < 3 && repetitions < maxRepetitions) {
    repetitions *= 4
    spent = batch(repetitions)
  }
  const perCall: number[] = []
  for (let sample = 0; sample < BOUNDARY_SAMPLES; sample++) perCall.push(batch(repetitions) / repetitions)
  perCall.sort((a, b) => a - b)
  return { first, repetitions, samples: BOUNDARY_SAMPLES, median: perCall[BOUNDARY_SAMPLES >> 1] as number, min: perCall[0] as number, max: perCall[BOUNDARY_SAMPLES - 1] as number }
}

export const noInput = (count: number): undefined[] => new Array<undefined>(count).fill(undefined)

/** Reads the last result, so the engine cannot drop the timed work as dead code. */
export const lastResult = (): unknown => sink
