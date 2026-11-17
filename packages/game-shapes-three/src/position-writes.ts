import type * as THREE_NS from 'three'

/** How many declared writes a position attribute keeps: a host that missed an older one measures every part of the mesh again. */
const KEPT = 256

/** The vertex ranges each declared write covered, by the attribute's `version` right after it. */
const declared = new WeakMap<object, Map<number, Array<readonly [number, number]>>>()

/**
 * Flags the mesh's positions for upload (`needsUpdate`) and declares that the write changed the vertices `[v0, v1)`: the write and its declaration share one `version`,
 * so call it once per range written instead of setting `needsUpdate` yourself. A drawing that shares a
 * merged mesh with another that measures its ranges (the house collapsing the range of a wall it draws with holes, under the destruction renderer that measures each
 * part's range as a collider) calls it, so only the parts drawn by that range are measured again, not the whole house (`rangesWrittenSince`). A write that sets `needsUpdate` and declares nothing still counts, for every part of the mesh (`CLAUDE.md` §12).
 */
export function markPositionsWritten(mesh: THREE_NS.Mesh, v0: number, v1: number): void {
  const position = mesh.geometry?.getAttribute('position') as THREE_NS.BufferAttribute | undefined
  if (!position) return
  position.needsUpdate = true
  if (v1 <= v0) return
  let log = declared.get(position)
  if (!log) {
    log = new Map()
    declared.set(position, log)
  }
  const ranges = log.get(position.version)
  if (ranges) ranges.push([v0, v1])
  else log.set(position.version, [[v0, v1]])
  if (log.size > KEPT) log.delete(log.keys().next().value as number)
}

/** The ranges written after `version` up to the attribute's version now, or null when one of those writes declared no range (or is forgotten). */
export function rangesWrittenSince(position: THREE_NS.BufferAttribute, version: number): Array<readonly [number, number]> | null {
  const log = declared.get(position)
  const out: Array<readonly [number, number]> = []
  for (let v = version + 1; v <= position.version; v++) {
    const ranges = log?.get(v)
    if (!ranges) return null
    out.push(...ranges)
  }
  return out
}
