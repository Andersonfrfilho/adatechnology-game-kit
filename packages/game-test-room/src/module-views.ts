/**
 * The extra views modules ask for (`ModuleHost.addView`: rear-view and side mirrors, a reversing camera) and the main-view takeover (`ModuleHost.setViewCamera`: a vehicle's chase or
 * cockpit camera). Each extra view is rendered into its own render target and laid on the screen as a quad, flipped for a mirror and with rounded corners when asked; everything it
 * creates is disposed when the view is taken away or the room is torn down.
 */
import type * as THREE_NS from 'three'
import type { ModuleView } from '@adatechnology/game-contracts'

type Entry = {
  readonly view: ModuleView
  readonly target: THREE_NS.WebGLRenderTarget
  readonly quad: THREE_NS.Mesh
  readonly frame: THREE_NS.Mesh
  readonly alpha: THREE_NS.Texture | null
}

export type ModuleViews = {
  add(view: ModuleView): () => void
  setMain(camera: THREE_NS.Camera | null): void
  /** The camera the main view renders from: the module's when one took it over. */
  main(fallback: THREE_NS.Camera): THREE_NS.Camera
  /** Draws every extra view over what is already on the screen. */
  render(scene: THREE_NS.Scene): void
  readonly count: number
  dispose(): void
}

const FRAME_PX = 3

export function createModuleViews(THREE: typeof THREE_NS, gl: THREE_NS.WebGLRenderer): ModuleViews {
  const entries: Entry[] = []
  let mainCamera: THREE_NS.Camera | null = null
  const overlay = new THREE.Scene()
  const ortho = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 2)
  ortho.position.z = 1
  const plane = new THREE.PlaneGeometry(1, 1)

  // a rounded rectangle as an alpha mask (white inside), drawn once per view on a small canvas
  const roundedMask = (rounded: number, aspect: number): THREE_NS.Texture | null => {
    if (!rounded || typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = Math.max(16, Math.round(256 / aspect))
    const g = canvas.getContext('2d')
    if (!g) return null
    const r = Math.min(canvas.width, canvas.height) * Math.min(0.5, rounded)
    g.fillStyle = '#000'
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.fillStyle = '#fff'
    g.beginPath()
    g.roundRect(0, 0, canvas.width, canvas.height, r)
    g.fill()
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.NoColorSpace
    return texture
  }

  const size = (): { w: number; h: number } => {
    // a stand-in renderer (tests, a headless host) may not measure itself
    if (typeof gl.getSize !== 'function') return { w: 960, h: 600 }
    const v = new THREE.Vector2()
    gl.getSize(v)
    return { w: v.x, h: v.y }
  }

  const take = (entry: Entry): void => {
    const i = entries.indexOf(entry)
    if (i < 0) return
    entries.splice(i, 1)
    overlay.remove(entry.quad, entry.frame)
    entry.target.dispose()
    ;(entry.quad.material as THREE_NS.Material).dispose()
    ;(entry.frame.material as THREE_NS.Material).dispose()
    entry.alpha?.dispose()
  }

  return {
    add(view) {
      const { w, h } = size()
      const scale = view.resolution ?? 0.5
      const pr = typeof gl.getPixelRatio === 'function' ? gl.getPixelRatio() : 1
      const target = new THREE.WebGLRenderTarget(Math.max(16, Math.round(w * view.rect.width * pr * scale)), Math.max(16, Math.round(h * view.rect.height * pr * scale)), { samples: 2 })
      target.texture.colorSpace = THREE.LinearSRGBColorSpace
      const alpha = roundedMask(view.rounded ?? 0, (w * view.rect.width) / Math.max(1, h * view.rect.height))
      const quad = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: target.texture, side: THREE.DoubleSide, depthTest: false, depthWrite: false, ...(alpha ? { alphaMap: alpha, transparent: true } : {}) }))
      const frame = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: 0x0b0c0e, side: THREE.DoubleSide, depthTest: false, depthWrite: false, ...(alpha ? { alphaMap: alpha, transparent: true } : {}) }))
      quad.renderOrder = 1
      frame.visible = quad.visible = false
      overlay.add(frame, quad)
      const entry: Entry = { view, target, quad, frame, alpha }
      entries.push(entry)
      return () => take(entry)
    },
    setMain(camera) {
      mainCamera = camera
    },
    main(fallback) {
      if (!mainCamera) return fallback
      const persp = mainCamera as THREE_NS.PerspectiveCamera
      const back = fallback as THREE_NS.PerspectiveCamera
      if (persp.isPerspectiveCamera && back.isPerspectiveCamera && persp.aspect !== back.aspect) {
        persp.aspect = back.aspect
        persp.updateProjectionMatrix()
      }
      return mainCamera
    },
    render(scene) {
      if (!entries.length) return
      const { w, h } = size()
      const autoClear = gl.autoClear
      const shadows = gl.shadowMap.autoUpdate
      // the shadow maps were drawn for the main view this frame: the extra views reuse them
      gl.shadowMap.autoUpdate = false
      for (const entry of entries) {
        const cam = entry.view.camera as THREE_NS.PerspectiveCamera
        const aspect = (w * entry.view.rect.width) / Math.max(1, h * entry.view.rect.height)
        if (cam.isPerspectiveCamera && Math.abs(cam.aspect - aspect) > 1e-3) {
          cam.aspect = aspect
          cam.updateProjectionMatrix()
        }
        gl.setRenderTarget(entry.target)
        gl.clear()
        gl.render(scene, cam)
      }
      gl.setRenderTarget(null)
      gl.autoClear = false
      gl.setScissorTest(true)
      for (const entry of entries) {
        const r = entry.view.rect
        const x = r.x * w
        const y = (1 - r.y - r.height) * h
        const vw = r.width * w
        const vh = r.height * h
        for (const mesh of [entry.frame, entry.quad]) mesh.visible = false
        // the dark frame a few pixels larger, then the picture
        entry.frame.visible = true
        gl.setViewport(x - FRAME_PX, y - FRAME_PX, vw + 2 * FRAME_PX, vh + 2 * FRAME_PX)
        gl.setScissor(x - FRAME_PX, y - FRAME_PX, vw + 2 * FRAME_PX, vh + 2 * FRAME_PX)
        gl.render(overlay, ortho)
        entry.frame.visible = false
        entry.quad.visible = true
        entry.quad.scale.x = entry.view.mirror ? -1 : 1
        gl.setViewport(x, y, vw, vh)
        gl.setScissor(x, y, vw, vh)
        gl.render(overlay, ortho)
        entry.quad.visible = false
      }
      gl.setScissorTest(false)
      gl.setViewport(0, 0, w, h)
      gl.autoClear = autoClear
      gl.shadowMap.autoUpdate = shadows
    },
    get count() {
      return entries.length
    },
    dispose() {
      for (const entry of [...entries]) take(entry)
      plane.dispose()
      mainCamera = null
    },
  }
}
