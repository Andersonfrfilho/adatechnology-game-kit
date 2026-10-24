/**
 * The film shader of the Fluid Standard page (F131-209), line by line. Where the page painted the whole surface itself (`baseCol`: wall, sidewalk, curb,
 * road), the film is drawn over the host's own surface, so `baseCol` is the flat colour `uBase` and the alpha is the film's coverage: the wet part and,
 * for fuel, the ground it darkened. Three more differences: the grid size and span are uniforms (`uGrid`, `uSpan`; the page hard-codes 256 x 396 and 4.95),
 * the strip tangent comes from the geometry (`aT`; the page's was the x axis), and the output goes through the r160 colour-space chunk after turning the page's
 * display-space colours linear. The two lines that mirror the page's own wall in the reflection (`R.z<-.02 ... env=vec3(.30,.32,.35)`, `R.y<-.02 ...`) are left out:
 * they describe the page's scene, not a surface of the host.
 */
export const FILM_VERTEX = `attribute vec3 aB;attribute vec3 aT;varying vec2 vUv;varying vec3 vPos;varying vec3 vN;varying vec3 vB;varying vec3 vT;
void main(){vUv=uv;vPos=position;vN=normal;vB=aB;vT=aT;gl_Position=projectionMatrix*viewMatrix*vec4(position,1.);}`

export const FILM_FRAGMENT = `precision highp float;
uniform sampler2D tF;uniform vec2 tx;uniform vec2 uGrid;uniform float uSpan;uniform float uT;uniform int uFl;uniform vec3 cThin,cThick,cDry,cDryThin,uBase;uniform float opK,F0,nrm,dbg;
uniform vec3 camP,lampP,flashP,flashD;varying vec2 vUv;varying vec3 vPos;varying vec3 vN;varying vec3 vB;varying vec3 vT;
float hsh(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec2 hsh2(vec2 p){return vec2(hsh(p),hsh(p+17.7));}
float nz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}
float vor(vec2 p){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));vec2 r=o+hsh2(i+o)-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}return sqrt(d2)-sqrt(d1);}
float hs(vec2 u){float r=texture2D(tF,u).r;return r*r*6.;}
void main(){
  vec4 S=texture2D(tF,vUv);vec2 q=tx*.5;float h=.25*(hs(vUv+q)+hs(vUv-q)+hs(vUv+vec2(q.x,-q.y))+hs(vUv+vec2(-q.x,q.y)));float dry=S.g;float wg=S.b;
  vec2 o1=vec2(tx.x*1.5,0.),o2=vec2(0.,tx.y*1.5);
  float hl=hs(vUv-o1),hr=hs(vUv+o1),hd=hs(vUv-o2),hu=hs(vUv+o2);
  vec2 g=vec2(hr-hl,hu-hd)/37.5;
  vec2 cellp=vUv*uGrid;
  float n1=nz(cellp*2.3),n2=nz(cellp*7.1);
  float hn=h+(n1-.5)*.045+(n2-.5)*.02;
  float m=smoothstep(.035,.08,hn);
  if(uFl==4){float wa=.25*(texture2D(tF,vUv+q).b+texture2D(tF,vUv-q).b+texture2D(tF,vUv+vec2(q.x,-q.y)).b+texture2D(tF,vUv+vec2(-q.x,q.y)).b);m=smoothstep(.35,.75,wa+(n1-.5)*.25)*smoothstep(.0,.012,h);wg=smoothstep(.2,.8,wa+(n1-.5)*.2);}
  vec2 p=vec2(dot(vPos,normalize(vT)),vUv.y*uSpan);
  vec3 base=uBase;
  vec3 T=normalize(vT),Bv=normalize(vB),N0=normalize(vN);
  vec3 nt=vec3(-g*nrm*m,1.);
  float dryM=smoothstep(.5,.95,dry);
  float wet=(1.-dryM)*m;
  // bile bubbles
  float bub=0.;
  if(uFl==2){vec2 bp=cellp/2.6;vec2 bi=floor(bp);vec2 bf=fract(bp)-.5;float rnd=hsh(bi);
    if(rnd>.5&&h>1.1){float t=fract(uT*(.18+.25*hsh(bi+3.1))+rnd*7.);float rad=.42*smoothstep(0.,.8,t);float d=length(bf-(hsh2(bi+9.)-.5)*.2);
      if(t<.86&&d<rad){float z=sqrt(max(0.,rad*rad-d*d));nt.xy+=(bf/max(rad,.01))*2.2*(1.-dryM);bub=z/rad;}
      else if(t>=.86){float rr=.42*1.15;float ring=1.-smoothstep(0.,.07,abs(d-rr*(.9+(t-.86)*.8)));nt.xy-=normalize(bf+.0001)*ring*.8*(1.-dryM);bub=-ring;}}}
  if(uFl==4){vec2 wp=p;nt.xy+=.05*m*vec2(nz(wp*9.+vec2(uT*1.7,0.))-.5,nz(wp*9.+vec2(0.,uT*1.4)+7.)-.5)*2.;}
  vec3 Nf=normalize(T*nt.x+Bv*nt.y+N0*nt.z);
  // albedo
  float th=smoothstep(.1,1.7,h);
  vec3 fc=mix(cThin,cThick,th);
  float op=clamp(1.-exp(-h*opK),0.,1.);
  vec3 alb;
  if(uFl==4){alb=base*mix(vec3(1.),cThin*1.15,clamp(h*.9,0.,1.));}
  else{alb=mix(base*mix(vec3(1.),fc*1.6,clamp(h*2.,0.,1.)),fc,op);}
  if(uFl==2&&bub>0.)alb=mix(alb,cThin*1.25,bub*.5);
  // dried look: matte, darker rim, cracks where it was thick
  float rim=smoothstep(.01,.05,length(g))*(1.-smoothstep(.4,1.,h));
  vec3 dc=mix(cDryThin,cDry,smoothstep(.06,.8,h))*(1.-.42*rim);
  float crk=(1.-smoothstep(.015,.05,vor(p*(uFl==2?34.:52.))))*smoothstep(.9,1.6,h);
  dc=mix(dc,base*.55,crk*.75);
  if(uFl!=3&&uFl!=4)alb=mix(alb,mix(base,dc,clamp(.4+h*1.4,0.,1.)),dryM);
  // gasoline darkens the ground while wet
  float gw=0.;if(uFl==4){gw=wg*(1.-m*.0);base*=mix(1.,.45,gw);alb=mix(base,alb,m);}
  vec3 col0=mix(base,alb*(uFl<2?mix(.62,1.,dryM):1.),m);
  // lighting
  vec3 V=normalize(camP-vPos);
  vec3 Lv=lampP-vPos;float dl=length(Lv);vec3 L=Lv/dl;float att=2.2/(1.+dl*dl*.12);
  vec3 lampC=vec3(1.,.88,.7);vec3 moonD=normalize(vec3(-3.,5.,4.));vec3 moonC=vec3(.11,.14,.19);vec3 amb=vec3(.14,.15,.17);
  vec3 Fv=flashP-vPos;float fd=length(Fv);vec3 FL=Fv/fd;float cone=smoothstep(.86,.97,dot(-FL,flashD));float fatt=cone*1.1/(1.+fd*fd*.6);
  vec3 dif=col0*(amb+lampC*att*max(dot(Nf,L),0.)+moonC*max(dot(Nf,moonD),0.)+vec3(.95,.97,1.)*fatt*max(dot(Nf,FL),0.));
  float wv=max(wet,gw*.7);
  float shin=mix(30.,320.,wv);
  vec3 Hh=normalize(L+V);vec3 Hf=normalize(FL+V);
  float sp=pow(max(dot(Nf,Hh),0.),shin)*shin*.011*att;float spf=pow(max(dot(Nf,Hf),0.),shin)*shin*.008*fatt;
  vec3 R=reflect(-V,Nf);
  vec3 env=mix(vec3(.03,.035,.04),vec3(.15,.17,.21),clamp(R.y*1.4,0.,1.));
  env+=lampC*(pow(max(dot(R,L),0.),500.)*7.+pow(max(dot(R,L),0.),40.)*.6)*att;
  float fr=F0+(1.-F0)*pow(1.-max(dot(Nf,V),0.),5.);
  vec3 col=dif*(1.-fr*wv*.7)+(env*min(1.,fr*(uFl==4?1.6:3.4))+min(lampC*sp+vec3(.9,.95,1.)*spf,vec3(.85)))*wv;
  if(uFl==3){float film=(1.-smoothstep(.04,.55,h))*m;vec3 ir=.5+.5*cos(6.283*(h*7.+n1*.5+uT*.03+vec3(0.,.33,.67)));col+=ir*film*(.10+.5*fr)*(.6+att*.4);}
  if(uFl==4){vec2 wp=p;float film=m*(.4+.6*(1.-smoothstep(.02,.2,h)));vec3 ir=.5+.5*cos(6.283*(nz(wp*6.)*1.4+uT*.02+vec3(0.,.33,.67)));col+=ir*film*.05*(.3+fr*3.);}
  if(dbg>.5){float k=clamp(h/3.,0.,1.);vec3 hc=mix(vec3(.05,.1,.5),vec3(1.,.9,.2),k);hc=mix(hc,vec3(1.,.2,.1),step(.66,k));col=mix(base*.25,mix(hc,vec3(.6),dryM*.7),step(.004,h));}
  float cover=max(m,gw*.55);
  gl_FragColor=vec4(pow(max(col,vec3(0.)),vec3(2.2)),clamp(cover,0.,1.));
  #include <colorspace_fragment>
}`
