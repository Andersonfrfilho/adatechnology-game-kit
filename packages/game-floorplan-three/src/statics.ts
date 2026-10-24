// Literal port of the team's Casa3DSDK static utilities (outside the instance). See MIGRATION.md.
// create

// ---- static utilities (they do not depend on an instance) ----
export const OPEN_ROOM_TYPES = new Set(['balcony', 'terrace', 'veranda', 'balcony_gourmet']);
export const rectsOf = c => (c.parts && c.parts.length ? c.parts : [[c.u0, c.v0, c.u1, c.v1]]);
export const isOpenArea = c => OPEN_ROOM_TYPES.has(c.type) || c.outdoor === true;
// open area: no roof or ceiling
// spreads the draw-call budget among several houses: the ones closest to the focus stay complete; the farther ones lose the small pieces (LOD 1) and finally vanish (LOD 2).
export function planLod(houses, focus, budget) {
    const l = houses.map(c => ({ c, d: c.distance(focus), n0: c.stats.drawCalls, n1: c.stats.drawCallsLOD1, level: 0 })).sort((a, b) => a.d - b.d);
    let total = l.reduce((s, x) => s + x.n0, 0);
    for (let i = l.length - 1; i >= 0 && total > budget; i--) { total -= l[i].n0 - l[i].n1; l[i].level = 1; }
    for (let i = l.length - 1; i >= 0 && total > budget; i--) { total -= l[i].n1; l[i].level = 2; }
    for (const x of l) x.c.setLod(x.level);
    return { total, levels: l.map(x => x.level), houses: l.map(x => x.c) };
  }
// ---- supporting structure (res.structure of the plan + tagged pieces) -> DestructibleSpec of @adatechnology/game-contracts ----
// plan roles -> StructureRole of the core; support types -> JointKind. water_tank is 'none' (carries nothing).
