import type { MaterialOptions, ThreeNS, VegetationMaterials, WindSettings, ActorInput } from './types'
import { MAX_ACTORS } from './types'
import { resolveMaterialIds } from '../destruction'

const COMMON = /* glsl */ `
#include <common>
attribute float sway;
uniform float uVegTime;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform float uWindGust;
uniform vec4 uActors[${MAX_ACTORS}];
vec3 vegDisplace( vec3 wp, vec3 origin, float s ) {
  float ph = dot( origin.xz, vec2( 1.7, 1.3 ) ) + dot( wp.xz, vec2( 0.35, 0.25 ) );
  float t = uVegTime;
  float w = sin( t * 1.6 + ph ) * 0.6 + sin( t * 3.3 + ph * 1.9 + 1.3 ) * 0.4;
  float g = 0.5 + 0.5 * sin( t * 0.45 + ph * 0.3 );
  float m = s * ( uWindStrength * ( 0.5 + 0.5 * w ) * 0.14 + uWindGust * g * 0.22 );
  float flutter = s * s * uWindStrength * sin( t * 7.0 + ph * 3.1 ) * 0.025;
  wp.xz += uWindDir * ( m + flutter );
  wp.y -= abs( m ) * 0.25;
  for ( int i = 0; i < ${MAX_ACTORS}; i ++ ) {
    vec4 a = uActors[ i ];
    if ( a.w > 0.0 ) {
      vec2 dv = wp.xz - a.xz;
      float d = length( dv );
      float f = ( 1.0 - smoothstep( 0.0, a.w, d ) ) * ( 1.0 - smoothstep( 1.6, 2.4, abs( wp.y - a.y ) ) );
      vec2 away = d > 0.0001 ? dv / d : vec2( 1.0, 0.0 );
      wp.xz += away * f * s * a.w * 0.6;
      wp.y -= f * s * 0.18;
    }
  }
  return wp;
}
`

const PROJECT = /* glsl */ `
vec4 vegLocal = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  vegLocal = instanceMatrix * vegLocal;
  vec3 vegOrigin = ( modelMatrix * vec4( instanceMatrix[ 3 ].xyz, 1.0 ) ).xyz;
#else
  vec3 vegOrigin = modelMatrix[ 3 ].xyz;
#endif
vec4 vegWorld = modelMatrix * vegLocal;
vegWorld.xyz = vegDisplace( vegWorld.xyz, vegOrigin, sway );
vec4 mvPosition = viewMatrix * vegWorld;
gl_Position = projectionMatrix * mvPosition;
`

/**
 * Vertex-colored standard materials patched with wind sway (by the `sway` attribute) and actor bend, driven only by
 * shared uniforms: time, wind (direction / strength / gust) and up to 4 actors (vec4 x, y, z, radius).
 */
export function createVegetationMaterials(THREE: ThreeNS, opts: MaterialOptions = {}): VegetationMaterials {
  const uniforms = {
    uVegTime: { value: 0 },
    uWindDir: { value: new THREE.Vector2(1, 0.3).normalize() },
    uWindStrength: { value: 0.35 },
    uWindGust: { value: 0.15 },
    uActors: { value: Array.from({ length: MAX_ACTORS }, () => new THREE.Vector4(0, 0, 0, 0)) },
  }
  const patch = (m: InstanceType<ThreeNS['MeshStandardMaterial']>): void => {
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader.replace('#include <common>', COMMON).replace('#include <project_vertex>', PROJECT)
    }
    m.customProgramCacheKey = () => 'vegetation-sway-v1'
  }
  const flat = opts.flatShading !== false
  const rough = typeof opts.roughness === 'number' ? opts.roughness : 0.85
  const make = (flatShading: boolean, double: boolean, roughness: number) => {
    const m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading,
      roughness,
      metalness: 0,
      side: double ? THREE.DoubleSide : THREE.FrontSide,
    })
    patch(m)
    return m
  }
  const wood = make(false, false, 0.95)
  const foliage = make(flat, true, rough)
  const flowers = make(flat, true, 0.7)
  const fruit = make(flat, false, 0.55)
  const spines = make(true, true, 0.8)
  const dir = uniforms.uWindDir.value
  return {
    materialIds: resolveMaterialIds(opts.materialIds),
    wood,
    foliage,
    flowers,
    fruit,
    spines,
    update(t: number) {
      uniforms.uVegTime.value = t
    },
    setWind(w: Partial<WindSettings>) {
      if (w.direction) {
        const l = Math.hypot(w.direction[0], w.direction[1]) || 1
        dir.set(w.direction[0] / l, w.direction[1] / l)
      }
      if (w.strength !== undefined) uniforms.uWindStrength.value = w.strength
      if (w.gust !== undefined) uniforms.uWindGust.value = w.gust
    },
    setActors(actors: readonly ActorInput[]) {
      const arr = uniforms.uActors.value
      for (let i = 0; i < MAX_ACTORS; i++) {
        const a = actors[i]
        if (a) arr[i].set(a.x, a.y, a.z, a.radius)
        else arr[i].set(0, 0, 0, 0)
      }
    },
    dispose() {
      wood.dispose()
      foliage.dispose()
      flowers.dispose()
      fruit.dispose()
      spines.dispose()
    },
  }
}
