import type { Kernel, Shared } from '../kernel-types.js';

/** How long damage waits for the host's `update` of a followed object before it is painted anyway. */
const FOLLOW_FLUSH_FALLBACK_MS = 100;

export function installDestructionWorld(K: Kernel, shared: Shared): void {
  const { THREE, cfg, invalidateShadow, invalidate, rngString, FRAGMENT_GEO, fragmentMaterial, createBreachView } = K;
  function createHouseDestruction(root, house, structure, parts, colliders, water) {
        const D: any = { world: cfg.destruction || null, id: null, active: false }, hiddenPieces = new Set(), bodies = new Map(), frags = [], facets = new Map(); let flow = 0, off = null, inside = false;
        // cfg.destructionRenderer = createDestructionRenderer(THREE, { scene, world }) of @adatechnology/game-destruction-three: it draws fracture, collapse, fragments, spalls and the rebar cage on the vertex ranges this house binds. Without it the house draws its own (hide, fall, shards).
        const R = cfg.destructionRenderer || null, listeners = new Set<(e: any) => void>();
        D.renderer = R; D.spec = null;
        const breach = createBreachView({ house, structure, spec: () => D.spec, deferPaint: true, ...(cfg.breachPaintBudgetMs !== undefined ? { paintBudgetMs: cfg.breachPaintBudgetMs } : {}) }); D.breach = breach;
        D.onEvent = fn => { listeners.add(fn); return () => listeners.delete(fn); };
        const pieceId = p => (structure.byId.has(p.id) ? p.id : p.type === 'water_tank' && structure.byId.has('water_tank') ? 'water_tank' : null);
        for (const p of Object.values<any>(parts)) if (p.damageable) { const id = pieceId(p); if (id) { if (!facets.has(id)) facets.set(id, []); facets.get(id).push(p.damageable); } }
        for (const c of colliders) if (c.piece && c.damageable && structure.byId.has(c.piece)) { if (!facets.has(c.piece)) facets.set(c.piece, []); facets.get(c.piece).push(c.damageable); }
        const worldPoint = (it, v) => v.clone().applyMatrix4(it.matrixWorld);
        const hide = it => {
          if (it.obj) { it.obj.visible = false; return; } if (it.whole) { it.mesh.visible = false; return; }
          const pos = it.mesh.geometry.attributes.position, A = pos.array, u = it.mesh.userData; if (!u._p0) u._p0 = A.slice();
          const x = A[it.v0 * 3], y = A[it.v0 * 3 + 1], z = A[it.v0 * 3 + 2]; for (let k = it.v0; k < it.v1; k++) { A[k * 3] = x; A[k * 3 + 1] = y; A[k * 3 + 2] = z; } pos.needsUpdate = true;
        };
        const show = it => {
          if (it.obj) { it.obj.visible = true; return; } if (it.whole) { it.mesh.visible = true; return; }
          const u = it.mesh.userData; if (!u._p0) return; const pos = it.mesh.geometry.attributes.position; pos.array.set(u._p0.subarray(it.v0 * 3, it.v1 * 3), it.v0 * 3); pos.needsUpdate = true;
        };
        const extract = it => { // the piece's slice in a mesh of its own, with the origin at the centre (to fall and spin)
          const g0 = it.mesh.geometry, src = it.mesh.userData._p0 || g0.attributes.position.array, g = new THREE.BufferGeometry();
          const at = (name, k, arr?) => g.setAttribute(name, new THREE.BufferAttribute((arr || g0.attributes[name].array).slice(it.v0 * k, it.v1 * k), k));
          at('position', 3, src); at('normal', 3); at('color', 3); at('uv', 2);
          const ix = g0.index.array.slice(it.i0, it.i1); for (let k = 0; k < ix.length; k++) ix[k] -= it.v0; g.setIndex(new THREE.BufferAttribute(ix, 1));
          g.computeBoundingBox(); const c = g.boundingBox.getCenter(new THREE.Vector3()); g.translate(-c.x, -c.y, -c.z); g.computeBoundingSphere(); g.computeBoundingBox();
          const m = new THREE.Mesh(g, it.mesh.material); m.castShadow = it.mesh.castShadow; m.receiveShadow = true; m.renderOrder = it.mesh.renderOrder; m.position.copy(c); it.mesh.parent.add(m); return m;
        };
        D.hide = id => { if (hiddenPieces.has(id)) return; hiddenPieces.add(id); for (const it of structure.meshesOf(id)) hide(it); invalidateShadow(); };
        D.dropPiece = id => { // collapse: the piece leaves the house and falls
          if (hiddenPieces.has(id) || bodies.has(id)) return; const list = [], rr = rngString(id);
          for (const it of structure.meshesOf(id)) { if (it.obj) { hide(it); continue; } const m = extract(it); hide(it); const hy = (m.geometry.boundingBox.max.y - m.geometry.boundingBox.min.y) / 2; list.push({ mesh: m, vy: 0, hy, y0: m.position.y, rot: 0, w: [(rr() - 0.5) * 0.5, (rr() - 0.5) * 0.3, (rr() - 0.5) * 0.5], landing: false }); }
          hiddenPieces.add(id); if (list.length) bodies.set(id, list); invalidate(); invalidateShadow();
        };
        D.restore = () => { // everything goes back to what it was (after world.reset)
          breach.restore(); if (R && D.id && D.active) R.restore(D.id);
          for (const id of hiddenPieces) for (const it of structure.meshesOf(id)) show(it);
          hiddenPieces.clear(); for (const l of bodies.values()) for (const b of l) { b.mesh.removeFromParent(); b.mesh.geometry.dispose(); } bodies.clear();
          for (const f of frags) f.mesh.removeFromParent(); frags.length = 0; flow = 0; if (water.leak) water.leak(0);
          for (const l of facets.values()) for (const d of l) d.hp = d.hpMax; invalidate(); invalidateShadow();
        };
        const fragments = e => {
          const scene = root.parent; if (!scene || !e.fragments) return; const n = Math.min(e.fragments.length, 10);
          for (let k = 0; k < n; k++) { const f = e.fragments[k], m = new THREE.Mesh(FRAGMENT_GEO, fragmentMaterial(f.material)); m.scale.set(Math.max(0.03, f.size[0]), Math.max(0.03, f.size[1]), Math.max(0.03, f.size[2])); m.position.set(f.center[0], f.center[1], f.center[2]); m.quaternion.set(f.rotation[0], f.rotation[1], f.rotation[2], f.rotation[3]); scene.add(m); frags.push({ mesh: m, v: f.velocity.slice(), t: 0, still: false, h: m.scale.y / 2 }); }
          while (frags.length > 90) { const f = frags.shift(); f.mesh.removeFromParent(); }
        };
        const facetsOf = (id, fn) => { const l = facets.get(id); if (l) for (const d of l) fn(d); };
        const handleEvent = e => {
          if (e.object !== D.id) return;
          if (cfg.onWreck) { try { cfg.onWreck(e, house); } catch (x) { console.warn('onWreck', x); } }
          for (const fn of listeners) fn(e);
          switch (e.type) {
            case 'damage': { const ps = D.world.part(D.id, e.part); if (ps && ps.maxHp) facetsOf(e.part, d => { d.hp = Math.min(d.hp, Math.ceil(d.hpMax * Math.max(0, e.hp) / ps.maxHp)); }); break; }
            case 'fracture': {
              facetsOf(e.part, d => { const before = d.hp; d.hp = 0; if (before > 0 && !inside && cfg.onDamage) { const p = Object.values<any>(parts).find(q => q.damageable === d); if (p) cfg.onDamage(p, e.point ? { x: e.point[0], y: e.point[1], z: e.point[2] } : null, 'structure'); } });
              breach.drop(e.part); if (R) break;
              const c = bodies.get(e.part); if (c) { for (const b of c) { b.mesh.removeFromParent(); b.mesh.geometry.dispose(); } bodies.delete(e.part); } else D.hide(e.part);
              fragments(e); break; }
            case 'stage': breach.stage(e); break;
            case 'chip': breach.chip(e); break;
            case 'spall': breach.spall(e); break;
            case 'collapse': for (const id of e.parts) { breach.drop(id); if (!R && structure.meshesOf(id).length) D.dropPiece(id); } break;
            case 'leak': if (e.part === 'water_tank') { flow += e.rate; if (water.leak) water.leak(flow); } break;
            default: break;
          }
        };
        D.sync = () => { if (!D.active) return; house.updateMatrixWorld(true); const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); house.matrixWorld.decompose(p, q, sc); D.world.setTransform(D.id, [p.x, p.y, p.z], [q.x, q.y, q.z, q.w]); };
        // part id -> what draws it: a loose group, a whole mesh, or the vertex range of a merged mesh (the renderer's bind option)
        const rangesOf = () => {
          const out: Record<string, any[]> = {};
          for (const id of structure.byId.keys()) {
            const items = structure.meshesOf(id).map(it => (it.obj ? it.obj : it.whole ? it.mesh : { mesh: it.mesh, range: [it.v0, it.v1] }));
            if (items.length) out[id] = items;
          }
          return out;
        };
        D.ranges = rangesOf;
        D.activate = (world, specOptions) => { // specOptions: options of house.structure.spec (e.g. {infill:true} = only pillars, beams, slab and roof carry)
          if (world) D.world = world; if (D.active || !D.world) return D; house.updateMatrixWorld(true);
          const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); house.matrixWorld.decompose(p, q, sc);
          D.specOptions = specOptions || null; D.spec = structure.spec(specOptions); D.id = D.world.add(D.spec, { id: 'house3d:' + (++shared.destructionSeq), position: [p.x, p.y, p.z], rotation: [q.x, q.y, q.z, q.w] });
          breach.claim(); if (R) R.bind(D.id, house, { parts: rangesOf(), onFrame: () => breach.flush() });
          off = D.world.on('*', handleEvent); D.active = true; return D;
        };
        D.deactivate = () => { if (off) off(); off = null; D.restore(); if (R && D.id && D.active) R.unbind(D.id); if (D.active && D.world.has(D.id)) D.world.remove(D.id); D.active = false; };
        // follow: an object some other code added to the world with this house's spec (a free-standing wall in a test room) is drawn by its renderer; the house
        // keeps only what that renderer cannot draw on it, the units of a wall that come out (chips and breach). Returns what undoes it.
        D.follow = (world, id, spec) => {
          D.spec = spec; breach.claim();
          let fallback: ReturnType<typeof setTimeout> | null = null;
          const offFollow = world.on('*', e => {
            if (e.object !== id) return;
            switch (e.type) {
              case 'stage': breach.stage(e); break;
              case 'chip': breach.chip(e); break;
              case 'spall': breach.spall(e); break;
              case 'fracture': breach.drop(e.part); break;
              case 'collapse': for (const p of e.parts) breach.drop(p); break;
              default: break;
            }
            // a host that never calls `update` still gets the damage painted
            if (!fallback && typeof setTimeout === 'function') fallback = setTimeout(() => { fallback = null; breach.flush(Infinity); }, FOLLOW_FLUSH_FALLBACK_MS);
          });
          return { restore: () => breach.restore(), dispose: () => { offFollow(); breach.restore(); }, update: () => { breach.flush(); } };
        };
        D.piece = id => (D.active ? D.world.part(D.id, id) : null);
        D.state = () => (D.active ? D.world.state(D.id) : null);
        D.reset = () => { if (D.active) D.world.reset(D.id); D.restore(); };
        // hit: the legacy `damage` becomes a hit in the core (amount/hpMax of the damageable = fraction of the piece's hp). A shot with a point on the piece goes in as ballistic; with no hit, as blunt.
        D.strike = (pid, point, type, amount, d) => {
          if (!D.world || !structure.byId.has(pid)) return null; D.activate(); if (!D.active) return null; const ps = D.world.part(D.id, pid); if (!ps || ps.status === 'broken') return null;
          D.sync(); const fraction = d && d.hpMax ? (amount != null ? amount : 1) / d.hpMax : 0.25, energy = Math.max(1, fraction * ps.maxHp / 0.02);
          const pc = structure.byId.get(pid), c0 = point ? null : house.localToWorld(new THREE.Vector3((pc.aabb[0] + pc.aabb[2]) / 2, (pc.y0 + pc.y1) / 2, (pc.aabb[1] + pc.aabb[3]) / 2)), pt = point ? [point.x, point.y, point.z] : [c0.x, c0.y, c0.z]; let r = null; inside = true;
          try {
            if (type === 'fire') r = D.world.hitPart(D.id, pid, { type: 'fire', point: pt, temperature: 700, radius: 0.3, duration: 0.5 * (amount || 1) });
            else if (type === 'explosion') r = D.world.hitPart(D.id, pid, { type: 'explosive', point: pt, energy: energy, radius: 1.5 });
            else {
              if (type !== 'strike' && point) r = D.world.hitPart(D.id, pid, { type: 'ballistic', point: pt, direction: [0, 0, -1], energy: energy, caliber: 9 });
              if (!r || !(r.damage > 0)) r = D.world.hitPart(D.id, pid, { type: 'blunt', point: pt, energy: energy, radius: 0.35 });
            }
          } finally { inside = false; }
          return r;
        };
        D.animate = dt => {
          breach.flush(); // the damage of this frame's events is painted once, here, instead of once per event
          if (R) return; // the renderer steps fragments and loose pieces in its own update
          let moved = false;
          for (const [id, list] of bodies) {
            for (const b of list) { if (b.landing) continue; moved = true; b.vy -= 9.8 * dt; b.mesh.position.y += b.vy * dt; if (b.rot < 0.5) { b.mesh.rotation.x += b.w[0] * dt; b.mesh.rotation.y += b.w[1] * dt; b.mesh.rotation.z += b.w[2] * dt; b.rot += dt; } if (b.mesh.position.y <= b.hy) { b.mesh.position.y = b.hy; b.landing = true; } }
            if (!list.impacted && list.every(b => b.landing)) { // landed: the impact (mass x height) fractures the piece in the core
              list.impacted = true; const ps = D.active ? D.world.part(D.id, id) : null; const b = list[0];
              if (ps && ps.status !== 'broken') { const h = Math.max(0.5, b.y0 - b.hy), c = worldPoint(b.mesh.parent, b.mesh.position); D.world.hitPart(D.id, id, { type: 'blunt', point: [c.x, c.y, c.z], energy: ps.mass * 9.8 * h, radius: 0.5, source: 'fall' }); }
            }
          }
          const scene = root.parent, ground = scene ? root.getWorldPosition(new THREE.Vector3()).y : 0;
          for (let i = frags.length - 1; i >= 0; i--) {
            const f = frags[i]; f.t += dt; if (f.t > 14) { f.mesh.removeFromParent(); frags.splice(i, 1); moved = true; continue; }
            if (f.still) continue; moved = true; f.v[1] -= 9.8 * dt; f.mesh.position.x += f.v[0] * dt; f.mesh.position.y += f.v[1] * dt; f.mesh.position.z += f.v[2] * dt; f.mesh.rotation.x += f.v[0] * dt; f.mesh.rotation.z += f.v[2] * dt;
            if (f.mesh.position.y <= ground + f.h) { f.mesh.position.y = ground + f.h; if (Math.abs(f.v[1]) > 1.5) { f.v[1] *= -0.3; f.v[0] *= 0.6; f.v[2] *= 0.6; } else f.still = true; }
          }
          if (moved) invalidate();
        };
        D.statistics = () => ({ hiddenPieces: hiddenPieces.size, falling: bodies.size, fragments: frags.length, breached: breach.statistics() });
        return D;
      }
  Object.assign(K, { createHouseDestruction });
}
