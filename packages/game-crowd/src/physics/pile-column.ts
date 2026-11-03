import type { CrowdStore } from '../store'
import { STATE } from '../types'

/** What a falling pile step marks on the steps that come down with it, so the landing knows it was a collapse and not a jump. */
export const COLLAPSE_MARK = -7

export type PileColumn = { readonly cell: number; readonly dir: number }

/**
 * The steps of the pile behind a step that went, in its column (`cell - dir`, `cell - 2 dir`, ...), come down with it: they let go of the pile and fall from where they are. The column stops
 * at the first cell with no step in it.
 */
export function collapsePileColumns(store: CrowdStore, columns: PileColumn[], cellCount: number, release: (i: number) => void): void {
  const owners = new Map<number, number>()
  for (let i = 0; i < store.n; i++) if (store.state[i] === STATE.PILE_STEP && store.stepCell[i]! >= 0) owners.set(store.stepCell[i]!, i)
  for (const column of columns.splice(0)) {
    if (column.dir === 0) continue
    for (let k = 1, cell = column.cell - column.dir; cell >= 0 && cell < cellCount; k++, cell = column.cell - column.dir * k) {
      const j = owners.get(cell)
      if (j === undefined) break
      owners.delete(cell)
      release(j)
      store.state[j] = STATE.AIRBORNE
      store.vy[j] = 0
      store.stateTimer[j] = COLLAPSE_MARK
    }
  }
}
