// The product is taken in doubles on purpose (not `Math.imul`): the recorded pages round it the same way, and the grids depend on it.
export function hashCell(x: number, y: number): number {
  let value = (x * 374761393 + y * 668265263) | 0
  value = ((value ^ (value >>> 13)) * 1274126177) | 0
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

export function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hashCell(xi, yi)
  const b = hashCell(xi + 1, yi)
  const c = hashCell(xi, yi + 1)
  const d = hashCell(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
