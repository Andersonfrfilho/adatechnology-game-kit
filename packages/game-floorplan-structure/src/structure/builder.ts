import type { JointKind, MaterialId } from '@adatechnology/game-contracts'

import { densityOf } from '../density'
import { round2 } from '../geometry'
import { GROUND } from '../types'
import type { PartRole, Rect, StructurePart, Support } from '../types'

export type PartExtras = Partial<Pick<StructurePart, 'host' | 'spacing' | 'beamKind' | 'steps' | 'door' | 'cover' | 'studs' | 'pitch' | 'tent' | 'form' | 'liters'>>
export interface PartOptions extends PartExtras {
  floor?: number
  /** Solid fraction of the box (studs, trusses, tile roofs). */
  fill?: number
}

export interface PartDraft {
  id: string
  role: PartRole
  material: MaterialId
  aabb: Rect
  y0: number
  y1: number
}

/** Collects the parts and what each rests on. A part id is unique: a second one is a bug of the builder. */
export class StructureBuilder {
  readonly parts: StructurePart[] = []
  readonly supports: Support[] = []
  private readonly ids = new Set<string>()

  add(draft: PartDraft, options: PartOptions = {}): StructurePart {
    const { id, role, material, aabb, y0, y1 } = draft
    if (this.ids.has(id)) throw new Error(`Part repeated in the structure: ${id}`)
    this.ids.add(id)
    const { floor, fill, ...extras } = options
    const volume = Math.max(0, (aabb[2] - aabb[0]) * (aabb[3] - aabb[1]) * (y1 - y0)) * (fill ?? 1)
    const part: StructurePart = {
      id, role, material, aabb: aabb.map(round2) as Rect, y0: round2(y0), y1: round2(y1), floor: floor ?? 0,
      mass: Math.max(1, Math.round(volume * densityOf(material))),
    }
    for (const [key, value] of Object.entries(extras)) if (value !== undefined) (part as unknown as Record<string, unknown>)[key] = value
    this.parts.push(part)
    return part
  }

  rest(part: StructurePart | string, on: StructurePart | string, joint: JointKind): void {
    const id = typeof part === 'string' ? part : part.id
    const base = typeof on === 'string' ? on : on.id
    this.supports.push({ part: id, on: base === GROUND ? GROUND : base, joint })
  }

  has(id: string): boolean {
    return this.ids.has(id)
  }

  find(id: string): StructurePart | undefined {
    return this.parts.find((part) => part.id === id)
  }
}
