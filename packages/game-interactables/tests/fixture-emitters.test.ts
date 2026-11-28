import { describe, expect, it } from 'vitest'
import { FLUSH_RUN_SECONDS, createFixtureEmitters } from '../src'
import type { ObjectSpec } from '../src'

const sink: Pick<ObjectSpec, 'emitters' | 'fixtures'> = {
  fixtures: [{ id: 'tap', kind: 'tap', outlet: [0, 1, 0], part: 'tap_handle', tank: 'auto' }, { id: 'drain', kind: 'utility_sink', outlet: [0, 0.5, 0] }],
  emitters: [
    { id: 'tap_water', kind: 'water', pos: [0, 1, 0], source: 'tap', size: 0.02, reach: 0.3 },
    { id: 'drain_water', kind: 'water', pos: [0, 0.5, 0], source: 'drain' },
    { id: 'steam', kind: 'steam', pos: [0, 1, 0], source: 'tap' },
  ],
}
const toilet: Pick<ObjectSpec, 'emitters' | 'fixtures'> = {
  fixtures: [{ id: 'flush', kind: 'flush', outlet: [0, 0.36, 0], volume: 6, part: 'flush_button', tank: 'auto' }],
  emitters: [{ id: 'flush_water', kind: 'water', pos: [0, 0.38, 0], source: 'flush', size: 0.08, reach: 0.07 }],
}

describe('createFixtureEmitters: the water a piece runs while its handle is worked', () => {
  it('a tap runs as far as its handle is turned, and only the water emitters a handle drives', () => {
    const fx = createFixtureEmitters(sink)
    expect(fx.runs).toBe(true)
    expect(fx.update(1 / 60, () => 0)).toEqual([])
    const half = fx.update(1 / 60, (part) => (part === 'tap_handle' ? 0.5 : 0))
    expect(half.map((r) => [r.emitter.id, r.intensity])).toEqual([['tap_water', 0.5]])
    expect(fx.update(1 / 60, () => 1)[0]?.intensity).toBe(1)
    expect(fx.update(1 / 60, () => 0)).toEqual([])
  })

  it('a flush runs for its seconds once the button goes down, then stops though the button stays down; pressed again it runs again', () => {
    const fx = createFixtureEmitters(toilet)
    expect(fx.update(0.1, () => 0)).toEqual([])
    let ran = 0
    for (let t = 0; t < FLUSH_RUN_SECONDS + 1; t += 0.1) if (fx.update(0.1, () => 1).length > 0) ran += 0.1
    expect(ran).toBeGreaterThan(FLUSH_RUN_SECONDS - 0.15)
    expect(ran).toBeLessThan(FLUSH_RUN_SECONDS + 0.15)
    // the button back up, and down again
    expect(fx.update(0.1, () => 0)).toEqual([])
    expect(fx.update(0.1, () => 1)[0]?.intensity).toBe(1)
  })

  it('a piece with no handle-driven water runs nothing', () => {
    const fx = createFixtureEmitters({ emitters: [{ id: 'smoke', kind: 'smoke', pos: [0, 0, 0], source: 'burner' }] })
    expect(fx.runs).toBe(false)
    expect(fx.update(1, () => 1)).toEqual([])
  })
})
