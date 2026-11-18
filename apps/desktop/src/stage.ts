// Copies the 4280's folder (examples/test-room/dist, links followed) into apps/desktop/build/room, the folder the app serves and the AppImage carries,
// and writes build/room/desktop-areas.json: every example of `tools/check-area/plan.mjs` (the list `pnpm check:<área>` uses) and its built page.
//   node apps/desktop/dist/stage.js [--build-room]   (--build-room runs examples/test-room/build.mjs first)
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { listAreas } from '../../../tools/check-area/plan.mjs'
import type { DesktopManifest, ExampleEntry } from './areas'

const here = dirname(fileURLToPath(import.meta.url))
const app = resolve(here, '..')
const root = resolve(app, '../..')
const roomDist = join(root, 'examples/test-room/dist')
const out = join(app, 'build/room')

if (process.argv.includes('--build-room') || !existsSync(join(roomDist, 'test-room.html'))) {
  execFileSync(process.execPath, [join(root, 'examples/test-room/build.mjs')], { stdio: 'inherit' })
}

const firstPage = (dir: string): string | null => (existsSync(dir) ? (readdirSync(dir).filter((file) => file.endsWith('.html')).sort()[0] ?? null) : null)
const descriptionOf = (folder: string): string => {
  const manifest = JSON.parse(readFileSync(join(root, 'examples', folder, 'package.json'), 'utf8')) as { description?: unknown }
  return typeof manifest.description === 'string' ? manifest.description : ''
}

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
/** Copies a folder following every link inside it (`cpSync`'s `dereference` follows only the top one). */
const copyFollowing = (from: string, to: string): void => {
  mkdirSync(to, { recursive: true })
  for (const name of readdirSync(from)) {
    const source = join(from, name)
    const info = statSync(source, { throwIfNoEntry: false })
    if (!info) continue
    if (info.isDirectory()) copyFollowing(source, join(to, name))
    else copyFileSync(source, join(to, name))
  }
}
// the room's folder holds links to every example's dist and to the sound folders: copied as files, so the AppImage has no link out of itself
copyFollowing(roomDist, out)

const examples: ExampleEntry[] = (listAreas(root) as { id: string; folder: string; name: string }[]).map((area) => ({
  id: area.id,
  folder: area.folder,
  name: area.name,
  description: descriptionOf(area.folder),
  page: area.folder === 'test-room' ? 'test-room.html' : firstPage(join(out, area.folder)),
}))
const manifest: DesktopManifest = { examples }
writeFileSync(join(out, 'desktop-areas.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`stage: ${out} (${examples.filter((entry) => entry.page).length}/${examples.length} example pages built)`)
