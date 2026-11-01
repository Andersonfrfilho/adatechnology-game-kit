import type { Crowd } from '../../src'

const PER_AGENT_PAIRS = ['armHp', 'legHp'] as const

/** FNV-1a over the bytes of every per-agent array of the store (the first `n` agents) and over the physics counters. */
export const hashCrowdState = (crowd: Crowd): string => {
  const { store } = crowd
  let hash = 0x811c9dc5
  const feed = (bytes: Uint8Array): void => {
    for (let k = 0; k < bytes.length; k++) hash = Math.imul(hash ^ bytes[k]!, 0x01000193) >>> 0
  }
  for (const key of Object.keys(store).sort()) {
    const value = (store as unknown as Record<string, unknown>)[key]
    if (!ArrayBuffer.isView(value)) continue
    const perAgent = (PER_AGENT_PAIRS as readonly string[]).includes(key) ? 2 : 1
    const typed = value as unknown as Uint8Array & { BYTES_PER_ELEMENT: number }
    feed(new Uint8Array(typed.buffer, typed.byteOffset, store.n * perAgent * typed.BYTES_PER_ELEMENT))
  }
  feed(new TextEncoder().encode(JSON.stringify([store.n, crowd.stats.physics])))
  return hash.toString(16)
}
