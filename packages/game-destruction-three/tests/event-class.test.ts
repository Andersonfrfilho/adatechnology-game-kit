import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { DestructionEvent } from '@adatechnology/game-destruction'

import { EVENT_CLASS, EventOrder, isStructuralEvent } from '../src/event-class'

const CONTRACT_SOURCE = fileURLToPath(new URL('../../game-contracts/src/destruction.ts', import.meta.url))

/** The `type` literal of every member of the `DestructionEvent` union, read from the contract. */
const contractEventTypes = (): string[] => {
  const source = readFileSync(CONTRACT_SOURCE, 'utf8')
  const start = source.indexOf('export type DestructionEvent =')
  const end = source.indexOf('export type DestructionEventType')
  expect(start).toBeGreaterThan(0)
  expect(end).toBeGreaterThan(start)
  return [...source.slice(start, end).matchAll(/type: '([a-z_]+)'/g)].map((match) => match[1]!)
}

const eventOf = (type: string, object: string, tag: string): DestructionEvent => ({ type, object, time: 0, tag }) as unknown as DestructionEvent

describe('the class of every destruction event (spec 017 T2.2)', () => {
  it('lists every type of the contract, and nothing else', () => {
    expect([...new Set(contractEventTypes())].sort()).toEqual(Object.keys(EVENT_CLASS).sort())
  })

  it('keeps the events that make bodies, change the world or draw on the generator structural', () => {
    for (const type of ['detach', 'collapse', 'fracture', 'expose', 'settle', 'subside', 'burnout', 'destroyed', 'explode', 'chip', 'stage', 'dent', 'bend', 'spall', 'drip', 'leak']) {
      expect(EVENT_CLASS[type as keyof typeof EVENT_CLASS], type).toBe('structural')
    }
    for (const type of ['hole', 'crack', 'ricochet', 'debris']) expect(EVENT_CLASS[type as keyof typeof EVENT_CLASS], type).toBe('visual')
  })
})

describe('the order events apply in', () => {
  const tags = (events: DestructionEvent[]): string[] => events.map((event) => (event as unknown as { tag: string }).tag)

  it('leaves a batch alone when no visual event follows a structural event of its object', () => {
    const batch = [eventOf('hole', 'a', 'h1'), eventOf('detach', 'a', 's1'), eventOf('hole', 'b', 'h2')]
    expect(new EventOrder().arrange(batch)).toBe(batch)
  })

  it('moves a visual event of an object to before its first structural event, keeping the order of the rest', () => {
    const batch = [eventOf('hole', 'a', 'h1'), eventOf('detach', 'a', 's1'), eventOf('hole', 'b', 'h2'), eventOf('crack', 'a', 'c1'), eventOf('fracture', 'a', 's2'), eventOf('hole', 'a', 'h3')]
    expect(tags(new EventOrder().arrange(batch))).toEqual(['h1', 'c1', 'h3', 's1', 'h2', 's2'])
  })

  it('classifies by type', () => {
    expect(isStructuralEvent(eventOf('explode', 'a', 'x'))).toBe(true)
    expect(isStructuralEvent(eventOf('hole', 'a', 'x'))).toBe(false)
  })
})
