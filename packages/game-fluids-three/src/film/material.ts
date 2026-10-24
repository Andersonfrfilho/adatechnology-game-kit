import type * as THREE_NS from 'three'
import type { FilmLook, FilmProfile } from '@adatechnology/game-fluids'
import type { ThreeLib } from '../types'
import { FILM_FRAGMENT, FILM_VERTEX } from './shader'

/** The page's `uFl` of each look (blood 0, bile 2, oil 3, fuel 4). */
export const LOOK_INDEX: Readonly<Record<FilmLook, number>> = { blood: 0, bile: 2, oil: 3, fuel: 4 }
const DEFAULT_SPAN = 4.95

export interface FilmMaterial {
  readonly material: THREE_NS.ShaderMaterial
  /** Sets the page's liquid uniforms from a profile (`setFluid`, F119-130). */
  setProfile(profile: FilmProfile): void
  dispose(): void
}

const rgb = (THREE: ThreeLib, target: THREE_NS.Vector3, hex: number): void => {
  target.set(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255)
}

/**
 * The film's material: the Fluid Standard's shader with the grid texture `tF` (r: thickness, g: dryness, b: dampness) and the liquid's colours.
 * It is transparent over the host's surface: the alpha is the film's coverage.
 */
export function createFilmMaterial(THREE: ThreeLib, texture: THREE_NS.Texture, width: number, height: number, span: number = DEFAULT_SPAN): FilmMaterial {
  const V3 = THREE.Vector3
  const uniforms = {
    tF: { value: texture },
    tx: { value: new THREE.Vector2(1 / width, 1 / height) },
    uGrid: { value: new THREE.Vector2(width, height) },
    uSpan: { value: span },
    uT: { value: 0 },
    uFl: { value: 0 },
    cThin: { value: new V3() },
    cThick: { value: new V3() },
    cDry: { value: new V3() },
    cDryThin: { value: new V3() },
    uBase: { value: new V3(0.4, 0.4, 0.38) },
    opK: { value: 3 },
    F0: { value: 0.03 },
    nrm: { value: 16 },
    camP: { value: new V3() },
    lampP: { value: new V3() },
    flashP: { value: new V3() },
    flashD: { value: new V3(0, 0, -1) },
    dbg: { value: 0 },
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FILM_VERTEX,
    fragmentShader: FILM_FRAGMENT,
    transparent: true,
    depthWrite: false,
    // the layout's axes may be either handed (the page's strips were all built facing out)
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  return {
    material,
    setProfile(profile) {
      uniforms.uFl.value = LOOK_INDEX[profile.look]
      rgb(THREE, uniforms.cThin.value, profile.thin)
      rgb(THREE, uniforms.cThick.value, profile.thick)
      rgb(THREE, uniforms.cDry.value, profile.dry)
      rgb(THREE, uniforms.cDryThin.value, profile.dryThin)
      uniforms.opK.value = profile.opacityRate
      uniforms.F0.value = profile.reflectance
      uniforms.nrm.value = profile.normalScale
    },
    dispose() {
      material.dispose()
    },
  }
}
