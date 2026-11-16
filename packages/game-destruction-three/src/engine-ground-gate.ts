import type { Vec3 } from '@adatechnology/game-destruction'
import type { WorkBudget } from '@adatechnology/game-physics'

/** The unit costs of the engine's own work under a `WorkBudget` (`WorkUnitCosts`): a tile proved level, a tile read, a body made. */
export interface GroundWorkCosts {
  readonly perTile: number
  readonly perTileRead: number
  readonly perBody: number
}

/**
 * The frame budget the engine's ground and bodies draw from (`RendererOptions.workBudget`). `openFrame` begins the budget's frame unless this frame's work already did: with a
 * physics loop the engine prepares its step before the renderer's `update`, and both draw from the one frame.
 */
export interface GroundWork {
  readonly budget: WorkBudget
  readonly costs: GroundWorkCosts
  /** Where the player is: of two pieces that waited as long, the nearer gets its ground first. Read once a frame. */
  readonly focus?: () => Vec3
  readonly openFrame: () => void
}

/** What one awake piece needs before it may move this frame: the tiles under and around it not laid yet or whose ground changed (`EnginePieces.groundOf`), in scan order. */
export interface GroundNeed {
  /** A stable id (the piece's object id): the tie-break, and the key of its wait. */
  readonly id: string
  /** From the focus (0 without one). */
  readonly distance: number
  readonly tiles: readonly number[]
  /** False for a piece that may not be held still (one held in a hand): its tiles are laid whatever the budget. */
  readonly canWait: boolean
}

export interface GroundTurn {
  /** The tiles to lay this frame. */
  readonly laid: ReadonlySet<number>
  /** The pieces that wait for their ground, held still where they are (`EnginePieces.hold`). */
  readonly waiting: ReadonlySet<string>
}

/** The frames each waiting piece has waited, by id, sorted: plain data. */
export type GroundGateState = ReadonlyArray<readonly [string, number]>

/**
 * The ground as a precondition of moving, under a frame budget (spec 008, `design/orcamento-da-explosao.md` §5 G and §7 F3/F4): each frame the awake pieces whose ground is not
 * laid get it in a fixed order (the one that has waited longest first, it lost its support first; then the nearest the focus; then by id), each piece's tiles all at once while
 * their units fit, at least one piece a frame, and every piece by its `maxWaitFrames`-th frame whatever the budget. A piece whose ground is not laid waits held still, drawn and
 * solid where it was, never falling through ground that is not there. Only the waits are state: what a piece needs is read again from the pieces and the tiles each frame, so a
 * load that drops the waits only starts their count again, and loses no piece.
 */
export class GroundGate {
  private waits = new Map<string, number>()

  constructor(private readonly work: GroundWork) {}

  /** This frame's turn: which tiles are laid (their units taken from the budget's `ground`) and which pieces wait. `unitsOf` is a tile's cost. */
  decide(needs: readonly GroundNeed[], unitsOf: (key: number) => number): GroundTurn {
    const budget = this.work.budget
    const order = needs.filter((need) => need.tiles.length > 0).sort((a, b) => this.waited(b) - this.waited(a) || a.distance - b.distance || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const laid = new Set<number>()
    const waiting = new Set<string>()
    const forced = (need: GroundNeed): boolean => !need.canWait || this.waited(need) + 1 >= budget.maxWaitFrames
    let released = 0
    for (const need of order) {
      if (!forced(need)) continue
      budget.take('ground', this.unitsOfNeed(need, laid, unitsOf))
      this.lay(need, laid)
      released++
    }
    for (const need of order) {
      if (forced(need)) continue
      const units = this.unitsOfNeed(need, laid, unitsOf)
      if (!budget.tryTake('ground', units)) {
        if (released > 0) {
          waiting.add(need.id)
          continue
        }
        budget.take('ground', units)
      }
      this.lay(need, laid)
      released++
    }
    this.countWaits(waiting)
    return { laid, waiting }
  }

  private waited(need: GroundNeed): number {
    return this.waits.get(need.id) ?? 0
  }

  /** The units of the tiles of `need` not already laid this frame, each counted once. */
  private unitsOfNeed(need: GroundNeed, laid: ReadonlySet<number>, unitsOf: (key: number) => number): number {
    let units = 0
    const seen = new Set<number>()
    for (const key of need.tiles) {
      if (laid.has(key) || seen.has(key)) continue
      seen.add(key)
      units += unitsOf(key)
    }
    return units
  }

  private lay(need: GroundNeed, laid: Set<number>): void {
    for (const key of need.tiles) laid.add(key)
  }

  /** The waiting pieces count one frame more; every other piece is forgotten (CLAUDE.md §8: what left, or got its ground, leaves no entry). */
  private countWaits(waiting: ReadonlySet<string>): void {
    const next = new Map<string, number>()
    for (const id of [...waiting].sort()) next.set(id, (this.waits.get(id) ?? 0) + 1)
    this.waits = next
  }

  /** How many pieces wait now. */
  get size(): number {
    return this.waits.size
  }

  clear(): void {
    this.waits.clear()
  }

  saveState(): GroundGateState {
    return [...this.waits.entries()].map(([id, frames]) => [id, frames] as const)
  }

  restoreState(state: GroundGateState): void {
    this.waits = new Map(state.map(([id, frames]) => [id, frames]))
  }
}
