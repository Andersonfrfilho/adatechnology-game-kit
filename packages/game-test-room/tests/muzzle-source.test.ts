import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import type { MuzzlePose } from '@adatechnology/game-contracts'
import { makeRoom } from './helpers'

const MUZZLE: MuzzlePose = { position: [0.31, 1.27, -0.92], direction: [0, 0, -1], drawsFlash: true }

// the start of the tracer the last shot drew: the room's tracer lines are its only yellow lines
const tracerStart = (scene: THREE.Scene): number[] | null => {
  let start: number[] | null = null
  scene.traverse((o) => {
    const line = o as THREE.Line
    if (!line.isLine || !line.visible) return
    const material = line.material as THREE.LineBasicMaterial
    if (material.color?.getHex() !== 0xffe9a8) return
    const p = line.geometry.getAttribute('position')
    start = [p.getX(0), p.getY(0), p.getZ(0)]
  })
  return start
}

// a gun fires once it is drawn (and a minigun once its barrels spin): pull until it does
const fireWhenReady = (room: { use(): string; update(dt: number): void }): string => {
  let status = room.use()
  for (let i = 0; i < 240 && status !== 'ok'; i++) {
    room.update(1 / 60)
    status = room.use()
  }
  return status
}

describe('the muzzle a module lends the room', () => {
  it('starts the tracer at the muzzle of the weapon drawn in the hands, and leaves the flash to the module that draws one', () => {
    const room = makeRoom()
    let lent: MuzzlePose | null = MUZZLE
    room.loadModule({ id: 'gun', name: 'Gun', group: 'Test', items: () => [], attach: (host) => host.setMuzzleSource?.(() => lent) ?? (() => undefined) })
    const emit = vi.spyOn(room.renderer, 'emit')
    room.setTool('glock_17')
    room.update(1 / 60)
    room.look([0, 1.6, 2], [0, 1.2, -11])
    expect(fireWhenReady(room)).toBe('ok')
    const start = tracerStart(room.scene)
    MUZZLE.position.forEach((value, axis) => expect(start?.[axis]).toBeCloseTo(value, 5))
    expect(emit.mock.calls.some(([kind]) => kind === 'flash')).toBe(false)
    // a module that draws no flash (a generic prop): the room flashes at the lent muzzle
    lent = { ...MUZZLE, drawsFlash: false }
    emit.mockClear()
    for (let i = 0; i < 60; i++) room.update(1 / 60)
    expect(fireWhenReady(room)).toBe('ok')
    const flash = emit.mock.calls.find(([kind]) => kind === 'flash')
    expect(flash?.[1]).toEqual(MUZZLE.position)
    room.dispose()
  })

  it('keeps its own point ahead of the eye with no module lending a muzzle', () => {
    const room = makeRoom()
    room.setTool('glock_17')
    room.update(1 / 60)
    room.look([0, 1.6, 2], [0, 1.2, -11])
    expect(fireWhenReady(room)).toBe('ok')
    const start = tracerStart(room.scene)
    expect(start).not.toBeNull()
    expect(Math.hypot(start![0]! - room.camera.position.x, start![1]! - room.camera.position.y, start![2]! - room.camera.position.z)).toBeLessThan(0.6)
    room.dispose()
  })
})
