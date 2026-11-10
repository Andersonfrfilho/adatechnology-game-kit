import type * as THREE_NS from 'three'
import type { HouseRecord, HouseWall, Three } from '../kernel-types.js'

function addPipeSegment(
  THREE: Three,
  parent: THREE_NS.Group,
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  radius: number,
  mat: THREE_NS.Material,
): void {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  const len = Math.hypot(dx, dy, dz)
  if (len < 1e-3) return
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 10), mat)
  mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
  const up = new THREE.Vector3(0, 1, 0)
  const dir = new THREE.Vector3(dx / len, dy / len, dz / len)
  mesh.quaternion.setFromUnitVectors(up, dir)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
}

function addExcavatedTrench(
  THREE: Three,
  parent: THREE_NS.Group,
  a: readonly [number, number],
  b: readonly [number, number],
  trenchWidth: number,
  troughMat: THREE_NS.Material,
  moundMat: THREE_NS.Material,
): void {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const isAlongX = Math.abs(dx) >= Math.abs(dz)

  const minX = Math.min(a[0], b[0])
  const maxX = Math.max(a[0], b[0])
  const minZ = Math.min(a[1], b[1])
  const maxZ = Math.max(a[1], b[1])

  const bermW = 0.12
  const bermH = 0.08
  const troughH = 0.20

  if (isAlongX) {
    const len = Math.max(0.06, maxX - minX)
    const midX = (minX + maxX) / 2
    const midZ = a[1]

    // 1. Deep recessed dark bottom trough below ground level
    const trough = new THREE.Mesh(new THREE.BoxGeometry(len, troughH, trenchWidth), troughMat)
    trough.position.set(midX, -0.10, midZ)
    trough.receiveShadow = true
    parent.add(trough)

    // 2. Left side mound of excavated dirt along trench rim
    const leftMound = new THREE.Mesh(new THREE.BoxGeometry(len + bermW, bermH, bermW), moundMat)
    leftMound.position.set(midX, bermH / 2, midZ - trenchWidth / 2 - bermW / 2)
    leftMound.castShadow = true
    leftMound.receiveShadow = true
    parent.add(leftMound)

    // 3. Right side mound of excavated dirt along trench rim
    const rightMound = new THREE.Mesh(new THREE.BoxGeometry(len + bermW, bermH, bermW), moundMat)
    rightMound.position.set(midX, bermH / 2, midZ + trenchWidth / 2 + bermW / 2)
    rightMound.castShadow = true
    rightMound.receiveShadow = true
    parent.add(rightMound)
  } else {
    const len = Math.max(0.06, maxZ - minZ)
    const midX = a[0]
    const midZ = (minZ + maxZ) / 2

    // 1. Deep recessed dark bottom trough below ground level
    const trough = new THREE.Mesh(new THREE.BoxGeometry(trenchWidth, troughH, len), troughMat)
    trough.position.set(midX, -0.10, midZ)
    trough.receiveShadow = true
    parent.add(trough)

    // 2. Left side mound of excavated dirt along trench rim
    const leftMound = new THREE.Mesh(new THREE.BoxGeometry(bermW, bermH, len + bermW), moundMat)
    leftMound.position.set(midX - trenchWidth / 2 - bermW / 2, bermH / 2, midZ)
    leftMound.castShadow = true
    leftMound.receiveShadow = true
    parent.add(leftMound)

    // 3. Right side mound of excavated dirt along trench rim
    const rightMound = new THREE.Mesh(new THREE.BoxGeometry(bermW, bermH, len + bermW), moundMat)
    rightMound.position.set(midX + trenchWidth / 2 + bermW / 2, bermH / 2, midZ)
    rightMound.castShadow = true
    rightMound.receiveShadow = true
    parent.add(rightMound)
  }
}

function addExcavatedPit(
  THREE: Three,
  parent: THREE_NS.Group,
  x: number,
  z: number,
  size: number,
  troughMat: THREE_NS.Material,
  moundMat: THREE_NS.Material,
): void {
  const bermW = 0.10
  const bermH = 0.08
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(size, 0.20, size), troughMat)
  bottom.position.set(x, -0.10, z)
  parent.add(bottom)

  const collarN = new THREE.Mesh(new THREE.BoxGeometry(size + bermW * 2, bermH, bermW), moundMat)
  collarN.position.set(x, bermH / 2, z - size / 2 - bermW / 2)
  parent.add(collarN)
  const collarS = new THREE.Mesh(new THREE.BoxGeometry(size + bermW * 2, bermH, bermW), moundMat)
  collarS.position.set(x, bermH / 2, z + size / 2 + bermW / 2)
  parent.add(collarS)
  const collarW = new THREE.Mesh(new THREE.BoxGeometry(bermW, bermH, size), moundMat)
  collarW.position.set(x - size / 2 - bermW / 2, bermH / 2, z)
  parent.add(collarW)
  const collarE = new THREE.Mesh(new THREE.BoxGeometry(bermW, bermH, size), moundMat)
  collarE.position.set(x + size / 2 + bermW / 2, bermH / 2, z)
  parent.add(collarE)
}

function nearestWallPoint(
  walls: readonly HouseWall[],
  u: number,
  v: number,
  floor: number,
): [number, number] {
  let bestDist = Infinity
  let bestPoint: [number, number] = [u, v]
  const targetFloor = floor < 0 ? 0 : floor
  for (const w of walls) {
    if ((w.floor ?? 0) !== targetFloor) continue
    const dx = w.u1 - w.u0
    const dz = w.v1 - w.v0
    const lenSq = dx * dx + dz * dz
    let t = 0
    if (lenSq > 1e-6) {
      t = Math.max(0, Math.min(1, ((u - w.u0) * dx + (v - w.v0) * dz) / lenSq))
    }
    const pu = w.u0 + t * dx
    const pv = w.v0 + t * dz
    const d = Math.hypot(u - pu, v - pv)
    if (d < bestDist) {
      bestDist = d
      bestPoint = [pu, pv]
    }
  }
  return bestPoint
}

function buildWallGraph(
  walls: readonly HouseWall[],
  extraPoints: ReadonlyArray<readonly [number, number]>,
): {
  nodes: Array<[number, number]>
  adj: Map<number, Array<{ to: number; dist: number }>>
  nodeKey: (u: number, v: number) => string
} {
  const horiz: Array<{ v: number; u0: number; u1: number }> = []
  const vert: Array<{ u: number; v0: number; v1: number }> = []
  for (const w of walls) {
    if ((w.floor ?? 0) !== 0) continue
    if (w.axis === 'u') {
      horiz.push({ v: w.v0, u0: Math.min(w.u0, w.u1), u1: Math.max(w.u0, w.u1) })
    } else {
      vert.push({ u: w.u0, v0: Math.min(w.v0, w.v1), v1: Math.max(w.v0, w.v1) })
    }
  }

  function mergeSpans(spans: Array<[number, number]>): Array<[number, number]> {
    const sorted = spans.slice().sort((a, b) => a[0] - b[0])
    const res: Array<[number, number]> = []
    for (const [s0, s1] of sorted) {
      if (!res.length) {
        res.push([s0, s1])
        continue
      }
      const last = res[res.length - 1]!
      if (s0 <= last[1] + 1.6) {
        last[1] = Math.max(last[1], s1)
      } else {
        res.push([s0, s1])
      }
    }
    return res
  }

  const hLines = new Map<number, Array<[number, number]>>()
  for (const h of horiz) {
    const vKey = Math.round(h.v * 100) / 100
    if (!hLines.has(vKey)) hLines.set(vKey, [])
    hLines.get(vKey)!.push([h.u0, h.u1])
  }
  const mergedH: Array<{ v: number; u0: number; u1: number }> = []
  for (const [v, spans] of hLines.entries()) {
    for (const [u0, u1] of mergeSpans(spans)) {
      mergedH.push({ v, u0, u1 })
    }
  }

  const vLines = new Map<number, Array<[number, number]>>()
  for (const v of vert) {
    const uKey = Math.round(v.u * 100) / 100
    if (!vLines.has(uKey)) vLines.set(uKey, [])
    vLines.get(uKey)!.push([v.v0, v.v1])
  }
  const mergedV: Array<{ u: number; v0: number; v1: number }> = []
  for (const [u, spans] of vLines.entries()) {
    for (const [v0, v1] of mergeSpans(spans)) {
      mergedV.push({ u, v0, v1 })
    }
  }

  const nodes: Array<[number, number]> = []
  const nodeKey = (u: number, v: number): string => `${(Math.round(u * 100) / 100).toFixed(2)},${(Math.round(v * 100) / 100).toFixed(2)}`
  const addNode = (u: number, v: number): void => {
    const k = nodeKey(u, v)
    if (!nodes.some((n) => nodeKey(n[0], n[1]) === k)) nodes.push([u, v])
  }

  for (const pt of extraPoints) addNode(pt[0], pt[1])
  for (const h of mergedH) {
    addNode(h.u0, h.v)
    addNode(h.u1, h.v)
    for (const v of mergedV) {
      if (v.u >= h.u0 - 0.15 && v.u <= h.u1 + 0.15 && h.v >= v.v0 - 0.15 && h.v <= v.v1 + 0.15) {
        addNode(v.u, h.v)
      }
    }
  }
  for (const v of mergedV) {
    addNode(v.u, v.v0)
    addNode(v.u, v.v1)
  }

  const adj = new Map<number, Array<{ to: number; dist: number }>>()
  for (let i = 0; i < nodes.length; i++) adj.set(i, [])

  const canConnect = (pA: readonly [number, number], pB: readonly [number, number]): boolean => {
    const dU = Math.abs(pA[0] - pB[0])
    const dV = Math.abs(pA[1] - pB[1])
    const TOL = 0.2
    if (dV < TOL) {
      const v = (pA[1] + pB[1]) / 2
      const minU = Math.min(pA[0], pB[0])
      const maxU = Math.max(pA[0], pB[0])
      return mergedH.some((h) => Math.abs(h.v - v) < TOL && minU >= h.u0 - TOL && maxU <= h.u1 + TOL)
    }
    if (dU < TOL) {
      const u = (pA[0] + pB[0]) / 2
      const minV = Math.min(pA[1], pB[1])
      const maxV = Math.max(pA[1], pB[1])
      return mergedV.some((w) => Math.abs(w.u - u) < TOL && minV >= w.v0 - TOL && maxV <= w.v1 + TOL)
    }
    return false
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (canConnect(nodes[i]!, nodes[j]!)) {
        const dist = Math.hypot(nodes[i]![0] - nodes[j]![0], nodes[i]![1] - nodes[j]![1])
        adj.get(i)!.push({ to: j, dist })
        adj.get(j)!.push({ to: i, dist })
      }
    }
  }

  return { nodes, adj, nodeKey }
}

function routeAlongWalls(
  graph: ReturnType<typeof buildWallGraph>,
  from: readonly [number, number],
  to: readonly [number, number],
): readonly [number, number][] {
  const sIdx = graph.nodes.findIndex((n) => graph.nodeKey(n[0], n[1]) === graph.nodeKey(from[0], from[1]))
  const eIdx = graph.nodes.findIndex((n) => graph.nodeKey(n[0], n[1]) === graph.nodeKey(to[0], to[1]))
  if (sIdx < 0 || eIdx < 0) return [from, to]

  const dist = new Map<number, number>()
  const prev = new Map<number, number>()
  const visited = new Set<number>()
  for (let i = 0; i < graph.nodes.length; i++) dist.set(i, Infinity)
  dist.set(sIdx, 0)

  while (visited.size < graph.nodes.length) {
    let u = -1
    let bestD = Infinity
    for (let i = 0; i < graph.nodes.length; i++) {
      if (!visited.has(i) && dist.get(i)! < bestD) {
        bestD = dist.get(i)!
        u = i
      }
    }
    if (u < 0 || bestD === Infinity) break
    if (u === eIdx) break
    visited.add(u)

    for (const edge of graph.adj.get(u)!) {
      if (visited.has(edge.to)) continue
      const alt = dist.get(u)! + edge.dist
      if (alt < dist.get(edge.to)!) {
        dist.set(edge.to, alt)
        prev.set(edge.to, u)
      }
    }
  }

  const path: Array<[number, number]> = []
  let curr: number | undefined = eIdx
  while (curr != null) {
    path.push(graph.nodes[curr]!)
    curr = prev.get(curr)
  }
  path.reverse()
  return path.length > 0 && graph.nodeKey(path[0]![0], path[0]![1]) === graph.nodeKey(from[0], from[1]) ? path : [from, to]
}

function addInspectionChamber(
  THREE: Three,
  parent: THREE_NS.Group,
  x: number,
  y: number,
  z: number,
  size: number,
  height: number,
  concreteMat: THREE_NS.Material,
  lidMat: THREE_NS.Material,
  moundMat: THREE_NS.Material,
): void {
  const body = new THREE.Mesh(new THREE.BoxGeometry(size, height, size), concreteMat)
  body.position.set(x, y + height / 2, z)
  parent.add(body)
  const lid = new THREE.Mesh(new THREE.BoxGeometry(size + 0.04, 0.03, size + 0.04), lidMat)
  lid.position.set(x, y + height + 0.015, z)
  parent.add(lid)
  // Collar of excavated dirt around the chamber
  const bermW = 0.08
  const collar = new THREE.Mesh(new THREE.BoxGeometry(size + bermW * 2, 0.04, size + bermW * 2), moundMat)
  collar.position.set(x, 0.02, z)
  parent.add(collar)
}

export function buildInstallationsStage(THREE: Three, plan: HouseRecord): THREE_NS.Group {
  const group = new THREE.Group()
  group.name = 'stage:4:installations'

  const coldWaterMat = new THREE.MeshStandardMaterial({ color: 0x9e5b32, roughness: 0.55 })
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.4, metalness: 0.7 })
  const sewerMat = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.65 })
  const troughMat = new THREE.MeshStandardMaterial({ color: 0x24160c, roughness: 0.98 })
  const moundMat = new THREE.MeshStandardMaterial({ color: 0x4a321e, roughness: 0.95 })
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x7c7f82, roughness: 0.9 })
  const conduitMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.6 })
  const box4x2Mat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 })

  const floorY0 = (f: number): number => {
    const fl = plan.floors.find((x) => x.index === f)
    return fl ? fl.y0 : f * 2.9
  }

  const plumbing = plan.utilities?.plumbing
  if (plumbing) {
    const tk = plan.waterTank
    const defaultTankX = (plan.w || 8) / 2
    const defaultTankZ = (plan.d || 6) / 2
    const tankPos: [number, number, number] = tk && Number.isFinite(tk.u) && Number.isFinite(tk.y) && Number.isFinite(tk.v)
      ? [tk.u, tk.y + 0.15, tk.v]
      : [defaultTankX, floorY0(plan.floors.length - 1) + 2.8, defaultTankZ]

    const ceiling0 = plan.floors[0]?.ceiling ?? 2.8
    // Attic header plane sits strictly ABOVE the ceiling slab (in the attic space)
    const yHeader = floorY0(0) + ceiling0 + 0.18

    // Nearest wall to water tank where distribution header enters the wall system
    const tankWall = nearestWallPoint(plan.walls, tankPos[0], tankPos[2], 0)

    // Build wall graph with tankWall and all fixture wall points
    const fixtureWallPoints: Array<[number, number]> = []
    for (const pt of plumbing.points) {
      const targetFloor = pt.floor < 0 ? 0 : pt.floor
      fixtureWallPoints.push(nearestWallPoint(plan.walls, pt.u, pt.v, targetFloor))
    }
    const wallGraph = buildWallGraph(plan.walls, [tankWall, ...fixtureWallPoints])

    // Tank vertical downpipe to header plane (strictly stays inside attic space)
    const tankBottomY = tk && Number.isFinite(tk.y) ? tk.y : yHeader + 1.2
    if (tankBottomY > yHeader + 0.02) {
      addPipeSegment(THREE, group, [tankPos[0], tankBottomY, tankPos[2]], [tankPos[0], yHeader, tankPos[2]], 0.025, coldWaterMat)
    }
    // Header pipe from tank position to nearest wall (orthogonal in attic)
    if (Math.abs(tankPos[0] - tankWall[0]) > 1e-3) {
      addPipeSegment(THREE, group, [tankPos[0], yHeader, tankPos[2]], [tankWall[0], yHeader, tankPos[2]], 0.02, coldWaterMat)
    }
    if (Math.abs(tankPos[2] - tankWall[1]) > 1e-3) {
      addPipeSegment(THREE, group, [tankWall[0], yHeader, tankPos[2]], [tankWall[0], yHeader, tankWall[1]], 0.02, coldWaterMat)
    }

    const sewerMainX = tankPos[0]
    let minV = Infinity
    for (const pt of plumbing.points) {
      const targetFloor = pt.floor < 0 ? 0 : pt.floor
      const y0 = floorY0(targetFloor)
      const [wU, wV] = nearestWallPoint(plan.walls, pt.u, pt.v, targetFloor)

      // 1. Cold water line:
      // Routes strictly along the wall network in the attic (above the ceiling slab)
      const wallPath = routeAlongWalls(wallGraph, tankWall, [wU, wV])
      for (let i = 0; i + 1 < wallPath.length; i++) {
        const pA = wallPath[i]!
        const pB = wallPath[i + 1]!
        addPipeSegment(THREE, group, [pA[0], yHeader, pA[1]], [pB[0], yHeader, pB[1]], 0.015, coldWaterMat)
      }
      // Vertical distribution column drops inside the wall core down to the tap/fixture height
      addPipeSegment(THREE, group, [wU, yHeader, wV], [wU, y0 + pt.y, wV], 0.015, coldWaterMat)

      // Short horizontal stub from wall core to fixture terminal (clamped to wall thickness, never floating across room/yard)
      const dist = Math.hypot(pt.u - wU, pt.v - wV)
      const stubLen = Math.min(0.08, dist)
      const stubU = dist > 1e-4 ? wU + ((pt.u - wU) / dist) * stubLen : wU
      const stubV = dist > 1e-4 ? wV + ((pt.v - wV) / dist) * stubLen : wV
      addPipeSegment(THREE, group, [wU, y0 + pt.y, wV], [stubU, y0 + pt.y, stubV], 0.015, coldWaterMat)
      // Brass tap fitting at fixture
      const jointGeo = new THREE.SphereGeometry(0.025, 8, 8)
      const fitting = new THREE.Mesh(jointGeo, brassMat)
      fitting.position.set(stubU, y0 + pt.y, stubV)
      group.add(fitting)

      // 2. Sewer & Drainage:
      if (pt.kind === 'toilet' || pt.kind === 'sink' || pt.kind === 'shower' || pt.kind === 'laundry_tub' || pt.kind === 'washing_machine') {
        const drainR = pt.kind === 'toilet' ? 0.045 : 0.025
        const ySewer = -0.14
        // Fixture vertical drain down into the deep ground pit
        addPipeSegment(THREE, group, [pt.u, y0 + Math.max(0.12, pt.y * 0.45), pt.v], [pt.u, ySewer, pt.v], drainR, sewerMat)
        // Excavated pit at the base of fixture drop
        addExcavatedPit(THREE, group, pt.u, pt.v, 0.32, troughMat, moundMat)
        // Underground pipe nestled deep in trench to main collector
        addPipeSegment(THREE, group, [pt.u, ySewer, pt.v], [sewerMainX, ySewer, pt.v], drainR, sewerMat)
        // Excavated ground trench with raised dirt mounds along the pipe run
        addExcavatedTrench(THREE, group, [pt.u, pt.v], [sewerMainX, pt.v], Math.max(0.28, drainR * 5), troughMat, moundMat)

        // Traps & inspection chambers
        if (pt.kind === 'sink') {
          // Grease trap (caixa de gordura) outside kitchen
          addInspectionChamber(THREE, group, (pt.u + sewerMainX) / 2, -0.05, pt.v, 0.42, 0.22, concreteMat, box4x2Mat, moundMat)
        } else if (pt.kind === 'shower') {
          // Siphon floor drain (caixa sifonada) in bathroom
          const sifonada = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12), sewerMat)
          sifonada.position.set(pt.u, 0.04, pt.v)
          group.add(sifonada)
        }
        minV = Math.min(minV, pt.v)
      }
    }

    if (Number.isFinite(minV)) {
      const frontV = (plan.lot?.rect?.[1] ?? -1.5) + 0.6
      const ySewer = -0.14
      // Main underground collector running forward to street alignment inside the trench
      addPipeSegment(THREE, group, [sewerMainX, ySewer, minV], [sewerMainX, ySewer, frontV], 0.05, sewerMat)
      addExcavatedTrench(THREE, group, [sewerMainX, minV], [sewerMainX, frontV], 0.36, troughMat, moundMat)
      // Building inspection chamber (caixa de inspeção predial) on the front lot
      addInspectionChamber(THREE, group, sewerMainX, -0.05, frontV, 0.52, 0.25, concreteMat, box4x2Mat, moundMat)
    }
  }

  const elec = plan.utilities?.electrical
  if (elec && elec.panel) {
    const Q = elec.panel
    const pOrigin: [number, number, number] = [Q.u, Q.y, Q.v]
    const boxGeo = new THREE.BoxGeometry(0.08, 0.12, 0.05)
    const ceiling0 = plan.floors[0]?.ceiling ?? 2.8

    // Breaker panel
    const panelMesh = new THREE.Mesh(new THREE.BoxGeometry(Q.w ?? 0.3, Q.h ?? 0.4, 0.08), box4x2Mat)
    panelMesh.position.set(Q.u, Q.y, Q.v)
    group.add(panelMesh)

    for (const sw of elec.switches ?? []) {
      const y0 = floorY0(sw.floor || 0)
      const yCeil = y0 + ceiling0 + 0.02
      // Conduit from panel up wall to ceiling, across ceiling along wall, then down wall to switch
      addPipeSegment(THREE, group, [pOrigin[0], pOrigin[1] + 0.2, pOrigin[2]], [pOrigin[0], yCeil, pOrigin[2]], 0.011, conduitMat)
      addPipeSegment(THREE, group, [pOrigin[0], yCeil, pOrigin[2]], [sw.u, yCeil, pOrigin[2]], 0.011, conduitMat)
      addPipeSegment(THREE, group, [sw.u, yCeil, pOrigin[2]], [sw.u, yCeil, sw.v], 0.011, conduitMat)
      addPipeSegment(THREE, group, [sw.u, yCeil, sw.v], [sw.u, sw.y, sw.v], 0.011, conduitMat)
      const b = new THREE.Mesh(boxGeo, box4x2Mat)
      b.position.set(sw.u, sw.y, sw.v)
      group.add(b)
    }
    for (const out of elec.outlets ?? []) {
      const y0 = floorY0(out.floor || 0)
      const yCeil = y0 + ceiling0 + 0.02
      addPipeSegment(THREE, group, [pOrigin[0], pOrigin[1] + 0.2, pOrigin[2]], [pOrigin[0], yCeil, pOrigin[2]], 0.011, conduitMat)
      addPipeSegment(THREE, group, [pOrigin[0], yCeil, pOrigin[2]], [out.u, yCeil, pOrigin[2]], 0.011, conduitMat)
      addPipeSegment(THREE, group, [out.u, yCeil, pOrigin[2]], [out.u, yCeil, out.v], 0.011, conduitMat)
      addPipeSegment(THREE, group, [out.u, yCeil, out.v], [out.u, out.y, out.v], 0.011, conduitMat)
      const b = new THREE.Mesh(boxGeo, box4x2Mat)
      b.position.set(out.u, out.y, out.v)
      group.add(b)
    }
  }

  return group
}
