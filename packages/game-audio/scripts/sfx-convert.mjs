// @ts-check
// pnpm --filter @adatechnology/game-audio sfx:convert [--inbox <dir>] [--files <dir>] [--out <dir>] [--game-out <dir>] [--only <categoria>] [--dry-run]
//
// The kit ships its converted files (packages/game-audio/assets/sfx, CC0 and CC-BY only); the originals stay outside it (ZombiAdA
// assets/sfx-originais), found through packages/game-audio/scripts/sfx-dir.mjs (`.sfx-local.json` or KIT_SFX_INBOX / KIT_SFX_DIR). `--files <dir>`
// writes the converted files elsewhere (a game's folder); `--out <dir>` puts the files, the manifest and the credits together in one folder.
//
// Converts the files the sound team drops in <inbox>/<categoria>/ (wav, ogg, mp3, flac, aif) to what the kit plays:
//   - Ogg Vorbis q6, 48 kHz, mono (a name with `_loop` keeps stereo: rain, fire and engine loops may be stereo);
//   - the silence before the attack cut (criterion C1: the sound starts on its first millisecond), loops untouched;
//   - normalized to a peak of −1 dBFS, measured again after encoding;
//   - <files>/<categoria>/<nome>.ogg, plus packages/game-audio/assets/sfx/manifest.json (every take of every sound, layer by layer) and CREDITOS.md.
// Every file needs its line in <inbox>/CREDITOS.md: `arquivo | link da página | autor | licença`. Only CC0 and CC-BY go into the SDK (the
// files are redistributed on npm); Sonniss and Pixabay files go to --game-out (the game's own repository) or are skipped; anything else is refused.
// Needs ffmpeg (with libvorbis) and ffprobe on the PATH, and the package built (it reads the file-name rules from dist).
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { kitSfxDir, kitSfxInbox } from './sfx-dir.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const packageDir = resolve(here, '..')
const root = resolve(packageDir, '../..')

/** @typedef {'CC0' | 'CC-BY'} SdkLicense */
/** @typedef {'Sonniss' | 'Pixabay'} GameLicense */
/** @typedef {{ file: string, link: string, author: string, license: string }} Credit */
/** @typedef {{ file: string, sampleRate: number, channels: number, peak: number, seconds: number, source: string, author: string, license: SdkLicense | GameLicense }} FileEntry */
/** @typedef {{ id: string, category: string, layers: Record<string, FileEntry[]> }} ManifestSound */
/** @typedef {{ version: 1, format: { codec: 'vorbis', sampleRate: number, channels: number, peakDb: number }, sounds: ManifestSound[] }} Manifest */

const SAMPLE_RATE = 48000
const PEAK_DB = -1
const QUALITY = '6'
const INPUT = /\.(wav|wave|ogg|oga|mp3|flac|aif|aiff)$/i
const CATEGORIES = ['armas', 'impactos', 'explosoes-fogo', 'personagem', 'veiculos', 'itens-portas', 'ambiente']

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {{ inbox: string, out: string, files: string | null, gameOut: string | null, only: string | null, dryRun: boolean }} */
  const args = { inbox: kitSfxInbox(root), out: join(packageDir, 'assets/sfx'), files: null, gameOut: null, only: null, dryRun: false }
  let outGiven = false
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index]
    const value = () => {
      const next = argv[++index]
      if (next === undefined) throw new Error(`${flag} needs a value`)
      return next
    }
    if (flag === '--inbox') args.inbox = resolve(value())
    else if (flag === '--out') {
      args.out = resolve(value())
      outGiven = true
    } else if (flag === '--files') args.files = resolve(value())
    else if (flag === '--game-out') args.gameOut = resolve(value())
    else if (flag === '--only') args.only = value()
    else if (flag === '--dry-run') args.dryRun = true
    else throw new Error(`unknown flag ${flag}`)
  }
  // the files go next to the manifest (or where sfx-dir points) unless --out keeps everything in one place
  if (!args.files) args.files = outGiven ? args.out : kitSfxDir(root)
  return args
}

/**
 * The licence as the SDK reads it: CC0 and CC-BY (attribution only) ship; Sonniss and Pixabay only in a game; the rest (NC, ND, SA, none) is refused.
 * @param {string} text
 * @returns {SdkLicense | GameLicense | null}
 */
export function normalizeLicense(text) {
  const value = text.trim().toLowerCase().replace(/\s+/g, ' ')
  if (/\bnc\b|non.?commercial|\bnd\b|no.?deriv|\bsa\b|share.?alike/.test(value)) return null
  if (/^(cc0|cc-0|cc 0|creative commons 0|creative commons zero|public domain)/.test(value)) return 'CC0'
  if (/^(cc-by|cc by|creative commons attribution|attribution)/.test(value)) return 'CC-BY'
  if (value.startsWith('sonniss')) return 'Sonniss'
  if (value.startsWith('pixabay')) return 'Pixabay'
  return null
}

/**
 * Lines `arquivo | link | autor | licença` of a CREDITOS.md (a table header, separators and anything else are skipped).
 * @param {string} text
 * @returns {Map<string, Credit>}
 */
export function parseCredits(text) {
  /** @type {Map<string, Credit>} */
  const credits = new Map()
  for (const line of text.split('\n')) {
    const cells = line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim())
    if (cells.length < 4) continue
    const [file, link, author, license] = /** @type {[string, string, string, string]} */ (cells)
    if (!INPUT.test(file) || /^-+$/.test(file)) continue
    credits.set(basename(file).toLowerCase(), { file, link, author, license })
  }
  return credits
}

/**
 * @param {string} command
 * @param {string[]} args
 */
const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
/**
 * Runs ffmpeg quietly; throws with its error output.
 * @param {string[]} args
 */
const ffmpegRun = (args) => {
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-loglevel', 'error', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
  } catch (error) {
    throw new Error(`ffmpeg failed: ${/** @type {{ stderr?: string }} */ (error).stderr ?? error}`)
  }
}
/**
 * Runs ffmpeg and returns what it printed on stderr (its measuring filters report there, also on success).
 * @param {string[]} args
 */
const ffmpegStderr = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stderr

/**
 * Peak of a file, dBFS (the loudest sample of any channel), and its length in seconds.
 * @param {string} file
 * @param {string} [filters]
 */
export function measure(file, filters) {
  const stderr = ffmpegStderr(['-i', file, '-af', `${filters ? `${filters},` : ''}astats=metadata=0:reset=0:measure_perchannel=none:measure_overall=Peak_level`, '-f', 'null', '-'])
  const peak = /Peak level dB:\s*(-?[\d.]+|-inf)/.exec(stderr)
  const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate,channels:format=duration', '-of', 'json', file]))
  const stream = probe.streams?.[0] ?? {}
  return {
    peak: peak?.[1] === '-inf' || !peak ? -Infinity : Number(peak[1]),
    seconds: Number(probe.format?.duration ?? 0),
    sampleRate: Number(stream.sample_rate ?? 0),
    channels: Number(stream.channels ?? 0),
  }
}

/**
 * The filter chain before the gain: the leading silence cut (not on loops), resampled to 48 kHz, mono (not on stereo loops).
 * @param {boolean} loop
 * @param {number} channels
 */
const shapeFilters = (loop, channels) =>
  [
    loop ? null : 'silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0:detection=peak',
    `aresample=${SAMPLE_RATE}`,
    channels < 2 || (loop && channels === 2) ? null : `pan=mono|c0=${Array.from({ length: channels }, (_, index) => `${(1 / channels).toFixed(4)}*c${index}`).join('+')}`,
  ]
    .filter(Boolean)
    .join(',')

/**
 * Converts one file; returns its manifest facts.
 * @param {string} input
 * @param {string} output
 */
export function convert(input, output) {
  const name = basename(output, '.ogg')
  const loop = /_loop(_|$)/.test(name)
  const source = measure(input)
  const filters = shapeFilters(loop, source.channels)
  const shaped = measure(input, filters)
  if (!Number.isFinite(shaped.peak)) throw new Error(`${input} is silent`)
  mkdirSync(dirname(output), { recursive: true })
  let margin = 0
  for (let attempt = 0; attempt < 4; attempt++) {
    const gain = PEAK_DB - shaped.peak - margin
    ffmpegRun(['-y', '-i', input, '-af', `${filters},volume=${gain.toFixed(3)}dB`, '-ar', String(SAMPLE_RATE), '-c:a', 'libvorbis', '-q:a', QUALITY, '-map_metadata', '-1', output])
    const encoded = measure(output)
    // Vorbis can overshoot the peak a little: come down by what it went over and encode again
    if (encoded.peak <= PEAK_DB + 0.05) return { ...encoded, loop }
    margin += encoded.peak - PEAK_DB + 0.05
  }
  const encoded = measure(output)
  return { ...encoded, loop }
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
const listFiles = (dir) => (existsSync(dir) ? readdirSync(dir).filter((name) => INPUT.test(name) && statSync(join(dir, name)).isFile()) : [])

/**
 * @param {Manifest} manifest
 */
function creditsMarkdown(manifest) {
  const rows = manifest.sounds.flatMap((sound) => Object.values(sound.layers).flat()).sort((a, b) => a.file.localeCompare(b.file))
  return [
    '# Créditos dos sons',
    '',
    `Gerado por \`scripts/sfx-convert.mjs\` a partir do \`CREDITOS.md\` dos originais. Pasta: \`packages/game-audio/assets/sfx\` (os sons padrão do kit).`,
    'Só CC0 e CC-BY entram no SDK; quem usa um som CC-BY credita o autor abaixo. Um jogo pode apontar qualquer som para os seus arquivos (`pointSamples`).',
    '',
    '| arquivo | fonte | autor | licença |',
    '|---|---|---|---|',
    ...rows.map((row) => `| ${row.file} | ${row.source} | ${row.author} | ${row.license} |`),
    '',
  ].join('\n')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const distIndex = join(packageDir, 'dist/index.js')
  if (!existsSync(distIndex)) throw new Error('@adatechnology/game-audio is not built: run pnpm --filter @adatechnology/game-audio build first')
  /** @type {{ parseSfxName(name: string): { id: string, layer: string, take: number } }} */
  const audio = await import(distIndex)
  for (const tool of ['ffmpeg', 'ffprobe']) {
    try {
      run(tool, ['-version'])
    } catch {
      throw new Error(`${tool} not found on the PATH`)
    }
  }
  const creditsFile = join(args.inbox, 'CREDITOS.md')
  const credits = existsSync(creditsFile) ? parseCredits(readFileSync(creditsFile, 'utf8')) : new Map()
  const categories = (existsSync(args.inbox) ? readdirSync(args.inbox) : []).filter((name) => statSync(join(args.inbox, name)).isDirectory() && (!args.only || name === args.only))

  /** @type {Record<string, Manifest>} */
  const manifests = {}
  /** The folder the files of each manifest are in. @type {Record<string, string>} */
  const filesOf = {}
  /** @param {string} outDir */
  const manifestOf = (outDir) => {
    const existing = manifests[outDir]
    if (existing) return existing
    const file = join(outDir, 'manifest.json')
    /** @type {Manifest} */
    const loaded = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { version: 1, format: { codec: 'vorbis', sampleRate: SAMPLE_RATE, channels: 1, peakDb: PEAK_DB }, sounds: [] }
    manifests[outDir] = loaded
    return loaded
  }

  /** @type {string[]} */
  const problems = []
  let converted = 0
  for (const category of categories) {
    if (!CATEGORIES.includes(category)) console.warn(`! categoria fora da lista (${CATEGORIES.join(', ')}): ${category}`)
    for (const name of listFiles(join(args.inbox, category))) {
      const input = join(args.inbox, category, name)
      const credit = credits.get(name.toLowerCase())
      if (!credit) {
        problems.push(`${category}/${name}: sem linha em CREDITOS.md (arquivo | link | autor | licença)`)
        continue
      }
      const license = normalizeLicense(credit.license)
      if (!license) {
        problems.push(`${category}/${name}: licença recusada (${credit.license}); só CC0 ou CC-BY no SDK, Sonniss/Pixabay só no jogo`)
        continue
      }
      const gameOnly = license === 'Sonniss' || license === 'Pixabay'
      if (gameOnly && !args.gameOut) {
        problems.push(`${category}/${name}: ${license} não pode ir solto no SDK; rode com --game-out <repositório do jogo>/assets/sfx`)
        continue
      }
      const outDir = gameOnly && args.gameOut ? args.gameOut : args.out
      const filesDir = gameOnly && args.gameOut ? args.gameOut : /** @type {string} */ (args.files)
      filesOf[outDir] = filesDir
      const stem = basename(name, extname(name)).toLowerCase().replace(/[^a-z0-9_]+/g, '_')
      const relativeFile = `${category}/${stem}.ogg`
      const parsed = audio.parseSfxName(stem)
      if (args.dryRun) {
        console.log(`· ${category}/${name} → ${relative(root, join(filesDir, relativeFile))} (${parsed.id} ${parsed.layer} ${parsed.take}, ${license})`)
        continue
      }
      const facts = convert(input, join(filesDir, relativeFile))
      const manifest = manifestOf(outDir)
      let sound = manifest.sounds.find((entry) => entry.id === parsed.id)
      if (!sound) {
        sound = { id: parsed.id, category, layers: {} }
        manifest.sounds.push(sound)
      }
      const takes = (sound.layers[parsed.layer] ?? []).filter((entry) => entry.file !== relativeFile)
      takes.push({ file: relativeFile, sampleRate: facts.sampleRate, channels: facts.channels, peak: Math.round(facts.peak * 100) / 100, seconds: Math.round(facts.seconds * 1000) / 1000, source: credit.link, author: credit.author, license })
      takes.sort((a, b) => a.file.localeCompare(b.file))
      sound.layers[parsed.layer] = takes
      converted++
      console.log(`✓ ${relativeFile}  ${facts.seconds.toFixed(2)} s  pico ${facts.peak.toFixed(2)} dBFS  ${facts.channels === 1 ? 'mono' : 'estéreo'}${facts.loop ? ' (laço)' : ''}`)
    }
  }
  for (const [outDir, manifest] of Object.entries(manifests)) {
    // a take whose file is gone (replaced or renamed in the inbox) leaves the manifest and the credits, and so does a sound left with no take
    for (const sound of manifest.sounds) {
      for (const [layer, takes] of Object.entries(sound.layers)) {
        const kept = (takes ?? []).filter((entry) => existsSync(join(filesOf[outDir] ?? outDir, entry.file)))
        if (kept.length > 0) sound.layers[layer] = kept
        else delete sound.layers[layer]
      }
    }
    manifest.sounds = manifest.sounds.filter((sound) => Object.keys(sound.layers).length > 0)
    manifest.sounds.sort((a, b) => a.id.localeCompare(b.id))
    writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    writeFileSync(join(outDir, 'CREDITOS.md'), creditsMarkdown(manifest))
  }
  console.log(`${converted} arquivo(s) convertido(s)`)
  for (const problem of problems) console.error(`✗ ${problem}`)
  if (problems.length > 0) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
