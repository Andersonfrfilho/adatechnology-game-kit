import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `banana_bunch`.
 */
export const bananaBunch: ItemModelBuilder = ({ mesh, bx, cyl, G, food }) => {
  const yellow = food(0xe5c336)
  const stem = food(0x7d8a3a)
  const tip = food(0x4a3a1a)
  const point = (spread: number, lift: number, u: number): [number, number, number] => [-1.2 + u * 2.62, lift + 0.84 * (u - 0.2) * (u - 0.2), spread * 0.69 * u]
  const banana = (spread: number, lift: number) => [0, 1, 2].map((index) => {
    const from = point(spread, lift, index / 3)
    const to = point(spread, lift, (index + 1) / 3)
    const [dx, dy, dz] = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
    const elevation = Math.atan2(dy, Math.hypot(dx, dz))
    const mid: [number, number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]
    const material = index === 0 ? stem : yellow
    return mesh(cyl(index === 2 ? 0.08 : 0.15, index === 0 ? 0.1 : 0.15, Math.hypot(dx, dy, dz), 6), material, mid, [0, Math.atan2(-dz, dx), -(Math.PI / 2 - elevation)])
  })
  return G(
    mesh(bx(0.3, 0.3, 0.3), tip, [-1.35, -0.2, 0]),
    ...banana(-1, 0).flat(),
    ...banana(0, 0).flat(),
    ...banana(1, 0).flat(),
    ...banana(-0.5, 0.28).flat(),
    ...banana(0.5, 0.28).flat(),
  )
}
