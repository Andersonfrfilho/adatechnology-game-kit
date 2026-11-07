/**
 * Whether a ground beam or a slab on grade spans the voids a ground loss opened under it. Pure: the world measures the footprint and the section and
 * hands the numbers in. Resistances are characteristic (no partial factors): the world compares them with its loads times `structure.safetyFactor`.
 */

/** A stretch of a beam's footprint with no ground under it, in metres from the beam's start. */
export interface VoidRun {
  readonly start: number
  readonly end: number
}

export interface BeamCheck {
  /** Metres of the beam's footprint. */
  readonly length: number
  /** Beam depth (m). */
  readonly depth: number
  /** Load per metre the beam carries (N/m, its own weight and what rests on it). */
  readonly load: number
  /** Moment the section holds (N m, characteristic: the steel's once cracked) and the moment it cracks at. */
  readonly resists: number
  readonly cracking: number
  /** Longest span over depth it bridges (a cantilever half of it). */
  readonly spanDepth: number
  /** Factor of safety of the soil under it: a stretch of ground takes extra reactions up to `(safety - 1)` times its own load. */
  readonly soilSafety: number
  /** Metres from the start where a pillar still on its own footing holds the beam (cast with it). */
  readonly pillars: readonly number[]
  /** The beam's moment is multiplied by this before it is compared (the world's `structure.safetyFactor`). */
  readonly loadFactor: number
  /** The beam goes on past its start / its end as another ground beam still on the ground (one casting): that end is held. */
  readonly continuous?: readonly [boolean, boolean]
}

export interface RunVerdict extends VoidRun {
  readonly kind: 'span' | 'cantilever'
  /** Metres between supports (a span) or of overhang (a cantilever). */
  readonly span: number
  /** N m at the worst section. */
  readonly moment: number
  readonly holds: boolean
  readonly cracks: boolean
}

export interface BeamVerdict {
  readonly runs: readonly RunVerdict[]
  /** A cantilever that does not hold, or whose weight stands past what is left under it: the beam tips into the hole. */
  readonly tips: boolean
}

/** The runs of `true` in `flags` (one per `step` metres), in metres. */
export function voidRuns(flags: readonly boolean[], step: number): VoidRun[] {
  const runs: VoidRun[] = []
  let start = -1
  for (let i = 0; i <= flags.length; i++) {
    if (i < flags.length && flags[i]) {
      if (start < 0) start = i
      continue
    }
    if (start >= 0) runs.push({ start: start * step, end: i * step })
    start = -1
  }
  return runs
}

/** A pillar within this many metres of a run's edge holds that edge. */
const PILLAR_REACH = 0.15

const pillarNear = (pillars: readonly number[], at: number): boolean => pillars.some((p) => Math.abs(p - at) <= PILLAR_REACH)

/** Runs split where a pillar stands inside them: the pillar is a support between two spans. */
function splitAtPillars(runs: readonly VoidRun[], pillars: readonly number[]): VoidRun[] {
  const out: VoidRun[] = []
  for (const run of runs) {
    const inside = pillars.filter((p) => p > run.start + PILLAR_REACH && p < run.end - PILLAR_REACH).sort((a, b) => a - b)
    let from = run.start
    for (const p of inside) {
      out.push({ start: from, end: p })
      from = p
    }
    out.push({ start: from, end: run.end })
  }
  return out
}

/**
 * Joins the runs that the ground between them cannot keep apart: a stretch of ground narrower than the beam's depth, or one that cannot take the
 * reactions of the spans beside it (each gives `w L / 2`; a stretch of `s` metres takes `(safety - 1) w s` on top of its own share, NBR 6122).
 */
export function mergeRuns(runs: readonly VoidRun[], check: BeamCheck): VoidRun[] {
  let list = [...runs]
  for (let changed = true; changed; ) {
    changed = false
    for (let k = 0; k <= list.length && !changed; k++) {
      const before = list[k - 1]
      const after = list[k]
      const from = before ? before.end : 0
      const to = after ? after.start : check.length
      const soil = to - from
      if (soil <= 0 || (!before && !after)) continue
      // a pillar on the stretch carries what comes to it
      if (check.pillars.some((p) => p >= from - PILLAR_REACH && p <= to + PILLAR_REACH)) continue
      // nor does ground at an end of the beam where it goes on as another ground beam
      if ((!before && check.continuous?.[0]) || (!after && check.continuous?.[1])) continue
      const reaction = (before ? (before.end - before.start) / 2 : 0) + (after ? (after.end - after.start) / 2 : 0)
      const narrow = soil < check.depth
      const weak = reaction > (check.soilSafety - 1) * soil
      if (!narrow && !weak) continue
      // the stretch goes with the runs beside it; at the end of the beam the run reaches the end
      const merged: VoidRun = { start: before ? before.start : 0, end: after ? after.end : check.length }
      list = [...list.slice(0, Math.max(0, k - 1)), merged, ...list.slice(after ? k + 1 : k)]
      changed = true
    }
  }
  return list
}

/**
 * Each void under a ground beam, judged: between supports (ground or a pillar on each side) a simply supported span, `w L² / 8`, holding while `L` is
 * at most `spanDepth` depths and the moment is within what the section resists; reaching an end with no pillar there, a cantilever, `w c² / 2`, at most
 * half that span, and only while the ground left under the beam is at least as long as the overhang (the resultant of a uniform load stays over its
 * support) or a pillar holds its root. A cantilever that fails breaks off at its root when the beam is balanced or held there, and tips the whole beam
 * in when it is not. A void that takes the whole beam leaves nothing to hold.
 */
export function judgeBeam(flags: readonly boolean[], step: number, check: BeamCheck): BeamVerdict {
  const merged = mergeRuns(voidRuns(flags, step), check)
  const runs = splitAtPillars(merged, check.pillars)
  const voided = merged.reduce((sum, run) => sum + run.end - run.start, 0)
  const ground = check.length - voided
  const verdicts: RunVerdict[] = []
  let tips = false
  for (const run of runs) {
    const span = run.end - run.start
    const freeStart = run.start <= 1e-9 && !pillarNear(check.pillars, 0) && !check.continuous?.[0]
    const freeEnd = run.end >= check.length - 1e-9 && !pillarNear(check.pillars, check.length) && !check.continuous?.[1]
    if (freeStart && freeEnd) {
      verdicts.push({ ...run, kind: 'cantilever', span, moment: Infinity, holds: false, cracks: true })
      tips = true
      continue
    }
    const cantilever = freeStart || freeEnd
    const moment = (cantilever ? (check.load * span * span) / 2 : (check.load * span * span) / 8) * check.loadFactor
    const reach = cantilever ? (check.spanDepth * check.depth) / 2 : check.spanDepth * check.depth
    // an overhang whose weight stands past the ground left, with no pillar at its root, takes the beam over with it
    const balanced = !cantilever || span <= ground
    const rooted = cantilever && pillarNear(check.pillars, freeStart ? run.end : run.start)
    // the far end cast on into a beam still on the ground holds the rest down
    const held = cantilever && !!check.continuous?.[freeStart ? 1 : 0]
    const holds = span <= reach && moment <= check.resists && (balanced || rooted)
    verdicts.push({ ...run, kind: cantilever ? 'cantilever' : 'span', span, moment, holds, cracks: moment > check.cracking })
    // one that is balanced or held at its root breaks off there instead: the overhang goes, the beam stays
    if (cantilever && !holds && !balanced && !rooted && !held) tips = true
  }
  return { runs: verdicts, tips }
}

export interface PlateCheck {
  /** Metres across the void (its widest). */
  readonly across: number
  /** Load per square metre of the slab (N/m²). */
  readonly load: number
  /** Moment a metre-wide strip resists and cracks at (N m per metre, characteristic). */
  readonly resists: number
  readonly cracking: number
  /** Effective depth (m) and the punching shear the concrete takes (Pa). */
  readonly effectiveDepth: number
  readonly punching: number
  /** What stands on the slab over the void: its weight (N) and the side of its footprint (m). */
  readonly points: ReadonlyArray<{ readonly weight: number; readonly side: number }>
  readonly loadFactor: number
}

/**
 * A slab on grade over a hole: continuous with the slab around it, a strip across the hole carries `q a² / 8` and each weight standing over it `P a / 4`
 * (on a metre of strip, on the safe side), against what the strip resists; each weight must not punch through, `P / (u d)` within the concrete's
 * punching shear on the perimeter `u = 4 (c + d)` (NBR 6118 19.5).
 */
export function judgePlate(check: PlateCheck): { holds: boolean; cracks: boolean; moment: number; punched: boolean } {
  const a = check.across
  const moment = (check.load * a * a / 8 + check.points.reduce((sum, p) => sum + (p.weight * a) / 4, 0)) * check.loadFactor
  const d = Math.max(0.01, check.effectiveDepth)
  const punched = check.points.some((p) => (p.weight * check.loadFactor) / (4 * (p.side + d) * d) > check.punching)
  return { holds: moment <= check.resists && !punched, cracks: moment > check.cracking, moment, punched }
}
