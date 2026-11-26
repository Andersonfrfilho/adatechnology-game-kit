import type * as THREE_NS from 'three'

import type { HouseLoosePiece } from '../adapter-shapes.js'
import { stageVisible } from './apply-level.js'
import type { ApplyConstructionLevelOptions } from './apply-level.js'

/**
 * The construction stage of each destruction part of a house, read from its drawing (a mesh's own `constructionStage` or the nearest group's above it): what
 * splits off the house as a loose piece of the destruction renderer (the gas cylinder standing free in its shelter, a part come off) leaves the house's groups,
 * and with them the stage that hid it.
 */
export function partStagesOf(house: THREE_NS.Object3D): Map<string, string> {
  const stages = new Map<string, string>()
  const walk = (o: THREE_NS.Object3D, inherited: string | undefined): void => {
    const own = typeof o.userData?.constructionStage === 'string' ? (o.userData.constructionStage as string) : inherited
    const part = o.userData?.destructionPart
    if (own && typeof part === 'string' && !stages.has(part)) stages.set(part, own)
    // a merged mesh is many parts (the stretches of the roof's timber): each where it sits in it
    const ranges: unknown = o.userData?.ranges
    if (own && Array.isArray(ranges)) for (const range of ranges as ReadonlyArray<{ readonly id: string }>) if (!stages.has(range.id)) stages.set(range.id, own)
    for (const c of o.children) walk(c, own)
  }
  walk(house, undefined)
  return stages
}

/** The stage of a loose piece: the stage of the first of its parts the house knows. */
function stageOfPiece(piece: HouseLoosePiece, stages: ReadonlyMap<string, string>): string | undefined {
  let found: string | undefined
  piece.root.traverse((o) => {
    if (found) return
    const part = o.userData?.destructionPart
    if (typeof part === 'string') found = stages.get(part)
  })
  return found
}

/**
 * Shows the loose pieces of the house at the level as their stage says, as `applyConstructionLevel` does its groups: a cylinder of the rough-in is neither drawn
 * nor in the simulation over the bare lot (held, it neither falls nor collides: nothing invisible collides). `held` lists the pieces this hid, so that showing them
 * again gives back only what it took. Returns how many pieces it hid.
 */
export function stageLoosePieces(pieces: readonly HouseLoosePiece[], stages: ReadonlyMap<string, string>, level: number, opts: ApplyConstructionLevelOptions, held: Set<HouseLoosePiece>): number {
  let hidden = 0
  for (const piece of pieces) {
    const stage = stageOfPiece(piece, stages)
    if (!stage) continue
    const shown = stageVisible(stage, level, opts)
    piece.root.visible = shown
    if (!shown) {
      hidden++
      if (!piece.held) {
        piece.held = true
        held.add(piece)
      }
    } else if (held.has(piece)) {
      piece.held = false
      held.delete(piece)
    }
  }
  return hidden
}
