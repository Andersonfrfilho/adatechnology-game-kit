import { describe, expect, it } from 'vitest'

import { createObjectRegistry, createReportPort } from '../src/world'
import type { ObjectRegistryEvent, WorldReport } from '../src/world'

type Thing = { readonly name: string }

describe('createObjectRegistry', () => {
  it('answers like a Map: set, get, has, keys, values, size and delete', () => {
    const objects = createObjectRegistry<Thing>()
    objects.set('a', { name: 'chair' }).set('b', { name: 'table' })
    expect(objects.size).toBe(2)
    expect(objects.get('a')?.name).toBe('chair')
    expect(objects.has('b')).toBe(true)
    expect([...objects.keys()]).toEqual(['a', 'b'])
    expect([...objects.values()].map((thing) => thing.name)).toEqual(['chair', 'table'])
    expect(objects.delete('a')).toBe(true)
    expect(objects.delete('a')).toBe(false)
    expect(objects.has('a')).toBe(false)
    expect(objects.size).toBe(1)
  })

  it('holds one object at a time, and an unknown id leaves the hands empty', () => {
    const objects = createObjectRegistry<Thing>()
    objects.set('a', { name: 'can' }).set('b', { name: 'bottle' })
    expect(objects.held).toBeNull()
    expect(objects.hold('a')?.name).toBe('can')
    expect(objects.heldId).toBe('a')
    expect(objects.hold('b')?.name).toBe('bottle')
    expect(objects.held?.name).toBe('bottle')
    expect(objects.hold('missing')).toBeNull()
    expect(objects.held).toBeNull()
    expect(objects.heldId).toBeNull()
  })

  it('lets go of the held object when it leaves or is replaced', () => {
    const objects = createObjectRegistry<Thing>()
    objects.set('a', { name: 'can' })
    objects.hold('a')
    objects.delete('a')
    expect(objects.held).toBeNull()
    objects.set('b', { name: 'brick' })
    objects.hold('b')
    objects.set('b', { name: 'other brick' })
    expect(objects.held).toBeNull()
  })

  it('tells every change in order, and stops telling a listener that left', () => {
    const objects = createObjectRegistry<Thing>()
    const seen: string[] = []
    const stop = objects.on((event: ObjectRegistryEvent<Thing>) => seen.push(`${event.kind}:${event.id}:${event.record.name}`))
    objects.set('a', { name: 'can' })
    objects.hold('a')
    objects.release()
    objects.release()
    objects.hold('a')
    objects.delete('a')
    stop()
    objects.set('b', { name: 'brick' })
    expect(seen).toEqual(['added:a:can', 'held:a:can', 'released:a:can', 'held:a:can', 'released:a:can', 'removed:a:can'])
  })
})

describe('createReportPort', () => {
  it('hands every report to every listener, and not after it stopped listening', () => {
    const port = createReportPort()
    const first: WorldReport[] = []
    const second: string[] = []
    port.on((report) => first.push(report))
    const stop = port.on((report) => second.push(report.type))
    port.emit({ type: 'landing', text: 'landed', objectId: 'a', data: { speedMs: 3 } })
    stop()
    port.emit({ type: 'sank' })
    expect(first).toEqual([{ type: 'landing', text: 'landed', objectId: 'a', data: { speedMs: 3 } }, { type: 'sank' }])
    expect(second).toEqual(['landing'])
  })
})
