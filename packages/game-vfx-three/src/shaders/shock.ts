/** The shock shell (fresnel edge, Lab L322-325) and the dust ring on the ground (L326-333), verbatim except for the r160 colour-space chunk. */
export const SHELL_VERTEX = `varying vec3 vN;varying vec3 vV;void main(){vec4 wp=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}`

export const SHELL_FRAGMENT = `uniform float uA;varying vec3 vN;varying vec3 vV;void main(){float f=1.-abs(dot(vN,vV));f=pow(f,5.);gl_FragColor=vec4(vec3(1.,.93,.82)*f*uA*.45,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export const RING_VERTEX = `varying vec2 vU;void main(){vU=position.xz;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);}`

export const RING_FRAGMENT = `uniform float uA;uniform float uW;uniform vec3 uC;varying vec2 vU;
  float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){float r=length(vU);float b=smoothstep(1.,1.-uW,r)*smoothstep(1.-uW*3.5,1.-uW,r);float a=atan(vU.y,vU.x);float n=.7+.3*h(vec2(floor(a*14.),1.));gl_FragColor=vec4(uC,b*uA*n);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`
