type Three = any

/** The team's rounded box: a 4x4x4 grid per face with the edge vertices pushed onto an arc of the given radius (smooth normals). A radius of 0 is a plain box. */
export function createRoundedBox(THREE: Three, width: number, height: number, depth: number, radius: number): any {
  if (radius === 0) return new THREE.BoxGeometry(width, height, depth)
  const geometry = new THREE.BoxGeometry(2, 2, 2, 4, 4, 4)
  const position = geometry.attributes.position
  const normal = geometry.attributes.normal
  const half = [width / 2, height / 2, depth / 2]
  const p = [0, 0, 0]
  const q = [0, 0, 0]
  const map = (value: number, halfSize: number): number => {
    const a = Math.abs(value)
    return Math.sign(value) * (a <= 0.5 ? a * 2 * (halfSize - radius) : halfSize - radius + (a - 0.5) * 2 * radius)
  }
  for (let index = 0; index < position.count; index++) {
    const source = [position.getX(index), position.getY(index), position.getZ(index)]
    let length = 0
    for (let axis = 0; axis < 3; axis++) {
      p[axis] = map(source[axis] as number, half[axis] as number)
      const clamped = Math.max(-((half[axis] as number) - radius), Math.min((half[axis] as number) - radius, p[axis] as number))
      q[axis] = (p[axis] as number) - clamped
      p[axis] = clamped
      length += (q[axis] as number) ** 2
    }
    length = Math.sqrt(length)
    if (length < 1e-6) {
      q[0] = normal.getX(index)
      q[1] = normal.getY(index)
      q[2] = normal.getZ(index)
    } else for (let axis = 0; axis < 3; axis++) q[axis] = (q[axis] as number) / length
    position.setXYZ(index, (p[0] as number) + (q[0] as number) * radius, (p[1] as number) + (q[1] as number) * radius, (p[2] as number) + (q[2] as number) * radius)
    normal.setXYZ(index, q[0] as number, q[1] as number, q[2] as number)
  }
  return geometry
}

/** Triangle prism: the triangle `width` wide and `height` high, extruded `depth` long and centred on z. Base at y = 0. */
export function createPrism(THREE: Three, width: number, height: number, depth: number): any {
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2, 0)
  shape.lineTo(width / 2, 0)
  shape.lineTo(0, height)
  shape.lineTo(-width / 2, 0)
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  geometry.translate(0, 0, -depth / 2)
  return geometry
}
