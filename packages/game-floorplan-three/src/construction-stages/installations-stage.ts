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

  const bermW = 0.08
  const bermH = 0.045
  const troughH = 0.02

  if (isAlongX) {
    const len = Math.max(0.06, maxX - minX)
    const midX = (minX + maxX) / 2
    const midZ = a[1]

    // 1. Recessed dark bottom trough
    const trough = new THREE.Mesh(new THREE.BoxGeometry(len, troughH, trenchWidth), troughMat)
    trough.position.set(midX, -0.005, midZ)
    trough.receiveShadow = true
    parent.add(trough)

    // 2. Left side mound of excavated dirt
    const leftMound = new THREE.Mesh(new THREE.BoxGeometry(len + bermW, bermH, bermW), moundMat)
    leftMound.position.set(midX, bermH / 2, midZ - trenchWidth / 2 - bermW / 2)
    leftMound.castShadow = true
    leftMound.receiveShadow = true
    parent.add(leftMound)

    // 3. Right side mound of excavated dirt
    const rightMound = new THREE.Mesh(new THREE.BoxGeometry(len + bermW, bermH, bermW), moundMat)
    rightMound.position.set(midX, bermH / 2, midZ + trenchWidth / 2 + bermW / 2)
    rightMound.castShadow = true
    rightMound.receiveShadow = true
    parent.add(rightMound)
  } else {
    const len = Math.max(0.06, maxZ - minZ)
    const midX = a[0]
    const midZ = (minZ + maxZ) / 2

    // 1. Recessed dark bottom trough
    const trough = new THREE.Mesh(new THREE.BoxGeometry(trenchWidth, troughH, len), troughMat)
    trough.position.set(midX, -0.005, midZ)
    trough.receiveShadow = true
    parent.add(trough)

    // 2. Left side mound of excavated dirt
    const leftMound = new THREE.Mesh(new THREE.BoxGeometry(bermW, bermH, len + bermW), moundMat)
    leftMound.position.set(midX - trenchWidth / 2 - bermW / 2, bermH / 2, midZ)
    leftMound.castShadow = true
    leftMound.receiveShadow = true
    parent.add(leftMound)

    // 3. Right side mound of excavated dirt
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
  const bermW = 0.07
  const bermH = 0.04
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(size, 0.02, size), troughMat)
  bottom.position.set(x, -0.005, z)
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
    if (w.floor !== targetFloor) continue
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

function routeAlongWalls(
  walls: readonly HouseWall[],
  from: readonly [number, number],
  to: readonly [number, number],
): readonly [number, number][] {
  if (Math.hypot(from[0] - to[0], from[1] - to[1]) < 1e-3) return [from]
  // Intermediate corners
  const c1: [number, number] = [to[0], from[1]]
  const c2: [number, number] = [from[0], to[1]]
  const p1 = nearestWallPoint(walls, c1[0], c1[1], 0)
  const p2 = nearestWallPoint(walls, c2[0], c2[1], 0)
  const d1 = Math.hypot(c1[0] - p1[0], c1[1] - p1[1])
  const d2 = Math.hypot(c2[0] - p2[0], c2[1] - p2[1])
  if (d1 <= d2) {
    return [from, c1, to]
  }
  return [from, c2, to]
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
    const yHeader = floorY0(0) + ceiling0 + 0.02

    // Nearest wall to water tank where distribution header enters the wall system
    const tankWall = nearestWallPoint(plan.walls, tankPos[0], tankPos[2], 0)

    // Tank vertical downpipe to header plane, then connects directly to nearest wall
    if (tankPos[1] > yHeader + 0.02) {
      addPipeSegment(THREE, group, tankPos, [tankPos[0], yHeader, tankPos[2]], 0.025, coldWaterMat)
    }
    // Header pipe from tank position to wall entrance
    addPipeSegment(THREE, group, [tankPos[0], yHeader, tankPos[2]], [tankWall[0], yHeader, tankWall[1]], 0.02, coldWaterMat)

    const sewerMainX = tankPos[0]
    let minV = Infinity
    for (const pt of plumbing.points) {
      const y0 = floorY0(pt.floor)
      const [wU, wV] = nearestWallPoint(plan.walls, pt.u, pt.v, pt.floor)

      // 1. Cold water line:
      // Routes along the wall network at yHeader (inside top beam/attic plane), making 90-degree turns
      const wallPath = routeAlongWalls(plan.walls, tankWall, [wU, wV])
      for (let i = 0; i + 1 < wallPath.length; i++) {
        const pA = wallPath[i]!
        const pB = wallPath[i + 1]!
        addPipeSegment(THREE, group, [pA[0], yHeader, pA[1]], [pB[0], yHeader, pB[1]], 0.015, coldWaterMat)
      }
      // Vertical distribution column drops inside the wall core down to the tap/fixture height
      addPipeSegment(THREE, group, [wU, yHeader, wV], [wU, y0 + pt.y, wV], 0.015, coldWaterMat)
      // Short horizontal stub from wall to fixture terminal
      addPipeSegment(THREE, group, [wU, y0 + pt.y, wV], [pt.u, y0 + pt.y, pt.v], 0.015, coldWaterMat)
      // Brass tap fitting at fixture
      const jointGeo = new THREE.SphereGeometry(0.025, 8, 8)
      const fitting = new THREE.Mesh(jointGeo, brassMat)
      fitting.position.set(pt.u, y0 + pt.y, pt.v)
      group.add(fitting)

      // 2. Sewer & Drainage:
      if (pt.kind === 'toilet' || pt.kind === 'sink' || pt.kind === 'shower' || pt.kind === 'laundry_tub' || pt.kind === 'washing_machine') {
        const drainR = pt.kind === 'toilet' ? 0.05 : 0.025
        const ySewer = 0.015
        // Fixture vertical drain down into the ground pit
        addPipeSegment(THREE, group, [pt.u, y0 + Math.max(0.12, pt.y * 0.45), pt.v], [pt.u, ySewer, pt.v], drainR, sewerMat)
        // Excavated pit at the base of fixture drop
        addExcavatedPit(THREE, group, pt.u, pt.v, 0.28, troughMat, moundMat)
        // Underground pipe nestled in trench to main collector
        addPipeSegment(THREE, group, [pt.u, ySewer, pt.v], [sewerMainX, ySewer, pt.v], drainR, sewerMat)
        // Excavated ground trench with raised dirt mounds along the pipe run
        addExcavatedTrench(THREE, group, [pt.u, pt.v], [sewerMainX, pt.v], Math.max(0.24, drainR * 4), troughMat, moundMat)

        // Traps & inspection chambers
        if (pt.kind === 'sink') {
          // Grease trap (caixa de gordura) outside kitchen
          addInspectionChamber(THREE, group, (pt.u + sewerMainX) / 2, 0, pt.v, 0.40, 0.16, concreteMat, box4x2Mat, moundMat)
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
      const ySewer = 0.015
      // Main underground collector running forward to street alignment inside the trench
      addPipeSegment(THREE, group, [sewerMainX, ySewer, minV], [sewerMainX, ySewer, frontV], 0.05, sewerMat)
      addExcavatedTrench(THREE, group, [sewerMainX, minV], [sewerMainX, frontV], 0.32, troughMat, moundMat)
      // Building inspection chamber (caixa de inspeção predial) on the front lot
      addInspectionChamber(THREE, group, sewerMainX, 0, frontV, 0.52, 0.20, concreteMat, box4x2Mat, moundMat)
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
