import type { DeadTreeSpec } from '../types'
import type { ArchResult, Ctx } from '../ctx'
import { rgb, shade, mix } from '../color'
import { growTree } from '../geometry/branches'
import { drawBranch } from '../geometry/wood'

/** Bare, twisted tree with broken stubs. Also used for the `dead` condition of broadleaf trees. */
export function generateDeadTree(spec: DeadTreeSpec, ctx: Ctx, fromTree = false): ArchResult {
  const height = spec.height ?? 5
  const trunkRadius = spec.trunkRadius ?? 0.2
  const crownRadius = spec.crownRadius ?? height * 0.38
  const base = fromTree ? mix(rgb(spec.barkColor ?? 0x6b4b34), [0.42, 0.39, 0.34], 0.7) : rgb(spec.barkColor ?? 0x6c6458)
  const bark = shade(base, 0.95)
  const tree = growTree(ctx.rng, {
    height,
    trunkRadius,
    crownRadius,
    shape: 'spreading',
    levels: spec.branchLevels ?? 3,
    trunkFraction: 0.33,
    gnarl: 1.1,
    primary: 5,
    lean: 0.1,
    bare: true,
  })
  drawBranch(ctx.wood, tree.trunk, bark, ctx.lod, 1)
  for (let i = 0; i < tree.branches.length; i++) drawBranch(ctx.wood, tree.branches[i], bark, ctx.lod, i * 0.5)
  return { collider: { kind: 'cylinder', radius: trunkRadius * 1.1, height: height * 0.5 }, bendable: false }
}
