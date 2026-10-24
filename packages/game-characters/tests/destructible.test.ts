import { checkDestructible } from '@adatechnology/game-contracts'
import { createDestruction } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { createCharacters } from '../src'

const kit = createCharacters()

describe('the character as a DestructibleImpl', () => {
  it('passes the contract check of the test room', () => {
    const report = checkDestructible(kit.create({ seed: 1, kind: 'person' }))
    expect(report.problems).toEqual([])
  })

  it('every event names the character and parts it describes, and survives JSON', () => {
    const character = kit.create({ seed: 1, kind: 'person', id: 'z1' })
    const parts = new Set(character.describe().parts.map((part) => part.id))
    const events = [
      ...character.hit({ type: 'slash', point: [0, 1, 0], part: 'upperArmL', points: 80 }),
      ...character.hit({ type: 'explosive', point: [0, 0.2, 0.5], energy: 0, points: 300, radius: 1.6 }),
      ...character.update(1),
    ]
    expect(events.length).toBeGreaterThan(0)
    for (const event of events) {
      expect(event.object).toBe('z1')
      const part = (event as { part?: string }).part
      if (part !== undefined) expect(parts.has(part)).toBe(true)
    }
    expect(JSON.parse(JSON.stringify(events))).toEqual(events)
  })

  it('serialize and load bring back the body, the bleeders and the stream position; reset heals it', () => {
    const character = kit.create({ seed: 7, kind: 'person', id: 'saved', protection: ['helmet_combat'] })
    character.hit({ type: 'slash', point: [0, 1, 0], part: 'thighR', points: 80 })
    character.hit({ type: 'ballistic', point: [0, 1.7, 0], part: 'head', energy: 500, mass: 7.5, caliber: 9 })
    const saved = JSON.parse(JSON.stringify(character.serialize()))
    const copy = kit.create({ seed: 7, kind: 'person', id: 'saved', protection: ['helmet_combat'] })
    copy.load(saved)
    expect(copy.state()).toEqual(character.state())
    expect(copy.bleeders()).toEqual(character.bleeders())
    expect(copy.intactProtection()).toEqual([])
    copy.reset()
    expect(copy.state().body).toEqual({ alive: true, vitality: 100, missing: 0, limp: false, crawl: false })
    expect(copy.bleeders()).toEqual([])
  })

  it('a destruction world hosts it: a shot down the line hits the body and the body events come back', () => {
    const world = createDestruction()
    const character = kit.create({ seed: 1, kind: 'person', id: 'walker' })
    character.setTransform([0, 0, -5])
    world.register(character, { position: [0, 0, -5] })
    const results = world.shoot([0, 1.3, 0], [0, 0, -1], 500, 9)
    expect(results[0]).toMatchObject({ object: 'walker' })
    expect(results[0]?.events.some((event) => event.type === 'damage')).toBe(true)
    expect(world.state('walker')?.body?.vitality).toBeLessThan(100)
  })
})
