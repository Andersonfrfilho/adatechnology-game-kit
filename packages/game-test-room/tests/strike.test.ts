import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { HandTargets } from '@adatechnology/game-contracts'
import type { RoomAvatar, RoomReachView } from '../src'
import { DEFAULT_STRIKE_CLIPS } from '../src'
import { makeRoom, stubRenderer } from './helpers'

type Fake = RoomAvatar & {
  struck: string[]
  legs: Array<'left' | 'right' | undefined>
  hands: Array<'left' | 'right' | undefined>
  /** Every `reach` the room made: the hand targets and the first-person view. */
  reaches: Array<{ targets: HandTargets | null; view: RoomReachView | undefined }>
  views: Array<[string, THREE.Object3D | null]>
  /** The right hand the carried item rides. */
  handR: THREE.Object3D
  /** Seconds to impact per clip; a clip not here cannot be played. */
  impacts: Record<string, number>
}

/** `eyes`: where the body's eyes are, relative to its root (the feet); without them the room keeps the player's own eye and shows the body only in third person. */
const fakeAvatar = (impacts: Record<string, number> = { punch_right: 0.16, shove_two_hands: 0.26, front_kick: 0.32 }, eyes?: [number, number, number]): Fake => {
  const root = new THREE.Group()
  const handR = new THREE.Object3D()
  handR.position.set(-0.3, 1.0, 0.3)
  root.add(handR)
  const struck: string[] = []
  const legs: Array<'left' | 'right' | undefined> = []
  const hands: Array<'left' | 'right' | undefined> = []
  const reaches: Fake['reaches'] = []
  const views: Fake['views'] = []
  return {
    root,
    handR,
    struck,
    legs,
    hands,
    reaches,
    views,
    impacts,
    update: () => undefined,
    hand: () => handR,
    reach: (targets, view) => void reaches.push({ targets, view }),
    setView: (mode, camera) => void views.push([mode, camera]),
    ...(eyes ? { eye: (out = new THREE.Vector3()) => root.localToWorld(out.set(eyes[0], eyes[1], eyes[2])) } : {}),
    strike: (clip, options) => {
      if (!(clip in impacts)) return null
      struck.push(clip)
      legs.push(options?.leg)
      hands.push(options?.hand)
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

  it('bare hands punch at the click: the mouse pressed and let go between two frames plays the clip and lands the blow', () => {
    const avatar = fakeAvatar()
    const renderer = stubRenderer()
    const room = makeRoom({ renderer })
    room.setAvatar(avatar)
    room.spawn('chair', [0, 0, -4], 0)
    room.update(0.4)
    aimAt(room, [-0.6, 0.2, -4.18], [0.22, 0.2, -4.18])
    expect(room.tool.def.id).toBe('hand')
    wait(room, 0.5)
    const dom = renderer.domElement
    dom.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }))
    wait(room, 1 / 60)
    expect(avatar.struck).toEqual(['punch_right'])
    expect(room.log.entries({ type: 'strike' })[0]!.data).toMatchObject({ weapon: 'hand', clip: 'punch_right', impactIn: 0.16 })
    expect(room.log.entries({ type: 'grab' })).toHaveLength(0)
    wait(room, 0.3)
    expect(room.log.entries({ type: 'melee' }).map((entry) => entry.data?.weapon)).toEqual(['hand'])
  })

  it('bare hands: room.use() punches as the click does, and with something held it lets it go instead', () => {
    const avatar = fakeAvatar()
    const room = setup(avatar)
    wait(room, 0.5)
    room.use()
    expect(avatar.struck).toEqual(['punch_right'])
    wait(room, 0.5)
    room.spawn('coffee_cup', [0, 0, -3], 0)
    aimAt(room, [0, 1.0, -1.8], [0, 0.05, -3])
    expect(room.grab()).toBe(true)
    room.use()
    expect(avatar.struck).toEqual(['punch_right'])
    expect(room.log.entries({ type: 'drop' })).toHaveLength(1)
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

  it('K kicks with any tool in hand, as Shift+V and room.kick() do, and the kick waits for its own cooldown', () => {
    const avatar = fakeAvatar()
    const room = setup(avatar)
    room.setTool('fists')
    wait(room, 0.5)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK' }))
    expect(avatar.struck).toEqual(['front_kick'])
    expect(room.tool.def.id).toBe('fists')
    expect(room.kick()).toBe(false) // the first one is still on its way
    wait(room, 1.2)
    expect(room.log.entries({ type: 'melee' }).map((entry) => entry.data?.weapon)).toEqual(['kick'])
    expect(room.kick()).toBe(true)
    expect(avatar.struck).toEqual(['front_kick', 'front_kick'])
  })

  it('the kick lands from the foot: it finds a chair low in front while the eye looks over it', () => {
    const room = makeRoom()
    room.setAvatar(fakeAvatar())
    room.spawn('chair', [0, 0, -4], 0)
    room.update(0.4)
    aimAt(room, [0, 1.7, -3.15], [0, 2.4, -6])
    wait(room, 0.5)
    room.kick()
    wait(room, 0.6)
    const hits = room.log.entries({ type: 'melee' })
    expect(hits).toHaveLength(1)
    expect(hits[0]!.objectId).toBe(room.spawned()[0]!.objectId)
    expect(hits[0]!.data?.energyJ).toBe(250)
    // a punch from the same place goes over it
    room.setTool('fists')
    wait(room, 0.5)
    room.use()
    wait(room, 0.5)
    expect(room.log.entries({ type: 'melee' })[1]!.objectId).toBeUndefined()
  })

  it('the kick keys are an option', () => {
    const avatar = fakeAvatar()
    const room = makeRoom({ kick: { keys: ['KeyJ'] } })
    room.setAvatar(avatar)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK' }))
    expect(avatar.struck).toEqual([])
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }))
    expect(avatar.struck).toEqual(['front_kick'])
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

  const punches = (extra: Parameters<typeof makeRoom>[0] = {}, tool = 'fists', count = 3) => {
    const avatar = fakeAvatar()
    const room = makeRoom(extra)
    room.setAvatar(avatar)
    room.setTool(tool)
    run(room, 0.5)
    for (let i = 0; i < count; i++) {
      room.use()
      run(room, 0.6)
    }
    return { avatar, room }
  }

  it('punches alternate hands by default, starting with the right, with fists and bare hands, and log the hand', () => {
    for (const tool of ['fists', 'hand']) {
      const { avatar, room } = punches({}, tool)
      expect(avatar.struck).toEqual(['punch_right', 'punch_right', 'punch_right'])
      expect(avatar.hands).toEqual(['right', 'left', 'right'])
      const entries = room.log.entries({ type: 'strike' })
      expect(entries.map((entry) => entry.data?.hand)).toEqual(['right', 'left', 'right'])
      expect(entries[1]!.text).toContain('left hand')
    }
  })

  it('punchHand left or right keeps one hand; punchTools says which tools punch with one hand; the shove and the kick carry no hand', () => {
    expect(punches({ punchHand: 'left' }, 'fists', 2).avatar.hands).toEqual(['left', 'left'])
    expect(punches({ punchHand: 'right' }, 'fists', 2).avatar.hands).toEqual(['right', 'right'])
    expect(punches({ punchTools: ['hand'] }, 'fists', 2).avatar.hands).toEqual([undefined, undefined])
    expect(punches({}, 'shove', 1).avatar.hands).toEqual([undefined])
    const { avatar } = kicks(undefined, 1)
    expect(avatar.hands).toEqual([undefined])
  })

  const COMBO = {
    id: 'punch_combo',
    name: { en: 'Punch combo' },
    tools: ['hand', 'fists'],
    steps: [
      { clip: 'jab', hand: 'left' as const },
      { clip: 'punch_right', hand: 'right' as const },
      { clip: 'hook', hand: 'left' as const },
      { clip: 'uppercut', hand: 'right' as const },
    ],
    reset: 1,
  }
  const comboAvatar = () => fakeAvatar({ punch_right: 0.16, jab: 0.12, hook: 0.2, uppercut: 0.2, shove_two_hands: 0.26, front_kick: 0.32 })

  it('with the combo on, each punch is the next step (jab, cross, hook, uppercut with their hands) and it goes round', () => {
    const avatar = comboAvatar()
    const room = makeRoom({ strikeCombo: COMBO })
    room.setAvatar(avatar)
    expect(room.strikeCombo).toBe(false)
    room.setStrikeCombo(true)
    expect(room.strikeCombo).toBe(true)
    room.setTool('fists')
    run(room, 0.5)
    // fists throw at most 120 a minute: a punch every 0.55 s, well inside the reset
    for (let i = 0; i < 5; i++) {
      room.use()
      run(room, 0.55)
    }
    expect(avatar.struck).toEqual(['jab', 'punch_right', 'hook', 'uppercut', 'jab'])
    expect(avatar.hands).toEqual(['left', 'right', 'left', 'right', 'left'])
    const entries = room.log.entries({ type: 'strike' })
    expect(entries.map((entry) => entry.data?.step)).toEqual([0, 1, 2, 3, 0])
    expect(entries[0]!.data).toMatchObject({ combo: 'punch_combo', clip: 'jab', hand: 'left', impactIn: 0.12 })
    expect(room.log.entries({ type: 'melee' })).toHaveLength(5)
    expect(room.log.entries({ type: 'combo' })[0]!.data).toEqual({ combo: 'punch_combo', on: true })
  })

  it('a pause longer than the reset starts the combo over; off, a punch is the usual one; N toggles it; the shove and the kick are not in it', () => {
    const avatar = comboAvatar()
    const room = makeRoom({ strikeCombo: COMBO, strikeComboOn: true })
    room.setAvatar(avatar)
    room.setTool('hand')
    run(room, 0.5)
    room.use()
    run(room, 0.4)
    room.use()
    run(room, 1.5)
    room.use()
    expect(avatar.struck).toEqual(['jab', 'punch_right', 'jab'])
    run(room, 0.5)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN' }))
    expect(room.strikeCombo).toBe(false)
    room.use()
    run(room, 0.5)
    expect(avatar.struck.at(-1)).toBe('punch_right')
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN' }))
    expect(room.strikeCombo).toBe(true)
    room.setTool('shove')
    run(room, 0.5)
    room.use()
    expect(avatar.struck.at(-1)).toBe('shove_two_hands')
    expect(avatar.hands.at(-1)).toBeUndefined()
  })

  it('without a combo the room has none to turn on', () => {
    const room = makeRoom()
    expect(room.strikeCombo).toBeNull()
    room.setStrikeCombo(true)
    expect(room.strikeCombo).toBeNull()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN' }))
    expect(room.log.entries({ type: 'combo' })).toHaveLength(0)
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

describe('one body in both views', () => {
  it('draws a body that has eyes in both views and tells it the view; one without eyes only in third person', () => {
    const avatar = fakeAvatar(undefined, [0, 1.7, 0.2])
    const room = makeRoom()
    room.setAvatar(avatar)
    expect(avatar.root.visible).toBe(true)
    expect(avatar.views.at(-1)).toEqual(['first', room.camera])
    room.setCameraMode('third')
    expect(avatar.root.visible).toBe(true)
    expect(avatar.views.at(-1)).toEqual(['third', room.camera])
    const blind = fakeAvatar()
    room.setAvatar(blind)
    room.setCameraMode('first')
    expect(blind.root.visible).toBe(false)
    room.setCameraMode('third')
    expect(blind.root.visible).toBe(true)
  })

  it('puts the camera at the body\'s eyes, in front of the player, in both views', () => {
    const avatar = fakeAvatar(undefined, [0, 1.6, 0.2])
    const room = makeRoom({ scenery: { table: null, shelf: null } })
    room.setAvatar(avatar)
    room.look([0, 1.7, 3], [0, 1.7, -5])
    room.update(1 / 60)
    // a scripted view stays exactly where it was asked until the player moves
    expect(room.camera.position.y).toBeCloseTo(1.7, 5)
    expect(room.camera.position.z).toBeCloseTo(3, 5)
    room.walk([0, 0, 2.8], 0.2)
    for (let i = 0; i < 30; i++) room.update(1 / 60)
    // the body's front is +z, turned to where the player looks (-z): the eyes are 0.2 m toward -z
    const z = room.playerPosition[2]
    expect(room.camera.position.y).toBeCloseTo(1.6, 5)
    expect(room.camera.position.z).toBeCloseTo(z - 0.2, 5)
    room.setCameraMode('third')
    room.update(1 / 60)
    expect(room.camera.position.z).toBeCloseTo(z - 0.2, 5)
  })

  it('pulls the eyes back toward the player out of a wall between them', () => {
    const avatar = fakeAvatar(undefined, [0, 1.6, 0.6])
    const room = makeRoom({ scenery: { table: null, shelf: null } })
    room.setAvatar(avatar)
    // walk into the target wall until it stops the body: the eyes 0.6 m ahead would be inside it
    room.look([0, 1.7, -8], [0, 1.7, -20])
    room.walk([0, 0, -12], 1.5)
    for (let i = 0; i < 120; i++) room.update(1 / 60)
    const z = room.playerPosition[2]
    const face = z - room.world.raycast([0, 1.6, z], [0, 0, -1], 3)!.distance
    expect(z - face).toBeLessThan(0.6)
    expect(room.camera.position.z).toBeCloseTo(face + 0.1, 3)
    expect(room.camera.position.z).toBeLessThan(z)
  })

  it.each(['first', 'third'] as const)('a shot leaves the body\'s eyes, not the player\'s middle, in %s person', (mode) => {
    const avatar = fakeAvatar(undefined, [0, 1.1, 0.5])
    const room = makeRoom({ scenery: { table: null, shelf: null } })
    room.setAvatar(avatar)
    room.spawn('steel_sheet', [0, 0, -4], 0)
    room.setTool('pistol_9mm')
    room.setCameraMode(mode)
    room.update(0.4)
    room.look([0, 1.1, -1.5], [0, 1.1, -4])
    room.walk([0, 0, -1.4], 0.2)
    run(room, 1)
    const eye = avatar.eye!()
    const middle = room.playerPosition[2]
    expect(eye.z).toBeCloseTo(middle - 0.5, 5)
    room.use()
    const hit = room.log.entries({ type: 'shoot' })[0]!.data as { distanceM: number }
    const fromEye = room.world.raycast([eye.x, eye.y, eye.z], [0, 0, -1], 20)!.distance
    expect(hit.distanceM).toBeCloseTo(fromEye, 1)
  })

  it('tells the stance of the hands from the tool in handState', () => {
    const avatar = fakeAvatar()
    const room = makeRoom()
    room.setAvatar(avatar)
    room.update(1 / 60)
    expect(room.handState()).toMatchObject({ targets: null, stance: 'relaxed' })
    room.setTool('fists')
    room.update(1 / 60)
    expect(room.handState().stance).toBe('fists')
    room.setTool('hand')
    room.update(1 / 60)
    expect(room.handState().stance).toBe('relaxed')
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
    expect(room.avatarState().crouch).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC' }))
    for (let i = 0; i < 60; i++) room.update(1 / 60)
    expect(room.camera.position.y).toBeCloseTo(standing, 2)
    expect(room.avatarState().crouch).toBe(false)

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

  it('reads the targets of the module after its frame hooks ran, so the weapon is placed first, and the body reaches them in both views', () => {
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
    expect(avatar.reaches.at(-1)!.targets).toBe(targets)
    expect(avatar.reaches.at(-1)!.view?.camera).toBe(room.camera)
    expect(room.handState()).toMatchObject({ stance: 'hold', targets })
    room.setCameraMode('third')
    room.update(1 / 60)
    expect(avatar.reaches.at(-1)!.targets).toBe(targets)
    expect(avatar.reaches.at(-1)!.view?.camera).toBe(room.camera)
    off?.()
    room.update(1 / 60)
    expect(avatar.reaches.at(-1)!.targets).toBeNull()
  })

  it('says how far the trigger finger is curled (the index of the hand targets) in `handState`, and a debug camera leaves the player\'s own view alone', () => {
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
    expect(room.handState()).toMatchObject({ stance: 'hold', triggerFinger: 0 })
    curl = 0.8
    room.update(1 / 60)
    expect(room.handState().triggerFinger).toBe(0.8)
    curl = undefined
    room.update(1 / 60)
    expect(room.handState().triggerFinger).toBeNull()
    const eye = room.camera.position.clone()
    room.setDebugCamera({ position: [3, 2, 3], target: [0, 1, 0], fov: 30 })
    room.update(1 / 60)
    expect(room.camera.position.distanceTo(eye)).toBeLessThan(1e-6)
    expect(avatar.reaches.at(-1)!.view?.camera).toBe(room.camera)
    room.setDebugCamera(null)
  })

  it('a carried item rides the body\'s right hand in both views, and the body is told while it drinks', () => {
    const avatar = fakeAvatar()
    const room = makeRoom()
    room.setAvatar(avatar)
    room.look([0, 1.7, 0], [0, 0.1, -1.5])
    room.spawn('glass_bottle', [0, 0, -1.5], 0)
    expect(room.grab()).toBe(true)
    for (const mode of ['first', 'third'] as const) {
      room.setCameraMode(mode)
      run(room, 0.8)
      const bottle = new THREE.Box3().setFromObject(room.spawned()[0]!.root)
      const hand = avatar.handR.getWorldPosition(new THREE.Vector3())
      expect(bottle.distanceToPoint(hand)).toBeLessThan(0.12)
      expect(avatar.reaches.at(-1)!.targets).toBeNull()
    }
    expect(room.useItem('drink')).toBe(true)
    run(room, 0.3)
    expect(room.avatarState().itemUse?.id).toBe('drink')
  })
})

describe('the hands can probe the room', () => {
  it('gives the body\'s first-person reach a contact probe that sees the chair ahead and nothing behind', () => {
    const avatar = fakeAvatar()
    const room = setup(avatar)
    wait(room, 0.2)
    const probe = avatar.reaches.at(-1)!.view!.keepOutside!.contact
    const toward = probe([-0.6, 0.2, -4.18], [1, 0, 0], 3)
    expect(toward).not.toBeNull()
    expect(toward!).toBeGreaterThan(0.1)
    expect(toward!).toBeLessThan(1.2)
    expect(probe([-0.6, 0.2, -4.18], [-1, 0, 0], 3)).toBeNull()
  })
})
