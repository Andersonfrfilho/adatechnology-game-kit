import type * as THREE_NS from 'three'
import type { LiquidDef } from '@adatechnology/game-fluids'
import { clamp } from './util'
import type { ThreeLib } from './types'

/** Colour of a stain: the liquid's `stainColor`, else a darker `color`. */
export const stainColorOf = (def: LiquidDef): number => {
  if (def.stainColor !== undefined) return def.stainColor
  const r = ((def.color >> 16) & 255) * 0.65
  const g = ((def.color >> 8) & 255) * 0.65
  const b = (def.color & 255) * 0.65
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)
}

/**
 * One material per liquid and role, created on demand and shared by every mesh: each liquid is its own material (colour, opacity, gloss).
 * Wet surfaces use a low roughness from `gloss` so they reflect the scene's environment.
 */
export class MaterialCache {
  private body = new Map<string, THREE_NS.MeshStandardMaterial>()
  private stream = new Map<string, THREE_NS.MeshStandardMaterial>()
  private film = new Map<string, THREE_NS.MeshStandardMaterial>()
  private wet = new Map<string, THREE_NS.MeshStandardMaterial>()

  constructor(
    private readonly THREE: ThreeLib,
    private readonly envMap: THREE_NS.Texture | null,
  ) {}

  private make(params: THREE_NS.MeshStandardMaterialParameters): THREE_NS.MeshStandardMaterial {
    const m = new this.THREE.MeshStandardMaterial({ metalness: 0, ...params })
    if (this.envMap) m.envMap = this.envMap
    return m
  }

  /** The volume of liquid inside a container. */
  liquidBody(def: LiquidDef): THREE_NS.MeshStandardMaterial {
    let m = this.body.get(def.id)
    if (!m) {
      m = this.make({
        color: def.color,
        opacity: def.opacity,
        transparent: def.opacity < 0.999,
        roughness: clamp(1 - def.gloss * 0.9, 0.04, 1),
        envMapIntensity: 0.5 + def.gloss * 0.9,
        depthWrite: def.opacity >= 0.999,
      })
      this.body.set(def.id, m)
    }
    return m
  }

  /** A jet or a drop in the air. */
  liquidStream(def: LiquidDef): THREE_NS.MeshStandardMaterial {
    let m = this.stream.get(def.id)
    if (!m) {
      m = this.make({
        color: def.color,
        opacity: clamp(def.opacity + 0.1, 0.35, 1),
        transparent: true,
        roughness: clamp(1 - def.gloss * 0.95, 0.03, 1),
        envMapIntensity: 0.8 + def.gloss,
        side: this.THREE.DoubleSide,
        depthWrite: false,
      })
      this.stream.set(def.id, m)
    }
    return m
  }

  /** The thin outer film of a stain (and the permanent mark): tinted by vertex colour, soft rim by vertex alpha, mostly matte. */
  stainFilm(def: LiquidDef): THREE_NS.MeshStandardMaterial {
    let m = this.film.get(def.id)
    if (!m) {
      m = this.make({
        color: 0xffffff,
        vertexColors: true,
        transparent: true,
        roughness: clamp(0.95 - def.gloss * 0.45, 0.3, 1),
        envMapIntensity: 0.4 + def.gloss * 0.4,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
      this.film.set(def.id, m)
    }
    return m
  }

  /** The glossy wet part of a stain, which shrinks while it dries. */
  stainWet(def: LiquidDef): THREE_NS.MeshStandardMaterial {
    let m = this.wet.get(def.id)
    if (!m) {
      m = this.make({
        color: 0xffffff,
        vertexColors: true,
        transparent: true,
        roughness: clamp(1 - def.gloss, 0.02, 0.7),
        envMapIntensity: 0.9 + def.gloss * 1.4,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      })
      this.wet.set(def.id, m)
    }
    return m
  }

  dispose(): void {
    for (const map of [this.body, this.stream, this.film, this.wet]) {
      for (const m of map.values()) m.dispose()
      map.clear()
    }
  }
}
