import { describe, expect, it } from 'vitest'
import { CLOTH, GARMENT_KINDS, extentOf, garment, hanger, pegs, type Piece } from '../src/garments'
import { SEEDS, build, partPoints } from './helpers'

const overlap = (a: Piece, b: Piece) => Math.min(a.u + a.w / 2, b.u + b.w / 2) - Math.max(a.u - a.w / 2, b.u - b.w / 2) > 1e-6 && Math.min(a.v + a.h / 2, b.v + b.h / 2) - Math.max(a.v - a.h / 2, b.v - b.h / 2) > 1e-6

describe('garment geometry', () => {
  it.each(GARMENT_KINDS)('%s: thin boxes hanging below the line, measured size, no coplanar overlaps', (kind) => {
    const g = garment(kind, 0x3a6ab0)
    expect(g.pieces.length).toBeGreaterThan(4)
    for (const p of g.pieces) {
      expect(p.t, `${kind} ${p.role}`).toBeGreaterThanOrEqual(0.008)
      expect(p.t, `${kind} ${p.role}`).toBeLessThanOrEqual(0.03)
    }
    const e = extentOf(g.pieces)
    expect(e.top).toBeLessThanOrEqual(0)
    expect(g.height).toBeCloseTo(-e.bottom, 2)
    expect(g.width).toBeCloseTo(e.half * 2, 2)
    expect(g.height).toBeGreaterThan(0.2)
    // two flat pieces on the same layer and the same thickness never overlap (they would z-fight)
    const flat = g.pieces.filter((p) => !p.tilt)
    for (let i = 0; i < flat.length; i++) {
      for (let j = i + 1; j < flat.length; j++) {
        const a = flat[i]
        const b = flat[j]
        if ((a.n ?? 0) === (b.n ?? 0) && a.t === b.t) expect(overlap(a, b), `${kind}: ${a.role} / ${b.role}`).toBe(false)
      }
    }
    // a tilted piece is thinner than the body it overlaps, so the body hides it
    for (const p of g.pieces.filter((q) => q.tilt)) expect(p.t, `${kind} ${p.role}`).toBeLessThan(CLOTH + 1e-9)
  })

  it('t-shirt: body, two sleeves turned outwards, shoulders with a neck opening and a collar', () => {
    const g = garment('tshirt', 0xd24a3a)
    const sleeves = g.pieces.filter((p) => p.role === 'sleeve')
    expect(sleeves.length).toBe(2)
    expect(sleeves.map((s) => Math.sign(s.tilt!)).sort()).toEqual([-1, 1])
    for (const s of sleeves) {
      expect(Math.abs(s.tilt!)).toBeGreaterThan(0.6)
      expect(Math.sign(s.u)).toBe(Math.sign(s.tilt!)) // sleeves reach out and down on their own side
    }
    const shoulders = g.pieces.filter((p) => p.role === 'shoulder')
    expect(shoulders.length).toBe(2)
    expect(shoulders[0].u + shoulders[0].w / 2).toBeLessThan(shoulders[1].u - shoulders[1].w / 2 - 0.05) // the neck opening between them
    expect(g.pieces.some((p) => p.role === 'collar')).toBe(true)
    expect(g.width).toBeGreaterThan(0.5)
  })

  it('trousers: a waistband and two separate legs with a gap down to the hem', () => {
    const g = garment('trousers', 0x3a5a8a)
    const legs = g.pieces.filter((p) => p.role === 'leg').sort((a, b) => a.u - b.u)
    expect(legs.length).toBe(2)
    expect(legs[0].u + legs[0].w / 2).toBeLessThan(legs[1].u - legs[1].w / 2)
    expect(g.pieces.some((p) => p.role === 'waist')).toBe(true)
    expect(g.height).toBeGreaterThan(0.6)
    expect(g.width).toBeLessThan(0.4)
  })

  it('dress: straps, a bodice narrower than the hem and a skirt that only widens', () => {
    const g = garment('dress', 0xb04a9a)
    expect(g.pieces.filter((p) => p.role === 'strap').length).toBe(2)
    const skirt = g.pieces.filter((p) => p.role === 'skirt').sort((a, b) => b.v - a.v)
    expect(skirt.length).toBeGreaterThanOrEqual(5)
    for (let i = 1; i < skirt.length; i++) expect(skirt[i].w).toBeGreaterThan(skirt[i - 1].w)
    const bodice = g.pieces.find((p) => p.role === 'body')!
    expect(skirt[skirt.length - 1].w).toBeGreaterThan(bodice.w * 2.5)
  })

  it('towel: folded over the line (two layers), striped, with a fringe', () => {
    const g = garment('towel', 0x4aa06a)
    const layers = new Set(g.pieces.filter((p) => p.role === 'body').map((p) => p.n))
    expect(layers.size).toBe(2)
    expect(g.pieces.filter((p) => p.role === 'trim').length).toBeGreaterThanOrEqual(2)
    expect(g.pieces.filter((p) => p.role === 'fringe').length).toBeGreaterThanOrEqual(8)
  })

  it('socks: a pair, each with a cuff, a leg and a foot that turns outwards', () => {
    const g = garment('socks', 0xe0c030)
    expect(g.pieces.filter((p) => p.role === 'leg').length).toBe(2)
    const feet = g.pieces.filter((p) => p.role === 'foot')
    expect(feet.length).toBe(2)
    const legs = g.pieces.filter((p) => p.role === 'leg')
    for (const f of feet) {
      const leg = legs.find((l) => Math.sign(l.u) === Math.sign(f.u))!
      expect(Math.abs(f.u)).toBeGreaterThan(Math.abs(leg.u)) // the foot reaches outwards
      expect(f.v).toBeLessThan(leg.v)
    }
    expect(g.pieces.filter((p) => p.role === 'cuff').length).toBe(2)
  })

  it('a jacket is longer than a shirt, a long-sleeve shirt has narrow sleeves along the body', () => {
    const shirt = garment('shirt', 0xd8d0c0)
    expect(garment('jacket', 0xd8d0c0).height).toBeGreaterThan(shirt.height)
    expect(shirt.width).toBeLessThan(garment('tshirt', 0xd8d0c0).width)
    for (const s of shirt.pieces.filter((p) => p.role === 'sleeve')) expect(Math.abs(s.tilt!)).toBeLessThan(0.4)
  })

  it('pegs clip two to a garment over its top edge and are thicker than the cloth; hangers have a hook above the rod', () => {
    for (const kind of GARMENT_KINDS) {
      const g = garment(kind, 0xffffff)
      const p = pegs(g, 0xe8e0c8)
      expect(p.length).toBe(g.pegs.length * 2)
      for (const q of p) expect(q.t).toBeGreaterThan(CLOTH * 2)
      for (const u of g.pegs) expect(Math.abs(u)).toBeLessThan(g.width / 2)
    }
    const h = hanger(0.5)
    expect(Math.max(...h.map((q) => q.v + q.h / 2))).toBeGreaterThan(0.005)
    expect(h.every((q) => q.m === 'metal')).toBe(true)
  })
})

describe('clothes in the household objects', () => {
  it('clothesline: each cloth is a garment with pegs on the wire, neighbours do not overlap and the shapes differ', () => {
    for (const seed of SEEDS) {
      const b = build('clothesline', { seed })
      const wires = b.spec.wires!.filter((w) => w.id.startsWith('wire'))
      const widths = new Set<number>()
      const byWire = new Map<string, Array<[number, number]>>()
      for (const part of b.spec.parts!.filter((p) => p.id.startsWith('cloth'))) {
        const rec = b.rec.parts[part.id]
        const pegPrims = rec.primitives.filter((p) => p.kind === 'box' && p.material === 'plain')
        expect(pegPrims.length, `${part.id} pegs`).toBeGreaterThanOrEqual(2)
        // the pegs span the wire height (the part frame origin is the point on the wire)
        const lows = pegPrims.map((p) => (p.kind === 'box' ? p.y : 0))
        const highs = pegPrims.map((p) => (p.kind === 'box' ? p.y + p.h : 0))
        expect(Math.min(...lows), part.id).toBeLessThan(-0.02)
        expect(Math.max(...highs), part.id).toBeGreaterThan(0)
        const fabric = rec.primitives.filter((p) => p.kind === 'box' && p.material === 'fabric')
        expect(fabric.length, `${part.id} pieces`).toBeGreaterThanOrEqual(4)
        for (const p of fabric) if (p.kind === 'box') expect(p.d, `${part.id} thickness`).toBeLessThanOrEqual(0.03)
        const xs = partPoints(b, part.id).map((q) => q[0])
        const range: [number, number] = [Math.min(...xs), Math.max(...xs)]
        widths.add(Math.round((range[1] - range[0]) * 20))
        const key = String(part.pivot[2])
        byWire.set(key, [...(byWire.get(key) ?? []), range])
        // the pivot lies on the wire (within the sag polyline height)
        const near = wires.some((w) => w.points.some((q) => Math.abs(q[2] - part.pivot[2]) < 1e-6))
        expect(near).toBe(true)
      }
      for (const ranges of byWire.values()) {
        ranges.sort((a, c) => a[0] - c[0])
        for (let i = 1; i < ranges.length; i++) expect(ranges[i][0], `seed ${seed}`).toBeGreaterThan(ranges[i - 1][1])
      }
      expect(widths.size).toBeGreaterThanOrEqual(3)
    }
  })

  it('wardrobe: every garment on the rod hangs from a hanger, below the rod and above the floor board', () => {
    for (const seed of SEEDS) {
      const b = build('wardrobe', { seed })
      const metal = b.rec.primitives.filter((p) => p.kind === 'box' && p.material === 'metal' && p.w < 0.012 && p.h < 0.08 && p.d < 0.012)
      expect(metal.length, 'hangers').toBeGreaterThan(8)
      const rod = b.rec.primitives.find((p) => p.kind === 'cylinder' && p.material === 'metal' && p.r === 0.0125)!
      const fabric = b.rec.primitives.filter((p) => p.kind === 'box' && p.material === 'fabric' && p.y > 0.5 && p.y < rod.y)
      expect(fabric.length).toBeGreaterThan(30)
      // clothes are not flat rectangles any more: tilted sleeve pieces exist
      expect(b.rec.primitives.some((p) => p.kind === 'box' && p.material === 'fabric' && Math.abs(p.rz) > 0.1)).toBe(true)
    }
  })
})
