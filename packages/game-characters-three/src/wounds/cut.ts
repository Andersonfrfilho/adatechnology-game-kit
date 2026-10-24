import type { Three, THREE_NS } from '../three'

/** The Elenco's `blobR`: the radii of a ragged round outline (`n` points), from a seeded rough shape. `random` is the stream the page called `R`. */
export const blobRadii = (n: number, rough: number, seed: number, random: () => number): number[] => {
  const phases = [seed * 1.7, seed * 3.1, seed * 5.3, seed * 7.9]
  const spikes: [number, number][] = []
  const spikeCount = rough > 0.5 ? Math.floor(random() * 4) : 0
  for (let k = 0; k < spikeCount; k++) spikes.push([random() * 6.28, 0.45 + random() * 0.7])
  const radii: number[] = []
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2
    let radius =
      1 + 0.16 * Math.sin(2 * angle + phases[0]!) + 0.1 * Math.sin(3 * angle + phases[1]!) + rough * (0.08 * Math.sin(7 * angle + phases[2]!) + 0.05 * Math.sin(13 * angle + phases[3]!)) + rough * 0.05 * (random() - 0.5)
    for (const [spikeAngle, length] of spikes) {
      const distance = Math.atan2(Math.sin(angle - spikeAngle), Math.cos(angle - spikeAngle))
      radius += length * Math.exp(-distance * distance * 90)
    }
    radii.push(Math.max(0.35, radius))
  }
  return radii
}

/** The Elenco's `blobGeo`: a flat shape from those radii, stretched by `rx` and `ry`. */
export const blobGeometry = (three: Three, radii: readonly number[], rx: number, ry: number): THREE_NS.ShapeGeometry => {
  const shape = new three.Shape()
  radii.forEach((radius, index) => {
    const angle = (index / radii.length) * Math.PI * 2
    const x = Math.cos(angle) * radius * rx
    const y = Math.sin(angle) * radius * ry
    if (index) shape.lineTo(x, y)
    else shape.moveTo(x, y)
  })
  return new three.ShapeGeometry(shape)
}

export type WoundMaterials = {
  readonly wound: THREE_NS.MeshStandardMaterial
  readonly bone: THREE_NS.MeshStandardMaterial
  readonly meat: THREE_NS.MeshStandardMaterial
  readonly fat: THREE_NS.MeshStandardMaterial
  readonly rim: THREE_NS.MeshStandardMaterial
  /** Arsenal `M.hole`, `M.bruise` and `M.flesh`: the dark entry hole, the bruise around it and torn flesh. */
  readonly hole: THREE_NS.MeshStandardMaterial
  readonly bruise: THREE_NS.MeshStandardMaterial
  readonly flesh: THREE_NS.MeshStandardMaterial
  readonly dispose: () => void
}

/** The Elenco's wound materials (`woundM`, `boneM`, `meatM`, `fatM`, `rimM`). */
export const createWoundMaterials = (three: Three): WoundMaterials => {
  const wound = new three.MeshStandardMaterial({ color: 0x8a0a0a, roughness: 0.18, metalness: 0.08 })
  const bone = new three.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.6 })
  const meat = new three.MeshStandardMaterial({ color: 0x4a0606, roughness: 0.75, side: three.DoubleSide })
  const fat = new three.MeshStandardMaterial({ color: 0xb7956a, roughness: 0.7 })
  const rim = new three.MeshStandardMaterial({ color: 0x8a0a0a, roughness: 0.3, side: three.DoubleSide })
  const hole = new three.MeshStandardMaterial({ color: 0x120404, roughness: 0.9 })
  const bruise = new three.MeshStandardMaterial({ color: 0x4a1f26, roughness: 0.6, transparent: true, opacity: 0.85 })
  const flesh = new three.MeshStandardMaterial({ color: 0x8e2a2a, roughness: 0.55 })
  const all = [wound, bone, meat, fat, rim, hole, bruise, flesh]
  return { wound, bone, meat, fat, rim, hole, bruise, flesh, dispose: () => all.forEach((material) => material.dispose()) }
}

/**
 * The cut face of a limb (Elenco `makeCut`): a ragged rim, the meat, a ring of fat, the bone with a splintered tip, torn flaps and two strands. `up` faces
 * the cut upward (the flying piece), otherwise downward (the stump). Returns the strands' tips, where the stump drips.
 */
export const makeCut = (three: Three, materials: WoundMaterials, random: () => number, group: THREE_NS.Object3D, radius: number, up: boolean): THREE_NS.Object3D[] => {
  const s = up ? 1 : -1
  const { PI } = Math
  const rim = new three.Mesh(blobGeometry(three, blobRadii(30, 1.4, random() * 10, random), radius * 1.12, radius * 1.12).rotateX((-s * PI) / 2), materials.rim)
  rim.position.y = s * 0.001
  group.add(rim)
  const meat = new three.Mesh(blobGeometry(three, blobRadii(24, 0.6, random() * 10, random), radius * 0.9, radius * 0.9).rotateX((-s * PI) / 2), materials.meat)
  meat.position.y = s * 0.004
  group.add(meat)
  const fat = new three.Mesh(new three.TorusGeometry(radius * 0.86, radius * 0.06, 6, 22), materials.fat)
  fat.rotation.x = PI / 2
  fat.position.y = s * 0.005
  group.add(fat)
  const bone = new three.Mesh(new three.CylinderGeometry(radius * 0.26, radius * 0.3, radius * 0.7, 9), materials.bone)
  bone.position.set(radius * 0.12, s * radius * 0.3, 0)
  bone.rotation.z = 0.12
  group.add(bone)
  const tip = new three.Mesh(new three.ConeGeometry(radius * 0.26, radius * 0.35, 7), materials.bone)
  tip.position.set(radius * 0.16, s * radius * 0.75, 0)
  tip.rotation.set(up ? 0 : PI, 0, 0.3)
  group.add(tip)
  for (let k = 0; k < 5; k++) {
    const angle = (k / 5) * PI * 2 + random() * 0.6
    const flap = new three.Mesh(new three.ConeGeometry(radius * 0.16, radius * (0.35 + random() * 0.35), 4), k % 2 ? materials.rim : materials.meat)
    flap.position.set(Math.cos(angle) * radius * 0.98, s * radius * 0.12, Math.sin(angle) * radius * 0.98)
    if (!up) flap.rotation.x = PI
    group.add(flap)
  }
  const strands: THREE_NS.Object3D[] = []
  for (let k = 0; k < 2; k++) {
    const angle = random() * PI * 2
    const length = radius * (0.5 + random() * 0.6)
    const strand = new three.Mesh(new three.CylinderGeometry(radius * 0.05, radius * 0.03, length, 6).translate(0, -length / 2, 0), materials.rim)
    strand.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
    group.add(strand)
    const end = new three.Object3D()
    end.position.set(Math.cos(angle) * radius, -length, Math.sin(angle) * radius)
    group.add(end)
    strands.push(end)
  }
  group.traverse((object) => {
    object.userData.stump = 1
    if ((object as THREE_NS.Mesh).isMesh) object.castShadow = true
  })
  return strands
}

/** Elenco `makeStump`: the cut face left on the body where the piece left (`flip` turns it over for a head). */
export const makeStump = (three: Three, materials: WoundMaterials, random: () => number, parent: THREE_NS.Object3D, position: THREE_NS.Vector3, radius: number, flip = false): { group: THREE_NS.Group; strands: THREE_NS.Object3D[] } => {
  const group = new three.Group()
  group.position.copy(position)
  if (flip) group.rotation.x = Math.PI
  parent.add(group)
  return { group, strands: makeCut(three, materials, random, group, radius, false) }
}

/** Elenco `ringWound`: the dark ring and three torn strips of a broken bone that stays in the limb. */
export const ringWound = (three: Three, materials: WoundMaterials, parent: THREE_NS.Object3D, radius: number, y = 0): THREE_NS.Group => {
  const group = new three.Group()
  group.position.y = y
  parent.add(group)
  const torus = new three.Mesh(new three.TorusGeometry(radius, 0.022, 8, 18), materials.wound)
  torus.rotation.x = Math.PI / 2
  group.add(torus)
  for (let k = 0; k < 3; k++) {
    const strip = new three.Mesh(new three.CylinderGeometry(0.008, 0.008, 0.12, 6), materials.wound)
    strip.position.set((k - 1) * 0.03, 0.03, 0.02)
    group.add(strip)
  }
  group.traverse((object) => (object.userData.stump = 1))
  return group
}
