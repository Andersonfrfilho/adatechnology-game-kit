import type * as THREE_NS from 'three'
import type { RainCover } from '@adatechnology/game-contracts'
import type { WeatherSample } from '@adatechnology/game-weather'
import type { ThreeLib, WeatherProfileName } from './types'

/**
 * The game's rain curtain (jogo.js `const RAIN = 14000`): a box of points that follows the camera, 70 m wide and 25 m high, falling 13 m/s. The shader texts and the
 * numbers are the page's, character for character (a golden cuts them from the page and compares).
 */
export const RAIN_CURTAIN = { count: 14000, width: 70, height: 25, speed: 13, pointSize: 1.6 } as const

export const RAIN_CURTAIN_VERTEX =
  'uniform float uTime; uniform vec3 uCam; void main(){ vec3 p = position; p.y = mod(p.y - uTime*13., 25.); p.xz = uCam.xz + mod(p.xz - uCam.xz + 35., 70.) - 35.; gl_Position = projectionMatrix*viewMatrix*vec4(p,1.); gl_PointSize = 1.6; }'
export const RAIN_CURTAIN_FRAGMENT = 'uniform float uDay; void main(){ gl_FragColor = vec4(vec3(.68,.72,.78)*(0.25+0.75*uDay), .22+.1*uDay); }'

/** The share of the 14 000 points each quality draws. */
export const RAIN_CURTAIN_PROFILES: Readonly<Record<WeatherProfileName, number>> = { low: 0.35, medium: 0.7, high: 1 }
/** The curtain's vertex shader when something is roofed over: a point under the top the cover texture holds for its cell is moved out of the view. Cells are `RAIN_COVER_CELL` wide. */
export const RAIN_CURTAIN_COVERED_VERTEX =
  'uniform float uTime; uniform vec3 uCam; uniform sampler2D uCover; uniform vec3 uCoverBox; void main(){ vec3 p = position; p.y = mod(p.y - uTime*13., 25.); p.xz = uCam.xz + mod(p.xz - uCam.xz + 35., 70.) - 35.; float top = texture2D(uCover, (p.xz - uCoverBox.xy) / (uCoverBox.z * 130.)).r; if (p.y < top) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; } gl_Position = projectionMatrix*viewMatrix*vec4(p,1.); gl_PointSize = 1.6; }'
/** Cells of the cover texture per side (the box of 70 m is 128 of them; two more take the snapping of its corner to the grid). */
export const RAIN_COVER_CELLS = 130
export const RAIN_COVER_CELL = RAIN_CURTAIN.width / 128
const NO_COVER_HEIGHT = -1

/** The weather's `drops` at which the whole curtain is drawn (the storm's 4 000). */
export const RAIN_CURTAIN_FULL_AT = 4000

/** The page's loop: x and z in -35..35, y in 0..25, three draws a point in that order, stored as Float32. */
export function rainCurtainPositions(random: () => number = Math.random, count: number = RAIN_CURTAIN.count): Float32Array {
  const positions = new Float32Array(count * 3)
  for (let index = 0; index < count; index++) {
    positions[index * 3] = (random() - 0.5) * RAIN_CURTAIN.width
    positions[index * 3 + 1] = random() * RAIN_CURTAIN.height
    positions[index * 3 + 2] = (random() - 0.5) * RAIN_CURTAIN.width
  }
  return positions
}

export type RainCurtainOptions = {
  readonly random?: () => number
  readonly profile?: WeatherProfileName
  /** Drops (`WeatherSample.drops`) that draw the whole curtain. */
  readonly fullAt?: number
  readonly count?: number
  /** What is roofed over: the points under a roof or slab are not drawn. Without it the curtain is the page's, shader and all. */
  readonly cover?: RainCover
}

export type RainCurtain = {
  readonly object: THREE_NS.Points
  /** Draws `sample.drops` of the curtain around `camera`; `daylight` is the game's `s` (0 night, 1 day). */
  update(sample: WeatherSample, camera: { readonly x: number; readonly y: number; readonly z: number }, time: number, daylight: number): void
  setProfile(profile: WeatherProfileName): void
  /** How many points are drawn now. */
  drawn(): number
  dispose(): void
}

export function createRainCurtain(THREE: ThreeLib, options: RainCurtainOptions = {}): RainCurtain {
  const count = options.count ?? RAIN_CURTAIN.count
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(rainCurtainPositions(options.random, count), 3))
  const uniforms = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uDay: { value: 1 } }
  const cover = options.cover
  const coverCells = cover ? new Float32Array(RAIN_COVER_CELLS * RAIN_COVER_CELLS) : undefined
  const coverTexture = coverCells ? new THREE.DataTexture(coverCells, RAIN_COVER_CELLS, RAIN_COVER_CELLS, THREE.RedFormat, THREE.FloatType) : undefined
  if (coverTexture) {
    coverTexture.minFilter = THREE.NearestFilter
    coverTexture.magFilter = THREE.NearestFilter
  }
  const coverBox = new THREE.Vector3()
  const coverUniforms: Record<string, { value: unknown }> = coverTexture ? { uCover: { value: coverTexture }, uCoverBox: { value: coverBox } } : {}
  const material = new THREE.ShaderMaterial({ uniforms: { ...uniforms, ...coverUniforms }, transparent: true, depthWrite: false, vertexShader: coverTexture ? RAIN_CURTAIN_COVERED_VERTEX : RAIN_CURTAIN_VERTEX, fragmentShader: RAIN_CURTAIN_FRAGMENT })
  let cutX = NaN
  let cutZ = NaN
  let cutVersion = -1
  /** The texture is cut again only when the camera moves to another cell or a cover changes: a cell is one read of the cover's grid. */
  const cutCover = (camera: { readonly x: number; readonly z: number }): void => {
    if (!cover || !coverCells || !coverTexture) return
    const originX = Math.floor((camera.x - RAIN_CURTAIN.width / 2) / RAIN_COVER_CELL) * RAIN_COVER_CELL
    const originZ = Math.floor((camera.z - RAIN_CURTAIN.width / 2) / RAIN_COVER_CELL) * RAIN_COVER_CELL
    const version = cover.version()
    if (originX === cutX && originZ === cutZ && version === cutVersion) return
    cutX = originX
    cutZ = originZ
    cutVersion = version
    for (let row = 0; row < RAIN_COVER_CELLS; row++) {
      for (let column = 0; column < RAIN_COVER_CELLS; column++) {
        coverCells[row * RAIN_COVER_CELLS + column] = cover.coverTopAt(originX + (column + 0.5) * RAIN_COVER_CELL, originZ + (row + 0.5) * RAIN_COVER_CELL) ?? NO_COVER_HEIGHT
      }
    }
    coverTexture.needsUpdate = true
    coverBox.set(originX, originZ, RAIN_COVER_CELL)
  }
  const object = new THREE.Points(geometry, material)
  object.frustumCulled = false
  object.name = 'weather-rain-curtain'
  object.visible = false
  let share = RAIN_CURTAIN_PROFILES[options.profile ?? 'high']
  let drawn = 0
  return {
    object,
    update(sample, camera, time, daylight) {
      const fullAt = options.fullAt ?? RAIN_CURTAIN_FULL_AT
      drawn = sample.rain > 0 ? Math.round(count * share * Math.min(1, sample.drops / fullAt)) : 0
      object.visible = drawn > 0
      geometry.setDrawRange(0, drawn)
      uniforms.uTime.value = time
      uniforms.uDay.value = daylight
      uniforms.uCam.value.set(camera.x, camera.y, camera.z)
      if (drawn > 0) cutCover(camera)
    },
    setProfile(profile) {
      share = RAIN_CURTAIN_PROFILES[profile]
    },
    drawn: () => drawn,
    dispose() {
      geometry.dispose()
      coverTexture?.dispose()
      material.dispose()
    },
  }
}
