import { TROUSER_PALETTE, glslColor } from './identity-layout'

const HIP_PIVOT = 'vec3(0.,0.95,0.)'

const palette = `const vec3 TROUSERS[16] = vec3[16](${TROUSER_PALETTE.map(glslColor).join(',')});`

/**
 * The code added to `BODY_CHUNK` when a body material asks for `identity` (T4b.7): it never replaces the game's chunk, it comes after it.
 * `iD` = (wounds 12 bits + freshness 4 · trousers 4 + gait style 3 + accessories 4 · clip A 4, B 4, blend 8, speed 4 · lean angle 8, amount 8), see `identity-layout.ts`.
 * `bodyAnimX` is the game's `bodyAnim` plus the gait styles (limp, drag, lurch, shamble), the stagger pose (index 8) and the lean of a shove.
 */
export const createBodyChunkExt = ({ hipHeight = 0.95 }: { readonly hipHeight?: number } = {}): string => {
  const chunk = `
  attribute vec4 iD;
  varying vec4 vWound; varying vec3 vLocal;
  ${palette}
  float idField(float value, float divisor, float modulus){ return mod(floor(value / divisor), modulus); }
  vec3 trousersOf(float code){ return TROUSERS[int(idField(code, 1., 16.))]; }
  mat3 rAxis(vec3 a, float t){ float c = cos(t), s = sin(t), k = 1. - c; return mat3(k*a.x*a.x + c, k*a.x*a.y + s*a.z, k*a.x*a.z - s*a.y, k*a.x*a.y - s*a.z, k*a.y*a.y + c, k*a.y*a.z + s*a.x, k*a.x*a.z + s*a.y, k*a.y*a.z - s*a.x, k*a.z*a.z + c); }
  float woundLevel(){ float region = (bone==1.||bone==6.||bone==11.) ? 0. : bone==0. ? 1. : (bone==2.||bone==7.) ? 2. : (bone==3.||bone==8.) ? 3. : (bone==4.||bone==9.) ? 4. : 5.; float divisor = region==0. ? 1. : region==1. ? 4. : region==2. ? 16. : region==3. ? 64. : region==4. ? 256. : 1024.; return idField(iD.x, divisor, 4.); }
  vec3 bodyAnimX(vec3 p, inout vec3 nrm){
    float pose = iB.w - floor(iB.w/16.)*16.;
    vec3 q = bodyAnim(p, nrm); vec3 n = nrm;
    float ph = iA.w*6.2831, gait = iB.z;
    float style = idField(iD.y, 16., 8.);
    bool isLeg = bone==4.||bone==5.||bone==9.||bone==10.;
    bool isThigh = bone==4.||bone==5., isArmTop = bone==2.||bone==3., isFore = bone==7.||bone==8.;
    vec3 hipJ = ${HIP_PIVOT};
    // leg gait styles: the leg swings around its own hip
    vec3 legHip = isThigh ? pivot : ppivot;
    if (isLeg) {
      bool left = bone==4.||bone==9.;
      if (style==1. && left || style==2. && !left) { mat3 m = rX(-0.32*(0.5 + 0.5*sin(ph))); q = m*(q - legHip) + legHip; n = m*n; }
      if (style==3. && left) { mat3 m = rX(0.55); q = m*(q - legHip) + legHip; n = m*n; }
    }
    if (pose==8. && (isArmTop || isFore)) { vec3 sh = isArmTop ? pivot : ppivot; mat3 m = rX(-0.95 + 0.25*sin(uTime*5. + iA.w*3.)); q = m*(q - sh) + sh; n = m*n; }
    if (!isLeg) {
      float bend = 0.;
      float sway = 0.;
      if (style==4.) bend += 0.22*pow(max(0., sin(ph*0.5)), 2.);
      if (style==5.) sway += 0.10*sin(ph);
      if (pose==8.) { bend += 0.18 + 0.22*sin(uTime*6. + iA.w*7.); sway += 0.2*sin(uTime*4.1 + iA.w*5.); }
      if (bend != 0. || sway != 0.) { mat3 m = rX(bend)*rZ(sway); q = m*(q - hipJ) + hipJ; n = m*n; }
    }
    float leanAmount = idField(iD.w, 256., 256.) / 255.;
    if (leanAmount > 0.) {
      float leanAngle = idField(iD.w, 1., 256.) / 256.*6.2831853;
      mat3 m = rAxis(vec3(cos(leanAngle), 0., -sin(leanAngle)), leanAmount*1.45);
      q = m*q; n = m*n;
    }
    nrm = n;
    return q;
  }
`
  return hipHeight === 0.95 ? chunk : chunk.replaceAll(HIP_PIVOT, `vec3(0.,${hipHeight},0.)`)
}

/** The accessory batch's chunk: the body's own with `pivot` a variable the shader sets from `refPivot` and `iAcc` (the accessory is baked once, each variant moves and scales it). */
export const ACCESSORY_PIVOT_DECLARATION = 'attribute vec3 refPivot; vec3 pivot;'

export const FRAGMENT_EXT = `
  varying vec4 vWound; varying vec3 vLocal;
  float woundHash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float woundNoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f);
    return mix(mix(mix(woundHash(i), woundHash(i + vec3(1.,0.,0.)), f.x), mix(woundHash(i + vec3(0.,1.,0.)), woundHash(i + vec3(1.,1.,0.)), f.x), f.y),
               mix(mix(woundHash(i + vec3(0.,0.,1.)), woundHash(i + vec3(1.,0.,1.)), f.x), mix(woundHash(i + vec3(0.,1.,1.)), woundHash(i + vec3(1.,1.,1.)), f.x), f.y), f.z); }
  vec3 woundTint(vec3 base){
    if (vWound.x < 0.5) return base;
    float splash = woundNoise(vLocal*26. + vWound.z*17.);
    float cover = smoothstep(0.62 - 0.14*vWound.x, 0.82, splash);
    vec3 blood = mix(vec3(0.16,0.02,0.02), vec3(0.58,0.05,0.04), vWound.y);
    return mix(base, blood, clamp(cover*(0.45 + 0.3*vWound.x), 0., 0.9));
  }
`
