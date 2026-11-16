import type { JoltWorldHost } from './world-host'

/**
 * Exact state of every body (positions, velocities, sleep, contact cache), for save/load and determinism checks: Jolt's own bytes, then the adapter's (each
 * body's friction state and coefficient, who touches whom: what `updateFriction` and `touching` read; the time not stepped yet, the ignored pairs, the rolling bodies and the step count; every map in key order), then the length of Jolt's part.
 */
export const saveState = (w: JoltWorldHost): Uint8Array => {
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
  const bits = new DataView(new ArrayBuffer(8))
  const pushFloat = (x: number): void => {
    bits.setFloat64(0, x, true)
    own.push(bits.getUint32(0, true), bits.getUint32(4, true))
  }
  const byKey = (x: number, y: number): number => x - y
  const changed = [...w.bodies.values()].filter((e) => e.sliding || e.friction !== e.material.frictionStatic).sort((x, y) => x.key - y.key)
  own.push(changed.length)
  for (const e of changed) {
    own.push(e.key, e.sliding ? 1 : 0)
    pushFloat(e.friction)
  }
  own.push(w.partners.size)
  for (const key of [...w.partners.keys()].sort(byKey)) {
    const mine = w.partners.get(key) ?? new Map<number, number>()
    own.push(key, mine.size)
    for (const other of [...mine.keys()].sort(byKey)) own.push(other, mine.get(other) ?? 0)
  }
  pushFloat(w.accumulator)
  const ignored = [...w.ignored].sort(byKey)
  own.push(ignored.length)
  for (const pair of ignored) own.push(pair)
  own.push(w.rollers.size)
  for (const key of [...w.rollers.keys()].sort(byKey)) {
    const rolling = w.rollers.get(key)
    own.push(key)
    pushFloat(rolling?.coefficient ?? 0)
    pushFloat(rolling?.radius ?? 0)
  }
  pushFloat(w.stepCount)
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
const restoreJolt = (w: JoltWorldHost, data: Uint8Array, joltBytes: number): boolean => {
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

export const restoreState = (w: JoltWorldHost, data: Uint8Array): boolean => {
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
  const bits = new DataView(new ArrayBuffer(8))
  const changed = new Map<number, { sliding: boolean; friction: number }>()
  for (let n = next(); n > 0; n--) {
    const key = next()
    const sliding = next() === 1
    bits.setUint32(0, next(), true)
    bits.setUint32(4, next(), true)
    changed.set(key, { sliding, friction: bits.getFloat64(0, true) })
  }
  for (const e of w.bodies.values()) {
    const saved = changed.get(e.key)
    e.sliding = saved?.sliding ?? false
    const friction = saved?.friction ?? e.material.frictionStatic
    if (friction !== e.friction) w.bi.SetFriction(e.id, friction)
    e.friction = friction
  }
  w.partners.clear()
  for (let n = next(); n > 0; n--) {
    const key = next()
    const mine = new Map<number, number>()
    for (let k = next(); k > 0; k--) {
      const other = next()
      const count = next()
      mine.set(other, count)
    }
    w.partners.set(key, mine)
  }
  const nextFloat = (): number => {
    bits.setUint32(0, next(), true)
    bits.setUint32(4, next(), true)
    return bits.getFloat64(0, true)
  }
  w.accumulator = nextFloat()
  w.clearIgnored()
  for (let n = next(); n > 0; n--) w.addIgnoredKey(next())
  w.rollers.clear()
  for (let n = next(); n > 0; n--) {
    const key = next()
    const coefficient = nextFloat()
    w.rollers.set(key, { coefficient, radius: nextFloat() })
  }
  w.stepCount = nextFloat()
  return true
}
