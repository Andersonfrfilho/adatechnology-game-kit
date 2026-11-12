import { existsSync, readFileSync, writeFileSync } from 'node:fs'

/** How many z-fighting face pairs each catalog case had when the guard was turned on. It only shrinks. */
export type ZFightingLedger = Readonly<Record<string, number>>

export interface ZFightingCase {
  readonly id: string
  readonly hits: number
  /** First hits, for the failure message: which meshes fight and where. */
  readonly detail: string
}

export interface CheckZFightingLedgerParams {
  /** JSON file of the ledger, next to the package's other fixtures. */
  readonly file: string
  readonly cases: readonly ZFightingCase[]
  /** Lower the counts that went down and drop the cases that are clean or gone. Never adds a case nor raises a count. */
  readonly update?: boolean
}

export interface CheckZFightingLedgerResult {
  /** One line per broken promise: a new piece with z-fighting, a piece that got worse, a ledger that must come down. */
  readonly problems: readonly string[]
}

export function readZFightingLedger(file: string): ZFightingLedger {
  if (!existsSync(file)) return {}
  return JSON.parse(readFileSync(file, 'utf8')) as ZFightingLedger
}

function lowered(ledger: ZFightingLedger, cases: readonly ZFightingCase[]): Record<string, number> {
  const next: Record<string, number> = {}
  for (const c of cases) {
    const allowed = ledger[c.id] ?? 0
    const kept = Math.min(c.hits, allowed)
    if (kept > 0) next[c.id] = kept
  }
  return Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)))
}

function problemOf(c: ZFightingCase, allowed: number | undefined): string | undefined {
  if (allowed === undefined && c.hits > 0) return `${c.id}: new piece with ${c.hits} z-fighting face pairs (a new piece must have none)\n${c.detail}`
  if (allowed !== undefined && c.hits > allowed) return `${c.id}: z-fighting went from ${allowed} to ${c.hits} face pairs\n${c.detail}`
  if (allowed !== undefined && c.hits < allowed) return `${c.id}: now ${c.hits} z-fighting face pairs, the ledger still allows ${allowed}: lower it with UPDATE_ZFIGHT=1`
  return undefined
}

/**
 * The z-fighting guard of a catalog. Pieces that already flickered when the guard came in are written in a ledger that only goes down
 * (like the typing debt of `CLAUDE.md` §10): every other piece, and every piece added later, must have no coincident faces at all.
 */
export function checkZFightingLedger(params: CheckZFightingLedgerParams): CheckZFightingLedgerResult {
  const ledger = readZFightingLedger(params.file)
  if (params.update) {
    writeFileSync(params.file, `${JSON.stringify(lowered(ledger, params.cases), null, 2)}\n`)
    return { problems: params.cases.flatMap((c) => (ledger[c.id] === undefined && c.hits > 0 ? [problemOf(c, undefined)!] : [])) }
  }
  const ids = new Set(params.cases.map((c) => c.id))
  const gone = Object.keys(ledger).filter((id) => !ids.has(id)).map((id) => `${id}: in the ledger but no longer in the catalog: drop it with UPDATE_ZFIGHT=1`)
  const problems = params.cases.map((c) => problemOf(c, ledger[c.id])).filter((p): p is string => p !== undefined)
  return { problems: [...problems, ...gone] }
}
