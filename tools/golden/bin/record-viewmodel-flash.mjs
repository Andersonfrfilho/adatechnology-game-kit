// Records what the first-person muzzle flash and its smoke drew BEFORE they became recipes of game-vfx: `fx/effects.ts` and `fx/particles.ts` of game-weapons-three at
// commit d15e990, run unchanged (only transpiled) on the real three.js with a seeded random. For every scenario it keeps, frame by frame, the flash's pieces (geometry
// and its numbers, material, world position, world turn, scale), the light, and the puffs of smoke. game-vfx-three's test replays the recipe and compares to it.
// Usage: node tools/golden/bin/record-viewmodel-flash.mjs        (reads the old sources from git, so it needs the history)
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const COMMIT = 'd15e990'
const require = createRequire(resolve(root, 'packages/game-weapons-three/package.json'))
const THREE = require('three')
const ts = require('typescript')

const show = (file) => execFileSync('git', ['show', `${COMMIT}:packages/game-weapons-three/src/fx/${file}`], { cwd: root, encoding: 'utf8' })
const sources = { 'effects.ts': show('effects.ts'), 'particles.ts': show('particles.ts') }
const work = mkdtempSync(resolve(tmpdir(), 'viewmodel-flash-'))
for (const [file, text] of Object.entries(sources)) {
  // the old files import './particles' and '../models/kit' for types only; transpiling drops them
  const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
  writeFileSync(resolve(work, file.replace('.ts', '.mjs')), js)
}
const { createEffects } = await import(pathToFileURL(resolve(work, 'effects.mjs')).href)
const { createParticles } = await import(pathToFileURL(resolve(work, 'particles.mjs')).href)

// Park-Miller 16807, the stream game-vfx plays a seed with (`lehmer`)
const lehmer = (seed) => {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

const kit = () => {
  const additive = { transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }
  return {
    THREE,
    M: {
      flashA: new THREE.MeshBasicMaterial({ color: 0xffb347, ...additive }),
      flashB: new THREE.MeshBasicMaterial({ color: 0xfff1c0, ...additive }),
      smokeP: new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 1, metalness: 0, transparent: true, opacity: 0.35, depthWrite: false }),
    },
  }
}

const SAMPLES = [1, 2, 3, 4, 5, 6, 8, 12, 50, 100, 150, 190, 200]
const FRAMES = 200
const quaternion = (yaw, pitch, roll) => new THREE.Quaternion().setFromEuler(new THREE.Euler(roll, yaw, pitch, 'YXZ'))
export const SCENARIOS = [
  { name: 'level, 100 fps', seed: 7, size: 0.8, point: [0.3, 1.2, -0.5], turn: [0.7, -0.4, 0.2], dt: 0.01 },
  { name: 'straight x, 60 fps, a shell', seed: 123456, size: 2.6, point: [0, 1, 0], turn: [0, 0, 0], dt: 1 / 60 },
  { name: 'aimed up, 60 fps', seed: 99, size: 1.6, point: [-1, 0.5, 2], turn: [-2.1, 1.0, 0], dt: 1 / 60 },
]

const round = (value) => Number(value.toPrecision(14))
const vector = (v) => [round(v.x), round(v.y), round(v.z)]
const turn = (q) => [round(q.x), round(q.y), round(q.z), round(q.w)]
const solid = (mesh) => {
  mesh.updateWorldMatrix(true, false)
  const position = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  mesh.matrixWorld.decompose(position, rotation, scale)
  const g = mesh.geometry
  const m = mesh.material
  return {
    geometry: g.type,
    parameters: Object.fromEntries(Object.entries(g.parameters).map(([key, value]) => [key, typeof value === 'number' ? round(value) : value])),
    material: { type: m.type, color: m.color.getHex(), opacity: round(m.opacity), additive: m.blending === THREE.AdditiveBlending, transparent: m.transparent, depthWrite: m.depthWrite },
    position: vector(position),
    turn: turn(rotation),
    scale: round(scale.x),
  }
}

const runs = []
for (const scenario of SCENARIOS) {
  const scene = new THREE.Group()
  const particles = createParticles(THREE, scene, () => 0)
  const effects = createEffects(kit(), scene, particles, lehmer(scenario.seed))
  const orientation = quaternion(...scenario.turn)
  effects.muzzleFlash(new THREE.Vector3(...scenario.point), orientation, scenario.size)
  const frames = []
  for (let frame = 1; frame <= FRAMES; frame++) {
    effects.update(scenario.dt)
    particles.update(scenario.dt)
    if (!SAMPLES.includes(frame)) continue
    const light = scene.children.find((child) => child.isPointLight)
    const group = scene.children.find((child) => child.isGroup)
    const puffs = scene.children.filter((child) => child.isMesh)
    frames.push({
      frame,
      flash: group ? group.children.map(solid) : [],
      light: { intensity: round(light.intensity), distance: round(light.distance), decay: light.decay, color: light.color.getHex(), position: vector(light.position) },
      puffs: puffs.map(solid),
    })
  }
  runs.push({ ...scenario, orientation: turn(orientation), frames })
}

const fixture = {
  source: { commit: COMMIT, files: Object.fromEntries(Object.entries(sources).map(([file, text]) => [`packages/game-weapons-three/src/fx/${file}`, createHash('sha256').update(text).digest('hex')])) },
  frames: FRAMES,
  samples: SAMPLES,
  runs,
}
const outDir = resolve(root, 'tools/golden/fixtures/weapons')
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'viewmodel-flash.json'), `${JSON.stringify(fixture, null, 2)}\n`)
console.log(`viewmodel-flash.json: ${runs.length} scenarios, ${runs.reduce((n, run) => n + run.frames.length, 0)} sampled frames`)
