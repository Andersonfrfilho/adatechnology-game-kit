// Builds the static demo site into site/dist: one page per example plus a landing page.
// Run after `pnpm install` and `pnpm build` at the repo root. No dependencies beyond Node.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'site/dist')

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const dirs = (base) =>
  existsSync(base) ? readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : []
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

const examples = []
for (const name of dirs(join(root, 'examples'))) {
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
  copyFileSync(join(distDir, pages[0]), join(target, 'index.html'))
  // Any additional page is kept next to the first one.
  for (const extra of pages.slice(1)) copyFileSync(join(distDir, extra), join(target, extra))
  examples.push({ name, description: pkg.description ?? '' })
}

const packages = dirs(join(root, 'packages'))
  .filter((d) => existsSync(join(root, 'packages', d, 'package.json')))
  .map((d) => readJson(join(root, 'packages', d, 'package.json')))
  .map((p) => ({ name: p.name, version: p.version ?? '', description: p.description ?? '' }))

const exampleItems = examples
  .map((e) => `<li><a href="${esc(e.name)}/"><strong>${esc(e.name)}</strong></a><p>${esc(e.description)}</p></li>`)
  .join('\n      ')
const packageItems = packages
  .map((p) => `<li><code>${esc(p.name)}</code> <span class="v">${esc(p.version)}</span><p>${esc(p.description)}</p></li>`)
  .join('\n      ')

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AdA Technology Game Kit</title>
<style>
  :root { color-scheme: light dark; --bg: #fafafa; --fg: #1a1a1f; --muted: #5f6470; --card: #fff; --line: #e1e3e8; --accent: #3a5bd9; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #14151a; --fg: #e8e9ee; --muted: #9aa0ad; --card: #1c1e25; --line: #2d303a; --accent: #8aa4ff; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 860px; margin: 0 auto; padding: 48px 16px 64px; }
  h1 { font-size: 2rem; margin: 0 0 8px; }
  h2 { font-size: 1.2rem; margin: 40px 0 12px; }
  .lead { color: var(--muted); margin: 0; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  li { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; }
  li p { margin: 4px 0 0; color: var(--muted); font-size: 0.92rem; }
  a { color: var(--accent); }
  code { font: 0.95rem ui-monospace, SFMono-Regular, Menlo, monospace; }
  .v { color: var(--muted); font-size: 0.85rem; margin-left: 6px; }
  footer { margin-top: 40px; color: var(--muted); font-size: 0.85rem; }
</style>
</head>
<body>
<main>
  <h1>AdA Technology Game Kit</h1>
  <p class="lead">Engine-agnostic game building blocks, published under <code>@adatechnology/</code>. Try the examples below in your browser.</p>
  <h2>Examples</h2>
  <ul>
      ${exampleItems}
  </ul>
  <h2>Packages</h2>
  <ul>
      ${packageItems}
  </ul>
  <footer>MIT licensed. Source on <a href="https://github.com/Andersonfrfilho/adatechnology-game-kit">GitHub</a>.</footer>
</main>
</body>
</html>
`
writeFileSync(join(out, 'index.html'), html)
console.log(`site/dist ready: ${examples.length} examples, ${packages.length} packages`)
