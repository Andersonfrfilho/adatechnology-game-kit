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

function addTrench(
  THREE: Three,
  parent: THREE_NS.Group,
  a: readonly [number, number],
  b: readonly [number, number],
  width: number,
  mat: THREE_NS.Material,
): void {
  const minX = Math.min(a[0], b[0]) - width / 2
  const maxX = Math.max(a[0], b[0]) + width / 2
  const minZ = Math.min(a[1], b[1]) - width / 2
  const maxZ = Math.max(a[1], b[1]) + width / 2
  const sx = Math.max(0.04, maxX - minX)
  const sz = Math.max(0.04, maxZ - minZ)
  const depth = 0.05
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, depth, sz), mat)
  mesh.position.set((minX + maxX) / 2, -0.015, (minZ + maxZ) / 2)
  mesh.receiveShadow = true
  parent.add(mesh)
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
): void {
  const body = new THREE.Mesh(new THREE.BoxGeometry(size, height, size), concreteMat)
  body.position.set(x, y + height / 2, z)
  parent.add(body)
  const lid = new THREE.Mesh(new THREE.BoxGeometry(size + 0.04, 0.03, size + 0.04), lidMat)
  lid.position.set(x, y + height + 0.015, z)
  parent.add(lid)
}

export function buildInstallationsStage(THREE: Three, plan: HouseRecord): THREE_NS.Group {
  const group = new THREE.Group()
  group.name = 'stage:4:installations'

  const coldWaterMat = new THREE.MeshStandardMaterial({ color: 0x9e5b32, roughness: 0.55 })
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.4, metalness: 0.7 })
  const sewerMat = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.65 })
  const trenchMat = new THREE.MeshStandardMaterial({ color: 0x362214, roughness: 0.98 })
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
    const yAttic = floorY0(0) + ceiling0 + 0.05

    // Tank vertical downpipe to the attic horizontal distribution header plane
    if (tankPos[1] > yAttic + 0.02) {
      addPipeSegment(THREE, group, tankPos, [tankPos[0], yAttic, tankPos[2]], 0.025, coldWaterMat)
    }

    const sewerMainX = tankPos[0]
    let minV = Infinity
    for (const pt of plumbing.points) {
      const y0 = floorY0(pt.floor)
      const [wU, wV] = nearestWallPoint(plan.walls, pt.u, pt.v, pt.floor)

      // 1. Cold water line:
      // Routed strictly inside attic space (yAttic) above ceiling, avoiding room living space
      addPipeSegment(THREE, group, [tankPos[0], yAttic, tankPos[2]], [wU, yAttic, tankPos[2]], 0.015, coldWaterMat)
      addPipeSegment(THREE, group, [wU, yAttic, tankPos[2]], [wU, yAttic, wV], 0.015, coldWaterMat)
      // Vertical distribution column drops inside/against the wall down to the tap/fixture height
      addPipeSegment(THREE, group, [wU, yAttic, wV], [wU, y0 + pt.y, wV], 0.015, coldWaterMat)
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
        const ySewer = 0.035
        // Fixture vertical drain down to ground
        addPipeSegment(THREE, group, [pt.u, y0 + Math.max(0.12, pt.y * 0.45), pt.v], [pt.u, ySewer, pt.v], drainR, sewerMat)
        // Underground pipe to main collector
        addPipeSegment(THREE, group, [pt.u, ySewer, pt.v], [sewerMainX, ySewer, pt.v], drainR, sewerMat)
        // Excavated ground trench along the pipe run
        addTrench(THREE, group, [pt.u, pt.v], [sewerMainX, pt.v], Math.max(0.22, drainR * 4), trenchMat)

        // Traps & inspection chambers
        if (pt.kind === 'sink') {
          // Grease trap (caixa de gordura) outside kitchen
          addInspectionChamber(THREE, group, (pt.u + sewerMainX) / 2, 0, pt.v, 0.40, 0.16, concreteMat, box4x2Mat)
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
      const ySewer = 0.035
      // Main underground collector running forward to street alignment
      addPipeSegment(THREE, group, [sewerMainX, ySewer, minV], [sewerMainX, ySewer, frontV], 0.05, sewerMat)
      addTrench(THREE, group, [sewerMainX, minV], [sewerMainX, frontV], 0.32, trenchMat)
      // Building inspection chamber (caixa de inspeção predial) on the front lot
      addInspectionChamber(THREE, group, sewerMainX, 0, frontV, 0.52, 0.20, concreteMat, box4x2Mat)
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
      // Conduit from panel up wall to ceiling, across ceiling, then down wall to switch
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
