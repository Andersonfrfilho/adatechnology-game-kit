import { runTest } from './run'
import type { RunOptions } from './run'
import { createProvingTests } from './tests'
import type { ProvingTestRegistry } from './tests'
import type { ProvingCertificate, ProvingResult, ProvingSubject } from './types'

/** A person's verdict on a visual check (or on a room test run by hand), with the print that shows it. */
export interface SignOff {
  vehicle: string
  test: string
  ok: boolean
  by?: string
  evidence?: string
  note?: string
}

export interface CertifyOptions extends RunOptions {
  tests?: ProvingTestRegistry
  /** Visual and room checks already signed off. */
  signOffs?: readonly SignOff[]
  /** Results reported by rooms of later phases (terrain, crash test), by test id. */
  reports?: readonly ProvingResult[]
}

/** approved when every result passed, rejected when any failed, pending otherwise. */
export const statusOf = (results: readonly ProvingResult[]): ProvingCertificate['status'] =>
  results.some((r) => r.verdict === 'fail') ? 'rejected' : results.every((r) => r.verdict === 'pass') ? 'approved' : 'pending'

/** Runs every measured test of the subject's domain, takes the sign-offs and the room reports, and gives the certificate. */
export function certify(subject: ProvingSubject, options: CertifyOptions = {}): ProvingCertificate {
  const tests = options.tests ?? createProvingTests()
  const results: ProvingResult[] = tests.forDomain(subject.domain).map((test): ProvingResult => {
    const signed = options.signOffs?.find((s) => s.vehicle === subject.id && s.test === test.id)
    const reported = options.reports?.find((r) => r.test === test.id)
    if (reported) return reported
    if (test.kind === 'measured' && test.procedure && subject.domain === 'land') return runTest(test, subject, options)
    if (signed)
      return {
        test: test.id,
        kind: test.kind,
        unit: test.unit,
        range: {},
        value: null,
        verdict: signed.ok ? 'pass' : 'fail',
        ...(signed.by ? { signedBy: signed.by } : {}),
        ...(signed.evidence ? { evidence: signed.evidence } : {}),
        ...(signed.note ? { note: signed.note } : {}),
      }
    const note = test.kind === 'visual' ? 'awaiting sign-off in the test room' : test.kind === 'room' ? 'room not built yet' : 'no runner for this domain yet'
    return { test: test.id, kind: test.kind, unit: test.unit, range: {}, value: null, verdict: 'pending', note }
  })
  return { vehicle: subject.id, domain: subject.domain, category: subject.category, status: statusOf(results), results }
}

/** Replaces (or adds) one result of a certificate and recomputes its status. */
export function withResult(certificate: ProvingCertificate, result: ProvingResult): ProvingCertificate {
  const results = certificate.results.some((r) => r.test === result.test) ? certificate.results.map((r) => (r.test === result.test ? result : r)) : [...certificate.results, result]
  return { ...certificate, results, status: statusOf(results) }
}

export interface GateOptions {
  /** Lets pending vehicles in too (a game in development). Rejected vehicles never get in unless listed in `allow`. */
  allowPending?: boolean
  /** Ids a game lets in whatever their certificate says. */
  allow?: readonly string[]
  /** Ids a game keeps out whatever their certificate says. */
  deny?: readonly string[]
}

/** The ids, of `ids`, that a game lets in: approved ones (and pending ones with `allowPending`), with the game's own allow and deny lists. An id without a certificate counts as pending. */
export function gateVehicles(ids: readonly string[], certificates: readonly ProvingCertificate[], options: GateOptions = {}): string[] {
  const byId = new Map(certificates.map((c) => [c.vehicle, c]))
  return ids.filter((id) => {
    if (options.deny?.includes(id)) return false
    if (options.allow?.includes(id)) return true
    const status = byId.get(id)?.status ?? 'pending'
    return status === 'approved' || (status === 'pending' && !!options.allowPending)
  })
}
