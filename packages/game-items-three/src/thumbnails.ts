import type { Thumbnail } from '@adatechnology/game-contracts'
import type * as THREE_NS from 'three'

import { buildItem } from './build-item'
import type { DrawableItem } from './build-item'
import { hasItemModel } from './models/registry'
import { shade, shapeOf } from './shapes'
import type { ShapeId } from './shapes'
import { setWear } from './wear'
import type { WearStage } from './wear'

const hex = (color: number): string => `#${(color & 0xffffff).toString(16).padStart(6, '0')}`
const DEFAULT_COLOR = 0x8a8f94
const STEEL = '#9aa0a6'
const BRASS = '#b8913a'
const WOOD = '#8a643c'
const PAPER = '#ece4d0'

/** The SVG art of each shape on a 64 x 64 board, from the colour of the item (`c`), a darker (`d`) and a lighter (`l`) tone of it. */
const ART: Readonly<Record<ShapeId, (c: string, d: string, l: string) => string>> = {
  can: (c, d, l) => `<rect x="19" y="13" width="26" height="42" rx="3" fill="${c}"/><rect x="19" y="24" width="26" height="18" fill="${l}"/><rect x="18" y="11" width="28" height="5" rx="2" fill="${STEEL}"/><rect x="18" y="52" width="28" height="4" rx="2" fill="${STEEL}"/>`,
  bag: (c, d, l) => `<path d="M16 55 L13 25 Q32 14 51 25 L48 55 Z" fill="${c}"/><rect x="14" y="17" width="36" height="7" rx="2" fill="${d}"/><rect x="22" y="32" width="20" height="14" rx="2" fill="${l}"/>`,
  box: (c, d, l) => `<rect x="11" y="18" width="42" height="37" fill="${c}"/><rect x="11" y="18" width="42" height="8" fill="${d}"/><rect x="22" y="33" width="20" height="13" fill="${l}"/>`,
  bottle: (c, d) => `<rect x="28" y="7" width="8" height="8" rx="2" fill="${d}"/><path d="M23 56 V30 Q23 23 28 18 H36 Q41 23 41 30 V56 Z" fill="${c}" fill-opacity=".75"/><rect x="23" y="34" width="18" height="14" fill="${PAPER}" fill-opacity=".9"/>`,
  tool: (c) => `<rect x="29" y="20" width="6" height="37" rx="2" fill="${WOOD}"/><rect x="17" y="9" width="30" height="13" rx="2" fill="${c === '#808080' ? STEEL : c}"/>`,
  roll: (c, d) => `<circle cx="32" cy="34" r="22" fill="${c}"/><circle cx="32" cy="34" r="8" fill="${d}"/>`,
  dish: (c, d, l) => `<ellipse cx="32" cy="44" rx="27" ry="9" fill="${c}"/><ellipse cx="32" cy="42" rx="19" ry="5" fill="${l}"/><ellipse cx="32" cy="42" rx="9" ry="2" fill="${d}"/>`,
  cloth: (c, d) => `<rect x="9" y="34" width="46" height="21" rx="3" fill="${c}"/><rect x="13" y="22" width="38" height="14" rx="3" fill="${d}"/>`,
  shoe: (c) => `<path d="M9 48 V27 H26 L30 36 H47 Q56 38 56 48 Z" fill="${c}"/><rect x="7" y="48" width="50" height="7" rx="2" fill="#22251f"/>`,
  jar: (c) => `<rect x="17" y="22" width="30" height="33" rx="6" fill="${c}" fill-opacity=".7"/><rect x="16" y="13" width="32" height="10" rx="2" fill="${BRASS}"/>`,
  paper: (c, d) => `<rect x="14" y="10" width="36" height="46" fill="${PAPER}"/><rect x="19" y="18" width="26" height="3" fill="${d}"/><rect x="19" y="26" width="26" height="3" fill="${d}"/><rect x="19" y="34" width="18" height="3" fill="${d}"/><rect x="19" y="42" width="22" height="3" fill="${c}"/>`,
  fruit: (c) => `<circle cx="32" cy="38" r="18" fill="${c}"/><rect x="31" y="13" width="3" height="9" fill="#5a3a22"/><path d="M34 16 Q44 10 48 16 Q40 20 34 16 Z" fill="#4f7a3a"/>`,
  cup: (c, d) => `<path d="M18 16 H46 L41 56 H23 Z" fill="${c}"/><rect x="18" y="14" width="28" height="4" fill="${d}"/>`,
  tube: (c, d) => `<path d="M23 15 H41 V48 L37 56 H27 L23 48 Z" fill="${c}"/><rect x="25" y="7" width="14" height="9" rx="2" fill="${d}"/>`,
  blade: () => `<rect x="5" y="33" width="18" height="8" rx="2" fill="#3b2a20"/><path d="M23 33 H55 L60 38 L23 42 Z" fill="#a9adb0"/><rect x="22" y="31" width="3" height="12" fill="${BRASS}"/>`,
  long_tool: (c) => `<rect x="5" y="30" width="50" height="5" rx="2" fill="${WOOD}"/><rect x="47" y="21" width="12" height="22" rx="2" fill="${c === '#808080' ? STEEL : c}"/>`,
  garment: (c, d) => `<path d="M20 12 L6 24 L13 33 L20 28 V56 H44 V28 L51 33 L58 24 L44 12 Q32 22 20 12 Z" fill="${c}"/><path d="M20 12 Q32 22 44 12 Q32 28 20 12 Z" fill="${d}"/>`,
  backpack: (c, d) => `<path d="M24 18 Q32 4 40 18" fill="none" stroke="${d}" stroke-width="3"/><rect x="15" y="16" width="34" height="40" rx="9" fill="${c}"/><rect x="21" y="35" width="22" height="16" rx="3" fill="${d}"/>`,
  jerrycan: (c, d) => `<rect x="13" y="17" width="38" height="39" rx="3" fill="${c}"/><rect x="17" y="8" width="16" height="10" rx="2" fill="${d}"/><rect x="39" y="9" width="9" height="9" fill="#d9a441"/>`,
  tank: (c, d) => `<rect x="21" y="18" width="22" height="38" rx="10" fill="${c}"/><rect x="28" y="9" width="8" height="10" fill="${BRASS}"/><rect x="20" y="43" width="24" height="3" fill="${d}"/>`,
  book: (c, d) => `<rect x="14" y="9" width="37" height="47" fill="${c}"/><rect x="14" y="9" width="6" height="47" fill="${d}"/><rect x="23" y="13" width="25" height="39" fill="#e9e1cc"/>`,
  key: () => `<circle cx="16" cy="32" r="9" fill="none" stroke="#9a9da0" stroke-width="5"/><rect x="24" y="30" width="33" height="5" fill="${BRASS}"/><rect x="45" y="35" width="4" height="7" fill="${BRASS}"/><rect x="51" y="35" width="3" height="5" fill="${BRASS}"/>`,
  battery: (c, d, l) => `<rect x="23" y="14" width="18" height="42" rx="2" fill="${c}"/><rect x="28" y="9" width="8" height="6" fill="#b9bdc0"/><rect x="23" y="26" width="18" height="16" fill="${l}"/><rect x="23" y="47" width="18" height="9" fill="${d}"/>`,
  plank: (c) => `<rect x="5" y="26" width="54" height="13" fill="${WOOD}"/><rect x="5" y="30" width="54" height="2" fill="${c === '#808080' ? '#6b4a2c' : c}" fill-opacity=".5"/><circle cx="12" cy="32" r="2" fill="#7d8186"/><circle cx="52" cy="32" r="2" fill="#7d8186"/>`,
  device: (c) => `<rect x="15" y="7" width="34" height="50" rx="5" fill="${c}"/><rect x="20" y="13" width="24" height="18" rx="2" fill="#9fbf8a"/><circle cx="26" cy="43" r="4" fill="#b9bdc0"/><rect x="35" y="40" width="9" height="6" rx="1" fill="#b9bdc0"/>`,
}

/** The SVG picture of a shape in the colour of an item: a 64 x 64 board with plain shapes, no script and no reference. */
export function shapeThumbnailSvg(shape: ShapeId, color: number = DEFAULT_COLOR): string {
  const art = ART[shape]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${art(hex(color), hex(shade(color, 0.7)), hex(shade(color, 1.3)))}</svg>`
}

/**
 * The picture of an item for catalogues and inventories: an item that has a 3D model asks the host to draw it (`render: true`), every other gets the SVG of its shape in
 * its colour.
 */
export function itemThumbnail(item: DrawableItem): Thumbnail {
  if (item.model !== undefined && hasItemModel(item.model)) return { render: true }
  return { svg: shapeThumbnailSvg(shapeOf(item), item.color) }
}

/** The SVG of an item whatever it has: its shape in its colour (what a host with no renderer shows for a modeled item). */
export const itemThumbnailSvg = (item: DrawableItem): string => shapeThumbnailSvg(shapeOf(item), item.color)

/** `{ id: { thumbnail } }` for `createItems({ patch })`, so that a catalog carries its pictures. */
export function thumbnailPatch(items: Iterable<DrawableItem>): Record<string, { thumbnail: Thumbnail }> {
  const patch: Record<string, { thumbnail: Thumbnail }> = {}
  for (const item of items) patch[item.id] = { thumbnail: itemThumbnail(item) }
  return patch
}

export interface ThumbnailRenderOptions {
  /** Side of the picture in pixels (default 128). */
  size?: number
  /** Turn of the item around y and the lift of the camera, radians (default a three-quarter view from above). */
  yaw?: number
  pitch?: number
  /** Multiplies the distance that just fits the item (default 1). */
  distance?: number
  wear?: WearStage
}

export interface ThumbnailScene {
  scene: THREE_NS.Scene
  camera: THREE_NS.PerspectiveCamera
}

const FIT_MARGIN = 1.15
const FIELD_OF_VIEW = 30

/** The scene and camera that frame an item for its picture: the item at the origin, lit like the showcase (hemisphere, sun, rim), the camera far enough to fit all of it. */
export function composeThumbnailScene(T: typeof THREE_NS, item: DrawableItem, options: ThumbnailRenderOptions = {}): ThumbnailScene {
  const { yaw = -0.6, pitch = 0.45, distance = 1, wear = 0 } = options
  const scene = new T.Scene()
  const model = buildItem(T, item)
  if (wear) setWear(model.root, wear)
  scene.add(model.root)
  scene.add(new T.HemisphereLight(0xdfe6ee, 0x3a3428, 0.85))
  const sun = new T.DirectionalLight(0xffe2bf, 1.1)
  sun.position.set(2.5, 3.5, 2.5)
  scene.add(sun)
  const rim = new T.DirectionalLight(0x8fb2d6, 0.45)
  rim.position.set(-3, 1, -2.5)
  scene.add(rim)
  const box = new T.Box3().setFromObject(model.root)
  const centre = box.getCenter(new T.Vector3())
  const radius = box.getSize(new T.Vector3()).length() / 2
  const camera = new T.PerspectiveCamera(FIELD_OF_VIEW, 1, radius / 50, radius * 40)
  const fit = (radius * FIT_MARGIN) / Math.sin((FIELD_OF_VIEW * Math.PI) / 360)
  const away = fit * distance
  camera.position.set(centre.x + away * Math.cos(pitch) * Math.sin(yaw), centre.y + away * Math.sin(pitch), centre.z + away * Math.cos(pitch) * Math.cos(yaw))
  camera.lookAt(centre)
  camera.updateMatrixWorld(true)
  return { scene, camera }
}

/** What `renderItemThumbnail` needs of a renderer (a `WebGLRenderer`, or anything that draws a scene to a canvas). */
export interface ThumbnailRenderer {
  setSize(width: number, height: number): void
  setClearColor?(color: number, alpha?: number): void
  render(scene: THREE_NS.Scene, camera: THREE_NS.Camera): void
  domElement: { toDataURL(type?: string): string }
}

/**
 * Draws the item with the host's renderer and returns the PNG as a data URL (transparent background). The scene has lights of its own (the one allowlisted place for them, see `eslint.config.mjs`),
 * so pass a renderer made for thumbnails, never the game's: its lights would link programs on the game's renderer, which `ProgramWarmup.linkedSince` shows.
 */
export function renderItemThumbnail(T: typeof THREE_NS, renderer: ThumbnailRenderer, item: DrawableItem, options: ThumbnailRenderOptions = {}): string {
  const { scene, camera } = composeThumbnailScene(T, item, options)
  const size = options.size ?? 128
  renderer.setSize(size, size)
  renderer.setClearColor?.(0x000000, 0)
  renderer.render(scene, camera)
  return renderer.domElement.toDataURL('image/png')
}
