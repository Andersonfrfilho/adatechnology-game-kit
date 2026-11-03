import type * as THREE_NS from 'three'

export interface GpuFrameTimer {
  /** Around the frame's draws: `begin` before `renderer.render`, `end` after. */
  begin(): void
  end(): void
  /** The GPU time of the last frame that answered, milliseconds; null where the GPU has no timer (then the load is the CPU's and the missed frames). */
  readonly ms: number | null
  dispose(): void
}

type TimerExt = { readonly TIME_ELAPSED_EXT: number; readonly GPU_DISJOINT_EXT: number }

/** The GPU time of whole frames with `EXT_disjoint_timer_query_webgl2`: a few queries in flight, read when they answer, never waited on. */
export function createGpuFrameTimer(renderer: THREE_NS.WebGLRenderer, inFlight = 4): GpuFrameTimer {
  const gl = renderer.getContext() as WebGL2RenderingContext
  const ext = typeof gl.createQuery === 'function' ? (gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null) : null
  const pending: WebGLQuery[] = []
  const free: WebGLQuery[] = []
  let open: WebGLQuery | null = null
  let ms: number | null = null
  const poll = (): void => {
    if (!ext) return
    while (pending.length) {
      const q = pending[0]!
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break
      pending.shift()
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) ms = (gl.getQueryParameter(q, gl.QUERY_RESULT) as number) / 1e6
      free.push(q)
    }
  }
  return {
    begin() {
      if (!ext || open) return
      poll()
      if (pending.length >= inFlight) return
      open = free.pop() ?? gl.createQuery()
      if (open) gl.beginQuery(ext.TIME_ELAPSED_EXT, open)
    },
    end() {
      if (!ext || !open) return
      gl.endQuery(ext.TIME_ELAPSED_EXT)
      pending.push(open)
      open = null
    },
    get ms() {
      return ms
    },
    dispose() {
      for (const q of [...pending, ...free]) gl.deleteQuery(q)
      pending.length = 0
      free.length = 0
    },
  }
}
