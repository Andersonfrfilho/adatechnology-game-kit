import type { Vec3 } from '../types'
import type { Ctx } from '../ctx'
import type { Branch } from '../geometry/branches'

/** Maximum number of separate main branches a tree is split into (more are merged into the last). */
export const MAX_MAIN_BRANCHES = 6

export interface CrownAnchor {
  /** crown piece id that the foliage near `points` goes to */
  crownId: string
  branchId: string
  points: Vec3[]
}

/**
 * Draw the trunk and every branch as separate wood pieces: 'trunk', then 'branch0'..'branch5' (a main branch, i.e. level 1, with all
 * the branches that grow from it). `draw(branch, index)` draws one branch (index -1 is the trunk).
 * Returns the anchors that `splitCrown` uses to hand foliage to the nearest main branch.
 */
export function drawTreeWood(ctx: Ctx, tree: { trunk: Branch; branches: Branch[] }, draw: (br: Branch, index: number) => void): CrownAnchor[] {
  ctx.piece('trunk', 'trunk')
  draw(tree.trunk, -1)
  const top = tree.trunk.pts[tree.trunk.pts.length - 1]
  const anchors: CrownAnchor[] = [{ crownId: 'crown', branchId: 'trunk', points: [top] }]
  let main = -1
  let current: CrownAnchor | undefined
  for (let i = 0; i < tree.branches.length; i++) {
    const br = tree.branches[i]
    if (br.level <= 1) {
      main++
      const k = Math.min(main, MAX_MAIN_BRANCHES - 1)
      const id = `branch${k}`
      ctx.piece(id, 'branch', 'trunk', br.pts[0])
      current = anchors.find((a) => a.branchId === id)
      if (!current) {
        current = { crownId: `crown${k}`, branchId: id, points: [] }
        anchors.push(current)
      }
    }
    if (current) current.points.push(br.pts[br.pts.length - 1])
    draw(br, i)
  }
  ctx.piece('trunk', 'trunk')
  return anchors
}

/**
 * Relabel the foliage / flower triangles tagged 'crown' so each goes to the crown of the nearest main branch (by triangle center
 * to the nearest branch end). Call after the crown geometry was emitted.
 */
export function splitCrown(ctx: Ctx, anchors: CrownAnchor[]): void {
  if (anchors.length <= 1) {
    return
  }
  for (const b of [ctx.foliage, ctx.flowers, ctx.wood]) {
    const nTri = b.idx.length / 3
    for (let t = 0; t < nTri; t++) {
      if (b.triTag[t] !== 'crown') continue
      let cx = 0
      let cy = 0
      let cz = 0
      for (let k = 0; k < 3; k++) {
        const v = b.idx[t * 3 + k] * 3
        cx += b.pos[v]
        cy += b.pos[v + 1]
        cz += b.pos[v + 2]
      }
      cx /= 3
      cy /= 3
      cz /= 3
      let best = anchors[0]
      let bd = Infinity
      for (const a of anchors) {
        for (const p of a.points) {
          const d = (p[0] - cx) ** 2 + (p[1] - cy) ** 2 + (p[2] - cz) ** 2
          if (d < bd) {
            bd = d
            best = a
          }
        }
      }
      b.triTag[t] = best.crownId
      if (!ctx.pieceMeta.has(best.crownId)) ctx.pieceMeta.set(best.crownId, { kind: 'crown', parent: best.branchId })
    }
  }
}
