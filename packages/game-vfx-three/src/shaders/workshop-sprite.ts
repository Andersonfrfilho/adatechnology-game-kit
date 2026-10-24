/** The Workshop's soft point sprite (W168-171): the size is in metres, clamped to 1..512 px; `uSoft` is 1 for the soft (normal blend) pool. */
export const WORKSHOP_SPRITE_VERTEX = `attribute float size;attribute float alpha;attribute vec3 pcol;varying vec3 vC;varying float vA;uniform float uScale;
void main(){vC=pcol;vA=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*uScale/-mv.z,1.,512.);gl_Position=projectionMatrix*mv;}`

export const WORKSHOP_SPRITE_FRAGMENT = `uniform float uSoft;varying vec3 vC;varying float vA;
void main(){vec2 d=gl_PointCoord-.5;float r=length(d)*2.;if(r>1.)discard;float a=mix(smoothstep(1.,.78,r),pow(1.-r,1.5),uSoft);gl_FragColor=vec4(vC,vA*a);}`
