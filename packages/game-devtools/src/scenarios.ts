import type { Scenario, ScenarioResult } from './types'

export interface ScenarioRunner<S extends Scenario = Scenario> {
  /** Registers the scenarios, how to apply one and how to check it. */
  set(list: S[], apply: (scenario: S) => void, check: (scenario: S) => ScenarioResult): void
  readonly list: S[]
  readonly active: S | null
  /** Applies a scenario and makes it the active one; false if the id is unknown. */
  run(id: string): boolean
  /** Checks the scenario with that id, or the active one when the id is unknown; `{}` when there is none. */
  check(id?: string): ScenarioResult
}

/** Pure scenario bookkeeping (no DOM): `{ id, ... }` scenarios, `apply(s)` and `check(s) -> { criterion: { ok, note } }`. */
export function createScenarioRunner<S extends Scenario = Scenario>(): ScenarioRunner<S> {
  let list: S[] = []
  let applyFn: (s: S) => void = () => {}
  let checkFn: (s: S) => ScenarioResult = () => ({})
  let active: S | null = null
  return {
    set(l, a, c) {
      list = l
      applyFn = a
      checkFn = c
    },
    get list() {
      return list
    },
    get active() {
      return active
    },
    run(id) {
      const s = list.find((c) => c.id === id)
      if (!s) return false
      applyFn(s)
      active = s
      return true
    },
    check(id) {
      const s = list.find((c) => c.id === id) || active
      return s ? checkFn(s) : {}
    },
  }
}
