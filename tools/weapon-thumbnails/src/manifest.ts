import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const MANIFEST_VERSION = 1

/** What the Commons search recorded about a file it kept, from the file's own metadata. */
export interface CommonsSource {
  readonly title: string
  readonly author: string
  readonly license: string
  readonly licenseUrl: string
  readonly page: string
  readonly originalUrl: string
}

export interface ManifestEntry {
  readonly source: 'generated' | 'commons'
  /** Path of the SVG relative to the manifest. */
  readonly file: string
  readonly author?: string
  readonly license?: string
  readonly licenseUrl?: string
  readonly page?: string
}

export interface Manifest {
  readonly version: typeof MANIFEST_VERSION
  readonly assets: Readonly<Record<string, ManifestEntry>>
}

const ids = (directory: string): string[] =>
  existsSync(directory) ? readdirSync(directory).filter((file) => file.endsWith('.svg')).map((file) => file.slice(0, -4)).sort() : []

/** The manifest of a `weapon-svg` folder: every generated id, with the Commons file instead when one was kept (its licence is recorded in `commons-sources.json`). */
export function buildManifest(folder: string): Manifest {
  const sourcesPath = join(folder, 'commons-sources.json')
  const sources: Record<string, CommonsSource> = existsSync(sourcesPath) ? (JSON.parse(readFileSync(sourcesPath, 'utf8')) as Record<string, CommonsSource>) : {}
  const commons = new Set(ids(join(folder, 'commons')).filter((id) => id in sources))
  const assets: Record<string, ManifestEntry> = {}
  for (const id of ids(join(folder, 'generated'))) {
    const source = sources[id]
    assets[id] = commons.has(id) && source
      ? { source: 'commons', file: `commons/${id}.svg`, author: source.author, license: source.license, licenseUrl: source.licenseUrl, page: source.page }
      : { source: 'generated', file: `generated/${id}.svg` }
  }
  return { version: MANIFEST_VERSION, assets }
}

const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()

export function creditsOf(manifest: Manifest, sources: Readonly<Record<string, CommonsSource>>): string {
  const all = Object.entries(manifest.assets)
  const fromCommons = all.filter(([, entry]) => entry.source === 'commons')
  const lines = [
    '# Créditos das miniaturas das armas',
    '',
    `${all.length - fromCommons.length} miniaturas são geradas a partir do modelo 3D do próprio kit (licença MIT do repositório).`,
    `${fromCommons.length} vêm do Wikimedia Commons e mantêm a licença do autor (veja \`LICENSE-NOTE.md\`).`,
    '',
  ]
  if (fromCommons.length === 0) return `${lines.join('\n')}\nNenhuma miniatura do Commons foi adotada até agora.\n`
  lines.push('| Arma | Autor | Licença | Página do arquivo | Arquivo original |', '| --- | --- | --- | --- | --- |')
  for (const [id, entry] of fromCommons) {
    const source = sources[id]
    lines.push(`| \`${id}\` | ${cell(entry.author ?? '')} | [${cell(entry.license ?? '')}](${entry.licenseUrl ?? ''}) | [${cell(source?.title ?? id)}](${entry.page ?? ''}) | ${source?.originalUrl ?? ''} |`)
  }
  return `${lines.join('\n')}\n`
}

export function writeManifest(folder: string): Manifest {
  const manifest = buildManifest(folder)
  writeFileSync(join(folder, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`)
  const sourcesPath = join(folder, 'commons-sources.json')
  const sources = existsSync(sourcesPath) ? (JSON.parse(readFileSync(sourcesPath, 'utf8')) as Record<string, CommonsSource>) : {}
  writeFileSync(join(folder, 'CREDITS.md'), creditsOf(manifest, sources))
  return manifest
}
