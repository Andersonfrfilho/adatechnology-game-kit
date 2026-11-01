import type { Kernel, Shared } from '../kernel-types.js';

export function installLightsRoomLight(K: Kernel, shared: Shared): void {
  const { THREE, rectsOf, cfg } = K;
      // ====================== R62: per-room lighting ======================
      // A room's light does not cross walls or slabs: each PointLight carries a "box" (x/z rectangles of the room, a y band, and optionally an exclusion box for the outside lamp) and the material shader
      // multiplies the light by 1 inside the box and 0 outside. Only the 1 or 2 rooms closest to the camera cast shadows (512 cube); in the others the mask does the job. A "fake indirect" (weak ambient light limited to the box) lights the faces turned away from the lamp.
  const MAX_LIGHTS = 12, EMPTY = [1e9, 1e9, -1e9, -1e9];
  const LZU = { uRB0: { value: new Float32Array(MAX_LIGHTS * 4) }, uRB1: { value: new Float32Array(MAX_LIGHTS * 4) }, uRB2: { value: new Float32Array(MAX_LIGHTS * 4) }, uRBY: { value: new Float32Array(MAX_LIGHTS * 2) }, uREx: { value: new Float32Array(MAX_LIGHTS * 4) }, uIndK: { value: 0.06 } };
  for (let i = 0; i < MAX_LIGHTS; i++) for (const k of ['uRB0', 'uRB1', 'uRB2', 'uREx']) LZU[k].value.set(EMPTY, i * 4);
  function roomLightMask(m) { // applies the per-room light mask to a material with lights (Lambert, Phong, Standard); idempotent
        if (!m || (m.userData && m.userData.roomLightMask) || !(m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) return m;
        m.userData = m.userData || {}; m.userData.roomLightMask = true; const prev = m.onBeforeCompile, pk = m.customProgramCacheKey;
        m.onBeforeCompile = function (sh, r) {
          if (prev) prev.call(this, sh, r);
          if (!sh || !sh.fragmentShader) return; if (sh.uniforms) Object.assign(sh.uniforms, LZU); // (an inspection call without uniforms/vertexShader also passes)
          if (sh.vertexShader) sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vRoomW;\nvoid main() {').replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRoomW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
          sh.fragmentShader = sh.fragmentShader.replace('void main() {', `varying vec3 vRoomW;
  #if NUM_POINT_LIGHTS > 0
  uniform vec4 uRB0[ NUM_POINT_LIGHTS ]; uniform vec4 uRB1[ NUM_POINT_LIGHTS ]; uniform vec4 uRB2[ NUM_POINT_LIGHTS ]; uniform vec2 uRBY[ NUM_POINT_LIGHTS ]; uniform vec4 uREx[ NUM_POINT_LIGHTS ];
  #endif
  uniform float uIndK;
  bool inRoomR( vec4 r, vec3 p ) { return p.x >= r.x && p.x <= r.z && p.z >= r.y && p.z <= r.w; }
  float roomMask( vec4 a, vec4 b, vec4 c, vec2 yy, vec4 ex ) {
    vec3 p = vRoomW; float k = ( inRoomR( a, p ) || inRoomR( b, p ) || inRoomR( c, p ) ) ? 1.0 : 0.0;
    k *= ( p.y >= yy.x && p.y <= yy.y ) ? 1.0 : 0.0; if ( inRoomR( ex, p ) ) k = 0.0; return k;
  }
  void main() {`).replace('getPointLightInfo( pointLight, geometryPosition, directLight );', `getPointLightInfo( pointLight, geometryPosition, directLight );
  		float rmk = roomMask( uRB0[ i ], uRB1[ i ], uRB2[ i ], uRBY[ i ], uREx[ i ] );
  		directLight.color *= rmk;
  		reflectedLight.indirectDiffuse += BRDF_Lambert( material.diffuseColor ) * pointLight.color * ( rmk * uIndK * ( 1.0 - smoothstep( 0.0, max( pointLight.distance, 0.1 ), length( pointLight.position - geometryPosition ) ) ) );`);
        };
        m.customProgramCacheKey = function () { return (pk ? pk.call(this) : '') + '|rm1'; };
        m.needsUpdate = true; return m;
      }
  function lighting(o) {
        o = o || {}; const scene = o.scene, N = Math.max(1, Math.min(MAX_LIGHTS, o.n || 6)), NS = Math.max(0, Math.min(N, o.shadows != null ? o.shadows : 2)), size = o.shadowSize || 512, MAX_EXTERNAL = o.external != null ? o.external : 2;
        for (const k of Object.keys(shared.mats)) roomLightMask(shared.mats[k]);
        // with a LightBudget the house leases its slots for good: the shader index of a light is its slot, so the masks are written at handle.slot (and sized to the budget)
        const budget = o.budget, lease = budget ? budget.lease({ owner: 'floorplan.rooms', point: N, shadows: NS }) : null;
        if (budget && !lease) throw new Error('lighting: the LightBudget has no ' + N + ' free point slots (' + NS + ' with shadow) for the rooms');
        if (budget) for (const [key, width] of [['uRB0', 4], ['uRB1', 4], ['uRB2', 4], ['uRBY', 2], ['uREx', 4]] as const) { const next = new Float32Array(budget.sizes.point * width); if (width === 4) for (let i = 0; i < budget.sizes.point; i++) next.set(EMPTY, i * 4); LZU[key].value = next; }
        const PL = [], sig = new Array(N).fill(''), seg = { n: 0 };
        if (!lease) for (let i = 0; i < N; i++) {
          // eslint-disable-next-line no-restricted-syntax -- D2: legacy path without LightBudget, removed in the next major
          const l = new THREE.PointLight(0xffc880, 0, 8, 1.6); l.visible = true; l.castShadow = i < NS; l.name = 'room_light_' + i;
          if (i < NS) { l.shadow.mapSize.set(size, size); l.shadow.bias = -0.0012; l.shadow.normalBias = 0.05; l.shadow.camera.near = 0.12; l.shadow.autoUpdate = false; l.shadow.needsUpdate = true; }
          if (scene) scene.add(l); PL.push(l);
        }
        const slotOf = i => lease ? lease.handles[i].slot : i;
        const put = (i, v) => {
          if (lease) { lease.handles[i].update(v.color === undefined || typeof v.color === 'number' ? v : { ...v, color: new THREE.Color(v.color).getHex() }); return; }
          const pl = PL[i]; if (v.position) pl.position.set(v.position[0], v.position[1], v.position[2]); if (v.color !== undefined) pl.color.set(v.color);
          if (v.intensity !== undefined) pl.intensity = v.intensity; if (v.distance !== undefined) pl.distance = v.distance; if (v.decay !== undefined) pl.decay = v.decay;
        };
        const effects = lease ? effectLights({ budget, ours: lease.handles.map(h => h.slot) }) : null;
        const A: any = { lights: lease ? lease.handles : PL, crates: new Array(N).fill(null), n: N, shadows: NS, stats: { rooms: 0, external: 0, shadows: 0, shadowChanged: false }, indirect: v => { LZU.uIndK.value = v; } };
        const _p = new THREE.Vector3(), _f = new THREE.Vector3();
        const lim = (v, a, b) => Math.max(a, Math.min(b, v));
        A.invalidate = () => { if (lease) { lease.invalidateShadow(); return; } for (let i = 0; i < NS; i++) PL[i].shadow.needsUpdate = true; };
        // houses: [house] (or one house); focus: world THREE.Vector3 (first-person camera or orbit target); op: {maxFloor: -1 all, focusHouse, focusRoom: id of the room the camera is in}
        A.update = function (houses, focus, op) {
          op = op || {}; houses = (Array.isArray(houses) ? houses : [houses]).filter(Boolean); _f.set(focus.x, focus.y, focus.z);
          const rooms = [], exterior = [];
          for (const house of houses) {
            if (house.group && !house.group.visible) continue; house.house.updateMatrixWorld(true); const M = house.house.matrixWorld, by = new Map();
            for (const l of house.lights.list) {
              if (op.floorMax != null && op.floorMax >= 0 && l.floor > op.floorMax) continue; if (!house.lightOn(l.roomId)) continue;
              const k = l.type === 'outdoor' ? 'ext:' + (l.id || exterior.length) : (l.roomId != null ? l.roomId : l.room); let g = by.get(k); if (!g) by.set(k, g = { k, house, ls: [], exterior: l.type === 'outdoor' }); g.ls.push(l);
            }
            for (const g of by.values()) {
              const ls = g.ls, n = ls.length; let cx = 0, cy = 0, cz = 0, range = 0; for (const l of ls) { _p.set(l.x, l.y, l.z).applyMatrix4(M); cx += _p.x; cy += _p.y; cz += _p.z; range = Math.max(range, l.range || 5); } cx /= n; cy /= n; cz /= n; g.pos = [cx, cy, cz]; g.color = ls[0].color; g.n = n; g.range = range;
              if (g.exterior) { g.rects = [[cx - 7, cz - 7, cx + 7, cz + 7]]; g.y = [cy - 3.2, cy + 4]; let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const c of house.r.rooms) { if (c.type === 'void') continue; for (const [a, b, c2, d] of rectsOf(c)) for (const [u, v] of [[a, b], [c2, b], [a, d], [c2, d]]) { _p.set(u, 0, v).applyMatrix4(M); x0 = Math.min(x0, _p.x); x1 = Math.max(x1, _p.x); z0 = Math.min(z0, _p.z); z1 = Math.max(z1, _p.z); } } g.exclusion = [x0 + 0.03, z0 + 0.03, x1 - 0.03, z1 - 0.03]; g.lumens = ls[0].lumens != null ? ls[0].lumens : 3.2; g.dist = ls[0].dist != null ? ls[0].dist : 5.5; g.decay = ls[0].decay != null ? ls[0].decay : 2; }
              else {
                const c = house.r.rooms.find(q => q.id === g.k); if (!c) continue; const rs = []; let ymin = 1e9, ymax = -1e9;
                for (const [a, b, c2, d] of rectsOf(c)) { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [u, v] of [[a, b], [c2, b], [a, d], [c2, d]]) { _p.set(u, house.y0(c.floor), v).applyMatrix4(M); x0 = Math.min(x0, _p.x); x1 = Math.max(x1, _p.x); z0 = Math.min(z0, _p.z); z1 = Math.max(z1, _p.z); ymin = Math.min(ymin, _p.y); } rs.push([x0 - 0.08, z0 - 0.08, x1 + 0.08, z1 + 0.08]); }
                _p.set(0, house.y0(c.floor), 0).applyMatrix4(M); const yb = _p.y; g.y = [yb - 0.06, yb + (c.ceiling || 2.8) + 0.3]; ymax = g.y[1]; void ymin; void ymax;
                while (rs.length > 3) { const b2 = rs.pop(), a2 = rs[rs.length - 1]; rs[rs.length - 1] = [Math.min(a2[0], b2[0]), Math.min(a2[1], b2[1]), Math.max(a2[2], b2[2]), Math.max(a2[3], b2[3])]; }
                g.rects = rs; g.floor = c.floor; g.exclusion = null; g.roomId = c;
                let dm = 0; for (const [a, b, c2, d] of rs) for (const [x, z] of [[a, b], [c2, b], [a, d], [c2, d]]) dm = Math.max(dm, Math.hypot(x - cx, z - cz)); g.dm = dm;
              }
              // distance from the camera to the room (box), 0 if inside it
              let dd = 1e9; for (const [a, b, c2, d] of g.rects) { const dx = Math.max(a - _f.x, 0, _f.x - c2), dz = Math.max(b - _f.z, 0, _f.z - d); dd = Math.min(dd, Math.hypot(dx, dz)); } const dy = Math.max(g.y[0] - _f.y, 0, _f.y - g.y[1]); g.d = Math.hypot(dd, dy * 2.5);
              if (op.focusRoom && house === op.focusHouse && g.k === op.focusRoom) g.d = -1;
              (g.exterior ? exterior : rooms).push(g);
            }
          }
          rooms.sort((a, b) => a.d - b.d); exterior.sort((a, b) => a.d - b.d);
          const Ne = Math.min(MAX_EXTERNAL, exterior.length, Math.max(0, N - 1)), Ni = Math.min(rooms.length, N - Ne), asg = rooms.slice(0, Ni).concat(exterior.slice(0, Ne));
          A.stats.rooms = Ni; A.stats.external = Ne; let shadows = 0;
          for (let i = 0; i < N; i++) {
            const g = asg[i], at = slotOf(i), b0 = LZU.uRB0.value, b1 = LZU.uRB1.value, b2 = LZU.uRB2.value, by = LZU.uRBY.value, ex = LZU.uREx.value;
            A.crates[i] = g ? { k: g.k, rects: g.rects, y: g.y, exterior: !!g.exterior, exclusion: g.exclusion || null, d: g.d } : null;
            if (!g) { put(i, { intensity: 0 }); for (const a of [b0, b1, b2, ex]) a.set(EMPTY, at * 4); by.set([0, 0], at * 2); continue; }
            const lamp = g.exterior ? { intensity: g.lumens, distance: g.dist, decay: g.decay } : { intensity: (7 + g.range * 0.8) * lim(1 + 0.4 * (Math.sqrt(g.n) - 1), 1, 2.2), distance: Math.max(3, g.dm * 1.3 + 0.5), decay: 1.6 };
            put(i, { position: g.pos, color: g.color, ...lamp });
            const rs = g.rects; b0.set(rs[0] || EMPTY, at * 4); b1.set(rs[1] || EMPTY, at * 4); b2.set(rs[2] || EMPTY, at * 4); by.set(g.y, at * 2); ex.set(g.exclusion || EMPTY, at * 4);
            if (i < NS) { shadows++; const s2 = g.house.group.uuid + '|' + g.k + '|' + g.pos.map(v => v.toFixed(2)).join(','); if (sig[i] !== s2) { sig[i] = s2; if (lease) lease.invalidateShadow(i); else PL[i].shadow.needsUpdate = true; seg.n++; A.stats.shadowChanged = true; } if (!lease) PL[i].shadow.camera.far = Math.max(4, lamp.distance); }
          }
          if (effects) effects.update(houses);
          A.stats.shadows = shadows; return A.stats;
        };
        A.dispose = () => { if (lease) { lease.release(); return; } for (const l of PL) { if (l.shadow && l.shadow.map) l.shadow.map.dispose(); l.removeFromParent(); } };
        return A;
      }
  // effect lights (a blast, a fire, a flare) hold budget slots that are not the house's: their mask lets the light into the room where the light point is, and into the rooms either side of an open door or a
  // window the point is next to; with `effectLightsIndoors: false` they light no house surface at all (empty box). Works without `lighting()`: a game that lights its rooms some other way still gets the blast.
  const effectsByBudget = new WeakMap();
  const OPENING_REACH = 2.5, OPENING_SIDE = 0.6;
  function effectLights(o) {
    o = o || {}; const budget = o.budget; if (!budget) throw new Error('effectLights: a LightBudget is required');
    const known = effectsByBudget.get(budget); if (known && !o.ours) return known;
    const ours = new Set(o.ours || []), size = budget.sizes.point, _p = new THREE.Vector3(), P0 = new THREE.Vector3();
    for (const [key, width] of [['uRB0', 4], ['uRB1', 4], ['uRB2', 4], ['uRBY', 2], ['uREx', 4]] as const) { const had = LZU[key].value; if (had.length >= size * width) continue; const next = new Float32Array(size * width); if (width === 4) for (let i = 0; i < size; i++) next.set(EMPTY, i * 4); next.set(had); LZU[key].value = next; }
    const roomBoxes = (house, M) => {
      const list = [];
      for (const c of house.r.rooms) {
        if (c.type === 'void') continue; const rs = [];
        for (const [a, b, c2, d] of rectsOf(c)) { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [u, v] of [[a, b], [c2, b], [a, d], [c2, d]]) { _p.set(u, 0, v).applyMatrix4(M); x0 = Math.min(x0, _p.x); x1 = Math.max(x1, _p.x); z0 = Math.min(z0, _p.z); z1 = Math.max(z1, _p.z); } rs.push([x0 - 0.08, z0 - 0.08, x1 + 0.08, z1 + 0.08]); }
        _p.set(0, house.y0(c.floor), 0).applyMatrix4(M); list.push({ c, rs, y: [_p.y - 0.06, _p.y + (c.ceiling || 2.8) + 0.3] });
      }
      return list;
    };
    const boxAt = (boxes, x, y, z) => boxes.find(q => y >= q.y[0] && y <= q.y[1] && q.rs.some(r => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]));
    const openingSides = (house, M, boxes, into) => {
      const open = (house.internal && house.internal.doorState) || new Map();
      const reach = (list, isDoor) => {
        for (const p of list || []) {
          if (isDoor && !(open.has(p.id) ? open.get(p.id) : !!p.open)) continue;
          const alongU = p.axis === 'u', y = house.y0(p.floor) + (isDoor ? 1 : ((p.y0 != null ? p.y0 : 0.9) + (p.y1 != null ? p.y1 : 2)) / 2);
          const at = (side) => _p.set(alongU ? p.at : p.pos + side, y, alongU ? p.pos + side : p.at).applyMatrix4(M).clone();
          if (at(0).distanceTo(P0) > OPENING_REACH) continue;
          for (const side of [-OPENING_SIDE, OPENING_SIDE]) { const w = at(side), hit = boxAt(boxes, w.x, w.y, w.z); if (hit) into.set(hit.c, hit); }
        }
      };
      reach(house.r.doors, true); reach(house.r.windows, false);
    };
    const clear = (at) => { for (const key of ['uRB0', 'uRB1', 'uRB2', 'uREx']) LZU[key].value.set(EMPTY, at * 4); LZU.uRBY.value.set([0, 0], at * 2); };
    const write = (at, into) => {
      const rs = []; let lo = 1e9, hi = -1e9; for (const q of into.values()) { rs.push(...q.rs); lo = Math.min(lo, q.y[0]); hi = Math.max(hi, q.y[1]); }
      while (rs.length > 3) { const r2 = rs.pop(), r1 = rs[rs.length - 1]; rs[rs.length - 1] = [Math.min(r1[0], r2[0]), Math.min(r1[1], r2[1]), Math.max(r1[2], r2[2]), Math.max(r1[3], r2[3])]; }
      LZU.uRB0.value.set(rs[0] || EMPTY, at * 4); LZU.uRB1.value.set(rs[1] || EMPTY, at * 4); LZU.uRB2.value.set(rs[2] || EMPTY, at * 4); LZU.uRBY.value.set([lo, hi], at * 2); LZU.uREx.value.set(EMPTY, at * 4);
    };
    const A: any = {
      /** Once per frame, after the budget's `present`: points the mask of every lit slot that is not the house's at the rooms its light reaches. */
      update(houses) {
        const indoors = cfg.effectLightsIndoors !== false, list = (Array.isArray(houses) ? houses : [houses]).filter(Boolean), cache = new Map();
        for (let at = 0; at < size; at++) {
          if (ours.has(at)) continue; const light: any = budget.group.children[at];
          if (!indoors || !light || !light.isPointLight || !(light.intensity > 0) || !light.visible) { clear(at); continue; }
          const into = new Map(); P0.set(light.position.x, light.position.y, light.position.z);
          for (const house of list) {
            if (house.group && !house.group.visible) continue; house.house.updateMatrixWorld(true); const M = house.house.matrixWorld;
            let boxes = cache.get(house); if (!boxes) cache.set(house, boxes = roomBoxes(house, M));
            const here = boxAt(boxes, P0.x, P0.y, P0.z); if (here) into.set(here.c, here); openingSides(house, M, boxes, into);
          }
          if (into.size) write(at, into); else clear(at);
        }
      },
    };
    if (!o.ours) effectsByBudget.set(budget, A);
    return A;
  }
  Object.assign(K, { MAX_LIGHTS, EMPTY, LZU, roomLightMask, lighting, effectLights });
}
