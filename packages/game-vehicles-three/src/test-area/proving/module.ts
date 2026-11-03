import { createVehicleCamera, mirrorPoses } from '@adatechnology/game-camera'
import type { MirrorPose, VehicleCameraMode, VehicleFrame, VehicleThreeLib } from '@adatechnology/game-camera'
import { markKitOrigin } from '@adatechnology/game-contracts'
import type { BenchChange, ModuleArea, ModuleControl, ModuleHost, ModuleLayer, ModuleMetric, ModuleScenario, TestableModule } from '@adatechnology/game-contracts'
import { CABIN_BANK, LIBRARY_BANK } from '@adatechnology/game-audio'
import type { VehicleKit } from '@adatechnology/game-vehicles'
import { createSemiSimDriver } from '@adatechnology/game-vehicles-driving'
import type { SemiDriver } from '@adatechnology/game-vehicles-driving'
import { certify, createProvingTests, startRun, statusOf, subjectSpec, withResult } from '@adatechnology/game-vehicles-proving'
import type { ProvingCertificate, ProvingResult, ProvingRun, ProvingSubject, ProvingTestRegistry } from '@adatechnology/game-vehicles-proving'
import { discardObject3D } from '@adatechnology/game-shapes-three'

import { createVehiclesThree } from '../../build'
import type { BuiltVehicle } from '../../build'
import { defaultSoundIds } from '../types'
import { createVehicleSound } from '../../audio/vehicle-sound'
import type { VehicleSound } from '../../audio/vehicle-sound'
import type { VehicleSoundIds } from '../types'
import { createCockpit } from './cockpit'
import type { Cockpit } from './cockpit'
import { fillText, PROVING_TEXT } from './text'
import type { ProvingText } from './text'

export const PROVING_AREA_ID = 'vehicles_proving'

type Three = any

/** Content comes in by option (the adapter does not import a content pack): the example wires the kit's fleet, a game its own catalogue. */
export interface ProvingModuleOptions {
  locale?: string
  /** Vehicles offered on the bench, by catalogue id. */
  vehicles: readonly string[]
  /** The proving subject of a vehicle (`fleetProvingSubject` of game-vehicles-fleet); `mass` is the kit's own when it has one. Null hides the vehicle. */
  subject(id: string, mass: number | undefined): ProvingSubject | null
  /** The vehicle's name on the bench and the board (default: the id). */
  nameOf?(id: string): string | undefined
  /** The tests (default: the kit's, see `createProvingTests`). */
  tests?: ProvingTestRegistry
  /** Builds the vehicle kit, with the catalogue installed, for a three.js namespace. */
  createKit(THREE: Three): VehicleKit
  sounds?: Partial<VehicleSoundIds>
  /** Called whenever a certificate changes (a result in, a sign-off), so a page can keep or show them. */
  onCertificate?(certificate: ProvingCertificate): void
}

/** Track: a straight strip along +x (the semi driver's forward at yaw 0), drawn as a 260 m tile the vehicle wraps on so a top-speed run of kilometres stays on the same tarmac. */
const TRACK = { x0: -30, z: 22, tile: 260, width: 14, start: 4 }
const SURFACE_LOOK: Record<string, { color: number; roughness: number }> = { dry_asphalt: { color: 0x2b2d31, roughness: 0.95 }, wet_asphalt: { color: 0x1c1f24, roughness: 0.18 }, mud: { color: 0x4a3524, roughness: 1 } }
const VISUAL_CHECKS = ['cabin', 'cameras', 'mirrors'] as const
const MIRROR_RECTS: Record<string, { x: number; y: number; width: number; height: number; rounded: number }> = {
  rear_view: { x: 0.38, y: 0.02, width: 0.24, height: 0.09, rounded: 0.35 },
  left: { x: 0.02, y: 0.72, width: 0.19, height: 0.13, rounded: 0.3 },
  right: { x: 0.79, y: 0.72, width: 0.19, height: 0.13, rounded: 0.3 },
  reverse: { x: 0.36, y: 0.13, width: 0.28, height: 0.18, rounded: 0.06 },
}

/**
 * The proving ground as a `TestableModule`: a track where a fleet vehicle runs the measured tests of `game-vehicles-proving` live (0-100, top speed, braking, turning circle, wet braking, mud)
 * on the same semi-simulation driver the headless runner uses, with the vehicle cameras of `game-camera` (chase, cockpit, hood) taking over the room's view, the rear-view and side mirrors
 * and the reversing camera with its guide lines as extra views of the host, a board by the track with the vehicle's certificate, and the sign-off of the visual checks.
 */
export function createProvingModule(options: ProvingModuleOptions): TestableModule & { certificates(): ProvingCertificate[]; certificate(id: string): ProvingCertificate | undefined } {
  const locale = options.locale ?? 'pt-BR'
  const text: ProvingText = PROVING_TEXT[locale] ?? (PROVING_TEXT['pt-BR'] as ProvingText)
  const tests = options.tests ?? createProvingTests()
  const vehicles = options.vehicles
  const sounds = { ...defaultSoundIds, ...options.sounds }
  const measured = tests.tests.filter((t) => t.kind === 'measured').map((t) => t.id)
  const settings = { vehicle: vehicles.includes('compact_hatch') ? 'compact_hatch' : (vehicles[0] ?? 'compact_hatch'), test: measured[0] ?? 'accel_0_100', camera: 'chase', timeScale: 4, visual: 'cameras' as string }
  const certificates = new Map<string, ProvingCertificate>()
  const kits = new WeakMap<object, VehicleKit>()

  let host: ModuleHost | null = null
  let three: Three = null
  let track: any = null
  let strip: any = null
  let board: { mesh: any; canvas: any; texture: any } | null = null
  let car: { built: BuiltVehicle; guides: any; subject: ProvingSubject } | null = null
  let run: ProvingRun | null = null
  let parking: { driver: SemiDriver; time: number } | null = null
  /** The player at the wheel: the room's walking keys are held and the vehicle takes them. */
  let driving: Cockpit | null = null
  let gearbox: 'automatic' | 'manual' = 'automatic'
  let lastGear: number | null = null
  let driveClock = 0
  let queue: string[] = []
  /** True while the room has this area open: nothing is built or simulated otherwise, so loading the module costs nothing elsewhere in the room. */
  let open = false
  let lastWrap = 0
  // the car's own sounds (engine by RPM and load, starter, tyres), as on the lane of the vehicles area
  let engine: VehicleSound | undefined
  const rig = { camera: null as any, vehicle: null as ReturnType<typeof createVehicleCamera> | null, mirrors: [] as Array<{ pose: MirrorPose; camera: any; remove: () => void }> }

  const name = (id: string): string => options.nameOf?.(id) ?? id.replace(/_/g, ' ')
  const kitFor = (THREE: Three): VehicleKit => {
    let kit = kits.get(THREE)
    if (!kit) {
      kit = options.createKit(THREE)
      kits.set(THREE, kit)
    }
    return kit
  }
  const subjectOf = (id: string): ProvingSubject | null => {
    const mass = three ? (kitFor(three).find(id) as { mass?: number } | null)?.mass : undefined
    return options.subject(id, mass)
  }
  const blank = (subject: ProvingSubject): ProvingCertificate => {
    const results: ProvingResult[] = tests.forDomain(subject.domain).map((t) => ({ test: t.id, kind: t.kind, unit: t.unit, range: t.range?.(subject) ?? {}, value: null, verdict: 'pending', note: t.kind === 'measured' ? 'not run' : t.kind === 'visual' ? 'awaiting sign-off' : 'room not built yet' }))
    return { vehicle: subject.id, domain: subject.domain, category: subject.category, status: statusOf(results), results }
  }
  const certificateOf = (id: string): ProvingCertificate | undefined => {
    if (!certificates.has(id)) {
      const subject = subjectOf(id)
      if (subject) certificates.set(id, blank(subject))
    }
    return certificates.get(id)
  }
  const store = (certificate: ProvingCertificate): void => {
    certificates.set(certificate.vehicle, certificate)
    options.onCertificate?.(certificate)
    drawBoard()
  }

  // ---- the track ----------------------------------------------------------------------------------------------------------------------
  const buildTrack = (): void => {
    if (!host || track) return
    const THREE = three
    track = markKitOrigin(new THREE.Group(), { owner: '@adatechnology/game-vehicles-three', kind: 'room', id: 'proving_track' })
    track.name = 'proving_track'
    const look = SURFACE_LOOK.dry_asphalt!
    strip = new THREE.Mesh(new THREE.PlaneGeometry(TRACK.tile + 80, TRACK.width), new THREE.MeshStandardMaterial({ color: look.color, roughness: look.roughness, metalness: 0.05 }))
    strip.rotation.x = -Math.PI / 2
    strip.position.set(TRACK.x0 + TRACK.tile / 2, 0.012, TRACK.z)
    strip.receiveShadow = true
    track.add(strip)
    const paint = new THREE.MeshBasicMaterial({ color: 0xe8e8e2 })
    const yellow = new THREE.MeshBasicMaterial({ color: 0xf2c230 })
    const dash = new THREE.PlaneGeometry(3, 0.14)
    const edge = new THREE.PlaneGeometry(TRACK.tile + 80, 0.16)
    for (const side of [-1, 1]) {
      const line = new THREE.Mesh(edge, paint)
      line.rotation.x = -Math.PI / 2
      line.position.set(TRACK.x0 + TRACK.tile / 2, 0.016, TRACK.z + side * (TRACK.width / 2 - 0.4))
      track.add(line)
    }
    for (let x = TRACK.x0 - 40; x < TRACK.x0 + TRACK.tile + 40; x += 9) {
      const d = new THREE.Mesh(dash, paint)
      d.rotation.x = -Math.PI / 2
      d.position.set(x, 0.016, TRACK.z - 1.5)
      track.add(d)
    }
    // a distance board every 50 m of the tile and the start line
    const post = new THREE.BoxGeometry(0.12, 1.4, 0.12)
    const plate = new THREE.BoxGeometry(0.06, 0.5, 0.9)
    for (let m = 0; m <= TRACK.tile; m += 50) {
      const p = new THREE.Mesh(post, yellow)
      p.position.set(TRACK.x0 + m, 0.7, TRACK.z - TRACK.width / 2 - 0.6)
      const q = new THREE.Mesh(plate, m === 0 ? yellow : paint)
      q.position.set(TRACK.x0 + m, 1.45, TRACK.z - TRACK.width / 2 - 0.6)
      track.add(p, q)
    }
    const startLine = new THREE.Mesh(new THREE.PlaneGeometry(0.5, TRACK.width - 1), yellow)
    startLine.rotation.x = -Math.PI / 2
    startLine.position.set(TRACK.x0, 0.017, TRACK.z)
    track.add(startLine)
    ;(host.scene as any).add(track)
    buildBoard()
  }
  const setSurface = (surface: string): void => {
    if (!strip) return
    const look = SURFACE_LOOK[surface] ?? SURFACE_LOOK.dry_asphalt!
    strip.material.color.setHex(look.color)
    strip.material.roughness = look.roughness
  }

  // ---- the certificate board ------------------------------------------------------------------------------------------------------------
  const buildBoard = (): void => {
    if (!host || board || typeof document === 'undefined') return
    const THREE = three
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 640
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    const mesh = markKitOrigin(new THREE.Mesh(new THREE.PlaneGeometry(9.6, 6), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })), { owner: '@adatechnology/game-vehicles-three', kind: 'room', id: 'proving_board' })
    mesh.position.set(TRACK.x0 + 6, 3.6, TRACK.z - TRACK.width / 2 - 3)
    const legs = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0x1c1f25 }))
    legs.position.set(0, -3.1, -0.05)
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.4, 0.25), legs.material)
    stand.position.set(0, -4.6, -0.1)
    mesh.add(legs, stand)
    track.add(mesh)
    board = { mesh, canvas, texture }
    drawBoard()
  }
  const fmtRange = (r: ProvingResult['range']): string => (r.min == null && r.max == null ? '—' : `${r.min ?? '…'}–${r.max ?? '…'}`)
  const drawBoard = (): void => {
    if (!board) return
    const cert = certificateOf(settings.vehicle)
    const g = board.canvas.getContext('2d')
    if (!g || !cert) return
    const W = board.canvas.width
    g.fillStyle = '#16181c'
    g.fillRect(0, 0, W, board.canvas.height)
    g.fillStyle = '#f2c230'
    g.fillRect(0, 0, W, 10)
    g.font = '600 26px monospace'
    g.fillStyle = '#8d95a3'
    g.fillText(text.board.title.toUpperCase(), 32, 50)
    g.font = '700 46px sans-serif'
    g.fillStyle = '#e7e9ec'
    g.fillText(name(cert.vehicle), 32, 102)
    const colour = { approved: '#5cc98a', rejected: '#ef6a5b', pending: '#a7a0f0' }[cert.status]
    g.font = '700 34px sans-serif'
    const status = text.status[cert.status]
    const sw = g.measureText(status).width + 32
    g.strokeStyle = colour
    g.lineWidth = 3
    g.strokeRect(W - sw - 32, 66, sw, 48)
    g.fillStyle = colour
    g.fillText(status, W - sw - 16, 102)
    g.font = '22px monospace'
    g.fillStyle = '#8d95a3'
    const cols = [32, 430, 640, 860]
    ;[text.board.test, text.board.value, text.board.range, text.board.verdict].forEach((h, i) => g.fillText(h.toUpperCase(), cols[i]!, 150))
    let y = 190
    for (const r of cert.results) {
      const live = run && run.test.id === r.test && !run.done
      g.fillStyle = '#e7e9ec'
      g.font = '26px sans-serif'
      g.fillText(text.tests[r.test] ?? r.test, cols[0]!, y)
      g.font = '26px monospace'
      g.fillStyle = '#5fd4e0'
      const value = live ? text.board.running : r.value == null ? (r.kind === 'measured' && r.note === 'not run' ? text.board.notRun : '—') : `${r.value} ${r.unit}`
      g.fillText(value, cols[1]!, y)
      g.fillStyle = '#8d95a3'
      g.fillText(r.kind === 'measured' ? fmtRange(r.range) : r.kind === 'visual' ? 'visual' : 'sala', cols[2]!, y)
      g.fillStyle = { pass: '#5cc98a', fail: '#ef6a5b', pending: '#a7a0f0' }[r.verdict]
      g.fillText(r.verdict === 'pass' ? '✓ ' + text.verdict.pass : r.verdict === 'fail' ? '✗ ' + text.verdict.fail : '…', cols[3]!, y)
      y += 30
    }
    // the gearbox live: the gear and the engine speed of the run or of the driver
    const live = run?.driver.state ?? driving?.driver.state
    if (live) {
      g.font = '24px monospace'
      g.fillStyle = '#f2c230'
      g.fillText(fillText(text.board.gear, gearName(live.gear), Math.round(live.rpm), Math.round(Math.abs(live.u) * 3.6)), cols[0]!, y + 16)
    }
    board.texture.needsUpdate = true
  }

  // ---- the vehicle ----------------------------------------------------------------------------------------------------------------------
  const removeCar = (): void => {
    if (!car) return
    discardObject3D(car.built.group)
    car = null
  }
  const placeCar = (): void => {
    if (!host || !three) return
    const subject = subjectOf(settings.vehicle)
    if (!subject) return
    removeCar()
    const built = createVehiclesThree(three, { kit: kitFor(three) }).build(settings.vehicle, { quality: 'high' })
    const guides = reverseGuides(built)
    built.group.add(guides)
    ;(host.scene as any).add(built.group)
    car = { built, guides, subject }
    pose({ x: 0, z: TRACK.start, yaw: 0, pitch: 0, roll: 0, height: 0 }, 0)
    rig.vehicle?.reset()
    drawBoard()
  }
  /** Guide lines of the reversing camera (on layer 1, which only that camera sees): green, yellow and red at 3, 2 and 1 m behind the bumper, bending with the steering. */
  const reverseGuides = (built: BuiltVehicle): any => {
    const THREE = three
    const group = new THREE.Group()
    group.name = 'reverse_guides'
    const half = built.width / 2 - 0.05
    const tail = -built.length / 2
    const bands: Array<[number, number, number]> = [
      [0.2, 1, 0xef4a3b],
      [1, 2, 0xf2c230],
      [2, 3.2, 0x5cc98a],
    ]
    for (const [a, b, colour] of bands) {
      const material = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.85, depthTest: false })
      for (const side of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.06, b - a), material)
        bar.rotation.x = -Math.PI / 2
        bar.position.set(side * half, 0.03, tail - (a + b) / 2)
        bar.userData.side = side
        bar.userData.mid = (a + b) / 2
        group.add(bar)
      }
      const cross = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, 0.05), material)
      cross.rotation.x = -Math.PI / 2
      cross.position.set(0, 0.03, tail - a)
      cross.userData.mid = a
      group.add(cross)
    }
    group.traverse((o: any) => o.layers.set(1))
    return group
  }
  const bendGuides = (steer: number): void => {
    if (!car) return
    // the lines follow the arc the rear will take: sideways offset grows with the square of the distance
    for (const bar of car.guides.children) {
      const d = bar.userData.mid as number
      const offset = -steer * 0.18 * d * d
      bar.position.x = (bar.userData.side ?? 0) * (car.built.width / 2 - 0.05) + offset
    }
  }
  const pose = (s: { x: number; z: number; yaw: number; pitch: number; roll: number; height: number }, steer: number): void => {
    if (!car) return
    const wrapped = ((s.x % TRACK.tile) + TRACK.tile) % TRACK.tile
    if (Math.abs(wrapped - lastWrap) > TRACK.tile / 2) rig.vehicle?.reset()
    lastWrap = wrapped
    car.built.group.position.set(TRACK.x0 + wrapped, 0, TRACK.z + s.z)
    car.built.group.rotation.set(-s.pitch, s.yaw + Math.PI / 2, s.roll, 'YXZ')
    bendGuides(steer)
  }
  const frameOf = (speed: number): VehicleFrame | null => {
    if (!car) return null
    const g = car.built.group
    return { x: g.position.x, y: g.position.y, z: g.position.z, yaw: g.rotation.y, pitch: -g.rotation.x, roll: g.rotation.z, speed, length: car.built.length, width: car.built.width, height: car.built.height, ...(car.built.driverEye ? { eye: car.built.driverEye } : {}) }
  }

  // ---- cameras and mirrors --------------------------------------------------------------------------------------------------------------
  const applyCamera = (): void => {
    if (!host?.setViewCamera) return
    host.setViewCamera(settings.camera === 'room' ? null : rig.camera)
    if (settings.camera !== 'room') rig.vehicle?.setMode(settings.camera as VehicleCameraMode)
  }
  const refreshMirrors = (): void => {
    for (const m of rig.mirrors) m.remove()
    rig.mirrors = []
    if (!host?.addView || !car) return
    const poses = mirrorPoses(car.built)
    const want = (id: string): boolean => (id === 'reverse' ? !!host?.bench?.layer('reverse_camera') : !!host?.bench?.layer('mirrors'))
    for (const pose of poses) {
      if (!want(pose.id)) continue
      const camera = new three.PerspectiveCamera(pose.fov, 2, 0.05, 400)
      if (pose.id === 'reverse') camera.layers.enable(1)
      const rect = MIRROR_RECTS[pose.id]!
      const remove = host.addView({ camera, rect, mirror: pose.mirror, rounded: rect.rounded, label: pose.id, resolution: pose.id === 'reverse' ? 0.6 : 0.45 })
      rig.mirrors.push({ pose, camera, remove })
    }
  }
  let mirrorKey = ''

  // ---- runs -----------------------------------------------------------------------------------------------------------------------------
  const stopEngine = (): void => {
    engine?.dispose()
    engine = undefined
  }
  const startTest = (id: string): void => {
    const test = tests.get(id)
    if (!host || !test || test.kind !== 'measured') return
    if (!car || car.subject.id !== settings.vehicle) placeCar()
    if (!car) return
    parking = null
    run = startRun(test, car.subject)
    setSurface(run.surface)
    // the turning circle needs room on the left: start it at the right edge
    if (id === 'turn_circle') run.driver.place(0, TRACK.start, 0)
    rig.vehicle?.reset()
    stopEngine()
    engine = createVehicleSound(host.audio, { sounds })
    engine.start([car.built.group.position.x, 0.5, car.built.group.position.z])
    host.log(fillText(text.log.start, name(settings.vehicle), text.tests[id] ?? id))
    drawBoard()
  }
  const finishTest = (): void => {
    if (!run || !car) return
    const result = run.result()
    const cert = certificateOf(car.subject.id)
    if (cert) store(withResult(cert, result))
    host?.log(fillText(text.log.result, name(car.subject.id), text.tests[result.test] ?? result.test, result.value ?? '—', result.unit, fmtRange(result.range), result.verdict), { vehicle: car.subject.id, ...result, trace: undefined }, 'proving_result')
    run = null
    stopEngine()
    const next = queue.shift()
    if (next) startTest(next)
    else setSurface('dry_asphalt')
  }
  const startParking = (): void => {
    if (!host) return
    if (!car || car.subject.id !== settings.vehicle) placeCar()
    if (!car) return
    run = null
    queue = []
    setSurface('dry_asphalt')
    const driver = createSemiSimDriver(subjectSpec(car.subject))
    driver.place(40, 0, 0)
    parking = { driver, time: 0 }
  }

  const stopDriving = (): void => {
    if (!driving) return
    driving.stop()
    driving = null
    host?.holdPlayer?.(false)
    host?.bench?.sheet?.(null)
    stopEngine()
    host?.log(text.log.leave)
  }
  const startDriving = (): void => {
    if (!host || !three) return
    if (!car || car.subject.id !== settings.vehicle) placeCar()
    if (!car) return
    run = null
    queue = []
    parking = null
    setSurface('dry_asphalt')
    driving = createCockpit({
      THREE: three,
      host,
      built: car.built,
      subject: car.subject,
      place: [0, 0, 0],
      // the engine's own sound turns the key (starter, catch, idle by RPM)
      sounds: { starter: '' },
      onExit: () => stopDriving(),
      onEvent: (event) => {
        if (event.type === 'refused') return host?.log(text.cabin.refused[event.reason] ?? event.reason)
        const st = event.state
        const line = cabinLine(event.command, st)
        if (line) host?.log(line)
        if (event.command === 'ignition' && car) {
          const at: [number, number, number] = [car.built.group.position.x, 0.5, car.built.group.position.z]
          if (st.ignition) engine?.start(at)
          else engine?.stop(at)
        }
        if (event.command === 'gearbox') {
          gearbox = st.gearbox
          host?.bench?.patch('gearbox', { value: st.gearbox })
        }
      },
    })
    if (gearbox !== driving.controls.state.gearbox) driving.controls.command('gearbox')
    host.holdPlayer?.(true)
    if (settings.camera === 'room') {
      settings.camera = 'cockpit'
      host.bench?.patch('camera', { value: 'cockpit' })
      applyCamera()
    }
    rig.vehicle?.reset()
    stopEngine()
    // the engine is off until the key turns (I): the sound cranks, catches and idles by the RPM
    engine = createVehicleSound(host.audio, { sounds })
    host.bench?.sheet?.({ kicker: text.name, title: fillText(text.log.drive, name(settings.vehicle)), body: text.cabin.keys })
    host.log(fillText(text.log.drive, name(settings.vehicle)))
  }
  const onOff = (on: boolean): string => (on ? text.cabin.on : text.cabin.off)
  const cabinLine = (command: string, st: Cockpit['controls']['state']): string | null => {
    const c = text.cabin
    switch (command) {
      case 'ignition': return `${c.ignition}: ${onOff(st.ignition)}`
      case 'gearbox': return `${c.gearbox}: ${text.gearbox[st.gearbox]}`
      case 'gear_up':
      case 'gear_down': return `${c.gear}: ${gearName(st.gear)}`
      case 'parking_brake': return `${c.parkingBrake}: ${onOff(st.parkingBrake)}`
      case 'drive_mode': return `${c.driveMode}: ${c.modes[st.driveMode]}`
      case 'lights':
      case 'high_beam': return `${c.lights}: ${c.lampModes[st.lamps.mode]}`
      case 'fog_lights': return `${c.fog}: ${onOff(st.lamps.fog)}`
      case 'interior_light': return `${c.interior}: ${onOff(st.lamps.interior)}`
      case 'alarm': return `${c.alarm}: ${c.alarmStates[st.alarm]}`
      case 'radio':
      case 'radio_source': return `${c.radio}: ${st.radio.on ? c.sources[st.radio.source] : c.off}`
      case 'indicator_left':
      case 'indicator_right':
      case 'hazard': return `${c.indicator}: ${c.indicators[st.indicator]}`
      case 'wipers': return `${c.wipers}: ${c.wiperModes[st.wipers]}`
      case 'seatbelt': return `${c.seatbelt}: ${onOff(st.seatbelt)}`
      default: return null
    }
  }
  const gearName = (gear: number): string => (gear < 0 ? 'R' : gear === 0 ? 'N' : String(gear))

  const onChange = (change: BenchChange): void => {
    if (change.kind === 'layer') {
      if (change.id === 'scoreboard' && board) board.mesh.visible = !!host?.bench?.layer('scoreboard')
      return refreshMirrors()
    }
    if (change.kind === 'action') {
      if (change.id === 'drive') return driving ? stopDriving() : startDriving()
      if (change.id === 'run_test' || change.id === 'run_all' || change.id === 'reverse_park') stopDriving()
      if (change.id === 'run_test') {
        queue = []
        startTest(settings.test)
      } else if (change.id === 'run_all') {
        queue = measured.slice(1)
        startTest(measured[0]!)
      } else if (change.id === 'certify_now') {
        const subject = subjectOf(settings.vehicle)
        if (!subject) return
        const prior = certificateOf(subject.id)
        const signOffs = (prior?.results ?? []).filter((r) => r.kind !== 'measured' && r.verdict !== 'pending').map((r) => ({ vehicle: subject.id, test: r.test, ok: r.verdict === 'pass', by: r.signedBy ?? 'test room' }))
        const cert = certify(subject, { tests, signOffs })
        store(cert)
        host?.log(fillText(text.log.certified, name(subject.id), text.status[cert.status]), { vehicle: subject.id, status: cert.status }, 'proving_certificate')
      } else if (change.id === 'reverse_park') startParking()
      else if (change.id === 'sign_ok' || change.id === 'sign_fail') {
        const cert = certificateOf(settings.vehicle)
        if (!cert) return
        const ok = change.id === 'sign_ok'
        store(withResult(cert, { test: settings.visual, kind: 'visual', unit: '', range: {}, value: null, verdict: ok ? 'pass' : 'fail', signedBy: 'test room' }))
        host?.log(fillText(text.log.signed, name(settings.vehicle), text.tests[settings.visual] ?? settings.visual, ok ? text.verdict.pass : text.verdict.fail))
      } else if (change.id === 'reset') {
        const subject = subjectOf(settings.vehicle)
        if (subject) store(blank(subject))
      }
      return
    }
    switch (change.id) {
      case 'vehicle':
        settings.vehicle = String(change.value)
        stopDriving()
        run = null
        queue = []
        parking = null
        stopEngine()
        placeCar()
        refreshMirrors()
        break
      case 'test':
        settings.test = String(change.value)
        break
      case 'camera':
        settings.camera = String(change.value)
        applyCamera()
        break
      case 'time_scale':
        settings.timeScale = Number(change.value)
        break
      case 'gearbox':
        gearbox = change.value === 'manual' ? 'manual' : 'automatic'
        if (driving && driving.controls.state.gearbox !== gearbox) driving.controls.command('gearbox')
        break
      case 'visual_check':
        settings.visual = String(change.value)
        break
      default:
        break
    }
  }

  const frame = (dt: number): void => {
    if (!host || !open) return
    if (!track) buildTrack()
    if (!car) {
      placeCar()
      refreshMirrors()
    }
    let speed = 0
    let steer = 0
    if (run) {
      run.step(dt * settings.timeScale)
      const s = run.driver.state
      pose(s, s.steerAngle)
      speed = s.u
      steer = s.steerAngle
      if (run.done) finishTest()
    } else if (driving) {
      const d = driving
      d.step(dt)
      if (!driving) return
      pose(d.driver.state, d.driver.state.steerAngle)
      speed = d.driver.state.u
      steer = d.driver.state.steerAngle
    } else if (parking) {
      // backs up 12 m along a gentle curve to the right, the way a driver parks watching the reversing camera
      parking.time += dt
      const p = parking
      p.driver.step({ throttle: 0, brake: p.time < 7 ? 0.35 : 1, steer: p.time > 2 ? -0.6 : 0, handbrake: false }, dt)
      pose(p.driver.state, p.driver.state.steerAngle)
      speed = p.driver.state.u
      steer = p.driver.state.steerAngle
      if (p.time > 9) parking = null
    }
    if (car) engine?.update({ dt, position: [car.built.group.position.x, 0.5, car.built.group.position.z], speed, throttle: run ? 1 : (driving?.throttle ?? 0), rpm: driving ? driving.driver.state.rpm : undefined })
    const f = frameOf(speed)
    if (f && rig.vehicle && settings.camera !== 'room') rig.vehicle.update(rig.camera, f, dt)
    if (f && rig.vehicle) for (const m of rig.mirrors) rig.vehicle.placeMirror(m.camera, m.pose, f)
    void steer
    const key = `${host.bench?.layer('mirrors')}|${host.bench?.layer('reverse_camera')}`
    if (key !== mirrorKey) {
      mirrorKey = key
      refreshMirrors()
    }
    // each shift of the gearbox goes to the log (the automatic climbs the gears on a run, the driver shifts by hand)
    const geared = run?.driver.state ?? driving?.driver.state
    if (geared && geared.gear !== lastGear) {
      if (lastGear !== null && geared.gear > 0) host.log(fillText(text.log.shift, gearName(lastGear), gearName(geared.gear), Math.round(Math.abs(geared.u) * 3.6)), { from: lastGear, to: geared.gear, kmh: +(Math.abs(geared.u) * 3.6).toFixed(1), rpm: Math.round(geared.rpm) }, 'proving_shift')
      lastGear = geared.gear
      drawBoard()
    } else if (!geared) lastGear = null
    if ((run && Math.floor(run.time * 2) !== Math.floor((run.time - dt * settings.timeScale) * 2)) || (driving && Math.floor(driveClock * 2) !== Math.floor((driveClock - dt) * 2))) drawBoard()
    if (driving) driveClock += dt
  }

  const speedNow = (): number => Math.abs(run?.driver.state.u ?? driving?.driver.state.u ?? parking?.driver.state.u ?? 0) * 3.6
  const counts = (verdict: 'pass' | 'fail' | 'pending'): number => certificateOf(settings.vehicle)?.results.filter((r) => r.verdict === verdict).length ?? 0

  const teardown = (): void => {
    stopDriving()
    stopEngine()
    for (const m of rig.mirrors) m.remove()
    rig.mirrors = []
    removeCar()
    mirrorKey = ''
    if (track) discardObject3D(track)
    track = null
    strip = null
    board = null
    run = null
    parking = null
  }

  return {
    id: PROVING_AREA_ID,
    name: text.name,
    group: text.name,
    ground: { surface: 'road' },
    certificates: () => [...certificates.values()],
    certificate: (id) => certificateOf(id),
    items: () => [],
    area: (): ModuleArea => {
      // the room asks for the layout right after clearing for this area: from now on the track is built and the runs step
      open = true
      applyCamera()
      // the room's own view opens by the start line, the board in front and the track running away to the right
      return { placements: [], view: { eye: [TRACK.x0 - 4, 3.2, TRACK.z + 9], target: [TRACK.x0 + 6, 2.2, TRACK.z - TRACK.width / 2 - 3] } }
    },
    controls: (): ModuleControl[] => [
      { kind: 'choice', id: 'vehicle', name: text.controls.vehicle, hint: text.hints.vehicle, options: vehicles.map((id) => ({ id, name: name(id) })), default: settings.vehicle },
      { kind: 'choice', id: 'test', name: text.controls.test, hint: text.hints.test, options: measured.map((id) => ({ id, name: text.tests[id] ?? id })), default: settings.test },
      { kind: 'choice', id: 'camera', name: text.controls.camera, hint: text.hints.camera, options: (['room', 'chase', 'cockpit', 'hood'] as const).map((id) => ({ id, name: text.cameras[id] })), default: settings.camera },
      { kind: 'number', id: 'time_scale', name: text.controls.time_scale, hint: text.hints.time_scale, min: 1, max: 20, step: 1, default: settings.timeScale },
      { kind: 'choice', id: 'visual_check', name: text.controls.visual_check, hint: text.hints.visual_check, options: VISUAL_CHECKS.map((id) => ({ id, name: text.tests[id] ?? id })), default: settings.visual },
      { kind: 'action', id: 'drive', name: text.actions.drive },
      { kind: 'choice', id: 'gearbox', name: text.controls.gearbox, hint: text.hints.gearbox, options: (['automatic', 'manual'] as const).map((id) => ({ id, name: text.gearbox[id] })), default: gearbox },
      { kind: 'action', id: 'run_test', name: text.actions.run_test },
      { kind: 'action', id: 'run_all', name: text.actions.run_all },
      { kind: 'action', id: 'certify_now', name: text.actions.certify_now },
      { kind: 'action', id: 'reverse_park', name: text.actions.reverse_park },
      { kind: 'action', id: 'sign_ok', name: text.actions.sign_ok },
      { kind: 'action', id: 'sign_fail', name: text.actions.sign_fail },
      { kind: 'action', id: 'reset', name: text.actions.reset },
    ],
    layers: (): ModuleLayer[] => [
      { id: 'mirrors', name: text.layers.mirrors, default: false },
      { id: 'reverse_camera', name: text.layers.reverse_camera, default: false },
      { id: 'scoreboard', name: text.layers.scoreboard, default: true },
    ],
    metrics: (): ModuleMetric[] => [
      { id: 'speed', name: text.metrics.speed, unit: 'km/h', digits: 0, read: speedNow },
      { id: 'gear', name: text.metrics.gear, read: () => driving?.driver.state.gear ?? run?.driver.state.gear ?? 0 },
      { id: 'rpm', name: text.metrics.rpm, unit: 'rpm', digits: 0, read: () => driving?.driver.state.rpm ?? run?.driver.state.rpm ?? 0 },
      { id: 'time', name: text.metrics.time, unit: 's', digits: 1, read: () => run?.time ?? 0 },
      { id: 'value', name: text.metrics.value, digits: 1, read: () => (run ? (run.trace[run.trace.length - 1]?.[1] ?? 0) : 0) },
      { id: 'passed', name: text.metrics.passed, read: () => counts('pass') },
      { id: 'failed', name: text.metrics.failed, read: () => counts('fail') },
      { id: 'pending', name: text.metrics.pending, read: () => counts('pending') },
      { id: 'status', name: text.metrics.status, read: () => ({ approved: 1, rejected: -1, pending: 0 })[certificateOf(settings.vehicle)?.status ?? 'pending'] },
    ],
    scenarios: (): ModuleScenario[] => [],
    attach(lent) {
      host = lent
      three = lent.THREE
      rig.camera = new three.PerspectiveCamera(60, 1.6, 0.05, 900)
      rig.vehicle = createVehicleCamera(three as VehicleThreeLib)
      lent.audio?.register?.(LIBRARY_BANK)
      lent.audio?.register?.(CABIN_BANK)
      const stopChange = lent.bench?.onChange(onChange)
      const stopFrame = lent.onFrame(frame)
      const stopClear = lent.onClear?.(() => {
        // the room cleared its area (another area opens, or this one again): the track and the car go until `area()` is asked again
        open = false
        teardown()
        lent.setViewCamera?.(null)
      })
      return () => {
        stopChange?.()
        stopFrame()
        stopClear?.()
        teardown()
        lent.setViewCamera?.(null)
        host = null
      }
    },
  }
}

/** What `loadProvingModule` needs of a room: `TestRoom.loadModule` has it. */
export type ProvingRoomLike = { loadModule(module: never): unknown; openArea?(id: string): unknown }

export function loadProvingModule<Room extends ProvingRoomLike>(room: Room, options: ProvingModuleOptions): ReturnType<Room['loadModule']> {
  return room.loadModule(createProvingModule(options) as never) as ReturnType<Room['loadModule']>
}
