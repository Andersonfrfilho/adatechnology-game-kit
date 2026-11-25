import { createFixedFootprintRainCover } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { createUrban, DEFAULT_PATTERNS } from '../src'

describe('what the urban pieces roof over for the rain', () => {
  const kit = createUrban()
  const covers = (build: (b: ReturnType<typeof kit.builder>) => void) => {
    const b = kit.builder({ seed: 3 })
    build(b)
    return createFixedFootprintRainCover(b.covers)
  }

  it('a tent roofs its prism at the ridge and leaves the ground beside it open', () => {
    const cover = covers((b) => kit.props.tent(b, 10, 20, 0, 4, 6))
    expect(cover.coverTopAt(10, 20)).toBeCloseTo(2.8, 5)
    expect(cover.coverTopAt(10, 22.9)).toBeCloseTo(2.8, 5)
    expect(cover.coverTopAt(13, 20)).toBeUndefined()
  })

  it('a turned tent and a container follow their turn', () => {
    const cover = covers((b) => {
      kit.props.tent(b, 0, 0, Math.PI / 2, 4, 6)
      kit.props.container(b, 30, 0, 0, Math.PI / 2, 0x335577)
    })
    // the long side of the turned tent lies along x now
    expect(cover.coverTopAt(2.5, 0)).toBeDefined()
    expect(cover.coverTopAt(0, 2.5)).toBeUndefined()
    expect(cover.coverTopAt(32.5, 0)).toBeCloseTo(2.6, 4)
    expect(cover.coverTopAt(30, 2)).toBeUndefined()
  })

  it('a watchtower roofs only its deck, 8 m up', () => {
    const cover = covers((b) => kit.props.watchtower(b, 0, 0))
    expect(cover.coverTopAt(1, 1)).toBeCloseTo(8.35, 5)
    expect(cover.coverTopAt(2.5, 0)).toBeUndefined()
  })

  it('every building of every pattern roofs its footprint at its height', () => {
    for (const pattern of DEFAULT_PATTERNS) {
      const b = kit.builder({ seed: 5 })
      const made = kit.neighbourhoods.get(pattern.id).compose(b, { x: 0, z: 0 }, { locale: 'en' })
      const cover = createFixedFootprintRainCover(b.covers)
      for (const building of made.buildings) expect(cover.coverTopAt(building.x, building.z), `${pattern.id} building at ${building.x},${building.z}`).toBeCloseTo(building.height, 3)
    }
  })
})
