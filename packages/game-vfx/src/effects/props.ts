import type { Vec3Tuple } from '../workshop/types'

/**
 * A point of a prop's own space in the world, for a prop placed at `translation` and turned by `rotation` (x, y, z radians, applied in the order x, y,
 * z) as three.js composes it: how the page's `carW` and `tbW` find the bumper or a table leg.
 */
export function localToWorld(translation: Vec3Tuple, rotation: Vec3Tuple, local: Vec3Tuple): Vec3Tuple {
  const [x, y, z] = local
  const [a, c, e] = [Math.cos(rotation[0]), Math.cos(rotation[1]), Math.cos(rotation[2])]
  const [b, d, f] = [Math.sin(rotation[0]), Math.sin(rotation[1]), Math.sin(rotation[2])]
  const [ae, af, be, bf] = [a * e, a * f, b * e, b * f]
  return [
    c * e * x + -c * f * y + d * z + translation[0],
    (af + be * d) * x + (ae - bf * d) * y + -b * c * z + translation[1],
    (bf - ae * d) * x + (be + af * d) * y + a * c * z + translation[2],
  ]
}
