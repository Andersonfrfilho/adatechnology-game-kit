import type * as THREE_NS from 'three'
import type { AnimationClipSpec } from '@adatechnology/game-contracts'
import { sampleClip } from '@adatechnology/game-contracts'
import type { WeaponModel } from '../models'
import data from '../data/hand-work.json'
import { HAND_HOLD, handFrame } from './hand-hold'
import type { HandAnchor } from './hand-hold'

type Three = typeof THREE_NS

/** One thing a hand does to a part of a weapon while a clip of the weapon moves it (`data/hand-work.json`). */
export interface HandWork {
  hand: 'R' | 'L'
  anchor: HandAnchor
  /** The part whose motion in the clip is the work, or null for work that lasts the whole clip. */
  part: string | null
  clips: readonly string[]
  /** Pauses between two moves of the part shorter than this fraction of the clip do not let go. */
  merge: number
  /** The anchor follows the part it names. */
  id: string
  /** Fractions of the clip the hand takes to arrive and to leave, when this work asks for other than the data's `timing`. */
  lead?: number
  tail?: number
}

const V = (THREE: Three, x: number, y: number, z: number): THREE_NS.Vector3 => new THREE.Vector3(x, y, z)

/** The part's box in the space of the model root (x forward, y up, z to the right). */
const boxIn = (THREE: Three, root: THREE_NS.Object3D, part: THREE_NS.Object3D): THREE_NS.Box3 => {
  const world = new THREE.Box3().setFromObject(part)
  const box = new THREE.Box3()
  for (const x of [world.min.x, world.max.x]) for (const y of [world.min.y, world.max.y]) for (const z of [world.min.z, world.max.z]) box.expandByPoint(root.worldToLocal(V(THREE, x, y, z)))
  return box
}

/** Where the model's grip hand rests, so a thumb can reach from it. */
type Anchors = (kind: string, partId: string | null) => HandAnchor | null

const anchorsOf = (THREE: Three, model: WeaponModel, right: HandAnchor | null): Anchors => {
  const { root, parts } = model
  root.updateWorldMatrix(true, true)
  const palm = HAND_HOLD.palm
  const anchorAt = (part: THREE_NS.Object3D, at: THREE_NS.Vector3, quaternion: THREE_NS.Quaternion): HandAnchor => ({ part, offset: part.worldToLocal(root.localToWorld(at.clone())), quaternion })
  return (kind, partId) => {
    const part = partId ? ((parts as unknown as Record<string, THREE_NS.Object3D | undefined>)[partId] ?? null) : null
    if (kind === 'loading_port') {
      const port = parts.loadPort
      if (!port) return null
      const at = root.worldToLocal(port.getWorldPosition(V(THREE, 0, 0, 0))).add(V(THREE, 0, -palm - 0.004, 0))
      return anchorAt(port, at, handFrame(THREE, V(THREE, 0, 0, -1), V(THREE, 0, -1, 0)))
    }
    if (kind === 'thumb_release') {
      if (!right || !parts.slide) return null
      return { part: right.part, offset: right.offset.clone().add(V(THREE, 0, 0.012, 0)), quaternion: right.quaternion }
    }
    if (!part) return null
    const b = boxIn(THREE, root, part)
    const c = b.getCenter(V(THREE, 0, 0, 0))
    switch (kind) {
      case 'slide_rear': // the support hand pinches the rear of the slide from the left, the palm toward it
        return anchorAt(part, V(THREE, b.min.x + 0.014, b.max.y - 0.006, b.min.z - palm), handFrame(THREE, V(THREE, 1, 0, 0), V(THREE, 0, 0, -1)))
      case 'rear_top': // the charging handle at the rear top of the receiver, taken from above
        return anchorAt(part, V(THREE, b.min.x + 0.016, b.max.y + palm, c.z), handFrame(THREE, V(THREE, 1, 0, 0), V(THREE, 0, 1, 0)))
      case 'side_right': // the bolt handle on the right of the receiver, reached over the top, the palm toward the gun
        return anchorAt(part, V(THREE, c.x, c.y, b.max.z + palm), handFrame(THREE, V(THREE, 1, 0, 0), V(THREE, 0, 0, 1)))
      case 'top_handle': // the knob of a bolt, held from the right
        return anchorAt(part, V(THREE, c.x, c.y, b.max.z + palm), handFrame(THREE, V(THREE, 1, 0, 0), V(THREE, 0, 0, 1)))
      case 'cover_top':
        return anchorAt(part, V(THREE, c.x, b.max.y + palm, c.z), handFrame(THREE, V(THREE, 1, 0, 0), V(THREE, 0, 1, 0)))
      case 'cylinder_side': // the crane swings out to the left, the support hand pushes it and holds it
        return anchorAt(part, V(THREE, c.x, c.y, b.min.z - palm), handFrame(THREE, V(THREE, 1, 0, 0), V(THREE, 0, 0, -1)))
      default:
        return null
    }
  }
}

const releasePistols = new Set<string>(data.pistolRelease.weapons)
const akCharge = new Set<string>(data.akCharge.weapons)

/** The work the hands do on this weapon (the entries of `data/hand-work.json` for its family and style that find their part). */
export function handWorkOf(THREE: Three, model: WeaponModel, weaponId: string, right: HandAnchor | null): HandWork[] {
  const family = model.parts.family
  const anchors = anchorsOf(THREE, model, right)
  const style = family === 'pistol' ? (releasePistols.has(weaponId) ? 'release' : 'rack') : akCharge.has(weaponId) ? 'ak' : 'ar'
  const out: HandWork[] = []
  for (const entry of data.works as ReadonlyArray<{ family: string; clips: string[]; part?: string; hand: 'R' | 'L'; anchor: string; style?: string; merge?: number; whole?: boolean; lead?: number; tail?: number }>) {
    if (entry.family !== family || (entry.style && entry.style !== style)) continue
    const anchor = anchors(entry.anchor, entry.part ?? null)
    if (!anchor) continue
    out.push({ hand: entry.hand, anchor, part: entry.whole ? null : (entry.part ?? null), clips: entry.clips, merge: entry.merge ?? 0, id: entry.anchor, ...(entry.lead === undefined ? {} : { lead: entry.lead }), ...(entry.tail === undefined ? {} : { tail: entry.tail }) })
  }
  return out
}

const segmentsCache = new WeakMap<AnimationClipSpec, Map<string, Array<[number, number]>>>()

/** The spans of the clip (seconds) in which `part` moves, with the pauses shorter than `merge` (a fraction of the clip) closed. */
export const motionOf = (clip: AnimationClipSpec, part: string, merge: number): Array<[number, number]> => {
  const cache = segmentsCache.get(clip) ?? new Map<string, Array<[number, number]>>()
  segmentsCache.set(clip, cache)
  const key = `${part}|${merge}`
  const found = cache.get(key)
  if (found) return found
  const steps = 240
  const dt = clip.duration / steps
  const spans: Array<[number, number]> = []
  let start: number | null = null
  for (let i = 1; i <= steps; i++) {
    const a = sampleClip(clip, part, (i - 1) * dt)
    const b = sampleClip(clip, part, i * dt)
    const moving = [0, 1, 2].some((axis) => Math.abs(b.position[axis]! - a.position[axis]!) > 1e-6 || Math.abs(b.rotation[axis]! - a.rotation[axis]!) > 1e-6)
    if (moving && start === null) start = (i - 1) * dt
    if (!moving && start !== null) {
      spans.push([start, (i - 1) * dt])
      start = null
    }
  }
  if (start !== null) spans.push([start, clip.duration])
  const joined: Array<[number, number]> = []
  for (const span of spans) {
    const last = joined[joined.length - 1]
    if (last && span[0] - last[1] <= merge * clip.duration) last[1] = span[1]
    else joined.push([span[0], span[1]])
  }
  cache.set(key, joined)
  return joined
}

const smooth = (x: number): number => {
  const k = Math.min(1, Math.max(0, x))
  return k * k * (3 - 2 * k)
}

/** How much each piece of work holds its hand now (0..1), from the clips that are running. */
export function workWeights(works: readonly HandWork[], running: ReadonlyArray<{ name: string; time: number; clip: AnimationClipSpec }>): number[] {
  return works.map((work) => {
    const lead = work.lead ?? data.timing.lead
    const tail = work.tail ?? data.timing.tail
    let best = 0
    for (const { name, time, clip } of running) {
      if (!work.clips.includes(name)) continue
      const spans: Array<[number, number]> = work.part ? motionOf(clip, work.part, work.merge) : [[0, clip.duration]]
      for (const [from, to] of spans) {
        const before = lead * clip.duration
        const after = tail * clip.duration
        const w = work.part ? smooth((time - (from - before)) / before) * smooth(((to + after) - time) / after) : smooth(time / before) * smooth((clip.duration - time) / after)
        best = Math.max(best, w)
      }
    }
    return best
  })
}
