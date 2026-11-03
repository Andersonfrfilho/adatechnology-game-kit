import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createCreaseQueue, createVehicleDestructible } from '../src'
import type { CreaseWork } from '../src'
import { makeKit } from './helpers/kit'

const kit = makeKit()

describe('a vehicle that goes away lets the crease queue go', () => {
  it('releases its visuals on dispose, and a second dispose changes nothing', () => {
    const queue = createCreaseQueue()
    const tracked: CreaseWork[] = []
    const released: CreaseWork[] = []
    const spy = { ...queue, track: (work: CreaseWork) => { tracked.push(work); const release = queue.track(work); return () => { released.push(work); release() } } }
    const built = buildVehicleItem(kit, 'proto')
    const d = createVehicleDestructible(kit, built.vehicle, { id: 'gone', frame: built.root, seed: 1, creaseQueue: spy })
    expect(tracked).toHaveLength(1)
    queue.deferredQueue().attach?.()
    d.dispose?.()
    d.dispose?.()
    expect(released).toEqual(tracked)
    expect(queue.deferredQueue().pending(1)).toBe(0)
  })

  it('a reset hands the old visuals back and tracks the new ones', () => {
    const queue = createCreaseQueue()
    let live = 0
    const spy = { ...queue, track: (work: CreaseWork) => { live++; const release = queue.track(work); return () => { live--; release() } } }
    const built = buildVehicleItem(kit, 'proto')
    const d = createVehicleDestructible(kit, built.vehicle, { id: 'again', frame: built.root, seed: 1, creaseQueue: spy })
    d.reset?.()
    expect(live).toBe(1)
    d.dispose?.()
    expect(live).toBe(0)
  })
})
