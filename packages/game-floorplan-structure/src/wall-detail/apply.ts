import { touches } from '../geometry'
import type { Rect, StructurePart, Support } from '../types'
import type { WallSplit } from './panels'

export interface PartsAndSupports {
  parts: StructurePart[]
  supports: Support[]
}

/** Replaces each part that has a split by its pieces, and re-points what rested on it or what it rested on (the pieces touching the part resting on it get the load). */
export function applySplits(input: PartsAndSupports, splits: ReadonlyMap<string, WallSplit>): PartsAndSupports {
  if (!splits.size) return input
  const boxes = new Map<string, Rect>(input.parts.map((part) => [part.id, part.aabb]))
  const pieceBox = new Map<string, Rect>()
  for (const split of splits.values()) for (const piece of split.pieces) pieceBox.set(piece.id, piece.aabb)
  const parts = input.parts.flatMap((part) => splits.get(part.id)?.pieces ?? [part])
  const supports: Support[] = []
  for (const support of input.supports) {
    const own = splits.get(support.part)
    const host = splits.get(support.on)
    const resting = boxes.get(support.part)
    const targets = host ? host.top.filter((id) => resting && touches(pieceBox.get(id)!, resting, 0.05)) : [support.on]
    const carriers = host ? (targets.length ? targets : host.top) : targets
    for (const part of own ? own.base : [support.part]) for (const on of carriers) supports.push({ ...support, part, on })
  }
  for (const split of splits.values()) supports.push(...split.internal)
  return { parts, supports }
}
