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
    update(cam: CameraLike, a: CameraTarget, dt: number, collide?: CollideFn | null, ceiling?: CeilingFn | null) {
      const fx = -Math.sin(a.yaw)
      const fz = -Math.cos(a.yaw)
      const cy = Math.cos(a.pitch)
      const sy = Math.sin(a.pitch)
      const rx = -fz
      const rz = fx
      if (mode === 'first') {
        const f = C.first.forward
        cam.position.set(a.x + fx * f, a.y + (a.crouching ? C.first.crouchEyes : C.first.eyes), a.z + fz * f)
        cam.lookAt(_t.set(cam.position.x + fx * cy * 10, cam.position.y - sy * 10, cam.position.z + fz * cy * 10))
        return
      }
      const M = mode === 'shoulder' ? C.shoulder : C.third
      const sideOffset = mode === 'shoulder' ? C.shoulder.side * side : 0
      const back = a.aiming ? M.aimDistance : M.distance
      const up = a.y + (a.crouching ? M.crouchHeight : M.height)
      const px = a.x + rx * sideOffset
      const pz = a.z + rz * sideOffset
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
      if (distance < free) distance += (free - distance) * (1 - Math.exp(-(dt || 0) * 4))
      let y = up + dy * distance
      if (ceiling) y = Math.min(y, ceiling(px + dx * distance, pz + dz * distance, up))
      cam.position.set(px + dx * distance, y, pz + dz * distance)
      cam.lookAt(_t.set(px + fx * cy * 10, up - sy * 10, pz + fz * cy * 10))
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
