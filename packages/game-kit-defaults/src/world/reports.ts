/**
 * What the world tells about itself (a thing landed, sank, caught fire; the player picked something up): data, never text on a screen. The host
 * decides where it goes, a log in the test room, a HUD in a game (spec 011, `design-host.md` §6).
 */
export type WorldReport = {
  readonly type: string
  /** The sentence the host wrote for it, when it wrote one; a game that shows its own text ignores it. */
  readonly text?: string
  readonly objectId?: string
  readonly itemId?: string
  readonly part?: string
  readonly material?: string
  readonly data?: Readonly<Record<string, unknown>>
}

export type ReportListener<TReport> = (report: TReport) => void

/** The port the world's reports leave by: one emitter, any number of listeners. */
export type ReportPort<TReport = WorldReport> = {
  emit(report: TReport): void
  /** Every report from now on; returns the way to stop listening. */
  on(listener: ReportListener<TReport>): () => void
}

export function createReportPort<TReport = WorldReport>(): ReportPort<TReport> {
  const listeners = new Set<ReportListener<TReport>>()
  return {
    emit(report) {
      for (const listener of [...listeners]) listener(report)
    },
    on(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
