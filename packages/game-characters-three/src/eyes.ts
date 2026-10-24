import type { Three, THREE_NS } from './three'

const GLOW_SIZE = 64

/** A soft round spot, white in the middle and clear at the edge: the sprite of an eye that glows. Needs a canvas; without one, returns no texture. */
export const createGlowTexture = (three: Three, createCanvas?: () => { width: number; height: number; getContext(kind: '2d'): unknown }): THREE_NS.Texture | null => {
  const make = createCanvas ?? (typeof document === 'undefined' ? undefined : () => document.createElement('canvas'))
  if (!make) return null
  const canvas = make()
  canvas.width = canvas.height = GLOW_SIZE
  const context = canvas.getContext('2d') as CanvasRenderingContext2D | null
  if (!context) return null
  const gradient = context.createRadialGradient(GLOW_SIZE / 2, GLOW_SIZE / 2, 0, GLOW_SIZE / 2, GLOW_SIZE / 2, GLOW_SIZE / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.35, 'rgba(255,255,255,.45)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE)
  return new three.CanvasTexture(canvas as unknown as HTMLCanvasElement)
}

export type EyeOptions = {
  readonly color: number
  /** Radius of the eyeball. */
  readonly radius?: number
  /** Size of the additive glow sprite; 0 draws no glow. Default five times the radius, as the Bestiário does. */
  readonly glow?: number
  readonly glowOpacity?: number
  readonly texture?: THREE_NS.Texture | null
}

/** One glowing eye: an unlit ball (emissive by itself) and an additive sprite on top. Add it to the head group at the socket. */
export const createEye = (three: Three, { color, radius = 0.02, glow, glowOpacity = 0.55, texture = null }: EyeOptions): THREE_NS.Group => {
  const eye = new three.Group()
  const ball = new three.Mesh(new three.SphereGeometry(radius, 10, 8), new three.MeshBasicMaterial({ color }))
  ball.userData.eye = 1
  eye.add(ball)
  const size = glow ?? radius * 5
  if (size > 0) {
    const sprite = new three.Sprite(new three.SpriteMaterial({ map: texture, color, transparent: true, blending: three.AdditiveBlending, depthWrite: false, opacity: glowOpacity }))
    sprite.scale.setScalar(size)
    sprite.userData.eyeGlow = 1
    eye.add(sprite)
  }
  return eye
}

export type Eyes = {
  /** The eyeballs: the meshes the builder marked `userData.eye`. They are what a test layer can ask for with `isolate`. */
  readonly markable: readonly THREE_NS.Mesh[]
  /** The additive sprites next to them. */
  readonly glows: readonly THREE_NS.Sprite[]
  /** Brightness 0..1 of both the ball colour and the glow. */
  setBrightness(level: number): void
  /** A quarter of the light: a zombie that has not noticed anyone. */
  dim(): void
  /** Dark: the eyes of a dead body. */
  off(): void
  /** Back to the colour the body was built with. */
  on(): void
  /** Hides everything that is not an eye (the test area's "eyes only" layer); `false` shows it again. */
  isolate(only: boolean): void
}

const isEye = (object: THREE_NS.Object3D): boolean => object.userData.eye === 1 || object.userData.eye === true

/** Finds the eyes of a body (a built zombie or a person with `zombify`) and gives them a dimmer: ball colour and additive glow move together. */
export const findEyes = (three: Three, root: THREE_NS.Object3D): Eyes => {
  const markable: THREE_NS.Mesh[] = []
  const glows: THREE_NS.Sprite[] = []
  const base = new Map<THREE_NS.Material, { color: THREE_NS.Color; opacity: number }>()
  root.traverse((object) => {
    const mesh = object as THREE_NS.Mesh
    if (mesh.isMesh && isEye(object)) markable.push(mesh)
    const sprite = object as THREE_NS.Sprite
    if (sprite.isSprite && sprite.material.blending === three.AdditiveBlending) glows.push(sprite)
  })
  const remember = (material: THREE_NS.Material & { color?: THREE_NS.Color }): void => {
    if (material.color && !base.has(material)) base.set(material, { color: material.color.clone(), opacity: material.opacity })
  }
  markable.forEach((mesh) => remember(mesh.material as THREE_NS.Material))
  glows.forEach((sprite) => remember(sprite.material))
  const setBrightness = (level: number): void => {
    const factor = Math.min(1, Math.max(0, level))
    base.forEach((rest, material) => {
      const target = material as THREE_NS.Material & { color: THREE_NS.Color }
      target.color.copy(rest.color).multiplyScalar(factor)
      if ((material as THREE_NS.SpriteMaterial).isSpriteMaterial) material.opacity = rest.opacity * factor
    })
  }
  const hidden: THREE_NS.Object3D[] = []
  return {
    markable,
    glows,
    setBrightness,
    dim: () => setBrightness(0.25),
    off: () => setBrightness(0),
    on: () => setBrightness(1),
    isolate(only) {
      if (!only) {
        hidden.splice(0).forEach((object) => (object.visible = true))
        return
      }
      root.traverse((object) => {
        const mesh = object as THREE_NS.Mesh
        if (mesh.isMesh && !isEye(object) && object.visible) {
          object.visible = false
          hidden.push(object)
        }
      })
    },
  }
}
