import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleSpec, JointSpec } from '../src'

const box = (id: string, x: number, anchored: boolean): DestructibleSpec['parts'][number] => ({ id, material: 'concrete', shape: { kind: 'box', size: [0.2, 2, 0.2] }, position: [x, 1, 0], ...(anchored ? { anchored: true } : {}) })

/** A wall anchored at x 0, a loose pole at x 4 and a wire between them, joined as `joints` say. */
const groupsOf = (joints: JointSpec[]): string[][] => {
  const spec: DestructibleSpec = { parts: [box('wall', 0, true), box('pole', 4, false), { id: 'wire', material: 'copper', shape: { kind: 'box', size: [0.02, 0.02, 3] }, position: [2, 2, 0] }], joints }
  const world = createDestruction()
  const id = world.add(spec)
  return world.state(id)!.groups.map((group) => [...group].sort())
}
const groupOf = (groups: string[][], part: string): string[] => groups.find((group) => group.includes(part))!

describe('a joint that tears', () => {
  it('joins a wire to the loose pole it hangs from when it does not tear (the wire rides the pole)', () => {
    const groups = groupsOf([{ a: 'wire', b: 'pole', kind: 'clip', bears: false }])
    expect(groupOf(groups, 'wire')).toEqual(['pole', 'wire'])
  })

  it('lets go of a loose pole: the wire is a group of its own, apart from the pole', () => {
    const groups = groupsOf([{ a: 'wire', b: 'pole', kind: 'clip', bears: false, tears: true }])
    expect(groupOf(groups, 'wire')).toEqual(['wire'])
    expect(groupOf(groups, 'pole')).toEqual(['pole'])
  })

  it('holds a wire to a part that stands (an anchored wall): it hangs in that group', () => {
    const groups = groupsOf([{ a: 'wire', b: 'wall', kind: 'clip', bears: false, tears: true }])
    expect(groupOf(groups, 'wire')).toEqual(['wall', 'wire'])
  })

  it('a wire held by a loose pole and by the wall hangs from the wall, and the pole is left alone', () => {
    const groups = groupsOf([{ a: 'wire', b: 'pole', kind: 'clip', bears: false, tears: true }, { a: 'wire', b: 'wall', kind: 'clip', bears: false, tears: true }])
    expect(groupOf(groups, 'wire')).toEqual(['wall', 'wire'])
    expect(groupOf(groups, 'pole')).toEqual(['pole'])
  })

  it('a torn wire opened from the wall by a hand falls apart as a group of its own', () => {
    const spec: DestructibleSpec = { parts: [box('wall', 0, true), { id: 'wire', material: 'copper', shape: { kind: 'box', size: [0.02, 0.02, 1] }, position: [0.2, 2, 0] }], joints: [{ a: 'wire', b: 'wall', kind: 'clip', bears: false, tears: true }] }
    const world = createDestruction()
    const id = world.add(spec)
    expect(groupOf(world.state(id)!.groups.map((group) => [...group]), 'wire')).toContain('wall')
    for (let t = 0; t < 2; t += 0.1) world.disassemble(id, 'wire~wall', 'hand', 0.1)
    expect(groupOf(world.state(id)!.groups.map((group) => [...group]), 'wire')).toEqual(['wire'])
  })
})
