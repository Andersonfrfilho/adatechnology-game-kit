import type * as THREE_NS from 'three'
import type { Knock } from '@adatechnology/game-contracts'
import type { Vec3 } from '@adatechnology/game-destruction'
import type { BodyId, PhysicsServices } from '@adatechnology/game-physics'
import type { Scheduler } from '@adatechnology/game-runtime'

import { LANDING_MIN_SPEED, PLAYER_RADIUS, SLAM_MIN_SPEED } from './locomotion'
import type { Locomotion } from './locomotion'
import { createOwnLocomotion } from './own-locomotion'
import { createEngineLocomotion } from './player-body'
import type { EngineBody } from './player-body'
import { servicesIgnoringOwnShadow } from './thrower-ignores-own-shadow'

export { LANDING_MIN_SPEED, PLAYER_RADIUS, SLAM_MIN_SPEED }

export interface PlayerHooks {
  /** Primary button pressed / released (use the tool). `click` is a press without a drag, for the no-pointer-lock fallback. */
  primaryDown(): void
  primaryUp(): void
  secondary(): void
  /** The secondary button released (a trigger held on it, with a tool in each hand). */
  secondaryUp?(): void
  key(code: string, down: boolean, event: KeyboardEvent): void
  wheel(direction: 1 | -1): void
}

export interface PlayerOptions {
  camera: THREE_NS.PerspectiveCamera
  dom: HTMLElement
  /** `[minX, minZ, maxX, maxZ]` boxes to stay out of. */
  colliders: Array<[number, number, number, number]>
  /** Extra places to stay out of, asked on every step (a module's walls): `(x, z, radius) => blocked`. The set may change while the player walks. */
  blockers?: ReadonlySet<(x: number, z: number, radius: number) => boolean>
  /**
   * What stands where the body would be, asked on every step with the feet height: `floor` is the highest top it can step onto there (a low
   * heap of debris; 0 is the floor), `blocked` that something taller is in the way. Without it the floor is flat and only the colliders stop. `bodiless`: only what the
   * physics world has no body for (the veto of the engine path).
   */
  footing?: (x: number, z: number, radius: number, feet: number, bodiless?: boolean) => { floor: number; blocked: boolean }
  /**
   * The physics world of the room's loop: the body is then a walker in it (`player-body.ts`) and the view stands where the feet are drawn between the last two
   * steps, set in the scheduler's `present` phase. Without it the room walks the player itself.
   */
  engine?: EngineBody & { readonly scheduler: Pick<Scheduler, 'add'>; /** Runs after the view stands on the drawn feet: the room puts the body's eyes back where it wants the camera. */ readonly afterPresent?: () => void }
  /** Half size of the arena. */
  limit: number
  start: Vec3
  hooks: PlayerHooks
  /** `KeyboardEvent.code`s that crouch (default `['KeyC']`): a tap stays crouched until the next tap, a longer press crouches while held. Ctrl is not one by default: Ctrl+W closes the tab and no page can stop it. */
  crouchKeys?: readonly string[]
  /** Height of the ground the player walks on (a crater, a heap). Default flat at 0. */
  floorAt?: (x: number, z: number) => number
  /** What is left of the walking speed here, 0..1 (mud, snow, water). */
  speedAt?: (x: number, z: number) => number
  /** The feet leave the floor on a jump, or meet it again after a fall (`speed`: m/s downward at the touch). For the body's sounds. */
  /**
   * A body thrown by a knock hit something on its way (`obstacle`: a wall, a car, a cupboard, which stopped it) or the floor (`ground`, falling): `speed` m/s into it,
   * `direction` the unit way it was going. For the impact on what it hit, the sound and the hurt.
   */
  onSlam?(event: PlayerSlam): void
  onFeet?: (event: PlayerFeetEvent) => void
  /** How the view comes back after a shot's kick (`kick`): the share of each kick that returns and the seconds it takes to return most of it. Default `RECOIL_RETURN`. */
  recoilReturn?: { readonly share: number; readonly seconds: number }
}

/** The view comes back down after each kick, as the shooter brings the gun back on target: 70 % of the kick within about a quarter of a second; the rest stays, so a long burst still climbs. */
export const RECOIL_RETURN = { share: 0.7, seconds: 0.25 } as const

/** What the feet did this frame: a jump, or a landing with the speed of the fall (a jump on the spot comes down at about 4.6 m/s). */
export type PlayerFeetEvent = { readonly type: 'jump' } | { readonly type: 'land'; readonly speed: number }

/** A thrown body meeting a wall or the floor (`PlayerOptions.onSlam`). */
export interface PlayerSlam {
  readonly against: 'obstacle' | 'ground'
  readonly speed: number
  readonly direction: Vec3
}

export interface Player {
  readonly yaw: number
  readonly pitch: number
  readonly locked: boolean
  /** Where the feet are: x and z on the floor, y above it (a jump lifts it). The eye is `EYE` above, the camera sits there. */
  readonly x: number
  readonly z: number
  readonly feet: number
  /** The feet as the body is drawn: after a step up (a sill, a heap) they climb it over a few frames while `feet` is on it at once. */
  readonly drawnFeet: number
  /** Where the body is drawn on the floor plane: `x` and `z`, or, on the engine path, the feet between the last two fixed steps. */
  readonly drawnX: number
  readonly drawnZ: number
  /** Feet position. */
  readonly position: Vec3
  /** Horizontal metres per second walked in the last update. */
  readonly speed: number
  readonly running: boolean
  /** The feet are on the floor (not in a jump or a fall). */
  readonly grounded: boolean
  /** Whether the player is in free flight / noclip mode (bypasses gravity and colliders). */
  readonly flying: boolean
  /** The physics services with every swept piece born from now on ignoring the player's own body (what leaves the hand must not hit it). */
  ignoringOwnBody(services: PhysicsServices): PhysicsServices
  /** The body the world sees of the player (engine only), for what the player carries to pass through. */
  shadowBody(): BodyId | undefined
  /** The body is a walker in the physics world (`PlayerOptions.engine`). */
  readonly engine: boolean
  toggleFly(): boolean
  setFly(enabled: boolean): void
  /** Whether the player is crouched (a crouch key tapped or held): the eye sinks and the walk slows. */
  readonly crouching: boolean
  /** Held keys, by `KeyboardEvent.code`. */
  keys: ReadonlySet<string>
  update(dt: number): void
  setPose(position: Vec3, yaw: number, pitch: number): void
  /** Put the eye at `position` looking at `target`. */
  look(position: Vec3, target: Vec3): void
  /** Camera kick in degrees. */
  kick(pitchDeg: number, yawDeg: number): void
  /** Move the player by a world offset on the floor plane, stopped by the colliders and the arena limit (scripted walks). */
  moveBy(dx: number, dz: number): void
  /** Where the keys ask to go on the floor: a unit `[x, z]`, or `[0, 0]`. */
  readonly walkIntent: readonly [number, number]
  /** Whether a body can stand at this point (arena, colliders, blockers). */
  canStand(x: number, z: number): boolean
  /** While held the keys do not walk or jump: whoever holds it moves the player with `moveBy` (pushing a piece of furniture). */
  setWalkHeld(held: boolean): void
  /** A module places the player itself (a vehicle, an aircraft): like `setWalkHeld`, and on the engine path the body also leaves the world while it lasts. */
  hold(held: boolean): void
  /** Seated, the body stays at the height its pose set: what it sits on is not a step to climb and it does not fall. */
  setSeated(seated: boolean): void
  /** Lowers the eye by this many metres, eased (bending over something low); 0 stands up. */
  setBend(metres: number): void
  /** Keeps the view within `range` radians of `yaw`; null frees it. */
  setLookLimit(limit: { readonly yaw: number; readonly range: number } | null): void
  /** The floor offset the player tried to walk (keys, `moveBy`, `walk`) since the last call, blocked or not; the call resets it. */
  takeWish(): [number, number]
  /** Walk by hand (tests): moves the player `forward` and `right` metres along its facing. */
  walk(forward: number, right: number): void
  /**
   * A blast's shove (`knockOf` of game-contracts): the body is thrown with its velocity, slides and stops against what is in the way, and, when the knock takes it off
   * its feet, falls, lies a while and gets up. The keys do nothing until it stands again. A second knock while one is on adds its velocity.
   */
  knock(knock: Knock): void
  /** The knock on now, or null: `lying` 0..1 says how far down the body is. */
  readonly knocked: Readonly<Knock> | null
  /** Whether the knock that put the body down pushed it toward its facing (falls face down) rather than from the front (falls on its back). */
  readonly knockedForward: boolean
  /** Seconds of stun left from a blast (the view sways), 0 when clear. */
  readonly stunned: number
  dispose(): void
}

const EYE = 1.7
const WALK = 3.4
/** How far (m) the eye sinks when crouched, the speed of a crouched walk, and how fast the eye goes down and up (per second). */
export const CROUCH_DROP = 0.55
const CROUCH_WALK = 1.7
const CROUCH_RATE = 9
const BEND_RATE = 7
/** A crouch key released within this many seconds was a tap, which stays crouched; a longer press was a hold. */
const CROUCH_TAP = 0.25
const RUN = 6.2
const LOOK = 0.0022
/** Height of the eye (m above the floor) of a body lying on its back, where the view turns up to (radians above the level), and how far it rolls to one side. */
const LYING_EYE = 0.3
const LYING_PITCH = 1.05
const LYING_ROLL = 0.35
/** Where the view of a body fallen face down turns to: below the level, at the ground under the face (radians). */
const LYING_PITCH_FACE_DOWN = -1.05
/** The sway of a stunned view: radians of pitch and roll at full stun, reached with `STUN_FULL` seconds or more left. */
const STUN_PITCH = 0.05
const STUN_ROLL = 0.08
const STUN_FULL = 2

/**
 * First-person controller: WASD, Shift, Space, mouse look with pointer lock, and a drag-to-look fallback for pages where the lock is not
 * available (iframes, headless browsers, touch). In the fallback a press that does not move is a click (tool use), a drag looks around.
 */
export function createPlayer(THREE: typeof THREE_NS, o: PlayerOptions): Player {
  const cam = o.camera
  let yaw = 0
  let pitch = 0
  const recoilReturn = o.recoilReturn ?? RECOIL_RETURN
  // what is still to come back of the kicks, radians
  const recoilDebt = { pitch: 0, yaw: 0 }
  const returnRecoil = (dt: number): void => {
    if (Math.abs(recoilDebt.pitch) + Math.abs(recoilDebt.yaw) < 1e-6) return
    const k = 1 - Math.exp((-3 * dt) / Math.max(1e-3, recoilReturn.seconds))
    const back = { pitch: recoilDebt.pitch * k, yaw: recoilDebt.yaw * k }
    recoilDebt.pitch -= back.pitch
    recoilDebt.yaw -= back.yaw
    pitch = Math.max(-1.5, Math.min(1.5, pitch - back.pitch))
    yaw -= back.yaw
    apply()
  }
  let eye = EYE
  let crouch = 0
  let bend = 0
  let bendTarget = 0
  let locked = false
  const keys = new Set<string>()
  const crouchKeys = o.crouchKeys ?? ['KeyC']
  const isCrouchHeld = (): boolean => crouchKeys.some((code) => keys.has(code))
  let crouchLatched = false
  let crouchPress: { held: number; latched: boolean } | null = null
  const isCrouched = (): boolean => crouchLatched || isCrouchHeld()
  const pressCrouch = (code: string): void => {
    if (crouchKeys.includes(code) && !isCrouchHeld()) crouchPress = { held: 0, latched: crouchLatched }
  }
  const releaseCrouch = (code: string): void => {
    if (!crouchKeys.includes(code) || !crouchPress || isCrouchHeld()) return
    crouchLatched = crouchPress.held < CROUCH_TAP ? !crouchPress.latched : false
    crouchPress = null
  }
  const euler = new THREE.Euler(0, 0, 0, 'YXZ')
  const locomotion: Locomotion = o.engine ? createEngineLocomotion(o, o.start, o.engine) : createOwnLocomotion(o, o.start)

  /** The knock of a blast on the body, while it lasts. */
  let knocked: Knock | null = null
  let knockedForward = false
  /** Seconds of stun left, and the phase of the sway it gives the view. */
  let stunLeft = 0
  let stunPhase = 0
  /** Which way the view rolls when the body falls: toward the side the shove came from. */
  let rollSide = 1
  const apply = (): void => {
    const lying = knocked?.lying ?? 0
    // a fall eases in: the eye goes down to the floor and the view turns up to the sky, a little onto one side (on its back, thrown away from the blast)
    const fallen = lying * lying * (3 - 2 * lying)
    // a stunned head sways: slow, uneven, fading as the stun wears off
    const sway = Math.min(1, stunLeft / STUN_FULL)
    const swayPitch = STUN_PITCH * sway * Math.sin(stunPhase * 1.3)
    const swayRoll = STUN_ROLL * sway * Math.sin(stunPhase * 0.9 + 1)
    euler.set(pitch + ((knockedForward ? LYING_PITCH_FACE_DOWN : LYING_PITCH) - pitch) * fallen + swayPitch, yaw, LYING_ROLL * rollSide * fallen + swayRoll, 'YXZ')
    cam.quaternion.setFromEuler(euler)
    const standing = eye - CROUCH_DROP * crouch - bend
    const posY = locomotion.flying ? locomotion.drawnFeet + standing : locomotion.drawnFeet + standing + (LYING_EYE - standing) * fallen
    cam.position.set(locomotion.drawnX, posY, locomotion.drawnZ)
    cam.updateMatrixWorld(true)
  }
  apply()
  // the view follows the feet as they are drawn between two fixed steps: the scheduler's alpha, which `present` has and the loop's frame does not
  const stopPresent = o.engine?.scheduler.add(
    (context) => {
      if (!context.simulated || context.scripted) return
      locomotion.present?.(context.alpha)
      apply()
      o.engine?.afterPresent?.()
    },
    { phase: 'present', order: -100, id: 'player.present' },
  )

  const walkKeys = (): readonly [number, number] => {
    const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)
    const r = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)
    if (!f && !r) return [0, 0]
    const len = Math.hypot(f, r)
    return [(-Math.sin(yaw) * f + Math.cos(yaw) * r) / len, (-Math.cos(yaw) * f - Math.sin(yaw) * r) / len]
  }

  let dragging = false
  let moved = 0
  let downAt = 0
  let useStarted = false
  let holdTimer: ReturnType<typeof setTimeout> | null = null

  let walkHeld = false
  let lookLimit: { readonly yaw: number; readonly range: number } | null = null
  const look = (dx: number, dy: number): void => {
    yaw -= dx * LOOK
    if (lookLimit) {
      const off = Math.atan2(Math.sin(yaw - lookLimit.yaw), Math.cos(yaw - lookLimit.yaw))
      yaw = lookLimit.yaw + Math.max(-lookLimit.range, Math.min(lookLimit.range, off))
    }
    pitch = Math.max(-1.5, Math.min(1.5, pitch - dy * LOOK))
  }
  const onLockChange = (): void => {
    locked = document.pointerLockElement === o.dom
    if (locked) {
      try {
        const nav = (typeof navigator !== 'undefined' ? navigator : null) as unknown as { keyboard?: { lock?(keys?: string[]): Promise<void> } } | null
        nav?.keyboard?.lock?.().catch(() => {})
      } catch {
        // ignore if not supported
      }
    } else {
      try {
        const nav = (typeof navigator !== 'undefined' ? navigator : null) as unknown as { keyboard?: { unlock?(): void } } | null
        nav?.keyboard?.unlock?.()
      } catch {
        // ignore
      }
    }
  }
  const onMouseDown = (e: MouseEvent): void => {
    o.dom.focus?.()
    if (e.button === 2) {
      e.preventDefault()
      o.hooks.secondary()
      return
    }
    if (e.button !== 0) return
    if (!locked) {
      try {
        const r = (o.dom.requestPointerLock as unknown as (() => Promise<void> | void) | undefined)?.call(o.dom)
        if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => undefined)
      } catch {
        // no pointer lock here: drag to look
      }
      dragging = true
      moved = 0
      downAt = performance.now()
      useStarted = false
      holdTimer = setTimeout(() => {
        if (dragging && moved < 4 && !useStarted) {
          useStarted = true
          o.hooks.primaryDown()
        }
      }, 220)
      return
    }
    useStarted = true
    o.hooks.primaryDown()
  }
  const onMouseUp = (e: MouseEvent): void => {
    if (e.button === 2) {
      o.hooks.secondaryUp?.()
      return
    }
    if (e.button !== 0) return
    if (holdTimer) clearTimeout(holdTimer)
    if (dragging) {
      dragging = false
      if (!useStarted && moved < 4 && performance.now() - downAt < 400) {
        o.hooks.primaryDown()
        o.hooks.primaryUp()
      } else if (useStarted) o.hooks.primaryUp()
      useStarted = false
      return
    }
    if (useStarted) o.hooks.primaryUp()
    useStarted = false
  }
  const onMouseMove = (e: MouseEvent): void => {
    if (locked) look(e.movementX, e.movementY)
    else if (dragging) {
      moved += Math.abs(e.movementX) + Math.abs(e.movementY)
      if (moved >= 4) {
        if (useStarted) {
          useStarted = false
          o.hooks.primaryUp()
        }
        look(e.movementX, e.movementY)
      }
    }
  }
  const onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    o.hooks.wheel(e.deltaY > 0 ? 1 : -1)
  }
  const typing = (e: Event): boolean => {
    const t = e.target as HTMLElement | null
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')
  }
  const onKeyDown = (e: KeyboardEvent): void => {
    if (typing(e)) return
    if (e.code === 'Space' || e.code === 'Tab') e.preventDefault()
    // Ctrl/Meta/Alt chords are game input while playing (crouch + key); only F keys stay with the browser
    const isControlHeld = e.ctrlKey || e.metaKey || keys.has('ControlLeft') || keys.has('ControlRight')
    if (isControlHeld || (e.altKey && locked)) {
      if (!/^F\d+$/.test(e.code)) e.preventDefault()
    }
    if (!e.repeat) {
      pressCrouch(e.code)
      keys.add(e.code)
    }
    o.hooks.key(e.code, true, e)
  }
  const onKeyUp = (e: KeyboardEvent): void => {
    keys.delete(e.code)
    releaseCrouch(e.code)
    if (typing(e)) return
    o.hooks.key(e.code, false, e)
  }
  const onContext = (e: Event): void => e.preventDefault()
  const onBlur = (): void => {
    keys.clear()
    crouchPress = null
  }
  const onBeforeUnload = (e: BeforeUnloadEvent): void => {
    if (!locked && !keys.has('ControlLeft') && !keys.has('ControlRight')) return
    e.preventDefault()
    e.returnValue = ''
  }

  o.dom.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('mousemove', onMouseMove)
  o.dom.addEventListener('wheel', onWheel, { passive: false })
  o.dom.addEventListener('contextmenu', onContext)
  document.addEventListener('pointerlockchange', onLockChange)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  window.addEventListener('beforeunload', onBeforeUnload)

  /** One step of a knock: the body is moved where it is, the rest of the knock (stun view, getting up) stays here. */
  const stepKnocked = (dt: number): void => {
    const k = knocked
    if (!k) return
    if (locomotion.stepKnock(k, dt)) knocked = null
    apply()
  }

  return {
    get walkIntent() {
      return walkKeys()
    },
    canStand(x, z) {
      return locomotion.canStand(x, z)
    },
    setWalkHeld(held) {
      walkHeld = held
    },
    hold(held) {
      walkHeld = held
      locomotion.hold(held)
    },
    engine: o.engine !== undefined,
    setSeated(value) {
      locomotion.setSeated(value)
    },
    setBend(metres) {
      bendTarget = metres
    },
    setLookLimit(limit) {
      lookLimit = limit
    },
    get yaw() {
      return yaw
    },
    get pitch() {
      return pitch
    },
    get locked() {
      return locked
    },
    get x() {
      return locomotion.x
    },
    get z() {
      return locomotion.z
    },
    get feet() {
      return locomotion.feet
    },
    get drawnFeet() {
      return locomotion.drawnFeet
    },
    get drawnX() {
      return locomotion.drawnX
    },
    get drawnZ() {
      return locomotion.drawnZ
    },
    get position() {
      return [locomotion.x, locomotion.feet, locomotion.z] as Vec3
    },
    get speed() {
      return locomotion.speed
    },
    get running() {
      return locomotion.running
    },
    get grounded() {
      return locomotion.grounded
    },
    get flying() {
      return locomotion.flying
    },
    ignoringOwnBody: (services) => servicesIgnoringOwnShadow(services, () => locomotion.shadowBody?.()),
    shadowBody: () => locomotion.shadowBody?.(),
    toggleFly: () => locomotion.toggleFly(),
    setFly: (enabled) => locomotion.setFly(enabled),
    get crouching() {
      return isCrouched()
    },
    keys,
    knock(next) {
      if (locomotion.seated) return
      if (knocked) {
        knocked.velocity = [knocked.velocity[0] + next.velocity[0], knocked.velocity[1] + next.velocity[1], knocked.velocity[2] + next.velocity[2]]
        knocked.airborne ||= next.airborne
        knocked.down ||= next.down
        knocked.wounded ||= next.wounded
        knocked.lieLeft = Math.max(knocked.lieLeft, next.lieLeft)
      } else knocked = { ...next, velocity: [...next.velocity] }
      stunLeft = Math.max(stunLeft, next.stunSeconds ?? 0)
      if (next.down) {
        // the way away from the blast, even when the push is too weak to move the body (felled by wounds where it stands)
        const away = next.away && (next.away[0] !== 0 || next.away[2] !== 0) ? next.away : next.velocity
        // the view rolls to the side the shove pushes toward, seen from the facing
        const right = Math.cos(yaw) * away[0] - Math.sin(yaw) * away[2]
        rollSide = right >= 0 ? -1 : 1
        // pushed from behind the body pitches onto its face; from the front (the blast seen) onto its back
        knockedForward = -Math.sin(yaw) * away[0] - Math.cos(yaw) * away[2] > 0
        crouchLatched = false
      }
      locomotion.knocked(knocked, next.velocity)
    },
    get knocked() {
      return knocked
    },
    get knockedForward() {
      return knockedForward
    },
    get stunned() {
      return stunLeft
    },
    update(dt) {
      returnRecoil(dt)
      if (stunLeft > 0) {
        stunLeft = Math.max(0, stunLeft - dt)
        stunPhase += dt * 2.4
      }
      if (knocked) {
        stepKnocked(dt)
        return
      }
      if (crouchPress) crouchPress.held += dt
      const crouched = isCrouched() || locomotion.mustCrouch
      crouch += ((crouched ? 1 : 0) - crouch) * Math.min(1, dt * CROUCH_RATE)
      if (!crouched && crouch < 1e-3) crouch = 0
      bend += (bendTarget - bend) * Math.min(1, dt * BEND_RATE)
      const [walkX, walkZ] = walkKeys()
      if (locomotion.flying) {
        const run = keys.has('ShiftLeft') || keys.has('ShiftRight')
        let rise = 0
        if (keys.has('Space')) rise += 1
        if (keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ControlRight')) rise -= 1
        locomotion.update(dt, { walkX, walkZ, speed: run ? 14 : 5, running: run, jump: false, walkHeld, crouched: isCrouched(), rise })
        apply()
        return
      }
      const run = !crouched && !walkHeld && (keys.has('ShiftLeft') || keys.has('ShiftRight'))
      const jump = keys.has('Space')
      if ((walkX || walkZ || jump) && eye !== EYE) eye = EYE
      locomotion.update(dt, { walkX, walkZ, speed: crouched ? CROUCH_WALK : run ? RUN : WALK, running: run, jump, walkHeld, crouched: isCrouched(), rise: 0 })
      apply()
    },
    setPose(position, yw, pt) {
      knocked = null
      // a view set on purpose is where the kicks come back to
      recoilDebt.pitch = 0
      recoilDebt.yaw = 0
      eye = position[1] - locomotion.place(position)
      yaw = yw
      pitch = pt
      apply()
    },
    look(position, target) {
      knocked = null
      // a view set on purpose is where the kicks come back to
      recoilDebt.pitch = 0
      recoilDebt.yaw = 0
      eye = position[1] - locomotion.place(position)
      const dx = target[0] - position[0]
      const dy = target[1] - position[1]
      const dz = target[2] - position[2]
      yaw = Math.atan2(-dx, -dz)
      pitch = Math.atan2(dy, Math.hypot(dx, dz))
      apply()
    },
    kick(pitchDeg, yawDeg) {
      const before = pitch
      pitch = Math.max(-1.5, Math.min(1.5, pitch + (pitchDeg * Math.PI) / 180))
      yaw += (yawDeg * Math.PI) / 180
      recoilDebt.pitch += (pitch - before) * recoilReturn.share
      recoilDebt.yaw += ((yawDeg * Math.PI) / 180) * recoilReturn.share
      apply()
    },
    moveBy(dx, dz) {
      locomotion.moveBy(dx, dz)
      apply()
    },
    takeWish: () => locomotion.takeWish(),
    walk(forward, right) {
      locomotion.moveBy(-Math.sin(yaw) * forward + Math.cos(yaw) * right, -Math.cos(yaw) * forward - Math.sin(yaw) * right)
      apply()
    },
    dispose() {
      stopPresent?.()
      locomotion.dispose()
      if (holdTimer) clearTimeout(holdTimer)
      o.dom.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
      o.dom.removeEventListener('wheel', onWheel)
      o.dom.removeEventListener('contextmenu', onContext)
      document.removeEventListener('pointerlockchange', onLockChange)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('beforeunload', onBeforeUnload)
      if (document.pointerLockElement === o.dom) document.exitPointerLock?.()
    },
  }
}
