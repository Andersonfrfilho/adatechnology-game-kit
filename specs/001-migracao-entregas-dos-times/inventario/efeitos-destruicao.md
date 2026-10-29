# Inventário: Efeitos, destruição e fluidos (time de Efeitos)

Levantado em 2026-10-23, só leitura. Fontes: `specs/001-migracao-entregas-dos-times/sources/`. Linhas citadas são do arquivo `.js` extraído
(não da página HTML). Comparado com `packages/game-destruction`, `game-destruction-three`, `game-fluids`, `game-fluids-three`,
`game-test-room`, `game-devtools`, `game-weapons`, `game-weapons-three` e `game-contracts`.

## 0. Achados que mudam o plano

1. **A "Sala de testes" do site não é uma entrega do time: é um build do próprio SDK** (`examples/test-room`). O bundle
   (`sala-de-testes__sala-de-testes.js`, 975 KB, três.js + SDK) contém as 26 chaves `sc.*` de `game-test-room/src/locale.ts`, o cenário
   `load_rental_car_module`, `fluid_particles`, `destruction-particles` e `quality low/medium/high` iguais aos do SDK. Os "22 testes" são os 22 `sc(...)`
   de `game-test-room/src/scenarios.ts` (o README do pacote diz 21: desatualizado). **Não há nada a portar da sala de testes**; só a página do
   site deve apontar para o build do SDK.
2. **O jogo (Jardim Aurora / modo livre) já tem o seu próprio motor de efeitos, embutido na página** (não usa o SDK para isso; o SDK que aparece
   no bundle é a sala de testes dentro do jogo). Existem duas versões: `jogo__zombiada-modo-livre.js` (nova) e `jogo__zombiada-jardim-aurora.js`
   (antiga). Ele é uma **versão reduzida e ligada à jogabilidade** do Laboratório de Explosões + Oficina. Para o porte, a fonte de verdade visual
   é o Laboratório (explosão) e a Oficina (resto); o jogo serve de referência de integração (LOD por distância, teto por área, cadeia, dano).
3. **O Laboratório de Explosões substitui as explosões da Oficina** (a própria Oficina marca `lab:1` em molotov, granada, barril e explosão do carro, L801, L816, L828, L1139, e o Laboratório diz "versão final").
   Os dois têm estilos diferentes: a Oficina usa sprite macio (pontos), o Laboratório usa **puffs opacos facetados com erosão por ruído e calor em 5 faixas**
   ("sem sprite borrado, no estilo do jogo"). O jogo seguiu o Laboratório.
4. **O Padrão de Fluidos é a régua (F1 a F12); a "Fluidos vivos" da Oficina (L562-743) é uma cópia dele em outra grade.** O `game-fluids` do SDK é
   outra coisa (contêineres, jatos, torneiras, manchas radiais determinísticas): complementar, não substituto. Falta no SDK o filme fino com
   escorrer em parede, forma por ângulo de impacto, brilho/secagem por espessura.
5. O SDK tem o **pipeline** (eventos do núcleo → partículas, luz de explosão, decalques presos à peça, fogo ligado a `part.burning`, vazamentos,
   cinzas e poças). Falta o **visual de explosão em camadas**, onda de choque, cratera, faíscas esticadas, pool de luzes, anéis, tela (tremor,
   clarão), chuva, clarão de disparo, LOD por distância e teto por área.
6. Desempenho: o SDK tem um alocador por quadro (`hexToRgb` devolve array novo, chamado 2 vezes por partícula viva por quadro em
   `particles.ts` L294-295 do Pool.update); a Oficina pré-calcula `c0/c1` por partícula. A grade de fluido da Oficina sobe a grade inteira para a
   textura todo quadro (`fUpload`, L630) e simula em CPU (`fStep`, L615): o "0,3 ms em compute shader" é meta da Unity, não do protótipo.

---

## 1. Entregas

### 1.1 Oficina de VFX (`efeitos__oficina-vfx.js`, 1295 linhas, 40 efeitos)

Página: catálogo por time, ficha por efeito (Quando, Visual, Orçamento, Rede), prévia 3D ao vivo, regra "2.000 zumbis na tela, VFX inteiro em 2,5 ms de GPU
numa GTX 1060", tabela de regra dos fluidos (cores e tempos de secagem), Unity (grade 2×2 m, 6 grades ativas).

**Infraestrutura (L1-448)**

| Peça | Onde | O que faz |
|---|---|---|
| Matemática e ruído | L11-17 | `rnd/rg` (Math.random, **não determinístico**), `clamp`, `lerp`, `ease` (smoothstep) |
| Cenário de teste | L39-166 | rua noturna, vitrine com vidro (`glassTex`, `drawGlass` L57, `crackAt` L62), porta de 3 tábuas (`planks` L67), marquise (`slab` L71), janelas de fogo (`fireWins` L73), poste (`lampL`, `lampCone`), carro (L82-105, `carW` L105, para-brisa `wsTex`/`drawWS` L92-95, faróis), barril, fogueira, sobrevivente, zumbis (`makeZombie` L137) |
| Pool de partículas macias | `PSys` L179-221, `addP` (aditivo, 9000) e `norP` (normal, 9000, suavidade .55) L221 | Points com shader `VS/FSs` (L169-172); `spawn(o)`: `p/r/box/flat/dir/cone/sp/v/c0/c1/life/size/grow/a/g/drag/fi/gnd/ds`; `gnd` 1 morre, 2 quica (.3), 3 vira decalque de sangue; gradiente c0→c1, fade-in `fi`, `kill` por troca com o último; `coneDir` L176 |
| Riscos (faíscas, traçantes) | `Streaks` L223-245, `streak` (3000) | LineSegments aditivo, cauda = velocidade × `len`, quica com `gnd:2` |
| Detritos | `debIM` L247-262, `debris(o)` L254, `updateDebris` L258 (DMAX 500) | InstancedMesh de caixas, física própria, descansa e se alinha a 90° (L260), some encolhendo |
| Decalques de piso e parede | `decIM` (molhado, brilhante) + `decIMd` (seco, fosco) L267-271, DCMAX 400; `decal()` L282; `updateDecals` L292 | por decalque: `grow`, `life`, `dark/dry` (cor seca), `run` (escorre em parede/declive e dispara `onEnd`), `ar` (proporção), `fluid` |
| Tabela `FLUID` (decalques) | L273-279 | blood, oil, fuel (evapora [6,5] s), bile (bolhas), water (evapora [40,20]); `creep`, `sheen` (óleo arco-íris por HSL) |
| Anéis | `ringIM` L309-315 (RMAX 120), `ring(p,r0,r1,dur,cor,n,hold)` | anel aditivo que cresce com ease; `hold` mantém (nuvem de gás) |
| Chuva | `initRain/updateRain` L321-329 (RAINMAX 4000 LineSegments) | vento, respingos e anéis só a menos de 12 m da câmera (÷(1+nível)), `PUD`/`inPuddle` L330-331 |
| Pool de luzes | `LP` (4 PointLights) L334-337, `flash()` L336, `updateLights` L337; `fireL/fireL2` L338, `fireLight` L405 | decaimento quadrático; `flash` respeita o nível de qualidade (nível≥1 só 'force', nível 2 só 'boom') |
| Qualidade | `Q={level,mult}` L341; `n()` (mínimo 1), `burst`, `emit` (acumulador por taxa) L342-345 | 3 níveis: 100 %, 50 %, 20 % (botões `data-q`, L1271) |
| Efeitos de tela | `S`, `updateScreen` L353-370, `lensBlob` L352, `clearScreen` L371 | tremor, clarão branco, vermelho, borda direcional L/R, aberração cromática, dessaturação, gás verde, batimento; implementado em **CSS filter/box-shadow/canvas 2D** (DOM) |
| Impacto por material | `IMP` L374-381, `impact()` L382-391 | concreto, metal, madeira, vidro, carne (→ sangue), água (coroa + 2 anéis): pó, lascas, faíscas, luz, decalque |
| Sangue por idade | `BLOOD/AGE` L135-136, `bloodHit()` L392-398 | 4 idades (valor de sangue 1 / .7 / .35 / .1; cores 8A0A0A, 5A0C10, 3A1C12, 1D1914); Decrépito solta pó preto |
| Fogo | `fireEmit()` L399-404 | chama (90/s·k), núcleo (30/s·k), fagulhas (10/s·k), fumaça (14/s·k); vento, `smokeC/smokeA`, `nosmoke` |
| Explosão (versão da Oficina) | `explode(p,s,o)` L406-416 | luz 14·s, tremor, clarão de tela, 55 pontos de fogo, 28 de coluna, 2 anéis, 32 de fumaça, 44 de poeira rasteira, 44 riscos, detritos, decalque preto (`3·s`) |
| Clarão de disparo | `muzzle(w,tip,dir)` L417-427 | perfis `glock/ak/r870/barrett`: `[escala, pétalas, luz, fumaça, comprimento]`; Barrett solta dois jatos laterais e anel de poeira; luz 50 ms |
| Cápsula | `casing(port,type)` L428 | detrito com giro e quique |
| Reset e limpeza | `resetProps` L431, `clearFX` L443, `at(t,fn)` L445 | timeline por temporizadores |
| Catálogo | `TEAMS` L450-457, `def()` L459, UI L1246-1275, laço L1277-1291 | `?#id`, parâmetro por efeito (idade, fluido, arma, material, condição), repetição automática, câmera por efeito (`camTo`), contadores fps / draw calls / partículas / decalques |

**Catálogo (40 `def`, L463-1243)**

| Time | id (linha) | Resumo do que faz |
|---|---|---|
| Zumbis | `sangue` L463, `headshot` L474, `membro` L487, `inchado` L497, `grito` L513, `olhos` L526, `corpo` L536, `reanima` L548, `fluidos` L711 | sangue por idade (névoa, jato, poça que cresce, pingo); cabeça estoura (olhos apagam no mesmo quadro); braço sai com física e ombro jorra em pulsos; nuvem de bile de 4 m por 8 s; grito (3 anéis + aberração + olhos da horda); olhos na neblina (corredores deixam rastro); corpo escurece em 8 s (moscas, pó); reanimação (veias emissivas) |
| Armas | `muzzle` L745, `impacto` L760, `penetra` L776, `capsulas` L790, `molotov` L801, `granada` L816, `barril` L828 | clarão por arma; 6 materiais; traçante .50 atravessa 5 zumbis em câmera lenta 10×; cápsulas; molotov em arco com poça de fogo 0,5→2,2 m; granada que quica 2 vezes; barril (cogumelo, tampa, 3 poças de fogo, coluna) |
| Destruição | `vidro` L846, `porta` L857, `desaba` L875, `parede` L899, `portametal` L945, `grade` L964, `cerca` L985, `pontos` L1011, `pressao` L1032 | todos **animados por roteiro** (`at()`), sem simulação: vitrine (rachadura em textura + 75 cacos), porta em 3 estágios com tremor, desabamento da marquise, parede de 30 blocos com furos filhos do bloco (`bwHit` L894), porta de metal que amassa vértices (`dentAt` L919, 400 vértices), grade que envergam (barras deformáveis), cerca de 12 tábuas, mesa por peças (tiro na perna, facão na quina, taco no tampo, 12 de perto com 9 furos), extintor (jato + giro + nuvem) e cilindro de oxigênio (vira foguete, quica na parede) |
| Mapa/clima | `incendio` L1054, `chuva` L1065, `neblina` L1078 | prédio em chamas (janelas, línguas, brasas, coluna inclinada), garoa/chuva/temporal (relâmpago duplo), neblina rasteira e cinzas |
| Veículos | `faisca` L1090, `motor` L1103, `vazamento` L1118, `explosao` L1139, `parabrisa` L1149, `farol` L1161 | faíscas de raspagem + marca; fumaça por condição 100/60/30/10; vazamento → poça → incêndio → explosão (`vehicleBoom` L1133, `carTick` L1138); para-brisa em 4 estágios com sangue; cones de farol e gotas acesas |
| Personagens/tela | `dano` L1175, `infeccao` L1186, `panico` L1200, `cegueira` L1210, `fogueira` L1222, `tosse` L1231 | borda vermelha, sangue na lente, mordida; fases da infecção (frio, desfoque, aberração, matiz); pânico (túnel e bpm por distância); gás do Inchado; fogueira; respiração/tosse/lanterna |

**Fluidos vivos (L562-743)**: grade única dobrada sobre parede (160 linhas), calçada (128), face do meio-fio (9) e rua (151), `FW=160, FC=0.0125` (1,25 cm),
`FH=448`. Estado por célula: `fh` (espessura em mm), `fdry`, `fwg` (molhado), `fb` (leito com ruído), `fpn` (pino), `fvert` (parede).

| Peça | Linha | Detalhe |
|---|---|---|
| Parâmetros por fluido | `FT` L583-586 | sangue, bile, óleo, gasolina: `K` (fluxo), `pin` (filme que fica), `front` (espessura para molhar célula seca, dá o bulbo na ponta), `h0`, `gcap`, `dryT` (600/900/0/0 s), `evap`, `opK`, `F0`, `nrm`, cores fina/grossa/seca, `spd` (aceleração da secagem no preview), `spk` |
| Depositar | `fDep` L588, `fBlob` L590 (elipse com contorno de 4 senoides), `fStroke` L594 (traço afinando) | |
| Respingo direcional | `fSplat` L598-610 | corpo esticado por 1/seno do ângulo, espetos curtos (longos só no sentido do tiro), satélites com rabo; `spk<1` = bolhas grossas (bile) |
| Escoamento | `fStep` L615-623 (passo fixo 1/180 s, até 9 por quadro, limitado à caixa `fbb`, `fBox` L612), `fMob` L614 | só o que passa do pino se move; parede move de lado a 0,22× |
| Secagem | `fAge` L624-628 | pela borda fina primeiro; gasolina evapora da borda |
| Shader do filme | `fluidMat` L634-671 | espessura → normal, brilho (specular + fresnel + ambiente), opacidade, craquelê Voronoi, bolhas que estouram (bile), película iridescente (óleo, gasolina), tremor (gasolina) |
| Geometria | `fStrip` L672, `FPL` L678 | 4 faixas na mesma textura |
| Gotas em voo | `fLaunch/fLand/fDrops` L685-698 (400 instâncias) | esticadas pela velocidade, ao bater viram `fSplat` pelo ângulo |
| Gota pendurada | `fDripUpd` L701-704 | incha, afina, solta |
| Fonte contínua | `fSrcUpd` L706-707, `fCell` L709 | ferida no pé, lata tombada |
| Cena | `def fluidos` L711-743 | 4 fluidos (sangue, óleo, gasolina, bile), tiro na parede com 220+110 gotas, lata de óleo/gasolina tombada, secagem em ×50/×70 |

### 1.2 Laboratório de Explosões (`efeitos__laboratorio-explosoes.js`, 1104 linhas)

16 cenários em `ORDER` (L997): granada M67, molotov, granada de luz, bomba caseira, dinamite, C4, claymore, botijão P13, M79, M72, AT4, RPG-7,
barril, carro, posto em cadeia, granada na horda. Controles: Detonar de novo, câmera lenta 0,25×, distância (perto 12 m, médio 30 m, longe 70 m),
**camadas ligáveis** (`layers` L478: clarão, fogo, choque, fumaça, estilhaço, marca), faixa de fases (`PH` L1049), ficha por explosivo
(`renderFicha` L1031), tabela de auditoria de outras páginas (`AUD` L1060), contadores por evento (`evCount` L483).

**Receita de 9 camadas** (texto da página e `blast()` L642-713):

1. **Clarão** (0-50 ms): `boomLight` + `glow` (halo aditivo) + piscar de tela (`flashV`, só a menos de 15 m, 40 m para granada de luz).
2. **Bola de fogo**: 12-40 puffs (`puff`, L194) a 25 % do tamanho, `heat` com rampa posterizada em 5 faixas.
3. **Fogo vira fumaça**: o mesmo puff esfria (`hl`), cresce 3×, deriva com vento (`WIND` L203), some por **erosão de ruído 3D** (`discard`), nunca por alpha.
4. **Halo de calor**: `glow` aditivo (GMAX 320, L295-318).
5. **Onda de choque**: esfera com fresnel (`shockMat` L322) + anel de poeira no chão (`ringMat` L328) + empurra puffs que a frente encontra (`updateShocks` L342-348).
6. **Poeira rasteira** (kind 1), em leque se tiver `cone`.
7. **Estilhaços**: faíscas esticadas pela velocidade (`spark`, L281; shader L247-277, 5 paletas: 0 faísca quente, 1 estilhaço frio, 2 clarão azulado, 3 vidro, 4 brasa) e **detritos** instanciados (`chunk` L374, CMAX 300, pedra/placa, brasa que esfria em 1,6 s `_hotCol` L399).
8. **Marcas**: `scorch` (L461), `crater` (L462: afunda o piso `dent` L69-83 numa grade 181×181 `GH`/`groundH` L66, borda de asfalto quebrado, decalque que se conforma ao relevo `conform` L458).
9. **Depois**: fogo residual (`fire` L426 / `updateFires` L427), cogumelo em anel toroidal (`mushroom` L723, `ring` de puffs com `roll`), vidros das fachadas estouram com atraso `d/340` s (`breakWindow` L716).

Mais peças:

- Pool de luzes (4 de explosão + 2 de fogo, `XL/FL`, `boomLight` L354, `updateLights` L355-365) e uniformes de brilho nos puffs (`uGlowPos/Col/I`).
- Corpos soltos (`body` L403, `updateBodies` L408: partes de zumbi, peças de carro, blocos de concreto, com rastro).
- Reação de zumbis (`hitZombie` L516, `gibs` L546, `headBurst` L548, `knock` L552, `burnZ` L554): explodido / desmembrado / arremessado por distância contra `lethal` e `injury`; `ragdoll` limitado a 12.
- Arremesso: `throwArc` L738 (arco com quiques), `physThrow` L751 (física, restituição, atrito, rola com rotação, pavio `fuse`, `onImpact` para foguete), `aimVel` L749.
- Projéteis: `rocket` L771 (rastro de fumaça por 0,14 m, `cork`, `boost`), `backblast` L788.
- `PROF` (L795-813): perfis por explosivo (`lethal, injury, vis, fb, fuel, smoke, smokeN, dustN, sparks, sparkKind, sparkSpeed, chunks, plate, hot, scorch, crater, dent, light, lightLife, lightCol, flashI, shake, push, smokeLife, mushroom{h,r,n,stem,life,rk}, residual[], ignite, hotParts, embers, cone, dirBias, shock, flash`). Exemplos: granada letal 5 / ferimento 15; C4 6/18; claymore cone de 60° a 50 m com 700 esferas; tanque 12/30 com cogumelo de 16 m.
- `wallBlast` L878, `launcherScene` L920 (M72, AT4, RPG), posto em cadeia L968 (3 bombas + carro + tanque subterrâneo), granada na horda L989 (40 zumbis + 2 sobreviventes).
- LOD (`lodFor` L481): <20 m 100 %, <45 m 50 %, <85 m 20 %, senão 8 %; choque só com k>.15, detritos só com k≥.5. Determinismo: `rnd()` com semente (LCG 16807, L16) e `seed=` por cenário.
- Tetos declarados: 400 partículas de GPU por evento, 4 luzes de explosão, 40 detritos por evento; cada explosão da cadeia é evento de rede próprio.

### 1.3 Padrão de Fluidos (`efeitos__padrao-fluidos.js`, 384 linhas)

Régua para sangue, bile, óleo, gasolina. Critérios de aceite **F1 a F12** (forma, direção, volume, escorrer, espalhar, pingar, brilho, secar,
identidade, superfície, luz e cor, custo). Grade de 256 × 396 células de 1,25 cm (`CS, W, RW=144, RS=128, RC=12, RR=112`, L12), mesma ideia da Oficina.

| Peça | Linha |
|---|---|
| RNG semeado (LCG) `rng`, `hash2`, `vnoise` | L18-21 |
| Fluidos `FL` (sangue, sangue antigo, bile, óleo, gasolina) | L45-56 |
| `dep/blob/stroke/splat`, `step` (escoamento), `age` (secagem) | L60-113 |
| Shader `FS` (mesmo da Oficina) | L133-208 |
| Superfícies `surf` (parede, calçada, meio-fio, rua) | L216-221 |
| Gotas `launch/land/updDrops` (600 instâncias), gota pendurada `updDrip` | L251-286 |
| Fontes contínuas `updSrc`, **arrasto** `updDrag` (faixa com estrias que perde carga e esfarela) | L288-298 |
| Cenas `SCENES`: parede, fonte, pinga, arrasto, formas (impacto a 90°, 60°, 35°, 15°, rastro, cast-off, escorrido, mão arrastada) | L301-325 |
| Clique na cena atira gota grande do ângulo da câmera | L351-355 |
| Painel: fps, ms de simulação, células molhadas, secagem ×1/×20/×60 | L362-380 |

Diferenças contra a Oficina: 5 fluidos (tem "sangue antigo"), cena `arrasto`/`updDrag`, 600 gotas, RNG semeado. A Oficina tem o filme dentro do catálogo e
usa `Math.random`.

### 1.4 Sala de testes (`sala-de-testes__sala-de-testes.js`)

Bundle do SDK (ver achado 1). Nada próprio do ZombiAdA além do título da página. Cenários: `steel_through_hole`, `concrete_stops_bullet`, `hammer_dents_drum`,
`glass_shatters`, `shotgun_splinters_crate`, `kick_chair_leg`, `kick_detaches_leg_via_tool`, `screwdriver_shelf_board`, `wrong_tool_refused`,
`lighter_burns_crate`, `torch_melts_steel`, `bucket_melts_drips`, `gas_bottle_explodes`, `bottle_drop_shatters`, `throw_chair_at_wall`,
`coffee_three_sips`, `tilt_cup_spills`, `jerrycan_leaks_fuel`, `fuel_stain_burns`, `one_column_roof_stands`, `two_columns_roof_collapses`,
`extinguisher_puts_out_fire` (+ `load_rental_car_module` do exemplo).

### 1.5 Efeitos espalhados em outras páginas

**Galeria 3D do Arsenal** (`armas-itens__galeria-3d-arsenal.js`, 1128 linhas): efeitos feitos com malhas e materiais clonados, sem pool de GPU.

| Peça | Linha | O que faz |
|---|---|---|
| `particle(o,v,opt)` / `stepParticles` | L700 / L701-715 | partículas **Mesh** (teto 900, cada uma com material clonado): gravidade, arrasto, quique, `onGround`, `onRest`, `grow`, `fade` |
| `flameBit`, `smokeBit`, `groundFire` | L460-463 (materiais `FLM` L459) | chama de icosaedro (4 cores), fumaça de esfera, fogo no chão com cones e luz |
| `fireHeavy` (lança-chamas) | L464+ | 420 chamas/s, calor da arma, luz `mflash`, gotas de combustível que viram `groundFire` |
| `muzzleFlash(pos,k)` | L716-724 | cone + 4 pétalas + esfera + luz + 6 fumaças |
| `casingMesh` L725, `ejectCase` L735, `stuckCase` L755 | cápsula real por calibre, 25 s no chão |
| `fanGeo` L894, `lobes` L895, `paintFan` L896, `poolMat` L902 | poça de sangue em leque de 28 lóbulos (`PN`), cresce, seca (cor FRESH→DRY, brilho cai) |
| `bloodPool` L903, `splat` L911, `stepPools` L921 | | poça que incorpora gotas, respingo esticado por 1/seno (`el`) com satélites |
| `drop` L925, `bloodBurst` L936, `stepBleed` L937 | | gotas viram `splat` ao bater; sangradores de ferida (`spurt` em pulsos) |
| `woundDecal` L927, `exitWound` L930, `gouge` L953, `stumpAt` L964, `sever` L967, `explodeSeg` L970 | ferimentos, órgão, osso, arrancar membro, explodir segmento: **pertence a `game-characters`** |
| `grenadeAt` | L1004 | explosão simples (clarão grande, 8 fumaças, marca, dano por distância 300·(1−d/1,6)) |
| `wall(mk,st)` | L616-641 | estágios 0 a 3 de parede por material (vidro, madeira, tijolo, concreto) com ferragem: modelo estático, não simulação |
| Tabelas `WMAT` L609, `WST` L615 | | vida/penetração por material |

**Galeria do Vale Cinzento** (`mapa__galeria-vale-cinzento.js`, 2512 linhas): cenografia animada, sem sistema.

| Peça | Linha | O que faz |
|---|---|---|
| `blood(x,z,s,y)` | L77 | disco de 9 lados, escala aleatória, parado |
| `fire(x,y,z,s)` | L78-84 | 16 icosaedros subindo + 10 brasas + luz (teto `LB`) + `smoke()`; ônibus (L374), helicóptero (L575, L1380), pátio (L599) |
| `smoke(x,y,z,n,sc)` | L177 | coluna de dodecaedros sobe até 22·sc m |
| `mvFlame` L1651, `tfFire` L1964, `tfCandles` L1968 | | lareira e vela (cones emissivos + luz que tremula), brasas |
| Uso de sangue como cenografia | L379, L708-2296 | dezenas de `blood()` em cenas |

Nada deste código é motor: é cena. Só serve de lista de **lugares onde o vfx do SDK deve ser plugado** (fogo no ônibus, helicóptero, pátio,
lareira) e de aparência alvo da fumaça (coluna visível a 3 km: `pin` L1392).

### 1.6 Versões integradas no jogo

**`jogo__zombiada-modo-livre.js`** (nova) e **`jogo__zombiada-jardim-aurora.js`** (antiga: `DBMAX 60`, sem halo das partículas quentes, cores de fumaça
diferentes; mesmos nomes de função: `pAdd` L56235, `decalAdd` L56308, `fxBlood` L56379, `EXP` L56512, `fbAdd` L56549, `explode` L56643, rain L57549).
Linhas abaixo são do modo livre (`fxUpdate` L72332 trata a gota que bate no chão).

| Peça | Linha | O que faz (diferença para a Oficina/Laboratório) |
|---|---|---|
| Pool de partículas CPU | `P` L72074 (PMAX 1500), `pAdd` L72100 | pontos opacos redondos sem blend; `hot` (faísca/brasa) |
| Halo das quentes | `gPts` (GMAX 600) L72088-72099 | segundo Points aditivo, **só o subconjunto quente**, sem luz nova |
| Decalques de mundo | `decalPool` L72112, `decalMaterial` L72123, `decalMesh` L72165, `decalAdd` L72174 (D 256 + DD 256 pequenos) | InstancedMesh com **shader por tipo**: 0 poça, 1 pegada, 2 escorrido (fio com bulbo), 3 queimado, 4 bile (bolhas); cor fresca→seca no shader, brilho molhado; parede (`vert` = ângulo da normal) |
| Atualização | `decalsUpdate` L72309 (chuva espalha 1,5× e seca 20× mais devagar, tinge), `fxUpdate` L72332 (gota que cai vira respingo esticado por 1/seno) | |
| Sangue | `fxBlood` L72245, `fxWallBlood` L72183 (escorrido na parede atrás do corpo), `wallFace` L72192, `fluidsUpdate` L72210 (feridos pingam), `fxDrip` L72225, `footCheck/footStep` L72228-72240 (pegadas por 8 passos) | por idade (`IDADES`) |
| Faísca, poeira, nuvem, membro | `fxSpark` L72264, `fxDust` L72265, `fxCloud` L72271 (bile do Inchado com puffs opacos), `fxLimb` L72284 (40 peças) | |
| Luz do disparo | `flashLight` L72296 | 1 luz, 50 ms; traçante curto |
| Explosão | `EXP` L72389 (granada, botijão, barril, carro, molotov), `HEAT` L72397, `FB` + `fbAdd` L72401-72426 (260 puffs instanciados, shader com erosão), `debrisAdd` L72438 (120), `expLights` L72447 (2 luzes), `flashEl` (DOM) + `camShake` L72455, `ringMesh` L72461 (**1 anel só**), `explode` L72521-72602 | porte do Laboratório com **LOD por distância** (q 1/.5/.2/.1) e **teto de 6 explosões em 4 s por área** (lod .3); sem cratera, sem esfera de choque, sem cogumelo toroidal (anel de 10 puffs), sem faíscas esticadas (usa pontos quentes) |
| Camada de jogo | `EXPLO` (botijão, barril, carro) L72466, `addExplo` L72467, `rayExplo` L72486, `exploDamage` L72499 (vaza → pega fogo → explode; cadeia por `exploDamage(..., 600·falloff)`), `FIRES` L72515 (fogo residual: dano 15/s, `burnStart` em zumbis), `boom` L72603 (som sintetizado), `wallBreak` L72612, `throwItem` L72625, `explosionsUpdate` L72640, `carWreck` L72732, `wrecksUpdate` L72738, `emitNoise` | dano de explosão a zumbis (`letal`/`fer`), jogador, portas, muros, cadeia |
| Chuva | `RAIN` 14000 Points com shader L73442-73450 | |

---

## 2. O que o SDK já tem do mesmo assunto

**`game-destruction` (núcleo, 4216 linhas src + 15 arquivos de teste)**: materiais com `hitDebris/breakDebris`, dano por tipo, `explode(point, energy, radius)` com
queda `(1−d/r)²`, ignição de inflamáveis, queima/carbonização/cinzas, derretimento e gotejo, vazamentos, juntas, colapso estrutural, determinístico por semente,
`serialize`. Eventos: `dent, hole, crack, ricochet, debris, fracture, detach, ignite, extinguish, burnout, melt, drip, leak, explode, stress, collapse, destroyed`.

**`game-destruction-three` (4861 linhas)**:

- `particles.ts` (436): `ParticleSystem` com **dois Points** (40 % aditivo, 60 % normal), 14 tipos fixos (`fire, smoke, sparks, dust, shards, splinters, chips, fibers, leaves, drips, ash, steam, flash, foam`, L35-50), `burst(kind, ponto, normal, n, velocidade, opts)`, `spawn`, `push` (empurra partículas vivas, L219), `detach`, pool circular, `groundAt`, `onLand` (gota vira poça).
- `renderer.ts` (1075): `onExplode` L810 (flash 1 partícula, 34·k fogo, 24·k fumaça, 22·k poeira, 16·k faíscas, `push`, **1** PointLight lazy, empurra peças e fragmentos), `emitFire` L928 (taxa por volume da parte, tom de fumaça por material), `updateLeaks` L964, `emit` L996 (`fire|flash|sparks|...`), `updateLight` L851, qualidade `low` (60 % das explosões, 1250 partículas, 80 fragmentos).
- `visual.ts` (840): amassado por vértice, furos e rachaduras como decalques presos à peça (48 por malha, 600 no total), carbonização, brilho `heatColor`, derretimento.
- `fragments.ts` (269), `pieces.ts` (375), `ground.ts` (104: poças e cinzas, mescla vizinhas), `spec.ts` (`specFromObject3D`), `heat.ts`.
- 6 arquivos de teste (renderer 484 linhas, vertex range 285, heat, vertex colors, pieces, spec).

**`game-fluids` (2347 linhas src + 400 de teste)**: contêineres com nível por forma e inclinação, temperatura/vapor, jatos balísticos que terminam em superfícies ou no chão (`landing.ts`),
**manchas por frente de fluxo** (16 raios, nunca disco, corre morro abaixo, absorve em superfície porosa, seca da borda para dentro e some ou deixa marca; `stains.ts`),
torneiras, furos (`puncture`, Torricelli), 19 líquidos em `data/liquids.json` (inclui `blood`, `fuel`, `motor_oil`; **sem bile nem sangue antigo**), usos de item (`sip`, `pour`...),
serialização, `splash` (evento), locale pt-BR/en.

**`game-fluids-three` (1717 linhas + 305 de teste)**: líquido dentro do contêiner (recorte pelo plano da superfície), jatos em tubo, manchas em leque suave com brilho interno que recua,
respingos em Points, 3 qualidades (manchas 24/48/96, jatos 12/24/48, partículas 96/256/512).

**`game-test-room` (6766 linhas)**: sala em primeira pessoa, catálogo por abas, ferramentas (tiro, martelo, fogo, maçarico, arremesso, agarrar, chute, extintor), inspetor, registro NDJSON, 22 cenários com `step` determinístico e `expect`, câmera lenta 0,25×, tempo ×10, qualidade, `loadModule(TestableModule)` com verificação de contrato. **Sem** contadores de partículas, draw calls ou fps na UI, sem camadas ligáveis, sem "ficha do efeito".

**`game-contracts/module.ts`**: `TestableModule { id, name, group, items, scenarios?, area?, attach?(host) }`; `ModuleHost { THREE, scene, camera, groundAt, tool, on, onFrame, log }`. Item-cêntrico: não há conceito de "efeito com parâmetros que se repete".

**`game-devtools` (1299 linhas)**: voo livre, HUD de posição, marcas e notas, painel de toggles/ações/horas do dia/lugares, `scenarios(list, apply, check)` que devolve `{critério:{ok,nota}}`, etiquetas flutuantes.

**`game-weapons` / `game-weapons-three`**: `frag_grenade` (energy 200 000 J, radius 6, fuse 4 s), `pipe_bomb`, molotov em `weapons.json`; `weapons-three/fx.ts` tem **cápsulas e carregadores** (MAX_CASINGS 120, som, teste) mas **nenhum clarão de disparo nem fumaça de cano**, nenhum projétil de foguete.

Lacunas do SDK neste assunto: bola de fogo/fumaça em camadas, onda de choque (esfera/anel), cratera e marca queimada de explosão, faíscas esticadas, pool de luzes (só 1), anéis, tremor e clarão de tela, chuva, clarão de disparo, rastro de projétil, LOD por distância, teto de explosões por área, sangue com idade e bile, respingo por ângulo de impacto, filme fino com escorrer em parede, decalque de mundo (parede/piso/meio-fio) que seca, fogo residual no piso com dano.

---

## 3. Comparação item a item

Legenda de ação: **portar** = trazer a entrega para o pacote; **manter SDK** = o SDK já cobre melhor; **mesclar** = ficar com o melhor de cada um.

| # | Assunto | ZombiAdA (onde) | SDK (onde) | Melhor | Por quê (concreto) | Ação |
|---|---|---|---|---|---|---|
| 1 | **Sala de testes** (destruição, 22 testes) | `sala-de-testes__sala-de-testes.js` (bundle do SDK) | `packages/game-test-room`, `examples/test-room` | **igual (é o SDK)** | Mesmas 26 chaves `sc.*`, mesmo módulo de aluguel de carro, mesmos `fluid_particles` e `destruction-particles`. README do pacote diz 21 cenários, o código tem 22 | manter SDK; corrigir README; página do site passa a servir `examples/test-room/dist/test-room.html` |
| 2 | **Oficina de VFX como bancada de efeitos** × `game-test-room` | Oficina L1246-1291: catálogo por time, ficha (Quando/Visual/Orçamento/Rede), parâmetro por efeito, repetição, câmera por efeito, LOD 3 níveis, contadores (fps, draw calls, partículas, decalques) | `game-test-room/src/ui.ts`, `room.ts` (slow-mo L1971, qualidade L2031), `log.ts` | **complementares** | A sala é melhor para teste automático (log NDJSON, `step` determinístico, `expect`, contrato de módulo). A Oficina é melhor para **revisão visual**: repete o mesmo efeito, mostra orçamento e contadores. A sala não tem contador de partículas/draw calls nem camadas ligáveis (as do Laboratório) | mesclar: `examples/vfx-test-area` carrega um `TestableModule` na sala; pedir à sala (ver dúvida 4) um painel genérico de parâmetros, camadas e contadores |
| 3 | `game-devtools` × Oficina/Laboratório | Oficina: órbita + `#id`. Laboratório: auditoria | `game-devtools` (voo livre, marcas, `scenarios.check`) | **SDK** | Devtools já roda checagens automáticas por critério; ideal para F1-F12 do Padrão e para o orçamento ("≤ 400 partículas") | manter SDK; escrever os critérios F1-F12 e os orçamentos como checagens |
| 4 | **Partículas genéricas (pool)** × Oficina | `PSys` L179-221: 2 sistemas de 9000, gradiente c0→c1 por spawn, `cone/box/r/flat/v`, `drag` e `g` por partícula (g negativo = empuxo), `gnd` 1/2/3, `fi` | `particles.ts` Pool L103-330, 14 tipos fixos, 2500 (40/60) | **mesclar** | Oficina: controle por spawn (cone, volume, gradiente, drag, empuxo), `gnd:3` vira decalque, sem alocação no loop (c0/c1 pré-calculados). SDK: determinístico (mulberry32), API `burst/spawn/push`, tipos acoplados ao contrato `DebrisKind`, `detach` limpa a cena, testado. SDK aloca 2 arrays por partícula por quadro (`hexToRgb`, L294-295); Oficina usa `Math.random` (quebra LAN) | portar as opções de spawn da Oficina para o pool do SDK; corrigir a alocação; manter RNG semeado |
| 5 | **Faíscas e riscos** | Oficina `Streaks` L223-245 (LineSegments); Laboratório `spark` L281 + shader L247-277 (quads esticados pela velocidade, 5 paletas) | `sparks` = ponto redondo aditivo (`particles.ts` L38) | **Laboratório** | Faísca em movimento lê como risco; ponto não. Quad esticado tem largura controlável (LineSegments fica em 1 px e depende do driver). 5 paletas cobrem faísca, estilhaço frio, clarão azulado, vidro, brasa | portar (Laboratório) |
| 6 | **Fogo** | Oficina `fireEmit` L399; Laboratório `fire()` L426 (puffs quentes + fumaça + luz); Arsenal `flameBit/groundFire` L460-463; Vale `fire/mvFlame/tfFire` | `renderer.ts` `emitFire` L928 (ligado a `part.burning`, volume da parte, tom de fumaça do material) | **mesclar** | SDK: gatilho correto (parte queimando, material, volume) e teste. Laboratório: visual no estilo do jogo, luz tremida (2 luzes seguem os 2 maiores fogos). Arsenal/Vale são cenografia | manter o gatilho do SDK, trocar o renderer pelo do Laboratório |
| 7 | **Fumaça** | Oficina: sprite macio (`norP`); Laboratório/jogo: puff opaco facetado com erosão por ruído (`discard`), estilo do jogo | `smoke` sprite macio com alpha (`particles.ts` L36) | **Laboratório** | Sem overdraw alfa, sem ordenação, borda dura no estilo do jogo, cabe na GTX 1060; é a decisão visual declarada pelo time | portar |
| 8 | **Explosão (visual)** | Laboratório `blast()` L642-713 (9 camadas); jogo `explode` L72521; Oficina `explode` L406 (superada) | `onExplode` L810: 1 flash, 34 fogo, 24 fumaça, 22 poeira, 16 faíscas, 1 luz | **Laboratório** (visual); **SDK** (integração) | Laboratório tem choque, cratera, cogumelo, residual, detritos em brasa, LOD, camadas, perfis por explosivo. SDK liga ao evento `explode` do núcleo e já empurra peças e fragmentos (`pieceSys.impulse`, `fragments.blast`) | mesclar: renderer do Laboratório disparado pelo evento `explode`; perfil derivado de `energy/radius`, com override |
| 9 | **Onda de choque** | Laboratório `shock` L337-348 (esfera com fresnel + anel de poeira + empurra puffs); Oficina `ring` L312 | só `particles.push` + `fragments.blast` (sem visual) | **Laboratório** | O SDK empurra mas não desenha; o jogo reduziu a 1 anel compartilhado (um por vez) | portar |
| 10 | **Cratera e marca queimada** | Laboratório `dent` L69, `crater` L462, `scorch` L461, `conform` L458; jogo: decalque tipo 3 (sem cratera) | `ground.ts` só poças e cinzas; `dent` só em objetos | **Laboratório** | Piso afunda numa grade de altura que faísca, detrito e zumbi consultam (`groundH`), decalque se conforma ao relevo, borda com asfalto quebrado. O SDK não deforma terreno | portar; decidir dono do terreno deformável (dúvida 6) |
| 11 | **Detritos e fragmentos** | Laboratório `chunk` L374 (300, brasa 1,6 s); Oficina `debris` L254 (500); jogo `debrisAdd` L72438 (120) | `fragments.ts` (160/80, por material e cor, descansam e encolhem) + `pieces.ts` | **mesclar** | SDK é ligado à fratura e ao material (testado). Laboratório tem brasa e placa/pedra para explosão | manter SDK para fratura; portar `chunk` com brasa para explosões |
| 12 | **Luzes** | Oficina `LP` 4 + 2 fogo; Laboratório 4 + 2 com uniforme de brilho nos puffs; jogo 2 | 1 luz lazy (`onExplode` L819), "recompila shader na primeira explosão" (README) | **Laboratório/Oficina** | Pool pré-criado evita o travamento da primeira explosão; várias explosões simultâneas; fogo residual com 2 luzes | portar |
| 13 | **Decalque em objeto** (furo, rachadura) | Oficina `bwHit` L894 (furo filho do bloco) | `visual.ts` (decalques presos à parte, seguem a peça solta, `restore`), cap 48/600 | **SDK** | Já resolve "furos continuam nos blocos caídos", com teste e restauração | manter SDK |
| 14 | **Decalque de mundo** (poça, respingo, pegada, escorrido, queimado) | Oficina `decIM/decIMd` L267-306; jogo shader por tipo L72123-72180 (256+256, parede, chuva) | `ground.ts` (disco simples) | **jogo (custo)** / **Oficina (fluido)** | O decalque do jogo cobre 5 tipos num InstancedMesh com secagem e brilho no shader, barato para a horda. O SDK só tem disco opaco | portar o do jogo; o da Oficina entra como fonte de tipos |
| 15 | **Impacto por material** | Oficina `IMP` L374-391 (6 materiais fixos) | dados por material (`hitDebris`, `breakDebris`, 20+ materiais) em `game-destruction` | **SDK** | Dirigido por dados e por parte; faltam só **água** (coroa + 2 anéis) e **carne** (sangue), e a luz curta da faísca em metal | manter SDK; portar água, carne e luz de faísca |
| 16 | **Vidro estourando** | Oficina `vidro` L846 (rachadura em textura, 75 cacos); Arsenal `wall` | fratura `shatter` + prismas finos + decalque de estrela, cenários `glass_shatters`, `bottle_drop_shatters` | **SDK** | Simula, tem teste, cacos finos que rolam | manter SDK |
| 17 | **Porta, parede, grade, cerca, mesa, porta de metal** | Oficina L857-1031: roteiros com `at()` | juntas, HP por parte, `detach`, `collapse`, `dent`, `structure.test`, 22 cenários | **SDK** | A Oficina anima um caso por cena; o SDK simula qualquer objeto. Os casos da Oficina viram **casos de aceite** | manter SDK; transformar cada caso em cenário golden (porta em 3 estágios, parede com furos presos, tábua a tábua, mesa por perna, extintor, cilindro) |
| 18 | **Extintor e cilindro de oxigênio vira foguete** | Oficina `pressao` L1032 | vazamento pressurizado, `explodes`, cenário `extinguisher_puts_out_fire` | **mesclar** | SDK cobre o extintor; **propulsão** (cilindro disparado pelo jato) não existe | portar a propulsão como comportamento de peça pressurizada |
| 19 | **Fogo no tanque e carro explodindo** | Oficina `vazamento` L1118, `explosao` L1139, `vehicleBoom` L1133; Laboratório `carro` L950; jogo `carWreck` L72732 | `leak` + `explodes` no núcleo; sem coreografia de carro | **portar** | A coreografia (pula, capô/portas/roda voam em brasa, vidros, carcaça queimando 30 s) é de veículo | portar para `game-vehicles` (+ vfx); dúvida 7 |
| 20 | **Fumaça do motor por condição 100/60/30/10** | Oficina `motor` L1103 | — | **portar** | Depende de condição do veículo | portar como receita ligada à condição |
| 21 | **Clarão de disparo** | Oficina `muzzle` L417 (4 perfis por arma + luz 50 ms); Arsenal `muzzleFlash` L716 (cone + pétalas) | `weapons-three` não tem | **Oficina** | Escala por calibre, jato lateral da Barrett, luz que ilumina fumaça | portar (consumido por `weapons-three` via `HostEvent` `shot`) |
| 22 | **Cápsulas** | Oficina `casing` L428; Arsenal `ejectCase` L729 (malha real por calibre) | `weapons-three/fx.ts` (por calibre real, 120, som, teste) | **SDK** | Já é por calibre, com limite e som | manter SDK |
| 23 | **Projétil de foguete e backblast** | Laboratório `rocket` L771, `backblast` L788, `launcherScene` L920 (M79, M72, AT4, RPG) | `weapons` não tem projétil de foguete | **portar** | Rastro por 0,14 m, tremida, impulso inicial | portar (arma = `game-weapons-three`, rastro = vfx) |
| 24 | **Granada que quica** | Laboratório `physThrow` L751 (restituição .4, atrito, rola com rotação, pavio contado desde o arremesso), `throwArc` L738; jogo `throwItem` L72625 | arremesso de peça com física no `pieces.ts`, pavio `fuse` em `weapons.json`, cenário `throw_chair_at_wall` | **SDK** (estrutura) | Já é peça com massa e colisão; conferir se rola proporcional ao deslocamento e conta o pavio desde o arremesso | manter SDK; adicionar cenário "granada quica 2×, rola, explode no pavio" |
| 25 | **Janelas estouram com atraso** | Laboratório `breakWindow` L716 (`d/340` s) | o núcleo quebra vidro por dano de explosão, sem atraso | **mesclar** | Atraso por velocidade do som é detalhe barato | portar o atraso como opção do núcleo (`explode`) |
| 26 | **Zumbis reagindo à explosão** | Laboratório `hitZombie` L516 (letal/ferimento, partes, ragdoll ≤ 12); jogo `explode` L72568-72594 | núcleo usa **1 raio** `(1−d/r)²`; não há personagens | **portar** | É dano a corpo por zona, não efeito | levar para `game-characters`; o contrato precisa de dois raios (letal e ferimento), dúvida 3 |
| 27 | **Sangue por idade e bile** | Oficina `BLOOD/AGE` L135, `bloodHit` L392; jogo `IDADES`, `fxBlood` L72245 | `blood` único (`liquids.json`), sem `bile` nem `blood_old` | **portar** | Cores/volumes por idade são do ZombiAdA (8A0A0A, 5A0C10, 3A1C12, 1D1914; 1, .7, .35, .1) | conteúdo do ZombiAdA + novos líquidos no `game-fluids` |
| 28 | **Respingo direcional (1/seno)** | Oficina `fSplat` L598; Padrão `splat` L73; Arsenal `splat` L911; jogo `fxUpdate` L72332 | manchas radiais, `splash` sem ângulo | **Padrão** | Forma por ângulo, espetos, satélites, nunca disco (F1, F2) | portar |
| 29 | **Filme fino com escorrer** (Padrão de Fluidos × `game-fluids`) | Padrão L60-113 + Oficina L562-743 (grade 1,25 cm; pino, frente, parede, meio-fio, seca pela borda) | `stains.ts` (16 raios) + `StainVisual` (leque, brilho interno) | **Padrão em fidelidade; SDK em generalidade** | Padrão: fio com gota na ponta que passa da parede para o chão, rejunte, meio-fio, craquelê, bolhas, iridescência (F4, F5, F8, F9). SDK: contêineres, torneiras, furos (Torricelli), 19 líquidos, determinismo, serialização, LAN, testes. O filme do Padrão é cosmético e local | mesclar: SDK dono do estado e dos eventos; o filme entra como **renderer opcional** em `fluids-three` para superfícies marcadas (parede, piso, meio-fio) |
| 30 | **Gota em voo e gota pendurada** | Padrão L251-286 (instâncias esticadas, `updDrip`) | `streams.ts` (tubo + gota na ponta), `particles.ts` do fluids-three (96/256/512) | **mesclar** | SDK tem o jato físico; falta a gota que incha e solta na borda de um ferimento ou de um corrimão | portar a gota pendurada |
| 31 | **Fonte contínua** | Padrão `updSrc` L288 | torneira, vazamento, `pour`, `puncture` | **SDK** | Modelo físico (vazão por nível e viscosidade) | manter SDK |
| 32 | **Materiais de fluido** (dados) | Padrão `FL` L45 (5), Oficina `FT` L583 + `FLUID` L273, tabela da página | `liquids.json` (19) | **mesclar** | SDK não tem bile nem sangue antigo. **Sangue seco**: Padrão/regra da Oficina = marrom `3B1D14`, seca em 10 min (6 min o antigo); SDK `blood.stainColor` = `0x4A0506` (vinho) e `dryTime` 1200 s. Gasolina: regra = evapora em 60 s sem marca; SDK `fuel` 120 s e `leavesMark: true` | alinhar os dados à regra do time (dúvida 2) |
| 33 | **Efeitos de tela** | Oficina `S`/`updateScreen` L353-371 (CSS filter, box-shadow, canvas 2D); jogo `flashEl`, `camShake` L72447-72460 | não há | **portar** | Tremor, clarão, vinheta vermelha, aberração, dessaturação, batimento, sangue na lente são genéricos de jogo | núcleo guarda o estado (valores que decaem); adaptador DOM/three aplica |
| 34 | **Chuva** | Oficina `updateRain` L322 (4000 linhas, respingo só perto da câmera); jogo L73442 (14000 pontos, shader) | não há | **portar** | Respingos, anéis em poça e espalhar sangue ×1,5 / não secar chovendo (Oficina L292, jogo `decalsUpdate`) cruzam clima com fluidos | portar o desenho; decidir dono do clima (dúvida 8) |
| 35 | **LOD e orçamento** | Laboratório `lodFor` L481 (distância 1/.5/.2/.08); jogo teto de 6 explosões / 4 s / área; Oficina nível 0-2 (1/.5/.2) com mínimo de 1 partícula | `quality low` = 60 %, orçamentos fixos | **Laboratório + jogo** | LOD por distância e teto por área protegem a GTX 1060 com 2000 zumbis; o SDK não tem | portar |
| 36 | **Determinismo / rede** | Oficina `Math.random`; Laboratório e Padrão LCG com semente; jogo `R = rng(20261022)` | mulberry32 por semente em tudo | **SDK** | Oficina promete "semente + hora do evento bastam", mas usa `Math.random` | usar o RNG semeado do SDK em todo o porte |
| 37 | **Testes** | nenhum (páginas) | vitest nos 6 pacotes (renderer 484, fluids 400, test-room 6 arquivos) | **SDK** | Zero teste nas entregas | goldens por efeito (ver seção 4) |
| 38 | **Cenografia animada** (fogo do ônibus, helicóptero, lareira, sangue parado) | Vale `fire/smoke/mvFlame/tfFire/blood` | — | **portar como uso** | Não é motor, é lugar onde plugar | só uma lista de pontos de uso no pacote de conteúdo |

---

## 4. Destino por módulo

### Recomendação: um pacote novo `game-vfx` + `game-vfx-three`, **não** dentro de `game-destruction-three`

Motivos:

1. `game-destruction-three` já tem 4861 linhas e um renderer de 1075, ligado a **eventos do núcleo de destruição**. Boa parte do que a Oficina e o Laboratório entregam **não nasce de destruição**: clarão de disparo, chuva, efeitos de tela, fogueira, faísca de raspagem, fumaça de motor, sangue, luz de farol, projétil de foguete, respingo na parede.
2. Dois outros pacotes precisam das mesmas primitivas (`weapons-three` para clarão e rastro; `fluids-three` para o decalque de mundo e a gota). Quem as tiver dentro de `destruction-three` obriga a dependência cruzada para o pacote mais pesado.
3. Regra do `CLAUDE.md` §2: motor genérico no núcleo, three.js em `<lib>-three`, conteúdo em pacote próprio.
4. Orçamento: um pool compartilhado de puffs, faíscas, luzes e decalques evita três pools concorrendo (hoje o SDK tem um de partículas em `destruction-three` e outro em `fluids-three`).

Desenho:

| Pacote | Conteúdo | Genérico ou ZombiAdA |
|---|---|---|
| **`game-vfx`** (sem three.js, determinístico) | `Effect`/`Recipe` como dados (camadas, contagens, durações), `QualityPolicy` (3 níveis + LOD por distância + teto por área), `ScreenState` (tremor, clarão, vinheta, aberração com decaimento), orçamentos, perfis de explosão a partir de `energy/radius` com override (`ExplosionLook`), receitas de impacto por material, fogo, fumaça, faísca, clarão de disparo por calibre, `FluidLook` (cor fresca/seca, tempo de secagem) | **genérico** |
| **`game-vfx-three`** | `PuffSystem` (icosaedro instanciado, rampa de calor, erosão por ruído), `StreakSystem` (quads esticados), `GlowSystem`, `ShockSystem`, `ChunkSystem` (detritos com brasa), `RingSystem`, `LightPool` (4+2), `DecalSystem` de mundo (tipos poça/pegada/escorrido/queimado/bile, parede, secagem no shader), `RainSystem`, `TerrainDent` (se for dele), adaptador DOM para `ScreenState`, absorve o `ParticleSystem` de `destruction-three` | **genérico** |
| `game-destruction-three` | passa a **assinar** o `game-vfx-three` nos eventos (`explode`, `ignite`, `debris`, `leak`) em vez de ter pool próprio; mantém amassado, furo, fratura, peças | genérico |
| `game-fluids` / `game-fluids-three` | ganham `bile`, `blood_old`, parâmetros do Padrão (`pin`, `front`, `K`), forma por ângulo de impacto no `splash`, e o **renderer de filme** (grade) como modo opcional por superfície | genérico |
| `game-weapons-three` | passa a chamar `muzzleFlash`/`trail` do vfx | genérico |
| **`game-vfx-zombiada`** (conteúdo) | idades do sangue (`BLOOD/AGE`), nuvem do Inchado, grito do Gritador, olhos na neblina, corpo que dissolve, reanimação, decapitação, membro, fases da infecção, pânico, cegueira, tosse, perfis `PROF` com nomes dos explosivos do Arsenal (granada M67, botijão P13...), fumaça do motor por condição, receitas de cenografia do Vale | **só do ZombiAdA** |
| `game-characters` (futuro) | `hitZombie`, `gibs`, `knock`, `burnZ`, sangradores de ferida, ferimentos (Arsenal L919-975) | do corpo, não do vfx |
| `game-vehicles` / `-fleet` | coreografia do carro explodindo (`vehicleBoom`, `carTick`), faísca de raspagem, para-brisa em 4 estágios | veículos |
| `examples/vfx-test-area` | carrega um `TestableModule` `vfx` na sala de testes: cada efeito da Oficina é um item (barril, carro, vitrine, parede de blocos, botijão, lata de óleo...) + cenário com `expect` sobre contagens e estado | — |

**O que é genérico (levar para o motor):** pools (puff, faísca, brasa, luz, anel, decalque), receita em camadas de explosão, onda de choque, cratera, fogo residual, chuva, tela,
LOD, filme fluido, forma por ângulo, impacto por material, clarão de disparo por calibre, rastro de projétil.

**O que é só do ZombiAdA:** tudo o que depende de zumbi ou do Vale: idades de infecção, Inchado, Gritador, olhos, corpo, reanimação, infecção/pânico/cegueira/tosse, faróis do jipe, cenografia do Vale (ônibus, helicóptero, pátio do presídio), nomes e números de `PROF` dos explosivos do Arsenal.

**Ordem sugerida:** (1) pools + LOD + RNG no `game-vfx(-three)` já absorvendo o `ParticleSystem` do SDK; (2) explosão do Laboratório ligada ao evento `explode`; (3) decalque de mundo + sangue/bile + filme do Padrão; (4) clarão de disparo e rastro (para `weapons-three`); (5) conteúdo `game-vfx-zombiada`; (6) chuva e tela.

**Testes golden por efeito** (R2 da spec): por exemplo, "explosão de granada com semente 1 produz N puffs, M faíscas, 1 anel, 1 cratera de 0,9 m com 25 cm de fundo, nunca passa de 400 partículas",
"sangue fresco seca em 600 s (marrom 3B1D14)", "respingo a 15° tem comprimento/largura ≈ 1/sen(15°)", "furo continua no bloco que caiu" (já coberto).

---

## 5. Dúvidas para o dono

1. **Qual explosão vale?** O Laboratório (puffs opacos, "versão final") ou o estilo de sprite macio do SDK/Oficina? Pelo texto do time e pelo jogo, é o Laboratório; confirmar antes de apagar o `onExplode` atual.
2. **Dados de fluido: valem os do time ou os do SDK?** Sangue seco: marrom `3B1D14` e 10 min (regra do time) contra `0x4A0506` e 20 min (SDK). Gasolina: 60 s e sem marca contra 120 s e marca. Qual vira a regra?
3. **Dois raios de explosão** (`letal` e `ferimento`) existem em tudo do time (granada 5/15, C4 6/18, tanque 12/30); o SDK tem um raio e `energy`. Onde mora o segundo raio: em `game-weapons` (dados) e em `game-characters` (dano), ou em `game-contracts`?
4. **Contrato da sala de testes para efeitos.** `TestableModule` é item-cêntrico. Para a Oficina precisamos de: parâmetro por efeito (idade, fluido, arma), repetir, camadas ligáveis, contadores (fps, draw calls, partículas, decalques). Aceita ampliar o contrato (`ModuleHost.panel()`/`params`) ou mantém a sala como está e o `vfx-test-area` traz a própria barra?
5. **Filme do Padrão como renderer opcional ou substituto?** O filme de 1,25 cm custa CPU (fStep) e upload de textura por quadro; só vale em até 6 grades perto do jogador. Aceita o modo "filme" para poucas superfícies e o decalque barato (do jogo) para o resto?
6. **Terreno deformável (cratera).** O Laboratório usa uma grade de altura própria (`groundH`); o SDK tem só `groundAt(x, z)` como callback. A grade fica no `game-vfx-three` ou vira um pacote de terreno?
7. **Coreografia do carro explodindo e fumaça por condição**: ficam no vfx, no `game-vehicles` ou no `game-vehicles-fleet`? Depende de a condição (100/60/30/10) existir no veículo.
8. **Clima (chuva, neblina, relâmpago)** é do vfx ou de um futuro `game-weather`? A regra "chuva espalha sangue 50 % mais e não deixa secar" cruza clima com fluidos.
9. **Efeitos de tela**: ficam como adaptador DOM no `game-vfx-three`, ou o SDK não faz tela (e só entrega o estado)? Hoje a Oficina e o jogo usam DOM/CSS.
10. **Duas versões do jogo** (`modo-livre` e `jardim-aurora`): a nova (`modo-livre`) é a referência? Elas divergem em detritos (120/60), halo das quentes e cores de fumaça.
11. **Fonte original.** O Laboratório e a Oficina citam `vfx/explosoes/brief-explosoes.md` e a "revisão de fluidos". Esses arquivos existem? Têm números que não estão na página (por exemplo, teto de 300 detritos e de 4 luzes).
12. **Contagem divergente**: a Oficina tem 40 efeitos; o Laboratório diz "catálogo de 38". Faltam dois ou sobraram dois?
13. **Granada de luz, bomba caseira e claymore** só existem no Laboratório (não no Arsenal 3D nem em `weapons.json` como `flash`/cone). Entram no `game-weapons`?
14. **Projétil de foguete** (M72, AT4, RPG-7) não existe em `game-weapons`. É escopo desta migração ou da migração de armas?


---

## 6. Fase 5: o que entrou (R5)

Atualizado em 2026-10-24. Cada linha: a peça da página, onde ficou, e o que **não** entrou. Evidência e números em `evidence.md` (seções T5.1 a T5.5).

| Peça da página | Onde ficou | Estado |
|---|---|---|
| Laboratório de Explosões: compositor de camadas, laços de simulação, 16 explosivos, LOD, teto por área, tela | `game-vfx` (`createVfx`, `data/explosions.json`) e `game-vfx-three` (shaders, marcas, luzes, tela) | entrou; 16/16 cenas iguais ao original (puro e three) |
| Explosão do SDK antigo (cinco jatos de `ParticleSystem` e luz própria) | `game-destruction-three` toca `vfx.explosion` e `vfx.fire`; `particles.ts` apagado | trocado |
| Detritos, faíscas, cinzas, vapor, gotas e vazamentos (fluidos e destruição) | pool de sprites por tipo de `game-vfx` (`burst`, `spawn`, `onLand`, 14 tipos); `game-fluids-three/sprites.ts` | trocado |
| Oficina de VFX: 36 receitas (criaturas, armas, destruição, veículos, mundo, tela) | `game-vfx/src/effects/*` como dados, `vfx.play`; texturas e pools em `src/workshop/*` | entrou; 162 asserções do golden sobre 54 execuções |
| Oficina: desenhistas (sprites, riscos, detritos, decalques, anéis, luzes) | `game-vfx-three/src/workshop-layers.ts` | entrou; bolha de lente e pós-processo (`P0`) **só nos dados** |
| Oficina: chuva (W321-331), neblina, faróis | efeitos `chuva`, `neblina` e `farol` em `game-vfx/src/effects/world` e `vehicles`, `RainField` em `src/workshop/rain.ts`; a cortina de 14 000 pontos, a chuva perto, o céu, o relâmpago, os faróis e a névoa de calor em `game-weather-three` (T6.2c) | entrou; golden `vfx-workshop-weather` e golden da cortina |
| Arsenal: clarão do cano (`muzzleFlash`), fumaça, sopro do lançador e jato do lança-chamas da arma na mão | receitas `viewmodel_muzzle_flash`, `weapon_smoke_puff`, `launcher_backblast` e `flame_jet` (`VIEWMODEL_EFFECTS`, `game-vfx/src/effects/weapons/viewmodel.ts`, desenhadas como sólidos pelo `mesh-layer` do `game-vfx-three`), tocadas pelo `host.effects` em `game-weapons-three` | entrou como a galeria desenha (sólidos, segmentos, 55 ms, luz que segura, giro inteiro do cano, sorteios na ordem); comparado quadro a quadro com o código antigo (`record-viewmodel-flash.mjs`) |
| Oficina: impacto por material, sangue por idade, clarão de disparo, cápsulas | receitas `impact`, `blood_hit`, `muzzle`, `casing` e as fatias `impact_<material>`, `muzzle_*`, `casing_*` | entrou; o módulo de armas toca clarão e cápsula de tiro visto de fora; **`hit` com ponto, normal e material não existe** no contrato (pergunta ao dono) |
| Oficina: fichas (Quando, Visual, Orçamento, Rede) | `game-vfx/src/locales` (`en`, `pt-BR`) e a ficha do módulo de bancada | entrou |
| Bancada de efeitos | `createVfxTestModule` (`game-vfx-three`), painel com ficha, `optgroup` e linha do tempo em `game-test-room`, `examples/vfx-test-area` e dentro de `interactables-test-area` | entrou |
| Padrão de Fluidos: filme que escorre (F60-114), respingo por ângulo, gotas, pingo, fontes, arrasto, 5 perfis | `game-fluids/src/film/*`, `data/film-profiles.json` | entrou; 29/29 bit a bit (25 do Padrão e 4 da Oficina) |
| Padrão de Fluidos: shader do filme, gotas instanciadas, bulbo | `game-fluids-three/src/film/*` | entrou; só CPU perto do jogador (6 grades, 30 m, orçamento em ms, envio do retângulo sujo, decalque da grade parada) |
| Fluidos vivos da Oficina (W562-744) | mesmo filme com `WORKSHOP_LAYOUT` e os perfis da Oficina como padrão | entrou |
| Valores do time: sangue 0x3B1D14 e 600 s, sangue antigo, bile, gasolina que evapora em 60 s | `game-fluids/data/liquids.json` (padrão configurável por `patchLiquids`) | entrou; os valores antigos estão no changeset |
| Vazamento vira gota no filme, `tint` por idade, gancho da chuva | `createFilmBridge` e `film.setWeather` | entrou; **`body` (T4.0) -> `splat` pendente**: o evento não existe no contrato desta branch |
| Efeitos de tela (tremor, clarão, vermelho, bordas, aberração, dessaturação, gás, batimento) | estado em `game-vfx`; overlay em `game-vfx-three` | entrou (CSS no overlay) |
| Jogo (versão reduzida, teto por área, cadeia) | `AREA_CAP_GAME`, `LOD_GAME`, `delay` do `explosion` | entrou como padrão do SDK |

Dúvidas 1 a 9 da seção 5: a 9 (efeitos de tela) foi decidida como estado em `game-vfx` mais overlay DOM em `game-vfx-three`. As abertas ficam em "Perguntas para o dono" de cada seção do `evidence.md`.

## Atualização de 2026-10-25: o que entrou nesta sessão e onde

| Entrega | Onde entrou | PR |
|---|---|---|
| Física decidida pelo dono em 2026-10-24: tanque de combustível realista (ignição por faísca, chama, fogo perto e explosão), sustentação como soma dos pilares (`structure.safetyFactor`), correção da granada sempre ligada (`BREACH_BLAST_REACH`), tabela de penetração por calibre (50 cargas em `ammo.json`) | `game-contracts` (`IgnitionRules`), `game-weapons` (`rules.ignition`, `ammo.json`), `game-destruction`, `game-vehicles` (`createVehicleDestructible({ ignition, fuel })`), `game-vfx` (`vehicle_leak_ignited`) | #40 |
| Sala de testes só com itens dos SDKs (saíram `demoItems`, `SCENARIOS` e o carro de caixas) | `packages/game-test-room` (breaking 0.x), `examples/test-room`, `game-weapons-three/src/scenarios.ts` | #44 |
| Flexão, solo, núcleo, vento, arranha-céu e lajes em painéis (flexão e estruturas da explosão) | ver a tabela em `inventario/casas-mapa.md` (Atualização de 2026-10-25) e `design/T10-estrutura-real.md` | #45 #46 #48 #49 #52 #59 |
