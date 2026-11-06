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

type Sample = { readonly weapon: string; readonly view: string; readonly mode: string; readonly flash: number | null; readonly tracer: number | null }

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

const rooms: TestRoom[] = []
afterEach(() => {
  for (const room of rooms.splice(0)) room.dispose()
})

/** A room with the weapons module, the flashes it plays and the lens it draws the weapon with. */
function measuredRoom(): { room: TestRoom; canvas: HTMLCanvasElement; flashes: THREE.Vector3[]; lens: () => number | null } {
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
          return play(request)
        },
      }
    }
    return attach(lent)
  }
  expect(room.loadModule(module).problems).toEqual([])
  return { room, canvas: renderer.domElement, flashes, lens: () => lensFov }
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

/** Fires with `weapon` at the hip and aimed, a shot and a half-second burst each, and answers how many pixels the flash and the tracer start from the tip of the drawn barrel. */
function measure(weapon: string, view: 'first' | 'third'): Sample[] {
  const { room, canvas, flashes, lens } = measuredRoom()
  room.setCameraMode(view)
  room.look([0, 1.7, 5], [0, 1.6, -11])
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
      samples.push({ weapon, view, mode: `${aimed ? 'aimed' : 'hip'} ${burst ? 'burst' : 'single'}`, ...fire(room, flashes, lens, view, burst) })
      // the gun settles and the barrel cools a little between the strings
      run(room, 90)
    }
  }
  canvas.dispatchEvent(new MouseEvent('mouseup', { button: 2, cancelable: true, bubbles: true }))
  return samples
}

function fire(room: TestRoom, flashes: readonly THREE.Vector3[], lens: () => number | null, view: 'first' | 'third', burst: boolean): { flash: number | null; tracer: number | null } {
  const lines = new Set<THREE.Object3D>()
  room.scene.traverse((object) => void ((object as THREE.Line).isLine && lines.add(object)))
  let flashError: number | null = null
  let tracerError: number | null = null
  const frames = burst ? 30 : 1
  for (let frame = 0; frame < frames; frame++) {
    const count = flashes.length
    room.use()
    run(room, 1)
    const tip = room.scene.getObjectByName('weapon-viewmodel')?.getObjectByName('muzzle')
    if (!tip) break
    const restore = room.applyCamera()
    const camera = room.camera.clone()
    camera.aspect = VIEW.width / VIEW.height
    const drawnBy = camera.clone()
    if (view === 'first' && lens() !== null) drawnBy.fov = lens() ?? camera.fov
    camera.updateProjectionMatrix()
    drawnBy.updateProjectionMatrix()
    const drawn = pixels(drawnBy, tip.getWorldPosition(new THREE.Vector3()))
    const flash = flashes[count]
    if (flash) flashError = Math.max(flashError ?? 0, pixels(camera, flash).distanceTo(drawn))
    const tracer = newestTracer(room, lines)
    if (tracer) tracerError = Math.max(tracerError ?? 0, pixels(camera, tracer).distanceTo(drawn))
    restore()
  }
  return { flash: flashError, tracer: tracerError }
}

// MUZZLE_WEAPONS=id,id measures only those (to look at one weapon); the test measures them all
const only = (process.env.MUZZLE_WEAPONS ?? '').split(',').filter(Boolean)
const FIREARMS = WEAPONS.filter((def) => def.action.kind === 'firearm' && hasWeaponModel(def.id) && (only.length === 0 || only.includes(def.id))).map((def) => def.id)

describe('the flash and the tracer leave the tip of the barrel as it is drawn', () => {
  it('in every view and fire mode, within a few pixels', () => {
    const samples: Sample[] = []
    for (const weapon of FIREARMS) for (const view of ['first', 'third'] as const) samples.push(...measure(weapon, view))
    const off = samples.filter((sample) => (sample.flash ?? 0) > MAX_PIXELS || (sample.tracer ?? 0) > MAX_PIXELS)
    console.log(`muzzle-screen: ${samples.length} cases, ${off.length} off; worst ${JSON.stringify([...off].sort((a, b) => Math.max(b.flash ?? 0, b.tracer ?? 0) - Math.max(a.flash ?? 0, a.tracer ?? 0)).slice(0, 12))}`)
    expect(off).toEqual([])
  }, 1_800_000)
})
