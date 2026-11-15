import { afterEach, describe, it } from 'vitest'
import { checkSurface, surfacePartIds } from './vehicle-colliders-support'

afterEach(() => new Promise((resolve) => setImmediate(resolve)))

describe('the pieces a vehicle collides with, on the whole fleet', () => {
  it.each(surfacePartIds(11))('%s: every collision vertex and triangle of every piece lies within 1 cm of its own drawn surface', (id) => checkSurface(id), 240000)
})
