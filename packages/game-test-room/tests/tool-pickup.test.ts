import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type * as THREE_NS from 'three'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import type { RoomAvatar, TestRoomItem } from '../src'
import { buildFromSpec } from '../src/build-from-spec'
import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'

type Vec = [number, number, number]
type Room = ReturnType<typeof makeRoom>

const SHOVEL_SPEC = (): DestructibleSpec => ({
  name: 'Shovel',
  parts: [
    { id: 'handle', material: 'wood_hard', shape: { kind: 'box', size: [0.9, 0.035, 0.035] }, position: [0, 0.02, 0], tags: ['handle'] },
    { id: 'blade', material: 'steel', shape: { kind: 'box', size: [0.3, 0.012, 0.22] }, position: [0.5, 0.02, 0], thickness: 0.002, tags: ['blade'] },
  ],
})
/** A shovel as the goods row makes it: an item that is also the `shovel` of the arsenal. */
const shovelItem: TestRoomItem = { id: 'item_shovel', name: 'Shovel', group: 'Items', build: (T: typeof THREE_NS) => buildFromSpec(T, SHOVEL_SPEC()), spec: SHOVEL_SPEC, movable: true, weapon: 'shovel' }

const digger = (): RoomAvatar => {
  const hand = new THREE.Object3D()
  return { root: new THREE.Group(), update: () => undefined, hand: () => hand, strike: (clip) => (clip === 'shovel_dig' ? 0.75 : clip === 'shovel_swing' ? 0.28 : null) }
}

/** The room on dirt with a shovel lying 1.2 m ahead of the player (its blade in front of the eye), damaged by `damage` before it is picked up. */
function withShovel(damage: (room: Room, objectId: string) => void): { room: Room; objectId: string; look: (ahead: number) => void; wait: (seconds: number, ahead?: number) => void } {
  const room = makeRoom({ catalog: demoItems('en', [shovelItem]) })
  room.setAvatar(digger())
  room.terrain.setLayout({ surface: 'dirt' })
  const objectId = room.spawn('item_shovel', [-0.5, 0, -1.2], 0).objectId
  room.update(0.4)
  damage(room, objectId)
  const eye: Vec = [0, 1.7, 0]
  const look = (ahead: number): void => room.look(eye, [0, room.terrain.heightAt(0, -ahead), -ahead])
  const wait = (seconds: number, ahead = 1.2): void => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      look(ahead)
      room.update(1 / 60)
    }
  }
  wait(0.5)
  return { room, objectId, look, wait }
}

const snapHandle = (room: Room, objectId: string): void => void room.world.hitPart(objectId, 'handle', { type: 'blunt', point: [-0.7, 0.0375, -1.2], direction: [0, -1, 0], energy: 300, radius: 0.05 })
const bendBlade = (room: Room, objectId: string): void => void room.world.hitPart(objectId, 'blade', { type: 'blunt', point: [0, 0.026, -1.2], direction: [0, -1, 0], energy: 130, radius: 0.05 })

describe('picking up a tool of the arsenal from the world', () => {
  it('puts it in hand and takes the object out of the world', () => {
    const { room, objectId } = withShovel(() => undefined)
    expect(room.grab()).toBe(true)
    expect(room.tool.def.id).toBe('shovel')
    expect(room.world.has(objectId)).toBe(false)
    expect(room.log.entries({ type: 'pickup_tool' })).toHaveLength(1)
  })

  it('a shovel with a snapped handle is picked up broken: nothing is swung or dug, and the room says why', () => {
    const { room, wait } = withShovel(snapHandle)
    room.grab()
    wait(0.6, 0.8)
    room.use()
    wait(1.5, 0.8)
    expect(room.log.entries({ type: 'dig' })).toHaveLength(0)
    expect(room.log.entries({ type: 'tool_broken' })[0]!.text).toContain('handle is snapped')
  })

  it('a shovel with a bent blade is picked up bent: it takes a smaller bite than a whole one', () => {
    const share = (damage: (room: Room, objectId: string) => void): number => {
      const { room, wait } = withShovel(damage)
      room.grab()
      wait(0.6, 0.8)
      room.use()
      wait(1.5, 0.8)
      return room.log.entries({ type: 'dig' })[0]!.data?.biteShare as number
    }
    expect(share(() => undefined)).toBe(1)
    expect(share(bendBlade)).toBeLessThan(0.95)
    expect(share(bendBlade)).toBeGreaterThan(0.5)
  })

  it('dropping it puts back the same damaged object, and the tool is whole again for the next one', () => {
    const { room, objectId } = withShovel((r, id) => (snapHandle(r, id), bendBlade(r, id)))
    const before = room.world.snapshot(objectId)!
    room.grab()
    expect(room.grab()).toBe(true)
    const dropped = room.log.entries({ type: 'drop' })[0]!.objectId!
    expect(dropped).not.toBe(objectId)
    const after = room.world.snapshot(dropped)!
    const states = (parts: typeof before.parts): unknown[] => parts.map((part) => [part.id, part.status, part.bend ?? 0])
    expect(states(after.parts)).toEqual(states(before.parts))
    expect(after.parts.find((part) => part.id === 'handle')!.status).toBe('broken')
    expect(after.parts.find((part) => part.id === 'blade')!.bend).toBeGreaterThan(0.3)
  })

  it('throwing it sends the same damaged object off', () => {
    const { room, objectId } = withShovel(snapHandle)
    room.grab()
    expect(room.throwHeld(6)).toBe(true)
    const thrown = room.log.entries({ type: 'throw' })[0]!.objectId!
    expect(thrown).not.toBe(objectId)
    expect(room.world.snapshot(thrown)!.parts.find((part) => part.id === 'handle')!.status).toBe('broken')
  })
})
