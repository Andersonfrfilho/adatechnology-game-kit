import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { writeGenerated } from './generate'
import { writeManifest } from './manifest'

const folder = join(dirname(fileURLToPath(import.meta.url)), '../../../packages/game-weapons-three/assets/weapon-svg')
const command = process.argv[2]

if (command === 'generate') {
  const written = writeGenerated(join(folder, 'generated'))
  const manifest = writeManifest(folder)
  console.log(`weapon-thumbnails: ${written.length} generated silhouettes, manifest with ${Object.keys(manifest.assets).length} entries`)
} else if (command === 'manifest') {
  const manifest = writeManifest(folder)
  const counts = Object.values(manifest.assets).reduce<Record<string, number>>((all, entry) => ({ ...all, [entry.source]: (all[entry.source] ?? 0) + 1 }), {})
  console.log(`weapon-thumbnails: manifest ${JSON.stringify(counts)}`)
} else {
  console.error('usage: node dist/cli.js generate | manifest')
  process.exit(1)
}
