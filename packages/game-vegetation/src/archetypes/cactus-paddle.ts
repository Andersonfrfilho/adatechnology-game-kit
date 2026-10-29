import type { PaddleCactusSpec, Vec3 } from '../types'
import type { ArchResult, Ctx } from '../ctx'
import { add, mul, norm, rotAxis, TAU } from '../math'
import { jitter, mix, rgb, shade, tintFlesh, lighten } from '../color'
import { icoShell } from '../geometry/shell'
import { spineTuft } from '../geometry/spines'
import { blossom } from '../geometry/flower'
import { frameFromAxis, type Frame } from '../math'

interface Pad {
  center: Vec3
  dir: Vec3
  /** width axis */
  x: Vec3
  /** thickness axis */
  z: Vec3
  w: number
  l: number
  gen: number
  index: number
  parent?: number
  start: Vec3
}

export function generatePaddleCactus(spec: PaddleCactusSpec, ctx: Ctx): ArchResult {
  const rng = ctx.rng
  const dead = ctx.condition === 'dead'
  const over = ctx.condition === 'overgrown'
  const gens = (spec.generations ?? 3) + (over ? 1 : 0)
  const padL = (spec.padSize ?? 0.34) * (over ? 1.1 : 1)
  const base = tintFlesh(rgb(spec.color ?? 0x6c9f62), ctx.condition)
  const spineC = rgb(0xe9dfb8)
  const pads: Pad[] = []
  const frng = rng.fork('decor')

  const mkFrame = (dir: Vec3, twist: number): { x: Vec3; z: Vec3 } => {
    const f = frameFromAxis([0, 0, 0], dir, twist)
    return { x: f.x, z: f.z }
  }
  const addPad = (start: Vec3, dir: Vec3, scale: number, gen: number, twist: number, parent?: Pad): Pad => {
    const l = padL * scale * rng.range(0.9, 1.1)
    const w = l * rng.range(0.62, 0.78)
    const d = norm(dir)
    const { x, z } = mkFrame(d, twist)
    const p: Pad = { center: add(start, mul(d, l * 0.46)), dir: d, x, z, w, l, gen, index: pads.length, parent: parent?.index, start }
    pads.push(p)
    return p
  }
  const root = addPad([0, 0, 0], [rng.range(-0.15, 0.15), 1, rng.range(-0.15, 0.15)], 1.15, 0, rng.range(0, TAU))
  let frontier: Pad[] = [root]
  for (let g = 1; g < gens; g++) {
    const next: Pad[] = []
    for (const p of frontier) {
      const kids = g === 1 ? rng.int(2, 3) : rng.int(1, 3)
      for (let k = 0; k < kids; k++) {
        // attach near the upper edge; tilt sideways around the pad's thickness axis, with a little twist
        const side = kids === 1 ? rng.sign() : (k / (kids - 1)) * 2 - 1
        const ang = side * rng.range(0.5, 0.95)
        let nd = rotAxis(p.dir, p.z, ang)
        nd = rotAxis(nd, p.dir, rng.range(-0.4, 0.4))
        nd = norm(add(nd, [0, 0.25, 0]))
        if (dead) nd = norm(add(nd, [0, -0.7, 0]))
        const start = add(add(p.center, mul(p.dir, p.l * 0.42)), mul(p.x, side * p.w * 0.28))
        next.push(addPad(start, nd, 0.86 - g * 0.04, g, rng.range(0, TAU), p))
      }
    }
    frontier = next
  }
  const maxGen = ctx.lod === 2 ? 1 : 99
  const detail = (ctx.lod === 0 ? 1 : 0) as 0 | 1
  for (const p of pads) {
    if (p.gen > maxGen) continue
    ctx.piece(`pad${p.index}`, 'pad', p.parent === undefined ? undefined : `pad${p.parent}`, p.start)
    ctx.pieceGeom(`pad${p.index}`, { radius: p.l * 0.085, length: p.l, axis: p.dir, base: p.start })
    const frame: Frame = { o: p.center, x: p.x, y: p.dir, z: p.z }
    const c = jitter(base, rng.fork(p.gen * 31 + Math.floor(p.l * 1000)), 0.012, 0.05, 0.04)
    icoShell(ctx.foliage, {
      center: p.center,
      frame,
      radii: [p.w * 0.5, p.l * 0.5, p.l * 0.085],
      detail,
      rng: rng.fork(Math.floor(p.l * 997) + p.gen),
      noise: 0.04,
      color: (v) => {
        const edge = 1 - Math.abs(v.dir[2])
        let k = 0.72 + 0.34 * v.h
        k *= 0.9 + 0.2 * edge
        const col = shade(c, k)
        return p.gen === 0 ? mix(col, shade(c, 0.6), Math.max(0, 0.5 - v.h) * 0.8) : mix(col, lighten(c, 0.5), Math.max(0, v.h - 0.8))
      },
      sway: () => 0,
    })
    if (ctx.lod === 0 && ctx.condition !== 'dead') {
      // areole tufts on both faces
      const n = 12
      for (let i = 0; i < n; i++) {
        const u = ((i % 4) + 0.5 + (Math.floor(i / 4) % 2) * 0.5) / 4.2 - 0.5
        const v = (Math.floor(i / 4) + 0.5) / 3 - 0.5
        const face = i % 2 ? 1 : -1
        const px = u * p.w * 0.78
        const py = v * p.l * 0.8
        const pz = face * p.l * 0.085 * Math.sqrt(Math.max(0, 1 - (px / (p.w * 0.5)) ** 2 - (py / (p.l * 0.5)) ** 2)) * 1.04
        const pos = add(add(add(p.center, mul(p.x, px)), mul(p.dir, py)), mul(p.z, pz))
        const nrm = add(mul(p.z, face), [0, 0.1, 0])
        spineTuft(ctx.spines, pos, nrm, 3, p.l * 0.1, spineC, frng)
      }
    }
  }
  // fruit and flowers on the rim of the outer pads
  const outer = pads.filter((p) => p.gen >= gens - 1 || p.gen >= 2)
  if (spec.fruit && !dead && ctx.lod < 2) {
    const fc = rgb(spec.fruit.color)
    for (let i = 0; i < spec.fruit.count; i++) {
      const p = outer[i % Math.max(1, outer.length)] ?? root
      const side = frng.sign()
      const pos = add(add(p.center, mul(p.dir, p.l * 0.5 * 0.92)), mul(p.x, side * p.w * frng.range(0, 0.28)))
      const r = padL * 0.1
      ctx.fruitItem(() => icoShell(ctx.fruit, { center: add(pos, mul(p.z, r * 0.2)), radii: [r * 0.8, r * 1.15, r * 0.8], detail: 0, rng: frng, noise: 0.05, color: (v) => mix(shade(fc, 0.7), lighten(fc, 0.4), v.h), sway: () => 0 }))
    }
  }
  if (spec.flowers && !dead && ctx.lod === 0) {
    const fc = rgb(spec.flowers.color)
    for (let i = 0; i < spec.flowers.count; i++) {
      const p = outer[(i * 3 + 1) % Math.max(1, outer.length)] ?? root
      ctx.piece(`pad${p.index}`, 'pad', p.parent === undefined ? undefined : `pad${p.parent}`, p.start)
      const pos = add(add(p.center, mul(p.dir, p.l * 0.5 * 0.9)), mul(p.x, frng.range(-0.25, 0.25) * p.w))
      blossom(ctx.flowers, add(pos, mul(p.z, p.l * 0.04)), norm(add(p.dir, mul(p.z, 0.5))), padL * 0.16, fc, [0.9, 0.5, 0.2], 0, 6, frng.range(0, TAU))
    }
  }
  return { collider: { kind: 'cylinder', radius: padL * 0.12, height: padL * 1.2 }, bendable: false, thorny: true, foliageMaterial: 'cactus' }
}
