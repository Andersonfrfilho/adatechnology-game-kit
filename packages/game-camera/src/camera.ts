import { resolveStrings } from './locale'
import type {
  CameraConfig,
  CameraLike,
  CameraMode,
  CameraOptions,
  CameraRig,
  CameraTarget,
  CeilingFn,
  CollideFn,
  ThreeLib,
  ViewmodelTarget,
} from './types'

/** Default configuration (labels are filled from the locale table in `create`). */
export const DEFAULTS: Omit<CameraConfig, 'labels'> = {
  modes: ['shoulder', 'third', 'first'],
  shoulder: { distance: 3.8, aimDistance: 1.7, side: 0.9, height: 1.95, crouchHeight: 1.4 },
  third: { distance: 4.2, aimDistance: 2.2, height: 2.5, crouchHeight: 1.9 },
  first: { eyes: 1.62, crouchEyes: 1.15, forward: 0.16 },
  // weapon in the right hand, below the crosshair, barrel slightly inward
  viewmodel: { x: 0.24, y: -0.24, z: -0.38, twist: -0.16 },
  smoothing: 12,
  aim: { fov: 65, fovPower: 1, zoomPower: 0.5, sensitivity: 0.0022, fovTolerance: 0.1 },
  wallRecovery: 4,
  deathOrbit: { radius: 6, height: 3.5, speed: 0.2, lookHeight: 1 },
  look: { pitchMin: -0.55, pitchMax: 1.2 },
  shake: { fever: { yawSpeed: 1.3, yaw: 0.0015, pitchSpeed: 1.7, pitch: 0.001 }, panic: { amplitude: 0.002 } },
  wallClearance: 0.3,
  minDistance: 0.2,
  storageKey: 'game-camera-mode', // where the mode is saved in the browser (null = do not save)
  locale: 'en',
}

type Plain = Record<string, unknown>

// shallow-merge one level of nested objects (arrays and primitives are replaced)
const merge = (a: Plain, b: Plain | undefined): Plain => {
  const o: Plain = { ...a }
  for (const k in b || {}) {
    const v = b![k]
    o[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...(a[k] as Plain), ...(v as Plain) } : v
  }
  return o
}

/**
 * Creates a camera rig.
 *
 * ```ts
 * const rig = create(THREE, { storageKey: 'my-game-camera' })
 * // every frame
 * rig.update(camera, { x, y, z, yaw, pitch, aiming, crouching }, dt, collide)
 * ```
 */
export function create(THREE: ThreeLib, options?: CameraOptions): CameraRig {
  const strings = resolveStrings(options?.locale)
  const C = merge({ ...DEFAULTS, labels: strings.modeLabels } as unknown as Plain, options as Plain) as unknown as CameraConfig
  const listeners: Array<(mode: CameraMode) => void> = []
  let mode: CameraMode = C.modes[0]
  let side = 1
  let distance: number | null = null
  // boom, shoulder side and height as they are now, easing towards what the target asks for (null until the first frame)
  let eased: { back: number; side: number; up: number } | null = null
  if (C.storageKey) {
    try {
      const saved = localStorage.getItem(C.storageKey) as CameraMode | null
      if (saved && C.modes.includes(saved)) mode = saved
    } catch (e) {}
  }
  const _v = new THREE.Vector3()
  const _t = new THREE.Vector3()
  const _q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI + C.viewmodel.twist)

  const rig: CameraRig = {
    get mode() {
      return mode
    },
    get side() {
      return side
    },
    config: C,
    setMode(m) {
      if (!C.modes.includes(m)) return
      mode = m
      if (C.storageKey) {
        try {
          localStorage.setItem(C.storageKey, m)
        } catch (e) {}
      }
      listeners.forEach((f) => f(m))
    },
    cycle() {
      rig.setMode(C.modes[(C.modes.indexOf(mode) + 1) % C.modes.length])
    },
    flipSide() {
      side *= -1
    },
    onChange(f) {
      listeners.push(f)
    },
    isFirstPerson() {
      return mode === 'first'
    },
    lookSensitivity(zoom = 1, aiming = false) {
      return C.aim.sensitivity * (aiming ? 1 / zoom ** C.aim.zoomPower : 1)
    },
    lookShake({ time = 0, fever, panic, random }) {
      let yaw = 0
      let pitch = 0
      if (fever) {
        yaw += Math.sin(time * C.shake.fever.yawSpeed) * C.shake.fever.yaw
        pitch += Math.cos(time * C.shake.fever.pitchSpeed) * C.shake.fever.pitch
      }
      if (panic && random) yaw += (random() - 0.5) * C.shake.panic.amplitude
      return { yaw, pitch }
    },
    look(state, input) {
      const sensitivity = rig.lookSensitivity(input.zoom, input.aiming)
      state.yaw -= input.dx * sensitivity
      state.pitch = Math.min(C.look.pitchMax, Math.max(C.look.pitchMin, state.pitch + input.dy * sensitivity))
      const shake = rig.lookShake(input)
      state.yaw += shake.yaw
      state.pitch += shake.pitch
      return state
    },
    update(cam: CameraLike, a: CameraTarget, dt: number, collide?: CollideFn | null, ceiling?: CeilingFn | null) {
      if (a.alive === false) {
        // the camera circles the body and looks at it; the eased boom and the field of view stay as they were
        const orbit = C.deathOrbit
        const t = (a.deathT ?? 0) * orbit.speed
        cam.position.set(a.x + Math.sin(t) * orbit.radius, orbit.height, a.z + Math.cos(t) * orbit.radius)
        cam.lookAt(_t.set(a.x, orbit.lookHeight, a.z))
        return
      }
      const fx = -Math.sin(a.yaw)
      const fz = -Math.cos(a.yaw)
      const cy = Math.cos(a.pitch)
      const sy = Math.sin(a.pitch)
      const rx = -fz
      const rz = fx
      const rate = (k: number): number => (C.smoothing > 0 ? k : 1)
      // the field of view follows the weapon's zoom while aiming
      const easeFov = (): void => {
        if (a.zoom === undefined || cam.fov === undefined) return
        const wanted = a.aiming ? C.aim.fov / a.zoom ** C.aim.fovPower : C.aim.fov
        if (Math.abs(cam.fov - wanted) <= C.aim.fovTolerance) return
        cam.fov += (wanted - cam.fov) * rate(Math.min(1, (dt || 0) * C.smoothing))
        cam.updateProjectionMatrix?.()
      }
      if (mode === 'first') {
        const f = C.first.forward
        cam.position.set(a.x + fx * f, a.y + (a.crouching ? C.first.crouchEyes : C.first.eyes), a.z + fz * f)
        cam.lookAt(_t.set(cam.position.x + fx * cy * 10, cam.position.y - sy * 10, cam.position.z + fz * cy * 10))
        easeFov()
        return
      }
      const M = mode === 'shoulder' ? C.shoulder : C.third
      const wantedSide = mode === 'shoulder' ? C.shoulder.side * side : 0
      const wantedBack = a.aiming ? M.aimDistance : M.distance
      const wantedUp = a.crouching ? M.crouchHeight : M.height
      // the boom, the shoulder and the height ease: aiming, swapping shoulders and crouching do not jump (the first frame starts from standing, not aiming)
      const ease = rate(1 - Math.exp(-(dt || 0) * C.smoothing))
      const start = eased ?? { back: M.distance, side: mode === 'shoulder' ? C.shoulder.side : 0, up: M.height }
      eased = { back: start.back + (wantedBack - start.back) * ease, side: start.side + (wantedSide - start.side) * ease, up: start.up + (wantedUp - start.up) * ease }
      const back = eased.back
      const up = a.y + eased.up
      const px = a.x + rx * eased.side
      const pz = a.z + rz * eased.side
      let dx = -fx * back * cy
      let dy = sy * back + 0.1
      let dz = -fz * back * cy
      const L = Math.hypot(dx, dy, dz)
      dx /= L
      dy /= L
      dz /= L
      let free = L
      if (collide) {
        for (const o of [0, 0.2, -0.2]) {
          const t = collide(px + rx * o, up, pz + rz * o, dx, dy, dz, L)
          if (t != null) free = Math.min(free, Math.max(C.minDistance, t - C.wallClearance))
        }
      }
      // a nearby wall shortens the boom at once; once it clears, the camera eases back out
      distance = distance == null ? free : Math.min(distance, free)
      if (distance < free) distance += (free - distance) * (1 - Math.exp(-(dt || 0) * C.wallRecovery))
      let y = up + dy * distance
      if (ceiling) y = Math.min(y, ceiling(px + dx * distance, pz + dz * distance, up))
      cam.position.set(px + dx * distance, y, pz + dz * distance)
      cam.lookAt(_t.set(px + fx * cy * 10, up - sy * 10, pz + fz * cy * 10))
      easeFov()
    },
    // weapon glued to the camera in first person (the group has its barrel along +z)
    viewmodel(group: ViewmodelTarget, cam: CameraLike) {
      cam.updateMatrixWorld()
      group.position.copy(_v.set(C.viewmodel.x, C.viewmodel.y, C.viewmodel.z).applyQuaternion(cam.quaternion).add(cam.position))
      group.quaternion.copy(cam.quaternion).multiply(_q)
    },
    selector(parent, label = strings.selectorLabel) {
      const d = document.createElement('label')
      d.className = 'game-camera-selector'
      d.style.cssText = 'display:flex;gap:10px;align-items:center;margin:10px 0;font-size:14px'
      const s = document.createElement('select')
      C.modes.forEach((m) => {
        const o = document.createElement('option')
        o.value = m
        o.textContent = C.labels[m] || m
        s.appendChild(o)
      })
      const sp = document.createElement('span')
      sp.textContent = label
      d.append(sp, s)
      parent.appendChild(d)
      s.value = mode
      s.addEventListener('change', () => rig.setMode(s.value as CameraMode))
      rig.onChange((m) => {
        s.value = m
      })
      return d
    },
  }
  return rig
}
