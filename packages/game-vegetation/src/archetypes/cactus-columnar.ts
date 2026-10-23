import type { ColumnarCactusSpec, Vec3 } from '../types'
import type { ArchResult, Ctx } from '../ctx'
import { TAU, add, catmull, dirFromAngles, lerp, mul, norm } from '../math'
import { mix, rgb, shade, tintFlesh, lighten } from '../color'
import { ribbedTube } from '../geometry/tube'
import { spineTuft, areole } from '../geometry/spines'
import { flowerHead } from '../geometry/flower'

export function generateColumnarCactus(spec: ColumnarCactusSpec, ctx: Ctx): ArchResult {
  const rng = ctx.rng
  const srng = rng.fork('spines')
  const dead = ctx.condition === 'dead'
  const dry = ctx.condition === 'dry'
  const over = ctx.condition === 'overgrown'
  const H = (spec.height ?? 3.2) * (over ? 1.1 : 1)
  const R = spec.radius ?? H * 0.055
  const ribsFull = spec.ribs ?? 10
  const ribs = ctx.pick(ribsFull, Math.max(6, Math.round(ribsFull * 0.7)), Math.min(5, ribsFull))
  const style = spec.armStyle ?? 'candelabra'
  const armsSpec = spec.arms ?? [2, 4]
  const arms = (Array.isArray(armsSpec) ? rng.int(armsSpec[0], armsSpec[1]) : armsSpec) + (over ? 1 : 0)
  const base = tintFlesh(rgb(spec.color ?? 0x5f9a78), ctx.condition)
  const spineC = rgb(spec.spineColor ?? 0xe6dcb4)
  const slump = dead ? 0.22 : dry ? 0.05 : 0
  const rings = ctx.pick(1, 0.7, 0.45)
  const domeSteps = ctx.pick(2, 1, 1)
  const spineOn = ctx.lod === 0 && ctx.condition !== 'dead' ? 1 : ctx.lod === 0 ? 0.5 : 0

  const bodyColor = (t: number, ridge: boolean, rib: number): Vec3 => {
    let k = ridge ? 1.05 : 0.7
    if (rib % 2 === 0) k *= 1.04
    const c = shade(base, k * (0.78 + 0.28 * Math.min(1, t * 1.4)))
    return mix(c, lighten(base, 0.8), Math.max(0, t - 0.8) * 1.4 * (ridge ? 1 : 0.5))
  }
  const info: { tipPos: Vec3; tipDir: Vec3; r: number }[] = []

  const column = (path: Vec3[], radiusAt: (t: number) => number, seedK: number, withSpines: boolean): void => {
    const radii = path.map((_, i) => radiusAt(i / (path.length - 1)))
    const res = ribbedTube(ctx.foliage, path, {
      ribs,
      radii,
      valley: 0.74,
      dome: domeSteps,
      color: (t, ridge, rib) => bodyColor(t, ridge, rib + seedK),
      sway: () => 0,
      rough: (ring, rib) => Math.sin(ring * 1.7 + rib * 2.3 + seedK) * 0.03,
    })
    const last = path[path.length - 1]
    const prev = path[path.length - 2]
    info.push({ tipPos: add(last, mul(norm([last[0] - prev[0], last[1] - prev[1], last[2] - prev[2]]), radii[radii.length - 1] * 0.9)), tipDir: norm([last[0] - prev[0], last[1] - prev[1], last[2] - prev[2]]), r: radii[radii.length - 1] })
    if (withSpines && spineOn > 0) {
      for (const rd of res.ridges) {
        if (rd.ring === 0 || rd.ring % 3 !== 1) continue
        if (srng.next() > spineOn) continue
        areole(ctx.spines, rd.p, rd.n, R * 0.09, [0.25, 0.2, 0.15])
        spineTuft(ctx.spines, rd.p, add(rd.n, [0, 0.15, 0]), 3, R * 0.55, spineC, srng)
      }
    }
  }

  // main trunk (slightly sinuous, slumped when dead)
  const nCtrl = 5
  const ctrl: Vec3[] = []
  const lean = rng.range(-0.04, 0.04) * H
  for (let i = 0; i < nCtrl; i++) {
    const t = i / (nCtrl - 1)
    ctrl.push([lean * t + slump * H * t * t, H * t, Math.sin(t * 3 + rng.range(0, 1)) * 0.015 * H])
  }
  const mainPath = catmull(ctrl, Math.max(1, Math.round(2 * rings)))
  const mainR = (t: number): number => R * (1 + 0.35 * Math.exp(-t * 18)) * (1 - 0.08 * t) * (t > 0.92 ? 1 - (t - 0.92) * 1.5 : 1)
  column(mainPath, mainR, 0, true)
  const at = (t: number): { p: Vec3; r: number } => {
    const f = t * (mainPath.length - 1)
    const i = Math.min(mainPath.length - 2, Math.floor(f))
    const u = f - i
    return { p: [lerp(mainPath[i][0], mainPath[i + 1][0], u), lerp(mainPath[i][1], mainPath[i + 1][1], u), lerp(mainPath[i][2], mainPath[i + 1][2], u)], r: mainR(t) }
  }

  // arms
  for (let a = 0; a < arms; a++) {
    const az = (a / arms) * TAU + rng.range(-0.5, 0.5)
    const out = dirFromAngles(az, 0)
    let t0: number
    let outLen: number
    let upLen: number
    let rise: number
    switch (style) {
      case 'saguaro':
        t0 = rng.range(0.35, 0.6)
        outLen = H * rng.range(0.12, 0.2)
        upLen = H * rng.range(0.25, 0.4)
        rise = 0.1
        break
      case 'sprawl':
        t0 = rng.range(0.02, 0.2)
        outLen = H * rng.range(0.3, 0.6)
        upLen = H * rng.range(0.25, 0.5)
        rise = 0.35
        break
      default:
        t0 = rng.range(0.45, 0.75)
        outLen = H * rng.range(0.08, 0.15)
        upLen = H * rng.range(0.28, 0.42)
        rise = 0.25
    }
    const s = at(t0)
    const start = add(s.p, mul(out, s.r * 0.3))
    const p1 = add(start, add(mul(out, outLen * 0.7), [0, outLen * rise, 0]))
    const p2 = add(start, add(mul(out, outLen), [0, outLen * rise + upLen * 0.18, 0]))
    let p3 = add(p2, add(mul(out, outLen * 0.15), [0, upLen, 0]))
    if (dead) p3 = add(p2, add(mul(out, upLen * 0.7), [0, upLen * 0.25, 0]))
    ctx.piece(`arm${a}`, 'arm', 'stem', start)
    const armPath = catmull([start, p1, p2, p3], Math.max(1, Math.round(2 * rings)))
    const ar = s.r * (style === 'sprawl' ? 0.9 : 0.72)
    column(armPath, (t) => ar * (t > 0.9 ? 1 - (t - 0.9) * 1.6 : 1) * (t < 0.12 ? 0.85 + t * 1.2 : 1), a + 1, true)
  }

  ctx.piece('stem', 'stem')
  const frng = rng.fork('flowers')
  // flowers (night bloom, white trumpets) at the tips
  if (spec.flowers && !dead && ctx.lod < 2) {
    const fc = rgb(spec.flowers.color)
    const count = spec.flowers.count ?? 1
    for (let i = 0; i < info.length; i++) {
      for (let k = 0; k < count; k++) {
        if (frng.next() > 0.8) continue
        const tip = info[i]
        const ax = norm(add(tip.tipDir, [rng.range(-0.5, 0.5), 0.2, rng.range(-0.5, 0.5)]))
        flowerHead(ctx.flowers, { kind: 'trumpet', center: add(tip.tipPos, mul(tip.tipDir, -tip.r * 0.3)), axis: ax, size: R * 1.5, colors: [fc, shade(fc, 0.92)], centerColor: [0.95, 0.85, 0.4], rng: rng.fork(i * 7 + k), lod: ctx.lod, sway: 0 })
      }
    }
  }
  return { collider: { kind: 'cylinder', radius: R * 1.1, height: H * 0.9 }, bendable: false, thorny: true, foliageMaterial: 'cactus' }
}
