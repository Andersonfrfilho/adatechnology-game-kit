import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestRoom } from '../src'
import { demoItems } from './fixtures/demo-items'
import * as THREE from 'three'
import { makeRoom, stubRenderer } from './helpers'

const withRenderInfo = (calls: number, triangles: number): THREE.WebGLRenderer => {
  const gl = stubRenderer() as unknown as Record<string, unknown>
  gl.info = { render: { calls, triangles } }
  return gl as unknown as THREE.WebGLRenderer
}

describe('room metrics', () => {
  it('fps comes from the real frame time, the same in slow motion', () => {
    const room = makeRoom()
    for (let i = 0; i < 60; i++) room.update(1 / 60)
    expect(room.metrics().room.fps).toBeCloseTo(60, 0)
    expect(room.metrics().room.frame_ms).toBeCloseTo(1000 / 60, 0)
    const slow = makeRoom()
    slow.setSlowMotion(true)
    for (let i = 0; i < 60; i++) slow.update(1 / 60)
    expect(slow.metrics().room.fps).toBeCloseTo(60, 0)
  })

  it('reads draw calls and triangles from the renderer info, and leaves them out without it', () => {
    expect(makeRoom({ renderer: withRenderInfo(12, 3400) }).metrics().room).toMatchObject({ draw_calls: 12, triangles: 3400 })
    const room = makeRoom()
    const sampled = room.metrics().room
    expect(sampled.draw_calls).toBeUndefined()
    expect(sampled.triangles).toBeUndefined()
    expect(sampled.objects).toBeTypeOf('number')
  })

  it('module metrics are pulled: none without the panel, one read per metrics()', () => {
    let reads = 0
    const room = makeRoom()
    room.loadModule({ id: 'counter', name: 'Counter', group: 'Counter', items: () => [], metrics: () => [{ id: 'reads', name: 'Reads', read: () => ++reads }] })
    for (let i = 0; i < 120; i++) room.update(1 / 60)
    expect(reads).toBe(0)
    expect(room.metrics().module).toEqual({ reads: 1 })
    expect(reads).toBe(1)
  })

  it('only the room counters asked for', () => {
    const room = makeRoom({ metrics: ['fps'] })
    for (let i = 0; i < 40; i++) room.update(1 / 60)
    expect(Object.keys(room.metrics().room)).toEqual(['fps'])
    expect(makeRoom({ metrics: false }).metrics().room).toEqual({})
  })

  describe('with the room owning the loop', () => {
    afterEach(() => vi.unstubAllGlobals())

    // a requestAnimationFrame the test fires by hand, and a THREE whose renderer is the stub so the room owns the canvas and the loop
    function ownLoopRoom(): { frame(now: number): void; room: ReturnType<typeof createTestRoom> } {
      let callback: FrameRequestCallback | undefined
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        callback = cb
        return 1
      })
      vi.stubGlobal('cancelAnimationFrame', () => undefined)
      const FakeRenderer = function () {
        return Object.assign(stubRenderer(), { toneMapping: 0, outputColorSpace: '' })
      } as unknown as typeof THREE.WebGLRenderer
      const container = document.createElement('div')
      document.body.appendChild(container)
      const room = createTestRoom({ THREE: { ...THREE, WebGLRenderer: FakeRenderer }, container, locale: 'en', catalog: demoItems('en'), ui: false })
      return { room, frame: (now) => callback?.(now) }
    }

    it('fps follows the real delta even past the 50 ms the simulation is clamped to', () => {
      const { room, frame } = ownLoopRoom()
      let now = performance.now()
      for (let i = 0; i < 8; i++) frame((now += 100))
      expect(room.metrics().room.fps).toBeCloseTo(10, 0)
      expect(room.metrics().room.frame_ms).toBeCloseTo(100, 0)
    })

    it('keeps sampling while a scenario runs', async () => {
      const { room, frame } = ownLoopRoom()
      let now = performance.now()
      const running = room.runScenarios([{ id: 'wait', name: 'Wait', run: async (ctx) => { for (let i = 0; i < 8; i++) frame((now += 100)); ctx.expect(true, 'ok') } }])
      await running
      expect(room.metrics().room.fps).toBeCloseTo(10, 0)
    })
  })
})
