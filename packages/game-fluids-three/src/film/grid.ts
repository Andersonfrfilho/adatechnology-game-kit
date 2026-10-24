import type * as THREE_NS from 'three'
import { createFilm } from '@adatechnology/game-fluids'
import type { Film, FilmBounds, FilmLayout, FilmProfile, FilmRandom, Vec3 } from '@adatechnology/game-fluids'
import type { ThreeLib } from '../types'
import { createFilmDrops } from './drops'
import type { FilmDrops } from './drops'
import { createFilmMaterial } from './material'
import type { FilmMaterial } from './material'
import { createStripGeometry } from './strips'

const MAX_THICKNESS = 6
const CHANNEL = 255
const VISIBLE_THICKNESS = 0.035
const DEFAULT_BASE = 0x666661
const MIN_CHANGE = 2
const CHANGE_FRACTION = 0.005
const LAMP_OFFSET: Vec3 = [0.9, 2.9, 0.4]

export interface FilmGridOptions {
  layout: FilmLayout
  profile: FilmProfile
  random: FilmRandom
  /** The host's surface colour under the film, `0xRRGGBB` (the shader blends over it). Default the page's sidewalk grey. */
  base?: number
  /** World point the grid is about: the distance to the player is measured from it. */
  center: Vec3
  stepRate?: number
  maxSteps?: number
}

/** A rectangle of cells, inclusive. */
export interface CellRect {
  firstRow: number
  lastRow: number
  firstColumn: number
  lastColumn: number
}

/**
 * One film grid on screen: the running film, its texture (thickness, dryness, dampness per cell as the page's `upload` writes them), the strips of the
 * layout drawn with the film shader, and the drops in flight.
 */
export class FilmGrid {
  readonly film: Film
  readonly group: THREE_NS.Group
  readonly texture: THREE_NS.DataTexture
  readonly center: Vec3
  readonly data: Uint8Array<ArrayBuffer>
  /** Seconds the grid has been without anything landing, flowing or drying. */
  idle = 0
  /** Set once the whole texture went to the GPU (the partial uploads need it there first). */
  uploaded = false
  private readonly strips: THREE_NS.Mesh[] = []
  private readonly material: FilmMaterial
  private readonly dropsView: FilmDrops
  private previous: CellRect | null = null
  private pending: CellRect | null = null
  private launched = 0
  private lastWet = 0

  constructor(
    private readonly THREE: ThreeLib,
    options: FilmGridOptions,
  ) {
    const { layout, profile } = options
    this.center = options.center
    this.film = createFilm({ layout, profile, random: options.random, ...(options.stepRate ? { stepRate: options.stepRate } : {}), ...(options.maxSteps ? { maxSteps: options.maxSteps } : {}) })
    this.data = new Uint8Array(new ArrayBuffer(layout.width * layout.height * 4))
    this.texture = new THREE.DataTexture(this.data, layout.width, layout.height, THREE.RGBAFormat)
    this.texture.magFilter = THREE.LinearFilter
    this.texture.minFilter = THREE.LinearFilter
    this.texture.needsUpdate = true
    // three calls this after the texture reached the GPU: from then on only the dirty rectangle has to go up
    this.texture.onUpdate = () => {
      this.uploaded = true
    }
    this.material = createFilmMaterial(THREE, this.texture, layout.width, layout.height, layout.height * layout.cellSize)
    this.material.setProfile(profile)
    this.group = new THREE.Group()
    this.group.name = 'film_grid'
    for (const region of layout.regions) {
      const mesh = new THREE.Mesh(createStripGeometry(THREE, layout, region), this.material.material)
      mesh.frustumCulled = false
      mesh.renderOrder = 3
      mesh.name = `film_${region.id}`
      this.strips.push(mesh)
      this.group.add(mesh)
    }
    this.dropsView = createFilmDrops(THREE, layout.rules.dropCapacity, profile)
    this.group.add(this.dropsView.drops, this.dropsView.bead)
    const uniforms = this.material.material.uniforms
    const base = options.base ?? DEFAULT_BASE
    uniforms.uBase!.value.set(((base >> 16) & 255) / 255, ((base >> 8) & 255) / 255, (base & 255) / 255)
    uniforms.lampP!.value.set(this.center[0] + LAMP_OFFSET[0], this.center[1] + LAMP_OFFSET[1], this.center[2] + LAMP_OFFSET[2])
    this.launched = this.film.drops.launched
  }

  get profile(): FilmProfile {
    return this.film.profile
  }

  setProfile(profile: FilmProfile): void {
    this.film.profile = profile
    this.material.setProfile(profile)
    this.dropsView.setProfile(profile)
  }

  /** Where the film's light and eye are (the page's `camP`, `flashP` and `flashD`). */
  setView(camera: Vec3, forward: Vec3, time: number): void {
    const uniforms = this.material.material.uniforms
    uniforms.camP!.value.set(camera[0], camera[1], camera[2])
    uniforms.flashP!.value.set(camera[0] + 0.12, camera[1] - 0.15, camera[2])
    uniforms.flashD!.value.set(forward[0], forward[1], forward[2])
    uniforms.uT!.value = time
  }

  /** Steps the film one frame and refreshes the texture cells that may have changed. Returns the rectangle to upload, or null. */
  update(dt: number, dryingSeconds: number): CellRect | null {
    this.film.update({ dt, dryingSeconds })
    const bounds: FilmBounds = this.film.simulator.bounds
    const launched = this.film.drops.launched
    const busy = launched !== this.launched || this.film.drip !== undefined || this.film.sources.length > 0 || this.film.drags.some((drag) => !drag.done) || this.dropsInFlight()
    this.launched = launched
    const current: CellRect | null = bounds.lastRow < 0 ? null : { firstRow: bounds.firstRow, lastRow: bounds.lastRow, firstColumn: bounds.firstColumn, lastColumn: bounds.lastColumn }
    const rect = this.union(this.previous, current)
    this.previous = current
    const wet = current ? this.film.wetCells() : 0
    // still = nothing arriving and the wet area changing by less than half a percent (a slow creep does not keep a grid alive)
    const moved = Math.abs(wet - this.lastWet) > Math.max(MIN_CHANGE, wet * CHANGE_FRACTION)
    this.idle = busy || moved ? 0 : this.idle + dt
    if (moved || busy) this.lastWet = wet
    if (!rect) return this.takePending()
    this.encode(rect)
    this.pending = this.union(this.pending, rect)
    return this.takePending()
  }

  private takePending(): CellRect | null {
    const rect = this.pending
    this.pending = null
    return rect
  }

  /** The mean dryness of the cells that are wet (1 when nothing is). */
  dryness(): number {
    const { thickness, dryness } = this.film.field
    let wet = 0
    let dry = 0
    for (let i = 0; i < thickness.length; i++) {
      if (thickness[i]! > VISIBLE_THICKNESS) {
        wet++
        dry += dryness[i]!
      }
    }
    return wet === 0 ? 1 : dry / wet
  }

  /** Draws the drops and the bead; answers how many drops are in flight. */
  syncDrops(): number {
    return this.dropsView.sync(this.film)
  }

  dropsInFlight(): boolean {
    const { active } = this.film.drops
    for (let i = 0; i < active.length; i++) if (active[i]) return true
    return false
  }

  /** Writes the cells of the texture from the field, as the page's `upload` does (F360). */
  encode(rect: CellRect): void {
    const { thickness, dryness, dampness, width } = this.film.field
    const data = this.data
    for (let row = rect.firstRow; row <= rect.lastRow; row++) {
      for (let column = rect.firstColumn; column <= rect.lastColumn; column++) {
        const cell = row * width + column
        const j = cell * 4
        const h = thickness[cell]!
        data[j] = h > 0 ? Math.min(CHANNEL, Math.sqrt(Math.min(MAX_THICKNESS, h) / MAX_THICKNESS) * CHANNEL + 0.5) : 0
        data[j + 1] = dryness[cell]! * CHANNEL
        data[j + 2] = dampness[cell]! * CHANNEL
        data[j + 3] = CHANNEL
      }
    }
  }

  /** Encodes the whole field (a grid made from a state, or after `clear`). */
  encodeAll(): void {
    this.encode({ firstRow: 0, lastRow: this.film.field.height - 1, firstColumn: 0, lastColumn: this.film.field.width - 1 })
    this.texture.needsUpdate = true
    this.uploaded = false
  }

  private union(a: CellRect | null, b: CellRect | null): CellRect | null {
    if (!a) return b ? { ...b } : null
    if (!b) return { ...a }
    return { firstRow: Math.min(a.firstRow, b.firstRow), lastRow: Math.max(a.lastRow, b.lastRow), firstColumn: Math.min(a.firstColumn, b.firstColumn), lastColumn: Math.max(a.lastColumn, b.lastColumn) }
  }

  dispose(): void {
    for (const mesh of this.strips) mesh.geometry.dispose()
    this.material.dispose()
    this.dropsView.dispose()
    this.texture.dispose()
  }
}
