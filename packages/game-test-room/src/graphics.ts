import type * as THREE_NS from 'three'
import type { BusySink, BusyTask, HostGraphics } from '@adatechnology/game-contracts'
import { createGraphicsController, frameLoad, targetFrameMs } from '@adatechnology/game-graphics'
import type { GraphicsController, StorageLike } from '@adatechnology/game-graphics'
import { createFpsOverlay, createGraphicsScreen } from '@adatechnology/game-graphics/screen'
import type { FpsOverlay, GraphicsScreen } from '@adatechnology/game-graphics/screen'
import { createGpuFrameTimer, createGraphicsView, gpuName } from '@adatechnology/game-graphics-three'
import type { GpuFrameTimer, GraphicsView } from '@adatechnology/game-graphics-three'

import { SUN_SHADOW } from './sun-shadow'

const QUIET_FRAMES = 10

/** The sun's shadow box under the `near` shadow level is the room's one cascade (`SUN_SHADOW.half`): the same box at every level, only the map's size changes. */
const NEAR_SHADOW_EXTENT = SUN_SHADOW.half

/** The room's graphics settings (`TestRoomOptions.graphics`). */
export interface RoomGraphicsOptions {
  /** Where the player's choice is kept (default `localStorage`; null keeps it in memory). */
  readonly storage?: StorageLike | null
  /** The key it is kept under (default `adatechnology.graphics`). */
  readonly key?: string
  /** The short test of the first load, seconds (default 3; 0 skips it and starts the automatic mode at Alta). */
  readonly calibrationSeconds?: number
  /**
   * When the calibration of a first run starts: `idle` (default) after a few drawn frames with nothing on the loading indicator, or `manual`, where the page calls
   * `room.graphics.calibrateIfNeeded()` once its content is in (a page that loads its content before it shows the room).
   */
  readonly calibrate?: 'idle' | 'manual'
}

export interface RoomGraphics {
  readonly controller: GraphicsController
  readonly view: GraphicsView
  readonly screen: GraphicsScreen | null
  /** What modules get as `host.graphics`. */
  readonly host: HostGraphics
  /** Marks the start of a display frame (before the scheduler runs it). */
  frameStart(): void
  /** Around the draw call of the frame: the GPU timer and the near shadow box that follows the camera. */
  beforeRender(camera: THREE_NS.Camera): void
  afterRender(): void
  /** The end of a frame that was drawn: what it cost goes to the automatic mode, with the wall time since the last drawn frame (a frame the pacer skipped is in it). */
  frameEnd(): void
  dispose(): void
}

/**
 * The graphics settings on the test room: the controller of `game-graphics` (choice in the browser, calibration, automatic mode), the three.js view of
 * `game-graphics-three` on the room's renderer, camera and sun, the settings screen and the frame counter, and the calibration shown on the loading indicator.
 */
export function createRoomGraphics(o: {
  readonly gl: THREE_NS.WebGLRenderer
  readonly camera: THREE_NS.PerspectiveCamera
  readonly sun: THREE_NS.DirectionalLight
  readonly container: HTMLElement
  readonly locale: string
  readonly loading: BusySink & { readonly active: boolean }
  readonly label: string
  readonly ui: boolean
  readonly options: RoomGraphicsOptions
}): RoomGraphics {
  const view = createGraphicsView({ renderer: o.gl, camera: o.camera, sun: o.sun, nearExtent: NEAR_SHADOW_EXTENT })
  const seconds = o.options.calibrationSeconds ?? 3
  // a change of the resolution scale resizes the canvas, which clears it: made after the frame was drawn it would show a black frame, so once the room is drawing it waits for the next frame's start
  let held: Parameters<GraphicsView['apply']>[0] | null = null
  let drawing = false
  const applyOrHold = (e: Parameters<GraphicsView['apply']>[0]): void => {
    if (drawing) held = e
    else view.apply(e)
  }
  const controller = createGraphicsController({
    store: { ...(o.options.storage !== undefined ? { storage: o.options.storage } : {}), ...(o.options.key ? { key: o.options.key } : {}) },
    gpu: gpuName(o.gl),
    benchmark: seconds > 0 ? { durationS: seconds } : false,
    // the room measures its own frames once it is up, not the loading of its content
    calibrate: 'manual',
    apply: (e) => applyOrHold(e),
  })
  const timer: GpuFrameTimer = createGpuFrameTimer(o.gl)
  const screen = o.ui ? createGraphicsScreen({ container: o.container, controller, locale: o.locale }) : null
  const overlay: FpsOverlay | null = o.ui ? createFpsOverlay({ container: o.container, controller, locale: o.locale }) : null
  const listeners = new Set<() => void>()
  let lastHorde = controller.settings.hordeDetail
  const unsubscribe = controller.subscribe(() => {
    if (controller.settings.hordeDetail === lastHorde) return
    lastHorde = controller.settings.hordeDetail
    for (const l of listeners) l()
  })

  // the calibration is a task of the loading indicator, with its bar
  let task: BusyTask | null = null
  const syncTask = (): void => {
    if (controller.phase === 'calibrating') {
      task ??= o.loading.begin(o.label, { total: 100 })
      task.step(`${Math.round(controller.calibrationProgress * 100)}%`, Math.round(controller.calibrationProgress * 100))
    } else if (task) {
      task.end()
      task = null
    }
  }
  syncTask()

  let started = 0
  // drawn frames in a row with nothing loading: the calibration waits for a few (the first frames after a load compile and upload)
  let quiet = 0
  let lastEnd = 0
  return {
    controller,
    view,
    screen,
    host: {
      hordeDetail: () => controller.settings.hordeDetail,
      onChange(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      report: (key, value) => controller.report(key, value),
    },
    frameStart() {
      started = performance.now()
    },
    beforeRender(camera) {
      drawing = true
      if (held) {
        view.apply(held)
        held = null
      }
      view.hold()
      view.follow(camera.position.x, camera.position.z)
      timer.begin()
    },
    afterRender() {
      timer.end()
    },
    frameEnd() {
      const now = performance.now()
      const realSeconds = lastEnd > 0 ? (now - lastEnd) / 1000 : 0
      lastEnd = now
      if (!(realSeconds > 0)) return
      const cpuMs = started > 0 ? now - started : realSeconds * 1000
      controller.frame(realSeconds, frameLoad({ cpuMs, gpuMs: timer.ms, intervalMs: realSeconds * 1000, targetMs: targetFrameMs(controller.settings.fpsCap) }))
      quiet = o.loading.active && !task ? 0 : quiet + 1
      if (o.options.calibrate !== 'manual' && quiet >= QUIET_FRAMES) controller.calibrateIfNeeded()
      syncTask()
    },
    dispose() {
      task?.end()
      unsubscribe()
      listeners.clear()
      timer.dispose()
      screen?.dispose()
      overlay?.dispose()
    },
  }
}
