import type { PieceBody } from './internal'

/**
 * The rules of the kit that move a piece by themselves (not a shot, a blast or a contact of the engine): each write they make in a piece's velocity goes through
 * `KitEnergyLedger.begin`/`end` with its name, so what each one gave is measured and counted (spec 021).
 */
export const KIT_RULE = {
  /** A piece that lost a leg and is balanced on the line between the ones left is started down over it (`renderer.ts`). */
  GO_OVER_IF_BALANCED: 'goOverIfBalanced',
  /** What stood on ground that went (a hole under a foot) is started down over the gap (`renderer.ts`). */
  CHECK_UNDERMINED: 'checkUndermined',
  /** Furniture made a piece balanced on an edge of its feet is started over it (`EDGE_NUDGE`, `renderer.ts`). */
  LOOSEN_IF_FOOTLESS: 'loosenIfFootless',
  /** A piece of the engine balanced on a narrow support is turned about its edge (`engine-pieces.ts`). */
  TOPPLE: 'topple',
} as const
export type KitRule = (typeof KIT_RULE)[keyof typeof KIT_RULE]

const RULES: readonly KitRule[] = Object.values(KIT_RULE)
const GRAVITY = 9.81
/**
 * The resolution of the ruler, as energy height (m): below it a piece is at rest when a rule pushes it (what the rules give from there on is one episode), and a give within it of
 * the fall is no energy made. The 1 mm of spec 008's ruler (`C1_ALLOWANCE`): the push that keeps a lying top balanced gives some thousandths of it.
 */
export const KIT_ENERGY_RESOLUTION = 0.001
const REST_HEIGHT = KIT_ENERGY_RESOLUTION

/** One rule gave a piece more energy in one episode than the piece's own fall would (J). */
export type KitEnergyOver = {
  readonly rule: KitRule
  readonly objectId: string
  /** Kinetic energy the rule gave the piece since it was last at rest (J). */
  readonly given: number
  /** Energy the piece's own weight can release from where it was (J, `fallEnergyOf`): the most a rule that only starts a fall may give. */
  readonly fall: number
}

/** What one rule did, over the life of the ledger. */
export type KitRuleTally = {
  readonly rule: KitRule
  /** Writes it made. */
  readonly pushes: number
  /** Episodes in which it gave more than the piece's own fall. */
  readonly overs: number
  /** Its largest give against the fall of the piece and the ruler's resolution (given / (fall + m g `KIT_ENERGY_RESOLUTION`); 0 before any push; over 1 is energy made). */
  readonly worstShare: number
  /** The episode of that largest share. */
  readonly worst: KitEnergyOver | null
}

type MutableTally = { pushes: number; overs: number; worstShare: number; worst: KitEnergyOver | null }
type Episode = { readonly given: Float64Array; readonly over: Uint8Array; fall: number }

/** Kinetic energy (J) of a piece, with the inertia the kit's own impulse uses: its box, or k m r² about the axis a round piece rolls on. */
export const kineticEnergyOf = (body: PieceBody): number => {
  const [vx, vy, vz] = body.velocity
  const [wx, wy, wz] = body.angularVelocity
  const { x, y, z, w } = body.root.quaternion
  // the spin in the piece's own frame: R^T w, R the rotation of the quaternion
  const lx = (1 - 2 * (y * y + z * z)) * wx + 2 * (x * y + z * w) * wy + 2 * (x * z - y * w) * wz
  const ly = 2 * (x * y - z * w) * wx + (1 - 2 * (x * x + z * z)) * wy + 2 * (y * z + x * w) * wz
  const lz = 2 * (x * z + y * w) * wx + 2 * (y * z - x * w) * wy + (1 - 2 * (x * x + y * y)) * wz
  const [hx, hy, hz] = body.halfExtents
  const m = body.mass
  let ix = (m * (hy * hy + hz * hz)) / 3
  let iy = (m * (hx * hx + hz * hz)) / 3
  let iz = (m * (hx * hx + hy * hy)) / 3
  const round = body.round
  if (round) {
    const about = round.inertia * m * round.radius * round.radius
    if (round.kind === 'sphere') ix = iy = iz = about
    else if (round.axis === 0) ix = about
    else if (round.axis === 1) iy = about
    else iz = about
  }
  return 0.5 * m * (vx * vx + vy * vy + vz * vz) + 0.5 * (ix * lx * lx + iy * ly * ly + iz * lz * lz)
}

/**
 * Energy (J) a piece's own weight can release on the support of its lowest corner: m g (how high its centre of mass is over that corner - the lowest it can lie there). Its
 * box, turned as it is, with the weight where its parts put it (`massCentre`): lying on a face its centre of mass is that face's half less its offset toward it, and no pose on
 * a flat support has it lower than the least of those (a table can end on its top).
 */
export const fallEnergyOf = (body: PieceBody): number => {
  const { x, y, z, w } = body.root.quaternion
  const [hx, hy, hz] = body.halfExtents
  const [cx, cy, cz] = body.massCentre ?? [0, 0, 0]
  // the y row of its rotation: how far down each axis of the box reaches, and how high its centre of mass is over the middle of the box
  const rx = 2 * (x * y + z * w)
  const ry = 1 - 2 * (x * x + z * z)
  const rz = 2 * (y * z - x * w)
  const over = hx * Math.abs(rx) + hy * Math.abs(ry) + hz * Math.abs(rz) + rx * cx + ry * cy + rz * cz
  const lowest = Math.min(hx - Math.abs(cx), hy - Math.abs(cy), hz - Math.abs(cz))
  return body.mass * GRAVITY * Math.max(0, over - lowest)
}

/**
 * The energy ruler of the kit's own rules. A rule calls `begin` right before it writes a piece's velocity and `end` right after, with its name: the change of the piece's
 * kinetic energy in between is what the rule gave (the write is instant: gravity and contacts do nothing in it). What one rule gives a piece from rest on is summed as an
 * episode and held against the piece's fall (`fallEnergyOf`) at the start of it: a rule that only starts a fall gives less than the fall, never more. Nothing is cut: a give
 * over it is counted (`tally`) and told (`onOver`), once per rule and episode.
 */
export class KitEnergyLedger {
  private before = 0
  private readonly tallies = new Map<KitRule, MutableTally>(RULES.map((rule) => [rule, { pushes: 0, overs: 0, worstShare: 0, worst: null }]))
  private readonly episodes = new WeakMap<PieceBody, Episode>()

  constructor(private readonly onOver?: (over: KitEnergyOver) => void) {}

  begin(body: PieceBody): void {
    this.before = kineticEnergyOf(body)
    if (this.before > body.mass * GRAVITY * REST_HEIGHT) return
    const episode = this.episodes.get(body)
    if (!episode) {
      this.episodes.set(body, { given: new Float64Array(RULES.length), over: new Uint8Array(RULES.length), fall: fallEnergyOf(body) })
      return
    }
    episode.given.fill(0)
    episode.over.fill(0)
    episode.fall = fallEnergyOf(body)
  }

  end(rule: KitRule, body: PieceBody): void {
    const tally = this.tallies.get(rule) as MutableTally
    tally.pushes++
    const episode = this.episodes.get(body)
    // a rule that wrote in a piece already moving before any rule started it: its episode starts with the fall the piece has left
    const open = episode ?? { given: new Float64Array(RULES.length), over: new Uint8Array(RULES.length), fall: fallEnergyOf(body) }
    if (!episode) this.episodes.set(body, open)
    const index = RULES.indexOf(rule)
    const given = (open.given[index] as number) + kineticEnergyOf(body) - this.before
    open.given[index] = given
    const share = given <= 0 ? 0 : given / (open.fall + body.mass * GRAVITY * KIT_ENERGY_RESOLUTION)
    if (share > tally.worstShare) {
      tally.worstShare = share
      tally.worst = { rule, objectId: body.objectId, given, fall: open.fall }
    }
    if (share <= 1 || open.over[index]) return
    open.over[index] = 1
    tally.overs++
    this.onOver?.({ rule, objectId: body.objectId, given, fall: open.fall })
  }

  tally(): KitRuleTally[] {
    return RULES.map((rule) => ({ rule, ...(this.tallies.get(rule) as MutableTally) }))
  }
}
