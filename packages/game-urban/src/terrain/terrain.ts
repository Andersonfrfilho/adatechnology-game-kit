import type { UrbanBuilder } from '../scene'
import { distanceToPolyline, hash2, insideEllipse, insideRect, lerp, smoothstep } from './math'
import type { ColorRule, Ramp, TerrainGrid, TerrainOptions, Wave } from './types'

const TRIG = { sin: Math.sin, cos: Math.cos }

function wave(w: Wave, px: number, py: number): number {
  return w.kind === 'product' ? TRIG[w.x[0]](px * w.x[1]) * TRIG[w.y[0]](py * w.y[1]) * w.amplitude : Math.sin(px * w.kx + py * w.ky) * w.amplitude
}

function ramp(r: Ramp, px: number, py: number): number {
  const v = r.axis === 'x' ? px : py
  return r.fullUntil !== undefined && v < r.fullUntil ? 1 : smoothstep(r.from, r.to, v)
}

function mask(ramps: readonly Ramp[], px: number, py: number): number {
  let m = 1
  for (const r of ramps) m *= ramp(r, px, py)
  return m
}

const sum = (start: number, waves: readonly Wave[], px: number, py: number): number => {
  let total = start
  for (const w of waves) total += wave(w, px, py)
  return total
}

/**
 * A ground made of layers, as the team's Vale: a rolling base, masked relief (mountains, hills), cities levelled flat, rivers and lakes carved in,
 * a forest density, and a colour for every point. It answers questions about a point of the map and hands a drawer the grid of a square mesh.
 */
export function createTerrain(options: TerrainOptions) {
  const { world } = options
  const toWorld = (px: number, py: number): [number, number] => [px * world.scale + world.origin, py * world.scale + world.origin]
  const fromWorld = (x: number, z: number): [number, number] => [(x - world.origin) / world.scale, (z - world.origin) / world.scale]

  function heightAt(px: number, py: number): number {
    let h = sum(options.base.level, options.base.waves, px, py)
    for (const layer of options.layers) h += mask(layer.mask, px, py) * sum(layer.level, layer.waves, px, py)
    for (const f of options.flatten) {
      if (!insideRect(px, py, f.rect, f.margin)) continue
      const inside = Math.min(smoothstep(f.edge[0], f.edge[1], Math.min(px - f.rect[0], f.rect[2] - px, py - f.rect[1], f.rect[3] - py)), 1)
      h = lerp(h, f.level, inside)
    }
    const land = h
    for (const river of options.rivers) {
      const bed = 'fixed' in river.bed ? river.bed.fixed : Math.max(river.bed.floor, land - river.bed.below)
      h = lerp(bed, h, smoothstep(river.width[0], river.width[1], distanceToPolyline(px, py, river.points)))
    }
    for (const lake of options.lakes) {
      const d = Math.hypot((px - lake.center[0]) / lake.radius[0], (py - lake.center[1]) / lake.radius[1])
      if (d < lake.reach) h = lerp(lake.level, h, smoothstep(lake.edge[0], lake.edge[1], d))
    }
    return options.custom ? options.custom(px, py, h) : h
  }

  function forestAt(px: number, py: number): number {
    let density = 0
    for (const zone of options.forest.zones) density = Math.max(density, mask(zone.mask, px, py))
    const patch = options.forest.patch
    if (patch) density = Math.max(density, smoothstep(patch.edge[0], patch.edge[1], sum(0, patch.waves, px, py) * 0.5 + 0.5) * patch.weight)
    return density
  }

  const nearRiver = (px: number, py: number, margin: number): boolean => options.rivers.some((river) => distanceToPolyline(px, py, river.points) < margin)

  function matches(rule: ColorRule, px: number, py: number, h: number, forest: number): boolean {
    switch (rule.kind) {
      case 'below':
        return h < rule.height
      case 'above':
        return h > rule.height
      case 'ellipse':
        return insideEllipse(px, py, rule.center, rule.radius)
      case 'rects':
        return rule.rects.some((r) => insideRect(px, py, r, rule.margin))
      case 'forest':
        return forest > rule.above
    }
  }

  /** Colour of a point as 0xRRGGBB; `h` is the height there, which the grid already has. */
  function colorAt(px: number, py: number, h: number = heightAt(px, py)): number {
    const forest = forestAt(px, py)
    for (const rule of options.colors) if (matches(rule, px, py, h, forest)) return rule.color
    const { colors, cell } = options.fields
    return colors[Math.floor(hash2(Math.floor(px / cell[0]), Math.floor(py / cell[1])) * colors.length)] as number
  }

  /**
   * The vertices of the square mesh, the way a plane of `size` metres with `segments` cells a side lays them out (rows along z, the
   * coordinates rounded to 32 bits) with the height and the colour of each.
   */
  function grid(segments: number = world.segments): TerrainGrid {
    const count = (segments + 1) * (segments + 1)
    const x = new Float32Array(count)
    const z = new Float32Array(count)
    const heights = new Float32Array(count)
    const colors = new Uint32Array(count)
    const half = world.size / 2
    const step = world.size / segments
    for (let iy = 0; iy <= segments; iy++) {
      for (let ix = 0; ix <= segments; ix++) {
        const i = iy * (segments + 1) + ix
        x[i] = ix * step - half
        z[i] = iy * step - half
        const [px, py] = fromWorld(x[i] as number, z[i] as number)
        const h = heightAt(px, py)
        heights[i] = h
        colors[i] = colorAt(px, py, h)
      }
    }
    return { segments, size: world.size, x, z, heights, colors }
  }

  return { options, toWorld, fromWorld, heightAt, forestAt, nearRiver, colorAt, grid }
}

export type Terrain = ReturnType<typeof createTerrain>

/** Puts the ground and its water under it into a builder: the terrain mesh first, then the water plane, as the page's `buildWorld`. */
export function drawTerrain(b: UrbanBuilder, terrain: Terrain, segments?: number): void {
  b.terrain(terrain.grid(segments))
  const { water, world } = terrain.options
  b.plane(0, water.level, 0, world.size, world.size, water.color, { roughness: water.roughness, metalness: water.metalness })
}
