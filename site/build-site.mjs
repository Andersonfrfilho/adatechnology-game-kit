// Builds the static demo site into site/dist: one page per example plus a landing page.
// Run after `pnpm install` and `pnpm build` at the repo root. No dependencies beyond Node.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderLanding } from './landing.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'site/dist')

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const dirs = (base) =>
  existsSync(base) ? readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : []

// Every published example gets a way back to the landing page; the standalone builds stay untouched.
const BACK_LINK = `<a href="../" id="kit-back" title="Voltar ao Game Kit" style="position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:2147483647;background:rgba(12,14,19,.88);color:#fff;border:1px solid #4a505c;border-left:0;border-radius:0 8px 8px 0;padding:10px 10px 10px 8px;font:600 13px/1.2 system-ui,sans-serif;text-decoration:none;writing-mode:vertical-rl;transform-origin:center">← Voltar ao kit</a>`
const withBackLink = (html) => (/<body[^>]*>/i.test(html) ? html.replace(/<body[^>]*>/i, (body) => `${body}\n${BACK_LINK}`) : `${BACK_LINK}\n${html}`)

// Pages that show the weapon thumbnails link their credits (CC BY and CC BY-SA ask for the credit where the picture appears).
const CREDITS_LINK = `<a href="../weapon-svg/credits.html" id="kit-weapon-credits" style="position:fixed;right:8px;bottom:8px;z-index:2147483646;background:rgba(12,14,19,.88);color:#fff;border:1px solid #4a505c;border-radius:6px;padding:3px 8px;font:12px/1.4 system-ui,sans-serif;text-decoration:none">Miniaturas das armas: créditos e licenças</a>`
const WEAPON_THUMBNAIL_EXAMPLES = new Set(['weapons-test-area', 'test-room'])
const withCreditsLink = (name, html) => (WEAPON_THUMBNAIL_EXAMPLES.has(name) && /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${CREDITS_LINK}\n</body>`) : html)

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

const examples = []
// test-room goes first: other examples (interactables-test-area, vfx-test-area, weapons-test-area) load their area into its page
const exampleNames = dirs(join(root, 'examples')).sort((a, b) => (b === 'test-room') - (a === 'test-room'))
for (const name of exampleNames) {
  const dir = join(root, 'examples', name)
  const pkgPath = join(dir, 'package.json')
  if (!existsSync(pkgPath)) continue
  const pkg = readJson(pkgPath)
  if (!pkg.scripts?.build) continue
  console.log(`> building example ${name}`)
  execFileSync('node', ['build.mjs'], { cwd: dir, stdio: 'inherit' })
  const distDir = join(dir, 'dist')
  const pages = existsSync(distDir) ? readdirSync(distDir).filter((f) => f.endsWith('.html')).sort() : []
  if (pages.length === 0) {
    console.warn(`! example ${name} produced no HTML page, skipping`)
    continue
  }
  const target = join(out, name)
  mkdirSync(target, { recursive: true })
  writeFileSync(join(target, 'index.html'), withCreditsLink(name, withBackLink(readFileSync(join(distDir, pages[0]), 'utf8'))))
  // Any additional page is kept next to the first one.
  for (const extra of pages.slice(1)) writeFileSync(join(target, extra), withCreditsLink(name, withBackLink(readFileSync(join(distDir, extra), 'utf8'))))
  examples.push({ name, description: pkg.description ?? '' })
}

// Weapon thumbnails (SVG, each with its own licence: see CREDITS.md and LICENSE-NOTE.md) are served from /weapon-svg, which the example pages reach as ../weapon-svg/.
const thumbnailSource = join(root, 'packages/game-weapons-three/assets/weapon-svg')
if (existsSync(thumbnailSource)) cpSync(thumbnailSource, join(out, 'weapon-svg'), { recursive: true })

const packages = dirs(join(root, 'packages'))
  .filter((d) => existsSync(join(root, 'packages', d, 'package.json')))
  .map((d) => readJson(join(root, 'packages', d, 'package.json')))
  .map((p) => ({ name: p.name, version: p.version ?? '', description: p.description ?? '' }))

// Thumbnails come from site/thumbs (node site/capture-thumbs.mjs); a missing one shows a placeholder.
const thumbsDir = join(root, 'site/thumbs')
const thumbs = new Set(existsSync(thumbsDir) ? readdirSync(thumbsDir).filter((f) => f.endsWith('.jpg')).map((f) => f.slice(0, -4)) : [])
if (thumbs.size) cpSync(thumbsDir, join(out, 'thumbs'), { recursive: true })

const html = renderLanding({ examples, packages, hasThumb: (key) => thumbs.has(key) })
writeFileSync(join(out, 'index.html'), html)
console.log(`site/dist ready: ${examples.length} examples, ${packages.length} packages`)
