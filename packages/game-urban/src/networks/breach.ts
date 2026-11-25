import { coverOf, isFluidContent } from './pipes'
import type { FluidContent, PipeContent, PipePiece } from './pipes'
import type { SurfacePiece } from './surface'

export type PipeBreach = {
  readonly id: string
  readonly kind: PipePiece['kind']
  readonly content: PipeContent
  /** Where along the pipe (0 at its `from` end) the bowl reaches deepest, and the point of the centre line there. */
  readonly share: number
  readonly at: readonly [number, number, number]
  /** The bowl got down to the bore's centre line: the pipe is broken (a duct's cables are cut). */
  readonly severed: boolean
}

/** A bowl taken out of the ground: the shape of a `GroundLoss` (`game-contracts`) or of a terrain blow's result. */
export type Crater = { readonly x: number; readonly z: number; readonly radius: number; readonly depth: number }

/** Metres a pipe is sampled every along its length. */
const SAMPLE_STEP = 0.25

/** How deep the bowl is at a distance from its centre: a paraboloid, the full depth at the middle and nothing at the rim. */
export function bowlDepthAt(crater: Crater, distance: number): number {
  if (distance >= crater.radius) return 0
  return crater.depth * (1 - (distance / crater.radius) ** 2)
}

/** The deepest point of a pipe a crater reaches: its share along the pipe, and whether the bowl got down to the bore's centre line. */
function reachOf(pipe: PipePiece, crater: Crater): PipeBreach | undefined {
  const length = Math.hypot(pipe.to[0] - pipe.from[0], pipe.to[2] - pipe.from[2])
  const steps = Math.max(1, Math.ceil(length / SAMPLE_STEP))
  let best: { share: number; margin: number } | undefined
  for (let step = 0; step <= steps; step++) {
    const share = step / steps
    const x = pipe.from[0] + (pipe.to[0] - pipe.from[0]) * share
    const z = pipe.from[2] + (pipe.to[2] - pipe.from[2]) * share
    const margin = bowlDepthAt(crater, Math.hypot(x - crater.x, z - crater.z)) - coverOf(pipe, share)
    if (margin >= 0 && (best === undefined || margin > best.margin)) best = { share, margin }
  }
  if (best === undefined) return undefined
  const { share } = best
  const lerp = (a: number, b: number): number => a + (b - a) * share
  return { id: pipe.id, kind: pipe.kind, content: pipe.content, share, at: [lerp(pipe.from[0], pipe.to[0]), lerp(pipe.from[1], pipe.to[1]), lerp(pipe.from[2], pipe.to[2])], severed: best.margin >= pipe.diameter / 2 }
}

export type Breach = {
  /** Pipes the bowl reached (`severed`: down to the centre line, so the pipe is broken and leaks). */
  readonly pipes: readonly PipeBreach[]
  /** The covers, grates and boxes inside the bowl: they are thrown off, and the pit under them lies open. */
  readonly surface: readonly string[]
  /** What leaks, once, of the pipes severed (a duct severed cuts its cables and leaks nothing). */
  readonly leaks: readonly FluidContent[]
}

/**
 * What a crater does to the networks under it: the pipes whose top the bowl got down to, and the surface pieces it swallowed. Pure, from
 * the pieces `pipePiecesOf` and `surfacePiecesOf` give, so a host calls it with the result of a terrain blow (`world.ground.on('blow')`)
 * and the same answer comes for the same bowl.
 */
export function breachOf({ pipes, surface }: { readonly pipes: readonly PipePiece[]; readonly surface: readonly SurfacePiece[] }, crater: Crater): Breach {
  const reached = pipes.flatMap((pipe) => reachOf(pipe, crater) ?? [])
  const covers = surface.filter((piece) => Math.hypot(piece.at[0] - crater.x, piece.at[2] - crater.z) <= crater.radius && bowlDepthAt(crater, Math.hypot(piece.at[0] - crater.x, piece.at[2] - crater.z)) > piece.size[1]).map((piece) => piece.id)
  return { pipes: reached, surface: covers, leaks: [...new Set(reached.filter((pipe) => pipe.severed).map((pipe) => pipe.content).filter(isFluidContent))] }
}
