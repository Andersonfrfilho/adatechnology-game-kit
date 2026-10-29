import { describe, expect, it } from 'vitest'

import { kitOriginOf, markKitOrigin, unmarkedDrawings } from '../src'

const node = (name: string, extra: Record<string, unknown> = {}, children: any[] = []): any => {
  const n: any = { name, userData: {}, children, visible: true, parent: null, ...extra }
  for (const c of children) c.parent = n
  return n
}

describe('kit origin', () => {
  it('finds the origin up the tree and lists only what no builder marked', () => {
    const wheel = node('wheel', { isMesh: true })
    const car = markKitOrigin(node('sedan', {}, [node('body', {}, [wheel])]), { owner: 'game-vehicles-three', kind: 'vehicle', id: 'sedan' })
    const box = node('box', { isMesh: true })
    const hidden = node('hidden', { isMesh: true, visible: false })
    const scene = node('', {}, [car, node('rig', {}, [box]), hidden])
    expect(kitOriginOf(wheel)).toEqual({ owner: 'game-vehicles-three', kind: 'vehicle', id: 'sedan' })
    expect(kitOriginOf(box)).toBeNull()
    expect(unmarkedDrawings(scene).map((d) => d.path)).toEqual(['rig > box'])
  })
})
