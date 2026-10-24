import type * as THREE_NS from 'three'
import type { Vec3 } from '@adatechnology/game-destruction'

export interface PlayerHooks {
  /** Primary button pressed / released (use the tool). `click` is a press without a drag, for the no-pointer-lock fallback. */
  primaryDown(): void
  primaryUp(): void
  secondary(): void
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
  /** Half size of the arena. */
  limit: number
  start: Vec3
  hooks: PlayerHooks
}

export interface Player {
  readonly yaw: number
  readonly pitch: number
  readonly locked: boolean
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
  /** Walk by hand (tests): moves the player `forward` and `right` metres along its facing. */
  walk(forward: number, right: number): void
  dispose(): void
}

const EYE = 1.7
/** Horizontal radius of the player, metres: what the colliders and a trip wire see. */
export const PLAYER_RADIUS = 0.3
const WALK = 3.4
const RUN = 6.2
const JUMP = 4.6
const GRAVITY = 13
const LOOK = 0.0022

/**
 * First-person controller: WASD, Shift, Space, mouse look with pointer lock, and a drag-to-look fallback for pages where the lock is not
 * available (iframes, headless browsers, touch). In the fallback a press that does not move is a click (tool use), a drag looks around.
 */
export function createPlayer(THREE: typeof THREE_NS, o: PlayerOptions): Player {
  const cam = o.camera
  let yaw = 0
  let pitch = 0
  let y = 0
  let eye = EYE
  let vy = 0
  const px = { x: o.start[0], z: o.start[2] }
  let locked = false
  const keys = new Set<string>()
  const euler = new THREE.Euler(0, 0, 0, 'YXZ')

  const apply = (): void => {
    euler.set(pitch, yaw, 0, 'YXZ')
    cam.quaternion.setFromEuler(euler)
    cam.position.set(px.x, eye + y, px.z)
    cam.updateMatrixWorld(true)
  }
  apply()

  const blocked = (x: number, z: number): boolean => {
    if (Math.abs(x) > o.limit - PLAYER_RADIUS || Math.abs(z) > o.limit - PLAYER_RADIUS) return true
    for (const c of o.colliders) if (x > c[0] - PLAYER_RADIUS && x < c[2] + PLAYER_RADIUS && z > c[1] - PLAYER_RADIUS && z < c[3] + PLAYER_RADIUS) return true
    if (o.blockers) for (const blocked of o.blockers) if (blocked(x, z, PLAYER_RADIUS)) return true
    return false
  }
  const move = (dx: number, dz: number): void => {
    if (!blocked(px.x + dx, px.z)) px.x += dx
    if (!blocked(px.x, px.z + dz)) px.z += dz
  }

  let dragging = false
  let moved = 0
  let downAt = 0
  let useStarted = false
  let holdTimer: ReturnType<typeof setTimeout> | null = null

  const look = (dx: number, dy: number): void => {
    yaw -= dx * LOOK
    pitch = Math.max(-1.5, Math.min(1.5, pitch - dy * LOOK))
  }
  const onLockChange = (): void => {
    locked = document.pointerLockElement === o.dom
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
    if (!e.repeat) keys.add(e.code)
    o.hooks.key(e.code, true, e)
  }
  const onKeyUp = (e: KeyboardEvent): void => {
    keys.delete(e.code)
    if (typing(e)) return
    o.hooks.key(e.code, false, e)
  }
  const onContext = (e: Event): void => e.preventDefault()
  const onBlur = (): void => keys.clear()

  o.dom.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('mousemove', onMouseMove)
  o.dom.addEventListener('wheel', onWheel, { passive: false })
  o.dom.addEventListener('contextmenu', onContext)
  document.addEventListener('pointerlockchange', onLockChange)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  return {
    get yaw() {
      return yaw
    },
    get pitch() {
      return pitch
    },
    get locked() {
      return locked
    },
    keys,
    update(dt) {
      const run = keys.has('ShiftLeft') || keys.has('ShiftRight')
      const speed = run ? RUN : WALK
      let f = 0
      let r = 0
      if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1
      if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1
      if (keys.has('KeyD') || keys.has('ArrowRight')) r += 1
      if (keys.has('KeyA') || keys.has('ArrowLeft')) r -= 1
      if ((f || r || keys.has('Space')) && eye !== EYE) eye = EYE
      if (f || r) {
        const len = Math.hypot(f, r)
        const fx = -Math.sin(yaw)
        const fz = -Math.cos(yaw)
        const rx = Math.cos(yaw)
        const rz = -Math.sin(yaw)
        move(((fx * f + rx * r) / len) * speed * dt, ((fz * f + rz * r) / len) * speed * dt)
      }
      if (y <= 0 && keys.has('Space')) vy = JUMP
      if (y > 0 || vy > 0) {
        vy -= GRAVITY * dt
        y += vy * dt
        if (y <= 0) {
          y = 0
          vy = 0
        }
      }
      apply()
    },
    setPose(position, yw, pt) {
      px.x = position[0]
      px.z = position[2]
      eye = position[1]
      y = 0
      vy = 0
      yaw = yw
      pitch = pt
      apply()
    },
    look(position, target) {
      px.x = position[0]
      px.z = position[2]
      eye = position[1]
      y = 0
      vy = 0
      const dx = target[0] - position[0]
      const dy = target[1] - position[1]
      const dz = target[2] - position[2]
      yaw = Math.atan2(-dx, -dz)
      pitch = Math.atan2(dy, Math.hypot(dx, dz))
      apply()
    },
    kick(pitchDeg, yawDeg) {
      pitch = Math.max(-1.5, Math.min(1.5, pitch + (pitchDeg * Math.PI) / 180))
      yaw += (yawDeg * Math.PI) / 180
      apply()
    },
    moveBy(dx, dz) {
      move(dx, dz)
      apply()
    },
    walk(forward, right) {
      move(-Math.sin(yaw) * forward + Math.cos(yaw) * right, -Math.cos(yaw) * forward - Math.sin(yaw) * right)
      apply()
    },
    dispose() {
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
      if (document.pointerLockElement === o.dom) document.exitPointerLock?.()
    },
  }
}
