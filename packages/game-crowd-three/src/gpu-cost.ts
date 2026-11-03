import type * as THREE_NS from 'three'

const NANOSECONDS_PER_MILLISECOND = 1e6
const MAX_PENDING = 512

type Timer = {
  readonly TIME_ELAPSED_EXT: number
  readonly GPU_DISJOINT_EXT: number
}

type PendingQuery = { readonly query: WebGLQuery; readonly frame: number }

export type GpuCostProbe = {
  /** Times every draw of `mesh` on the GPU (the time of its depth pass included). */
  attach(mesh: THREE_NS.Object3D): void
  /** Reads the finished queries; the milliseconds the attached meshes took in the last frame whose queries are all back, or undefined while there is none (or no timer on this GPU). */
  poll(): number | undefined
}

/**
 * The GPU time the attached meshes take, from `EXT_disjoint_timer_query_webgl2` (one query around each of their draws, summed per frame). The crowd renderer reads it to size
 * its level budget on the machine it runs on. Without the extension `poll` stays undefined and the caller falls back to the frame time.
 */
export function createGpuCostProbe(): GpuCostProbe {
  let context: WebGL2RenderingContext | null = null
  let timer: Timer | null = null
  let isReady = false
  let active: WebGLQuery | null = null
  let drawFrame = 0
  let lastRenderFrame = -1
  const pending: PendingQuery[] = []
  const free: WebGLQuery[] = []
  let sumFrame = -1
  let sum = 0
  let last: number | undefined

  const begin = (renderer: THREE_NS.WebGLRenderer): void => {
    if (!isReady) {
      isReady = true
      const gl = renderer.getContext() as WebGL2RenderingContext
      const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2') as Timer | null
      if (extension) {
        context = gl
        timer = extension
      }
    }
    if (!context || !timer || active || pending.length >= MAX_PENDING) return
    const frame = renderer.info.render.frame
    if (frame !== lastRenderFrame) {
      lastRenderFrame = frame
      drawFrame++
    }
    active = free.pop() ?? context.createQuery()
    context.beginQuery(timer.TIME_ELAPSED_EXT, active)
  }

  const end = (): void => {
    if (!context || !timer || !active) return
    context.endQuery(timer.TIME_ELAPSED_EXT)
    pending.push({ query: active, frame: drawFrame })
    active = null
  }

  const poll = (): number | undefined => {
    if (!context || !timer) return undefined
    const disjoint = context.getParameter(timer.GPU_DISJOINT_EXT) as boolean
    while (pending.length > 0) {
      const { query, frame } = pending[0]!
      if (!context.getQueryParameter(query, context.QUERY_RESULT_AVAILABLE)) break
      pending.shift()
      free.push(query)
      if (disjoint) continue
      if (frame !== sumFrame) {
        if (sumFrame >= 0) last = sum
        sumFrame = frame
        sum = 0
      }
      sum += (context.getQueryParameter(query, context.QUERY_RESULT) as number) / NANOSECONDS_PER_MILLISECOND
    }
    return last
  }

  return {
    attach(mesh) {
      mesh.onBeforeRender = (renderer) => begin(renderer)
      mesh.onAfterRender = () => end()
    },
    poll,
  }
}
