import { GL_NOISE } from './noise'

/**
 * The puff shader, from the Lab's (L130-192): a noise-swollen sphere per puff, the Lab's heat ramp for what still burns. Smoke is soft and seen through: its normal is
 * the sphere's, roughened by noise (never the flat facets, which read as a grey rock), its light continuous, its edge thins to nothing where the camera grazes it,
 * and it thins out as it ages instead of being cut away. The hot core of a fireball stays opaque. Soot (a black smoke) keeps a floor of albedo and a rim lit by the
 * sky, so it reads as a cloud and not as a flat black blob. The r160 colour-space chunk (`encodings_fragment` of r128 is `colorspace_fragment` now).
 */
export const PUFF_VERTEX = `${GL_NOISE}
attribute vec4 aP;attribute vec4 aD;attribute vec3 aC;
varying vec3 vWP;varying vec3 vL;varying vec4 vD;varying vec3 vC;varying vec3 vN;
void main(){
  vec3 p=position;
  vec3 q=normalize(position);
  float s=aD.z;
  float n=vn(p*1.6+vec3(s*11.0,s*7.0,s*3.0));
  p*=0.78+0.5*n;
  float a=s*6.2831;float c=cos(a),si=sin(a);p.xz=mat2(c,-si,si,c)*p.xz;q.xz=mat2(c,-si,si,c)*q.xz;
  vL=p;vN=q;
  vec3 wp=aP.xyz+p*aP.w;
  vWP=wp;vD=aD;vC=aC;
  gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.0);
}`

export const PUFF_FRAGMENT = `${GL_NOISE}
uniform vec3 uLight;uniform vec3 uSky;uniform vec3 uGround;uniform vec3 uGlowPos;uniform vec3 uGlowCol;uniform float uGlowI;
varying vec3 vWP;varying vec3 vL;varying vec4 vD;varying vec3 vC;varying vec3 vN;
vec3 L(vec3 c){return pow(c,vec3(2.2));}
vec3 ramp(float h){
  vec3 c0=L(vec3(.36,.07,.03)),c1=L(vec3(.76,.21,.1)),c2=L(vec3(1.,.54,.16)),c3=L(vec3(1.,.83,.42)),c4=L(vec3(1.,.96,.84));
  if(h<.25)return mix(c0,c1,h/.25);
  if(h<.5)return mix(c1,c2,(h-.25)/.25);
  if(h<.8)return mix(c2,c3,(h-.5)/.3);
  return mix(c3,c4,clamp((h-.8)/.4,0.,1.));
}
void main(){
  float age=vD.x,heat=vD.y,kind=vD.w;
  float n=vn(vL*2.4+vD.z*13.0);
  // the sphere's own normal, roughened by the noise: a billowing cloud, never facets
  vec3 g=vec3(vn(vL*3.1+vD.z*5.0),vn(vL*3.1+vD.z*5.0+7.3),vn(vL*3.1+vD.z*5.0+13.7))-.5;
  vec3 N=normalize(normalize(vN)+g*.9);
  vec3 V=normalize(cameraPosition-vWP);
  float lam=max(dot(N,uLight),0.);
  float light=.42+.62*smoothstep(-.1,.9,lam);
  float dark=1.-smoothstep(.02,.12,dot(vC,vec3(.2126,.7152,.0722)));
  vec3 alb=max(vC,vec3(.055)*dark);
  vec3 col=alb*(vec3(.5,.56,.7)*light*1.05+vec3(.2,.19,.18)+uGround*(.4-.4*N.y));
  float rim=pow(1.-clamp(abs(dot(normalize(vN),V)),0.,1.),2.);
  col+=dark*rim*(uSky*.9+alb);
  vec3 tg=uGlowPos-vWP;float dg=length(tg)+.001;
  float gi=uGlowI/(1.+dg*dg*.05)*(.3+.7*max(dot(N,tg/dg),0.));
  col+=uGlowCol*gi*alb*1.6;
  // seen through: thin where the camera grazes the puff, thicker where the noise is, thinning out with age
  float facing=abs(dot(normalize(vN),V));
  float alpha=smoothstep(.0,.75,facing)*(.35+.65*smoothstep(.2,.8,n))*(1.-smoothstep(.3,1.,age))*.78;
  float h=heat*(.72+.56*n)+heat*(-N.y)*.18;
  if(h>.05){
    vec3 fc=ramp(clamp(h,0.,1.2))*(1.1+3.1*h);
    float hot=smoothstep(.04,.2,h);
    col=mix(col,fc,hot);
    alpha=max(alpha,hot*smoothstep(.0,.45,facing)*(1.-smoothstep(.5,1.,age)));
  }
  if(kind>2.5&&kind<3.5){col+=vec3(.02,.025,.03);}
  if(alpha<.01)discard;
  gl_FragColor=vec4(col,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`
