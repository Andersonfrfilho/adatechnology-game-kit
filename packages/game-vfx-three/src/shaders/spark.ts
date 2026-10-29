/** The streak shader of shrapnel, sparks and embers (Lab L255-275), verbatim except for the r160 colour-space chunk. */
export const SPARK_VERTEX = `
attribute vec3 aPos;attribute vec3 aVel;attribute vec4 aE;varying vec2 vU;varying vec4 vE;
void main(){
  float sp=length(aVel)+1e-4;vec3 d=aVel/sp;
  vec3 tc=normalize(cameraPosition-aPos);
  vec3 sd=normalize(cross(d,tc)+vec3(1e-5));
  float len=max(aE.y*2.5,min(sp*aE.z,2.2));
  vec3 wp=aPos+sd*position.x*aE.y-d*position.y*len;
  vU=position.xy;vE=aE;
  gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);
}`

export const SPARK_FRAGMENT = `
varying vec2 vU;varying vec4 vE;
void main(){
  float age=vE.x,k=vE.w;
  float w=1.-abs(vU.x)*2.;w=w*w;
  float tail=1.-vU.y;
  vec3 c;
  if(k<.5){c=mix(vec3(4.,3.3,2.2),vec3(2.4,.7,.12),smoothstep(0.,.55,age));c=mix(c,vec3(.5,.06,.02),smoothstep(.55,1.,age));}
  else if(k<1.5){c=mix(vec3(1.6,1.6,1.6),vec3(.35,.35,.36),smoothstep(0.,.4,age));}
  else if(k<2.5){c=mix(vec3(5.,5.,6.),vec3(1.,1.3,2.),smoothstep(0.,.5,age));}
  else if(k<3.5){c=vec3(.9,1.2,1.4)*(1.-age);}
  else {c=mix(vec3(3.2,1.4,.3),vec3(1.2,.25,.05),age);}
  float a=w*(.35+.65*tail)*(1.-smoothstep(.75,1.,age));
  gl_FragColor=vec4(c*a,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`
