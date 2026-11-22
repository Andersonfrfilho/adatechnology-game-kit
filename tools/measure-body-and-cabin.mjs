#!/usr/bin/env node
// @ts-check
// Spec 012 (T0.1): measures character skull height across rich, instanced and baked paths,
// and vehicle cabin clearances (5-ray headroom, legroom, seat width, door openings) across the 69-vehicle fleet.
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const requireFromVehicles = createRequire(join(ROOT, 'packages/game-vehicles/package.json'))
/** @type {typeof import('three')} */
const THREE = await import(pathToFileURL(requireFromVehicles.resolve('three')).href)

/** @param {string} rel */
const loadDist = (rel) => import(pathToFileURL(join(ROOT, rel)).href)

const [characters, undead, people, charactersThree, vehicles, fleet] = await Promise.all([
  loadDist('packages/game-characters/dist/index.js'),
  loadDist('packages/game-characters-undead/dist/index.js'),
  loadDist('packages/game-characters-people/dist/index.js'),
  loadDist('packages/game-characters-three/dist/index.js'),
  loadDist('packages/game-vehicles/dist/index.js'),
  loadDist('packages/game-vehicles-fleet/dist/index.js'),
])

const fmt = (/** @type {number} */ v) => (Number.isFinite(v) ? v.toFixed(3) : 'inf')

/**
 * Measures world-space Y min/max of a Three.js Object3D.
 * @param {THREE.Object3D} obj
 */
function boundsY(obj) {
  obj.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(obj)
  return { minY: box.min.y, maxY: box.max.y }
}

/**
 * Finds the skull sphere mesh inside a headG group (first sphere child of Hd).
 * @param {THREE.Object3D | undefined} headG
 */
function skullTopOfHeadGroup(headG) {
  if (!headG) return Number.NaN
  const hd = headG.children[0]
  if (!hd) return Number.NaN
  for (const child of hd.children) {
    if (child instanceof THREE.Mesh && child.visible) {
      return boundsY(child).maxY
    }
  }
  return Number.NaN
}

/**
 * Resets a BestRig to upright neutral pose at y = 0 so skull height is measured standing straight.
 * @param {{ fig: THREE.Object3D; upper: THREE.Object3D; headG: THREE.Object3D; arms: { g: THREE.Object3D; el: THREE.Object3D }[]; legs: { g: THREE.Object3D; kn: THREE.Object3D }[] }} rig
 */
function neutraliseBestRig(rig) {
  rig.fig.position.y = 0
  rig.upper.rotation.set(0, 0, 0)
  rig.headG.rotation.set(0, 0, 0)
  for (const arm of rig.arms) {
    arm.g.rotation.set(0, 0, 0)
    arm.el.rotation.set(0, 0, 0)
  }
  for (const leg of rig.legs) {
    leg.g.rotation.set(0, 0, 0)
    leg.kn.rotation.set(0, 0, 0)
  }
}

function measureCharacters() {
  const typeCards = undead.UNDEAD_TYPES.map(
    (/** @type {{ name: { 'pt-BR': string }; eye: { color: string } }} */ t) => ({
      name: t.name['pt-BR'],
      eye: Number.parseInt(t.eye.color, 16),
    }),
  )
  const best = charactersThree.createBestBuilder(THREE, { types: typeCards, random: () => 0.5 })
  const bestTypes = Object.keys(best.TYPES)

  /** @type {Array<{ type: string; scale: number; skullTop: number; totalTop: number; minY: number; noLegs: boolean }>} */
  const richBest = []

  // Undead types + human (player)
  for (const type of [...bestTypes, 'human']) {
    const isHuman = type === 'human'
    const root = best.build({
      type: isHuman ? 'Lento' : type,
      human: isHuman,
      seed: 4242,
      pose: { ...charactersThree.BAKE_NEUTRAL_POSE },
    })
    const rig = root.userData.rig
    neutraliseBestRig(rig)
    root.updateMatrixWorld(true)
    const skullTop = skullTopOfHeadGroup(rig.headG)
    const total = boundsY(root)
    richBest.push({
      type,
      scale: rig.P.s,
      skullTop,
      totalTop: total.maxY,
      minY: total.minY,
      noLegs: Boolean(rig.P.noLegs),
    })
  }

  // Rich survivors (person-builder)
  const personBuilder = charactersThree.createPersonBuilder(THREE, { detail: 0 })
  const baseSpec = {
    name: 'Test',
    skin: 0xd4a57a,
    hair: { c: 0x3b2a1e, s: 'short' },
    top: { c: 0x3d5a73 },
    pants: { c: 0x2c3340 },
    shoes: 0x222222,
  }
  /** @type {Array<{ label: string; h: number; bulk: number; skullTop: number; totalTop: number; minY: number }>} */
  const richPerson = []
  const personCases = [
    { label: 'male (h=1.0)', h: 1, bulk: 1, fem: false },
    { label: 'female (h=1.0)', h: 1, bulk: 0.94, fem: true },
    ...people.AGE_PRESETS.flatMap((/** @type {{ id: string; height: readonly [number, number] }} */ preset) => [
      { label: `${preset.id} min (h=${preset.height[0]})`, h: preset.height[0], bulk: 1, fem: false },
      { label: `${preset.id} max (h=${preset.height[1]})`, h: preset.height[1], bulk: 1, fem: false },
    ]),
  ]
  for (const c of personCases) {
    const built = personBuilder.build({ ...baseSpec, h: c.h, bulk: c.bulk, fem: c.fem }, 0)
    built.root.updateMatrixWorld(true)
    const skullTop = skullTopOfHeadGroup(built.headG)
    const total = boundsY(built.root)
    richPerson.push({
      label: c.label,
      h: c.h,
      bulk: c.bulk,
      skullTop,
      totalTop: total.maxY,
      minY: total.minY,
    })
  }

  // Instanced crowd body
  /** @type {Array<{ spec: string; segments: number; skullTop: number; totalTop: number; minY: number }>} */
  const instanced = []
  for (const [specName, spec] of [
    ['TEAM_GAME', characters.TEAM_GAME],
    ['GUIDE', characters.GUIDE],
  ]) {
    for (const segments of [16, 10, 5]) {
      const geo = charactersThree.buildInstancedBody(THREE, { segments, body: spec })
      const pos = geo.attributes.position
      const bone = geo.attributes.bone
      const vcol = geo.attributes.vcol
      let skullTop = -Infinity
      let totalTop = -Infinity
      let minY = Infinity
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i)
        if (y > totalTop) totalTop = y
        if (y < minY) minY = y
        if (bone.getX(i) === 1 && vcol.getW(i) === 0 && y > skullTop) {
          skullTop = y
        }
      }
      instanced.push({ spec: /** @type {string} */ (specName), segments, skullTop, totalTop, minY })
    }
  }

  // Baked bodies
  const bakeBuilders = {
    buildBest: (/** @type {Record<string, unknown>} */ spec, /** @type {number} */ lod) => {
      best.setLOD(lod)
      return best.build(spec)
    },
    topMaterial: () => best.topM(),
  }
  /** @type {Array<{ type: string; scale: number; maxY: number; minY: number; verts: number }>} */
  const baked = []
  for (const type of bestTypes) {
    const b = charactersThree.bakeBody(THREE, bakeBuilders, { type, decay: 0, seed: 4242 }, 1)
    const pos = b.geo.attributes.position
    let maxY = -Infinity
    let minY = Infinity
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      if (y > maxY) maxY = y
      if (y < minY) minY = y
    }
    baked.push({ type, scale: b.s, maxY, minY, verts: b.verts })
  }

  return { richBest, richPerson, instanced, baked }
}

/**
 * Casts a vertical ray upward from (x, yStart, z) against meshes in `root`, ignoring hits below `minDist`.
 * @param {THREE.Raycaster} raycaster
 * @param {THREE.Object3D} root
 * @param {number} x
 * @param {number} yStart
 * @param {number} z
 * @param {number} minDist
 */
function castUp(raycaster, root, x, yStart, z, minDist) {
  raycaster.set(new THREE.Vector3(x, yStart, z), new THREE.Vector3(0, 1, 0))
  const hits = raycaster.intersectObject(root, true)
  for (const h of hits) {
    if (h.distance >= minDist) return h.distance
  }
  return Infinity
}

/**
 * Casts a forward (+x) ray from (xStart, y, z) to measure legroom up to first interior obstacle.
 * @param {THREE.Raycaster} raycaster
 * @param {THREE.Object3D} root
 * @param {number} xStart
 * @param {number} y
 * @param {number} z
 */
function castForward(raycaster, root, xStart, y, z) {
  raycaster.set(new THREE.Vector3(xStart, y, z), new THREE.Vector3(1, 0, 0))
  const hits = raycaster.intersectObject(root, true)
  for (const h of hits) {
    if (h.distance >= 0.02) return h.distance
  }
  return Infinity
}

function createStubDocument() {
  const noop = () => {}
  const grad = { addColorStop: noop }
  const ctx2d = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    ellipse: noop,
    fill: noop,
    stroke: noop,
    fillText: noop,
    strokeText: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    setLineDash: noop,
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    measureText: () => ({ width: 10 }),
  }
  return {
    createElement: () => ({
      width: 64,
      height: 64,
      getContext: () => ctx2d,
      toDataURL: () => 'data:image/png;base64,',
    }),
  }
}

function measureFleet() {
  const kit = vehicles.createVehicleKit({ THREE, locale: 'en', document: createStubDocument() })
  fleet.installFleet(kit)

  const raycaster = new THREE.Raycaster()
  /** @type {Record<string, string>} */
  const groupOf = {}
  for (const [group, ids] of Object.entries(fleet.fleetGroups)) {
    for (const id of ids) groupOf[id] = group
  }

  /** @type {Array<{
   *   id: string;
   *   group: string;
   *   kind: string;
   *   seats: Array<{ index: number; x: number; y: number; z: number; w: number; l: number; headroomMin: number; headroomRays: number[]; legroom: number }>;
   *   doors: Array<{ id: string; width: number; height: number }>;
   * }>} */
  const results = []

  const RAY_OFFSETS = [
    [0, 0],
    [0.06, 0],
    [-0.06, 0],
    [0, -0.06],
    [0, 0.06],
  ]

  for (const id of fleet.fleetVehicleIds) {
    const c = kit.build(id, 'intact')
    c.root.updateMatrixWorld(true)

    const seats = c.seatTops.map((/** @type {{ x: number; y: number; z: number; w: number; l: number }} */ s, /** @type {number} */ index) => {
      // Cast from seat.y + 0.02 upward; ignore anything within 0.25 m above cushion (e.g. backrest/bolster edge)
      // Wait: if we ignore < 0.25 m we still catch any real roof/headliner (even a 0.40 m low roof) while skipping the cushion itself.
      const rays = RAY_OFFSETS.map(([dx, dz]) => {
        const dist = castUp(raycaster, c.vehicle, s.x + dx, s.y + 0.02, s.z + dz, 0.2)
        return Number.isFinite(dist) ? dist + 0.02 : Infinity
      })
      const headroomMin = Math.min(...rays)

      // Legroom: from hip x (seat.x) forward (+x) at knee height (seat.y + 0.12), starting past cushion front edge
      const frontEdge = s.x + s.l / 2 + 0.02
      const forwardFromEdge = castForward(raycaster, c.vehicle, frontEdge, s.y + 0.12, s.z)
      const legroom = Number.isFinite(forwardFromEdge) ? s.l / 2 + 0.02 + forwardFromEdge : Infinity

      return { index, x: s.x, y: s.y, z: s.z, w: s.w, l: s.l, headroomMin, headroomRays: rays, legroom }
    })

    const zones = kit.zonesOf(c)
    const doors = zones
      .filter((/** @type {{ type: string }} */ z) => z.type === 'door')
      .map((/** @type {{ id: string; box: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number } }} */ z) => ({
        id: z.id,
        width: z.box.x1 - z.box.x0,
        height: z.box.y1 - z.box.y0,
      }))

    results.push({
      id,
      group: groupOf[id] ?? 'unknown',
      kind: c.meta?.kind ?? 'unknown',
      seats,
      doors,
    })

    kit.dispose(c)
  }

  return results
}

const asJson = process.argv.includes('--json')
const charData = measureCharacters()
const fleetData = measureFleet()

if (asJson) {
  console.log(JSON.stringify({ characters: charData, fleet: fleetData }, null, 2))
  process.exit(0)
}

console.log('# Medições T0.1 — Personagens e Frota (69 veículos)\n')

console.log('## 1. Personagens — Corpo rico (Bestiário v17, pose neutra)\n')
console.log('| Tipo | Fator `s` | Topo do crânio (m) | Topo total c/ cabelo (m) | Base `minY` (m) | Obs |')
console.log('|---|---:|---:|---:|---:|---|')
for (const r of charData.richBest) {
  console.log(`| \`${r.type}\` | ${r.scale.toFixed(2)} | ${fmt(r.skullTop)} | ${fmt(r.totalTop)} | ${fmt(r.minY)} | ${r.noLegs ? 'sem pernas' : ''} |`)
}

console.log('\n## 2. Personagens — Corpo rico (Sobreviventes / `person-builder`)\n')
console.log('| Caso | `h` | `bulk` | Topo do crânio (m) | Topo total c/ cabelo (m) | Base `minY` (m) |')
console.log('|---|---:|---:|---:|---:|---:|')
for (const r of charData.richPerson) {
  console.log(`| ${r.label} | ${r.h.toFixed(2)} | ${r.bulk.toFixed(2)} | ${fmt(r.skullTop)} | ${fmt(r.totalTop)} | ${fmt(r.minY)} |`)
}

console.log('\n## 3. Personagens — Corpo instanciado (`buildInstancedBody`)\n')
console.log('| Spec | Segmentos | Topo do crânio (m) | Topo total c/ cabelo (m) | Base `minY` (m) |')
console.log('|---|---:|---:|---:|---:|')
for (const r of charData.instanced) {
  console.log(`| \`${r.spec}\` | ${r.segments} | ${fmt(r.skullTop)} | ${fmt(r.totalTop)} | ${fmt(r.minY)} |`)
}

console.log('\n## 4. Personagens — Corpo assado (`bakeBody`, LOD 1)\n')
console.log('| Tipo | Fator `s` | `maxY` (m) | `minY` (m) | Vértices |')
console.log('|---|---:|---:|---:|---:|')
for (const r of charData.baked) {
  console.log(`| \`${r.type}\` | ${r.scale.toFixed(2)} | ${fmt(r.maxY)} | ${fmt(r.minY)} | ${r.verts} |`)
}

console.log('\n## 5. Frota inteira (69 veículos) — Assentos (5 raios) e Portas\n')
console.log('| Veículo | Grupo | Kind | Assentos | Assento 0 (almofada y) | Altura livre mín. (m) | Espaço pernas (m) | Largura assento (m) | Portas (vão L×A m) |')
console.log('|---|---|---|---:|---:|---:|---:|---:|---|')
for (const v of fleetData) {
  const s0 = v.seats[0]
  const doorsText = v.doors.length
    ? v.doors.map((d) => `${d.id}: ${d.width.toFixed(2)}×${d.height.toFixed(2)}`).join('; ')
    : '—'
  if (!s0) {
    console.log(`| \`${v.id}\` | ${v.group} | ${v.kind} | 0 | — | — | — | — | ${doorsText} |`)
  } else {
    console.log(
      `| \`${v.id}\` | ${v.group} | ${v.kind} | ${v.seats.length} | ${fmt(s0.y)} | ${fmt(s0.headroomMin)} | ${fmt(s0.legroom)} | ${fmt(s0.w)} | ${doorsText} |`,
    )
  }
}

// Summary by group
console.log('\n## 6. Resumo por grupo da frota\n')
const groups = [...new Set(fleetData.map((v) => v.group))]
console.log('| Grupo | Veículos | Sem assento | Altura livre mín. / med. / máx. (m) | Espaço pernas mín. / med. (m) |')
console.log('|---|---:|---:|---|---|')
for (const g of groups) {
  const items = fleetData.filter((v) => v.group === g)
  const noSeats = items.filter((v) => v.seats.length === 0).length
  const headrooms = items
    .flatMap((v) => v.seats.slice(0, 2).map((s) => s.headroomMin))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  const legrooms = items
    .flatMap((v) => v.seats.slice(0, 2).map((s) => s.legroom))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  const med = (/** @type {number[]} */ arr) => (arr.length ? arr[Math.floor(arr.length / 2)] : Number.NaN)
  const hrText = headrooms.length ? `${fmt(headrooms[0])} / ${fmt(med(headrooms))} / ${fmt(headrooms[headrooms.length - 1])}` : 'inf / —'
  const lrText = legrooms.length ? `${fmt(legrooms[0])} / ${fmt(med(legrooms))}` : 'inf / —'
  console.log(`| ${g} | ${items.length} | ${noSeats} | ${hrText} | ${lrText} |`)
}
