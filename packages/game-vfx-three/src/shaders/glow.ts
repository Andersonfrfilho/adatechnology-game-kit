/** The additive halo (Lab L297-304), verbatim except for the r160 colour-space chunk. */
export const GLOW_VERTEX = `attribute vec4 aP;attribute vec4 aC;varying vec2 vU;varying vec4 vC;
void main(){vec3 R=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);vec3 Up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
vec3 wp=aP.xyz+(R*position.x+Up*position.y)*aP.w;vU=position.xy;vC=aC;gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}`

export const GLOW_FRAGMENT = `varying vec2 vU;varying vec4 vC;void main(){float r=dot(vU,vU);if(r>1.)discard;float f=exp(-r*4.2)-.015;gl_FragColor=vec4(vC.rgb*vC.a*max(f,0.),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`
