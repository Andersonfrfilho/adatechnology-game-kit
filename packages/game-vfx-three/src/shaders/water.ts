/** Shaders of the water splashes: flat marks on the surface, sprites that face the camera, and the columns and domes of thrown water. */

const NOISE = `float wHash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float wNoise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.-2.*f);return mix(mix(wHash(i),wHash(i+vec2(1.,0.)),f.x),mix(wHash(i+vec2(0.,1.)),wHash(i+vec2(1.,1.)),f.x),f.y);}`

const OUTPUT = `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>`

/** aP: x, y, z, radius. aD: alpha, kind (0 ripple, 1 shock ring, 2 wave crest, 3 foam), seed. */
export const WATER_SURFACE_VERTEX = `attribute vec4 aP;attribute vec3 aD;varying vec2 vU;varying vec3 vD;
void main(){vU=position.xz;vD=aD;vec3 w=vec3(aP.x+position.x*aP.w,aP.y+0.012,aP.z+position.z*aP.w);gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}`

export const WATER_SURFACE_FRAGMENT = `uniform vec3 uFoam;varying vec2 vU;varying vec3 vD;${NOISE}
void main(){float r=length(vU);if(r>1.)discard;float a=atan(vU.y,vU.x);float kind=vD.y;float s=vD.z;float m;
if(kind>2.5){float n=wNoise(vU*7.+s*13.)*.6+wNoise(vU*19.-s*7.)*.4;m=smoothstep(1.,.55,r)*smoothstep(.25,.6,n);}
else{float w=kind>1.5?.16:kind>.5?.05:.09;float band=smoothstep(1.,1.-w,r)*smoothstep(1.-w*3.,1.-w,r);float broken=kind>.5?1.:.65+.35*wNoise(vec2(a*5.+s*20.,s));m=band*broken;}
float alpha=m*vD.x;if(alpha<.004)discard;gl_FragColor=vec4(uFoam,alpha);${OUTPUT}
}`

/** aP: x, y, z, size. aD: alpha, kind (0 drop, 1 bubble, 2 mist), seed. */
export const WATER_SPRITE_VERTEX = `attribute vec4 aP;attribute vec3 aD;varying vec2 vU;varying vec3 vD;
void main(){vU=position.xy;vD=aD;vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);vec3 up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
vec3 w=aP.xyz+(right*position.x+up*position.y)*aP.w;gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}`

export const WATER_SPRITE_FRAGMENT = `uniform vec3 uFoam;uniform vec3 uDeep;varying vec2 vU;varying vec3 vD;${NOISE}
void main(){float r=length(vU);if(r>1.)discard;float kind=vD.y;float m;vec3 c=uFoam;
if(kind>1.5){m=exp(-r*r*3.)*(.75+.25*wNoise(vU*3.+vD.z*9.));}
else if(kind>.5){m=smoothstep(.55,.85,r)*smoothstep(1.,.88,r)+.25*smoothstep(.5,.2,length(vU-vec2(-.3,.3)));c=mix(uDeep,uFoam,.8);}
else{m=smoothstep(1.,.6,r);c=mix(uDeep,uFoam,.55+.45*smoothstep(.2,.8,1.-length(vU-vec2(-.3,.35))));}
float alpha=m*vD.x;if(alpha<.004)discard;gl_FragColor=vec4(c,alpha);${OUTPUT}
}`

/** aP: x, y, z, radius. aD: height, alpha, tilt x, tilt z. aK: dome (0/1), seed. The geometry is a unit open cylinder (y 0..1) or a unit half sphere. */
export const WATER_COLUMN_VERTEX = `attribute vec4 aP;attribute vec4 aD;attribute vec2 aK;varying float vY;varying float vA;varying vec2 vK;varying float vF;${NOISE}
void main(){vY=position.y;float ang=atan(position.z,position.x);vK=aK;
float dome=aK.x;float s=aK.y;float h=position.y;
float jag=.8+.4*wNoise(vec2(ang*3.+s*17.,h*4.+s));
float flare=dome>.5?1.:(.55+.9*h*h)*jag;
vec3 p=vec3(position.x*aP.w*flare,position.y*aD.x,position.z*aP.w*flare);
p.x+=aD.z*aD.x*h*h;p.z+=aD.w*aD.x*h*h;
vec3 w=aP.xyz+p;vec3 n=normalize(vec3(position.x,dome>.5?position.y:.25,position.z));
vec3 v=normalize(cameraPosition-w);vF=abs(dot(n,v));
vA=aD.y;gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}`

export const WATER_COLUMN_FRAGMENT = `uniform vec3 uFoam;uniform vec3 uDeep;varying float vY;varying float vA;varying vec2 vK;varying float vF;${NOISE}
void main(){float dome=vK.x;float s=vK.y;
float streak=wNoise(vec2(gl_FragCoord.x*.05+s*31.,vY*6.+s));
float body=dome>.5?mix(.95,.5,vY)*(.6+.4*(1.-vF)):(1.-smoothstep(.55,1.,vY))*(.45+.55*streak)*(.55+.45*(1.-vF*.6));
vec3 c=mix(uDeep,uFoam,dome>.5?.8:.65+.35*vY);float alpha=body*vA;if(alpha<.004)discard;gl_FragColor=vec4(c,alpha);${OUTPUT}
}`
