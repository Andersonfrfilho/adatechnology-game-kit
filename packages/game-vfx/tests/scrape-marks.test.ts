import { describe, expect, it } from 'vitest'
import { SCRAPE_LIMIT, createVfx } from '../src'
import type { Mark } from '../src'
import { addScrape, createMarkStore } from '../src/marks'

describe('scrape marks', () => {
  it('stay on the floor, the oldest going past the limit', () => {
    const vfx = createVfx({ seed: 1 })
    const added: Mark[] = []
    vfx.onMarks((event) => {
      if (event.type === 'add') added.push(event.mark)
    })
    for (let k = 0; k < SCRAPE_LIMIT + 10; k++) vfx.scrape({ x: k * 0.01, y: 0, z: 0, length: 0.3, width: 0.01, rotation: 0, color: 0x444444 })
    expect(added.length).toBe(SCRAPE_LIMIT + 10)
    expect(added.every((m) => m.kind === 'scrape' && m.y > 0)).toBe(true)
    for (let k = 0; k < 100; k++) vfx.update(1)
    // nothing makes them fade: a dragged sofa's track stays
    expect(added.length).toBe(SCRAPE_LIMIT + 10)
  })

  it('the store keeps at most the limit: the oldest scratches leave first, the other marks stay', () => {
    const store = createMarkStore()
    store.add({ kind: 'dirt', x: 0, z: 0, radius: 1, lift: 0, rotation: 0 })
    for (let k = 0; k < SCRAPE_LIMIT + 10; k++) addScrape(store, { x: k, y: 0, z: 0, length: 0.3, width: 0.01, rotation: 0, color: 0 })
    expect(store.scrapeCount).toBe(SCRAPE_LIMIT)
    const scrapes = store.entries.filter((m) => m.kind === 'scrape')
    expect(scrapes.length).toBe(SCRAPE_LIMIT)
    expect(scrapes[0]!.kind === 'scrape' && scrapes[0]!.x).toBe(10)
    expect(store.entries.filter((m) => m.kind === 'dirt').length).toBe(1)
  })
})
