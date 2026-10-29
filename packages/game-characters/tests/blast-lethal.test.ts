import { describe, expect, it } from 'vitest'

import { createCharacters } from '../src'

const kit = createCharacters()
const at = (metres: number, lethalRadius?: number): { alive: boolean; vitality: number } => {
  const character = kit.create({ seed: 3, kind: 'person', id: 'p' })
  character.hit({ type: 'explosive', point: [metres, 1, 0], energy: 200000, radius: 14, ...(lethalRadius === undefined ? {} : { lethalRadius }) })
  return (character.state() as { body: { alive: boolean; vitality: number } }).body
}

describe('blast with a lethal radius', () => {
  it('kills inside it, hurts between it and the radius less and less with distance, and spares beyond', () => {
    expect(at(3, 5).alive).toBe(false)
    const near = at(6.5, 5)
    const far = at(8, 5)
    expect(near.alive).toBe(true)
    expect(near.vitality).toBeLessThan(far.vitality)
    expect(far.vitality).toBeLessThan(100)
    expect(far.alive).toBe(true)
    const outside = at(14.5, 5)
    expect(outside.vitality).toBe(100)
  })

  it('without a lethal radius the blast is the old one: the points fall off over the radius', () => {
    expect(at(8).alive).toBe(false)
    expect(at(8).vitality).toBe(at(8, undefined).vitality)
  })
})
