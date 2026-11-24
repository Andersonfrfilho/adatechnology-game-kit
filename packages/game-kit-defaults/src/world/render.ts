import type * as THREE_NS from 'three'

import { createFramePacer } from '@adatechnology/game-render-three'
import { startLoop } from '@adatechnology/game-runtime'
import type { FrameContext, Scheduler } from '@adatechnology/game-runtime'

import { frameTargetOf } from './frame-queues'
import type { KitWorldFrame } from './frame'
import type { KitWorldGraphics } from './graphics'
import type { KitWorldRenderBudget } from './render-budget'
import type { KitWorldView } from './view'

/** Look at the lights this often (ms): a module that adds one after the load changes the program key of every lit material. */
const LIGHTS_CHECK_MS = 250

/** What a game adds around the host's draw call. `scripted` is true for a frame a scenario steps. */
export type KitWorldRenderHooks = {
  /** First thing of the draw (batches, the camera turned for the view); what it returns runs after the draw to put things back. */
  readonly beforeRender?: (context: { readonly scripted: boolean }) => (() => void) | void
  /** After the draw and the camera restored: counters of the frame. */
  readonly afterRender?: (context: { readonly scripted: boolean }) => void
  /** The camera the main pass is drawn from (a debug view, a takeover); default the world's camera. */
  readonly view?: () => THREE_NS.Camera
  /** Passes over the main one: the first-person layer, mirrors and reversing cameras. */
  readonly extraPasses?: (scene: THREE_NS.Scene, view: THREE_NS.Camera) => void
}

export type KitWorldStartOptions = {
  /** The loop only presents and renders while this answers true (a scenario is stepping the world). */
  readonly skipSimulation?: () => boolean
  /** The least milliseconds between two frames (a frame cap); default the player's cap from the graphics settings. */
  readonly minFrameMs?: () => number
  /** Called first in every frame with the unclamped real seconds. */
  readonly onFrame?: (realSeconds: number) => void
  /** The host draws each frame (default: when it made the renderer). `false`: the game draws itself, from `render()` or its own pass. */
  readonly render?: boolean
  readonly renderHooks?: KitWorldRenderHooks
}

export type KitWorldRender = {
  render(hooks?: KitWorldRenderHooks): void
  start(options?: KitWorldStartOptions): () => void
  readonly isLooping: boolean
  dispose(): void
}

export type RenderDeps = {
  readonly view: KitWorldView
  readonly frame: KitWorldFrame
  readonly budget: KitWorldRenderBudget
  readonly graphics: KitWorldGraphics | null
  readonly targetMs: number | undefined
  readonly framesInFlight: number | undefined
}

export function createRender(deps: RenderDeps): KitWorldRender {
  const { view, frame, budget, graphics } = deps
  const { gl, scene, camera } = view
  const scheduler: Scheduler = frame.scheduler
  let stopLoop: (() => void) | undefined
  let disposePacer: (() => void) | undefined
  let isLooping = false
  let isDrawRegistered = false

  const draw = (hooks: KitWorldRenderHooks | undefined, scripted: boolean): void => {
    const context = { scripted }
    const restore = hooks?.beforeRender?.(context)
    graphics?.beforeRender(camera)
    const main = hooks?.view?.() ?? camera
    gl.render(scene, main)
    hooks?.extraPasses?.(scene, main)
    graphics?.afterRender()
    restore?.()
    hooks?.afterRender?.(context)
  }

  const registerDrawSystems = (hooks: KitWorldRenderHooks | undefined): void => {
    let nextLightsCheck = 0
    let warnedState = ''
    // modules that add a light of their own after the load (or change the fog, the tone mapping...) change the program key of every lit material: warm again when the sealed state breaks
    frame.add(
      (ctx: FrameContext) => {
        if (ctx.scripted) return
        const now = performance.now()
        if (now < nextLightsCheck) return
        nextLightsCheck = now + LIGHTS_CHECK_MS
        const state = budget.lights.check(gl, scene)
        if (budget.isWarmedUp() && (state.ok || state.actual === warnedState)) return
        warnedState = state.actual
        budget.warmUp()
        scheduler.budget.skipRenderSample()
      },
      { phase: 'render', order: -1000, id: 'room.lights-check' },
    )
    // a GPU slower than the CPU fills the driver queue and stalls the compositor for the whole queue: keep it a few frames behind at most
    const pacer = createFramePacer(typeof gl.getContext === 'function' ? (gl.getContext() as unknown as WebGL2RenderingContext) : null, deps.framesInFlight === undefined ? {} : { framesInFlight: deps.framesInFlight })
    disposePacer = () => pacer.dispose()
    frame.add(
      (ctx: FrameContext) => {
        if (!ctx.scripted && !pacer.ready()) return scheduler.budget.skipRenderSample()
        draw(hooks, ctx.scripted)
        pacer.submitted()
        if (!ctx.scripted) graphics?.frameEnd()
      },
      { phase: 'render', id: 'room.render' },
    )
  }

  return {
    render: (hooks) => draw(hooks, false),
    start(options = {}) {
      if (stopLoop) return stopLoop
      if ((options.render ?? view.ownsRenderer) && !isDrawRegistered) {
        isDrawRegistered = true
        registerDrawSystems(options.renderHooks)
      }
      let stop: () => void
      try {
        stop = startLoop(scheduler, {
          onFrame: (realSeconds) => {
            graphics?.frameStart()
            scheduler.budget.targetMs = frameTargetOf({ hostTargetMs: deps.targetMs, ...(graphics ? { capGapMs: graphics.controller.minFrameMs() } : {}) })
            options.onFrame?.(realSeconds)
          },
          ...(options.skipSimulation ? { skipSimulation: options.skipSimulation } : {}),
          // the player's frame cap (Gráficos → Limite de FPS)
          ...(options.minFrameMs ? { minFrameMs: options.minFrameMs } : graphics ? { minFrameMs: () => graphics.controller.minFrameMs() } : {}),
        })
        isLooping = true
      } catch {
        // no display frames here (a worker): the host calls the frame itself
        stop = () => undefined
      }
      stopLoop = () => {
        stop()
        isLooping = false
        stopLoop = undefined
      }
      return stopLoop
    },
    get isLooping() {
      return isLooping
    },
    dispose() {
      stopLoop?.()
      disposePacer?.()
    },
  }
}
