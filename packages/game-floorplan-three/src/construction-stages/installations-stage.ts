import type * as THREE_NS from 'three'
import type { HouseRecord, Three } from '../kernel-types.js'

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
  parent.add(mesh)
}

function addOrthogonalRun(
  THREE: Three,
  parent: THREE_NS.Group,
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  yHeader: number,
  radius: number,
  mat: THREE_NS.Material,
  jointMat: THREE_NS.Material,
): void {
  const p0: [number, number, number] = [from[0], from[1], from[2]]
  const p1: [number, number, number] = [from[0], yHeader, from[2]]
  const p2: [number, number, number] = [to[0], yHeader, from[2]]
  const p3: [number, number, number] = [to[0], yHeader, to[2]]
  const p4: [number, number, number] = [to[0], to[1], to[2]]
  const pts = [p0, p1, p2, p3, p4]
  for (let i = 0; i + 1 < pts.length; i++) {
    addPipeSegment(THREE, parent, pts[i]!, pts[i + 1]!, radius, mat)
  }
  const jointGeo = new THREE.SphereGeometry(radius * 1.45, 8, 8)
  for (const pt of [p1, p2, p3, p4]) {
    const j = new THREE.Mesh(jointGeo, jointMat)
    j.position.set(pt[0], pt[1], pt[2])
    parent.add(j)
  }
}

export function buildInstallationsStage(THREE: Three, plan: HouseRecord): THREE_NS.Group {
  const group = new THREE.Group()
  group.name = 'stage:4:installations'

  const coldWaterMat = new THREE.MeshStandardMaterial({ color: 0xb57c48, roughness: 0.55 })
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.4, metalness: 0.7 })
  const sewerMat = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.65 })
  const conduitMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.6 })
  const box4x2Mat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 })

  const floorY0 = (f: number): number => {
    const fl = plan.floors.find((x) => x.index === f)
    return fl ? fl.y0 : f * 2.9
  }

  const plumbing = plan.utilities?.plumbing
  if (plumbing) {
    const tk = plan.waterTank
    const tankPos: [number, number, number] = tk && Number.isFinite(tk.u) && Number.isFinite(tk.y) && Number.isFinite(tk.v)
      ? [tk.u, tk.y + 0.15, tk.v]
      : [(plan.w || 8) / 2, floorY0(plan.floors.length - 1) + 2.8, (plan.d || 6) / 2]

    const sewerMainX = tankPos[0]
    let minV = Infinity
    for (const pt of plumbing.points) {
      const y0 = floorY0(pt.floor)
      const yHeader = y0 + 2.15
      addOrthogonalRun(
        THREE,
        group,
        tankPos,
        [pt.u, y0 + pt.y, pt.v],
        yHeader,
        0.015,
        coldWaterMat,
        brassMat,
      )
      if (pt.kind === 'toilet' || pt.kind === 'sink' || pt.kind === 'shower' || pt.kind === 'laundry_tub' || pt.kind === 'washing_machine') {
        const drainR = pt.kind === 'toilet' ? 0.05 : 0.025
        addPipeSegment(THREE, group, [pt.u, y0 + 0.03, pt.v], [pt.u, y0 + Math.max(0.12, pt.y * 0.45), pt.v], drainR, sewerMat)
        addPipeSegment(THREE, group, [pt.u, y0 + 0.03, pt.v], [sewerMainX, y0 + 0.03, pt.v], drainR, sewerMat)
        minV = Math.min(minV, pt.v)
      }
    }
    if (Number.isFinite(minV)) {
      const frontV = (plan.lot?.rect?.[1] ?? -1.5) + 0.6
      addPipeSegment(THREE, group, [sewerMainX, 0.03, minV], [sewerMainX, 0.03, frontV], 0.05, sewerMat)
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.45), box4x2Mat)
      box.position.set(sewerMainX, 0.07, frontV)
      group.add(box)
    }
  }

  const elec = plan.utilities?.electrical
  if (elec && elec.panel) {
    const Q = elec.panel
    const pOrigin: [number, number, number] = [Q.u, Q.y, Q.v]
    const boxGeo = new THREE.BoxGeometry(0.08, 0.12, 0.05)

    for (const sw of elec.switches ?? []) {
      const y0 = floorY0(sw.floor || 0)
      addOrthogonalRun(THREE, group, pOrigin, [sw.u, sw.y, sw.v], y0 + 2.45, 0.011, conduitMat, box4x2Mat)
      const b = new THREE.Mesh(boxGeo, box4x2Mat)
      b.position.set(sw.u, sw.y, sw.v)
      group.add(b)
    }
    for (const out of elec.outlets ?? []) {
      const y0 = floorY0(out.floor || 0)
      addOrthogonalRun(THREE, group, pOrigin, [out.u, out.y, out.v], y0 + 2.45, 0.011, conduitMat, box4x2Mat)
      const b = new THREE.Mesh(boxGeo, box4x2Mat)
      b.position.set(out.u, out.y, out.v)
      group.add(b)
    }
  }

  return group
}
