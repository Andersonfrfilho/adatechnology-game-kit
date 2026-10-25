/* Copy of packages/game-vehicles-fleet/tests/helpers/digest.ts: the compare run must hash exactly as the fleet goldens do. */
/** Order-sensitive digest of a built vehicle: the same function produced the golden fixtures from the original SDK. */
function round(x: number): number {
  return Math.round(x * 1e4) / 1e4
}

function fnv(values: ArrayLike<number>): string {
  let h = 2166136261
  for (let i = 0; i < values.length; i++) {
    const v = Math.round(values[i] * 1e4)
    h ^= v & 0xffff
    h = Math.imul(h, 16777619)
    h ^= (v >> 16) & 0xffff
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

function describe(root: any): string[] {
  const out: string[] = []
  root.updateMatrixWorld(true)
  root.traverse((o: any) => {
    let s =
      o.type +
      (o.visible ? '' : '!') +
      ' p' +
      [o.position.x, o.position.y, o.position.z].map(round).join(',') +
      ' q' +
      [o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w].map(round).join(',') +
      ' s' +
      [o.scale.x, o.scale.y, o.scale.z].map(round).join(',')
    if (o.geometry && o.geometry.attributes && o.geometry.attributes.position) {
      const p = o.geometry.attributes.position
      s += ' v' + p.count + ':' + fnv(p.array)
      if (o.geometry.index) s += ' i' + o.geometry.index.count
    }
    const m = o.material
    if (m && !Array.isArray(m)) {
      s +=
        ' m' +
        (m.color ? m.color.getHexString() : '-') +
        ':' +
        round(m.opacity == null ? 1 : m.opacity) +
        ':' +
        round(m.roughness == null ? -1 : m.roughness)
    }
    out.push(s)
  })
  return out
}

export interface Digest {
  /** Number of scene objects. */
  objects: number
  /** Hash of every object's transform, geometry and material. */
  hash: string
}

/** The scene part of the fleet golden digest (the page names its context fields in Portuguese, so only the scene graph is comparable). */
export function digest(root: any): Digest {
  const lines = describe(root)
  let h = 2166136261
  const text = lines.join('\n')
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return { objects: lines.length, hash: (h >>> 0).toString(16) }
}
