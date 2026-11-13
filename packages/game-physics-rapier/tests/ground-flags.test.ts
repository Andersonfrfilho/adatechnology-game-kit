import { it } from 'vitest'
import * as RD from '@dimforge/rapier3d-deterministic-compat'

/** Thin plates dropped in random poses onto a smooth bowl: how many go through, how many stay up (|v| ~ 0 but well above the ground), per ground flag and box shape. */
it('tunnel rate', async () => {
  const R = RD
  await R.init()
  const bowl = (x: number, z: number): number => { const d = Math.hypot(x, z); return d < 1.2 ? -0.25 * (1 - (d / 1.2) ** 2) : 0 }
  let s = 12345
  const rnd = (): number => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
  const poses = Array.from({ length: 64 }, () => {
    const q = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]
    const l = Math.hypot(...q)
    return { x: (rnd() - 0.5) * 1.2, z: (rnd() - 0.5) * 1.2, q: q.map((v) => v / l) }
  })
  for (const flag of ['fix', 'none']) for (const shape of ['cuboid', 'round2mm', 'round5mm']) for (const ground of ['heightfield', 'trimesh']) {
    let through = 0
    let hung = 0
    for (const p of poses) {
      const w = new R.World({ x: 0, y: -9.81, z: 0 })
      const n = 81
      if (ground === 'heightfield') {
        const h = new Float32Array(n * n)
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h[i + j * n] = bowl(-2 + (j * 4) / 80, -2 + (i * 4) / 80)
        w.createCollider(R.ColliderDesc.heightfield(80, 80, h, { x: 4, y: 1, z: 4 }, flag === 'fix' ? R.HeightFieldFlags.FIX_INTERNAL_EDGES : (0 as RD.HeightFieldFlags)))
      } else {
        const v: number[] = []
        const idx: number[] = []
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) v.push(-2 + (i * 4) / 80, bowl(-2 + (i * 4) / 80, -2 + (j * 4) / 80), -2 + (j * 4) / 80)
        for (let j = 0; j < 80; j++) for (let i = 0; i < 80; i++) { const a = j * n + i; idx.push(a, a + n, a + n + 1, a, a + n + 1, a + 1) }
        w.createCollider(R.ColliderDesc.trimesh(new Float32Array(v), new Uint32Array(idx), flag === 'fix' ? R.TriMeshFlags.FIX_INTERNAL_EDGES : (0 as RD.TriMeshFlags)))
      }
      const rb = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x, 0.4, p.z).setRotation({ x: p.q[0], y: p.q[1], z: p.q[2], w: p.q[3] }))
      const r = shape === 'round2mm' ? 0.002 : shape === 'round5mm' ? 0.005 : 0
      w.createCollider(r ? R.ColliderDesc.roundCuboid(0.317 - r, 0.152 - r, 0.02 - r, r) : R.ColliderDesc.cuboid(0.317, 0.152, 0.02), rb)
      for (let k = 0; k < 240; k++) w.step()
      const t = rb.translation()
      const g = bowl(t.x, t.z)
      if (t.y < g - 0.1) through++
      else if (t.y > g + 0.16) hung++
      w.free()
    }
    console.log(`${ground} ${flag} ${shape}: through ${through}/64, hung above ${hung}/64`)
  }
}, 120000)
