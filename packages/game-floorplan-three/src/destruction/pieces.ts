/* eslint-disable @typescript-eslint/no-unused-vars -- port of the team's closure: dead locals and shapes stay as delivered */
import { assemblyPart, getAssembly } from '@adatechnology/game-destruction';
import { DENSITY, MEMBER_CAGE, cageResidualCapacity, toDestructibleSpec, withWindowApertures } from '@adatechnology/game-floorplan-structure';
import type * as THREE_NS from 'three';
import type { DestructibleSpecOptions, Opening, StructurePart, Support } from '@adatechnology/game-floorplan-structure';
import type { PartAperture, PartSpec } from '@adatechnology/game-contracts';
import type { HouseRecord, Kernel, PieceAperture, PieceRecord, Shared } from '../kernel-types.js';
import type { HouseStructure, HouseStructurePart, HouseSupport, StructureMeshItem } from './types.js';
import { panelViewOf } from './panels.js';

export function installDestructionPieces(K: Kernel, shared: Shared): void {
  const { THREE, floorAtY, pieceRecord } = K;
      // ====================== destruction: house.structure and the adapter to the game-destruction SDK (cfg.destruction) ======================
      // The meshes carry userData.destructionMaterial / destructionPart / structuralRole (and destructionParts + ranges on merged meshes).
      // house.structure describes the pieces; house.destruction registers the house in the `cfg.destruction` world (createDestruction) on first need and listens to its
      // events: fracture hides the piece and releases shards, collapse brings the piece down, leak empties the water tank. Whoever steps the world (world.update(dt)) is the app.
  shared.destructionSeq = 0;
  const FRAGMENT_COLOR: Record<string, number> = { brick: 0xa8553a, concrete: 0x9a9a96, plaster: 0xd8d4c8, ceramic: 0xb4623e, glass: 0xaecfd8, tempered_glass: 0xaecfd8, wood_soft: 0xb08a58, wood_hard: 0x7a5434, plywood: 0xb89a6a, mdf: 0xb89a6a, steel: 0x8a8e92, aluminium: 0xb8bcc0, plastic: 0x2f6aa8, copper: 0xb87333, stone: 0x8a8a84, fabric: 0xcfc4a8 };
  const FRAGMENT_GEO = new THREE.BoxGeometry(1, 1, 1), FRAGMENT_MAT: Record<string, THREE_NS.MeshLambertMaterial> = {};
  const fragmentMaterial = (m: string) => FRAGMENT_MAT[m] || (FRAGMENT_MAT[m] = new THREE.MeshLambertMaterial({ color: FRAGMENT_COLOR[m] != null ? FRAGMENT_COLOR[m] : 0x8a8a84 }));
  function markGroups(r: HouseRecord, root: THREE_NS.Group, parts: Record<string, unknown>) { // pieces that are loose groups (doors, water tank, gas cylinder, pipes in the wall, gates, panels): userData on the meshes + record
        const tagObject = (id: string, objs: (THREE_NS.Object3D | null | undefined)[], mat: string, role: string | null, extra: Record<string, unknown>) => {
          objs = objs.filter(Boolean); if (!objs.length) return; const pc = pieceRecord(id, mat, role, extra); shared.ctx.pieceObjects.set(id, objs as THREE_NS.Object3D[]);
          for (const o of objs as THREE_NS.Object3D[]) o.traverse(m => { if (!(m as THREE_NS.Mesh).isMesh) return; const u = m.userData; u.destructionPart = id; u.destructionMaterial = mat; if (role) u.structuralRole = role; if (pc.contains) u.destructionContains = pc.contains; if (pc.explodes) u.destructionExplodes = pc.explodes; });
        };
        for (const fo of shared.ctx.leaves) { const pr = r.doors.find(p => p.id === fo.id); tagObject('door:' + fo.id, fo.gs, fo.type === 'steel' ? 'steel' : (pr && pr.exterior) ? 'wood_hard' : 'mdf', null, { floor: fo.floor, mass: fo.type === 'steel' ? 60 : 18, tags: ['door'] }); }
        const cap = r.utilities!.plumbing ? +r.utilities!.plumbing.capacityL || 0 : 0;
        for (const [id, g] of Object.entries(shared.ctx.parts || {})) {
          const tp = g.userData.part;
          if (tp === 'water_tank') { const e = shared.ctx.structureIndex.water_tank, L = cap || (g.userData.volume ? Math.round(g.userData.volume * 1000) : 0); tagObject('water_tank', [g], 'plastic', e ? e.role : null, { floor: e ? e.floor : 0, contains: L ? { fluid: 'water', liters: L } : undefined, mass: e ? e.mass : 25, thickness: 0.004, fill: 0.05, tags: ['tank'] }); }
          else if (tp === 'gas_cylinder') tagObject(id, [g], 'steel', null, { mass: 11, form: 'cylinder', thickness: 0.003, fill: 0.03, contains: { fluid: 'gas', liters: 13, pressurized: true }, explodes: { energy: 120000, radius: 5, atC: 300 }, tags: ['gas_bottle'] });
          else if (tp === 'wall_pipe') tagObject(id, [g], 'plastic', null, { mass: 3, tags: ['pipe'] });
          else if (tp === 'shower_door') tagObject(id, [g], 'tempered_glass', null, { mass: 25 });
          else if (tp === 'gate_leaf' || tp === 'mailbox_door') tagObject(id, [g], 'steel', null, { mass: 30 });
        }
        for (const def of shared.inter.defs.values()) { if (!def.outer) continue; if (/^gate/.test(def.kind)) tagObject(def.name, [def.outer], 'steel', null, { mass: 80, tags: ['gate'] }); else if (def.kind === 'swing' || def.kind === 'drawer') tagObject(def.name, [def.outer], 'mdf', null, { mass: 6 }); }
      }
  /** The opening a piece declares in plan coordinates (the glass of a frame, the bay of a grille) as the `aperture` of its part, about the part's centre. */
  function apertureOf(sp: PartSpec, ap: PieceAperture | undefined): PartAperture | null {
    if (!ap || sp.shape.kind !== 'box') return null;
    const size = sp.shape.size, depth = ap.alongU ? 2 : 0;
    // the part is thinnest across the window, or the world would read the opening on another face
    if (size[depth] > Math.min(size[ap.alongU ? 0 : 2], size[1])) return null;
    const out: PartAperture = { size: [ap.b - ap.a, ap.y1 - ap.y0], offset: [(ap.a + ap.b) / 2 - sp.position[ap.alongU ? 0 : 2], (ap.y0 + ap.y1) / 2 - sp.position[1]] };
    if (ap.bars) out.bars = { axis: 0, spacing: ap.bars.spacing, width: ap.bars.width };
    return out;
  }

  function assembleStructure(r0: HouseRecord, root: THREE_NS.Group): HouseStructure {
        const E0 = r0.structure || { parts: [], supports: [], levels: [], elevation: 0 }, meshes = new Map<string, StructureMeshItem[]>(), add = (id: string, it: StructureMeshItem) => { let l = meshes.get(id); if (!l) meshes.set(id, l = []); l.push(it); };
        root.updateMatrixWorld(true);
        root.traverse(o0 => { const o = o0 as THREE_NS.Mesh; if (o.isMesh && o.userData.ranges) { const nv = o.geometry.attributes.position.count; for (const f of o.userData.ranges) add(f.id, { mesh: o, v0: f.v0, v1: f.v1, i0: f.i0, i1: f.i1, whole: f.v0 === 0 && f.v1 === nv }); } });
        for (const [id, objs] of shared.ctx.pieceObjects) for (const o of objs) add(id, { obj: o });
        const box3 = (id: string) => { const b = new THREE.Box3(), v = new THREE.Vector3();
          for (const it of meshes.get(id) || []) {
            if (it.obj) { const bb = new THREE.Box3().setFromObject(it.obj); if (!bb.isEmpty()) for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) b.expandByPoint(v.set(x, y, z).applyMatrix4(shared.ctx.unitInverse)); }
            else { const P = it.mesh.geometry.attributes.position.array; for (let k = it.v0; k < it.v1; k++) b.expandByPoint(v.set(P[k * 3], P[k * 3 + 1], P[k * 3 + 2])); }
          }
          return b.isEmpty() ? null : [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]; };
        const parts: HouseStructurePart[] = [], byId = new Map<string, HouseStructurePart>(), supports: HouseSupport[] = E0.supports.map((a: Support) => Object.assign({}, a));
        for (const e of E0.parts) { const p = Object.assign({}, e, { meshes: (meshes.get(e.id) || []).length, extra: false }) as HouseStructurePart, pc = shared.ctx.pieces.get(e.id); if (pc) for (const k of ['contains', 'explodes', 'tags', 'form', 'thickness', 'fill']) if (pc[k] != null && p[k] == null) p[k] = pc[k]; parts.push(p); byId.set(p.id, p); }
        const base = parts.length, view = shared.ctx.panelView || panelViewOf(null, false), panelIds = new Set(view.panels.map(e => e.id)); // the panels are pieces of the structure, not of the plan
        for (const [id, pc] of shared.ctx.pieces) { // tagged pieces that do not come from the plan: windows, doors, tank, pipes, wiring, cylinder, walls
          if (byId.has(id) || panelIds.has(id) || !meshes.has(id)) continue;
          const b = box3(id); if (!b) continue; const vol = Math.max(1e-6, (b[3] - b[0]) * (b[4] - b[1]) * (b[5] - b[2]));
          const p: HouseStructurePart = { id, role: 'none', material: pc.mat, aabb: [b[0], b[2], b[3], b[5]], y0: b[1], y1: b[4], floor: pc.floor != null ? pc.floor : floorAtY(b[1] + 0.1), mass: pc.mass != null ? pc.mass : Math.max(0.5, vol * (DENSITY[pc.mat] || 800) * (pc.fill != null ? pc.fill as number : 0.15)), meshes: meshes.get(id)!.length, extra: true } as HouseStructurePart;
          for (const k of ['contains', 'explodes', 'tags', 'form', 'thickness', 'fill', 'units', 'aperture']) if (pc[k] != null) p[k] = pc[k];
          parts.push(p); byId.set(id, p);
        }
        const inside = (p: HouseStructurePart, q: HouseStructurePart, m: number) => { const cx = (p.aabb[0] + p.aabb[2]) / 2, cz = (p.aabb[1] + p.aabb[3]) / 2, cy = (p.y0 + p.y1) / 2; return cx >= q.aabb[0] - m && cx <= q.aabb[2] + m && cz >= q.aabb[1] - m && cz <= q.aabb[3] + m && cy >= q.y0 - m && cy <= q.y1 + m; };
        const touches = (p: HouseStructurePart, q: HouseStructurePart, m: number) => p.aabb[0] <= q.aabb[2] + m && q.aabb[0] <= p.aabb[2] + m && p.aabb[1] <= q.aabb[3] + m && q.aabb[1] <= p.aabb[3] + m && p.y0 <= q.y1 + m && q.y0 <= p.y1 + m;
        for (const p of parts.slice(base)) { // what is fitted into a wall or slab falls with it (a joint that does not carry)
          // a slab of the sidewalk rests on the ground it is cast on
          if (/^sidewalk:/.test(p.id)) { supports.push({ part: p.id, on: 'ground', joint: 'mortar', extra: true }); continue; }
          if (!/^(window|window_pane|door|jamb|pipe|water_tank|baseboard)/.test(p.id)) continue;
          const target = /^water_tank/.test(p.id) ? ['slab'] : ['wall', 'partition'];
          let m: HouseStructurePart | null = null, md = 1e9; for (const q of parts.slice(0, base)) { if (!target.includes(q.role) || !inside(p, q, 0.2)) continue; const d = Math.hypot((p.aabb[0] + p.aabb[2] - q.aabb[0] - q.aabb[2]) / 2, (p.aabb[1] + p.aabb[3] - q.aabb[1] - q.aabb[3]) / 2); if (d < md) { md = d; m = q; } }
          // a door frame (its jamb and the door in it) stands in the opening, between the walls beside it and under the lintel: its centre is in no wall, so it
          // is held by the wall, pillar or lintel its box meets
          if (!m && /^(window|door|jamb)/.test(p.id)) for (const q of parts.slice(0, base)) {
            if (!['wall', 'partition', 'column', 'beam'].includes(q.role) || !touches(p, q, 0.02)) continue;
            const d = Math.hypot((p.aabb[0] + p.aabb[2] - q.aabb[0] - q.aabb[2]) / 2, (p.y0 + p.y1 - q.y0 - q.y1) / 2, (p.aabb[1] + p.aabb[3] - q.aabb[1] - q.aabb[3]) / 2); if (d < md) { md = d; m = q; }
          }
          // a tile of the baseboard is set in tile adhesive on the wall: glued, it comes off with the wall
          if (m) supports.push({ part: p.id, on: m.id, joint: /^(window|jamb|baseboard)/.test(p.id) ? 'glue' : 'clip', bears: false, extra: true });
          // a window or door of a building whose walls are drawn but are no part of the structure (an outbuilding) is held by that wall, which stands on the
          // ground: tied to the ground, it stays in its wall instead of coming loose as a free piece at the first split of the house
          else if (/^(window|door|jamb)/.test(p.id)) supports.push({ part: p.id, on: 'ground', joint: /^door/.test(p.id) ? 'clip' : 'glue', bears: false, extra: true });
        }
        // The spec is made from the pieces of the plan (the slabs whole), and the structure cuts them into panels; the house is then bound to the panels: a floor, a
        // ceiling and a roof slab are drawn tile by tile in the panel they lie on (house/floors), and the slab they were cut from is not a piece any more.
        const specParts = parts.slice(), specSupports = supports.slice();
        if (view.panels.length) {
          const gone = new Set(view.replaced);
          parts.splice(0, parts.length, ...parts.filter(p => !gone.has(p.id)));
          for (const id of gone) byId.delete(id);
          for (const e of view.panels) { const p = Object.assign({}, e, { meshes: (meshes.get(e.id) || []).length, extra: false }) as HouseStructurePart, pc = shared.ctx.pieces.get(e.id); if (pc) for (const k of ['contains', 'explodes', 'tags', 'form', 'thickness', 'fill']) if (pc[k] != null && p[k] == null) p[k] = pc[k]; parts.push(p); byId.set(p.id, p); }
          supports.splice(0, supports.length, ...supports.filter(s => !gone.has(s.part) && !gone.has(s.on)), ...view.supports.filter(s => byId.has(s.part) && (byId.has(s.on) || s.on === 'ground')).map(a => Object.assign({}, a)));
        }
        const structure: HouseStructure = {
          ...E0, system: (r0.construction && r0.construction.system) || 'masonry', parts, supports, levels: (E0.levels || []).slice(), elevation: E0.elevation || 0, byId,
          meshesOf: (id: string) => meshes.get(id) || [],
          // raycast hit (object + faceIndex) -> piece id: merged mesh by its ranges, single-piece mesh (or loose group) by userData
          pieceId(obj: THREE_NS.Object3D | null, face?: number | null) { for (let n: THREE_NS.Object3D | null = obj; n; n = n.parent) { const u = n.userData; if (!u) continue; if (u.ranges && face != null) { const ix = face * 3; for (const f of u.ranges) if (ix >= f.i0 && ix < f.i1) return f.id; } if (u.destructionPart) return u.destructionPart; } return null; },
          // One part per wall, as the house draws them (a mesh range per wall): the panels of `wallDetail: 'panels'` would name parts the meshes do not have.
          // A masonry wall keeps its assembly (layers, units, rebar, breach) on the same box, so its stage 2 can open the courses; `o.wallDetail` still overrides.
          spec: (o?: DestructibleSpecOptions | null) => {
            const spec = toDestructibleSpec({ ...structure, parts: specParts, supports: specSupports } as unknown as Parameters<typeof toDestructibleSpec>[0], { wallDetail: 'coarse', ...o });
            if (o && o.wallDetail && o.wallDetail !== 'coarse') return spec;
            // what a part holds, what makes it explode and how thin its wall is (the water tank, the gas cylinder) comes from the piece; the structure package's spec does not carry it
            spec.parts = spec.parts.map(sp => {
              const pc0 = byId.get(sp.id); if (!pc0) return sp;
              const extra: Record<string, unknown> = {}; for (const k of ['contains', 'explodes', 'thickness', 'fill', 'tags']) if (pc0[k] != null && (sp as unknown as Record<string, unknown>)[k] == null) extra[k] = pc0[k];
              const aperture = apertureOf(sp, pc0.aperture as PieceAperture | undefined); if (aperture) extra.apertures = [aperture];
              return Object.keys(extra).length ? { ...sp, ...extra } : sp;
            });
            spec.parts = spec.parts.map(sp => {
              const pc = byId.get(sp.id) || (sp.structure ? { role: sp.structure.role, material: sp.material } as HouseStructurePart : null); if (!pc || pc.unit) return sp; // what the structure adds to the plan (beams and pillars of the slab panels) is reinforced concrete like the rest
              // Concrete slabs, beams, pillars and stairs are not walls: they keep their box and take the rebar of reinforced concrete (the renderer draws the cage when the concrete spalls).
              if (pc.role !== 'wall' && pc.role !== 'partition') {
                const def = getAssembly((pc.assembly as string) || (pc.material === 'concrete' && ['slab', 'beam', 'column', 'stair'].includes(pc.role) ? 'reinforced_concrete' : ''));
                // the bare cage of a pillar carries what its bars carry (a pillar under a light bond beam stands on its cage when a blast takes its concrete)
                // a pillar's or a beam's longitudinal bars are those of the structure's cage (10 mm at least), thicker than the 8 mm mesh of a wall or slab
                const bars = def && def.reinforcement ? (pc.role === 'column' || pc.role === 'beam' ? { ...def.reinforcement, diameter: Math.max(def.reinforcement.diameter, MEMBER_CAGE.diameter) } : def.reinforcement) : null;
                const cage = bars ? (pc.role === 'column' && sp.shape.kind === 'box' ? { ...bars, residualCapacity: cageResidualCapacity(sp.shape.size, bars, sp.structure?.capacity) } : { ...bars }) : null;
                const out = cage && !sp.reinforcement ? { ...sp, reinforcement: cage } : sp;
                // a concrete beam or pillar is made of blocks a shot or a blow knocks out where it lands, showing its bars there (MEMBER_CAGE of the structure package)
                if (out.reinforcement && !out.units && pc.material === 'concrete' && (pc.role === 'beam' || pc.role === 'column') && sp.shape.kind === 'box') {
                  return { ...out, units: { size: [MEMBER_CAGE.unit, MEMBER_CAGE.unit, Math.min(...sp.shape.size)], bond: 'stack', mortar: 'concrete' } };
                }
                return out;
              }
              if (!pc.assembly) return sp;
              const [u0, v0, u1, v1] = pc.aabb, alongU = u1 - u0 >= v1 - v0;
              try {
                return assemblyPart(pc.assembly, { id: pc.id, width: alongU ? u1 - u0 : v1 - v0, height: pc.y1 - pc.y0, position: sp.position, ...(alongU ? {} : { rotation: [0, Math.PI / 2, 0] }), ...(sp.structure ? { structure: sp.structure } : {}), extra: { mass: sp.mass } });
              } catch (e) { return sp; } // an assembly the registry does not know stays a plain box
            });
            // a wall drawn with its assembly is turned along v: its window gaps are put again in its own frame
            const walls = new Set(((E0 as { openings?: Opening[] }).openings ?? []).map(op => op.wall));
            return withWindowApertures({ ...spec, parts: spec.parts.map(sp => (walls.has(sp.id) && sp.apertures ? (({ apertures: _gone, ...rest }) => rest)(sp) : sp)) }, (E0 as { openings?: Opening[] }).openings ?? []);
          },
        };
        return structure;
      }
  Object.assign(K, { FRAGMENT_COLOR, FRAGMENT_GEO, FRAGMENT_MAT, fragmentMaterial, markGroups, assembleStructure });
}
