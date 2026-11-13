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


const slotOf = (room: Room, index = 0): number => room.inventory().rows[index]!.slotId as number
const partStates = (room: Room, objectId: string): unknown[] => room.world.snapshot(objectId)!.parts.map((part) => [part.id, part.status, part.bend ?? 0, part.holes.length])
const lastDropped = (room: Room): string => room.log.entries({ type: 'drop' }).at(-1)!.objectId!

describe('the bag in the test room', () => {
  it('picks a damaged shovel into the bag with its damage in words, and takes it out of the world', () => {
    const { room, objectId } = withShovel((r, id) => (snapHandle(r, id), bendBlade(r, id)))
    expect(room.pickToBag()).toEqual({ ok: true })
    expect(room.world.has(objectId)).toBe(false)
    const [row] = room.inventory().rows
    expect(row!.name).toBe('Shovel')
    expect(row!.condition).toContain('handle snapped')
    expect(row!.condition).toMatch(/blade bent \d+°/)
    expect(room.inventory().totals.slots).toBe(1)
    expect(room.log.entries({ type: 'pickup_bag' })).toHaveLength(1)
  })

  it('pick up in hand, store, then drop: the same damaged object comes back, deep-equal', () => {
    const { room, objectId } = withShovel((r, id) => (snapHandle(r, id), bendBlade(r, id)))
    const before = partStates(room, objectId)
    room.grab()
    expect(room.inventory().held?.name).toBe('Shovel')
    expect(room.storeHeld()).toEqual({ ok: true })
    expect(room.inventory().held).toBeNull()
    expect(room.inventory().rows).toHaveLength(1)
    expect(room.dropSlot(slotOf(room))).toEqual({ ok: true })
    expect(room.inventory().rows).toHaveLength(0)
    expect(partStates(room, lastDropped(room))).toEqual(before)
  })

  it('equipping a slot puts the same damaged shovel back in hand; dropping it from the hand empties the inventory hand', () => {
    const { room, objectId } = withShovel(bendBlade)
    const before = partStates(room, objectId)
    room.pickToBag()
    expect(room.equipSlot(slotOf(room))).toEqual({ ok: true })
    expect(room.tool.def.id).toBe('shovel')
    expect(room.inventory().held?.condition).toMatch(/blade bent/)
    expect(room.grab()).toBe(true)
    expect(room.inventory().held).toBeNull()
    expect(partStates(room, lastDropped(room))).toEqual(before)
  })

  it('a bent shovel stored in the bag stays bent when equipped: it takes a smaller bite', () => {
    const bite = (damage: (room: Room, objectId: string) => void): number => {
      const { room, wait } = withShovel(damage)
      room.pickToBag()
      room.equipSlot(slotOf(room))
      wait(0.6, 0.8)
      room.use()
      wait(1.5, 0.8)
      return room.log.entries({ type: 'dig' })[0]!.data?.biteShare as number
    }
    expect(bite(() => undefined)).toBe(1)
    expect(bite(bendBlade)).toBeLessThan(0.95)
  })

  it('refuses by weight, with a localized reason in the log and the bag untouched', () => {
    const room = makeRoom({ catalog: demoItems('pt-BR', [shovelItem]), locale: 'pt-BR', maxCarryKg: 0.2 })
    room.setAvatar(digger())
    room.spawn('item_shovel', [-0.5, 0, -1.2], 0)
    room.update(0.4)
    room.look([0, 1.7, 0], [0, room.terrain.heightAt(0, -1.2), -1.2])
    room.update(0.5)
    expect(room.pickToBag()).toEqual({ ok: false, reason: 'too_heavy' })
    expect(room.log.entries({ type: 'inventory_refused' })[0]!.text).toContain('pesado demais')
    expect(room.inventory().rows).toHaveLength(0)
  })

  it('refuses by volume when the bag is too small', () => {
    const room = makeRoom({ catalog: demoItems('en', [shovelItem]), inventory: { litres: 1 } })
    room.setAvatar(digger())
    room.spawn('item_shovel', [-0.5, 0, -1.2], 0)
    room.update(0.4)
    room.look([0, 1.7, 0], [0, room.terrain.heightAt(0, -1.2), -1.2])
    room.update(0.5)
    expect(room.pickToBag()).toEqual({ ok: false, reason: 'too_bulky' })
    expect(room.log.entries({ type: 'inventory_refused' })[0]!.text).toContain('too bulky')
  })

  it('lists the slots in the panel with their condition, totals and limits, and the I key toggles it', () => {
    const { room } = withShovel((r, id) => (snapHandle(r, id), bendBlade(r, id)))
    room.pickToBag()
    expect(room.openInventory(true)).toBe(true)
    const panel = [...document.querySelectorAll<HTMLElement>('[data-inventory]')].at(-1)!
    expect(panel.classList.contains('open')).toBe(true)
    expect(panel.textContent).toContain('1. Shovel')
    expect(panel.textContent).toContain('handle snapped')
    expect(panel.textContent).toMatch(/blade bent \d+°/)
    expect(panel.textContent).toMatch(/1\/20 slots · .* kg\/60 kg|1\/20 slots · [\d.]+\/60 kg · [\d.]+\/30 L/)
    ;(panel.querySelector('[data-action="drop"]') as HTMLButtonElement).click()
    expect(room.inventory().rows).toHaveLength(0)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI' }))
    expect(panel.classList.contains('open')).toBe(false)
  })
})
