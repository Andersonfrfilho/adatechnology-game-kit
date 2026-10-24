/**
 * The vertex-shader chunk of the instanced body, carried byte for byte from the game (G 65400 `bodyChunk`): the pose math of the 12 bones on the GPU.
 * Per-instance attributes: iA = (x, z, yaw, phase) · iB = (height, build, stride, pose + 16 × ground height in mm) · iC = (missing-parts mask, infection 0..1,
 * arms 0 human / 1 zombie / 2+ armed, skin tone) · iCol = shirt colour · iEye = eye colour (0 = human). The mask bits are `MISSING_BITS`.
 * A test compares its sha-256 with the one recorded from the game.
 */
export const BODY_CHUNK = `
  attribute float bone; attribute vec4 vcol; attribute vec3 pivot; attribute vec3 ppivot;
  attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec3 iCol; attribute vec3 iEye;
  uniform float uTime;
  varying vec3 vTint; varying float vGlow;
  mat3 rX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
  mat3 rY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
  mat3 rZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
  bool miss(float bit){ if (iC.z > 1.5) return false; return mod(floor(iC.x / bit), 2.) > 0.5; }
  vec3 bodyAnim(vec3 p, inout vec3 nrm){
    float ph = iA.w*6.2831, gait = iB.z, pose = iB.w - floor(iB.w/16.)*16., zomb = iC.z;
    float side = (bone==2.||bone==4.||bone==7.||bone==9.) ? -1. : 1.;
    // cascata: cada junta atrasa em relação ao quadril (Bestiário 12.3)
    float lag = bone==1.||bone==6.||bone==11. ? 0.55 : (bone>=7.&&bone<=8. ? 0.35 : (bone==2.||bone==3. ? 0.2 : 0.));
    float sw = sin(ph - lag);
    mat3 Rp = mat3(1.), Rc = mat3(1.);
    bool isArm = bone==2.||bone==3., isFore = bone==7.||bone==8., isThigh = bone==4.||bone==5., isShin = bone==9.||bone==10.;
    float legS = (bone==4.||bone==9.) ? 1. : -1.;
    float walkS = sin(ph) * legS;
    if (isThigh || isShin) Rp = rX(-walkS*0.5*gait);
    if (isShin) Rc = rX(max(0., cos(ph + (legS>0.?0.:3.1416)))*0.85*gait);
    if (pose==6.) { if (isThigh) Rp = rX(-1.1); if (isShin) Rc = rX(1.4); }
    if (pose==5.) { if (isThigh) Rp = rX(-0.95 - walkS*0.3*gait); if (isShin) Rc = rX(1.9); } // agachado: joelho dobra, o pé fica no chão
    if (pose==7.) { if (isThigh) Rp = rX(-1.15); if (isShin) Rc = rX(2.3); } // ajoelhado comendo
    if (pose==2. && isShin && fract(iA.w*3.)*legS > 0.3) Rc = rX(fract(iA.w*3.)*1.3); // corpo com um joelho dobrado
    float armS = sin(ph) * (side>0. ? 1. : -1.);
    if (isArm || isFore) {
      // zumbi: braços caídos vagando; levanta (iC.z = 1 + 0,4 × alcance) quando percebe alguém ou vai agarrar
      float raise = clamp((zomb - 1.)/0.4, 0., 1.);
      float fwd = zomb > 0.5 && zomb < 1.5 ? mix(-0.12 + armS*0.3*gait + 0.05*sin(uTime*1.3+iA.w), -1.35 + armS*0.18 + 0.1*sin(uTime*2.+iA.w), raise) : armS*0.45*gait;
      if (pose==3.) fwd = -1.55 + 0.35*sin(uTime*9.+iA.w);
      if (pose==4.) fwd = -2.6;
      if (pose==6.) fwd = -2.0;
      if (pose==2.) fwd = (fract(iA.w*5.) > 0.5 && side > 0.) ? -2.8 : -0.35 + 0.3*sin(iA.w*5. + side);
      if (pose==1.) fwd = -2.6 + 0.5*sin(ph)*side; // puxa o corpo com os braços
      if (pose==7.) fwd = -0.9 + 0.3*sin(uTime*6.+iA.w);
      Rp = rX(fwd) * rZ(side*(pose==2. ? 0.5 + 0.3*sin(iA.w*3.) : 0.08));
      // armado (iC.z = 2 + pitch codificado): as duas mãos na arma, braços seguem a mira
      if (zomb > 1.5 && pose != 2.) { float aim = (zomb - 2.)*3. - 1.; Rp = rX(-1.42 + aim*0.85 + 0.02*sin(ph)*gait) * rZ(side < 0. ? 0.36 : -0.54); } // arma na mão direita de verdade (o osso 'D' fica em +x, que é a esquerda do boneco virado para +z); a esquerda encontra na empunhadura
    }
    if (isFore) Rc = rX(zomb > 1.5 && pose != 2. ? (side < 0. ? -0.12 : -0.04) : zomb > 0.5 ? mix(-0.3 - max(0., armS)*0.3*gait, -0.15, clamp((zomb - 1.)/0.4, 0., 1.)) : -0.35 - max(0., armS)*0.4*gait);
    if (bone==11.) Rc = rX(pose==3.||pose==4. ? 0.35 + 0.2*sin(uTime*14.) : 0.05);
    vec3 q = p; vec3 n = nrm;
    if (isFore || isShin) { q = Rc*(q - pivot) + pivot; n = Rc*n; q = Rp*(q - ppivot) + ppivot; n = Rp*n; }
    else if (isArm || isThigh || bone==11.) { q = Rp*(q - pivot) + pivot; n = Rp*n; q = Rc*(q - pivot) + pivot; n = Rc*n; }
    // humano armado andando de lado: quadril e pernas giram para a direção do passo (iC.x leva o ângulo)
    if (zomb > 1.5 && (isThigh || isShin)) { mat3 hy = rY((iC.x - 0.5)*10.); q = hy*(q - vec3(0.,0.9,0.)) + vec3(0.,0.9,0.); n = hy*n; }
    // partes faltando: colapsa no pivô
    if ((bone==1.||bone==6.||bone==11.) && miss(1.)) q = pivot;
    if (bone==11. && miss(512.)) q = pivot;
    if ((bone==2.||bone==7.) && miss(2.)) q = pivot; if ((bone==3.||bone==8.) && miss(4.)) q = pivot;
    if ((bone==4.||bone==9.) && miss(8.)) q = pivot; if ((bone==5.||bone==10.) && miss(16.)) q = pivot;
    if (bone==7. && miss(32.)) q = pivot; if (bone==8. && miss(64.)) q = pivot;
    if (bone==9. && miss(128.)) q = pivot; if (bone==10. && miss(256.)) q = pivot;
    // corpo: inclinação, balanço, agachar, rastejar, caído
    bool upper = !(isThigh || isShin);
    float zz = zomb > 0.5 && zomb < 1.5 ? 1. : 0.;
    float lean = zz > 0.5 ? 0.12 + 0.3*min(1., gait) : 0.04*gait;
    if (pose==3.) lean += 0.15;
    if (pose==5.) lean += 0.25;
    if (pose==7.) lean += 0.8;
    if (upper) { q -= vec3(0.,0.95,0.); q = rX(lean)*q; n = rX(lean)*n; q += vec3(0.,0.95,0.); }
    vec3 hp = rX(lean)*(pivot - vec3(0.,0.95,0.)) + vec3(0.,0.95,0.); // pescoço já inclinado: a cabeça não descola
    if (bone==1.||bone==6.||bone==11.) { q -= hp; mat3 h = rY(sin(uTime*0.7+iA.w)*0.25*zz) * rZ(0.18*zz*sin(iA.w*3.)); q = h*q; n = h*n; q += hp; }
    q.y += abs(sin(ph))*0.035*gait - (pose==5. ? 0.35 : pose==7. ? 0.5 : 0.);
    if (pose==1. && (bone==1.||bone==6.||bone==11.)) { mat3 hc = rX(-1.25); q = hc*(q - hp) + hp; n = hc*n; } // rastejante levanta a cabeça
    if (pose==1.) { mat3 c = rX(1.42); q = c*(q - vec3(0.,0.95,0.)) + vec3(0.,0.2,0.); n = c*n; }
    if (pose==2.) { float flip = step(0.5, fract(iA.w*1.7)); float fk = clamp(gait, 0., 1.); fk = fk*fk*(3.-2.*fk); /* queda animada: passada leva o progresso */ mat3 c = rX((-1.5 + flip*3.0)*fk) * rZ(sin(iA.w*7.)*0.3*fk); /* de costas ou de bruços */ q = c*(q - vec3(0.,0.95,0.)) + mix(vec3(0.,0.95,0.), vec3(0.,0.16,-0.6 + flip*1.2), fk); n = c*n; }
    nrm = n;
    return q;
  }
`

const HIP_PIVOT = 'vec3(0.,0.95,0.)'

export type BodyChunkOptions = {
  /** Height of the hip joint (the trunk's pivot), metres. The game's 0.95 is the default. */
  readonly hipHeight?: number
}

/** The chunk with the hip joint set (the only joint the shader holds as a constant); without options it is `BODY_CHUNK` itself. */
export const createBodyChunk = ({ hipHeight = 0.95 }: BodyChunkOptions = {}): string =>
  hipHeight === 0.95 ? BODY_CHUNK : BODY_CHUNK.replaceAll(HIP_PIVOT, `vec3(0.,${hipHeight},0.)`)
