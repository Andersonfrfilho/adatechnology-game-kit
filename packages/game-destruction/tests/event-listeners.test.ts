import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'
import type { DestructionEvent } from '../src'

const shoot = (world: ReturnType<typeof createDestruction>, id: string): void => {
  world.hitPart(id, 'tank', { type: 'ballistic', point: [0.17, 0.2, 0], direction: [-1, 0, 0], energy: 500, caliber: 9 })
}

const worldWithTank = (): { world: ReturnType<typeof createDestruction>; id: string } => {
  const world = createDestruction({ seed: 3 })
  const id = world.add({ parts: [{ id: 'tank', material: 'steel', shape: { kind: 'cylinder', radius: 0.17, height: 0.49 }, position: [0, 0.245, 0], thickness: 0.002 }] }, { id: 'tank-body' })
  return { world, id }
}

describe('event listeners', () => {
  it('a listener that subscribes during an emit does not hear that event, and one that leaves still does', () => {
    const { world, id } = worldWithTank()
    const heardByNewcomer: DestructionEvent[] = []
    const heardByLeaver: DestructionEvent[] = []
    let unsubscribeLeaver = (): void => undefined
    let firstEvent: DestructionEvent | undefined
    world.on('*', (event) => {
      if (firstEvent) return
      firstEvent = event
      world.on('*', (later) => heardByNewcomer.push(later))
      unsubscribeLeaver()
    })
    unsubscribeLeaver = world.on('*', (event) => heardByLeaver.push(event))
    shoot(world, id)
    expect(firstEvent).toBeDefined()
    expect(heardByLeaver).toEqual([firstEvent])
    expect(heardByNewcomer.length).toBeGreaterThan(0)
    expect(heardByNewcomer).not.toContain(firstEvent)
  })

  it('keeps the order of subscription, ignores a repeated subscription and a repeated unsubscribe', () => {
    const { world, id } = worldWithTank()
    const order: string[] = []
    const first = (): void => void order.push('a')
    const off = world.on('*', first)
    world.on('*', first)
    world.on('*', () => order.push('b'))
    shoot(world, id)
    expect(order.slice(0, 2)).toEqual(['a', 'b'])
    off()
    off()
    order.length = 0
    shoot(world, id)
    expect(order.every((entry) => entry === 'b')).toBe(true)
  })
})

describe('event listeners, nested and mixed', () => {
  it('delivers an event started from inside a listener to every listener before the outer event goes on', () => {
    const { world, id } = worldWithTank()
    const log: Array<{ name: string; event: DestructionEvent }> = []
    let hasNested = false
    world.on('*', (event) => {
      log.push({ name: 'a', event })
      if (hasNested) return
      hasNested = true
      shoot(world, id)
    })
    world.on('*', (event) => log.push({ name: 'b', event }))
    world.on('damage', (event) => log.push({ name: 'typed', event }))
    shoot(world, id)
    const outer = log[0]!.event
    const outerB = log.findIndex((entry) => entry.name === 'b' && entry.event === outer)
    expect(outerB).toBeGreaterThan(1)
    expect(log.slice(1, outerB).some((entry) => entry.event !== outer)).toBe(true)
    const names = new Map<DestructionEvent, string[]>()
    for (const entry of log) names.set(entry.event, [...(names.get(entry.event) ?? []), entry.name])
    for (const [event, seen] of names) expect(seen, event.type).toEqual(event.type === 'damage' ? ['a', 'b', 'typed'] : ['a', 'b'])
  })
})
