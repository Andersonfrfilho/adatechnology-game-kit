// Renders the body sounds of the kit (`BODY_FOLEY_BANK` of game-audio, through the same engine and mixing chain the test room plays them on) to WAV files to
// listen to (criterion C10 of the sound checklist: the owner's ear), and measures each one's peak (C6: never above -1 dBFS):
//   footsteps-<surface>.wav   six walking steps, then six running ones
//   landings.wav              a light and a heavy landing on each surface
//   blows.wav                 each blow: the swing, then the hit on an object and on a body (and the face for a punch)
//   body.wav                  jump, hurt, bite, grab, a body falling, a hard fall, the breath of a run, death
// It runs Chromium (OfflineAudioContext, 48 kHz mono) and writes to OUT (default shots/body-reel) plus peaks.json.
// Run: pnpm build && node body-reel.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const require = createRequire(import.meta.url)
/** @type {typeof import('playwright')} */
const { chromium } = (() => {
  for (const id of ['playwright', 'playwright-core', '/opt/node-tools/node_modules/playwright']) {
    try {
      return require(id)
    } catch {
      /* next */
    }
  }
  throw new Error('playwright not found')
})()
const esbuild = (() => {
  const store = join(root, 'node_modules/.pnpm')
  const dir = readdirSync(store).filter((d) => d.startsWith('esbuild@')).sort().reverse()[0]
  return require(join(store, dir, 'node_modules/esbuild'))
})()

const OUT = resolve(process.env.OUT ?? join(here, 'shots/body-reel'))
mkdirSync(OUT, { recursive: true })
const audioDist = join(root, 'packages/game-audio/dist/index.js')
const contractsDist = join(root, 'packages/game-contracts/dist/index.js')
if (!existsSync(audioDist)) throw new Error('build game-audio first (pnpm build)')

const bundle = await esbuild.build({
  stdin: {
    contents: `
      import { BODY_FOLEY_BANK, createAudioEngine } from '@adatechnology/game-audio'
      import { SURFACE_IDS, SWING_LEAD_SECONDS } from '@adatechnology/game-contracts'
      window.reel = { BODY_FOLEY_BANK, createAudioEngine, SURFACE_IDS, SWING_LEAD_SECONDS }
    `,
    resolveDir: here,
  },
  bundle: true,
  write: false,
  format: 'iife',
  alias: { '@adatechnology/game-audio': audioDist, '@adatechnology/game-contracts': contractsDist },
})

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setContent('<html><body></body></html>')
await page.addScriptTag({ content: bundle.outputFiles[0].text })

/** @typedef {[number, string, number?, number?]} ReelEvent when (seconds), the sound id, its volume and its distance */
/** Renders a timeline [[seconds, id, volume?, distance?]] and answers the samples and the peak of each id. */
const render = (/** @type {number} */ seconds, /** @type {ReelEvent[]} */ timeline) =>
  page.evaluate(
    async ([total, events]) => {
      const { BODY_FOLEY_BANK, createAudioEngine } = window.reel
      const rate = 48000
      const ctx = new OfflineAudioContext(1, Math.ceil(total * rate), rate)
      const engine = createAudioEngine({ banks: [BODY_FOLEY_BANK], createContext: () => /** @type {AudioContext} the engine draws the same graph into an offline context; its option is typed for the live one */ (/** @type {unknown} */ (ctx)), seed: 5 })
      engine.setListener({ position: [0, 1.7, 0], yaw: 0 })
      for (const [at, id, volume = 1, distance = 1.5] of events) engine.play(id, { delay: at, volume, position: [0, 0, -distance] })
      const buffer = await ctx.startRendering()
      const data = buffer.getChannelData(0)
      // the peak of each event: the loudest sample from its start to the next event
      const peaks = events.map(([at, id], /** @type {number} */ i) => {
        const from = Math.floor(at * rate)
        const to = Math.min(data.length, Math.floor((events[i + 1]?.[0] ?? total) * rate))
        let peak = 0
        for (let k = from; k < to; k++) peak = Math.max(peak, Math.abs(data[k]))
        return { id, peak }
      })
      return { samples: Array.from(data), peaks }
    },
    /** @type {[number, ReelEvent[]]} */ ([seconds, timeline]),
  )

const wav = (/** @type {number[]} */ samples, rate = 48000) => {
  const buffer = Buffer.alloc(44 + samples.length * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples.length * 2, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(rate, 24)
  buffer.writeUInt32LE(rate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples.length * 2, 40)
  samples.forEach((/** @type {number} */ s, /** @type {number} */ i) => buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2))
  return buffer
}

const { SURFACE_IDS, SWING_LEAD_SECONDS } = await page.evaluate(() => ({ SURFACE_IDS: [...window.reel.SURFACE_IDS], SWING_LEAD_SECONDS: { ...window.reel.SWING_LEAD_SECONDS } }))
const dbfs = (/** @type {number} */ peak) => (peak > 0 ? Math.round(20 * Math.log10(peak) * 10) / 10 : -Infinity)
/** @type {Record<string, { id: string; peakDbfs: number }[]>} */
const report = {}
const save = async (/** @type {string} */ name, /** @type {number} */ seconds, /** @type {ReelEvent[]} */ timeline) => {
  const { samples, peaks } = await render(seconds, timeline)
  writeFileSync(join(OUT, `${name}.wav`), wav(samples))
  report[name] = peaks.map((p) => ({ id: p.id, peakDbfs: dbfs(p.peak) }))
}

for (const surface of SURFACE_IDS) {
  /** @type {ReelEvent[]} */
  const timeline = []
  for (let i = 0; i < 6; i++) timeline.push([0.2 + i * 0.55, `footstep_${surface}_walk`, 0.3])
  for (let i = 0; i < 6; i++) timeline.push([3.9 + i * 0.33, `footstep_${surface}_run`, 0.6])
  await save(`footsteps-${surface}`, 6.3, timeline)
}
await save(
  'landings',
  SURFACE_IDS.length * 2.4 + 0.5,
  SURFACE_IDS.flatMap((surface, i) => /** @type {ReelEvent[]} */ ([
    [0.2 + i * 2.4, `land_${surface}_light`, 0.9],
    [1.3 + i * 2.4, `land_${surface}_heavy`, 1],
  ])),
)
/** @type {[import('@adatechnology/game-contracts').BlowId, string | null, string[]][]} */
const BLOWS = [
  ['punch', 'punch_swing', ['punch_hit_object', 'punch_hit_body', 'punch_hit_face']],
  ['kick', 'kick_swing', ['kick_hit_object', 'kick_hit']],
  ['shove', null, ['shove_two_hands']],
  ['blade', 'knife_swing', ['knife_hit_object', 'knife_stab', 'knife_slash']],
  ['blunt', 'blunt_swing', ['blunt_hit_object', 'blunt_hit']],
  ['chop', 'axe_swing', ['axe_hit_object', 'axe_chop']],
]
/** @type {ReelEvent[]} */
const blows = []
let t = 0.2
for (const [blow, swing, hits] of BLOWS) {
  for (const hit of hits) {
    if (swing) blows.push([t, swing, 0.8])
    blows.push([t + (swing ? SWING_LEAD_SECONDS[blow] : 0), hit, 0.85])
    t += 1.1
  }
}
await save('blows', t + 0.5, blows)
const BODY = ['jump', 'cloth_rustle', 'player_hurt', 'bite', 'grab', 'body_fall', 'fall_damage', 'player_breath_run', 'player_death']
await save(
  'body',
  BODY.length * 1.6 + 0.6,
  BODY.map((id, i) => /** @type {ReelEvent} */ ([0.2 + i * 1.6, id, 0.9])),
)
await browser.close()

writeFileSync(join(OUT, 'peaks.json'), JSON.stringify(report, null, 2))
const all = Object.values(report).flat()
const loudest = all.reduce((a, b) => (b.peakDbfs > a.peakDbfs ? b : a))
const over = all.filter((p) => p.peakDbfs > -1)
console.log(`wrote ${Object.keys(report).length} files to ${OUT}`)
console.log(`loudest: ${loudest.id} ${loudest.peakDbfs} dBFS; over -1 dBFS: ${over.length ? over.map((p) => `${p.id} ${p.peakDbfs}`).join(', ') : 'none'}`)
