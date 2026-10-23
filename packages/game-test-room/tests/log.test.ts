import { describe, expect, it, vi } from 'vitest'
import { createLog } from '../src/log'

const sample = () => {
  const log = createLog()
  let now = 0
  log.setClock(() => now)
  return { log, at: (t: number) => (now = t) }
}

describe('log entries', () => {
  it('numbers entries and stamps the clock', () => {
    const { log, at } = sample()
    at(1.23456)
    const a = log.add({ channel: 'action', type: 'spawn', text: 'Spawned a chair' })
    at(2)
    const b = log.add({ channel: 'event', type: 'dent', text: 'dent', objectId: 'chair_1', material: 'wood_soft', state: { hp: 3 } })
    expect([a.seq, b.seq]).toEqual([0, 1])
    expect(a.t).toBe(1.235)
    expect(log.entries()).toHaveLength(2)
  })

  it('filters by channel, type and object', () => {
    const { log } = sample()
    log.add({ channel: 'action', type: 'spawn', text: 'a', objectId: 'x' })
    log.add({ channel: 'event', type: 'hole', text: 'b', objectId: 'x' })
    log.add({ channel: 'event', type: 'hole', text: 'c', objectId: 'y' })
    expect(log.entries({ channel: 'event' })).toHaveLength(2)
    expect(log.entries({ type: 'hole', objectId: 'y' }).map((e) => e.text)).toEqual(['c'])
    expect(log.entries({ type: 'nothing' })).toEqual([])
  })

  it('clears', () => {
    const { log } = sample()
    log.add({ channel: 'action', type: 'spawn', text: 'a' })
    log.clear()
    expect(log.entries()).toEqual([])
    expect(log.toNDJSON()).toBe('')
  })

  it('reads through the before-read hook, so pending work is flushed first', () => {
    const { log } = sample()
    const hook = vi.fn(() => {
      log.add({ channel: 'event', type: 'late', text: 'flushed' })
    })
    log.setBeforeRead(null)
    log.setBeforeRead(() => {
      log.setBeforeRead(null)
      hook()
    })
    expect(log.entries().map((e) => e.text)).toEqual(['flushed'])
  })
})

describe('log exports', () => {
  it('JSON is an array that parses back', () => {
    const { log } = sample()
    log.add({ channel: 'event', type: 'hole', text: 'Door › panel (softwood): 9 mm hole', part: 'panel', data: { through: true } })
    const parsed = JSON.parse(log.toJSON())
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed[0]).toMatchObject({ seq: 0, channel: 'event', type: 'hole', part: 'panel', data: { through: true } })
  })

  it('NDJSON has one parseable object per line and keeps pt-BR text intact', () => {
    const { log } = sample()
    log.add({ channel: 'event', type: 'fracture', text: 'Vidro da janela (vidro): estilhaçou em 14 cacos' })
    log.add({ channel: 'check', type: 'pass', text: '✓ ok' })
    const lines = log.toNDJSON().trimEnd().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).text).toBe('Vidro da janela (vidro): estilhaçou em 14 cacos')
    expect(JSON.parse(lines[1]).channel).toBe('check')
  })

  it('TXT has the clock, the channel and the text', () => {
    const { log, at } = sample()
    at(65.5)
    log.add({ channel: 'action', type: 'shoot', text: 'Pistol: shot' })
    expect(log.toText()).toBe('[01:05.50] action Pistol: shot')
  })

  it('download does nothing without a browser Blob URL (headless)', () => {
    const { log } = sample()
    log.add({ channel: 'action', type: 'x', text: 'y' })
    const original = URL.createObjectURL
    // @ts-expect-error simulate an environment without object URLs
    URL.createObjectURL = undefined
    expect(() => log.download('txt')).not.toThrow()
    URL.createObjectURL = original
  })
})

describe('log summary', () => {
  it('counts per type and material, objects and destroyed', () => {
    const { log } = sample()
    log.add({ channel: 'event', type: 'dent', text: '1', objectId: 'a', material: 'steel' })
    log.add({ channel: 'event', type: 'dent', text: '2', objectId: 'a', material: 'steel' })
    log.add({ channel: 'event', type: 'fracture', text: '3', objectId: 'b', material: 'glass' })
    log.add({ channel: 'event', type: 'destroyed', text: '4', objectId: 'b' })
    expect(log.summary()).toEqual({ byType: { dent: 2, fracture: 1, destroyed: 1 }, byMaterial: { steel: 2, glass: 1 }, objects: 2, destroyed: 1 })
  })
})

describe('coalescing', () => {
  it('updates one line while the sequence goes on, and starts a new one after a pause', () => {
    const { log, at } = sample()
    const seen: Array<[number, boolean]> = []
    log.on((e, updated) => seen.push([e.seq, updated]))
    at(0)
    log.coalesce('melt:a', { channel: 'event', type: 'melt', text: 'melting 10%' }, 1)
    at(0.4)
    log.coalesce('melt:a', { channel: 'event', type: 'melt', text: 'melting 20%' }, 1)
    at(0.9)
    const last = log.coalesce('melt:a', { channel: 'event', type: 'melt', text: 'melting 30%' }, 1)
    expect(log.entries()).toHaveLength(1)
    expect(last.text).toBe('melting 30%')
    expect(last.data).toMatchObject({ updates: 3 })
    at(5)
    log.coalesce('melt:a', { channel: 'event', type: 'melt', text: 'melting 90%' }, 1)
    expect(log.entries().map((e) => e.text)).toEqual(['melting 30%', 'melting 90%'])
    expect(seen).toEqual([
      [0, false],
      [0, true],
      [0, true],
      [1, false],
    ])
  })

  it('keeps different keys apart', () => {
    const { log } = sample()
    log.coalesce('a', { channel: 'event', type: 'drip', text: 'a' })
    log.coalesce('b', { channel: 'event', type: 'drip', text: 'b' })
    expect(log.entries()).toHaveLength(2)
  })
})
