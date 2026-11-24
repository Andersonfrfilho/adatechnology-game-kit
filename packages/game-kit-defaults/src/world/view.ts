import type * as THREE_NS from 'three'

import { FIRST_PERSON_LAYER } from '@adatechnology/game-contracts'

export type ThreeNamespace = typeof THREE_NS

export type KitWorldQuality = 'low' | 'medium' | 'high'

export type KitWorldViewOptions = {
  readonly THREE: ThreeNamespace
  readonly container: HTMLElement
  readonly renderer?: THREE_NS.WebGLRenderer
  readonly scene?: THREE_NS.Scene
  readonly camera?: THREE_NS.PerspectiveCamera
}

/** The renderer, scene and camera of the world: the game's own when it hands them in, else made here (and then released here). */
export type KitWorldView = {
  readonly gl: THREE_NS.WebGLRenderer
  readonly scene: THREE_NS.Scene
  readonly camera: THREE_NS.PerspectiveCamera
  readonly container: HTMLElement
  readonly domElement: HTMLElement | undefined
  /** The host made the renderer, so the host draws and releases it. */
  readonly ownsRenderer: boolean
  /** Screen points per metre at a distance of one metre: what the effects scale their sprites by. */
  readonly pointScale: number
  width(): number
  height(): number
  resize(): void
  /** Shadows and pixel ratio for a quality level, on a renderer the host made. */
  setQuality(quality: KitWorldQuality): void
  dispose(): void
}

const DEFAULT_WIDTH = 960
const DEFAULT_HEIGHT = 600
const MAX_PIXEL_RATIO = 2
const LOW_QUALITY_PIXEL_RATIO = 1

const devicePixelRatioOf = (): number => Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, MAX_PIXEL_RATIO)

export function createView(options: KitWorldViewOptions): KitWorldView {
  const { THREE } = options
  const container = options.container
  const ownsRenderer = !options.renderer
  const gl: THREE_NS.WebGLRenderer = options.renderer ?? new THREE.WebGLRenderer({ antialias: true })
  const width = (): number => container.clientWidth || DEFAULT_WIDTH
  const height = (): number => container.clientHeight || DEFAULT_HEIGHT
  if (ownsRenderer) {
    gl.setPixelRatio(devicePixelRatioOf())
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1
    gl.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(gl.domElement)
  }
  gl.setSize(width(), height())
  const domElement = gl.domElement as HTMLElement | undefined
  if (domElement && !domElement.hasAttribute?.('tabindex')) domElement.setAttribute?.('tabindex', '0')
  const scene = options.scene ?? new THREE.Scene()
  const camera = options.camera ?? new THREE.PerspectiveCamera(72, width() / height(), 0.05, 140)
  if (!options.camera) scene.add(camera)
  // the first-person layer (the tool in the hands and its arms) is drawn by a pass of its own over the world
  camera.layers.disable(FIRST_PERSON_LAYER)
  const resize = (): void => {
    gl.setSize(width(), height())
    camera.aspect = width() / height()
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize)
  return {
    gl,
    scene,
    camera,
    container,
    domElement,
    ownsRenderer,
    pointScale: height() / (2 * Math.tan((camera.fov * Math.PI) / 360)),
    width,
    height,
    resize,
    setQuality(quality) {
      if (!ownsRenderer) return
      gl.shadowMap.enabled = quality !== 'low'
      gl.setPixelRatio(quality === 'low' ? LOW_QUALITY_PIXEL_RATIO : devicePixelRatioOf())
      resize()
    },
    dispose() {
      window.removeEventListener('resize', resize)
      if (!options.camera) camera.removeFromParent()
      if (!ownsRenderer) return
      gl.dispose()
      domElement?.remove()
    },
  }
}
