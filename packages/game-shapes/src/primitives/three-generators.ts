/*
 * The geometry generators of three.js r160 (MIT, https://github.com/mrdoob/three.js, src/geometries/*.js), ported line by line: the same loops,
 * the same expressions in the same order, numbers pushed into plain arrays and stored as Float32 at the end, exactly as `Float32BufferAttribute`
 * does. A test compares every array of every generator with three's, bit for bit, over a grid of parameters.
 */
import type { GeometryGroup, PrimitiveBuffers } from '../types'

export interface Arrays {
  vertices: number[]
  normals: number[]
  uvs: number[]
  indices: number[] | null
  groups: GeometryGroup[]
}

/** three's `arrayNeedsUint32`: 32-bit indices once any index reaches 65535. */
export function needsUint32(array: ArrayLike<number>): boolean {
  for (let i = array.length - 1; i >= 0; --i) if ((array[i] as number) >= 65535) return true
  return false
}

export const indexArray = (indices: ArrayLike<number>): Uint16Array | Uint32Array => (needsUint32(indices) ? new Uint32Array(indices) : new Uint16Array(indices))

export function pack(type: string, parameters: Record<string, unknown>, a: Arrays): PrimitiveBuffers {
  return {
    type,
    parameters,
    positions: new Float32Array(a.vertices),
    normals: new Float32Array(a.normals),
    uvs: new Float32Array(a.uvs),
    ...(a.indices ? { indices: indexArray(a.indices) } : {}),
    groups: a.groups,
  }
}

const normalize3 = (x: number, y: number, z: number): [number, number, number] => {
  const length = Math.sqrt(x * x + y * y + z * z)
  const s = 1 / (length || 1)
  return [x * s, y * s, z * s]
}

export function box(width = 1, height = 1, depth = 1, widthSegments = 1, heightSegments = 1, depthSegments = 1): PrimitiveBuffers {
  const parameters = { width, height, depth, widthSegments, heightSegments, depthSegments }
  widthSegments = Math.floor(widthSegments)
  heightSegments = Math.floor(heightSegments)
  depthSegments = Math.floor(depthSegments)
  const indices: number[] = []
  const vertices: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const groups: GeometryGroup[] = []
  let numberOfVertices = 0
  let groupStart = 0
  type Axis = 'x' | 'y' | 'z'
  const buildPlane = (u: Axis, v: Axis, w: Axis, udir: number, vdir: number, width: number, height: number, depth: number, gridX: number, gridY: number, materialIndex: number): void => {
    const segmentWidth = width / gridX
    const segmentHeight = height / gridY
    const widthHalf = width / 2
    const heightHalf = height / 2
    const depthHalf = depth / 2
    const gridX1 = gridX + 1
    const gridY1 = gridY + 1
    let vertexCounter = 0
    let groupCount = 0
    const vector = { x: 0, y: 0, z: 0 }
    for (let iy = 0; iy < gridY1; iy++) {
      const y = iy * segmentHeight - heightHalf
      for (let ix = 0; ix < gridX1; ix++) {
        const x = ix * segmentWidth - widthHalf
        vector[u] = x * udir
        vector[v] = y * vdir
        vector[w] = depthHalf
        vertices.push(vector.x, vector.y, vector.z)
        vector[u] = 0
        vector[v] = 0
        vector[w] = depth > 0 ? 1 : -1
        normals.push(vector.x, vector.y, vector.z)
        uvs.push(ix / gridX)
        uvs.push(1 - iy / gridY)
        vertexCounter += 1
      }
    }
    for (let iy = 0; iy < gridY; iy++) {
      for (let ix = 0; ix < gridX; ix++) {
        const a = numberOfVertices + ix + gridX1 * iy
        const b = numberOfVertices + ix + gridX1 * (iy + 1)
        const c = numberOfVertices + (ix + 1) + gridX1 * (iy + 1)
        const d = numberOfVertices + (ix + 1) + gridX1 * iy
        indices.push(a, b, d)
        indices.push(b, c, d)
        groupCount += 6
      }
    }
    groups.push({ start: groupStart, count: groupCount, materialIndex })
    groupStart += groupCount
    numberOfVertices += vertexCounter
  }
  buildPlane('z', 'y', 'x', -1, -1, depth, height, width, depthSegments, heightSegments, 0)
  buildPlane('z', 'y', 'x', 1, -1, depth, height, -width, depthSegments, heightSegments, 1)
  buildPlane('x', 'z', 'y', 1, 1, width, depth, height, widthSegments, depthSegments, 2)
  buildPlane('x', 'z', 'y', 1, -1, width, depth, -height, widthSegments, depthSegments, 3)
  buildPlane('x', 'y', 'z', 1, -1, width, height, depth, widthSegments, heightSegments, 4)
  buildPlane('x', 'y', 'z', -1, -1, width, height, -depth, widthSegments, heightSegments, 5)
  return pack('BoxGeometry', parameters, { vertices, normals, uvs, indices, groups })
}

function cylinderArrays(radiusTop: number, radiusBottom: number, height: number, radialSegments: number, heightSegments: number, openEnded: boolean, thetaStart: number, thetaLength: number): Arrays {
  radialSegments = Math.floor(radialSegments)
  heightSegments = Math.floor(heightSegments)
  const indices: number[] = []
  const vertices: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const groups: GeometryGroup[] = []
  let index = 0
  const indexArray: number[][] = []
  const halfHeight = height / 2
  let groupStart = 0

  const generateTorso = (): void => {
    let groupCount = 0
    const slope = (radiusBottom - radiusTop) / height
    for (let y = 0; y <= heightSegments; y++) {
      const indexRow: number[] = []
      const v = y / heightSegments
      const radius = v * (radiusBottom - radiusTop) + radiusTop
      for (let x = 0; x <= radialSegments; x++) {
        const u = x / radialSegments
        const theta = u * thetaLength + thetaStart
        const sinTheta = Math.sin(theta)
        const cosTheta = Math.cos(theta)
        vertices.push(radius * sinTheta, -v * height + halfHeight, radius * cosTheta)
        const n = normalize3(sinTheta, slope, cosTheta)
        normals.push(n[0], n[1], n[2])
        uvs.push(u, 1 - v)
        indexRow.push(index++)
      }
      indexArray.push(indexRow)
    }
    for (let x = 0; x < radialSegments; x++) {
      for (let y = 0; y < heightSegments; y++) {
        const a = indexArray[y]![x]!
        const b = indexArray[y + 1]![x]!
        const c = indexArray[y + 1]![x + 1]!
        const d = indexArray[y]![x + 1]!
        indices.push(a, b, d)
        indices.push(b, c, d)
        groupCount += 6
      }
    }
    groups.push({ start: groupStart, count: groupCount, materialIndex: 0 })
    groupStart += groupCount
  }

  const generateCap = (top: boolean): void => {
    const centerIndexStart = index
    let groupCount = 0
    const radius = top === true ? radiusTop : radiusBottom
    const sign = top === true ? 1 : -1
    for (let x = 1; x <= radialSegments; x++) {
      vertices.push(0, halfHeight * sign, 0)
      normals.push(0, sign, 0)
      uvs.push(0.5, 0.5)
      index++
    }
    const centerIndexEnd = index
    for (let x = 0; x <= radialSegments; x++) {
      const u = x / radialSegments
      const theta = u * thetaLength + thetaStart
      const cosTheta = Math.cos(theta)
      const sinTheta = Math.sin(theta)
      vertices.push(radius * sinTheta, halfHeight * sign, radius * cosTheta)
      normals.push(0, sign, 0)
      uvs.push(cosTheta * 0.5 + 0.5, sinTheta * 0.5 * sign + 0.5)
      index++
    }
    for (let x = 0; x < radialSegments; x++) {
      const c = centerIndexStart + x
      const i = centerIndexEnd + x
      if (top === true) indices.push(i, i + 1, c)
      else indices.push(i + 1, i, c)
      groupCount += 3
    }
    groups.push({ start: groupStart, count: groupCount, materialIndex: top === true ? 1 : 2 })
    groupStart += groupCount
  }

  generateTorso()
  if (openEnded === false) {
    if (radiusTop > 0) generateCap(true)
    if (radiusBottom > 0) generateCap(false)
  }
  return { vertices, normals, uvs, indices, groups }
}

export function cylinder(radiusTop = 1, radiusBottom = 1, height = 1, radialSegments = 32, heightSegments = 1, openEnded = false, thetaStart = 0, thetaLength = Math.PI * 2): PrimitiveBuffers {
  const parameters = { radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength }
  return pack('CylinderGeometry', parameters, cylinderArrays(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength))
}

export function cone(radius = 1, height = 1, radialSegments = 32, heightSegments = 1, openEnded = false, thetaStart = 0, thetaLength = Math.PI * 2): PrimitiveBuffers {
  const parameters = { radius, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength }
  return pack('ConeGeometry', parameters, cylinderArrays(0, radius, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength))
}

export function sphere(radius = 1, widthSegments = 32, heightSegments = 16, phiStart = 0, phiLength = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI): PrimitiveBuffers {
  const parameters = { radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength }
  widthSegments = Math.max(3, Math.floor(widthSegments))
  heightSegments = Math.max(2, Math.floor(heightSegments))
  const thetaEnd = Math.min(thetaStart + thetaLength, Math.PI)
  let index = 0
  const grid: number[][] = []
  const indices: number[] = []
  const vertices: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  for (let iy = 0; iy <= heightSegments; iy++) {
    const verticesRow: number[] = []
    const v = iy / heightSegments
    let uOffset = 0
    if (iy === 0 && thetaStart === 0) uOffset = 0.5 / widthSegments
    else if (iy === heightSegments && thetaEnd === Math.PI) uOffset = -0.5 / widthSegments
    for (let ix = 0; ix <= widthSegments; ix++) {
      const u = ix / widthSegments
      const x = -radius * Math.cos(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength)
      const y = radius * Math.cos(thetaStart + v * thetaLength)
      const z = radius * Math.sin(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength)
      vertices.push(x, y, z)
      const n = normalize3(x, y, z)
      normals.push(n[0], n[1], n[2])
      uvs.push(u + uOffset, 1 - v)
      verticesRow.push(index++)
    }
    grid.push(verticesRow)
  }
  for (let iy = 0; iy < heightSegments; iy++) {
    for (let ix = 0; ix < widthSegments; ix++) {
      const a = grid[iy]![ix + 1]!
      const b = grid[iy]![ix]!
      const c = grid[iy + 1]![ix]!
      const d = grid[iy + 1]![ix + 1]!
      if (iy !== 0 || thetaStart > 0) indices.push(a, b, d)
      if (iy !== heightSegments - 1 || thetaEnd < Math.PI) indices.push(b, c, d)
    }
  }
  return pack('SphereGeometry', parameters, { vertices, normals, uvs, indices, groups: [] })
}

export function plane(width = 1, height = 1, widthSegments = 1, heightSegments = 1): PrimitiveBuffers {
  const parameters = { width, height, widthSegments, heightSegments }
  const widthHalf = width / 2
  const heightHalf = height / 2
  const gridX = Math.floor(widthSegments)
  const gridY = Math.floor(heightSegments)
  const gridX1 = gridX + 1
  const gridY1 = gridY + 1
  const segmentWidth = width / gridX
  const segmentHeight = height / gridY
  const indices: number[] = []
  const vertices: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  for (let iy = 0; iy < gridY1; iy++) {
    const y = iy * segmentHeight - heightHalf
    for (let ix = 0; ix < gridX1; ix++) {
      const x = ix * segmentWidth - widthHalf
      vertices.push(x, -y, 0)
      normals.push(0, 0, 1)
      uvs.push(ix / gridX)
      uvs.push(1 - iy / gridY)
    }
  }
  for (let iy = 0; iy < gridY; iy++) {
    for (let ix = 0; ix < gridX; ix++) {
      const a = ix + gridX1 * iy
      const b = ix + gridX1 * (iy + 1)
      const c = ix + 1 + gridX1 * (iy + 1)
      const d = ix + 1 + gridX1 * iy
      indices.push(a, b, d)
      indices.push(b, c, d)
    }
  }
  return pack('PlaneGeometry', parameters, { vertices, normals, uvs, indices, groups: [] })
}

export function circle(radius = 1, segments = 32, thetaStart = 0, thetaLength = Math.PI * 2): PrimitiveBuffers {
  const parameters = { radius, segments, thetaStart, thetaLength }
  segments = Math.max(3, segments)
  const indices: number[] = []
  const vertices: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  vertices.push(0, 0, 0)
  normals.push(0, 0, 1)
  uvs.push(0.5, 0.5)
  for (let s = 0, i = 3; s <= segments; s++, i += 3) {
    const segment = thetaStart + (s / segments) * thetaLength
    // the vector's z stays 0, as three's Vector3
    vertices.push(radius * Math.cos(segment), radius * Math.sin(segment), 0)
    normals.push(0, 0, 1)
    uvs.push(((vertices[i] as number) / radius + 1) / 2, ((vertices[i + 1] as number) / radius + 1) / 2)
  }
  for (let i = 1; i <= segments; i++) indices.push(i, i + 1, 0)
  return pack('CircleGeometry', parameters, { vertices, normals, uvs, indices, groups: [] })
}

export function ring(innerRadius = 0.5, outerRadius = 1, thetaSegments = 32, phiSegments = 1, thetaStart = 0, thetaLength = Math.PI * 2): PrimitiveBuffers {
  const parameters = { innerRadius, outerRadius, thetaSegments, phiSegments, thetaStart, thetaLength }
  thetaSegments = Math.max(3, thetaSegments)
  phiSegments = Math.max(1, phiSegments)
  const indices: number[] = []
  const vertices: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  let radius = innerRadius
  const radiusStep = (outerRadius - innerRadius) / phiSegments
  for (let j = 0; j <= phiSegments; j++) {
    for (let i = 0; i <= thetaSegments; i++) {
      const segment = thetaStart + (i / thetaSegments) * thetaLength
      const x = radius * Math.cos(segment)
      const y = radius * Math.sin(segment)
      vertices.push(x, y, 0)
      normals.push(0, 0, 1)
      uvs.push((x / outerRadius + 1) / 2, (y / outerRadius + 1) / 2)
    }
    radius += radiusStep
  }
  for (let j = 0; j < phiSegments; j++) {
    const thetaSegmentLevel = j * (thetaSegments + 1)
    for (let i = 0; i < thetaSegments; i++) {
      const segment = i + thetaSegmentLevel
      const a = segment
      const b = segment + thetaSegments + 1
      const c = segment + thetaSegments + 2
      const d = segment + 1
      indices.push(a, b, d)
      indices.push(b, c, d)
    }
  }
  return pack('RingGeometry', parameters, { vertices, normals, uvs, indices, groups: [] })
}

export function lathe(points: ReadonlyArray<readonly [number, number]>, segments = 12, phiStart = 0, phiLength = Math.PI * 2): PrimitiveBuffers {
  const parameters = { points: points.map(([x, y]) => ({ x, y })), segments, phiStart, phiLength }
  segments = Math.floor(segments)
  phiLength = Math.max(0, Math.min(Math.PI * 2, phiLength))
  const indices: number[] = []
  const vertices: number[] = []
  const uvs: number[] = []
  const initNormals: number[] = []
  const normals: number[] = []
  const inverseSegments = 1.0 / segments
  const normal = { x: 0, y: 0, z: 0 }
  const curNormal = { x: 0, y: 0, z: 0 }
  const prevNormal = { x: 0, y: 0, z: 0 }
  let dx = 0
  let dy = 0
  const last = points.length - 1
  const px = (j: number): number => (points[j] as readonly [number, number])[0]
  const py = (j: number): number => (points[j] as readonly [number, number])[1]
  const setNormalized = (): void => {
    const n = normalize3(normal.x, normal.y, normal.z)
    normal.x = n[0]
    normal.y = n[1]
    normal.z = n[2]
  }
  for (let j = 0; j <= last; j++) {
    if (j === 0) {
      dx = px(j + 1) - px(j)
      dy = py(j + 1) - py(j)
      normal.x = dy * 1.0
      normal.y = -dx
      normal.z = dy * 0.0
      prevNormal.x = normal.x
      prevNormal.y = normal.y
      prevNormal.z = normal.z
      setNormalized()
      initNormals.push(normal.x, normal.y, normal.z)
    } else if (j === last) {
      initNormals.push(prevNormal.x, prevNormal.y, prevNormal.z)
    } else {
      dx = px(j + 1) - px(j)
      dy = py(j + 1) - py(j)
      normal.x = dy * 1.0
      normal.y = -dx
      normal.z = dy * 0.0
      curNormal.x = normal.x
      curNormal.y = normal.y
      curNormal.z = normal.z
      normal.x += prevNormal.x
      normal.y += prevNormal.y
      normal.z += prevNormal.z
      setNormalized()
      initNormals.push(normal.x, normal.y, normal.z)
      prevNormal.x = curNormal.x
      prevNormal.y = curNormal.y
      prevNormal.z = curNormal.z
    }
  }
  for (let i = 0; i <= segments; i++) {
    const phi = phiStart + i * inverseSegments * phiLength
    const sin = Math.sin(phi)
    const cos = Math.cos(phi)
    for (let j = 0; j <= last; j++) {
      vertices.push(px(j) * sin, py(j), px(j) * cos)
      uvs.push(i / segments, j / (points.length - 1))
      const x = (initNormals[3 * j + 0] as number) * sin
      const y = initNormals[3 * j + 1] as number
      const z = (initNormals[3 * j + 0] as number) * cos
      normals.push(x, y, z)
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < points.length - 1; j++) {
      const base = j + i * points.length
      const a = base
      const b = base + points.length
      const c = base + points.length + 1
      const d = base + 1
      indices.push(a, b, d)
      indices.push(c, d, b)
    }
  }
  return pack('LatheGeometry', parameters, { vertices, normals, uvs, indices, groups: [] })
}

export function torus(radius = 1, tube = 0.4, radialSegments = 12, tubularSegments = 48, arc = Math.PI * 2): PrimitiveBuffers {
  const parameters = { radius, tube, radialSegments, tubularSegments, arc }
  radialSegments = Math.floor(radialSegments)
  tubularSegments = Math.floor(tubularSegments)
  const indices: number[] = []
  const vertices: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  for (let j = 0; j <= radialSegments; j++) {
    for (let i = 0; i <= tubularSegments; i++) {
      const u = (i / tubularSegments) * arc
      const v = (j / radialSegments) * Math.PI * 2
      const x = (radius + tube * Math.cos(v)) * Math.cos(u)
      const y = (radius + tube * Math.cos(v)) * Math.sin(u)
      const z = tube * Math.sin(v)
      vertices.push(x, y, z)
      const cx = radius * Math.cos(u)
      const cy = radius * Math.sin(u)
      const n = normalize3(x - cx, y - cy, z - 0)
      normals.push(n[0], n[1], n[2])
      uvs.push(i / tubularSegments)
      uvs.push(j / radialSegments)
    }
  }
  for (let j = 1; j <= radialSegments; j++) {
    for (let i = 1; i <= tubularSegments; i++) {
      const a = (tubularSegments + 1) * j + i - 1
      const b = (tubularSegments + 1) * (j - 1) + i - 1
      const c = (tubularSegments + 1) * (j - 1) + i
      const d = (tubularSegments + 1) * j + i
      indices.push(a, b, d)
      indices.push(b, c, d)
    }
  }
  return pack('TorusGeometry', parameters, { vertices, normals, uvs, indices, groups: [] })
}
