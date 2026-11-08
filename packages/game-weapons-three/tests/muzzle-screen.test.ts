import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import type { EffectSink, ModuleHost } from '@adatechnology/game-contracts'
import { WEAPONS, createArsenal } from '@adatechnology/game-weapons'
import { createWeaponsTestModule, hasWeaponModel } from '../src'
import { VIEWMODEL_EFFECT_IDS } from '../src/fx/effects'

// what the player sees: the tip of the barrel as it is drawn, and where the tracer starts and the flash burns, in pixels of a 1280 x 720 view
const VIEW = { width: 1280, height: 720 }
const MAX_PIXELS = 6
const TRACER_COLOR = 0xffe9a8

// the view turning while the flash burns: 2 rad/s, a steady sweep of the mouse (the flash lives 55 ms, about three frames)
const TURN_RATE = 2
const TURN_FRAMES = 3

type Sample = { readonly weapon: string; readonly view: string; readonly mode: string; readonly flash: number | null; readonly tracer: number | null; readonly smoke: number | null; readonly missing?: string }

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

const rooms: TestRoom[] = []
afterEach(() => {
  for (const room of rooms.splice(0)) room.dispose()
})

/** A room with the weapons module, the flashes it plays and the lens it draws the weapon with. */
function measuredRoom(): { room: TestRoom; canvas: HTMLCanvasElement; flashes: THREE.Vector3[]; smokes: THREE.Vector3[]; lens: () => number | null } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const arsenal = createArsenal({ seed: 1, rules: { faults: false } })
  const renderer = stubRenderer()
  container.appendChild(renderer.domElement)
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer, ui: false, arsenal })
  rooms.push(room)
  room.camera.aspect = VIEW.width / VIEW.height
  room.camera.updateProjectionMatrix()
  const flashes: THREE.Vector3[] = []
  const smokes: THREE.Vector3[] = []
  let lensFov: number | null = null
  const module = createWeaponsTestModule({ locale: 'en', arsenal })
  const attachModule = module.attach
  if (!attachModule) throw new Error('the weapons module attaches to the room')
  const attach = attachModule.bind(module)
  module.attach = (lent: ModuleHost) => {
    const own = lent.setViewmodelFov?.bind(lent)
    ;(lent as { setViewmodelFov?: (fov: number | null) => void }).setViewmodelFov = (fov) => {
      lensFov = fov
      own?.(fov)
    }
    // the flashes the module plays, where it plays them
    const sink = lent.effects
    if (sink) {
      const play = sink.play.bind(sink)
      ;(lent as { effects?: EffectSink }).effects = {
        ...sink,
        play: (request) => {
          if (request.effect === VIEWMODEL_EFFECT_IDS.flash && request.point) flashes.push(new THREE.Vector3(...request.point))
          if (request.effect === VIEWMODEL_EFFECT_IDS.smoke && request.point) smokes.push(new THREE.Vector3(...request.point))
          return play(request)
        },
      }
    }
    return attach(lent)
  }
  expect(room.loadModule(module).problems).toEqual([])
  return { room, canvas: renderer.domElement, flashes, smokes, lens: () => lensFov }
}

const run = (room: TestRoom, frames: number): void => {
  for (let i = 0; i < frames; i++) room.update(1 / 60)
}

/** The point in pixels where `camera` draws `at`. */
const pixels = (camera: THREE.PerspectiveCamera, at: THREE.Vector3): THREE.Vector2 => {
  const p = at.clone().project(camera)
  return new THREE.Vector2(((p.x + 1) / 2) * VIEW.width, ((1 - p.y) / 2) * VIEW.height)
}

/** The newest tracer line's first point, or null. */
const newestTracer = (room: TestRoom, before: ReadonlySet<THREE.Object3D>): THREE.Vector3 | null => {
  let found: THREE.Vector3 | null = null
  room.scene.traverse((object) => {
    const line = object as THREE.Line
    if (!line.isLine || !line.visible || before.has(line)) return
    const material = line.material as THREE.LineBasicMaterial
    if (material.color?.getHex() !== TRACER_COLOR) return
    const start = line.geometry.getAttribute('position')
    found = new THREE.Vector3(start.getX(0), start.getY(0), start.getZ(0)).applyMatrix4(line.matrixWorld)
  })
  return found
}

/** Where the eye looks from, turned `yaw` radians to the left of straight down the range. */
const lookTurned = (room: TestRoom, yaw: number): void => room.look([0, 1.7, 5], [-Math.sin(yaw) * 16, 1.6, 5 - Math.cos(yaw) * 16])

/**
 * Fires with `weapon` at the hip and aimed, a shot and a half-second burst each, and a shot while the view sweeps, and answers how many pixels the flash, the tracer and the
 * smoke start from the tip of the drawn barrel, and how far the burning flash is from it while the view sweeps.
 */
function measure(weapon: string, view: 'first' | 'third'): Sample[] {
  const measured = measuredRoom()
  const { room, canvas } = measured
  room.setCameraMode(view)
  lookTurned(room, 0)
  run(room, 30)
  room.setTool(weapon)
  run(room, 120)
  const samples: Sample[] = []
  for (const aimed of [false, true]) {
    if (aimed) {
      canvas.dispatchEvent(new MouseEvent('mousedown', { button: 2, cancelable: true, bubbles: true }))
      run(room, 60)
    }
    for (const burst of [false, true]) {
      samples.push({ weapon, view, mode: `${aimed ? 'aimed' : 'hip'} ${burst ? 'burst' : 'single'}`, ...fire(measured, view, burst ? 'burst' : 'single') })
      // the gun settles and the barrel cools a little between the strings
      run(room, 90)
    }
  }
  canvas.dispatchEvent(new MouseEvent('mouseup', { button: 2, cancelable: true, bubbles: true }))
  run(room, 60)
  samples.push({ weapon, view, mode: 'hip sweeping', ...fire(measured, view, 'sweep') })
  return samples
}

type Measured = ReturnType<typeof measuredRoom>
type Errors = { flash: number | null; tracer: number | null; smoke: number | null; missing?: string }

/** The drawn tip of the barrel in pixels, the camera the world is drawn with now, and a way back to the player's camera. */
function drawnTip(measured: Measured, view: 'first' | 'third'): { tip: THREE.Vector2; camera: THREE.PerspectiveCamera } | null {
  const { room, lens } = measured
  const mark = room.scene.getObjectByName('weapon-viewmodel')?.getObjectByName('muzzle')
  if (!mark) return null
  const restore = room.applyCamera()
  const camera = room.camera.clone()
  camera.aspect = VIEW.width / VIEW.height
  const drawnBy = camera.clone()
  if (view === 'first' && lens() !== null) drawnBy.fov = lens() ?? camera.fov
  camera.updateProjectionMatrix()
  drawnBy.updateProjectionMatrix()
  const tip = pixels(drawnBy, mark.getWorldPosition(new THREE.Vector3()))
  restore()
  return { tip, camera }
}

/** The groups of the flashes burning now (their additive pieces sit at the group's place). */
const burningFlashes = (room: TestRoom): THREE.Vector3[] =>
  (room.vfx.peekWorkshop()?.meshes.particles ?? []).filter((piece) => piece.additive && piece.age < piece.life).map((piece) => new THREE.Vector3(piece.x, piece.y, piece.z))

const worst = (current: number | null, next: number): number => Math.max(current ?? 0, next)

function fire(measured: Measured, view: 'first' | 'third', mode: 'single' | 'burst' | 'sweep'): Errors {
  const { room, flashes, smokes } = measured
  const lines = new Set<THREE.Object3D>()
  room.scene.traverse((object) => void ((object as THREE.Line).isLine && lines.add(object)))
  const errors: Errors = { flash: null, tracer: null, smoke: null }
  const frames = mode === 'burst' ? 30 : 1
  for (let frame = 0; frame < frames; frame++) {
    const count = flashes.length
    const smoked = smokes.length
    room.use()
    run(room, 1)
    const drawn = drawnTip(measured, view)
    if (!drawn) return { ...errors, missing: 'the model in the hands has no muzzle mark' }
    const flash = flashes[count]
    if (flash) errors.flash = worst(errors.flash, pixels(drawn.camera, flash).distanceTo(drawn.tip))
    for (const smoke of smokes.slice(smoked)) errors.smoke = worst(errors.smoke, pixels(drawn.camera, smoke).distanceTo(drawn.tip))
    const tracer = newestTracer(room, lines)
    if (tracer) errors.tracer = worst(errors.tracer, pixels(drawn.camera, tracer).distanceTo(drawn.tip))
  }
  if (mode !== 'sweep') return errors
  // the view sweeps while the flash burns: the flash stays on the muzzle the eye sees, not where the shot left it in the air
  for (let frame = 1; frame <= TURN_FRAMES; frame++) {
    lookTurned(room, (TURN_RATE * frame) / 60)
    run(room, 1)
    const drawn = drawnTip(measured, view)
    if (!drawn) return { ...errors, missing: 'the model in the hands has no muzzle mark' }
    for (const burning of burningFlashes(room)) errors.flash = worst(errors.flash, pixels(drawn.camera, burning).distanceTo(drawn.tip))
  }
  return errors
}

// MUZZLE_WEAPONS=id,id measures only those (to look at one weapon); the test measures them all
const only = (process.env.MUZZLE_WEAPONS ?? '').split(',').filter(Boolean)
const FIREARMS = WEAPONS.filter((def) => def.action.kind === 'firearm' && hasWeaponModel(def.id) && (only.length === 0 || only.includes(def.id))).map((def) => def.id)

// one test per weapon: a single test over the whole arsenal ran for minutes without yielding, and vitest lost the worker (ERR_IPC_CHANNEL_CLOSED)
describe('the flash, the smoke and the tracer leave the tip of the barrel as it is drawn, and the flash stays on it while it burns, in every view and fire mode, within a few pixels', () => {
  it.each(FIREARMS)('%s', (weapon) => {
    const samples = (['first', 'third'] as const).flatMap((view) => measure(weapon, view))
    const off = samples.filter((sample) => sample.missing !== undefined || (sample.flash ?? 0) > MAX_PIXELS || (sample.tracer ?? 0) > MAX_PIXELS || (sample.smoke ?? 0) > MAX_PIXELS)
    expect(off).toEqual([])
  }, 120_000)
})
