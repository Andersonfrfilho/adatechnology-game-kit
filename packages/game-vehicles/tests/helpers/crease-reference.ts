/* The creasing of the kit before the typed-array grouping, kept as the reference the new one must match bit for bit. */
/* eslint-disable */
export function referenceCrease(THREE: any, geo: any, deg: any): any {
  const PI = Math.PI
  if (geo.index) {
    const ni = geo.toNonIndexed()
    Object.keys(ni.attributes).forEach(function (k) {
      geo.setAttribute(k, ni.attributes[k])
    })
    geo.setIndex(null)
  }
  const p = geo.attributes.position
  const n = p.count
  /* face normals in one array (x, y, z per face): the same arithmetic as the vector operations, without an object per face */
  const faces = n / 3
  const FN = new Float64Array(faces * 3)
  const map = new Map<number | string, number[]>()
  /* vertices closer than 1/2000 share a key; the three rounded coordinates pack into one number (17 bits each) so the lookup hashes no string */
  const RANGE = 65536
  function key(i: any): number | string {
    const x = Math.round(p.getX(i) * 2000)
    const y = Math.round(p.getY(i) * 2000)
    const z = Math.round(p.getZ(i) * 2000)
    if (Math.abs(x) < RANGE && Math.abs(y) < RANGE && Math.abs(z) < RANGE) return ((x + RANGE) * 131072 + (y + RANGE)) * 131072 + (z + RANGE)
    return x + ',' + y + ',' + z
  }
  const keys = new Array(n)
  for (let f = 0; f < faces; f++) {
    const ax = p.getX(3 * f)
    const ay = p.getY(3 * f)
    const az = p.getZ(3 * f)
    const bx = p.getX(3 * f + 1)
    const by = p.getY(3 * f + 1)
    const bz = p.getZ(3 * f + 1)
    const cx = p.getX(3 * f + 2)
    const cy = p.getY(3 * f + 2)
    const cz = p.getZ(3 * f + 2)
    /* cross(C - B, A - B) */
    const e1x = cx - bx
    const e1y = cy - by
    const e1z = cz - bz
    const e2x = ax - bx
    const e2y = ay - by
    const e2z = az - bz
    let nx = e1y * e2z - e1z * e2y
    let ny = e1z * e2x - e1x * e2z
    let nz = e1x * e2y - e1y * e2x
    if (nx * nx + ny * ny + nz * nz > 1e-20) {
      const inv = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1)
      nx *= inv
      ny *= inv
      nz *= inv
    }
    FN[3 * f] = nx
    FN[3 * f + 1] = ny
    FN[3 * f + 2] = nz
    for (let k = 0; k < 3; k++) {
      const kk = key(3 * f + k)
      keys[3 * f + k] = kk
      const list = map.get(kk)
      if (list) list.push(f)
      else map.set(kk, [f])
    }
  }
  const cs = Math.cos((deg * PI) / 180)
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const fi = ((i / 3) | 0) * 3
    const list = map.get(keys[i]) as number[]
    let sx = 0
    let sy = 0
    let sz = 0
    for (let j = 0; j < list.length; j++) {
      const g = list[j] * 3
      if (FN[g] * FN[fi] + FN[g + 1] * FN[fi + 1] + FN[g + 2] * FN[fi + 2] >= cs) {
        sx += FN[g]
        sy += FN[g + 1]
        sz += FN[g + 2]
      }
    }
    if (sx * sx + sy * sy + sz * sz < 1e-20) {
      sx = FN[fi]
      sy = FN[fi + 1]
      sz = FN[fi + 2]
    }
    const inv = 1 / (Math.sqrt(sx * sx + sy * sy + sz * sz) || 1)
    out[3 * i] = sx * inv
    out[3 * i + 1] = sy * inv
    out[3 * i + 2] = sz * inv
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3))
  geo.userData.crease = true
  return geo
}
