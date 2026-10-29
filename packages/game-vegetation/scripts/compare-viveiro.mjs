// Compares the three versions of the vegetation engine for the Viveiro plants: the site page (sources/vegetacao__viveiro.js, script 0), the artifact (newer, with the geometry of the
// wood pieces) and this package's dist/index.global.js. Writes specs/001-migracao-entregas-dos-times/comparacoes/vegetacao/{README.md,resultado.json}.
// Not published. Run: pnpm build && node scripts/compare-viveiro.mjs
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const spec = resolve(here, '../../../specs/001-migracao-entregas-dos-times')
const site = readFileSync(join(spec, 'sources/vegetacao__viveiro.js'), 'utf8').split('\n')
const siteScript = (from, to) => site.slice(from - 1, to).join('\n')
const html = readFileSync(join(spec, 'artefatos/Bs3p84TFhG1A9YfdXSGZaQ.html'), 'utf8')
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
const find = (head) => scripts.find((s) => s.startsWith(head))
const engine = (code) => new Function(`${code}\n;return GameVegetation`)()
const species = new Function(`${find('/* @adatechnology/game-vegetation-species')}; return GameVegetationSpecies`)()

const versions = {
  site: engine(siteScript(4, 4637)),
  artifact: engine(find('/* @adatechnology/game-vegetation (dist')),
  sdk: engine(readFileSync(join(here, '../dist/index.global.js'), 'utf8')),
}
const IDS = ['mango_tree', 'coconut_palm', 'araucaria', 'mandacaru', 'prickly_pear', 'crown_cactus', 'banana_with_bunch', 'potted_fern']
const SEEDS = [1, 2, 3, 4, 5]
const GEOMETRY = ['radius', 'length', 'axis', 'base']
const hash = (value) => createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 12)
const withoutGeometry = (pieces) => pieces.map((p) => Object.fromEntries(Object.entries(p).filter(([k]) => !GEOMETRY.includes(k))))
const fingerprint = (plant) => ({
  pieces: plant.pieces.length,
  triangles: plant.triangleCount,
  body: hash(withoutGeometry(plant.pieces)),
  geometry: hash(plant.pieces.map((p) => GEOMETRY.map((k) => p[k]))),
  wood: plant.pieces.filter((p) => p.radius !== undefined).length,
})

const rows = []
for (const id of IDS) {
  const plantSpec = species.toSpec(species.getSpecies(id))
  for (const seed of SEEDS) {
    const row = { id, seed }
    for (const [name, lib] of Object.entries(versions)) row[name] = fingerprint(lib.generate(plantSpec, { seed }))
    row.sdkEqualsArtifact = row.sdk.body === row.artifact.body && row.sdk.geometry === row.artifact.geometry && row.sdk.triangles === row.artifact.triangles
    row.siteEqualsArtifactWithoutGeometry = row.site.body === row.artifact.body && row.site.triangles === row.artifact.triangles
    rows.push(row)
  }
}

const total = rows.length
const equal = rows.filter((r) => r.sdkEqualsArtifact).length
const sameBody = rows.filter((r) => r.siteEqualsArtifactWithoutGeometry).length
const out = join(spec, 'comparacoes/vegetacao')
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'resultado.json'), `${JSON.stringify({ ids: IDS, seeds: SEEDS, rows }, null, 1)}\n`)
const lines = [
  '# Comparação da vegetação: site, artefato e SDK',
  '',
  'Gerado por `packages/game-vegetation/scripts/compare-viveiro.mjs`. Três versões do motor `GameVegetation` geram as mesmas plantas (8 espécies do Viveiro, sementes 1 a 5, LOD 0):',
  '',
  '- **site**: o bundle da página `site/pages/vegetacao/viveiro.html` (`sources/vegetacao__viveiro.js`, script 0);',
  '- **artefato**: o bundle do artefato `Bs3p84TFhG1A9YfdXSGZaQ`, mais novo (geometria das peças de madeira: `radius`, `length`, `axis`, `base`);',
  '- **SDK**: `dist/index.global.js` deste pacote, depois do merge V8.',
  '',
  `Resultado: o SDK é igual ao artefato em ${equal} de ${total} plantas (peças, triângulos e geometria); o site é igual ao artefato em ${sameBody} de ${total} plantas se não se contar a geometria das peças. A diferença entre o site e o artefato é só a geometria das peças de madeira.`,
  '',
  '| espécie | semente | peças | triângulos | peças de madeira com geometria (site / artefato / SDK) | SDK = artefato | site = artefato sem a geometria |',
  '| --- | ---: | ---: | ---: | --- | :---: | :---: |',
  ...rows.map((r) => `| ${r.id} | ${r.seed} | ${r.sdk.pieces} | ${r.sdk.triangles} | ${r.site.wood} / ${r.artifact.wood} / ${r.sdk.wood} | ${r.sdkEqualsArtifact ? 'sim' : 'não'} | ${r.siteEqualsArtifactWithoutGeometry ? 'sim' : 'não'} |`),
  '',
]
writeFileSync(join(out, 'README.md'), lines.join('\n'))
console.log(`vegetation compare: ${total} plants, SDK equals the artifact in ${equal}, site equals the artifact without geometry in ${sameBody}`)
if (equal !== total || sameBody !== total) process.exitCode = 1
