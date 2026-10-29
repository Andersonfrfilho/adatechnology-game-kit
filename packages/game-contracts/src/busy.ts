/**
 * What the host lends a module so that a slow job never looks like a frozen page: the host shows its own indicator (a spinner, a bar, a line of text) while the job runs. Nothing here is
 * specific to a kind of module; a host with no indicator leaves `ModuleHost.loading` out and the module just does the work.
 */
export interface BusyTask {
  /** Updates the text and, when the task has a `total`, how many steps are done (the bar). Both optional. */
  step(text?: string, done?: number): void
  /** Resolves after the browser painted what the task shows: await it between the steps of a long job so the indicator moves. */
  paint(): Promise<void>
  /** Takes the indicator down (the last open task of the host hides it). Safe to call twice. */
  end(): void
}

export interface BusyOptions {
  /** How many steps the job has: the indicator draws a bar. Without it, only a spinner. */
  readonly total?: number
  /** The indicator hides what is behind it (the first load of a page) instead of dimming it. */
  readonly opaque?: boolean
}

export interface BusySink {
  /** Shows the indicator at once and returns the task to update and end. The work that follows only paints it if the caller awaits `task.paint()` first. */
  begin(label: string, options?: BusyOptions): BusyTask
  /**
   * Shows the indicator, waits for it to be painted, runs `work` (synchronous work too) and takes the indicator down when it finishes or throws. Resolves with the result of `work`. The way to
   * run a heavy synchronous job: the page shows what is going on instead of freezing.
   */
  busy<T>(label: string, work: (task: BusyTask) => T | Promise<T>, options?: BusyOptions): Promise<T>
}
