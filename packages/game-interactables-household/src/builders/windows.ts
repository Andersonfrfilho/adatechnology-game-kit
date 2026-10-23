import type { Ctx } from '../ctx'
import { round3, shade } from '../util'

/** Tilt of a closed slat: 80 degrees from horizontal, so neighbours overlap and the blind blocks the view. */
const SLAT_TILT = 1.4

/**
 * Horizontal slat blinds. Every slat is its own part (`slat_1`... hinged around x) and all of them share the group `tilt`, so one
 * interaction tilts the whole pack: t = 0 is closed (slats nearly vertical and overlapping), t = 1 is open (slats horizontal). The
 * separate `raise` part (scale along y) lifts the cord, rail and pull. The host animates parts as flat groups, so the slats themselves
 * do not stack when raised.
 */
export function blinds(c: Ctx): void {
  const { hw, hd, h, y0, w } = c
  const wood = c.M.variant === 'wood'
  const col = c.main(wood ? 0xb08a58 : 0xe8e6de)
  const head = 0.06
  const foot = 0.025
  const yTop = y0 + h
  // head rail with a small valance and the mounting brackets
  c.b('plain', -hw, yTop - head, -hd, hw, yTop, hd, shade(col, 0.8))
  c.b('plain', -hw + 0.01, yTop - head - 0.01, -hd + 0.008, hw - 0.01, yTop - head, hd - 0.008, shade(col, 0.7))
  // slats: thin boards drawn tilted, each hinged around its own axis
  const chord = 0.05
  const pitch = 0.035
  const first = yTop - head - 0.03
  const n = Math.max(3, Math.floor((first - (y0 + foot + 0.03)) / pitch) + 1)
  const tiltT0 = c.M.variant === 'closed' ? 0 : 1
  for (let i = 0; i < n; i++) {
    const y = round3(first - i * pitch)
    c.part(
      `slat_${i + 1}`, [0, y, 0], { kind: 'hinge', axis: [1, 0, 0], angle: -SLAT_TILT, speed: 1.8 },
      () => c.box(wood ? 'wood' : 'plain', 0, y - 0.003, 0, w - 0.02, 0.006, chord, i % 2 ? col : shade(col, 0.97), 0, SLAT_TILT),
      { t0: tiltT0, noSweep: true, at: false, group: 'tilt' },
    )
  }
  c.toggle('slat_1', [0, round3(y0 + h * 0.5), hd], 'prompt.blinds_tilt', 1.8)
  // cord ladders, bottom rail and pull: they lift with the `raise` part
  const t0 = Math.min(1, Math.max(0, c.M.retracted ?? 0.15))
  c.part(
    'raise', [0, yTop - head, 0], { kind: 'scale', axis: [0, 1, 0], scale: 0.1 },
    () => {
      for (const sx of [-1, 1]) c.b('plain', sx * (hw - 0.05) - 0.004, y0 + foot, -0.004, sx * (hw - 0.05) + 0.004, yTop - head, 0.004, 0xb8b6ae) // ladder strings
      c.b('plain', -hw + 0.01, y0, -hd + 0.015, hw - 0.01, y0 + foot, hd - 0.015, shade(col, 0.75)) // bottom rail
      c.b('plain', -0.04, y0 - 0.0, hd - 0.014, 0.04, y0 + foot, hd - 0.012, 0x888a8c) // pull
    },
    { label: 'prompt.blinds', t0, at: [0, round3(y0 + 0.1), hd], radius: 1.8 },
  )
  // tilt wand + cord (decoration, reaches below the blind)
  c.cyl('plain', -hw + 0.03, yTop - head - 0.25, hd - 0.012, 0.004, 0.25, 0xc8c6be, 'cyl6')
  c.cyl('plain', hw - 0.03, y0 + 0.2, hd - 0.012, 0.0025, yTop - head - y0 - 0.2, 0xd8d6ce, 'cyl6')
  c.cyl('plain', hw - 0.03, y0 + 0.17, hd - 0.012, 0.007, 0.03, 0xb8b6ae, 'cyl6')
  c.spec.colliders = []
}

/**
 * Two curtain panels on a rod. Each panel is a soft curtain whose part scales along x (bunching toward its end). Pushing through a
 * panel drives its part, so the player never gets blocked.
 */
export function curtain(c: Ctx): void {
  const { hw, hd, h, y0, w } = c
  const cloth = c.fabric(0xb8a78a)
  const yTop = y0 + h
  const rodY = yTop - 0.04
  // rod, finials, brackets
  c.rod('metal', 'x', 0, rodY, 0, 0.01, w - 0.04, 0x6a5a40)
  for (const s of [-1, 1]) {
    c.cyl('metal', s * (hw - 0.02), rodY - 0.025, 0, 0.022, 0.05, 0x6a5a40, 'sphere')
    c.b('metal', s * (hw * 0.55) - 0.008, rodY - 0.02, -hd + 0.005, s * (hw * 0.55) + 0.008, rodY + 0.02, 0.0, 0x4a4030)
  }
  const pw = (w - 0.1) / 2
  const folds = 7
  const t0 = c.M.open === false ? 0 : 1
  for (const s of [-1, 1]) {
    const id = s < 0 ? 'panel_l' : 'panel_r'
    const xOuter = s * (hw - 0.04)
    c.part(
      id, [xOuter, yTop, 0], { kind: 'scale', axis: [1, 0, 0], scale: 0.22 },
      () => {
        const fw = pw / folds
        for (let i = 0; i < folds; i++) {
          const x0 = s < 0 ? xOuter + i * fw : xOuter - (i + 1) * fw
          const z = i % 2 ? 0.022 : -0.022
          c.b('fabric', x0, y0 + 0.02, z - 0.007, x0 + fw, yTop - 0.06, z + 0.007, i % 2 ? cloth : shade(cloth, 0.88))
        }
        for (let i = 0; i < folds; i++) c.cyl('metal', xOuter - s * (i + 0.5) * (pw / folds), rodY - 0.012, 0, 0.012, 0.008, 0x8a7a5a, 'cyl6', Math.PI / 2, 0) // rings
      },
      { label: 'prompt.curtain', t0, at: false, group: 'panels' },
    )
    c.add('soft', { id, kind: 'curtain', anchor: [round3(xOuter - s * pw / 2), round3(yTop - 0.06), 0], size: [round3(pw), round3(h - 0.06), 0.05], stiffness: 14, damping: 3, maxAngle: 0.5, wind: 0.6, part: id })
  }
  c.toggle('panel_l', [0, round3(y0 + h * 0.5), 0.05], 'prompt.curtain', 1.8) // one interaction moves both panels (group)
  c.spec.colliders = []
}
