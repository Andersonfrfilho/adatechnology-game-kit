// Records the game's rain curtain (jogo.js `const RAIN = 14000` up to `function skyUpdate`) and the numbers of its sky, fog and zone fog: the
// literal block runs in a vm with three.js stubs that keep what the code builds, under a seeded Math.random. Needs `pnpm build` first.
// Usage: node tools/golden/bin/record-weather-visual.mjs [--seed 1]
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'

import { cutBetween, cutDeclaration } from '../dist/cut-source.js'
import { createSeededRandom } from '../dist/index.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const source = readFileSync(resolve(root, 'specs/001-migracao-entregas-dos-times/artefatos/2UG1Mhe9LqJkQKKVsJkTWR/jogo.js'), 'utf8')
const seedFlag = process.argv.indexOf('--seed')
const seed = seedFlag > 0 ? Number(process.argv[seedFlag + 1]) : 1
const sha = (text) => createHash('sha256').update(text).digest('hex')

const block = cutBetween(source, 'const RAIN = 14000;', 'function skyUpdate')
const sky = cutBetween(source, 'function skyUpdate', "$('clock')")
const zone = cutDeclaration(source, 'ZONA_NEBLINA')
const palette = cutBetween(source, 'const sky = new THREE.Color()', '// luz de sódio')
const fogSetup = cutBetween(source, 'scene.fog = new THREE.Fog(', ';')

// the stubs keep the arguments the block gives three.js
const made = []
class Stub { constructor(...args) { this.args = args; this.attributes = {}; made.push(this) } setAttribute(name, attribute) { this.attributes[name] = attribute } copy() {} }
class Vector3 extends Stub {}
class BufferAttribute extends Stub { constructor(array, size) { super(array, size); this.array = array } }
class ShaderMaterial extends Stub { constructor(options) { super(options); Object.assign(this, options) } }
class Points extends Stub { constructor(geometry, material) { super(geometry, material); this.geometry = geometry; this.material = material } }
class BufferGeometry extends Stub {}
const sandbox = {
  THREE: { BufferGeometry, BufferAttribute, ShaderMaterial, Points, Vector3 },
  timeU: { value: 0 },
  scene: { add() {} },
  Math: Object.create(Math),
}
sandbox.Math.random = createSeededRandom(seed)
runInNewContext(`${block}\nglobalThis.__rain = { RAIN, rp, rainMat, rain }`, sandbox, { timeout: 20000 })
const { RAIN, rp, rainMat, rain } = sandbox.__rain
const positions = Float32Array.from(rp)
const bytes = Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength)

const fixture = {
  seed,
  cuts: { rain: sha(block), sky: sha(sky), zone: sha(zone), palette: sha(palette), fog: sha(fogSetup) },
  rain: {
    count: RAIN,
    floats: positions.length,
    positionsSha256: createHash('sha256').update(bytes).digest('hex'),
    head: Array.from(positions.slice(0, 12)),
    tail: Array.from(positions.slice(-6)),
    vertexShader: rainMat.vertexShader,
    fragmentShader: rainMat.fragmentShader,
    transparent: rainMat.transparent,
    depthWrite: rainMat.depthWrite,
    frustumCulled: rain.frustumCulled,
    uniforms: Object.keys(rainMat.uniforms),
  },
  lines: { sky: sky.split('\n').map((line) => line.trim()), zone, palette: palette.split('\n').map((line) => line.trim()), fog: fogSetup },
}
const outDir = resolve(root, 'tools/golden/fixtures/weather')
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'game-rain-curtain.json'), `${JSON.stringify(fixture, null, 2)}\n`)
console.log(`game-rain-curtain.json: ${RAIN} drops, ${positions.length} floats`)
