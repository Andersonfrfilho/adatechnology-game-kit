import { GL_NOISE } from './noise'

/**
 * The puff shader of the Lab (L130-192), verbatim: a faceted icosahedron per puff, a five-band posterised heat ramp, a noise dissolve and banded light.
 * The only change is the r160 colour-space chunk: `encodings_fragment` (r128) is `colorspace_fragment` now.
 */
export const PUFF_VERTEX = `${GL_NOISE}
attribute vec4 aP;attribute vec4 aD;attribute vec3 aC;
varying vec3 vWP;varying vec3 vL;varying vec4 vD;varying vec3 vC;
void main(){
  vec3 p=position;
  float s=aD.z;
  float n=vn(p*1.6+vec3(s*11.0,s*7.0,s*3.0));
  p*=0.78+0.5*n;
  float a=s*6.2831;float c=cos(a),si=sin(a);p.xz=mat2(c,-si,si,c)*p.xz;
  vL=p;
  vec3 wp=aP.xyz+p*aP.w;
  vWP=wp;vD=aD;vC=aC;
  gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.0);
}`

export const PUFF_FRAGMENT = `${GL_NOISE}
uniform vec3 uLight;uniform vec3 uSky;uniform vec3 uGround;uniform vec3 uGlowPos;uniform vec3 uGlowCol;uniform float uGlowI;
varying vec3 vWP;varying vec3 vL;varying vec4 vD;varying vec3 vC;
vec3 L(vec3 c){return pow(c,vec3(2.2));}
vec3 ramp(float h){
  vec3 c0=L(vec3(.36,.07,.03)),c1=L(vec3(.76,.21,.1)),c2=L(vec3(1.,.54,.16)),c3=L(vec3(1.,.83,.42)),c4=L(vec3(1.,.96,.84));
  if(h<.25)return mix(c0,c1,h/.25);
  if(h<.5)return mix(c1,c2,(h-.25)/.25);
  if(h<.8)return mix(c2,c3,(h-.5)/.3);
  return mix(c3,c4,clamp((h-.8)/.4,0.,1.));
}
void main(){
  vec3 N=normalize(cross(dFdx(vWP),dFdy(vWP)));
  float age=vD.x,heat=vD.y,kind=vD.w;
  float n=vn(vL*2.4+vD.z*13.0);
  float diss=smoothstep(.5,1.,age);
  if(n<diss*1.08-.04)discard;
  float lam=max(dot(N,uLight),0.);
  float band=lam>.55?1.:lam>.15?.68:.42;
  vec3 col=vC*(vec3(.5,.56,.7)*band*1.05+vec3(.2,.19,.18)+uGround*(.4-.4*N.y));
  vec3 tg=uGlowPos-vWP;float dg=length(tg)+.001;
  float gi=uGlowI/(1.+dg*dg*.05)*(.3+.7*max(dot(N,tg/dg),0.));
  col+=uGlowCol*gi*vC*1.6;
  float h=heat*(.72+.56*n)+heat*(-N.y)*.18;
  if(h>.05){
    float hq=floor(h*5.+.5)/5.;
    vec3 fc=ramp(clamp(hq,0.,1.2))*(1.1+3.1*hq);
    col=mix(col,fc,smoothstep(.04,.2,h));
  }
  if(kind>2.5&&kind<3.5){col+=vec3(.02,.025,.03);}
  gl_FragColor=vec4(col,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`
