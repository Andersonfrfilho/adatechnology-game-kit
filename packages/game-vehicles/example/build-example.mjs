// Builds a self-contained, offline example: example/dist/vehicles-example.html with three.js and the IIFE build inlined.
// Usage: pnpm build && pnpm --filter @adatechnology/game-vehicles example:build
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const files = [
  ['three', join(dirname(require.resolve('three/package.json')), 'build', 'three.min.js'), 'THREE'],
  ['game-vehicles', join(here, '..', 'dist', 'index.global.js'), 'GameVehicles'],
]

const out = process.argv[2] ? resolve(process.argv[2]) : join(here, 'dist', 'vehicles-example.html')
const scripts = files.map(([name, file, global]) => {
  if (!existsSync(file)) {
    console.error(`Missing ${file}. Run "pnpm build" first.`)
    process.exit(1)
  }
  const code = readFileSync(file, 'utf8')
    .replace(/\/\/# sourceMappingURL=.*$/gm, '')
    .replace(/<\/script/gi, '<\\/script')
  if (!code.includes(global)) {
    console.error(`${file} does not define ${global}.`)
    process.exit(1)
  }
  return `<script>/* ${name} */\n${code}\n</script>`
})

const html = readFileSync(join(here, 'example.html'), 'utf8').replace('<!--BUNDLES-->', () => scripts.join('\n'))
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, html)
console.log(`Example written to ${out} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`)
