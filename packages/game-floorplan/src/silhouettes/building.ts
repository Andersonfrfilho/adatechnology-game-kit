import { createSilhouetteBuilder } from './builder'
import { createSilhouetteRandom } from './random'
import type { RandomSource, Silhouette } from './types'

const STOREY_HEIGHT = 3
const SHOP_AWNING_HEIGHT = 4.5
const WINDOW_COLUMN_WIDTH = 2.6
const SHOP_SIGNS = ['FARMÁCIA', 'MAGAZINE', 'LOTÉRICA', 'PADARIA', 'ÓTICA', 'CALÇADOS', 'BAR'] as const
const SIGN_COLORS = ['#ffd27a', '#e8dfcf', '#c4483b'] as const
const DEFAULT_LIT_CHANCE = 0.07

export type CityBuildingParams = {
  x: number
  z: number
  width: number
  depth: number
  height: number
  color: number
  /** Chance of a ground-floor shop on both long faces; omitted means none. */
  shopChance?: number
  /** Chance that a window is lit. */
  litChance?: number
  random?: RandomSource
  seed?: number
}

/** City building: block, roof slab, maybe a vent, maybe a shop front, and window instances on the four faces. */
export function createCityBuilding(p: CityBuildingParams): Silhouette {
  const random = p.random ?? createSilhouetteRandom(p.seed ?? 7)
  const b = createSilhouetteBuilder(random)
  const { x, z, width: w, depth: d, height: h } = p
  b.box(x, 0, z, w, h, d, p.color)
  b.box(x, h, z, w + 0.3, 0.35, d + 0.3, 0x2a2a2c)
  if (random() < 0.4) b.cylinder(x + (random() - 0.5) * (w - 3), h + 0.35, z + (random() - 0.5) * (d - 3), 0.8, 0.8, 1.4, 0x4b4540)
  const hasShop = p.shopChance !== undefined && p.shopChance > 0 && random() < p.shopChance
  if (hasShop) {
    for (const face of [1, -1]) {
      const zFace = z + face * (d / 2)
      b.box(x, SHOP_AWNING_HEIGHT, zFace + face * 0.8, w, 0.2, 1.6, 0x2a2a2c)
      b.box(x, 0, zFace + face * 0.03, w * 0.6, 3.5, 0.05, 0x4a4c4e)
      const text = b.pick(SHOP_SIGNS)
      b.sign(text, x, 5.3, zFace + face * 0.12, Math.min(w * 0.7, 8), 1, face > 0 ? 0 : Math.PI, { background: '#1a1a1c', foreground: b.pick(SIGN_COLORS) })
    }
  }
  addWindows(b, p, hasShop ? SHOP_AWNING_HEIGHT : 0)
  return b.finish({ x, z, width: w, depth: d, height: h + 0.35 })
}

function addWindows(b: ReturnType<typeof createSilhouetteBuilder>, p: CityBuildingParams, base: number): void {
  const { x, z, width: w, depth: d, height: h } = p
  const floors = Math.max(1, Math.floor((h - 1) / STOREY_HEIGHT))
  const faces: [number, number, number, number][] = [[0, d / 2 + 0.03, w, 0], [0, -d / 2 - 0.03, w, Math.PI], [w / 2 + 0.03, 0, d, Math.PI / 2], [-w / 2 - 0.03, 0, d, -Math.PI / 2]]
  for (const [ox, oz, faceWidth, ry] of faces) {
    const columns = Math.max(1, Math.floor(faceWidth / WINDOW_COLUMN_WIDTH))
    for (let floor = 0; floor < floors; floor++) {
      const y = base + 1.8 + floor * STOREY_HEIGHT
      for (let column = 0; column < columns; column++) {
        const u = (column - (columns - 1) / 2) * WINDOW_COLUMN_WIDTH
        b.windows.push({ x: ox ? x + ox : x + u, y, z: ox ? z + u : z + oz, ry, width: 1.2, height: 1.4, isLit: b.random() < (p.litChance || DEFAULT_LIT_CHANCE) })
      }
    }
  }
}
