import type * as THREE_NS from 'three'
import type { EffectiveGraphics, ShadowLevel, ViewDistance } from '@adatechnology/game-graphics'

/** The far plane of each view distance, metres (default 60, 140 and 300). */
export const VIEW_DISTANCE_METERS: Readonly<Record<ViewDistance, number>> = { short: 60, medium: 140, long: 300 }

export interface GraphicsViewOptions {
  readonly renderer: THREE_NS.WebGLRenderer
  readonly camera: THREE_NS.PerspectiveCamera
  /** The light whose shadow the settings drive (the sun). Without one, the shadows option only turns the renderer's shadow map on and off. */
  readonly sun?: THREE_NS.DirectionalLight | null
  /** The pixel ratio at 100 % (default the device's, at most 2). */
  readonly basePixelRatio?: number
  readonly viewDistances?: Partial<Record<ViewDistance, number>>
  /** Half the side of the sun's shadow box under `near`, metres (default 9): the shadows of what is around the player, sharp, on a smaller map. */
  readonly nearExtent?: number
  /** Shadow map sides: `near` 1024, `all` 2048 by default. */
  readonly mapSize?: Partial<Record<Exclude<ShadowLevel, 'off'>, number>>
  /** The scene's fog, pulled in with a short view so the far plane does not cut the world off in a line. */
  readonly fog?: THREE_NS.Fog | null
}

export interface GraphicsView {
  /** Draws with these values (pixel ratio, shadows, far plane). */
  apply(effective: EffectiveGraphics): void
  /** Under `near` the shadow box follows this point (the player or the camera); call it every frame. Does nothing under the other levels. */
  follow(x: number, z: number): void
  /**
   * Puts the far plane back on the player's view distance when something else moved it (a module that lends the camera a longer view while it is loaded): the
   * player's choice holds. Call it every frame, before drawing.
   */
  hold(): void
  /** What was last applied. */
  readonly applied: { readonly pixelRatio: number; readonly shadows: ShadowLevel; readonly far: number } | null
}

/** The axes of a camera that looks from `offset` at the origin with world up, as `Matrix4.lookAt` builds them: right, up, back. */
function shadowCameraAxes(offset: THREE_NS.Vector3): readonly [THREE_NS.Vector3, THREE_NS.Vector3, THREE_NS.Vector3] {
  const back = offset.clone().normalize()
  const right = offset.clone().set(0, 1, 0).cross(back)
  if (right.lengthSq() < 1e-12) right.set(1, 0, 0)
  right.normalize()
  const up = back.clone().cross(right)
  return [right, up, back]
}

const devicePixelRatioOf = (): number => (typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1)

/**
 * Puts the graphics settings on a three.js renderer, camera and sun. The resolution scale is the pixel ratio, the shadows are the sun's map (off, a small sharp
 * box that follows the player, or the whole box it was given at a larger map), and the view distance is the far plane.
 */
export function createGraphicsView(options: GraphicsViewOptions): GraphicsView {
  const { renderer, camera, sun } = options
  const base = options.basePixelRatio ?? Math.min(devicePixelRatioOf(), 2)
  const distances = { ...VIEW_DISTANCE_METERS, ...options.viewDistances }
  const nearExtent = options.nearExtent ?? 9
  const mapSize = { near: 1024, all: 2048, ...options.mapSize }
  const fog = options.fog ?? null
  const fogFar = fog?.far ?? 0
  const fogNear = fog?.near ?? 0
  // the box and place the host gave the sun: `all` draws with them
  const sc = sun?.shadow.camera
  const whole = sc ? { left: sc.left, right: sc.right, top: sc.top, bottom: sc.bottom } : null
  const sunHome = sun ? sun.position.clone() : null
  const targetHome = sun ? sun.target.position.clone() : null
  const sunOffset = sun && targetHome ? sun.position.clone().sub(targetHome) : null
  // the shadow camera's right, up and back axes (three's lookAt from the sun to its target, world up): the map's texel grid lies in the first two
  const lightAxes = sunOffset && sunOffset.lengthSq() > 0 ? shadowCameraAxes(sunOffset) : null
  const followPoint = sunOffset ? sunOffset.clone() : null
  let shadows: ShadowLevel | null = null
  let applied: GraphicsView['applied'] = null

  const setBox = (half: number | null): void => {
    if (!sc || !whole) return
    if (half === null) Object.assign(sc, whole)
    else Object.assign(sc, { left: -half, right: half, top: half, bottom: -half })
    sc.updateProjectionMatrix()
  }
  const setMap = (size: number): void => {
    if (!sun || sun.shadow.mapSize.x === size) return
    sun.shadow.mapSize.set(size, size)
    sun.shadow.map?.dispose()
    sun.shadow.map = null
  }
  const setShadows = (level: ShadowLevel): void => {
    if (level === shadows) return
    shadows = level
    // off: no caster and no shadow pass (the lights' state changes, so three links the programs again without the shadow)
    renderer.shadowMap.enabled = level !== 'off'
    if (!sun) return
    sun.castShadow = level !== 'off'
    if (level === 'off') return
    setMap(mapSize[level])
    if (level === 'all') {
      setBox(null)
      if (sunHome) sun.position.copy(sunHome)
      if (targetHome) sun.target.position.copy(targetHome)
      sun.target.updateMatrixWorld()
    } else setBox(nearExtent)
  }

  return {
    apply(e) {
      const pixelRatio = base * e.resolutionScale
      if (Math.abs(renderer.getPixelRatio() - pixelRatio) > 1e-6) renderer.setPixelRatio(pixelRatio)
      setShadows(e.shadows)
      const far = distances[e.viewDistance]
      if (camera.far !== far) {
        camera.far = far
        camera.updateProjectionMatrix()
      }
      if (fog) {
        fog.far = Math.min(fogFar, far)
        fog.near = Math.min(fogNear, far * 0.6)
      }
      applied = { pixelRatio, shadows: e.shadows, far }
    },
    follow(x, z) {
      if (shadows !== 'near' || !sun || !sunOffset || !lightAxes || !followPoint) return
      // snapped to the texels of the map in the light's own plane (the sun is oblique: snapping world x and z still let every shadow edge shimmer as the player walks)
      const texel = (2 * nearExtent) / sun.shadow.mapSize.x
      const [ax, ay, az] = lightAxes
      followPoint.set(x, targetHome?.y ?? 0, z)
      const a = Math.round(followPoint.dot(ax) / texel) * texel
      const b = Math.round(followPoint.dot(ay) / texel) * texel
      const c = followPoint.dot(az)
      followPoint.copy(ax).multiplyScalar(a).addScaledVector(ay, b).addScaledVector(az, c)
      sun.target.position.copy(followPoint)
      sun.position.copy(followPoint).add(sunOffset)
      sun.target.updateMatrixWorld()
    },
    hold() {
      if (!applied || camera.far === applied.far) return
      camera.far = applied.far
      camera.updateProjectionMatrix()
    },
    get applied() {
      return applied
    },
  }
}

/** The GPU's name (unmasked where the browser tells it), so a calibration is redone on another GPU. */
export function gpuName(renderer: THREE_NS.WebGLRenderer): string {
  try {
    const gl = renderer.getContext()
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    return typeof name === 'string' && name ? name : 'unknown'
  } catch {
    return 'unknown'
  }
}
