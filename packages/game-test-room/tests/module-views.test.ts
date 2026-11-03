// The extra views modules ask for (mirrors, a reversing camera) and the main-view takeover (a vehicle's camera): drawn in their rect, flipped for a
// mirror, and everything they created is disposed when the view goes (CLAUDE.md, "Memória").
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createModuleViews } from '../src/module-views'
import { makeRoom } from './helpers'

function fakeRenderer() {
  const calls: Array<{ op: string; args: unknown[] }> = []
  const log = (op: string) => (...args: unknown[]) => void calls.push({ op, args })
  const gl = {
    autoClear: true,
    shadowMap: { autoUpdate: true },
    getSize: (v: THREE.Vector2) => v.set(1000, 500),
    getPixelRatio: () => 1,
    setRenderTarget: log('target'),
    clear: log('clear'),
    render: log('render'),
    setScissorTest: log('scissorTest'),
    setViewport: log('viewport'),
    setScissor: log('scissor'),
  }
  return { gl: gl as unknown as THREE.WebGLRenderer, calls }
}

describe('module views', () => {
  it('renders each view into its target, lays it in its rect flipped for a mirror, and restores the renderer', () => {
    const { gl, calls } = fakeRenderer()
    const views = createModuleViews(THREE, gl)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, 1)
    views.add({ camera, rect: { x: 0.4, y: 0, width: 0.2, height: 0.1 }, mirror: true })
    views.render(scene)
    // the aspect follows the rect: 200 x 50 px
    expect(camera.aspect).toBeCloseTo(4, 6)
    expect(calls.filter((c) => c.op === 'render').length).toBe(3)
    // the picture's viewport: x 400, y from the bottom 450, 200 x 50
    expect(calls.some((c) => c.op === 'viewport' && c.args.join() === '400,450,200,50')).toBe(true)
    expect(calls[calls.length - 1]).toEqual({ op: 'viewport', args: [0, 0, 1000, 500] })
    expect(gl.autoClear).toBe(true)
    expect(gl.shadowMap.autoUpdate).toBe(true)
  })

  it('frees the render target and the materials when a view is taken away and when the room goes', () => {
    const { gl } = fakeRenderer()
    const views = createModuleViews(THREE, gl)
    const disposed: string[] = []
    const remove = views.add({ camera: new THREE.PerspectiveCamera(), rect: { x: 0, y: 0, width: 0.5, height: 0.5 } })
    const spy = THREE.WebGLRenderTarget.prototype.dispose
    THREE.WebGLRenderTarget.prototype.dispose = function () {
      disposed.push('target')
      spy.call(this)
    }
    try {
      remove()
      expect(views.count).toBe(0)
      views.add({ camera: new THREE.PerspectiveCamera(), rect: { x: 0, y: 0, width: 0.5, height: 0.5 } })
      views.dispose()
      expect(views.count).toBe(0)
      expect(disposed).toEqual(['target', 'target'])
    } finally {
      THREE.WebGLRenderTarget.prototype.dispose = spy
    }
  })

  it('lends the main view to a module camera and gives it back', () => {
    const { gl } = fakeRenderer()
    const views = createModuleViews(THREE, gl)
    const room = new THREE.PerspectiveCamera(70, 2)
    const car = new THREE.PerspectiveCamera(60, 1)
    expect(views.main(room)).toBe(room)
    views.setMain(car)
    expect(views.main(room)).toBe(car)
    expect(car.aspect).toBe(2)
    views.setMain(null)
    expect(views.main(room)).toBe(room)
  })

  it('is lent to modules by the room', () => {
    const room = makeRoom()
    let lent: { addView?: unknown; setViewCamera?: unknown } | null = null
    room.loadModule({ id: 'views_probe', name: 'Views', group: 'Views', items: () => [], attach: (host) => { lent = host; return () => undefined } })
    expect(typeof lent!.addView).toBe('function')
    expect(typeof lent!.setViewCamera).toBe('function')
    room.dispose()
  })
})
