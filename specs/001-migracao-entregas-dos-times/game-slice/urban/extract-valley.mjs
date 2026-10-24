// Writes valley-terrain.json: the Vale Cinzento as `TerrainOptions` of @adatechnology/game-urban, with the arrays read from the team's
// Galeria page (RIOS, LAGOS, CITIES) and the numbers of `hW`, `forestF` and `buildWorld` written next to the line they come from.
// Run from the repository root:  node specs/001-migracao-entregas-dos-times/game-slice/urban/extract-valley.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractLiteral } from '../../../../tools/golden/dist/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const page = readFileSync(join(here, '..', '..', 'artefatos', 'site__galeria-vale-cinzento.html'), 'utf8')
const RIOS = extractLiteral(page, 'RIOS')
const RIO_W = extractLiteral(page, 'RIO_W')
const LAGOS = extractLiteral(page, 'LAGOS')
const CITIES = extractLiteral(page, 'CITIES')

const product = (x, y, amplitude) => ({ kind: 'product', x, y, amplitude })
const diagonal = (kx, ky, amplitude) => ({ kind: 'diagonal', kx, ky, amplitude })

const terrain = {
  // buildWorld: SEG = 180 over 320 m; W2 = px * .4 - 160
  world: { size: 320, scale: 0.4, origin: -160, segments: 180 },
  // hW: h = 1.6 + sin(px*.021)*cos(py*.018)*1.1 + sin(px*.05+py*.03)*.5
  base: { level: 1.6, waves: [product(['sin', 0.021], ['cos', 0.018], 1.1), diagonal(0.05, 0.03, 0.5)] },
  layers: [
    // serra = sstep(230,40,py) * (px<560 ? 1 : sstep(720,560,px)); h += serra * (9 + 3.5*sin(px*.04)*cos(py*.06) + 2.5*sin(px*.11+py*.07))
    {
      id: 'serra',
      mask: [{ axis: 'y', from: 230, to: 40 }, { axis: 'x', from: 720, to: 560, fullUntil: 560 }],
      level: 9,
      waves: [product(['sin', 0.04], ['cos', 0.06], 3.5), diagonal(0.11, 0.07, 2.5)],
    },
    // mf = sstep(580,720,px) * sstep(520,720,py); h += mf * (4 + 2*sin(px*.09)*sin(py*.08))
    { id: 'mata_funda', mask: [{ axis: 'x', from: 580, to: 720 }, { axis: 'y', from: 520, to: 720 }], level: 4, waves: [product(['sin', 0.09], ['sin', 0.08], 2)] },
  ],
  // the cities are levelled to 1.8 from 30 m outside, except Vila do Corvo
  flatten: CITIES.filter((city) => city.n !== 'Vila do Corvo').map((city) => ({ id: city.n, rect: city.r, margin: 30, edge: [-30, 10], level: 1.8 })),
  rivers: Object.entries(RIOS).map(([id, points]) => ({ id, points, width: RIO_W[id], bed: id === 'Rio Turvo' ? { fixed: -1.6 } : { below: 2.2, floor: -1.0 } })),
  lakes: Object.entries(LAGOS).map(([id, [cx, cy, rx, ry]]) => ({ id, center: [cx, cy], radius: [rx, ry], level: -1.8, edge: [0.85, 1.35], reach: 1.35 })),
  // forestF
  forest: {
    zones: [
      { mask: [{ axis: 'y', from: 230, to: 60 }, { axis: 'x', from: 640, to: 540, fullUntil: 540 }] },
      { mask: [{ axis: 'x', from: 600, to: 700 }, { axis: 'y', from: 540, to: 660 }] },
    ],
    patch: { waves: [product(['sin', 0.031], ['cos', 0.027], 1), diagonal(0.013, 0.019, 1)], edge: [0.62, 0.8], weight: 0.8 },
  },
  // buildWorld colours, in the order the page tries them
  colors: [
    { kind: 'below', height: 0.1, color: 0x3a3a2e },
    { kind: 'ellipse', center: [262, 668], radius: [55, 35], color: 0x34402a },
    { kind: 'ellipse', center: [718, 612], radius: [40, 20], color: 0x26231f },
    { kind: 'rects', rects: CITIES.map((city) => city.r), margin: 4, color: 0x4a4a46 },
    { kind: 'above', height: 9.5, color: 0x5a5a52 },
    { kind: 'forest', above: 0.5, color: 0x22321e },
  ],
  fields: { colors: [0x5b5a32, 0x4a5a2c, 0x6a5a38, 0x3f4f2a, 0x55502e, 0x63603a], cell: [16, 11] },
  // plane(0, -.35, 0, 320, 320, M(0x2b4452, { roughness: .3, metalness: .25 }))
  water: { level: -0.35, color: 0x2b4452, roughness: 0.3, metalness: 0.25 },
}

writeFileSync(join(here, 'valley-terrain.json'), JSON.stringify(terrain, null, 2) + '\n')
console.log('valley-terrain.json written:', terrain.rivers.length, 'rivers,', terrain.lakes.length, 'lakes,', terrain.flatten.length, 'levelled cities')
