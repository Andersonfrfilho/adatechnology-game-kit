import type { DestructionEvent, DestructionWorld, Hit, MaterialDef, ObjectState, PartState, Quat, Vec3 } from '@adatechnology/game-destruction'

export function mat(id: string, extra: Partial<MaterialDef> = {}): MaterialDef {
  return {
    id,
    density: 800,
    hpPerKg: 100,
    penetration: 10,
    ductility: 0.2,
    fracture: 'snap',
    hitDebris: 'chips',
    breakDebris: 'chips',
    thermal: { conductivity: 0.1 },
    ...extra,
  }
}

export const MATS: MaterialDef[] = [
  mat('wood', { fracture: 'splinter', tags: ['wood'], visual: { charColor: 0x111111 }, thermal: { conductivity: 0.05, ignitionC: 300, smoke: 'grey' } }),
  mat('glass', { fracture: 'shatter', visual: { transparent: true }, thermal: { conductivity: 0.1 } }),
  mat('steel', { fracture: 'none', tags: ['metal'], ductility: 0.9, visual: { glows: true }, thermal: { conductivity: 0.5, meltC: 1400 } }),
  mat('concrete', { fracture: 'crumble' }),
]

export function partState(id: string, material: string, extra: Partial<PartState> = {}): PartState {
  return {
    id,
    material,
    status: 'intact',
    hp: 100,
    maxHp: 100,
    mass: 2,
    temperature: 20,
    burning: false,
    fuel: 1,
    char: 0,
    melt: 0,
    dents: [],
    holes: [],
    cracks: [],
    group: 0,
    ...extra,
  }
}

/** A tiny stand-in for `DestructionWorld`: just the bits the renderer uses, with an `emit` to fire events through `on()`. */
export class FakeWorld {
  materials = new Map<string, MaterialDef>(MATS.map((m) => [m.id, m]))
  objects = new Map<string, ObjectState>()
  handlers: Array<(e: DestructionEvent) => void> = []
  transforms: Array<{ id: string; position: Vec3; rotation: Quat }> = []
  hits: Array<{ id: string; hit: Hit }> = []
  splits: Array<{ id: string; group: number; newId: string }> = []
  /** Order of `setTransform`/`hit` calls, to assert that the transform is synced before a hit. */
  calls: string[] = []
  time = 0
  private counter = 0

  addObject(id: string, parts: PartState[], groups?: string[][]): ObjectState {
    const st: ObjectState = {
      id,
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      parts,
      joints: [],
      groups: groups ?? [parts.map((p) => p.id)],
      destroyed: false,
    }
    this.objects.set(id, st)
    return st
  }

  on(_type: string, fn: (e: DestructionEvent) => void): () => void {
    this.handlers.push(fn)
    return () => {
      this.handlers = this.handlers.filter((h) => h !== fn)
    }
  }

  emit(ev: Omit<DestructionEvent, 'time'> & { time?: number } & Record<string, unknown>): void {
    const e = { time: this.time, ...ev } as DestructionEvent
    for (const h of this.handlers) h(e)
  }

  has(id: string): boolean {
    return this.objects.has(id)
  }

  state(id: string): ObjectState | null {
    return this.objects.get(id) ?? null
  }

  part(id: string, partId: string): PartState | null {
    return this.objects.get(id)?.parts.find((p) => p.id === partId) ?? null
  }

  setTransform(id: string, position: Vec3, rotation: Quat): void {
    this.calls.push('setTransform:' + id)
    this.transforms.push({ id, position, rotation })
  }

  hit(id: string, hit: Hit): never[] {
    this.calls.push('hit:' + id)
    this.hits.push({ id, hit })
    return [] as never[]
  }

  splitGroup(id: string, group: number): string {
    const st = this.objects.get(id) as ObjectState
    const ids = st.groups[group]
    const newId = `${id}_p${++this.counter}`
    const moved = st.parts.filter((p) => ids.includes(p.id))
    st.parts = st.parts.filter((p) => !ids.includes(p.id))
    st.groups.splice(group, 1)
    this.addObject(newId, moved)
    this.splits.push({ id, group, newId })
    return newId
  }

  asWorld(): DestructionWorld {
    return this as unknown as DestructionWorld
  }
}
