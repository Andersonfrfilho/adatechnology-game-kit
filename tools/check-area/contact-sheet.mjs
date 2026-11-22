// @ts-check
// Contact sheets for the example areas whose page test records the catalogue (examples/<area>/test.mjs): several catalogue entries in a row, each labelled with its id drawn in the page,
// from a fixed debug camera over the shared test room, at a fixed time of day, the animation frozen after a fixed number of frames. Writes the PNGs and shots/index.json (the entry ids of
// every image in grid order, the camera and the seed: what a review ledger references) and shots/sanity.json (the share of pixels that differ from the same view with nothing spawned, per image and per entry).
// A manual review tool, like every page test (CLAUDE.md section 9): do not wire it as a nightly or CI gate. It fails on a defect that is not in known-defects.json and on one listed that is no longer seen,
// so one transient render glitch would fail it.
// The measuring (boxOf) reads the vertices of rigid mesh groups; if skinned meshes appear this must use posed vertices (the guard in boxOf throws when one does).
// Only what the room already exposes is used (spawn, clear, update, pause, setDebugCamera, leaves, useLeaf, environment): nothing here adds game logic and nothing is added to the room.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** The viewport of every sheet: wide enough for a row of eight, 16:9 so the horizontal field of view is stable. */
export const SHEET_VIEWPORT = { width: 1600, height: 900 }
/** Frames of 1/60 s the room runs after the entries are spawned, then it is paused: the animation stands at this time in every sheet. */
export const FREEZE_FRAMES = 153
/** An entry whose cell has less than this share of pixels different from the empty view rendered nothing. */
export const EMPTY_SHARE = 0.01
/** An entry standing higher than this above the ground (m) is reported as floating. */
export const FLOAT_LIMIT_M = 0.05
/** An entry whose lowest point over the cycle is deeper than this under the ground (m) is reported as sinking. */
export const SINK_LIMIT_M = 0.05
/** The reading varies a few millimetres between runs; the ledger keeps a verdict from flipping at the limit: an id in known-defects.json is held past limit - this, one that is not only past limit + this. */
export const LIMIT_TOLERANCE_M = 0.005
/** A picture of a subject in the hand has less than this share of pixels different from the same view without it: nothing of it is seen. */
export const PHOTO_EMPTY_SHARE = 0.003

/** @template T @param {T[]} list @param {number} size @returns {T[][]} the list cut in runs of at most `size`, in order */
export const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, at) => list.slice(at * size, at * size + size))

/** Milliseconds one sheet (or one picture) may take, and the whole area run: a hung page stops the run naming the entry, not the machine. */
export const SHEET_TIMEOUT_MS = 300000
export const AREA_TIMEOUT_MS = 1800000
/** What the run is rendering now, for the timeout messages. */
let currentWork = 'opening the room page'

const BROWSER_ARGS = ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']

/**
 * Runs in the page (it is serialised: nothing outside its body may be used). Lays one sheet and answers where everything ended up.
 * @param {{ entries: {id: string, label: string}[], view: {kind: string, fov: number, azimuthDeg: number, elevationDeg: number}, yaw: number | 'long-axis-x', gap: number, ruler: boolean, openLeaves: boolean, title: string, withEntries: boolean, extraFrames: number }} args
 */
async function laySheetInPage(args) {
  const room = /** @type {any} */ (window).__testRoom
  const canvas = document.querySelector('canvas')
  const app = document.getElementById('app')
  if (app) for (const element of app.querySelectorAll('*')) if (element !== canvas && !element.contains(canvas)) /** @type {HTMLElement} */ (element).style.visibility = 'hidden'
  document.getElementById('sheet-overlay')?.remove()
  room.setDebugCamera(null)
  if (room.paused) room.resume()
  room.environment.set({ nightFactor: 0, rain: 0, windX: 0, windZ: 0, windSpeed: 0, gust: 0, wetness: 0 })
  const Vector = room.camera.position.constructor
  const { kind, fov, azimuthDeg, elevationDeg } = args.view
  const az = (azimuthDeg * Math.PI) / 180
  const el = (elevationDeg * Math.PI) / 180
  const toCamera = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]
  const rowAxis = [Math.cos(az), 0, -Math.sin(az)]

  /** @param {any} root @returns {{min: number[], max: number[], minAt: string | null, maxAt: string | null} | null} */
  const boxOf = (root) => {
    root.updateMatrixWorld(true)
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    /** @type {{ object: any, x: number, z: number } | null} */
    let minAt = null
    /** @type {{ object: any, x: number, z: number } | null} */
    let maxAt = null
    root.traverse((/** @type {any} */ object) => {
      // a static batch is drawn from a unit-box placeholder until it is filled: its box says nothing about the entry
      if (!(object.isMesh || object.isSkinnedMesh) || !object.geometry || String(object.name).startsWith('batch:')) return
      for (let parent = object; parent; parent = parent.parent) if (parent.visible === false) return
      // the bodies are rigid groups moved by the rig, so the vertices as stored are the posed ones; the only SkinnedMeshes are the static batches, skipped above
      if (object.isSkinnedMesh) throw new Error(`contact-sheet: a visible SkinnedMesh (${object.name || 'unnamed'}): its vertices are in bind pose, measure it with posed vertices (SkinnedMesh.getVertexPosition)`)
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox()
      const box = object.geometry.boundingBox
      if (!box) return
      /** @param {any} point */
      const take = (point) => {
        if (point.y < min[1]) minAt = { object, x: point.x, z: point.z }
        if (point.y > max[1]) maxAt = { object, x: point.x, z: point.z }
        min[0] = Math.min(min[0], point.x); min[1] = Math.min(min[1], point.y); min[2] = Math.min(min[2], point.z)
        max[0] = Math.max(max[0], point.x); max[1] = Math.max(max[1], point.y); max[2] = Math.max(max[2], point.z)
      }
      // the vertices when the mesh is small (the box of a turned sphere or tyre is wider than the thing), the corners of its box when it is huge
      const position = object.geometry.attributes.position
      if (position && position.count <= 100000) {
        for (let at = 0; at < position.count; at++) take(new Vector(position.getX(at), position.getY(at), position.getZ(at)).applyMatrix4(object.matrixWorld))
      } else {
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) take(new Vector(x, y, z).applyMatrix4(object.matrixWorld))
      }
    })
    // what holds the lowest and the highest point: the meshes are unnamed, so the geometry, its colour and how far from the root's axis the point is say whether it is the head, a hand or a foot
    const describe = (/** @type {{ object: any, x: number, z: number } | null} */ at) => {
      if (!at) return null
      const material = Array.isArray(at.object.material) ? at.object.material[0] : at.object.material
      const colour = material && material.color ? `#${material.color.getHexString()}` : 'no colour'
      let depth = 0
      for (let parent = at.object.parent; parent && parent !== root; parent = parent.parent) depth++
      const lateral = Math.hypot(at.x - root.position.x, at.z - root.position.z)
      return `${at.object.geometry.type} of ${at.object.geometry.attributes.position?.count ?? 0} vertices, ${colour}, ${depth} levels under the root, ${lateral.toFixed(2)} m from its axis, parent "${at.object.parent?.name || at.object.parent?.type}"`
    }
    return Number.isFinite(min[0]) && max[0] > min[0] ? { min, max, minAt: describe(minAt), maxAt: describe(maxAt) } : null
  }

  // the top of the skull as tools/measure-body-and-cabin.mjs takes it (the first visible mesh of the head group's first child), so hair, a raised hand and a leap are not in it; null for a body without a rig head
  const headTopOf = (/** @type {any} */ root) => {
    const headGroup = root.userData && root.userData.rig ? root.userData.rig.headG : null
    const skull = headGroup && headGroup.children[0] ? headGroup.children[0].children.find((/** @type {any} */ child) => child.isMesh && child.visible) : null
    if (!skull) return null
    root.updateMatrixWorld(true)
    const position = skull.geometry.attributes.position
    let top = -Infinity
    for (let at = 0; at < position.count; at++) top = Math.max(top, new Vector(position.getX(at), position.getY(at), position.getZ(at)).applyMatrix4(skull.matrixWorld).y)
    return Number.isFinite(top) ? top : null
  }

  const headTopRounded = (/** @type {number | null} */ top) => (top === null ? null : +top.toFixed(3))

  // pass 1: every entry at yaw 0 on its own spot, far apart, to measure it
  room.clear()
  /** @type {any[]} */
  const measured = []
  const failed = []
  for (const [index, entry] of args.entries.entries()) {
    try {
      const spawned = room.spawn(entry.id, [index * 40 - 400, 0, 300], 0)
      for (let frame = 0; frame < 3; frame++) room.update(1 / 60)
      const box = boxOf(spawned.root)
      const size = room.measure(entry.id)
      const leaves = room.leaves(spawned.objectId)
      measured.push({ ...entry, box, size, leaves, origin: [spawned.root.position.x, spawned.root.position.z] })
    } catch (error) {
      failed.push({ id: entry.id, reason: (error instanceof Error ? error.message : String(error)) })
      measured.push({ ...entry, box: null, size: null, leaves: [], origin: [0, 0], failed: true })
    }
  }
  const dims = measured.map((entry) => {
    if (entry.box) return { dx: entry.box.max[0] - entry.box.min[0], dy: entry.box.max[1] - entry.box.min[1], dz: entry.box.max[2] - entry.box.min[2], cx: (entry.box.min[0] + entry.box.max[0]) / 2 - entry.origin[0], cz: (entry.box.min[2] + entry.box.max[2]) / 2 - entry.origin[1], measuredFrom: 'meshes' }
    if (entry.size) return { dx: entry.size.w, dy: entry.size.h, dz: entry.size.d, cx: 0, cz: 0, measuredFrom: 'room.measure' }
    return { dx: 0.5, dy: 0.5, dz: 0.5, cx: 0, cz: 0, measuredFrom: 'none' }
  })
  const yaws = measured.map((_, index) => {
    const own = dims[index]
    return args.yaw === 'long-axis-x' ? (own && own.dx >= own.dz ? 0 : Math.PI / 2) : args.yaw
  })
  const oriented = dims.map((own, index) => {
    const turned = Math.abs(Math.sin(yaws[index] ?? 0)) > 0.5
    return turned ? { ...own, dx: own.dz, dz: own.dx } : own
  })

  // layout along the row axis of the camera; the ruler, when asked, stands first
  const rulerWidth = args.ruler ? 0.9 : 0
  const extentAlong = (/** @type {{dx: number, dz: number}} */ own) => own.dx * Math.abs(rowAxis[0] ?? 0) + own.dz * Math.abs(rowAxis[2] ?? 0)
  const depthAlong = (/** @type {{dx: number, dz: number}} */ own) => own.dx * Math.abs(toCamera[0] ?? 0) + own.dz * Math.abs(toCamera[2] ?? 0)
  let cursor = 0
  const centres = []
  if (args.ruler) cursor += rulerWidth
  for (const own of oriented) {
    const width = extentAlong(own)
    centres.push(cursor + width / 2)
    cursor += width + args.gap
  }
  const totalWidth = Math.max(cursor - args.gap, rulerWidth)
  const along = (/** @type {number} */ distance) => distance - totalWidth / 2
  // the row stands away from the room's own furniture, which would hold an entry up (a table 78 cm high is under the middle of the room)
  // (the player is held inside the room's arena (`arenaSize`, 14 m) and the hand reaches a handle only from where he can stand: at z=300, or at the ends of a long row, a leaf stays shut. So these sheets stay at the middle and carry few entries)
  const origin = args.openLeaves ? [0, 0] : [0, 300]
  const at = (/** @type {number} */ distance, /** @type {number} */ height) => [(origin[0] ?? 0) + (rowAxis[0] ?? 0) * along(distance), height, (origin[1] ?? 0) + (rowAxis[2] ?? 0) * along(distance)]

  // pass 2: the ruler and the entries at their places
  room.clear()
  /** @type {any[]} */
  const placed = []
  const heights = oriented.map((own) => own.dy)
  const tallest = Math.max(args.ruler ? 2.3 : 0, ...heights)
  if (args.ruler) {
    const ruler = room.spawn('contact_sheet_ruler', at(rulerWidth / 2, 0), 0)
    placed.push({ id: 'contact_sheet_ruler', object: ruler, ruler: true })
  }
  if (args.withEntries) {
    for (const [index, entry] of measured.entries()) {
      if (entry.failed) continue
      const own = dims[index]
      const yaw = yaws[index] ?? 0
      // the root's origin is not the middle of its box: shift by the box offset turned with the yaw
      const offsetX = (own?.cx ?? 0) * Math.cos(yaw) + (own?.cz ?? 0) * Math.sin(yaw)
      const offsetZ = -(own?.cx ?? 0) * Math.sin(yaw) + (own?.cz ?? 0) * Math.cos(yaw)
      const centre = at(centres[index] ?? 0, 0)
      try {
        const spawned = room.spawn(entry.id, [(centre[0] ?? 0) - offsetX, 0, (centre[2] ?? 0) - offsetZ], yaw)
        placed.push({ id: entry.id, object: spawned, index })
      } catch (error) {
        failed.push({ id: entry.id, reason: (error instanceof Error ? error.message : String(error)) })
      }
    }
    for (let frame = 0; frame < 3; frame++) room.update(1 / 60)
    if (args.openLeaves) {
      // the room works one leaf by hand at a time (`room.door`): each is opened and let go before the next is started
      for (const item of placed) {
        if (item.ruler) continue
        const standsAt = item.object.root.position
        for (const part of room.leaves(item.object.objectId)) {
          // the hand has to reach the handle: the player stands beside the vehicle whose leaf is worked
          // on the camera's side of the vehicle, where no neighbour of the row stands
          const side = Math.hypot(toCamera[0] ?? 0, toCamera[2] ?? 1) || 1
          room.look([standsAt.x + (2.5 * (toCamera[0] ?? 0)) / side, 1.7, standsAt.z + (2.5 * (toCamera[2] ?? 1)) / side], [standsAt.x, 1.2, standsAt.z])
          room.useLeaf(item.object.objectId, part)
          for (let frame = 0; frame < 360 && room.door; frame++) room.update(1 / 60)
        }
      }
    }
  }
  // the lowest point each entry reaches over a whole gait cycle (a running body is off the ground between strides): sampled every 4th frame for 120 frames, then the 30 frames of the freeze
  /** @type {Map<number, { y: number, at: string | null }>} */
  const lowest = new Map()
  const sampling = !args.openLeaves && kind !== 'aerial'
  for (let frame = 0; frame < (sampling ? 120 : 0); frame++) {
    room.update(1 / 60)
    if (frame % 4 !== 0) continue
    for (const item of placed) {
      const box = item.ruler ? null : boxOf(item.object.root)
      if (box && box.min[1] < (lowest.get(item.index)?.y ?? Infinity)) lowest.set(item.index, { y: box.min[1], at: box.minAt })
    }
  }
  for (let frame = 0; frame < 30 + args.extraFrames; frame++) room.update(1 / 60)

  // the camera: looks at the middle of the row, far enough for the width and the height with a margin
  const aspect = window.innerWidth / window.innerHeight
  const halfV = (fov * Math.PI) / 360
  const halfH = Math.atan(Math.tan(halfV) * aspect)
  const depthHalf = Math.max(0, ...oriented.map(depthAlong)) / 2
  const needWidth = (totalWidth / 2 + 0.4) / Math.tan(halfH)
  const needHeight = (tallest / 2 + 0.4) / Math.tan(halfV)
  const distance = Math.max(needWidth, needHeight) * 1.08 + depthHalf
  const target = [origin[0] ?? 0, kind === 'aerial' ? 0 : tallest / 2, origin[1] ?? 0]
  const position = [target[0] + toCamera[0] * distance, target[1] + toCamera[1] * distance, target[2] + toCamera[2] * distance]
  // a big scene (a whole street grid) is further than the room camera sees: its far plane and the fog follow the sheet's distance
  if (distance * 1.6 > room.camera.far) {
    room.camera.far = distance * 1.6
    room.camera.updateProjectionMatrix()
    room.environment.set({ fogFar: Math.max(room.environment.get().fogFar, distance * 3) })
  }
  room.setDebugCamera({ position, target, fov })
  // the player's own camera and arms go behind the sheet camera, out of the frame
  room.look([position[0] + toCamera[0] * 30, 1.7, position[2] + toCamera[2] * 30], [position[0] + toCamera[0] * 60, 1.7, position[2] + toCamera[2] * 60])
  room.pause()

  // projection by hand (look-at, perspective), to place the labels and to say where each entry's cell is on the screen
  const norm = (/** @type {number[]} */ vector) => { const length = Math.hypot(...vector) || 1; return vector.map((value) => value / length) }
  const cross = (/** @type {number[]} */ a, /** @type {number[]} */ b) => [(a[1] ?? 0) * (b[2] ?? 0) - (a[2] ?? 0) * (b[1] ?? 0), (a[2] ?? 0) * (b[0] ?? 0) - (a[0] ?? 0) * (b[2] ?? 0), (a[0] ?? 0) * (b[1] ?? 0) - (a[1] ?? 0) * (b[0] ?? 0)]
  const dot = (/** @type {number[]} */ a, /** @type {number[]} */ b) => (a[0] ?? 0) * (b[0] ?? 0) + (a[1] ?? 0) * (b[1] ?? 0) + (a[2] ?? 0) * (b[2] ?? 0)
  const forward = norm(target.map((value, index) => value - (position[index] ?? 0)))
  const right = norm(cross(forward, [0, 1, 0]))
  const up = cross(right, forward)
  const project = (/** @type {number[]} */ point) => {
    const relative = point.map((value, index) => value - (position[index] ?? 0))
    const depth = dot(relative, forward)
    const scale = 1 / (Math.tan(halfV) * Math.max(depth, 0.01))
    return [(0.5 + (dot(relative, right) * scale) / (2 * aspect)) * window.innerWidth, (0.5 - (dot(relative, up) * scale) / 2) * window.innerHeight]
  }
  const overlay = document.createElement('div')
  overlay.id = 'sheet-overlay'
  overlay.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;font:600 15px ui-monospace,monospace'
  const addLabel = (/** @type {string} */ text, /** @type {number[]} */ screen, /** @type {string} */ align) => {
    const label = document.createElement('div')
    label.textContent = text
    label.style.cssText = `position:absolute;left:${screen[0]}px;top:${screen[1]}px;transform:translate(${align});color:#fff;background:rgba(0,0,0,.72);padding:1px 5px;white-space:nowrap`
    overlay.appendChild(label)
  }
  const cells = []
  for (const [index, entry] of measured.entries()) {
    const own = oriented[index]
    const centre = at(centres[index] ?? 0, 0)
    const halfWidth = ((own?.dx ?? 0) / 2)
    const halfDepth = ((own?.dz ?? 0) / 2)
    // where the entry really stands after the room rested it (it may settle on a support): the planned cell only when its meshes give no box
    const standing = placed.find((item) => item.index === index)
    const real = standing ? boxOf(standing.object.root) : null
    const corners = []
    if (real) {
      for (const x of [real.min[0], real.max[0]]) for (const y of [real.min[1], real.max[1]]) for (const z of [real.min[2], real.max[2]]) corners.push(project([x ?? 0, y ?? 0, z ?? 0]))
    } else {
      for (const x of [-halfWidth, halfWidth]) for (const y of [0, own?.dy ?? 0]) for (const z of [-halfDepth, halfDepth]) corners.push(project([(centre[0] ?? 0) + x, y, (centre[2] ?? 0) + z]))
    }
    const rect = [Math.min(...corners.map((c) => c[0] ?? 0)), Math.min(...corners.map((c) => c[1] ?? 0)), Math.max(...corners.map((c) => c[0] ?? 0)), Math.max(...corners.map((c) => c[1] ?? 0))]
    const base = project([centre[0] ?? 0, 0, centre[2] ?? 0])
    addLabel(entry.label, [base[0] ?? 0, (base[1] ?? 0) + 8], '-50%,0')
    cells.push({ id: entry.id, label: entry.label, rect, leaves: entry.leaves, size: { dx: +(own?.dx ?? 0).toFixed(3), dy: +(own?.dy ?? 0).toFixed(3), dz: +(own?.dz ?? 0).toFixed(3) }, measuredFrom: dims[index]?.measuredFrom, yaw: +(yaws[index] ?? 0).toFixed(4), floatsAboveGroundM: real ? +(real.min[1] ?? 0).toFixed(3) : null, lowestOverCycleM: lowest.has(index) ? +(lowest.get(index)?.y ?? 0).toFixed(3) : null, lowestAt: lowest.has(index) ? lowest.get(index)?.at : (real ? real.minAt : null), headTopM: headTopRounded(standing ? headTopOf(standing.object.root) : null), topAt: real ? real.maxAt : null, topM: real ? +(real.max[1] ?? 0).toFixed(3) : null, openingMax: args.openLeaves && standing ? +Math.max(0, ...room.leaves(standing.object.objectId).map((/** @type {string} */ part) => room.leafOpening(standing.object.objectId, part))).toFixed(3) : null, failed: Boolean(entry.failed) })
  }
  if (args.ruler) {
    const base = at(rulerWidth / 2, 0)
    for (const [height, text] of /** @type {[number, string][]} */ ([[1.8, '1.80 m declared'], [2.1, '2.10 m door'], [1, '1.00 m']])) addLabel(text, project([(base[0] ?? 0) + 0.25 * (rowAxis[0] ?? 0), height, (base[2] ?? 0) + 0.25 * (rowAxis[2] ?? 0)]), '0,-50%')
  }
  addLabel(args.title, [10, 8], '0,0')
  document.body.appendChild(overlay)
  const measuredScale = (window.innerHeight / 2) / (Math.tan(halfV) * distance)
  return { cells, failed, camera: { position: position.map((value) => +value.toFixed(3)), target: target.map((value) => +value.toFixed(3)), fov, aspect: +aspect.toFixed(4), distance: +distance.toFixed(2), pixelsPerMetreAtTarget: +measuredScale.toFixed(1) } }
}

/** Runs in the page: hides the room's panels (the canvas stays) and puts one caption line on top of the picture. */
export function captionInPage(/** @type {string} */ caption) {
  const canvas = document.querySelector('canvas')
  const app = document.getElementById('app')
  if (app) for (const element of app.querySelectorAll('*')) if (element !== canvas && !element.contains(canvas)) /** @type {HTMLElement} */ (element).style.visibility = 'hidden'
  document.getElementById('sheet-overlay')?.remove()
  const overlay = document.createElement('div')
  overlay.id = 'sheet-overlay'
  overlay.style.cssText = 'position:fixed;left:10px;top:8px;pointer-events:none;z-index:2147483647;font:600 15px ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.72);padding:1px 5px'
  overlay.textContent = caption
  document.body.appendChild(overlay)
}

/**
 * Runs in a blank page: the share of pixels of `final` that differ from `reference`, over the whole image and inside each rectangle.
 * @param {{ reference: string, final: string, rects: number[][], threshold: number }} input base64 PNGs
 */
async function compareInPage({ reference, final, rects, threshold }) {
  const decode = async (/** @type {string} */ base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true }))
    context.drawImage(bitmap, 0, 0)
    return context.getImageData(0, 0, bitmap.width, bitmap.height)
  }
  const [a, b] = await Promise.all([decode(reference), decode(final)])
  const share = (/** @type {number[]} */ rect) => {
    const x0 = Math.max(0, Math.floor(rect[0] ?? 0)); const y0 = Math.max(0, Math.floor(rect[1] ?? 0))
    const x1 = Math.min(b.width, Math.ceil(rect[2] ?? 0)); const y1 = Math.min(b.height, Math.ceil(rect[3] ?? 0))
    let different = 0; let total = 0
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const at = (y * b.width + x) * 4
      total++
      if (Math.max(Math.abs((a.data[at] ?? 0) - (b.data[at] ?? 0)), Math.abs((a.data[at + 1] ?? 0) - (b.data[at + 1] ?? 0)), Math.abs((a.data[at + 2] ?? 0) - (b.data[at + 2] ?? 0))) > threshold) different++
    }
    return total ? different / total : 0
  }
  return { width: b.width, height: b.height, whole: share([0, 0, b.width, b.height]), cells: rects.map(share) }
}

/**
 * Runs in the page: loads the module whose one item is the height reference of the sheets: a pole with a tick every 10 cm, 50 cm ticks longer, 1.80 m (what the characters declare) in red
 * and 2.10 m (a door) in blue, built from the room's three.js.
 */
function installRulerInPage() {
  const room = /** @type {any} */ (window).__testRoom
  const build = (/** @type {any} */ THREE) => {
    const group = new THREE.Group()
    const bar = (/** @type {number} */ width, /** @type {number} */ height, /** @type {number} */ depth, /** @type {number} */ color, /** @type {number} */ x, /** @type {number} */ y) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshBasicMaterial({ color }))
      mesh.position.set(x, y, 0)
      group.add(mesh)
    }
    bar(0.05, 2.3, 0.05, 0xf2f2f2, 0, 1.15)
    for (let tick = 0; tick <= 22; tick++) {
      const color = tick === 18 ? 0xff2020 : tick === 21 ? 0x2060ff : 0x111111
      const length = tick % 5 === 0 || tick === 18 || tick === 21 ? 0.5 : 0.25
      bar(length, 0.012, 0.06, color, length / 2 + 0.025, tick / 10)
    }
    return group
  }
  room.loadModule({ id: 'contact_sheet', name: 'Contact sheet', group: 'Contact sheet', items: () => [{ id: 'contact_sheet_ruler', name: 'Ruler', movable: false, build }], scenarios: () => [], attach: () => () => undefined })
}

/**
 * Opens the area's room page in Chromium (offline: any request that is not file/data/blob is aborted and listed).
 * @param {{ chromium: any, pageFile: string, query?: string }} options
 */
export async function openRoomPage({ chromium, pageFile, query = '' }) {
  const browser = await chromium.launch({ args: BROWSER_ARGS })
  // the watchdog of the whole run: the browser goes down with it, so no Chrome is left behind
  const watchdog = setTimeout(() => {
    console.error(`check-area: the run took more than ${AREA_TIMEOUT_MS / 60000} min; it was rendering ${currentWork}`)
    void browser.close().finally(() => process.exit(1))
  }, AREA_TIMEOUT_MS)
  watchdog.unref()
  const context = await browser.newContext({ viewport: SHEET_VIEWPORT })
  /** @type {string[]} */
  const external = []
  await context.route('**/*', (/** @type {any} */ route) => {
    const url = route.request().url()
    if (/^(file|data|blob|about):/.test(url)) return route.continue()
    external.push(url)
    return route.abort()
  })
  const page = await context.newPage()
  /** @type {string[]} */
  const errors = []
  page.on('console', (/** @type {any} */ message) => message.type() === 'error' && errors.push(message.text()))
  page.on('pageerror', (/** @type {Error} */ error) => errors.push(`pageerror: ${error.message}`))
  await page.goto(pathToFileURL(pageFile).href + query, { timeout: 180000 })
  await page.waitForFunction(() => /** @type {any} */ (window).__testRoom, null, { timeout: 120000 })
  await page.waitForTimeout(1500)
  await page.evaluate(installRulerInPage)
  return { browser, context, page, external, errors }
}

/**
 * The recorder of one area: `sheet` lays and photographs one sheet, `finish` writes shots/index.json and shots/sanity.json.
 * @param {{ page: any, context: any, outDir: string, area: string, seed: string, catalogue: { count: number, source: string }, knownDefectsFile: string, classifySink?: (id: string, lowestPointM: number) => { what: string, extra: Record<string, unknown> } | null }} options
 */
export function createSheetRecorder({ page, context, outDir, area, seed, catalogue, knownDefectsFile, classifySink }) {
  mkdirSync(outDir, { recursive: true })
  // the sheets of an earlier run go, so a catalogue that shrank leaves no stale image behind
  for (const name of readdirSync(outDir)) if (/^\d\d-.*\.png$/.test(name)) rmSync(join(outDir, name))
  /** @type {{ id: string, what: string }[]} */
  let ledger = []
  try { ledger = JSON.parse(readFileSync(knownDefectsFile, 'utf8')) } catch { ledger = [] }
  /** @param {string} id @param {string[]} kinds */
  const isLedgered = (id, kinds) => Array.isArray(ledger) && ledger.some((item) => item.id === id && kinds.includes(item.what))
  /** @type {any[]} */
  const index = []
  /** @type {any[]} */
  const sanity = []
  /** @type {any[]} */
  const failures = []
  /** What this run saw that a review must know about: { id, what, value } (what: spawn-failed, rendered-empty, blank-third-person, floats, does-not-open, ...). */
  /** @type {{ id: string, what: string, value: unknown }[]} */
  const observed = []
  /** What a run does not hold against an entry, with the reason (a boat's hull is meant to be under the waterline): `{ what, ids, reason }`. */
  /** @type {{ what: string, ids: string[], reason: string }[]} */
  const exemptions = []
  /** @param {string} id @param {string} what @param {unknown} value */
  const observe = (id, what, value) => {
    if (!observed.some((entry) => entry.id === id && entry.what === what)) observed.push({ id, what, value })
  }
  /** @type {any} */
  let comparePage = null
  const api = {
    /**
     * @param {{ file: string, family: string, entries: {id: string, label?: string}[], view: { kind: string, fov?: number, azimuthDeg?: number, elevationDeg?: number }, yaw: number | 'long-axis-x', gap?: number, ruler?: boolean, openLeaves?: boolean, extraFrames?: number }} sheet
     * @returns {Promise<any>} what the page answered (cells with their leaves, the camera)
     */
    async sheet(sheet) {
      currentWork = `sheet ${sheet.file} (${sheet.entries.map((entry) => entry.id).join(', ')})`
      const view = { kind: sheet.view.kind, fov: sheet.view.fov ?? 22, azimuthDeg: sheet.view.azimuthDeg ?? 0, elevationDeg: sheet.view.elevationDeg ?? 4 }
      const entries = sheet.entries.map((entry) => ({ id: entry.id, label: entry.label ?? entry.id }))
      const base = { entries, view, yaw: sheet.yaw, gap: sheet.gap ?? 0.5, ruler: sheet.ruler ?? false, openLeaves: sheet.openLeaves ?? false, title: `${sheet.file}  ${sheet.family}  ${view.kind}  seed ${seed}`, extraFrames: sheet.extraFrames ?? 0 }
      await page.evaluate(laySheetInPage, { ...base, withEntries: false })
      await page.waitForTimeout(700)
      const reference = await page.screenshot()
      const laid = await page.evaluate(laySheetInPage, { ...base, withEntries: true })
      await page.waitForTimeout(900)
      const path = join(outDir, `${sheet.file}.png`)
      const final = await page.screenshot({ path })
      comparePage ??= await context.newPage()
      const compared = await comparePage.evaluate(compareInPage, { reference: reference.toString('base64'), final: final.toString('base64'), rects: laid.cells.map((/** @type {any} */ cell) => cell.rect), threshold: 12 })
      index.push({
        file: `${sheet.file}.png`,
        family: sheet.family,
        view: view.kind,
        openLeaves: base.openLeaves,
        ...(sheet.extraFrames ? { extraFramesAfterFreeze: sheet.extraFrames } : {}),
        assesses: { floating: !base.openLeaves, sinking: !base.openLeaves },
        yaw: sheet.yaw,
        camera: { kind: view.kind, fovDeg: view.fov, azimuthDeg: view.azimuthDeg, elevationDeg: view.elevationDeg, framing: 'looks at the middle of the row from the distance that fits it' },
        entries: laid.cells.map((/** @type {any} */ cell) => cell.id),
        labels: laid.cells.map((/** @type {any} */ cell) => cell.label),
      })
      const emptyCells = laid.cells.filter((/** @type {any} */ _cell, /** @type {number} */ at) => (compared.cells[at] ?? 0) < EMPTY_SHARE).map((/** @type {any} */ cell) => cell.id)
      sanity.push({ file: `${sheet.file}.png`, assesses: { floating: !base.openLeaves, sinking: !base.openLeaves }, camera: laid.camera, bytes: final.length, width: compared.width, height: compared.height, nonBackgroundShare: +compared.whole.toFixed(4), cells: laid.cells.map((/** @type {any} */ cell, /** @type {number} */ at) => ({ id: cell.id, share: +(compared.cells[at] ?? 0).toFixed(4), measuredFrom: cell.measuredFrom, size: cell.size, floatsAboveGroundM: cell.floatsAboveGroundM, lowestOverCycleM: cell.lowestOverCycleM, lowestAt: cell.lowestAt, topM: cell.topM, headTopM: cell.headTopM, topAt: cell.topAt, openingMax: cell.openingMax })), empty: emptyCells })
      for (const failure of laid.failed) failures.push({ file: `${sheet.file}.png`, ...failure })
      for (const id of emptyCells) failures.push({ file: `${sheet.file}.png`, id, reason: 'rendered empty' })
      for (const failure of laid.failed) observe(failure.id, 'spawn-failed', failure.reason)
      for (const id of emptyCells) observe(id, 'rendered-empty', 'no pixel differs from the empty view')
      for (const cell of laid.cells) {
        // floating and sinking are judged on the closed sheets only: the open-leaf sheets stand at the middle of the room, where a table would fool them
        if (!base.openLeaves) {
          // the lowest point over the cycle when it was sampled, else the one of the frozen frame
          const lowestPoint = +(cell.lowestOverCycleM ?? cell.floatsAboveGroundM ?? 0)
          if (lowestPoint > FLOAT_LIMIT_M + (isLedgered(cell.id, ['floats']) ? -LIMIT_TOLERANCE_M : LIMIT_TOLERANCE_M)) observe(cell.id, 'floats', `${lowestPoint} m`)
          if (lowestPoint < -(SINK_LIMIT_M + (isLedgered(cell.id, ['sinks', 'sinks-as-declared']) ? -LIMIT_TOLERANCE_M : LIMIT_TOLERANCE_M))) {
            const verdict = classifySink ? classifySink(cell.id, lowestPoint) : null
            observe(cell.id, verdict ? verdict.what : 'sinks', { lowestPointM: lowestPoint, heldBy: cell.lowestAt, ...(verdict ? verdict.extra : {}) })
          }
        }
        if (base.openLeaves && (cell.openingMax ?? 0) < 0.9) observe(cell.id, 'does-not-open', cell.openingMax)
      }
      return laid
    },
    /**
     * One picture of the room as it is (not a row of catalogue entries): `prepare(true)` sets the page up with the subject and answers what is worth recording about it (numbers read from the room),
     * `prepare(false)` sets the same view up without the subject, which is what the picture is compared with. Both leave the room paused and the caption drawn. `prepare(true)` answers `{ fixed, measured }`: `fixed` goes
     * to index.json (what the picture is), `measured` to sanity.json (numbers that move with the animation clock, so they would make index.json change on every run).
     * @param {{ file: string, family: string, view: string, subject: string, detail?: string, prepare: (withSubject: boolean) => Promise<{ fixed: Record<string, unknown>, measured: Record<string, unknown> }> }} shot
     */
    async photo(shot) {
      currentWork = `picture ${shot.file} (${shot.subject})`
      await shot.prepare(false)
      await page.waitForTimeout(600)
      const reference = await page.screenshot()
      const measured = await shot.prepare(true)
      await page.waitForTimeout(800)
      const final = await page.screenshot({ path: join(outDir, `${shot.file}.png`) })
      comparePage ??= await context.newPage()
      const compared = await comparePage.evaluate(compareInPage, { reference: reference.toString('base64'), final: final.toString('base64'), rects: [[0, 0, SHEET_VIEWPORT.width, SHEET_VIEWPORT.height]], threshold: 12 })
      index.push({ file: `${shot.file}.png`, family: shot.family, view: shot.view, entries: [shot.subject], ...measured.fixed })
      const empty = compared.whole < PHOTO_EMPTY_SHARE
      sanity.push({ file: `${shot.file}.png`, measured: measured.measured, bytes: final.length, width: compared.width, height: compared.height, nonBackgroundShare: +compared.whole.toFixed(4), cells: [{ id: shot.subject, share: +compared.whole.toFixed(4) }], empty: empty ? [shot.subject] : [] })
      if (empty) observe(shot.detail ? `${shot.subject}/${shot.detail}` : shot.subject, shot.view.includes('third') ? 'blank-third-person' : 'rendered-empty', +compared.whole.toFixed(4))
      if (empty) failures.push({ file: `${shot.file}.png`, id: shot.subject, reason: 'the subject changed no pixel against the same view without it' })
    },
    /** @param {Record<string, unknown>} [extra] */
    finish(extra = {}) {
      const covered = [...new Set(index.flatMap((sheet) => sheet.entries))]
      for (let at = observed.length - 1; at >= 0; at--) if (exemptions.some((rule) => rule.what === observed[at]?.what && rule.ids.includes(observed[at]?.id ?? ''))) observed.splice(at, 1)
      // what the floating and sinking limits are judged against: the lowest point of each entry over its cycle
      const lows = sanity.flatMap((image) => (image.cells ?? []).map((/** @type {any} */ cell) => cell.lowestOverCycleM)).filter((/** @type {unknown} */ value) => typeof value === 'number').sort((/** @type {number} */ a, /** @type {number} */ b) => a - b)
      const lowestPoints = lows.length ? { entries: lows.length, minM: lows[0], medianM: lows[Math.floor(lows.length / 2)], maxM: lows[lows.length - 1] } : null
      if (lowestPoints) console.log(`${area}: lowest point over the cycle, ${lowestPoints.entries} entries: min ${lowestPoints.minM} m, median ${lowestPoints.medianM} m, max ${lowestPoints.maxM} m (limits: floats above ${FLOAT_LIMIT_M} m, sinks below -${SINK_LIMIT_M} m)`)
      writeFileSync(join(outDir, 'index.json'), JSON.stringify({ area, seed, viewport: SHEET_VIEWPORT, freezeFrames: FREEZE_FRAMES, timeOfDay: { nightFactor: 0 }, catalogue: { ...catalogue, covered: covered.length }, ...extra, sheets: index }, null, 2) + '\n')
      writeFileSync(join(outDir, 'sanity.json'), JSON.stringify({ area, emptyShareThreshold: EMPTY_SHARE, images: sanity, failures, observed, exemptions, lowestPoints }, null, 2) + '\n')
      const bytes = sanity.reduce((sum, image) => sum + image.bytes, 0)
      console.log(`${area}: ${index.length} sheets, ${covered.length}/${catalogue.count} catalogue entries, ${(bytes / 1048576).toFixed(2)} MB`)
      for (const image of sanity) console.log(`  ${image.file}  ${(image.bytes / 1024).toFixed(0)} KB  ${image.width}x${image.height}  non-background ${(image.nonBackgroundShare * 100).toFixed(1)}%${image.empty.length ? `  EMPTY: ${image.empty.join(', ')}` : ''}`)
      for (const failure of failures) console.log(`WARN  ${failure.file}  ${failure.id}: ${failure.reason}`)
      const known = knownDefectsFile && existsSync(knownDefectsFile) ? /** @type {{ id: string, what: string, value?: unknown }[]} */ (JSON.parse(readFileSync(knownDefectsFile, 'utf8'))) : []
      const same = (/** @type {{ id: string, what: string }} */ a, /** @type {{ id: string, what: string }} */ b) => a.id === b.id && a.what === b.what
      const fresh = observed.filter((entry) => !known.some((item) => same(item, entry)))
      const stillThere = known.filter((item) => observed.some((entry) => same(item, entry)))
      const gone = known.filter((item) => !observed.some((entry) => same(item, entry)))
      for (const entry of fresh) console.log(`NEW defect      ${entry.id}  ${entry.what}  ${JSON.stringify(entry.value)}`)
      for (const item of gone) console.log(`GONE defect     ${item.id}  ${item.what}: no longer seen: remove this entry from ${knownDefectsFile} in the commit that fixes it`)
      console.log(`${area}: defects: ${fresh.length} new, ${stillThere.length} known still present, ${gone.length} known gone`)
      // a defect nobody sees any more fails the run too: the list shrinks in the commit that fixes it, as the z-fighting debt ledger does
      const exitCode = fresh.length > 0 || gone.length > 0 || index.length === 0 ? 1 : 0
      return { exitCode, sheets: index.length, covered: covered.length, bytes, failures, blank: sanity.filter((image) => image.nonBackgroundShare < 0.02).map((image) => image.file) }
    },
  }
  /** @template T @param {() => Promise<T>} work @returns {Promise<T>} */
  const within = async (work) => {
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer
    const started = currentWork
    try {
      return await Promise.race([work(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timeout after ${SHEET_TIMEOUT_MS / 1000} s while rendering ${currentWork || started}`)), SHEET_TIMEOUT_MS) })])
    } finally {
      clearTimeout(timer)
    }
  }
  return {
    sheet: (/** @type {Parameters<typeof api.sheet>[0]} */ sheet) => within(() => api.sheet(sheet)),
    photo: (/** @type {Parameters<typeof api.photo>[0]} */ shot) => within(() => api.photo(shot)),
    observe,
    /** @param {string} what @param {string[]} ids @param {string} reason */
    exempt: (what, ids, reason) => void exemptions.push({ what, ids, reason }),
    finish: api.finish,
  }
}
