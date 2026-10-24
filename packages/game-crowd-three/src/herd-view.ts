import type { Flock, Herd, HerdAnimal } from '@adatechnology/game-crowd'
import type * as THREE_NS from 'three'

/** One drawn animal, as `game-animals-three` builds it (structural: this package does not depend on it). */
export type DrawnAnimal = {
  readonly root: THREE_NS.Object3D
  readonly wings: readonly { readonly shoulder: THREE_NS.Object3D; readonly elbow: THREE_NS.Object3D; readonly side: number }[]
  phase: number
}

/** What draws the animals: `game-animals-three`'s `createAnimalsThree(THREE)` is one as it is. */
export type AnimalDrawer<TSpecies = unknown> = {
  build(species: TSpecies, options?: { readonly phase?: number }): DrawnAnimal
  animate(rig: DrawnAnimal, params: { readonly time: number; readonly delta: number; readonly clip: string }): void
  setVisualState?(rig: DrawnAnimal, state: 'alive' | 'infected' | 'dead'): void
}

export type HerdViewOptions<TSpecies> = {
  readonly herd: Herd
  readonly drawer: AnimalDrawer<TSpecies>
  /** The species card of an animal's species id (`game-animals-species` `getSpecies`). */
  readonly species: (id: string) => TSpecies | undefined
  /** The vultures: the flock that moves the herd's sky animals, in the order they were added. */
  readonly flock?: Flock
}

export type HerdView = {
  readonly group: THREE_NS.Group
  /** Builds what is new in the herd and moves every drawn animal to its place this frame (G 66697-66708). */
  update(dt: number): void
  readonly count: number
  clear(): void
}

/**
 * The herd drawn with the animals' own rigs: each animal where `game-crowd`'s herd put it, turned to its heading and animated with its clip (G 66697
 * `E.pele.mesh.position.set(E.x, 0, E.z)`, `animQuad`); the vultures where the flock puts them, gliding with the wings half open (G 66704-66708).
 */
export function createHerdView<TSpecies>(three: { readonly Group: new () => THREE_NS.Group }, options: HerdViewOptions<TSpecies>): HerdView {
  const group = new three.Group()
  group.name = 'herd'
  const drawn = new Map<HerdAnimal, DrawnAnimal>()
  const sky: HerdAnimal[] = []
  const build = (E: HerdAnimal): DrawnAnimal | null => {
    const species = options.species(E.spec.species)
    if (!species) return null
    const rig = options.drawer.build(species)
    rig.root.position.set(E.x, 0, E.z)
    if (E.dead) options.drawer.setVisualState?.(rig, 'dead')
    group.add(rig.root)
    drawn.set(E, rig)
    if (E.spec.sky) sky.push(E)
    return rig
  }
  return {
    group,
    update(dt) {
      for (const E of options.herd.list) if (!drawn.has(E)) build(E)
      const time = options.herd.time
      for (const [E, rig] of drawn) {
        if (E.spec.sky) continue
        rig.root.position.set(E.x, 0, E.z)
        rig.root.rotation.y = E.yaw
        options.drawer.animate(rig, { time, delta: dt, clip: E.clip })
      }
      sky.forEach((E, i) => {
        const rig = drawn.get(E)
        const U = options.flock?.birds[i]
        if (!rig || !U) return
        rig.root.position.set(U.x, U.y, U.z)
        rig.root.rotation.set(0, U.yaw, U.roll)
        rig.root.visible = U.visible
        if (!U.visible) return
        rig.phase = U.wing
        for (const w of rig.wings) {
          w.shoulder.rotation.y = 0
          w.elbow.rotation.y = 0
          w.shoulder.rotation.z = w.side * (0.18 + Math.sin(U.wing * 0.4) * 0.05)
        }
      })
    },
    get count() {
      return drawn.size
    },
    clear() {
      for (const rig of drawn.values()) group.remove(rig.root)
      drawn.clear()
      sky.length = 0
    },
  }
}
