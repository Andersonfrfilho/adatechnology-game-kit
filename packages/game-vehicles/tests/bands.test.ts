import { describe, expect, it } from 'vitest'
import { makeKit } from './helpers/kit'

const kit = makeKit({}, false)

describe('damage bands', () => {
  it.each([
    [0, 4],
    [1, 3],
    [25, 3],
    [26, 2],
    [50, 2],
    [51, 1],
    [75, 1],
    [76, 0],
    [100, 0],
  ])('health %i is band %i', (health, band) => {
    expect(kit.bandOf(health)).toBe(band)
  })

  it('clamps and rounds the input', () => {
    expect(kit.bandOf(-20)).toBe(4)
    expect(kit.bandOf(250)).toBe(0)
    expect(kit.bandOf(75.6)).toBe(0)
    expect(kit.bandOf(undefined as unknown as number)).toBe(0)
  })

  it('exposes five bands from intact to torn off, each with a typical health inside it', () => {
    expect(kit.bands.map((b) => b.id)).toEqual(['intact', 'scratched', 'dented', 'destroyed', 'torn_off'])
    kit.bands.forEach((b, i) => expect(kit.bandOf(b.health)).toBe(i))
  })

  it('lets a pack rename and recolour the bands', () => {
    const custom = makeKit({ bands: [{ name: 'Pristine', color: '#00f' }] }, false)
    expect(custom.bands[0].name).toBe('Pristine')
    expect(custom.bands[0].color).toBe('#00f')
    expect(custom.bands[1].name).toBe('Scratched')
  })
})
