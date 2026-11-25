import type { Aabb } from '../house/solids.js';
import type { Accumulator, PartRecord } from '../kernel-types.js';

/** What a plan item was drawn as, recorded when the build asks for it (`BuildOptions.itemBounds`): the box of every vertex it laid, in the house's frame. */
export interface ItemBounds {
  readonly id: string
  readonly type: string
  /** The plan item's category (`ground_cover`, `plant`...). */
  readonly category: string | null
  readonly room: string | null
  readonly floor: number
  readonly box: Aabb
  /** How it was drawn: by the house's furniture builders, as a species of the vegetation package. */
  readonly by: 'furniture' | 'vegetation'
}

/** A cord drawn from a device to its socket, as the points of its tube in the house's frame (`BuildOptions.itemBounds`). */
export interface CordPath {
  readonly object: string
  readonly device: string
  readonly points: ReadonlyArray<readonly [number, number, number]>
}

/** How many vertices each accumulator holds now: what is laid after it is the next item's. */
export function vertexMark(accs: ReadonlyMap<string, Accumulator>): Map<Accumulator, number> {
  const mark = new Map<Accumulator, number>();
  for (const a of accs.values()) mark.set(a, a.nv);
  return mark;
}

/** A point of a moving part's own frame in the house's frame, through the pivots of the part and the parts it hangs from. */
function partToHouse(parts: ReadonlyMap<string, PartRecord>, group: string, p: [number, number, number]): [number, number, number] {
  let at = p, name = group;
  for (let part = parts.get(name); part; part = parts.get(name)) {
    const c = Math.cos(part.ry), s = Math.sin(part.ry);
    at = [at[0] * c + at[2] * s + (part.pos[0] ?? 0), at[1] + (part.pos[1] ?? 0), -at[0] * s + at[2] * c + (part.pos[2] ?? 0)];
    name = part.parent;
  }
  return at;
}

/** The box of the vertices laid in the accumulators since `mark`, or null when nothing was laid. */
export function boundsSince(accs: ReadonlyMap<string, Accumulator>, mark: ReadonlyMap<Accumulator, number>, parts: readonly PartRecord[]): Aabb | null {
  const byName = new Map(parts.map((p) => [p.name, p] as const));
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const a of accs.values()) {
    for (let v = mark.get(a) ?? 0; v < a.nv; v++) {
      const local: [number, number, number] = [a.p[v * 3]!, a.p[v * 3 + 1]!, a.p[v * 3 + 2]!];
      const p = a.group.startsWith('part:') ? partToHouse(byName, a.group, local) : local;
      for (let k = 0; k < 3; k++) { box[k] = Math.min(box[k]!, p[k]!); box[k + 3] = Math.max(box[k + 3]!, p[k]!); }
    }
  }
  return box[0]! <= box[3]! ? (box as unknown as Aabb) : null;
}
