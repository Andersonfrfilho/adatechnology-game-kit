import type { RoomMetricId } from './types'

export const ROOM_METRICS: readonly RoomMetricId[] = ['fps', 'frame_ms', 'draw_calls', 'triangles', 'objects', 'fragments', 'particles', 'decals']

const WINDOW_S = 0.5

interface RenderInfo {
  info?: { render?: { calls: number; triangles: number } }
}

export interface RoomMetricsSources {
  readonly gl: unknown
  readonly destruction: { stats(): { fragments: number; particles: number; pieces: number; decals: number } }
  readonly fluids: { stats(): { particles: number; stains: number } }
  readonly ids: readonly RoomMetricId[]
}

export interface RoomMetrics {
  /** Every frame with the real `dt`, before the time scale. */
  frame(dt: number): void
  /** Right after the room renders (only when it owns the loop). */
  rendered(): void
  sample(): Partial<Record<RoomMetricId, number>>
}

export function createRoomMetrics(sources: RoomMetricsSources): RoomMetrics {
  const wanted = new Set(sources.ids)
  const gl = sources.gl as RenderInfo
  let windowS = 0
  let frames = 0
  let fps: number | undefined
  let frameMs: number | undefined
  let calls: number | undefined
  let triangles: number | undefined
  let ownsRender = false
  return {
    frame(dt) {
      frames++
      windowS += dt
      if (windowS < WINDOW_S) return
      fps = frames / windowS
      frameMs = (windowS / frames) * 1000
      frames = 0
      windowS = 0
    },
    rendered() {
      ownsRender = true
      calls = gl.info?.render?.calls
      triangles = gl.info?.render?.triangles
    },
    sample() {
      const out: Partial<Record<RoomMetricId, number>> = {}
      const put = (id: RoomMetricId, value: number | undefined): void => {
        if (wanted.has(id) && value !== undefined) out[id] = value
      }
      put('fps', fps)
      put('frame_ms', frameMs)
      const render = ownsRender ? { calls, triangles } : gl.info?.render
      put('draw_calls', render?.calls)
      put('triangles', render?.triangles)
      if (!['objects', 'fragments', 'particles', 'decals'].some((id) => wanted.has(id as RoomMetricId))) return out
      const destruction = sources.destruction.stats()
      const fluids = sources.fluids.stats()
      put('objects', destruction.pieces)
      put('fragments', destruction.fragments)
      put('particles', destruction.particles + fluids.particles)
      put('decals', destruction.decals + fluids.stains)
      return out
    },
  }
}
