export interface CostOptions {
  /** Reads of `state()` and of `describe()` to time. Default 10 000. */
  reads?: number
  /** Ceiling, in milliseconds, for all the reads of one method. Default 50 (5 microseconds per read). */
  ceilingMs?: number
  /** Ceiling of heap growth, in bytes, over all the reads of one method (only where `process.memoryUsage` exists). Default 1 MiB. */
  allocationBytes?: number
}

const DEFAULT_COST_READS = 10_000
const DEFAULT_COST_CEILING_MS = 50
const DEFAULT_COST_ALLOCATION_BYTES = 1024 * 1024

const heapUsedBytes = (): number | undefined => {
  const nodeProcess = (globalThis as { process?: { memoryUsage?: () => { heapUsed: number } } }).process
  return nodeProcess?.memoryUsage?.().heapUsed
}

type CheckReadCostParams = { readonly name: string; readonly read: () => unknown; readonly options: CostOptions; readonly problems: string[] }

export const checkReadCost = ({ name, read, options, problems }: CheckReadCostParams): void => {
  const reads = options.reads ?? DEFAULT_COST_READS
  const ceilingMs = options.ceilingMs ?? DEFAULT_COST_CEILING_MS
  const allocationBytes = options.allocationBytes ?? DEFAULT_COST_ALLOCATION_BYTES
  if (read() !== read()) problems.push(`${name}() returns a new object on each read: cache it between changes (cost contract)`)
  const heapBefore = heapUsedBytes()
  const started = performance.now()
  for (let i = 0; i < reads; i++) read()
  const elapsedMs = performance.now() - started
  const heapAfter = heapUsedBytes()
  if (elapsedMs > ceilingMs) problems.push(`${name}() took ${elapsedMs.toFixed(1)} ms for ${reads} reads, over the ${ceilingMs} ms ceiling (cost contract)`)
  if (heapBefore !== undefined && heapAfter !== undefined && heapAfter - heapBefore > allocationBytes)
    problems.push(`${name}() grew the heap by ${heapAfter - heapBefore} bytes over ${reads} reads, over the ${allocationBytes} byte ceiling (cost contract)`)
}
