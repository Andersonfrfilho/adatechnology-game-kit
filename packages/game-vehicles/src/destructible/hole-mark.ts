/**
 * How a bullet mark on a vehicle's skin is drawn: one disc shared by every mark (its normals bowl in, so the light reads the sheet pushed in around the bore)
 * and one texture per panel material and mark style (`HoleStyle`): the dark bore with its inner wall, the bright lip of torn sheet, the ring of bare metal
 * and the chipped paint around it. The mark is a disc lying on the panel; `VehicleVisuals.holeDecal` places it.
 */
import type { BufferGeometry, Material } from '../three-types'
import type { KitShared, Three } from '../types'
import type { VehicleKit } from '../api'
import type { HoleStyle } from '../hole-shape'
import { drawExtraMark, EXTRA_MARK_STYLES } from './mark-textures'
import type { ExtraMarkStyle } from './mark-textures'

/** Every mark a vehicle's skin takes: a round's entry (`HoleStyle`) or one of the others (a blade's, a dent's paint, a round's exit). */
export type MarkStyle = HoleStyle | ExtraMarkStyle

/** What `holeDecal` draws: the style, the size across (metres) and the stretch along the swing or the round's path. */
export interface MarkLook {
  readonly style: MarkStyle
  readonly markDiameter: number
  readonly elongation: number
}

const TEXTURE_SIZE = 128
/** Rings and spokes of the shared disc: enough vertices for the bowl of normals to read smooth. */
const DISC_RINGS = [0, 0.18, 0.34, 0.5, 0.66, 0.82, 1] as const
const DISC_SPOKES = 24
/** How far the normals of the disc lean in towards the middle (the sheet pushed in), and the radius (of the disc's 1) the bowl reaches. */
const BOWL_LEAN = 0.85
const BOWL_REACH = 0.9
/** Per material: the bare metal (or the broken face) the round leaves around the bore. */
const BARE: Readonly<Record<string, string>> = { steel: '#a9aeb2', aluminium: '#cfd3d6', plastic: '#d9d6cc', rubber: '#141414', glass: '#eef3f5' }
const STEEL_BARE = '#a9aeb2'
/** The grey primer under a car's paint, seen where the paint flaked off around the bare ring. */
const PRIMER = '#7d8285'
/** A petal of torn sheet reaches this far into the bore (of its radius) and is this wide (of the share of the round each petal has). */
const PETAL_TIP = 0.62
const PETAL_WIDTH = 0.42
const PETAL_SHADE = '#6f7478'
/** Radius of the bore on the texture (of its half side) for each style: the share of the mark the bore takes in `bulletHoleShape`. */
export const BORE_SHARE: Readonly<Record<HoleStyle, number>> = { round: 0.45, petalled: 0.3, ragged: 0.44, dimple: 0, gouge: 0.2 }

const materials = new WeakMap<object, Map<string, Material>>()
let disc: BufferGeometry | null = null

/** The shared disc of radius 1 in the xy plane facing +z, its normals leaning in towards the middle. */
export function holeMarkGeometry(THREE: Three): BufferGeometry {
  if (disc) return disc
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  for (const r of DISC_RINGS) {
    const spokes = r === 0 ? 1 : DISC_SPOKES
    // the slope of a bowl: steepest half way, flat at the bottom and at the rim
    const lean = r > 0 && r < BOWL_REACH ? (BOWL_LEAN * Math.sin((Math.PI * r) / BOWL_REACH)) / r : 0
    for (let k = 0; k < spokes; k++) {
      const a = (k / DISC_SPOKES) * Math.PI * 2
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      const n = new THREE.Vector3(-x * lean, -y * lean, 1).normalize()
      positions.push(x, y, 0)
      normals.push(n.x, n.y, n.z)
      uvs.push(0.5 + x / 2, 0.5 + y / 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(discIndices())
  disc = geometry
  return geometry
}

/** The triangles of the disc: a fan around the centre (vertex 0), then quads between rings (ring i >= 1 starts at 1 + (i - 1) * DISC_SPOKES). */
function discIndices(): number[] {
  const indices: number[] = []
  const start = (ring: number): number => 1 + (ring - 1) * DISC_SPOKES
  for (let k = 0; k < DISC_SPOKES; k++) indices.push(0, start(1) + k, start(1) + ((k + 1) % DISC_SPOKES))
  for (let ring = 1; ring < DISC_RINGS.length - 1; ring++) {
    for (let k = 0; k < DISC_SPOKES; k++) {
      const a = start(ring) + k
      const b = start(ring) + ((k + 1) % DISC_SPOKES)
      const c = start(ring + 1) + k
      const d = start(ring + 1) + ((k + 1) % DISC_SPOKES)
      indices.push(a, c, d, a, d, b)
    }
  }
  return indices
}

/** A jagged closed outline around the middle: `radius` of the half side, each point `jag` in or out (seeded, the same on every draw). */
function jagged(x: CanvasRenderingContext2D, options: { readonly radius: number; readonly jag: number; readonly points: number; readonly seed: number }): void {
  const mid = TEXTURE_SIZE / 2
  x.beginPath()
  for (let i = 0; i <= options.points; i++) {
    const a = (i / options.points) * Math.PI * 2
    const wobble = Math.sin(i * 12.9898 + options.seed * 78.233) * 43758.5453
    const r = mid * options.radius * (1 - options.jag + 2 * options.jag * (wobble - Math.floor(wobble)))
    x.lineTo(mid + Math.cos(a) * r, mid + Math.sin(a) * r)
  }
  x.closePath()
}

/** The bore: black at the middle, the inner wall of the sheet lighter at its edge, and the bright lip of the cut sheet around it. */
function drawBore(x: CanvasRenderingContext2D, share: number, bare: string): void {
  const mid = TEXTURE_SIZE / 2
  const r = mid * share
  const wall = x.createRadialGradient(mid, mid, 0, mid, mid, r)
  wall.addColorStop(0, '#000000')
  wall.addColorStop(0.6, '#050505')
  wall.addColorStop(1, '#2a2b2c')
  x.fillStyle = wall
  x.beginPath()
  x.arc(mid, mid, r, 0, Math.PI * 2)
  x.fill()
  x.strokeStyle = bare
  x.lineWidth = Math.max(1, mid * 0.05)
  x.beginPath()
  x.arc(mid, mid, r, 0, Math.PI * 2)
  x.stroke()
}

/** Torn petals of sheet bent into the bore: short wedges of the sheet from the lip pointing in, in its shade (they face away from the light). */
function drawPetals(x: CanvasRenderingContext2D, share: number, petals: number): void {
  const mid = TEXTURE_SIZE / 2
  x.fillStyle = PETAL_SHADE
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 + 0.4
    const half = (Math.PI / petals) * PETAL_WIDTH
    x.beginPath()
    x.moveTo(mid + Math.cos(a - half) * mid * share, mid + Math.sin(a - half) * mid * share)
    x.lineTo(mid + Math.cos(a) * mid * share * PETAL_TIP, mid + Math.sin(a) * mid * share * PETAL_TIP)
    x.lineTo(mid + Math.cos(a + half) * mid * share, mid + Math.sin(a + half) * mid * share)
    x.closePath()
    x.fill()
  }
}

/** The chipped paint (primer) and the bare ring with the scores the round's shock leaves in it. */
function drawRing(x: CanvasRenderingContext2D, material: string, style: HoleStyle): void {
  const mid = TEXTURE_SIZE / 2
  const bare = BARE[material] ?? STEEL_BARE
  const share = BORE_SHARE[style]
  if (material === 'steel' || material === 'aluminium') {
    x.fillStyle = PRIMER
    jagged(x, { radius: style === 'petalled' ? 0.9 : 0.86, jag: 0.12, points: 22, seed: style.length })
    x.fill()
  }
  x.fillStyle = bare
  jagged(x, { radius: Math.max(share + 0.18, style === 'dimple' ? 0.55 : 0.6), jag: 0.08, points: 18, seed: style.length + 3 })
  x.fill()
  x.strokeStyle = 'rgba(70, 72, 74, 0.55)'
  x.lineWidth = 1
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2
    x.beginPath()
    x.moveTo(mid + Math.cos(a) * mid * (share + 0.05), mid + Math.sin(a) * mid * (share + 0.05))
    x.lineTo(mid + Math.cos(a) * mid * (share + 0.2), mid + Math.sin(a) * mid * (share + 0.2))
    x.stroke()
  }
}

/** No bore: the crushed bottom of the dent, darker to one side as a hollow is. */
function drawDimple(x: CanvasRenderingContext2D): void {
  const mid = TEXTURE_SIZE / 2
  const hollow = x.createRadialGradient(mid * 0.92, mid * 0.92, 0, mid, mid, mid * 0.4)
  hollow.addColorStop(0, '#3c3e40')
  hollow.addColorStop(1, 'rgba(60, 62, 64, 0)')
  x.fillStyle = hollow
  x.beginPath()
  x.arc(mid, mid, mid * 0.4, 0, Math.PI * 2)
  x.fill()
}

/** A dark crease down the middle of a scrape (the instance's stretch draws it along the round's path). */
function drawCrease(x: CanvasRenderingContext2D): void {
  const mid = TEXTURE_SIZE / 2
  const crease = x.createLinearGradient(0, mid * 0.75, 0, mid * 1.25)
  crease.addColorStop(0, 'rgba(20, 20, 20, 0)')
  crease.addColorStop(0.5, '#141414')
  crease.addColorStop(1, 'rgba(20, 20, 20, 0)')
  x.fillStyle = crease
  x.fillRect(mid * 0.15, mid * 0.75, mid * 1.7, mid * 0.5)
}

/** One mark on a canvas: the ring, then the bore, the dent or the scrape of the style. */
function drawMark(x: CanvasRenderingContext2D, material: string, style: HoleStyle): void {
  const bare = BARE[material] ?? STEEL_BARE
  const share = BORE_SHARE[style]
  drawRing(x, material, style)
  if (style === 'dimple') return drawDimple(x)
  if (style === 'gouge') drawCrease(x)
  drawBore(x, share, bare)
  if (style === 'petalled') drawPetals(x, share, 5)
  if (style !== 'ragged') return
  // a big ragged edge: the black bore torn wider at a few places, the sheet bent in
  x.fillStyle = '#030303'
  jagged(x, { radius: share, jag: 0.22, points: 11, seed: 7 })
  x.fill()
  drawPetals(x, share, 7)
}

/** The material of every mark of one panel material and one style (shared, never disposed with a vehicle: the kit owns it). */
export function holeMarkMaterial(kit: VehicleKit, material: string, style: MarkStyle): Material {
  const key = kit as unknown as object
  const cache = materials.get(key) ?? new Map<string, Material>()
  materials.set(key, cache)
  const id = `${material}|${style}`
  const known = cache.get(id)
  if (known) return known
  const shared = (kit as unknown as { _: KitShared })._
  const THREE: Three = kit.THREE
  const canvas = (kit as unknown as { document?: Document }).document?.createElement?.('canvas')
  const context = canvas?.getContext?.('2d')
  let made: Material = shared.MATERIALS.dark
  if (canvas && context) {
    canvas.width = canvas.height = TEXTURE_SIZE
    if (EXTRA_MARK_STYLES.has(style)) drawExtraMark(context, TEXTURE_SIZE, style as ExtraMarkStyle)
    else drawMark(context, material, style as HoleStyle)
    const map = new THREE.CanvasTexture(canvas)
    const metal = material === 'steel' || material === 'aluminium'
    // a constant pull towards the eye (units) keeps the mark in front of its own panel; a slope-scaled one (factor) would pull it through the panel before it at a grazing view
    made = new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2, roughness: 0.5, metalness: metal ? 0.55 : 0 })
  }
  cache.set(id, made)
  return made
}
