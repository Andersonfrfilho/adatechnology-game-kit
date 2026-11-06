/**
 * The mist on the inside of a built vehicle's glass, drawn from the fog share of `createWindshieldFog` (`game-vehicles-driving`). Each pane the kit drew
 * (`context.glass`) gets a thin pale film that follows it (a side window going down, a door swinging), on the pane's own geometry; the windshield shows
 * the whole share and the other panes a little less, since the demister blows on the windshield first. The film is never hit by a shot (it has no
 * raycast) and never writes depth. `dispose` takes the films away and frees their materials; the geometry is the pane's and stays.
 */
import type { BufferGeometry, Material, Mesh, Object3D } from 'three'

import type { BuiltVehicle } from './build'

/** What the mist needs of three.js. */
export type MistThree = {
  Mesh: new (geometry: BufferGeometry, material: Material) => Mesh
  MeshBasicMaterial: new (parameters: { color: number; transparent: boolean; opacity: number; depthWrite: boolean; side: number; polygonOffset: boolean; polygonOffsetFactor: number; polygonOffsetUnits: number }) => Material & { opacity: number }
}

/** How the mist looks: its colour, how opaque full fog is, and the share of it on the side and rear panes. */
export const MIST_RULES = { color: 0xe4e8ec, opacity: 0.72, others: 0.8 } as const

export interface WindshieldMist {
  /** Panes with a film. */
  readonly panes: number
  /** Shows `fog` (0 clear to 1 misted over). */
  set(fog: number): void
  readonly fog: number
  dispose(): void
}

type Pane = Object3D & { geometry?: BufferGeometry; material?: { side?: number } | unknown[]; userData: { glass?: { key?: string } } }
/** three.js `DoubleSide`: the kit draws its glass from both faces, and the film is seen from inside and out the same way. */
const DOUBLE_SIDE = 2

export function createWindshieldMist(THREE: MistThree, built: BuiltVehicle): WindshieldMist {
  const glass = ((built.context as { glass?: Pane[] } | null)?.glass ?? []).filter((p) => p?.geometry)
  const films: Array<{ mesh: Mesh; material: Material & { opacity: number }; share: number }> = []
  for (const pane of glass) {
    const side = (!Array.isArray(pane.material) && (pane.material as { side?: number } | undefined)?.side) || DOUBLE_SIDE
    const material = new THREE.MeshBasicMaterial({ color: MIST_RULES.color, transparent: true, opacity: 0, depthWrite: false, side, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    const mesh = new THREE.Mesh(pane.geometry as BufferGeometry, material)
    mesh.name = 'windshield_mist'
    // the film is a look of the pane, not a piece: shots, blows and the camera's picking pass to the glass under it
    mesh.raycast = () => {}
    mesh.userData.mist = true
    // drawn right after its pane (the kit sorts its glass with a render order of its own)
    mesh.renderOrder = pane.renderOrder + 1
    mesh.visible = false
    pane.add(mesh)
    films.push({ mesh, material, share: pane.userData.glass?.key === 'windshield' ? 1 : MIST_RULES.others })
  }
  let fog = 0
  return {
    panes: films.length,
    get fog() {
      return fog
    },
    set(next) {
      const share = Math.max(0, Math.min(1, next))
      if (Math.abs(share - fog) < 0.005 && (share > 0) === (fog > 0)) return
      fog = share
      for (const f of films) {
        f.material.opacity = MIST_RULES.opacity * fog * f.share
        f.mesh.visible = fog > 0.01
      }
    },
    dispose() {
      for (const f of films) {
        // the geometry is the pane's: only the film's own material goes
        f.mesh.removeFromParent()
        f.material.dispose()
      }
      films.length = 0
    },
  }
}
