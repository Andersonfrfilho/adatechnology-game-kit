import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { RoomAvatar } from '../src'
import { createDestruction } from '@adatechnology/game-destruction'
import { toolConditionOf } from '../src'
import { makeRoom } from './helpers'

type Vec = [number, number, number]
type Room = ReturnType<typeof makeRoom>

/** A body that plays the shovel's clips: their impacts at the seconds the kit's clips have them (the bite at 0.75 s, the swing's blow at 0.28 s). */
const digger = (): RoomAvatar & { struck: string[] } => {
  const struck: string[] = []
  const hand = new THREE.Object3D()
  return { root: new THREE.Group(), struck, update: () => undefined, hand: () => hand, strike: (clip) => (struck.push(clip), clip === 'shovel_dig' ? 0.75 : clip === 'shovel_swing' ? 0.28 : null) }
}

/** The room on `surface`, the shovel in hand, the player standing at the origin looking at the ground `ahead` metres in front. */
function digging(surface: string, ahead = 0.8): { room: Room; avatar: ReturnType<typeof digger>; spot: Vec; wait: (s: number) => void } {
  const room = makeRoom()
  const avatar = digger()
  room.setAvatar(avatar)
  room.terrain.setLayout({ surface })
  room.setTool('shovel')
  const eye: Vec = [0, 1.7, 0], spot: Vec = [0, 0, -ahead]
  // looking at the ground there as it is now: the floor of the hole once it is dug
  const wait = (seconds: number): void => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      room.look(eye, [spot[0], room.terrain.heightAt(spot[0], spot[2]), spot[2]])
      room.update(1 / 60)
    }
  }
  wait(0.6)
  return { room, avatar, spot, wait }
}

describe('a shovel digs where it is aimed at the ground', () => {
  it("a shovelful takes a bite out of the soil at the body clip's impact, and throws the earth aside", () => {
    const { room, avatar, spot, wait } = digging('dirt')
    room.use()
    expect(avatar.struck).toEqual(['shovel_dig'])
    wait(0.5)
    expect(room.terrain.heightAt(spot[0], spot[2])).toBeCloseTo(0, 6)
    wait(0.4)
    expect(room.terrain.heightAt(spot[0], spot[2])).toBeLessThan(-0.15)
    // the heap is to the right of the way the player faces (-z): at +x
    expect(room.terrain.heightAt(spot[0] + 0.9, spot[2])).toBeGreaterThan(0.02)
    const dug = room.log.entries({ type: 'dig' })
    expect(dug).toHaveLength(1)
    expect(dug[0]!.data).toMatchObject({ weapon: 'shovel', material: 'soil' })
  })

  it('it digs from the camera over the shoulder too: what counts is how far the ground is from the feet, not from the camera', () => {
    const { room, spot, wait } = digging('dirt')
    room.setCameraMode('third')
    wait(0.3)
    room.use()
    wait(1.0)
    // the over-the-shoulder aim meets the ground near where the eye looked: a shovelful came out there
    const dug = room.log.entries({ type: 'dig' })
    expect(dug).toHaveLength(1)
    expect(dug[0]!.data?.volumeM3).toBeGreaterThan(0.01)
    expect(spot[1]).toBe(0)
  })

  it('shovelfuls one after another deepen the hole', () => {
    const { room, spot, wait } = digging('dirt')
    for (let k = 0; k < 3; k++) {
      room.use()
      wait(1.8)
    }
    expect(room.terrain.heightAt(spot[0], spot[2])).toBeCloseTo(-0.6, 2)
  })

  it('on concrete, rock or asphalt the blade bounces off: nothing moves, and the room says why', () => {
    for (const surface of ['concrete_slab', 'bedrock', 'road']) {
      const { room, spot, wait } = digging(surface)
      room.use()
      wait(1.2)
      expect(room.terrain.heightAt(spot[0], spot[2]), surface).toBeCloseTo(0, 6)
      expect(room.terrain.heightAt(spot[0] + 0.9, spot[2]), surface).toBeCloseTo(0, 6)
      expect(room.log.entries({ type: 'dig' })[0]!.data?.refused, surface).toBeDefined()
    }
  })

  it('turned to fill, it throws the earth of the heap back into the hole', () => {
    const { room, spot, wait } = digging('dirt')
    for (let k = 0; k < 2; k++) {
      room.use()
      wait(1.8)
    }
    // Q turns the tool's mode: for a shovel, dig or fill
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }))
    for (let k = 0; k < 4; k++) {
      room.use()
      wait(1.8)
    }
    expect(room.terrain.heightAt(spot[0], spot[2])).toBeGreaterThan(-0.05)
  })
})

describe('a damaged shovel', () => {
  it('with a snapped handle, nothing is swung or dug, and the room says why', () => {
    const { room, avatar, spot, wait } = digging('dirt')
    room.setToolCondition('shovel', { handleBroken: true, bend: 0 })
    room.use()
    wait(1.5)
    expect(avatar.struck).toEqual([])
    expect(room.terrain.heightAt(spot[0], spot[2])).toBeCloseTo(0, 6)
    expect(room.log.entries({ type: 'dig' })).toHaveLength(0)
    expect(room.log.entries({ type: 'tool_broken' })[0]!.text).toContain('handle is snapped')
    // given back whole it digs again
    room.setToolCondition('shovel', undefined)
    wait(1)
    room.use()
    wait(2)
    expect(room.log.entries({ type: 'dig' })).toHaveLength(1)
  })

  it('with a bent blade, it digs a smaller bite of the same ground', () => {
    const bite = (bend: number): number => {
      const { room, wait } = digging('dirt')
      room.setToolCondition('shovel', { handleBroken: false, bend })
      room.use()
      wait(1.5)
      return room.log.entries({ type: 'dig' })[0]!.data?.volumeM3 as number
    }
    const whole = bite(0)
    const bent = bite(1)
    expect(bent).toBeGreaterThan(0)
    // about cos(1) = 0.54 of the bite (the ground is a grid, so not exactly)
    expect(bent / whole).toBeGreaterThan(0.35)
    expect(bent / whole).toBeLessThan(0.65)
    // a folded blade still takes a quarter of a bite
    expect(bite(1.5) / whole).toBeLessThan(bent / whole)
    expect(bite(1.5)).toBeGreaterThan(0)
  })
})

describe('the condition of a tool from its destruction object', () => {
  const spec = { parts: [{ id: 'h', material: 'wood_hard', shape: { kind: 'box' as const, size: [0.9, 0.035, 0.035] as [number, number, number] }, position: [0, 0, 0] as [number, number, number], tags: ['handle'] }, { id: 'b', material: 'steel', shape: { kind: 'box' as const, size: [0.3, 0.012, 0.22] as [number, number, number] }, position: [0.5, 0, 0] as [number, number, number], thickness: 0.002, tags: ['blade'] }] }

  it('reads a snapped handle and a bent blade from the parts tagged handle and blade', () => {
    const w = createDestruction({ seed: 1, groundHeight: -Infinity })
    const id = w.add(spec)
    expect(toolConditionOf(spec, w.state(id)!)).toEqual({ handleBroken: false, bend: 0 })
    w.hitPart(id, 'b', { type: 'blunt', point: [0.5, 0.006, 0], direction: [0, -1, 0], energy: 130, radius: 0.05 })
    w.hitPart(id, 'h', { type: 'blunt', point: [-0.2, 0.0175, 0], direction: [0, -1, 0], energy: 300, radius: 0.05 })
    const condition = toolConditionOf(spec, w.state(id)!)
    expect(condition.handleBroken).toBe(true)
    expect(condition.bend).toBeGreaterThan(0.3)
  })
})
