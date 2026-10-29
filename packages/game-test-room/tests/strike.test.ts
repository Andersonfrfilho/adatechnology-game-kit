import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { HandTargets } from '@adatechnology/game-contracts'
import type { RoomAvatar, RoomFirstPersonState } from '../src'
import { DEFAULT_STRIKE_CLIPS } from '../src'
import { makeRoom } from './helpers'

type Fake = RoomAvatar & {
  struck: string[]
  legs: Array<'left' | 'right' | undefined>
  states: RoomFirstPersonState[]
  armsRoot: THREE.Group
  /** Seconds to impact per clip; a clip not here cannot be played. */
  impacts: Record<string, number>
}

const fakeAvatar = (impacts: Record<string, number> = { punch_right: 0.16, shove_two_hands: 0.26, front_kick: 0.32 }): Fake => {
  const armsRoot = new THREE.Group()
  const struck: string[] = []
  const legs: Array<'left' | 'right' | undefined> = []
  const states: RoomFirstPersonState[] = []
  return {
    root: new THREE.Group(),
    armsRoot,
    struck,
    legs,
    states,
    impacts,
    update: () => undefined,
    firstPerson: { root: armsRoot, update: (_dt, state) => void states.push({ ...state }) },
    strike: (clip, options) => {
      if (!(clip in impacts)) return null
      struck.push(clip)
      legs.push(options?.leg)
      return impacts[clip]!
    },
  }
}

const run = (room: ReturnType<typeof makeRoom>, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) room.update(1 / 60)
}
type Room = ReturnType<typeof makeRoom>
type Vec = [number, number, number]
const views = new WeakMap<Room, [Vec, Vec]>()
/** Looks from `eye` to `target`; `wait` keeps the player there (a player at knee height would otherwise fall to its eyes). */
const aimAt = (room: Room, eye: Vec, target: Vec): void => {
  views.set(room, [eye, target])
  room.look(eye, target)
}
const wait = (room: Room, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const view = views.get(room)
    if (view) room.look(view[0], view[1])
    room.update(1 / 60)
  }
}
const setup = (avatar: RoomAvatar | null = fakeAvatar()) => {
  const room = makeRoom()
  if (avatar) room.setAvatar(avatar)
  room.spawn('chair', [0, 0, -4], 0)
  room.update(0.4)
  aimAt(room, [-0.6, 0.2, -4.18], [0.22, 0.2, -4.18])
  return room
}

describe('strikes wait for the impact of the clip', () => {
  it('a punch with fists starts the clip at the click and lands the blow at the impact, not before', () => {
    const avatar = fakeAvatar()
    const room = setup(avatar)
    room.setTool('fists')
    wait(room, 0.5)
    room.use()
    expect(avatar.struck).toEqual(['punch_right'])
    expect(room.log.entries({ type: 'strike' })).toHaveLength(1)
    expect(room.log.entries({ type: 'strike' })[0]!.data).toMatchObject({ weapon: 'fists', clip: 'punch_right', impactIn: 0.16 })
    expect(room.log.entries({ type: 'melee' })).toHaveLength(0)
    wait(room, 0.1)
    expect(room.log.entries({ type: 'melee' })).toHaveLength(0)
    wait(room, 0.1)
    const hits = room.log.entries({ type: 'melee' })
    expect(hits).toHaveLength(1)
    expect(hits[0]!.data).toMatchObject({ weapon: 'fists', damage: 'blunt' })
  })

  it('the shove tool and the kick shortcut take their own clips', () => {
    const avatar = fakeAvatar()
    const room = setup(avatar)
    room.setTool('shove')
    wait(room, 0.5)
    room.use()
    wait(room, 0.5)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', shiftKey: true }))
    expect(avatar.struck).toEqual(['shove_two_hands', 'front_kick'])
    expect(room.log.entries({ type: 'melee' })).toHaveLength(1) // the shove landed; the kick is on its way
    wait(room, 0.4)
    expect(room.log.entries({ type: 'melee' }).map((entry) => entry.data?.weapon)).toEqual(['shove', 'kick'])
  })

  const kicks = (kickLeg?: 'alternate' | 'left' | 'right', count = 3) => {
    const avatar = fakeAvatar()
    const room = makeRoom(kickLeg ? { kickLeg } : {})
    room.setAvatar(avatar)
    for (let i = 0; i < count; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', shiftKey: true }))
      run(room, 2)
    }
    return { avatar, room }
  }

  it('kicks alternate legs by default, starting with the right, and log the leg', () => {
    const { avatar, room } = kicks()
    expect(avatar.legs).toEqual(['right', 'left', 'right'])
    const entries = room.log.entries({ type: 'strike' })
    expect(entries.map((entry) => entry.data?.leg)).toEqual(['right', 'left', 'right'])
    expect(entries.map((entry) => entry.data?.impactIn)).toEqual([0.32, 0.32, 0.32])
  })

  it('kickLeg left or right keeps one leg; other strikes carry no leg', () => {
    expect(kicks('left', 2).avatar.legs).toEqual(['left', 'left'])
    expect(kicks('right', 2).avatar.legs).toEqual(['right', 'right'])
    const avatar = fakeAvatar()
    const room = setup(avatar)
    room.setTool('shove')
    wait(room, 0.5)
    room.use()
    expect(avatar.legs).toEqual([undefined])
  })

  it('the aim is read again at the impact: a target turned to meanwhile is the one hit', () => {
    const room = setup()
    room.spawn('chair', [4, 0, -4], 0)
    room.setTool('fists')
    wait(room, 0.5)
    room.use()
    wait(room, 0.05)
    aimAt(room, [3.4, 0.2, -4.18], [4.22, 0.2, -4.18])
    wait(room, 0.2)
    const hit = room.log.entries({ type: 'melee' })[0]!
    expect(hit.objectId).toBe(room.spawned()[1]!.objectId)
  })

  it('while a blow is on its way the same tool starts no other', () => {
    const avatar = fakeAvatar({ punch_right: 3 }) // longer than the cooldown of the fists
    const room = setup(avatar)
    room.setTool('fists')
    wait(room, 0.5)
    room.use()
    wait(room, 1)
    room.use()
    expect(avatar.struck).toEqual(['punch_right'])
    wait(room, 2.5)
    expect(room.log.entries({ type: 'melee' })).toHaveLength(1)
    room.use()
    expect(avatar.struck).toHaveLength(2)
  })

  it('a tool without a clip, an avatar that cannot play it, or no avatar strike at the click', () => {
    const room = setup()
    room.setTool('hammer')
    wait(room, 0.5)
    room.use()
    expect(room.log.entries({ type: 'melee' })).toHaveLength(1)
    expect(room.log.entries({ type: 'strike' })).toHaveLength(0)

    const mute = setup(fakeAvatar({}))
    mute.setTool('fists')
    wait(mute, 0.5)
    mute.use()
    expect(mute.log.entries({ type: 'melee' })).toHaveLength(1)

    const bare = setup(null)
    bare.setTool('fists')
    wait(bare, 0.5)
    bare.use()
    expect(bare.log.entries({ type: 'melee' })).toHaveLength(1)
  })

  it('the clips of the tools are an option', () => {
    const avatar = fakeAvatar({ jab: 0.1 })
    const room = makeRoom({ strikeClips: { fists: 'jab' } })
    room.setAvatar(avatar)
    room.spawn('chair', [0, 0, -4], 0)
    room.update(0.4)
    aimAt(room, [-0.6, 0.2, -4.18], [0.22, 0.2, -4.18])
    room.setTool('fists')
    wait(room, 0.5)
    room.use()
    expect(avatar.struck).toEqual(['jab'])
    expect(DEFAULT_STRIKE_CLIPS).toEqual({ fists: 'punch_right', hand: 'punch_right', shove: 'shove_two_hands', kick: 'front_kick' })
  })

  it('a strike does not advance while the room is paused, and a reset forgets it', () => {
    const room = setup()
    room.setTool('fists')
    wait(room, 0.5)
    room.use()
    room.pause()
    wait(room, 1)
    expect(room.log.entries({ type: 'melee' })).toHaveLength(0)
    room.resume()
    wait(room, 0.3)
    expect(room.log.entries({ type: 'melee' })).toHaveLength(1)
  })
})

describe('first-person arms in the room', () => {
  it('shows the arms only in first person and the body only in third', () => {
    const avatar = fakeAvatar()
    const room = makeRoom()
    room.setAvatar(avatar)
    expect(room.scene.children).toContain(avatar.armsRoot)
    expect(avatar.armsRoot.visible).toBe(true)
    expect(avatar.root.visible).toBe(false)
    room.setCameraMode('third')
    expect(avatar.armsRoot.visible).toBe(false)
    expect(avatar.root.visible).toBe(true)
    room.setAvatar(null)
    expect(room.scene.children).not.toContain(avatar.armsRoot)
  })

  it('updates the arms every frame with the camera, the speed and a stance from the tool', () => {
    const avatar = fakeAvatar()
    const room = makeRoom()
    room.setAvatar(avatar)
    room.update(1 / 60)
    const last = () => avatar.states.at(-1)!
    expect(last().camera).toBe(room.camera)
    expect(last()).toMatchObject({ targets: null, stance: 'relaxed', crouch: false })
    room.setTool('fists')
    room.update(1 / 60)
    expect(last().stance).toBe('fists')
    room.setTool('hand')
    room.update(1 / 60)
    expect(last().stance).toBe('relaxed')
  })

  it('crouches while C is held: the eye sinks, the body is told, and it stands up again', () => {
    const avatar = fakeAvatar()
    const room = makeRoom()
    room.setAvatar(avatar)
    room.look([0, 1.7, 0], [0, 1.7, -5])
    for (let i = 0; i < 30; i++) room.update(1 / 60)
    const standing = room.camera.position.y
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' }))
    for (let i = 0; i < 60; i++) room.update(1 / 60)
    expect(room.camera.position.y).toBeLessThan(standing - 0.4)
    expect(avatar.states.at(-1)!.crouch).toBe(true)
    expect(room.avatarState().crouch).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC' }))
    for (let i = 0; i < 60; i++) room.update(1 / 60)
    expect(room.camera.position.y).toBeCloseTo(standing, 2)
    expect(avatar.states.at(-1)!.crouch).toBe(false)

    // Keys pressed while holding Ctrl prevent default browser shortcuts
    const ev = new KeyboardEvent('keydown', { code: 'KeyS', ctrlKey: true, cancelable: true })
    window.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }))
  })

  it('does not crouch on Ctrl alone by default', () => {
    const room = makeRoom()
    room.look([0, 1.7, 0], [0, 1.7, -5])
    for (let i = 0; i < 30; i++) room.update(1 / 60)
    const standing = room.camera.position.y
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ControlLeft' }))
    for (let i = 0; i < 60; i++) room.update(1 / 60)
    expect(room.camera.position.y).toBeCloseTo(standing, 2)
    expect(room.avatarState().crouch).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ControlLeft' }))
  })

  it('crouches on Ctrl when the room is given crouch keys', () => {
    const room = makeRoom({ crouch: { keys: ['ControlLeft'] } })
    room.look([0, 1.7, 0], [0, 1.7, -5])
    for (let i = 0; i < 30; i++) room.update(1 / 60)
    const standing = room.camera.position.y
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ControlLeft' }))
    for (let i = 0; i < 60; i++) room.update(1 / 60)
    expect(room.camera.position.y).toBeLessThan(standing - 0.4)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ControlLeft' }))
  })

  it('asks before the page unloads only while Ctrl is held', () => {
    makeRoom()
    const idle = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(idle)
    expect(idle.defaultPrevented).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ControlLeft' }))
    const held = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(held)
    expect(held.defaultPrevented).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ControlLeft' }))
  })

  it('reads the targets of the module after its frame hooks ran, so the weapon is placed first', () => {
    const avatar = fakeAvatar()
    const room = makeRoom()
    room.setAvatar(avatar)
    const order: string[] = []
    const targets: HandTargets = { R: { position: [0, 1, -1], quaternion: [0, 0, 0, 1] }, grip: 0.8 }
    let off: (() => void) | undefined
    room.loadModule({
      id: 'holder',
      name: 'Holder',
      group: 'Test',
      items: () => [],
      attach: (host) => {
        const offFrame = host.onFrame(() => order.push('module frame'))
        off = host.setHandTargets?.(() => {
          order.push('targets read')
          return targets
        })
        return () => {
          offFrame()
          off?.()
        }
      },
    })
    room.setTool('pistol_9mm')
    order.length = 0
    room.update(1 / 60)
    expect(order.indexOf('module frame')).toBeGreaterThanOrEqual(0)
    expect(order.indexOf('targets read')).toBeGreaterThan(order.indexOf('module frame'))
    expect(avatar.states.at(-1)).toMatchObject({ stance: 'hold', targets })
    off?.()
    room.update(1 / 60)
    expect(avatar.states.at(-1)!.targets).toBeNull()
  })

  it('says how far the trigger finger is curled (the index of the hand targets) in the state of the arms and in `handState`, and a debug camera leaves the player\'s own view alone', () => {
    const avatar = fakeAvatar()
    const room = makeRoom()
    room.setAvatar(avatar)
    let curl: number | undefined = 0
    const loaded = room.loadModule({
      id: 'holder',
      name: 'Holder',
      group: 'Test',
      items: () => [],
      attach: (host) => host.setHandTargets?.(() => ({ R: { position: [0, 1, -1], quaternion: [0, 0, 0, 1] }, grip: 0.8, ...(curl === undefined ? {} : { fingers: { index: curl } }) })) ?? (() => undefined),
    })
    expect(loaded.problems).toEqual([])
    room.setTool('pistol_9mm')
    room.update(1 / 60)
    expect(avatar.states.at(-1)!.triggerFinger).toBe(0)
    expect(room.handState()).toMatchObject({ stance: 'hold', triggerFinger: 0 })
    curl = 0.8
    room.update(1 / 60)
    expect(avatar.states.at(-1)!.triggerFinger).toBe(0.8)
    expect(room.handState().triggerFinger).toBe(0.8)
    curl = undefined
    room.update(1 / 60)
    expect(room.handState().triggerFinger).toBeNull()
    const eye = room.camera.position.clone()
    room.setDebugCamera({ position: [3, 2, 3], target: [0, 1, 0], fov: 30 })
    room.update(1 / 60)
    expect(room.camera.position.distanceTo(eye)).toBeLessThan(1e-6)
    expect(avatar.states.at(-1)!.camera).toBe(room.camera)
    room.setDebugCamera(null)
  })

  it('a carried item gives a hand under it, and none in third person', () => {
    const avatar = fakeAvatar()
    const room = makeRoom()
    room.setAvatar(avatar)
    room.look([0, 1.7, 0], [0, 0.05, -1.5])
    room.spawn('coffee_cup', [0, 0, -1.5], 0)
    expect(room.grab()).toBe(true)
    run(room, 1)
    const targets = avatar.states.at(-1)!.targets!
    expect(avatar.states.at(-1)!.stance).toBe('hold')
    const piece = room.spawned()[0]!.root
    const box = new THREE.Box3().setFromObject(piece)
    expect(targets.R!.position[1]).toBeLessThan(box.min.y + 0.001)
    expect(targets.R!.position[1]).toBeGreaterThan(box.min.y - 0.05)
    expect(targets.grip).toBeGreaterThan(0)
    room.setCameraMode('third')
    run(room, 0.2)
    expect(avatar.states.at(-1)!.targets).toBeNull()
  })

  it('grips a bottle around its cylindrical side and follows the drink action in 1st and 3rd person', () => {
    const avatar = fakeAvatar()
    const room = makeRoom()
    room.setAvatar(avatar)
    room.look([0, 1.7, 0], [0, 0.1, -1.5])
    room.spawn('glass_bottle', [0, 0, -1.5], 0)
    expect(room.grab()).toBe(true)
    run(room, 0.8)
    const restTargets = avatar.states.at(-1)!.targets!
    const bottle = room.spawned()[0]!.root
    const box = new THREE.Box3().setFromObject(bottle)
    // Side grip sits alongside the bottle body (between min.y and max.y) with a closed cylinder grip
    expect(restTargets.R!.position[1]).toBeGreaterThan(box.min.y)
    expect(restTargets.R!.position[1]).toBeLessThan(box.max.y)
    expect(restTargets.grip).toBeCloseTo(0.85, 2)

    expect(room.useItem('drink')).toBe(true)
    run(room, 1.0)
    const drinkTargets = avatar.states.at(-1)!.targets!
    expect(drinkTargets.R!.position[1]).toBeGreaterThan(restTargets.R!.position[1] + 0.08)
  })
})

describe('the arms can probe the room', () => {
  it('gives the first-person arms a contact probe that sees the chair ahead and nothing behind', () => {
    const avatar = fakeAvatar()
    const room = setup(avatar)
    wait(room, 0.2)
    const probe = avatar.states.at(-1)!.contact
    const toward = probe([-0.6, 0.2, -4.18], [1, 0, 0], 3)
    expect(toward).not.toBeNull()
    expect(toward!).toBeGreaterThan(0.1)
    expect(toward!).toBeLessThan(1.2)
    expect(probe([-0.6, 0.2, -4.18], [-1, 0, 0], 3)).toBeNull()
  })
})
