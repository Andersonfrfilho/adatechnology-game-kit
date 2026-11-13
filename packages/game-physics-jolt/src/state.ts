import type { JoltWorld } from './world'

/**
 * Exact state of every body (positions, velocities, sleep, contact cache), for save/load and determinism checks: Jolt's own bytes, then the adapter's (each
 * body's friction state, and who touches whom: what `updateFriction` and `touching` read), then the length of Jolt's part.
 */
export const saveState = (w: JoltWorld): Uint8Array => {
  const J = w.J
  const chunks: Uint8Array[] = []
  const rec = new J.StateRecorderJS()
  rec.WriteBytes = (data: number, size: number) => {
    chunks.push(J.HEAPU8.slice(data, data + size))
  }
  rec.ReadBytes = () => undefined
  rec.IsEOF = () => false
  rec.IsFailed = () => false
  w.system.SaveState(rec)
  J.destroy(rec)
  const own: number[] = []
  const sliding = [...w.bodies.values()].filter((e) => e.sliding).map((e) => e.key)
  own.push(sliding.length, ...sliding)
  own.push(w.partners.size)
  for (const [key, mine] of w.partners) {
    own.push(key, mine.size)
    for (const [other, count] of mine) own.push(other, count)
  }
  const joltBytes = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(joltBytes + own.length * 4 + 4)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  const view = new DataView(out.buffer)
  for (const x of own) {
    view.setUint32(at, x, true)
    at += 4
  }
  view.setUint32(at, joltBytes, true)
  return out
}

/** Jolt's part of a saved state put back; false when it does not fit. */
const restoreJolt = (w: JoltWorld, data: Uint8Array, joltBytes: number): boolean => {
  const J = w.J
  let at = 0
  let failed = false
  const rec = new J.StateRecorderJS()
  rec.ReadBytes = (out: number, size: number) => {
    if (at + size > joltBytes) {
      failed = true
      return
    }
    J.HEAPU8.set(data.subarray(at, at + size), out)
    at += size
  }
  rec.WriteBytes = () => undefined
  rec.IsEOF = () => at >= joltBytes
  rec.IsFailed = () => failed
  const ok = w.system.RestoreState(rec)
  J.destroy(rec)
  return ok && !failed
}

export const restoreState = (w: JoltWorld, data: Uint8Array): boolean => {
  if (data.length < 4) return false
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const joltBytes = view.getUint32(data.length - 4, true)
  if (joltBytes > data.length - 4) return false
  if (!restoreJolt(w, data, joltBytes)) return false
  let p = joltBytes
  const next = (): number => {
    const x = view.getUint32(p, true)
    p += 4
    return x
  }
  const sliding = new Set<number>()
  for (let n = next(); n > 0; n--) sliding.add(next())
  for (const e of w.bodies.values()) {
    const was = e.sliding
    e.sliding = sliding.has(e.key)
    if (was !== e.sliding) w.bi.SetFriction(e.id, e.sliding ? e.material.frictionDynamic : e.material.frictionStatic)
  }
  w.partners.clear()
  w.touches.clear()
  for (let n = next(); n > 0; n--) {
    const key = next()
    const mine = new Map<number, number>()
    let total = 0
    for (let k = next(); k > 0; k--) {
      const other = next()
      const count = next()
      mine.set(other, count)
      total += count
    }
    w.partners.set(key, mine)
    w.touches.set(key, total)
  }
  return true
}
