/** Boxes of the triangles of a geometry, grouped in blocks, so a region query visits the few triangles near it instead of every one. */

export const TRI_BLOCK = 32

export type TriIndex = {
  position: any
  positionVersion: number
  index: any
  indexVersion: number
  triangles: number
  /** min x, y, z and max x, y, z of each triangle (exact: the same values the vertices hold) */
  boxes: Float64Array
  /** the same for each block of `TRI_BLOCK` triangles */
  blocks: Float64Array
  builtBlocks: number
}

const cache = new WeakMap<object, TriIndex>()

function trianglesOf(geo: any): number {
  return Math.floor((geo.index ? geo.index.count : geo.attributes.position.count) / 3)
}
function supports(geo: any): boolean {
  const pos = geo.attributes && geo.attributes.position
  return !!pos && !pos.isInterleavedBufferAttribute && pos.itemSize === 3
}
function isCurrent(geo: any, ti: TriIndex): boolean {
  const pos = geo.attributes.position
  return (
    ti.position === pos &&
    ti.positionVersion === pos.version &&
    ti.index === (geo.index || null) &&
    ti.indexVersion === (geo.index ? geo.index.version : 0) &&
    ti.triangles === trianglesOf(geo)
  )
}
function blockCount(triangles: number): number {
  return Math.ceil(triangles / TRI_BLOCK)
}
function boxBlock(ti: TriIndex, block: number): void {
  const B = ti.boxes
  const t0 = block * TRI_BLOCK
  const t1 = Math.min(ti.triangles, t0 + TRI_BLOCK)
  const o = block * 6
  for (let k = 0; k < 3; k++) {
    ti.blocks[o + k] = Infinity
    ti.blocks[o + 3 + k] = -Infinity
  }
  for (let t = t0; t < t1; t++) {
    const j = t * 6
    for (let k = 0; k < 3; k++) {
      if (B[j + k]! < ti.blocks[o + k]!) ti.blocks[o + k] = B[j + k]!
      if (B[j + 3 + k]! > ti.blocks[o + 3 + k]!) ti.blocks[o + 3 + k] = B[j + 3 + k]!
    }
  }
}
function boxTriangle(geo: any, ti: TriIndex, t: number): void {
  const P = geo.attributes.position.array
  const ix = geo.index ? geo.index.array : null
  const a = (ix ? ix[t * 3] : t * 3) * 3
  const b = (ix ? ix[t * 3 + 1] : t * 3 + 1) * 3
  const c = (ix ? ix[t * 3 + 2] : t * 3 + 2) * 3
  const j = t * 6
  for (let k = 0; k < 3; k++) {
    ti.boxes[j + k] = Math.min(P[a + k], P[b + k], P[c + k])
    ti.boxes[j + 3 + k] = Math.max(P[a + k], P[b + k], P[c + k])
  }
}
function advance(geo: any, ti: TriIndex, deadline: number): boolean {
  const total = blockCount(ti.triangles)
  while (ti.builtBlocks < total) {
    const block = ti.builtBlocks
    const t1 = Math.min(ti.triangles, (block + 1) * TRI_BLOCK)
    for (let t = block * TRI_BLOCK; t < t1; t++) boxTriangle(geo, ti, t)
    boxBlock(ti, block)
    ti.builtBlocks++
    if (deadline !== Infinity && performance.now() >= deadline) break
  }
  return ti.builtBlocks === total
}
function start(geo: any): TriIndex {
  const pos = geo.attributes.position
  const triangles = trianglesOf(geo)
  const ti: TriIndex = {
    position: pos,
    positionVersion: pos.version,
    index: geo.index || null,
    indexVersion: geo.index ? geo.index.version : 0,
    triangles,
    boxes: new Float64Array(triangles * 6),
    blocks: new Float64Array(blockCount(triangles) * 6),
    builtBlocks: 0,
  }
  cache.set(geo, ti)
  return ti
}

/** The index of a geometry (built now if it is not there or the positions changed), or undefined for a layout it does not cover. */
export function triIndexOf(geo: any): TriIndex | undefined {
  if (!supports(geo)) return undefined
  let ti = cache.get(geo)
  if (!ti || !isCurrent(geo, ti)) ti = start(geo)
  advance(geo, ti, Infinity)
  return ti
}

/** Builds the index of a geometry a slice at a time; true once it is complete and current. */
export function warmTriIndex(geo: any, deadline: number): boolean {
  if (!supports(geo)) return true
  let ti = cache.get(geo)
  if (!ti || !isCurrent(geo, ti)) ti = start(geo)
  return advance(geo, ti, deadline)
}

/** Keeps the index of the result of a cut: `boxes` are the boxes of its triangles in order. */
export function storeTriIndex(geo: any, boxes: Float64Array): void {
  const ti = start(geo)
  ti.boxes = boxes
  const total = blockCount(ti.triangles)
  for (let b = 0; b < total; b++) boxBlock(ti, b)
  ti.builtBlocks = total
}

/** Before moving vertices of a non-indexed geometry: its index when it is complete and current (pass it to `touchTriIndex` after). */
export function liveTriIndex(geo: any): TriIndex | undefined {
  if (geo.index || !supports(geo)) return undefined
  const ti = cache.get(geo)
  return ti && isCurrent(geo, ti) && ti.builtBlocks === blockCount(ti.triangles) ? ti : undefined
}

/** After moving `vertices` of a non-indexed geometry and flagging its positions: only their triangles are measured again. */
export function touchTriIndex(geo: any, ti: TriIndex, vertices: number[]): void {
  if (ti.positionVersion + 1 !== geo.attributes.position.version) return
  const blocks = new Set<number>()
  for (const v of vertices) {
    const t = Math.floor(v / 3)
    if (t >= ti.triangles) continue
    boxTriangle(geo, ti, t)
    blocks.add(Math.floor(t / TRI_BLOCK))
  }
  blocks.forEach((b) => boxBlock(ti, b))
  ti.positionVersion = geo.attributes.position.version
}

/** The box of every vertex of a non-indexed geometry from its complete, current index (one pass over the blocks); undefined when it cannot be taken from there. */
export function boundsFromIndex(geo: any): { box: Float64Array; version: number } | undefined {
  if (geo.index || !supports(geo)) return undefined
  const ti = cache.get(geo)
  if (!ti || !isCurrent(geo, ti) || ti.builtBlocks !== blockCount(ti.triangles) || !ti.triangles || geo.attributes.position.count !== ti.triangles * 3) return undefined
  const box = new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity])
  for (let b = 0, n = blockCount(ti.triangles); b < n; b++)
    for (let k = 0; k < 3; k++) {
      box[k] = Math.min(box[k]!, ti.blocks[b * 6 + k]!)
      box[3 + k] = Math.max(box[3 + k]!, ti.blocks[b * 6 + 3 + k]!)
    }
  return { box, version: ti.positionVersion }
}
