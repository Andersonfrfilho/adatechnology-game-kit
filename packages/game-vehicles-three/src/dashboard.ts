/**
 * The instrument cluster of a built vehicle working: the two dials the kit draws in front of the driver (`kit.dashboard`, material `gauge`) get a
 * face that reads live, the speedometer and the rev counter with the gear, and the warning lights a driver looks for (indicators, high beam, fog,
 * handbrake, belt, battery and oil while the key is on and the engine is not, 4x4). The faces are canvases laid over the kit's dials, facing the
 * driver's eyes, and only while someone drives: `dispose` takes them away and frees them, the kit's drawing is never changed.
 */
import { discardObject3D } from '@adatechnology/game-shapes-three'
import type { CanvasTexture, CircleGeometry, Mesh, MeshBasicMaterial, Object3D, Vector3 } from 'three'

import type { BuiltVehicle } from './build'

/** What the cluster shows this instant. */
export type DashboardReading = {
  kmh: number
  rpm: number
  /** -1 reverse, 0 neutral, 1.. forward. */
  gear: number
  ignition: boolean
  engineOn: boolean
  left: boolean
  right: boolean
  highBeam: boolean
  lowBeam: boolean
  fog: boolean
  parkingBrake: boolean
  seatbelt: boolean
  fourWheel: boolean
  /** Engine temperature, 0 (cold) to 1 (overheating); leave out while the engine has no heat model. */
  temperature?: number
  /** Fuel, 0 (empty) to 1 (full); leave out while the vehicle has no fuel model. */
  fuel?: number
  /** Cruise control holding a speed. */
  cruise?: boolean
  /** Drive profile shown by its letter (E economy, S sport; nothing for normal). */
  profile?: 'eco' | 'normal' | 'sport'
  /** The aids switched off light their amber lamps. */
  tractionOff?: boolean
  absOff?: boolean
  /** The alternator does not keep up (the battery drains with the engine running). */
  charging?: boolean
}

/** The scale of the dials and how often the faces are redrawn. */
export type DashboardOptions = {
  /** The kit's dial material (`kit.materials.gauge`): the dials are found by it. */
  gauge: unknown
  /** The kit's needle material (`kit.materials.amber`): the fixed needles drawn on the dials hide while the live face shows. */
  needle?: unknown
  /** Top of the speedometer, km/h. Default 220. */
  maxKmh?: number
  /** Red line of the rev counter. Default 6500. */
  redlineRpm?: number
  /** Redraws per second at most. Default 15. */
  fps?: number
  /** Where the canvases come from (tests pass a fake one). Default the page's. */
  document?: { createElement(tag: 'canvas'): HTMLCanvasElement }
}

export interface VehicleDashboard {
  /** How many dials were found (0: a vehicle without a cluster drawn, nothing to show). */
  readonly dials: number
  update(reading: DashboardReading, dt: number): void
  dispose(): void
}

type ThreeLib = {
  CanvasTexture: new (canvas: HTMLCanvasElement) => CanvasTexture
  CircleGeometry: new (radius: number, segments: number) => CircleGeometry
  MeshBasicMaterial: new (p: { map: CanvasTexture; transparent: boolean; toneMapped: boolean; depthWrite: boolean }) => MeshBasicMaterial
  Mesh: new (g: CircleGeometry, m: MeshBasicMaterial) => Mesh
  Vector3: new (x?: number, y?: number, z?: number) => Vector3
}

/** The colours of the cluster: the warning lights by the usual code (red stop, amber caution, green and blue information). */
export const DASHBOARD_LOOK = {
  face: '#0b1110',
  ring: '#2f3a36',
  marks: '#cfe8dc',
  needle: '#ff6a2a',
  red: '#e2402f',
  amber: '#f2a630',
  green: '#46d16f',
  blue: '#3f8cff',
  dim: 'rgba(207,232,220,0.12)',
  /** How far in front of the kit's dial the face sits, metres (the kit's needle sticks out 6 mm). */
  lift: 0.011,
} as const

const SIZE = 256

export function createVehicleDashboard(THREE: ThreeLib, built: BuiltVehicle, options: DashboardOptions): VehicleDashboard {
  const maxKmh = options.maxKmh ?? 220
  const redline = options.redlineRpm ?? 6500
  const doc: { createElement(tag: 'canvas'): HTMLCanvasElement } | null = options.document ?? (typeof document !== 'undefined' ? document : null)
  const dials: Mesh[] = []
  built.group.traverse((o: Object3D) => {
    if ((o as Mesh).isMesh && (o as Mesh).material === options.gauge) dials.push(o as Mesh)
  })
  const eye = built.driverEye
  const hidden: Object3D[] = []
  const faces: Array<{ mesh: Mesh; canvas: HTMLCanvasElement; g: CanvasRenderingContext2D; texture: CanvasTexture; kind: 'speed' | 'rpm' }> = []
  if (doc && eye && dials.length) {
    built.group.updateMatrixWorld(true)
    const eyeWorld = built.group.localToWorld(new THREE.Vector3(eye[0], eye[1], eye[2]))
    // the two dials nearest the driver: speed on the left of the driver's view (+x is the driver's left), revs on the right
    const near = dials
      .map((d) => ({ d, at: d.getWorldPosition(new THREE.Vector3()) }))
      .sort((a, b) => a.at.distanceTo(eyeWorld) - b.at.distanceTo(eyeWorld))
      .slice(0, 2)
      .sort((a, b) => built.group.worldToLocal(b.at.clone()).x - built.group.worldToLocal(a.at.clone()).x)
    near.forEach(({ d, at }, i) => {
      const canvas = doc.createElement('canvas')
      canvas.width = canvas.height = SIZE
      const g = canvas.getContext('2d')
      if (!g) return
      const texture = new THREE.CanvasTexture(canvas)
      const radius = (d.geometry as { parameters?: { radiusTop?: number } }).parameters?.radiusTop ?? 0.055
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.12, 40), new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, depthWrite: false }))
      mesh.name = 'dashboard_face'
      // the face lies on the dial, along the dial's own axis (a cylinder's y), on the driver's side
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(d.getWorldQuaternion(d.quaternion.clone())).normalize()
      if (axis.dot(eyeWorld.clone().sub(at)) < 0) axis.negate()
      const front = at.clone().addScaledVector(axis, DASHBOARD_LOOK.lift)
      mesh.position.copy(built.group.worldToLocal(front.clone()))
      built.group.add(mesh)
      mesh.updateMatrixWorld(true)
      mesh.lookAt(front.add(axis))
      // the kit's dial (its glowing side shows round the face at an angle) and its fixed needle step aside while the live face shows
      d.visible = false
      hidden.push(d)
      // the needle: the amber stick drawn on this dial
      if (options.needle)
        built.group.traverse((o: Object3D) => {
          if ((o as Mesh).isMesh && (o as Mesh).material === options.needle && o.visible && o.getWorldPosition(new THREE.Vector3()).distanceTo(at) < radius * 1.2) {
            o.visible = false
            hidden.push(o)
          }
        })
      faces.push({ mesh, canvas, g, texture, kind: near.length === 1 || i === 0 ? 'speed' : 'rpm' })
    })
  }

  const lamp = (g: CanvasRenderingContext2D, x: number, y: number, on: boolean, colour: string, draw: (g: CanvasRenderingContext2D) => void): void => {
    g.save()
    g.translate(x, y)
    g.fillStyle = g.strokeStyle = on ? colour : DASHBOARD_LOOK.dim
    g.lineWidth = 4
    draw(g)
    g.restore()
  }
  const arrow = (dir: 1 | -1) => (g: CanvasRenderingContext2D) => {
    g.beginPath()
    g.moveTo(dir * 14, 0)
    g.lineTo(-dir * 2, -12)
    g.lineTo(-dir * 2, -5)
    g.lineTo(-dir * 14, -5)
    g.lineTo(-dir * 14, 5)
    g.lineTo(-dir * 2, 5)
    g.lineTo(-dir * 2, 12)
    g.closePath()
    g.fill()
  }
  const beam = (g: CanvasRenderingContext2D) => {
    g.beginPath()
    g.arc(-4, 0, 10, Math.PI / 2, -Math.PI / 2, true)
    g.closePath()
    g.fill()
    for (let k = -1; k <= 1; k++) g.fillRect(8, k * 6 - 1.5, 10, 3)
  }
  // a seated person with the belt across the chest
  const belt = (g: CanvasRenderingContext2D) => {
    g.beginPath()
    g.arc(0, -10, 5, 0, Math.PI * 2)
    g.fill()
    g.fillRect(-6, -3, 12, 16)
    g.strokeStyle = DASHBOARD_LOOK.face
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(-7, -3)
    g.lineTo(7, 12)
    g.stroke()
  }
  const letter = (text: string) => (g: CanvasRenderingContext2D) => {
    g.font = 'bold 22px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, 0, 1)
  }
  const ring = (text: string) => (g: CanvasRenderingContext2D) => {
    g.beginPath()
    g.arc(0, 0, 13, 0, Math.PI * 2)
    g.stroke()
    letter(text)(g)
  }
  const dial = (g: CanvasRenderingContext2D, value: number, top: number, step: number, redFrom: number | null, label: (v: number) => string): void => {
    const c = SIZE / 2
    g.clearRect(0, 0, SIZE, SIZE)
    g.fillStyle = DASHBOARD_LOOK.face
    g.beginPath()
    g.arc(c, c, c - 2, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = DASHBOARD_LOOK.ring
    g.lineWidth = 6
    g.stroke()
    // 240 degrees of sweep, from the lower left round to the lower right
    const angle = (v: number): number => Math.PI * 0.75 + (Math.max(0, Math.min(top, v)) / top) * Math.PI * 1.5
    for (let v = 0; v <= top + 1e-6; v += step) {
      const a = angle(v)
      g.strokeStyle = redFrom !== null && v >= redFrom ? DASHBOARD_LOOK.red : DASHBOARD_LOOK.marks
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(c + Math.cos(a) * (c - 12), c + Math.sin(a) * (c - 12))
      g.lineTo(c + Math.cos(a) * (c - 30), c + Math.sin(a) * (c - 30))
      g.stroke()
      g.fillStyle = DASHBOARD_LOOK.marks
      g.font = '18px sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(label(v), c + Math.cos(a) * (c - 48), c + Math.sin(a) * (c - 48))
    }
    const a = angle(value)
    g.strokeStyle = DASHBOARD_LOOK.needle
    g.lineWidth = 6
    g.beginPath()
    g.moveTo(c - Math.cos(a) * 14, c - Math.sin(a) * 14)
    g.lineTo(c + Math.cos(a) * (c - 22), c + Math.sin(a) * (c - 22))
    g.stroke()
    g.fillStyle = DASHBOARD_LOOK.ring
    g.beginPath()
    g.arc(c, c, 10, 0, Math.PI * 2)
    g.fill()
  }
  const bar = (g: CanvasRenderingContext2D, x: number, share: number | undefined, warnAbove: boolean, label: string): void => {
    if (share === undefined) return
    const h = 60
    g.strokeStyle = DASHBOARD_LOOK.marks
    g.lineWidth = 2
    g.strokeRect(x - 5, 150, 10, h)
    const s = Math.max(0, Math.min(1, share))
    g.fillStyle = (warnAbove ? s > 0.85 : s < 0.12) ? DASHBOARD_LOOK.red : DASHBOARD_LOOK.marks
    g.fillRect(x - 4, 150 + h * (1 - s), 8, h * s)
    g.font = '14px sans-serif'
    g.textAlign = 'center'
    g.fillText(label, x, 222)
  }

  const draw = (r: DashboardReading): void => {
    const warn = r.ignition && !r.engineOn
    for (const f of faces) {
      const g = f.g
      if (f.kind === 'speed') {
        dial(g, r.kmh, maxKmh, maxKmh > 160 ? 20 : 10, null, (v) => String(Math.round(v)))
        g.fillStyle = DASHBOARD_LOOK.marks
        g.font = 'bold 30px sans-serif'
        g.textAlign = 'center'
        g.fillText(String(Math.round(r.kmh)), SIZE / 2, SIZE / 2 + 52)
        lamp(g, 92, 178, r.left, DASHBOARD_LOOK.green, arrow(-1))
        lamp(g, 164, 178, r.right, DASHBOARD_LOOK.green, arrow(1))
        lamp(g, 104, 214, r.highBeam, DASHBOARD_LOOK.blue, beam)
        lamp(g, 152, 214, r.lowBeam || r.fog, r.fog ? DASHBOARD_LOOK.amber : DASHBOARD_LOOK.green, beam)
        bar(g, 40, r.fuel, false, 'F')
        lamp(g, 104, 244, !!r.cruise, DASHBOARD_LOOK.green, letter('CRZ'))
        if (r.profile && r.profile !== 'normal') lamp(g, 152, 244, true, r.profile === 'eco' ? DASHBOARD_LOOK.green : DASHBOARD_LOOK.amber, letter(r.profile === 'eco' ? 'E' : 'S'))
      } else {
        dial(g, r.rpm / 1000, Math.ceil(redline / 1000) + 1, 1, redline / 1000, (v) => String(Math.round(v)))
        g.fillStyle = DASHBOARD_LOOK.marks
        g.font = 'bold 34px sans-serif'
        g.textAlign = 'center'
        g.fillText(r.gear < 0 ? 'R' : r.gear === 0 ? 'N' : String(r.gear), SIZE / 2, SIZE / 2 + 54)
        lamp(g, 86, 178, r.parkingBrake, DASHBOARD_LOOK.red, ring('P'))
        lamp(g, 128, 214, r.ignition && !r.seatbelt, DASHBOARD_LOOK.red, belt)
        lamp(g, 170, 178, warn || (r.engineOn && r.charging === false), DASHBOARD_LOOK.red, letter('+−'))
        lamp(g, 104, 244, r.ignition && !!r.tractionOff, DASHBOARD_LOOK.amber, letter('TC'))
        lamp(g, 152, 244, r.ignition && !!r.absOff, DASHBOARD_LOOK.amber, letter('ABS'))
        lamp(g, 86, 214, warn, DASHBOARD_LOOK.red, letter('OIL'))
        lamp(g, 170, 214, r.fourWheel, DASHBOARD_LOOK.green, letter('4x4'))
        bar(g, SIZE - 40, r.temperature, true, 'T')
      }
      f.texture.needsUpdate = true
    }
  }

  let wait = 0
  let last = ''
  return {
    dials: faces.length,
    update(reading, dt) {
      if (!faces.length) return
      wait -= dt
      const key = JSON.stringify(reading)
      if (wait > 0 || key === last) return
      wait = 1 / (options.fps ?? 15)
      last = key
      draw(reading)
    },
    dispose() {
      for (const f of faces) {
        discardObject3D(f.mesh)
        f.texture.dispose()
        f.canvas.width = f.canvas.height = 0
      }
      faces.length = 0
      for (const o of hidden) o.visible = true
      hidden.length = 0
    },
  }
}
