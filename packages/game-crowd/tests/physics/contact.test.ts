import { describe, expect, it } from 'vitest'

import { createNavGrid, createRng, createStore } from '../../src'
import { contactStep, createContactView } from '../../src/physics/contact'
import type { ContactResult } from '../../src/physics/contact'
import { CONTACT_DEFAULTS } from '../../src/physics/options'

const H = 1 / 60
// below this share of the starting energy the push is a few float32 ulps of nothing, and a step can round up
const NOISE_FLOOR = 1e-12

const restingSquare = (count: number) => {
  const store = createStore(count)
  const random = createRng(3)
  for (let i = 0; i < count; i++) {
    store.x[i] = (random() - 0.5) * 8
    store.z[i] = (random() - 0.5) * 8
    store.height[i] = 1
    store.build[i] = 1
    store.mass[i] = 70
    store.identity[i] = i + 1
    const angle = random() * Math.PI * 2
    store.pushX[i] = Math.cos(angle) * 2
    store.pushZ[i] = Math.sin(angle) * 2
  }
  store.n = count
  const view = createContactView(store, createNavGrid({ size: 64 }))
  view.n = count
  return { store, view }
}

const kinetic = (store: ReturnType<typeof createStore>): number => {
  let energy = 0
  for (let i = 0; i < store.n; i++) energy += 0.5 * store.mass[i]! * (store.pushX[i]! ** 2 + store.pushZ[i]! ** 2)
  return energy
}

describe('contact: the energy of a crowd at rest does not grow', () => {
  it('300 bodies in 8 x 8 m with a push of 2 m/s: no step adds energy, and in 60 s it is gone', () => {
    const { store, view } = restingSquare(300)
    const out: ContactResult = { contacts: 0, maxOverlap: 0, overlapSum: 0 }
    const start = kinetic(store)
    let before = start
    let worstGrowth = 0
    for (let step = 0; step < 3600; step++) {
      contactStep(view, { ...CONTACT_DEFAULTS, h: H }, out)
      const after = kinetic(store)
      if (before > start * NOISE_FLOOR) worstGrowth = Math.max(worstGrowth, after / before - 1)
      before = after
    }
    expect(worstGrowth).toBeLessThanOrEqual(1e-6)
    expect(before).toBeLessThanOrEqual(start * 1e-6)
  })

  it('the same bodies with the push of a crush (6 m/s) also never gain energy', () => {
    const { store, view } = restingSquare(300)
    for (let i = 0; i < store.n; i++) {
      store.pushX[i]! *= 3
      store.pushZ[i]! *= 3
    }
    const out: ContactResult = { contacts: 0, maxOverlap: 0, overlapSum: 0 }
    for (let step = 0; step < 120; step++) {
      const before = kinetic(store)
      contactStep(view, { ...CONTACT_DEFAULTS, maxPush: 100, h: H }, out)
      expect(kinetic(store)).toBeLessThanOrEqual(before * (1 + 1e-6))
    }
  })

  it('a pair on the very same spot is pushed apart by a direction of its identities, the same one every time', () => {
    const run = (): number[] => {
      const store = createStore(2)
      for (let i = 0; i < 2; i++) {
        store.height[i] = 1
        store.build[i] = 1
        store.mass[i] = 70
        store.identity[i] = 10 + i
      }
      store.n = 2
      const view = createContactView(store, createNavGrid({ size: 64 }))
      view.n = 2
      contactStep(view, { ...CONTACT_DEFAULTS, h: H }, { contacts: 0, maxOverlap: 0, overlapSum: 0 })
      return [store.x[0]!, store.z[0]!, store.x[1]!, store.z[1]!]
    }
    const first = run()
    expect(Math.hypot(first[0]! - first[2]!, first[1]! - first[3]!)).toBeGreaterThan(0)
    expect(run()).toEqual(first)
  })
})
