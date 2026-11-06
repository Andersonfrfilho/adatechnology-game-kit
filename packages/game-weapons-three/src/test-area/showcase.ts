import type * as THREE_NS from 'three'
import type { BenchChange, BenchSheet, ChoiceOption, DestructibleSpec, ModuleControl, ModuleHost, TestableItem, Vec3 } from '@adatechnology/game-contracts'
import { furnitureSpec } from '@adatechnology/game-floorplan-three'
import { discardObject3D } from '@adatechnology/game-shapes-three'
import { weaponMenu } from '@adatechnology/game-weapons'
import type { Arsenal } from '@adatechnology/game-weapons'
import references from '../../assets/weapon-references.json'
import { buildWeaponModelById, hasWeaponModel } from '../models'
import type { ShowcaseText } from './showcase-text'

export const SHOWCASE_PEDESTAL_ID = 'showcase_pedestal'
export const SHOWCASE_IDS = { weapon: 'showcase_weapon', spin: 'showcase_spin', look: 'showcase_look' } as const
export const SHOWCASE_NONE = 'none'
/** The pedestal behind the second row of counters, the weapon turning over it at eye height, and where the camera looks at it from. */
export const SHOWCASE = { at: [-6.5, 0, 10] as Vec3, size: 0.6, height: 1.05, lift: 0.3, spin: 0.5, eye: [0, 0.18, 0.95] as Vec3 }
// the pedestal is the buffet of the furniture catalogue, as the counters, at the size of a plinth
const PEDESTAL_FURNITURE = 'buffet'

type ReferencePhoto = { readonly url: string; readonly page: string; readonly author: string; readonly license: string }
const PHOTOS = (references as { readonly references: Readonly<Record<string, ReferencePhoto>> }).references

const fill = (template: string, vars: Record<string, string>): string => template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '')

/** The choice of the weapon on the showcase (every weapon with a model, by section of the weapon menu), whether it turns, and the button that looks at it. */
export function showcaseControls(arsenal: Arsenal, text: ShowcaseText, locale: string): ModuleControl[] {
  const options: ChoiceOption[] = [{ id: SHOWCASE_NONE, name: text.none }]
  for (const group of weaponMenu(arsenal, { locale })) for (const section of group.sections) for (const weapon of section.weapons) if (hasWeaponModel(weapon.id)) options.push({ id: weapon.id, name: weapon.name, group: section.name })
  return [
    { kind: 'choice', id: SHOWCASE_IDS.weapon, name: text.weapon, hint: text.weaponHint, options, default: SHOWCASE_NONE, slow: true },
    { kind: 'boolean', id: SHOWCASE_IDS.spin, name: text.spin, default: true },
    { kind: 'action', id: SHOWCASE_IDS.look, name: text.look },
  ]
}

/** The pedestal as an item of the area. */
export function showcasePedestalItem(name: string): TestableItem {
  const piece = (THREE: typeof THREE_NS) => furnitureSpec(THREE, PEDESTAL_FURNITURE, { w: SHOWCASE.size, d: SHOWCASE.size, h: SHOWCASE.height })
  return {
    id: SHOWCASE_PEDESTAL_ID,
    name,
    build: (lent: unknown) => {
      const THREE = lent as typeof THREE_NS
      const built = piece(THREE)
      const root = built.build(THREE) as THREE_NS.Object3D
      root.userData.pedestalSpec = { ...built.spec, name, tags: [...(built.spec.tags ?? []), 'furniture'] }
      return root
    },
    spec: (root: unknown) => (root as THREE_NS.Object3D).userData.pedestalSpec as DestructibleSpec,
    movable: false,
  }
}

/** The card of the weapon on the showcase: its name and the photo of the real one, with author and licence. */
export function showcaseSheet(arsenal: Arsenal, text: ShowcaseText, weapon: string): BenchSheet {
  const name = arsenal.name(weapon)
  const photo = PHOTOS[weapon]
  if (!photo) return { kicker: text.kicker, title: name, note: text.noPhoto }
  return { kicker: text.kicker, title: name, image: { url: photo.url, alt: fill(text.alt, { weapon: name }), credit: `${photo.author} · ${photo.license}`, page: photo.page } }
}

export interface WeaponShowcase {
  /** The weapon on the showcase, or null. */
  readonly shown: string | null
  readonly root: THREE_NS.Object3D | null
  /** Answers whether the change was the showcase's. */
  handleChange(change: BenchChange): boolean
  dispose(): void
}

/** The weapon showcase of the area: one weapon at a time over the pedestal, turning, the camera close to it and the real one's photo on the panel. */
export function createWeaponShowcase(options: { readonly arsenal: Arsenal; readonly host: ModuleHost; readonly text: ShowcaseText }): WeaponShowcase {
  const { arsenal, host, text } = options
  const THREE = host.THREE as typeof THREE_NS
  const scene = host.scene as THREE_NS.Scene
  const centre: Vec3 = [SHOWCASE.at[0], SHOWCASE.height + SHOWCASE.lift, SHOWCASE.at[2]]
  let shown: { readonly id: string; readonly root: THREE_NS.Group } | null = null
  let spinning = true
  const clear = (): void => {
    if (!shown) return
    discardObject3D(shown.root)
    shown = null
    host.bench?.sheet?.(null)
  }
  const look = (): void => host.bench?.look([centre[0] + SHOWCASE.eye[0], centre[1] + SHOWCASE.eye[1], centre[2] + SHOWCASE.eye[2]], centre)
  const show = (weapon: string): void => {
    clear()
    const model = weapon === SHOWCASE_NONE ? undefined : buildWeaponModelById(THREE, weapon)
    if (!model) return
    const holder = new THREE.Group()
    holder.name = 'weapon_showcase'
    holder.add(model.root)
    // the weapon turns about its own middle
    model.root.position.sub(new THREE.Box3().setFromObject(model.root).getCenter(new THREE.Vector3()))
    holder.position.set(...centre)
    scene.add(holder)
    shown = { id: weapon, root: holder }
    host.bench?.sheet?.(showcaseSheet(arsenal, text, weapon))
    host.log(fill(text.shown, { weapon: arsenal.name(weapon) }), { weapon, photo: weapon in PHOTOS })
    look()
  }
  const offFrame = host.onFrame((dt) => {
    if (shown && spinning) shown.root.rotation.y += dt * SHOWCASE.spin
  })
  return {
    get shown() {
      return shown?.id ?? null
    },
    get root() {
      return shown?.root ?? null
    },
    handleChange(change) {
      if (change.kind === 'control' && change.id === SHOWCASE_IDS.weapon && typeof change.value === 'string') show(change.value)
      else if (change.kind === 'control' && change.id === SHOWCASE_IDS.spin && typeof change.value === 'boolean') spinning = change.value
      else if (change.kind === 'action' && change.id === SHOWCASE_IDS.look) look()
      else return false
      return true
    },
    dispose() {
      clear()
      offFrame()
    },
  }
}
