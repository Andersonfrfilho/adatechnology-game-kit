import * as THREE from 'three'
import { beforeEach, describe, expect, it } from 'vitest'
import { create, locales, type CameraLike } from '../src'

class MemoryStorage {
  private data = new Map<string, string>()
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v))
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
  clear() {
    this.data.clear()
  }
}

/** A fake camera that only records what the rig asks of it. */
function fakeCamera() {
  const looked = new THREE.Vector3()
  const cam = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    lookAt(v: THREE.Vector3) {
      looked.copy(v)
    },
    updateMatrixWorld() {},
  }
  return { cam: cam as unknown as CameraLike, position: cam.position, looked }
}

const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps)

beforeEach(() => {
  ;(globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage()
})

describe('mode cycling and persistence', () => {
  it('starts on the first mode and cycles shoulder -> third -> first -> shoulder', () => {
    const rig = create(THREE, { storageKey: null })
    expect(rig.mode).toBe('shoulder')
    const seen: string[] = []
    rig.onChange((m) => seen.push(m))
    rig.cycle()
    rig.cycle()
    rig.cycle()
    expect(seen).toEqual(['third', 'first', 'shoulder'])
    expect(rig.isFirstPerson()).toBe(false)
  })

  it('ignores unknown modes', () => {
    const rig = create(THREE, { storageKey: null })
    rig.setMode('nope' as never)
    expect(rig.mode).toBe('shoulder')
  })

  it('persists the mode under storageKey and restores it', () => {
    const a = create(THREE, { storageKey: 'k' })
    a.setMode('third')
    expect(localStorage.getItem('k')).toBe('third')
    expect(create(THREE, { storageKey: 'k' }).mode).toBe('third')
  })

  it('does not touch storage when storageKey is null, and ignores invalid saved values', () => {
    create(THREE, { storageKey: null }).setMode('first')
    expect(localStorage.getItem('game-camera-mode')).toBeNull()
    localStorage.setItem('k', 'garbage')
    expect(create(THREE, { storageKey: 'k' }).mode).toBe('shoulder')
  })

  it('survives a throwing localStorage', () => {
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
    }
    const rig = create(THREE, { storageKey: 'k' })
    expect(() => rig.setMode('first')).not.toThrow()
    expect(rig.mode).toBe('first')
  })

  it('flips the shoulder side', () => {
    const rig = create(THREE, { storageKey: null })
    expect(rig.side).toBe(1)
    rig.flipSide()
    expect(rig.side).toBe(-1)
  })

  it('takes labels from the locale table and lets options override them', () => {
    expect(create(THREE, { storageKey: null }).config.labels.third).toBe(locales.en.modeLabels.third)
    expect(create(THREE, { storageKey: null, locale: 'pt-BR' }).config.labels).toEqual({
      shoulder: 'ombro',
      third: 'terceira pessoa',
      first: 'primeira pessoa',
    })
    const rig = create(THREE, { storageKey: null, labels: { shoulder: 'over the shoulder' } })
    expect(rig.config.labels.shoulder).toBe('over the shoulder')
    expect(rig.config.labels.first).toBe('first person')
  })
})

describe('update() math', () => {
  it('first person: eyes in front of the target, looking along the yaw', () => {
    const rig = create(THREE, { storageKey: null })
    rig.setMode('first')
    const { cam, position, looked } = fakeCamera()
    rig.update(cam, { x: 1, y: 0, z: 2, yaw: 0, pitch: 0 }, 0.016)
    close(position.x, 1)
    close(position.y, 1.62)
    close(position.z, 2 - 0.16)
    close(looked.x, 1)
    close(looked.z, 2 - 0.16 - 10)
    rig.update(cam, { x: 1, y: 0, z: 2, yaw: 0, pitch: 0, crouching: true }, 0.016)
    close(position.y, 1.15)
  })

  it('first person: positive pitch looks down', () => {
    const rig = create(THREE, { storageKey: null })
    rig.setMode('first')
    const { cam, position, looked } = fakeCamera()
    rig.update(cam, { x: 0, y: 0, z: 0, yaw: 0, pitch: Math.PI / 6 }, 0.016)
    expect(looked.y).toBeLessThan(position.y)
  })

  it('third person: sits behind the target at the configured distance and height', () => {
    const rig = create(THREE, { storageKey: null })
    rig.setMode('third')
    const { cam, position, looked } = fakeCamera()
    rig.update(cam, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, 0.016)
    // yaw 0 faces -z, so "behind" is +z; the boom tilts up by 0.1 over 4.2
    const L = Math.hypot(4.2, 0.1)
    close(position.x, 0)
    close(position.z, (4.2 / L) * L)
    close(position.y, 2.5 + (0.1 / L) * L)
    close(looked.z, -10)
    close(looked.y, 2.5)
  })

  it('third person: aiming pulls the camera closer and crouching lowers it (smoothing 0: at once)', () => {
    const rig = create(THREE, { storageKey: null, smoothing: 0 })
    rig.setMode('third')
    const { cam, position } = fakeCamera()
    rig.update(cam, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, aiming: true, crouching: true }, 0.016)
    close(position.z, 2.2)
    close(position.y, 1.9 + 0.1)
  })

  it('shoulder: offsets sideways, and flipSide mirrors it (smoothing 0: at once)', () => {
    const rig = create(THREE, { storageKey: null, smoothing: 0 })
    const { cam, position } = fakeCamera()
    rig.update(cam, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, 0.016)
    const right = position.x
    expect(Math.abs(right)).toBeCloseTo(0.9, 9)
    const mirror = create(THREE, { storageKey: null, smoothing: 0 })
    mirror.flipSide()
    const b = fakeCamera()
    mirror.update(b.cam, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, 0.016)
    close(b.position.x, -right)
  })

  it('shortens the boom at once when a wall is close and eases back out afterwards', () => {
    const rig = create(THREE, { storageKey: null })
    rig.setMode('third')
    const { cam, position } = fakeCamera()
    const target = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }
    const wall = () => 1.0
    rig.update(cam, target, 0.016, wall)
    // free = max(minDistance 0.2, 1.0 - wallClearance 0.3) = 0.7 along the (normalised) boom direction
    const dir = new THREE.Vector3(0, 0.1, 4.2).normalize()
    close(position.z, dir.z * 0.7)
    // wall gone: it does not snap back, it eases
    rig.update(cam, target, 0.016, null)
    const z1 = position.z
    expect(z1).toBeGreaterThan(dir.z * 0.7)
    expect(z1).toBeLessThan(4.2)
    for (let i = 0; i < 600; i++) rig.update(cam, target, 0.016, null)
    expect(position.z).toBeGreaterThan(4.19)
  })

  it('never goes closer than minDistance', () => {
    const rig = create(THREE, { storageKey: null })
    rig.setMode('third')
    const { cam, position } = fakeCamera()
    rig.update(cam, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, 0.016, () => 0)
    expect(Math.hypot(position.x, position.y - 2.5, position.z)).toBeGreaterThanOrEqual(0.2 - 1e-9)
  })

  it('clamps the camera height with the ceiling callback', () => {
    const rig = create(THREE, { storageKey: null })
    rig.setMode('third')
    const { cam, position } = fakeCamera()
    rig.update(cam, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, 0.016, null, () => 2.55)
    close(position.y, 2.55)
  })
})

describe('viewmodel()', () => {
  it('glues the group to the camera with the configured offset', () => {
    const rig = create(THREE, { storageKey: null })
    const { cam } = fakeCamera()
    cam.position.set(10, 5, -3)
    const group = new THREE.Group()
    rig.viewmodel(group, cam)
    close(group.position.x, 10.24)
    close(group.position.y, 5 - 0.24)
    close(group.position.z, -3 - 0.38)
    const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI - 0.16)
    expect(group.quaternion.angleTo(expected)).toBeLessThan(1e-9)
  })
})

describe('smoothing, zoom, death orbit and look', () => {
  const stand = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }

  it('eases the boom, the shoulder and the height towards what the target asks, and the first frame starts from standing', () => {
    const rig = create(THREE, { storageKey: null })
    const { cam, position } = fakeCamera()
    rig.update(cam, { ...stand, aiming: true, crouching: true }, 1 / 60)
    // one frame closes 1 - exp(-12/60) of the gap from (3.8, 0.9, 1.95) to (1.7, 0.9, 1.4)
    const k = 1 - Math.exp(-12 / 60)
    close(position.z, 3.8 + (1.7 - 3.8) * k)
    close(position.y, 1.95 + (1.4 - 1.95) * k + 0.1)
    for (let i = 0; i < 240; i++) rig.update(cam, { ...stand, aiming: true, crouching: true }, 1 / 60)
    close(position.z, 1.7, 1e-6)
    close(position.y, 1.4 + 0.1, 1e-6)
  })

  it('smoothing 0 jumps at once, as before the rig read it', () => {
    const rig = create(THREE, { storageKey: null, smoothing: 0 })
    const { cam, position } = fakeCamera()
    rig.update(cam, stand, 1 / 60)
    rig.update(cam, { ...stand, aiming: true }, 1 / 60)
    close(position.z, 1.7, 1e-9)
  })

  it('swapping shoulders eases the side across', () => {
    const rig = create(THREE, { storageKey: null })
    const { cam, position } = fakeCamera()
    rig.update(cam, stand, 1 / 60)
    const before = position.x
    rig.flipSide()
    rig.update(cam, stand, 1 / 60)
    expect(Math.sign(position.x)).toBe(Math.sign(before))
    expect(Math.abs(position.x)).toBeLessThan(Math.abs(before))
    for (let i = 0; i < 180; i++) rig.update(cam, stand, 1 / 60)
    expect(position.x).toBeCloseTo(-before, 3)
  })

  it('drives the field of view with the zoom: 65 / zoom while aiming, 65 otherwise, smoothed', () => {
    const rig = create(THREE, { storageKey: null })
    const cam = new THREE.PerspectiveCamera(65, 1, 0.1, 100)
    rig.update(cam as never, { ...stand, aiming: true, zoom: 4 }, 1 / 60)
    close(cam.fov, 65 + (65 / 4 - 65) * Math.min(1, 12 / 60))
    for (let i = 0; i < 240; i++) rig.update(cam as never, { ...stand, aiming: true, zoom: 4 }, 1 / 60)
    expect(Math.abs(cam.fov - 16.25)).toBeLessThan(0.1)
    for (let i = 0; i < 240; i++) rig.update(cam as never, { ...stand, aiming: false, zoom: 4 }, 1 / 60)
    expect(Math.abs(cam.fov - 65)).toBeLessThan(0.1)
    // a camera without fov, or a target without zoom, is left alone
    const fixed = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    rig.update(fixed as never, stand, 1 / 60)
    expect(fixed.fov).toBe(50)
  })

  it('circles the body once it is dead: radius 6, height 3.5, 0.2 rad per second of deathT', () => {
    const rig = create(THREE, { storageKey: null })
    const { cam, position, looked } = fakeCamera()
    rig.update(cam, { ...stand, x: 10, z: -4, alive: false, deathT: 5 }, 1 / 60)
    close(position.x, 10 + Math.sin(1) * 6)
    close(position.y, 3.5)
    close(position.z, -4 + Math.cos(1) * 6)
    close(looked.x, 10)
    close(looked.y, 1)
    close(looked.z, -4)
  })

  it('the look: sensitivity 0.0022, slower aiming by the square root of the zoom, pitch kept in range', () => {
    const rig = create(THREE, { storageKey: null })
    close(rig.lookSensitivity(), 0.0022)
    close(rig.lookSensitivity(4, true), 0.0022 / 2)
    close(rig.lookSensitivity(4, false), 0.0022)
    const state = { yaw: 0, pitch: 0 }
    rig.look(state, { dx: 100, dy: 10000 })
    close(state.yaw, -0.22)
    expect(state.pitch).toBe(1.2)
    rig.look(state, { dx: 0, dy: -100000 })
    expect(state.pitch).toBe(-0.55)
  })

  it('fever sways the look and panic jitters it with the host\'s random numbers only', () => {
    const rig = create(THREE, { storageKey: null })
    const fever = rig.lookShake({ time: 2, fever: true })
    close(fever.yaw, Math.sin(2 * 1.3) * 0.0015)
    close(fever.pitch, Math.cos(2 * 1.7) * 0.001)
    expect(rig.lookShake({ time: 2, panic: true })).toEqual({ yaw: 0, pitch: 0 })
    close(rig.lookShake({ panic: true, random: () => 0.75 }).yaw, 0.25 * 0.002)
    const calls: number[] = []
    const original = Math.random
    Math.random = () => {
      calls.push(1)
      return 0.5
    }
    try {
      rig.look({ yaw: 0, pitch: 0 }, { dx: 1, dy: 1, panic: true, fever: true, time: 1 })
    } finally {
      Math.random = original
    }
    expect(calls).toHaveLength(0)
  })

  it('the numbers are options: a game changes the orbit, the aim and the wall recovery', () => {
    const rig = create(THREE, { storageKey: null, deathOrbit: { radius: 10, height: 5 }, aim: { sensitivity: 0.001 }, wallRecovery: 1 })
    expect(rig.config.deathOrbit).toEqual({ radius: 10, height: 5, speed: 0.2, lookHeight: 1 })
    close(rig.lookSensitivity(), 0.001)
    expect(rig.config.wallRecovery).toBe(1)
  })
})
