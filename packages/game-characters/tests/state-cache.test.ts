import { describe, expect, it } from 'vitest'

import { createCharacters } from '../src'

const kit = createCharacters()
const create = () => kit.create({ seed: 5, kind: 'person', id: 'cached' })

describe('the ObjectState cache of the damage character', () => {
  it('update keeps the identity while bleeders and leak events run', () => {
    const character = create()
    character.hit({ type: 'slash', point: [0, 1, 0], part: 'thighR', points: 80 })
    const state = character.state()
    expect(character.bleeders().length).toBeGreaterThan(0)
    let events = 0
    for (let step = 0; step < 180; step += 1) events += character.update(1 / 60).length
    expect(events).toBeGreaterThan(0)
    expect(character.state()).toBe(state)
  })

  it('a hit that drops the vitality builds a new state', () => {
    const character = create()
    const state = character.state()
    character.hit({ type: 'slash', point: [0, 1, 0], part: 'upperArmL', points: 80 })
    expect(character.state()).not.toBe(state)
    expect(character.state().body?.vitality).toBeLessThan(100)
  })

  it('death and limp show up in a new state', () => {
    const limping = create()
    const before = limping.state()
    limping.hit({ type: 'slash', point: [0, 0.5, 0], part: 'thighR', points: 200 })
    expect(limping.state()).not.toBe(before)
    expect(limping.state().body?.limp).toBe(true)
    const dead = create()
    const alive = dead.state()
    dead.hit({ type: 'explosive', point: [0, 1, 0.3], energy: 0, points: 5000, radius: 2 })
    expect(dead.state()).not.toBe(alive)
    expect(dead.state().body?.alive).toBe(false)
  })

  it('load, setDetail and reset invalidate', () => {
    const source = create()
    source.hit({ type: 'slash', point: [0, 1, 0], part: 'upperArmL', points: 80 })
    const target = create()
    const before = target.state()
    target.load(JSON.parse(JSON.stringify(source.serialize())))
    const loaded = target.state()
    expect(loaded).not.toBe(before)
    expect(loaded).toEqual(source.state())
    const detail = target.detail === 'regions' ? 'segments' : 'regions'
    target.setDetail(detail)
    expect(target.state()).not.toBe(loaded)
    const changed = target.state()
    target.reset()
    expect(target.state()).not.toBe(changed)
  })
})
