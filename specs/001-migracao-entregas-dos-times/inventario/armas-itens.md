# Inventário: time Armas e itens

Levantado em 2026-10-23. Fontes lidas (todas em `specs/001-migracao-entregas-dos-times/sources/`):

| Sigla | Arquivo | Linhas | O que é |
|---|---|---|---|
| **GAL** | `armas-itens__galeria-3d-arsenal.js` | 1128 | Galeria 3D do Arsenal (three r128, um IIFE, estado global) |
| **ARS** | `armas-itens__arsenal.js` + `repo/site/pages/armas-itens/arsenal.html` (texto extraído para `scratchpad/arsenal.txt`) | 16 | Documento de design: o script só filtra a tabela; tudo o que vale está no texto da página (seções 00 a 18) |
| **ITE** | `armas-itens__itens-vale-cinzento.js` | 244 | Itens do Vale Cinzento: catálogo (`DATA`, linha 6) + vitrine 3D de 24 modelos |
| **JML** | `jogo__zombiada-modo-livre.js` | 75272 | Jogo integrado (inclui three e pacotes do SDK embutidos; código próprio a partir da linha ~66300) |
| **JJA** | `jogo__zombiada-jardim-aurora.js` | 58956 | Mesmo jogo, retrato mais antigo (mesmas funções, linhas menores) |

Linhas citadas abaixo são as do arquivo-fonte indicado. Para JML, JJA tem as mesmas funções em linhas anteriores (ex.: `CALIBRES` JML 66331 / JJA 53098).

---

## 1. Entregas

### 1.1 GAL: Galeria 3D do Arsenal

Seis abas (`tab`, linha 1020): **armas, munição, explosivos, zumbi (desmembramento), veículo, parede (destruição)**.

#### Materiais e primitivas (modelagem em metros, caixa arredondada)
- `mat` 11, `basic` 12, tabela `M` 13-34 (50+ materiais: metal, steel, steelL, dark, poly, olive, tan, wood, brass, copper, lead, shell, glass, crack, lens, pele/carne/osso do zumbi, fogo, clarões, fumaça, concreto, tijolo, vergalhão, botijão, dinamite, C4...). Cor sRGB convertida a linear no `mat` (r128).
- Primitivas: `rbox` 39 (com cache `gcache` e raio `RF`; usa `T.RoundedBoxGeometry`, addon), `B` 40 (caixa), `CX` 41, `CY` 42, `CZ` 43 (cilindros por eixo), `SP` 44 (icosaedro), `rng` 45 (xorshift com semente), `fitLength` 46 (escala o eixo x até o comprimento real), `mark` 49 (ponto de encaixe), `piv` 50 (pivô de peça móvel), `rail` 51, `vents` 52, `scope` 53-63 (4 tipos de mira), `buttpad` 64, `swivel` 65, `heatify` 67 (marca malha que esquenta).
- Convenção de peças móveis em `g.userData` (`P`): `slide`, `bolt`, `boltHandle`, `mag`, `magDrop`, `magDir`, `trigger`, `hammer`, `cyl`, `crane`, `ch[]`, `pump`, `lever`, `barrels`, `breech[]`, `belt`, `cover`, `round`, `gauge`, `glow[]`; pontos `muzzle`, `eject`, `loadPort`, `topLoad`, `rear`; escalares `stroke`, `kick`, `fam`, `lt`, `disp`.

#### Construtores de arma (todos com medida real e peças animáveis)
| Construtor | Linhas | Cobre | Detalhe |
|---|---|---|---|
| `pistol(o)` + `PSTY` | 81-146, 68-80 | 13 pistolas | 11 estilos (`glock`, `taurus`, `g2c`, `beretta`, `pt100`, `sig`, `cz`, `m1911`, `makarov`, `fiveseven`, `deagle`): corrediça (`slide`), cão (`ring`/`spur`/`big`), mira (`u`/`3dot`/`small`), guarda-mato (`square`/`round`/`hook`), empunhadura (`finger`/`panel`/`wood`/`rubber`/`star`/`chunky`), carregador, gatilho, janela de ejeção |
| `revolver(o)` | 147-165 | 3 revólveres | `crane` (tambor abre), `cyl` com 6 câmaras `ch[]`, cão, empunhadura de madeira/borracha |
| `rifle(o)` | 166-254 | 50 armas longas | Parametrizado por opções (`stock`, `mag`, `hg`, `scope`, `ar`, `ak`, `g3`, `rail`, `bipod`, `brake`, `jacket`, `heat`, `bolt`, `lever`, `tube`, `pump`, `round`, `carry`, `charge`, `bayo`, `rod`, `bands`, `ejectBack`, `hR`, `wR`, `br`...). Define a família de recarga em 252: `rifle`, `semiint`, `semi12`, `pump`, `lever`, `bolt`, `boltmag`, `belt` |
| `bullpup(o)` | 255-267 | Steyr AUG, Kel-Tec KSG | |
| `p90()` | 268-278 | FN P90 | carregador horizontal em cima (`magDir=1`) |
| `shotgunBreak(o)` | 279-294 | Boito | `barrels` pivô, `breech[]` |
| `m2()` | 295-310 | Browning M2 | tripé, cinta, tampa |
| `launcher(o)` + `pg7`, `ffv`, `rocketBody`, `hose`, `pilot` | 401-458, 396-400 | RPG-7 (403-415), M72 LAW (416-422), AT4 (423-430), Carl Gustaf M4 (431-439), lança-chamas M2 (440-448), lança-chamas caseiro (449-456) | tubo descartável (`disp`), foguete encaixável (`round`/`mkRound`), culatra (`breech`), manômetro (`gauge`), piloto de chama |
| `buildWeapon(w)` | 502-508 | monta + `fitLength` | usa `WEAP[i]` |

#### Dados
- `WEAP` 313-391: **77 entradas** `[nome, categoria, calibre, capacidade, comprimento mm, cano mm, peso kg, construtor, opções]` (10 categorias em `CATS` 392: pis 13, rev 3, smg 9, esc 9, fuz 13, dmr 5, snp 9, cac 6, mtr 4, lan 6). 71 armas de fogo + 6 lançadores. Opções por arma incluem `rpm`, `burst`, `sel` (seletor), `rel` (confiabilidade, 0,4 a 1,8), `st` (estilo).
- `MAGMAT` 393 (bakelite, poly), `LM` 395 (materiais de lançador), `CATS` 392.
- `AMMO` 515-524: **22 calibres** `[nome, ø estojo, comprimento total, comprimento do estojo, ø projétil, tipo]` em mm.
- `EXP` 542-555 e `buildExp` 556-571: 12 explosivos com modelo 3D (granada M67, molotov, bomba de cano, botijão P13, dinamite, C4, Claymore, granada de luz, M79, M72, AT4, RPG-7) e texto de efeito.
- `CST` 574-580 e `car(st)` 581-606: carro popular em 5 estados (intacto, amassado, pneu furado/porta caída, motor em chamas, queimado). O próprio texto diz que o modelo novo é do time de Veículos (1095).
- `WMAT` 609-614, `WST` 615, `wall(mk,st)` 616-638: parede 2,4 × 2,1 m de vidro/madeira/tijolo/concreto em 4 estados (intacta, nível 1, 2, 3), peças soltas, vergalhão.
- `label` 641 (sprite de texto) e `ruler` 648 (régua em escala).

#### Comportamento de arma (motor de animação por tween)
- Escalonador: `tw(delay,dur,fn)` 699 (lista `tasks`), `ease` 698, `particle` 700 e `stepParticles` 701-715 (gravidade, quique, repouso, `onGround`, teto de 900), loop 1013-1017.
- Tiro: `fire` 757-784 (cada família move uma peça diferente: corrediça da pistola, ferrolho do semiautomático, telha da pump, ferrolho manual `cycleBolt` 743-748, alavanca, tambor + cão do revólver; pistola trava a corrediça aberta quando zera: `W.locked`), `burst` 805 (rajada pela `rpm`, ou `burst:3` do M16A2), `pull` 741 (gatilho), `recoil` 742 (coice por `kick`), `charge` 749 (armar o ferrolho).
- Clarão e fumaça: `muzzleFlash` 716-724 (cone + 4 pétalas + esfera + luz pontual + 6 fumaças; `flashK` por tipo de estojo), `wisp` 796 (fiapo de fumaça quando o cano esquenta).
- Estojos: `caseType` 509 (shell/big/tiny/pistol/rifle por regex do calibre), `kickOf` 510, `casingMesh` 725-731 (estojo de garrafa para fuzil/.50, simples para pistola, cartucho de escopeta), `cartridgeMesh` 732, `ejectCase` 735-740 (parábola para o lado direito; para baixo em `p90` e `belt`), `ejectRound` 756 (cartucho inteiro ejetado), `restFlat` 733.
- Capacidade: `capOf` 511 (`'6+1'` soma, `'17/33'` pega o primeiro, `'8/20'` o primeiro).
- **Pane** (engasgo): `QUAL` 750 (nova 0,3%, usada 1,5%, gasta 5%, enferrujada 12%), `JN` 751 (nega, chaminé, dupla alimentação, falha de extração), `jamRoll` 753 (p = qualidade × `rel` × (1 + calor acima de 60/40); revólver e basculante só "nega"), `setJam` 754, `stuckCase` 755 (estojo preso na janela), `clearJam` 785-795 (animação própria por família: pump, ferrolho, alavanca, cinta com tampa, corrediça), `applyQuality` 803-804 (troca material por `worn`/`rust`/`rustD`, também no cano quente).
- **Calor do cano**: `W.heat` (soma `heatPer` por tipo de estojo, cai com o tempo), `stepWeapon` 797-802 (brilho emissivo do que `heatify` marcou, fumaça).
- **Recarga por tipo** (`reload` 833-853):
  - `magSwap` 806-812 (carregador sai, cai como corpo físico, outro entra; `magDir`/`magDrop`), com trava aberta da pistola e `charge` quando vazio;
  - `revolverReload` 816-821 (tambor abre 1,25 rad, ejeta 6 estojos, entram cartuchos pelo `moveIn` 813);
  - `breakReload` 822-827 (basculante abre, 2 estojos saem, 2 entram);
  - `beltReload` 828-832 (tampa, cinta, `charge`);
  - `tubeLoad` 814 (1 cartucho a cada 0,42 s para pump/semi12/lever);
  - `topLoad` 815 (ferrolho e SKS/Mosin, 0,30 s por cartucho);
  - boltmag: `cycleBolt` + magSwap; `semiint` (SKS).
- **Pesados** (`fireHeavy` 464-488, `heavyReload` 489-500): lança-chamas (jato de partículas `flameBit` 460, fumaça `smokeBit` 461, gotas que viram `groundFire` 462-463, calor e `mflash`), foguete físico com cauda, luz e fumaça de retrocarga (26 fumaças + 14 chamas atrás), tubo descartável que cai e é trocado, culatra do Carl Gustaf, troca de tanque com manômetro.

#### Zumbi, dano e sangue (aba "zumbi")
- Tabelas: `BLEED` 856, `MULT` 857, `HPS` 858, `NAMES` 859, `ZW` 860 (5 armas de teste: pistola 35, fuzil 55, escopeta 12×9 bagos, .50 BMG 180, granada 300).
- Corpo: `buildZombie` 866-887 em 11 tipos de segmento com vida própria (`zseg` 865): cabeça, mandíbula, pescoço, tronco, quadril, braço, antebraço, mão, coxa, canela, pé; `zb` 864 (caixas bem arredondadas), `clothWound` 863.
- Dano: `damage` 979-990 (multiplicador por região, `gouge` para carne, `sever` 967 arranca, `explodeSeg` 970 estoura, `splitTorso` 978, `legLost` 977 vira rastejador, pé perdido faz mancar, `kill` 976), `shootZombie` 993-1003 (raio pela tela, escopeta com bagos, `exitWound` 930 com furo de saída), `grenadeAt` 1004-1011 (300 × queda linear até 1,6 m).
- Sangue: `addBleeder` 888 (jorra por região, com pulso arterial), `bloodBurst` 936, `drop` 925, `splat` 911-920 (respingo alongado conforme o ângulo, satélites), `bloodPool` 903-910 e `stepPools` 921-924 (poça que cresce e se alisa, funde com vizinha), `paintFan` 896-901 (cor fresca → seca em 600 s, brilho cai), `fanGeo` 894, `lobes` 895, `woundDecal` 927, `starGeo` 926, `stepBleed` 937-944.
- Andar: `zWalk` 945-951 (marcha, mancar), `zCrawl` 952, `zFall` 975.

#### Interface (`render*` 1032-1116)
Lista por categoria, modo "lado a lado" (todas da categoria na mesma escala pela coronha, régua de 10 cm: 1035-1039), régua e etiqueta de comprimento, ficha (calibre, capacidade, comprimento, cano, peso vazio, alimentação `FAM` 1022, confiabilidade), botões Atirar/Rajada/Recarregar/Destravar, teclas (espaço, R, B, D) 1124, câmera que se enquadra no objeto (`show` 677-692), chão e grade que escalam com o objeto.

### 1.2 ARS: documento de design (texto da página, seções 00 a 18)

| Seção | Conteúdo (números de jogo) |
|---|---|
| 00 Princípios | custo da arma, munição específica, cabeça resolve, penetração tática, desgaste, hitscan com queda por tabela e servidor valida |
| 01 Fórmula de dano | `dano_base × tipo_munição × região × queda_distância × perda_penetração × (1−armadura) × condição(0,85..1,0)`; queda 100% até o alcance efetivo, 50% no dobro, some em 3×; stagger acima de 35, derruba acima de 70 no tronco; zumbi comum 100 de vida, corredor 80, pesados 160 a 250 |
| 02 Dano por região | cabeça (morte por limiar de crânio, senão ×3), pescoço ×2 (30% decapita), tronco ×1, braços ×0,6 (arranca acima de 60), pernas ×0,7 (quebra acima de 50); desmembramento progressivo em 3 etapas (cabeça 40, braço 45, perna 55, tronco vida total); malhas pré-cortadas; no máximo 40 pedaços por jogador |
| 03 Penetração | PEN em pontos; cada alvo tira 25% do dano; membro 0,5, tronco 1,0, cabeça 0,7, porta/drywall 1,0, lataria 2,0, bloco de concreto 6,0 |
| 04 Calibres | 22 calibres × dano, PEN, alcance efetivo, crânio, ruído, raridade, "usado em" (tabela completa abaixo, 3) + peso por cartucho (pistola 0,012; fuzil 0,018; .308 0,025; 12 ga 0,04; .50 BMG 0,12 kg) |
| 05 Tipos de munição | FMJ, HP (×1,35 dano, ×0,4 PEN), SP (×1,25/×0,6), AP (×0,9/×1,8, ignora 50% do colete), traçante, subsônica, +P, chumbo 00 (9 × 12), chumbinho (30 × 3), balote (1 × 95), recarregada (×0,9, 8% de falha) |
| 06 Catálogo | 67 armas: calibre, capacidade, cadência, **tempo de recarga** (tático e vazio), peso (do jogo, com carregador), raridade, nota |
| 07 Ficha técnica real | 67 armas: mecanismo, comprimento (e com coronha recolhida), cano, peso vazio, velocidade de boca, precisão real em MOA (ou abertura em cm para escopeta) |
| 08 Precisão e manuseio | `dispersão = MOA × postura × movimento × mira × (1+calor) × (2−condição) × ferimento`; tabela de posturas (×0,4 a ×3,0); recuo fixo por arma (energia/peso); tempo de mira = 0,15 s + 0,05 s/kg; balística hitscan até o alcance, projétil simulado acima de 300 m |
| 09 Guia de modelagem | escala 1:1, peças móveis, sockets, orçamento de polígonos (pistola 6 mil tri, fuzil 12 mil, 3 LODs), texturas com máscara de desgaste, fidelidade; aviso de marcas registradas |
| 10 Recarga e manuseio | 7 famílias (carregador, tubular, cilindro, pente stripper, ferrolho, basculante, cinta) com regras; durabilidade 0-100, engasgo abaixo de 60, destravar 1,2 s |
| 11 Modificações | supressor (−60% ruído), caseiro, freio, miras (red dot, ACOG, lunetas, visão noturna), empunhadura, bipé, M203, lanterna, laser, carregador estendido/tambor/acoplador, coronha, cano serrado/longo, bancada e perícia "Armeiro" |
| 12 Ruído e hordas | raio de atração por fonte (22 sem supressor 60 m, 9×19 150 m, fuzil 300 m, escopeta 350 m, .308 420 m, .50 600 m), rajadas somam +5% por tiro (até +50%) |
| 13 Explosivos | 12 explosivos: dano no centro, raio letal, raio de ferimento, nível de destruição, ruído, raridade; regras de cozinhar granada (pavio 4 s), foguete físico (arma a 10 m), sopro de retrocarga 5 m, reação em cadeia |
| 14 Cenário destrutível | níveis 1 a 3, 6 materiais (vida por placa, PEN), grafo de suporte de prédio, fogo, pré-fratura, estado destruído persistido |
| 15 Veículos | peças com vida (motor 300, tanque 150, pneus 60, vidros 40, portas/lataria 200, bateria/faróis 50), atropelamento `velocidade × massa`, tabela de veículos, modificações, barulho |
| 16 Achados | loot por local (10 tipos), 5 raridades com pesos (60/28/9/2,5/0,5), decaimento por dia, regra de LAN |
| 17 Formato de dados | exemplo JSON de arma (`ak47`) e de munição (`762x39_fmj`) |
| 18 Equipe | divisão em frentes e ordem de implementação |

### 1.3 ITE: Itens do Vale Cinzento

Catálogo em dados (`DATA`, linha 6, JSON de 85 KB) mais código de tela e vitrine.

- **Dados**: `versao` 0.1; **257 itens** em 14 categorias (comida 36, bebida 12, medicina 26, ferramentas 30, armas brancas 20, materiais 23, roupas 23, mochilas 15, eletrônicos 20, combustível 9, campo 11, livros 5, história 16, chaves 11); 24 tipos de lugar (`locais`); 10 regiões (`regioes`); raridades `c/i/r/mr/l/u` com `peso_tabela` 60/28/9/2,5/0,5/-; **33 receitas** (barricada, atadura, sutura, tala, água fervida, ensopado, molotov, bomba de barulho, cerca elétrica, lamparina, armadilha de laço, flechas...); **16 contêineres** (geladeira, armário de cozinha...); 10 `especialidades_regiao`; 6 regras de `saque_progressivo` (queda por dia por tipo de lugar com mínimo, ex.: farmácia −5%/dia mínimo 30%, base militar 0).
- Campos por item (união): `id, n, cat, kg, dur, rar, onde[], reg[], uso, f (sacia), s (hidrata/sede), v (validade em dias), p (porções), ck (cozinhar), dano, cr (cabeça%), alc, ru (ruído), slot, bm (bloqueio de mordida%), ar (arranhão%), cal (calor), cap, red (redução de peso%), rap (acessos rápidos)`.
- Regras no texto: validade com 4 estados (fresco 0-50%, passado 50-100%, estragado 100-150%, podre acima), `idade_efetiva += (agora − ultima_troca) × mult_do_lugar` calculada só quando consulta (sem tique), multiplicador por lugar (geladeira com energia ×0,33...).
- Código: `det` 24-42 (resumo por categoria), filtros 44-80, `renderRows` 53-70, `showItem` 81, mapa de calor lugar × categoria 91-107 (peso por raridade `W`), contêineres/regiões/saque/receitas 104-107.
- **Vitrine 3D** (109-244): renderizador único em um canvas com scissor (um viewport por item), 24 modelos em `MODELS` 144-168: `feijao_lata`, `agua_500`, `arroz`, `racao_militar`, `cachaca`, `kit_ps`, `atadura`, `amoxicilina`, `pe_cabra`, `martelo`, `facao`, `machado`, `taco_pregos`, `mochila_trilha`, `lanterna`, `radio_portatil`, `chave_casa`, `diario`, `capacete_moto`, `botijao`, `galao`, `walkie`, `pilha_aa`, `tabua`. Helpers `M` (material com tag e cor base) 123, `metal/wood/cloth/plastic/paper/food/glass` 136-142, `mesh`, `cyl`, `bx`, `lathe`, `torus`, `extrude`, `G`. **Estados de envelhecimento** `setStage` 173-182 (Novo/Gasto/Estragado): lerp da cor para `STAGE_TARGET` 171 por tag de material (comida verde, metal enferrujado, madeira e tecido escurecem), rugosidade sobe, metalness do metal cai. Tamanho **não** é real (cada modelo é normalizado a 1,55 unidades, linha 199).

### 1.4 JML / JJA: o que o jogo já integra desta área

- `CALIBRES` 66331 (4 calibres: 9×19, 12 ga, 7,62×39, .308; campos `dano, pen, alc, ruido, cranio, classe, peso, bagos`), `ARMAS` 66340 (4 armas: Glock 17, Remington 870, AK-47, Remington 700; campos `cap, cad, rec, recVazio, porCartucho, disp, recuo, semi, zoom, cor, len`). Os números batem com o ARS.
- Armas na mão: `gunMeshes` 72812-72820, **uma caixa por arma** (+ coronha se `len>0,5`, pente-torus no AK, luneta no 700). O comentário 72810 diz "detalhe vem do Arsenal na J6".
- `weaponsUpdate` 72965-72991 (troca por teclas 1-4, recarga com `inv.reload`, escopeta/ferrolho um cartucho por vez e cancelável atirando, recarga vazia mais longa no AK), `fire` 72993-73024 (mira pela câmera, dispersão com pânico/febre/movimento/mirando, bagos, recuo, ruído por calibre, som), `shootRay` 73025-73051 (queda por distância, PEN por região, −25% por corpo, refaz a lista quando um zumbi morre, poeira/faísca/sangue na parede), `rayZombies` 73053-73085 (cápsulas por região, rastejador deitado), `zDamage` 71337 (dano por região, colete por classe de calibre, capacete, segmentos `SEG` 66328: cabeça 40, braço 60, perna 80).
- Explosivos: `EXP` 72389 (granada, botijão, barril, carro, molotov com `letal`, `fer`, `esc`, fogo, fumaça, poeira, estilhaço, detrito, cogumelo, fogo residual), `rayExplo` 72486, `exploDamage` 72499, `explode` 72521-72601 (clarão, bola de fogo, onda de choque, estilhaços, cratera, dano em corpos por faixa, jogador, portas, muros, cadeia), `throwItem` 72625 (T arremessa granada M67 com pavio 3,5 s ou molotov com isqueiro), `explosionsUpdate` 72640.
- Itens: `ITENS` 66368 (**146 itens**, versão anterior do catálogo, sem `dur`, `v`, `p`, `reg`, `ck`, `red`, `rap`), `EXTRA` 73090-73102 (caixas de munição, 3 armas como item, chave, granada, molotov, sinalizador), `RAR_W` 73104, `CONT_TAB` 73106 (contêiner → faixa de quantidade e pesos de categoria), `FIXOS` 73119, `rollItems` 73121-73136, mochila de 10 espaços e carga `8 + 2,5·FOR` 73139-73144, `take` 73146 (munição soma, arma habilita tecla, peso e espaço), `useItem` 73156-73177 (comer, curativo, analgésico, molotov montado, lanterna, mochila), `LOOT` 74023 (itens de facção: fardas, coletes, armas, chaves).
- O JML embute `game-weapons` e `game-interactables(-household)` do SDK (JML 23771, 33133-35682, 42846 etc.) e o `createArsenal` é usado só pela sala de testes (JML 31474). O jogo próprio **não** usa `game-weapons` para atirar: tem tabelas paralelas.

---

## 2. O que o SDK já tem do mesmo assunto

**`game-weapons`** (motor genérico, sem jogo; unidades SI, semente em tudo):
- `calibers.json`: 18 calibres com ø, massa, velocidade de boca, `pellets`, arrasto por 100 m, `kind`; energia = ½mv². `weapons.json`: 42 itens (17 de fogo/arco, 8 corpo a corpo, 5 fogo/calor, 2 explosivos, 8 ferramentas + `kick`, `shove`, `hand`), **arquétipos sem marca** (`pistol_9mm`...). `types.ts` (168 linhas), `weapon.ts` 357 (`WeaponRuntime`), `arsenal.ts` 60, `locale.ts` (en e pt-BR), `rng.ts`.
- Comportamento: cadência por rpm com várias saídas por `dt`, modos `single/semi/burst/auto/pump/bolt/lever/break`, `trigger(held)` com trava até soltar, bloom (teto 4×) com recuperação, cone uniforme por ângulo sólido, pellets, recuo `[pitch, yaw]`, ruído em metros, recarga por carregador ou por cartucho interrompível pelo gatilho (`perRound`), recarga nunca automática, `energyAt(d)` com arrasto, lança-chamas e maçarico gastando combustível (`fireFuel` 322), extintor, arremessáveis com arco e fogo (`fireThrowable` 348), corpo a corpo, ferramentas. Tudo determinístico por semente.
- Testes: `tests/weapons.test.ts` (≈40 casos: energia por calibre, cadência, rajada, recarga, tubo, pellets, bloom, determinismo, queda de energia, chamas, arremessáveis, locale).

**`game-contracts/src/weapons.ts`**: `Shot` (um por pelota, com `energyAt`), `Use` (melee, flame, heat, throw, tool, extinguish, hand), `shotToHit` → `Hit` (`destruction.ts:149`: `type`, `energy` J, `caliber` mm, `radius`, `temperature`, `duration`).

**`game-destruction`**: `Hit` balístico/explosivo/fogo/contundente/corte; **penetração real em joules** (`world.ts` ~740-784: `limite = material.penetration × espessura(m) × 1000`, atravessa se E > limite, energia de saída E − limite, ricochete por ângulo, furo com diâmetro do calibre, até 4 objetos em sequência por `shoot`, linha 1283-1302); `materials.json` com 28 materiais (steel 110, concrete 18, brick 14, wood_soft 9, glass 6, plaster 3, fabric 0,8...); fratura, juntas, grafo estrutural, explosão (`explodes`), vazamento.

**`game-weapons-three`** (feito hoje): `props.ts` (modelos **de caixa provisórios** por categoria, `SHAPES` 39, massa real distribuída `withMass` 65, `buildProp` 78, `BODY_ACTIONS` 62), `fx.ts` (arma na mão com `HAND_OFFSET`, coice/abaixar na recarga, estojo cilíndrico por tiro `ejectCasing` 103, carregador de caixa que cai `dropMagazine` 117, corpos com gravidade e quique, teto de 120 estojos e 12 carregadores, vida 25 s), `audio.ts` (**sons sintetizados com WebAudio**: `shot(energia)` escalado em log, `click`, `reloadStart/End`, `cycle`, `clink`, `thud`; sem arquivo de som, sem AudioContext vira no-op), `area.ts` (`createWeaponsTestModule`: balcões com todas as armas, 3 alvos de aço/compensado/concreto a 7 m, `weaponsLayout`, `TestableModule.attach`), `tests/weapons-area.test.ts` (4 casos: layout, estojo por tiro, carregador na recarga com log, revólver segura estojos até abrir). `examples/weapons-test-area` empacota tudo em `sala-armas.html`.

**`game-props3d`**: catálogo de móveis/jardim (`TYPE_DEFS`), sem itens de saque nem armas.

**Itens e saque no SDK** (não existe `game-items`): `game-interactables` tem `ItemDef` (`types.ts:120`: `id, category, size[w,h,d], weight, stack, pickable, name, shape, color`), `ItemCatalog`, `LootTable`, `generateLoot` determinístico por semente com ajuste ao tamanho do slot (`loot.ts`), eventos `pickup`; `game-interactables-household` traz 92 itens domésticos (`items.json`: comida 25, bebida 5, cozinha 8, higiene 7, limpeza 3, remédio 5, roupa 11, ferramenta 5, escritório 5, lixo 5, correio 4, churrasco 4, garagem 5) e 14 tabelas de saque por contêiner. `game-fluids` tem 19 líquidos (inclui `blood`, `fuel`, `diesel`, `bleach`) e usos de item `sip/drink/chug/pour/open/close`; `game-fluids-three` tem manchas com `dryTime`.

**O que o SDK não tem**: modelos reais de arma, munição física (cartucho, estojo de garrafa), famílias de recarga animadas, pane/engasgo, durabilidade/condição, calor do cano no jogo de armas de fogo, tipos de munição (HP, AP, subsônica...), acessórios e supressor, lançadores, explosivos como armas com raio letal/ferimento, dano por região do corpo, desmembramento, sangramento, itens do ZombiAdA (validade, durabilidade, receitas), nenhum modelo 3D de item.

---

## 3. Comparação item a item

Legenda de ação: **portar** (vem da entrega), **manter SDK**, **mesclar**.

### 3.1 Tabela principal

| Assunto | ZombiAdA (onde) | SDK (onde) | Melhor | Por quê | Ação |
|---|---|---|---|---|---|
| Modelo 3D de arma | 8 construtores com peças reais: `pistol` GAL 81, `revolver` 147, `rifle` 166, `bullpup` 255, `p90` 268, `shotgunBreak` 279, `m2` 295, `launcher` 401 | caixas por categoria: `props.ts` `SHAPES` 39-59 | **ZombiAdA** | Peças nomeadas e móveis (corrediça, ferrolho, tambor, pump, carregador), medida real por `fitLength` 46 (comprimento e cano da ficha), 11 estilos de pistola, miras, trilhos. O SDK é placeholder explícito e a regra do kit proíbe "caixas quando o time entregou" | **portar** (substitui `SHAPES`) |
| Ficha de dimensões (comprimento, cano, peso vazio) | `WEAP` GAL 313-391 e ARS §07 (batem entre si) | só `mass` (`weapons.json`), sem comprimento nem cano | **ZombiAdA** | A medida real é o requisito R2; o SDK não guarda dimensões, então a escala não é verificável | **portar** (`dimensions` no dado) |
| Lista de armas | 77 em GAL; 67 em ARS (6 lançadores só em GAL; HK PSG-1, Steyr SSG 69, Barrett MRAD e CheyTac M200 só em GAL; ARS tem M79 só como explosivo) | 17 armas de fogo genéricas em `weapons.json` | **ZombiAdA** (em quantidade e fidelidade); SDK (em neutralidade de marca e testes) | SDK é arquétipo, ZombiAdA é modelo real; cada arma real mapeia para um arquétipo por calibre e categoria | **mesclar** (arquétipos ficam, modelos reais entram como conteúdo que referencia o arquétipo) |
| Calibres e munição | 22 calibres `AMMO` GAL 515-524 (medidas CIP/SAAMI) e ARS §04 | 18 calibres `calibers.json` (energia calculada) | **mesclar** | ZombiAdA tem 22 com ø de estojo, comprimento total e do estojo (para o cartucho 3D) e dano/PEN/ruído/raridade; o SDK tem massa e velocidade de boca (energia física), 4 calibres a mais (20 ga, flecha, virote, birdshot) | **mesclar** |
| Dano do projétil | pontos de jogo (`dano`, `pen`) ARS §04 e JML `CALIBRES` | joules (`Shot.energy`, ½mv²) | **SDK** como física; ZombiAdA como balanceamento | Pontos e joules não são proporcionais (9×19 500 J = 35 pts, 5,56 1750 J = 45, .45 480 J = 48): os pontos são design, não derivam da física | **manter SDK**; pontos ficam em conteúdo ZombiAdA (perfil de dano) |
| Penetração | PEN em pontos, custo por alvo (membro 0,5, tronco 1, cabeça 0,7, porta 1, lataria 2, concreto 6), −25% de dano por alvo: ARS §03, JML `shootRay` 73025 | `game-destruction` `world.ts` ~740-784 e 1283-1302: joules por mm do material, energia de saída, ricochete, furo | **SDK** | Calculada por material e espessura reais, com testes; a tabela PEN do ARS vira só calibração (corpo de zumbi não é material do SDK) | **manter SDK**; PEN do corpo entra em `game-characters` |
| Materiais de parede e destruição | `WMAT` GAL 609, `wall()` 616-638 (4 materiais × 4 estados fixos), ARS §14 | `materials.json` (28), fratura, juntas, estrutura, `game-destruction-three` | **SDK** | Estados reais por dano, não por botão; GAL só mostra 4 níveis pré-fraturados | **manter SDK**; usar GAL só como referência de aparência dos níveis |
| Carro destrutível | `car(st)` GAL 581 (5 estados em caixas) | `game-vehicles` e `-fleet` | **SDK** | GAL diz que o modelo é do time de Veículos (linha 1095) | **manter SDK** |
| Tiro e cadência | GAL `fire` 757, `burst` 805 (rajada pela rpm) | `WeaponRuntime.fireFirearm` 248, `fireOne` 276 | **SDK** | Cadência por intervalos exatos com vários tiros por frame, modos, determinismo, `held`; GAL é tween de demonstração | **manter SDK** |
| Animação de tiro por família (corrediça, ferrolho, pump, alavanca, tambor, cão, gatilho) | `fire` 757-784, `cycleBolt` 743, `pull` 741, `recoil` 742 | só coice de câmera e a "mão" (`fx.ts` `kick`) | **ZombiAdA** | O SDK não move peça nenhuma | **portar** (`-three`) |
| Ejeção de estojo | GAL `ejectCase` 735 (por família: para baixo em P90 e cinta; atraso pós-ciclo em pump/ferrolho/alavanca), `casingMesh` 725 (estojo de garrafa por tipo) | `fx.ts` `ejectCasing` 103 (cilindro de 8 lados, por tiro, `EJECTS_ON_SHOT` 32) | **mesclar** | GAL tem forma e tempo certos; SDK tem teto de corpos, limpeza, quique com som, e ligação ao evento do host | **mesclar** (forma e tempo do GAL no loop do SDK) |
| Estojo na mão quando a arma é revólver/basculante | GAL `revolverReload` 816, `breakReload` 822 (ejeta todos ao abrir) | `fx.ts` `onReloadStart` 147 (idem) | empate | Comportamento igual | **manter SDK**, trocar a malha |
| Cartucho (munição) 3D | `cartridge` GAL 525-539 (projétil, estojo, gargalo) por calibre; `cartridgeMesh` 732 | não existe (só cilindro de estojo) | **ZombiAdA** | Necessário para recarga visual e vitrine de calibres | **portar** |
| Carregador | `magSwap` 806 (sobe, cai com rotação, outro entra), carregadores por modelo (`curved`, `box`, `drum`, `belt`, `internal`) em `rifle` 213-218 | `dropMagazine` 117 (caixa genérica 0,17 × 0,03 × 0,07 que cai) | **ZombiAdA** | Forma e movimento por arma, par entra/sai | **portar** (o corpo que cai e o teto de 12 ficam do SDK) |
| Recarga por tipo | 7 famílias: `magSwap`, `revolverReload`, `breakReload`, `beltReload`, `tubeLoad`, `topLoad`, ferrolho/semiint (GAL 833-853) | tempo único `reload`; só `perRound` (tubo) em `weapon.ts` 133-157 | **ZombiAdA** na animação; **SDK** na regra | SDK não anima nem separa recarga tática/vazia; ARS §06 tem os dois tempos | **mesclar** (regra no motor, animação no `-three`) |
| Tempo de recarga | ARS §06: tático e vazio (ex.: AK 2,6 s / 3,4 s), 1 a 1 do ferrolho 0,7 s por cartucho, cinta 7,5 a 10 s; GAL animações ≈1,0 a 1,6 s só visuais | `reload` único: pistola 2,0, AK 2,8, 308 3,5 s inteiro | **ZombiAdA** | O SDK não tem `reloadEmpty`, e o ferrolho do SDK recarrega o carregador inteiro em 3,5 s enquanto o ARS (e o jogo JML 66343) carrega um cartucho por vez em 0,7 s | **mesclar**: acrescentar `reloadEmpty` e `perRound` para bolt |
| Capacidade | `WEAP` com `'6+1'`, `'17/33'`, `'8/20'`, `'7+7+1'` (GAL 511 `capOf`) | `magazine` único (ex.: 15, 6, 8) | **ZombiAdA** | Câmara (+1), carregador estendido e dois tubos do KSG não cabem num número | **mesclar** (campos `chamber`, `magazines[]`) |
| Pane/engasgo | `QUAL` 750, `JN` 751, `jamRoll` 753, `setJam`, `stuckCase`, `clearJam` 785 (animação por família), `rel` por arma, `applyQuality` 803 | não existe | **ZombiAdA** | Funcionalidade ausente; ARS §10 liga durabilidade 0-100, engasgo abaixo de 60, destravar 1,2 s | **portar** (regra no motor com semente, animação em `-three`) |
| Calor do cano | `W.heat`, `heatPer`, `stepWeapon` 797-802 (cano em brasa, fumaça) | só `heat`/`flame` como ferramenta (`fireFuel`); firearms sem calor | **ZombiAdA** | ARS §08 usa `(1+calor)` na dispersão; GAL só mostra visual | **portar** |
| Clarão e fumaça de boca | `muzzleFlash` 716-724, `wisp` 796 | não existe (só som) | **ZombiAdA** | | **portar** |
| Som | nenhum | `audio.ts` WebAudio por energia | **SDK** | GAL não tem áudio | **manter SDK** |
| Arma na mão e coice de mão | não existe | `fx.ts` `equip` 74, `HAND_OFFSET` 40, kick/dip | **SDK** | | **manter SDK** |
| Armas pesadas (lança-foguetes, lança-chamas) | `launcher` 401, `fireHeavy` 464, `heavyReload` 489, `flameBit`, `groundFire` | `flamethrower` e `cutting_torch` em `weapons.json` (combustível, `Use` flame); sem lançador de foguete | **mesclar** | SDK tem a regra do jato (combustível, temperatura, alcance); GAL tem modelo, jato de partículas, retrocarga, foguete físico, tubo descartável | **mesclar** |
| Explosivos (regra) | ARS §13 e JML `EXP` 72389 / `explode` 72521 | `frag_grenade`, `pipe_bomb`, `molotov` em `weapons.json`; `Hit` explosivo e `explodes` em `game-destruction` | **SDK** (regra); ZombiAdA (raio letal/ferimento, reação em cadeia, efeito) | SDK usa energia e raio; ZombiAdA usa dano no centro e dois raios | **mesclar**; efeitos visuais pertencem a `game-vfx` (Fase 6) |
| Explosivos (modelo 3D) | `buildExp` GAL 556-571 (12 modelos, medidas reais) | `props.ts` caixa para `throwable` | **ZombiAdA** | | **portar** |
| Dano por região do corpo | `MULT` GAL 857, `HPS` 858, `damage` 979; ARS §02; JML `zDamage` 71337 | não existe | **ZombiAdA** (3 versões divergentes) | Ver 3.4 | **portar** para `game-characters` (Fase 4) |
| Desmembramento | `sever` 967, `explodeSeg` 970, `gouge` 953, `legLost` 977, `splitTorso` 978, `buildZombie` 866 | não existe | **ZombiAdA** | | **portar** para `game-characters` |
| Sangue e poças | `bloodPool` 903, `splat` 911, `paintFan` 896, `stepPools` 921, `addBleeder` 888 | `game-fluids` (`blood`) e `game-fluids-three` `stains.ts` (manchas com `dryTime`) | **mesclar** | GAL tem respingo alongado pelo ângulo, satélites, fusão de poças e cor fresca→seca; SDK tem o modelo de líquido e a secagem; só conferir sobreposição | **mesclar** (na Fase 6, `game-vfx`) |
| Precisão e dispersão | ARS §08 (MOA real × postura × movimento × mira × calor × condição) e JML `fire` 72993 | `spreadDeg`, `bloomDeg`, `recoveryDegPerS`, cone uniforme | **mesclar** | SDK modela o bloom por tiro; ARS modela por MOA real e modificadores de personagem (postura, movimento) que não pertencem ao motor de arma | **mesclar**: `moa` no dado, modificadores no jogo |
| Recuo | ARS §08: padrão fixo + aleatório, `energia/peso` | `recoil: [pitch, yaw]` por arma | **mesclar** | SDK não tem padrão repetível por tiro | **mesclar** |
| Ruído | ARS §12 (22 s/ supressor 12 m a .50 BMG 600 m); JML `ruido` por calibre (9×19 60 m, 12 ga 90 m, 7,62×39 110 m, .308 130 m) | `noise` por arma (pistola 150, 5,56 300, escopeta 400, .308 350, .50 600) | **SDK** como dado por arma | Os números do SDK coincidem com ARS na maioria (9×19 150, 5,56 300, .50 600); JML usa escala diferente (60/90/110/130): **três escalas** | **manter SDK**, perguntar (D5) |
| Tipos de munição | ARS §05 (11 tipos com multiplicadores) | `kind` por calibre (`fmj`, `hp`, `ap`, `buck`, `slug`, `birdshot`); três variantes de 12 ga já como calibres separados | **mesclar** | SDK modela tipo como calibre separado (12ga_00buck/slug/birdshot); ARS usa multiplicador sobre o calibre base | **mesclar** (tipo como variante do calibre) |
| Acessórios e supressor | ARS §11 | não existe | **ZombiAdA** (só texto) | Sem código para portar | **portar** como dado + regra (fase posterior) |
| Qualidade/durabilidade | `QUAL` GAL 750 (4 estados visuais), ARS §10 (0-100) | não existe | **ZombiAdA** | | **portar** (junto com a pane) |
| Câmera/enquadramento, régua, etiqueta | `show` 677, `ruler` 648, `label` 641 | `weaponsLayout` (balcões) e `TestableItem`; nenhuma régua | **ZombiAdA** (régua e modo lado a lado) | Útil como ferramenta genérica de teste de escala | **portar** para o `weapons-test-area` |
| Sala de testes | aba única com 6 abas | `createWeaponsTestModule` (`TestableModule`) + `tests/weapons-area.test.ts` | **SDK** (arquitetura e testes) | Segue o contrato; GAL tem estado global | **manter SDK**, acrescentar comandos de pane e destravar |
| Testes | nenhum | 40 casos em `game-weapons`, 4 em `-three` | **SDK** | | **manter SDK**; goldens novos para modelos |
| Genericidade/estado | GAL usa globais (`W`, `Z`, `tasks`, `fx`), `Math.random`, DOM, three r128 (`outputEncoding`, `convertSRGBToLinear`, addon `RoundedBoxGeometry`) | instâncias por arma, semente, sem DOM, three ^0.160 | **SDK** | O porte precisa trocar `Math.random` por semente (golden depende disso), globais por instância, tween por escalonador injetável, `sRGB` do r160 (não converter a cor duas vezes) e importar `RoundedBoxGeometry` do addon (ou fazer a geometria própria) | **portar com refatoração** |
| Itens: catálogo | `DATA` ITE 6: 257 itens, 14 categorias, `dur`, `v`, `p`, `reg`, `onde`, `rar`, `uso`, campos de combate/roupa/mochila | `ItemDef` `game-interactables/types.ts:120` (tamanho, peso, pilha, forma, cor) + 92 itens domésticos | **ZombiAdA** em conteúdo | Os dois modelos descrevem coisas diferentes: o SDK diz como o item cabe num slot e se desenha; o ZombiAdA diz o que ele faz e onde aparece | **mesclar** (novo `game-items` por cima de `ItemDef`) |
| Itens: validade e estados | `idade_efetiva` ITE texto, 4 estados, multiplicador por lugar | não existe | **ZombiAdA** | Regra de "calcular só quando consulta" é boa para LAN | **portar** |
| Itens: saque | `rollItems` JML 73121, `CONT_TAB` 73106, `FIXOS` 73119; `saque_progressivo` e `conteineres` em ITE | `generateLoot` (`loot.ts`) determinístico por semente e ajustado ao slot; 14 tabelas domésticas | **SDK** na mecânica; ZombiAdA em conteúdo | O SDK é determinístico e testável; JML usa `R()` global. Falta ao SDK: raridade, lugar, região, decaimento por dia | **mesclar** (estender `LootTable` com raridade/lugar/região/decaimento) |
| Itens: receitas | 33 em ITE | não existe | **ZombiAdA** | | **portar** |
| Itens: inventário (mochila, carga, espaços, uso) | JML `bag` 73140, `take` 73146, `useItem` 73156 | `take(objectId, containerId, slot)` e evento `pickup` em `game-interactables` (só retirada de contêiner) | **ZombiAdA** (mochila), SDK (retirada) | Mochila com peso máximo `8 + 2,5·FOR` e espaços é do jogo | **portar** como regra opcional de `game-items` |
| Itens: 3D | 24 modelos ITE 144-168 (`lathe`, `extrude`, `torus`) + `setStage` | só `shape` de uma palavra (`can`, `bag`...) para o host desenhar | **ZombiAdA** | Modelos reais do item; o SDK só tem dica | **portar** (`game-items-three`) |
| Itens: escala | ITE normaliza cada modelo a 1,55 (linha 199) | `ItemDef.size` em metros | **SDK** | Os 24 modelos têm unidades próprias e precisam de escala real | **mesclar**: tamanho vem do SDK/catálogo |
| Itens: cobertura do modelo 3D | 24 de 257 itens têm modelo | — | — | Só ~9% do catálogo tem forma 3D | dúvida D8 |

### 3.2 Armas e calibres: o que só existe de um lado e o que diverge

**Calibres (22 em AMMO/ARS §04 contra 18 em `calibers.json`).**

| Calibre | AMMO | SDK id | ø projétil AMMO / SDK | Situação |
|---|---|---|---|---|
| .22 LR | 5,7 | `22lr` | 5,7 / 5,7 | igual |
| .380 ACP | 9,0 | `380acp` | 9,0 / 9 | igual |
| 9×18 Makarov | 9,3 | — | — | **só ZombiAdA** |
| 9×19 | 9,0 | `9x19` | 9,0 / 9 | igual |
| .40 S&W | 10,2 | `40sw` | 10,2 / 10,2 | igual |
| .45 ACP | 11,5 | `45acp` | 11,5 / 11,5 | igual |
| 5,7×28 | 5,7 | — | — | **só ZombiAdA** |
| .38 SPL | 9,1 | `38spl` | 9,1 / 9,1 | igual |
| .357 Magnum | 9,1 | `357mag` | 9,1 / 9,1 | igual |
| .44 Magnum | 10,9 | — | — | **só ZombiAdA** |
| .50 AE | 12,7 | — | — | **só ZombiAdA** |
| 12 ga | 18,5 | `12ga_00buck`, `12ga_slug`, `12ga_birdshot` | 18,5 (slug) | SDK modela três cargas; ZombiAdA uma só (`12 ga`, 00) |
| 5,56×45 | 5,7 | `5_56x45` | 5,7 / 5,7 | igual |
| 5,45×39 | 5,6 | — | — | **só ZombiAdA** |
| 7,62×39 | 7,9 | `7_62x39` | 7,9 / 7,9 | igual |
| .30-30 Win | 7,8 | — | — | **só ZombiAdA** |
| 7,62×51 | 7,8 | `7_62x51` | 7,8 / 7,8 | igual |
| 7,62×54R | 7,9 | — | — | **só ZombiAdA** |
| .30-06 | 7,8 | — | — | **só ZombiAdA** |
| .300 Win Mag | 7,8 | — | — | **só ZombiAdA** |
| .338 Lapua | 8,6 | `338lapua` | 8,6 / 8,6 | igual |
| .50 BMG | 13,0 | `50bmg` | **13,0 / 12,7** | diverge: SDK usa 12,7 (nominal), AMMO 13,0 (projétil real ≈ 12,98) |
| (ausente) | — | `20ga_buck`, `arrow`, `crossbow_bolt` | — | **só SDK** |
| .408 CheyTac | — | — | — | usado por `WEAP` (CheyTac M200), **não está em AMMO nem em ARS §04**: lacuna do próprio time |
| PG-7V, 66 mm, 84 mm HEAT/HE, napalm | — | — | — | calibres de lançador só em `WEAP`; não são cartuchos |
| `.308`, `.38 SPL / .357` | — | — | — | texto livre em `WEAP` (Remington 700 e Rossi Puma) que não aparece em AMMO |

Energia: nenhuma coluna de ARS está em joules; as proporções mostram que dano em pontos não deriva de energia (ver 3.1).

**Armas.** `WEAP` tem 77; os arquétipos `weapons.json` ficam assim em relação à arma real mais próxima (capacidade, peso e comprimento divergem porque o SDK descreve um arquétipo, não um modelo):

| Arquétipo SDK | Capacidade / peso / rpm / recarga SDK | Arma(s) real(is) do `WEAP` | Diferença |
|---|---|---|---|
| `pistol_9mm` | 15 / 0,9 kg / 300 / 2,0 s | Glock 17: 17 / 0,63 / — ; Beretta 92FS: 15 / 0,95 | capacidade e peso variam de 11 a 20 e 0,60 a 1,0 kg entre as 12 pistolas 9×19 |
| `pistol_45` | 8 / 1,1 / 280 / 2,2 | Colt M1911 7 / 1,10 | capacidade 8 vs 7 |
| `pistol_22` | 10 / 0,7 | nenhuma pistola .22 no `WEAP` | **só SDK** |
| `revolver_357` | 6 / 1,2 / 150 / 4,0 | S&W 686: 7 / 1,14 | capacidade 6 vs 7 (686 tem 7 tiros) |
| `revolver_38` | 6 / 0,9 / 160 / 3,8 | Taurus 82: 6 / 0,95 | próximo |
| (nenhum) | — | S&W Model 29 .44 Mag 6 / 1,40 | **só ZombiAdA** (calibre ausente) |
| `smg_9mm` | 30 / 2,6 / 800 | MP5A3: 30 / 2,54 / 800 | próximo |
| `carbine_22` | 10 / 2,4 / 300 | Ruger 10/22: 10/25 / 2,3; CBC 7022: 10 / 2,0 | próximo |
| `rifle_5_56` | 30 / 3,4 / 750 / 2,5 | M4A1 30 / 2,9 / 800; IA2 / M16A2 3,4; T4 3,0; HK416 3,5 | rpm 700 a 850, peso 2,9 a 3,6 |
| `rifle_7_62x39` | 30 / 3,8 / 600 / 2,8 | AK-47 30 / 4,3; AKM 3,1 | SDK fica no meio |
| `rifle_bolt_308` | 5 / 4,0 / 40 / 3,5 | Remington 700: 4 / 3,6 / `.308`; M24: 5 / 5,4 | capacidade 5 vs 4; recarga: ARS 0,7 s por cartucho |
| `sniper_338` | 5 / 6,5 / 35 | AWM: 5 / 6,9; TRG-42: 5 / 5,1; MRAD: 10 / 6,9 | próximo |
| `anti_materiel_50` | 10 / 12,5 / 30 / 4,5 | Barrett M82A1: 10 / 14 / 4,0 s | peso 12,5 vs 14; recarga 4,5 vs 4,0 |
| `shotgun_pump_12` | 6 / 3,2 / 60 / 0,6 s por cartucho | Remington 870: 6+1 / 3,6; Mossberg: 5+1 / 3,2 | SDK ignora o +1 da câmara |
| `shotgun_double_12` | 2 / 3,0 / 120 / 3,5 | Boito: 2 / 3,2 / 2,0 s | recarga 3,5 vs 2,0 |
| `shotgun_semi_12` | 5 / 3,4 / 180 | Benelli M4: 7+1 / 3,82 | capacidade 5 vs 8 |
| `bow_compound`, `crossbow` | — | — | **só SDK** |
| (nenhum) | — | Uzi, P90, Kriss Vector, Thompson, Scorpion EVO 3, MAC-10, UMP-45, SMT9, 8 fuzis de assalto restantes, 5 DMR, snipers (Steyr SSG 69, CheyTac M200, Mosin, ...), Winchester 1894, Rossi Puma, Minimi, PKM, M60, M2, 6 lançadores | **só ZombiAdA** |

**Divergências internas do ZombiAdA** (ARS contra GAL; nenhuma mudou do documento, são lacunas ou escolhas):
- Lista: GAL tem **4 armas que ARS não tem** (HK PSG-1, Steyr SSG 69, Barrett MRAD, CheyTac M200) e **6 lançadores** que ARS só cita em explosivos (RPG-7, M72, AT4) ou nem cita (Carl Gustaf M4, lança-chamas M2, lança-chamas caseiro). ARS diz "67 armas", o catálogo de GAL tem 71 de fogo.
- Comprimento, cano e peso vazio de GAL **batem** com ARS §07 em todas as 67 em comum (verificado por script). Exceções: M14 EBR (ARS "~890-1.120 mm", GAL 1000), e os pesos de §06 do ARS incluem carregador cheio (Remington 870 3,6 kg igual; MP5 2,9 kg em §06 e 2,54 kg em §07/GAL).
- Capacidades: ARS escreve `8 / 20 (tambor)` (Saiga-12, AA-12), `4 / 3` (Remington 700), `200 (cinta)`; GAL guarda `8`, `8/20`, `4`, `200`. A Remington 700 do ARS é ".308 / .300 WM"; a GAL só `.308`.
- Rpm: ARS e GAL coincidem em todas as automáticas (MP5 800, Glock 18 1200, MAC-10 1090, AA-12 300...).
- Recarga: ARS §06 tem tempo por arma (1,7 a 10 s); GAL anima famílias com tempos próprios (revólver 1,3 s, cinta 1,55 s contra 7,5 a 10 s do ARS): são tempos de **animação**, não de regra.
- Dano por região: ver 3.4.

### 3.3 ARS contra o jogo (JML)

| Dado | ARS | JML | Observação |
|---|---|---|---|
| 9×19 | dano 35, PEN 1,2, alc 35 m, ruído "médio" | 35, 1,2, 35, ruído 60 | JML põe ruído em metros por calibre |
| 12 ga | 9 × 12, PEN 0,5, alc 15 | 12, 9 bagos, 0,5, 15, ruído 90 | igual |
| 7,62×39 | 55, PEN 3,0, alc 250 | igual, ruído 110 | |
| .308 | 75, PEN 4,0, alc 600 | igual, ruído 130 | |
| Raio de ruído do ARS §12 | pistola 150, fuzil 300, escopeta 350, .308 420, .50 600 | 60, 110, 90, 130 | JML usa **outra escala** (menor e sem calibração por §12) |
| Capacidade do Remington 700 | 4 | 4 | igual |
| Cadência da Glock | semi | `cad: 0.12` | JML permite spam rápido |
| `SEG` do segmento | cabeça 40, braço 45, perna 55 (ARS §02) | cabeça 40, braço 60, perna 80 | diverge |
| Calibres/armas no jogo | 22 / 67 | 4 / 4 | JML é só a fatia |

### 3.4 Três versões de dano por região (para a Fase 4)

| Fonte | Multiplicadores | Vida das partes | Efeito |
|---|---|---|---|
| ARS §02 | cabeça: morte (ou ×3), pescoço ×2, tronco ×1, braços ×0,6, pernas ×0,7 | cabeça 40, braço 45, perna 55 | arranca braço acima de 60 de dano, perna acima de 50 |
| GAL 856-860 | cabeça 3, mandíbula 2, pescoço 2, tronco/quadril 1, braço/antebraço/mão 0,6, coxa/canela/pé 0,7 | cabeça 40, mandíbula 12, pescoço 25, tronco 150, quadril 90, braço 45, antebraço 30, mão 12, coxa 55, canela 40, pé 15 | 11 segmentos; sangramento por região `BLEED` (pescoço 46, cabeça 40, coxa 19, braço 15...) |
| JML `zDamage` 71337 | por categoria de zumbi `C.mult[]` (tronco, braço, perna); colete por classe `RO.colete`; capacete anula 1º tiro de pistola | `SEG` 66328: cabeça 40, braço 60, perna 80 | 7 regiões numeradas 0-5 |

---

## 4. Destino por módulo

### 4.1 Motor genérico (`game-weapons`, sem ZombiAdA)

Entra (genérico, vale para qualquer jogo):
- **Dimensões e identidade**: `dimensions { length, barrel, emptyMass }` e `model { builder, options }` no `WeaponDef`; os 71 modelos reais viram *entradas de dados* (`WEAP`) com cada arma apontando para um arquétipo existente (`pistol_9mm`...), sem renomear os arquétipos.
- **Calibres que faltam** (9×18, 5,7×28, .44 Mag, .50 AE, 5,45×39, .30-30, 7,62×54R, .30-06, .300 Win Mag, .408 CheyTac) com massa e velocidade de boca reais, mais as dimensões do estojo (`caseDiameter`, `overallLength`, `caseLength`) de GAL 515.
- **Regras de arma que faltam**: `reloadEmpty`, recarga um a um no ferrolho (`perRound` para `bolt`), capacidade com câmara e carregadores alternativos, família de recarga (`reloadFamily`), condição/durabilidade (0-100), pane com 4 tipos (`nega`, `chaminé`, `dupla`, `extração`) por `rng` com semente e `Use`/estado `jam`, `clearJam()`, calor do cano, tipos de munição como variante de calibre, `moa` real, rajada fixa por arma (`burst: 3` do M16A2).
- **Lançadores** (`launcher`: tubo descartável, foguete, retrocarga) como `WeaponAction`.
- **Perfil de dano genérico** `damageProfile` opcional (pontos de dano, PEN em pontos, alcance efetivo, ruído) *somente como dado extra*; os pontos não substituem os joules.

Não entra: dano por região do corpo, desmembramento, sangramento, raridade, tabelas de saque, tempos do jogo.

### 4.2 `game-weapons-three` (genérico, three)

- Substituir `SHAPES` (`props.ts` 39-59) pelos **construtores do GAL**: `pistol` + `PSTY`, `revolver`, `rifle` (e `scope`, `rail`, `vents`, `buttpad`, `swivel`, `heatify`), `bullpup`, `p90`, `shotgunBreak`, `m2`, `launcher` (+ `pg7`, `ffv`, `rocketBody`, `hose`, `pilot`) e `fitLength`. As opções por arma ficam em dado (JSON), o desenho em código. Manter a convenção `userData`/pontos de encaixe.
- Cartucho e estojo: `cartridge`, `casingMesh`, `cartridgeMesh`, `caseType`, `kickOf`.
- Animação por família (porte de `fire`, `cycleBolt`, `charge`, `recoil`, `pull`, `magSwap`, `revolverReload`, `breakReload`, `beltReload`, `tubeLoad`, `topLoad`, `heavyReload`, `fireHeavy`, `clearJam`) rodando sobre o loop de `fx.ts`, **sem** `tw`/globais do GAL: um escalonador injetado por instância.
- Efeitos de boca: `muzzleFlash`, `wisp`, brilho do cano (`heatify` + `stepWeapon`); `applyQuality` (ferrugem/desgaste por troca de material).
- Fica o que o SDK já tem: arma na mão, corpos que caem, teto de estojos/carregadores, `audio.ts`.
- Régua e etiqueta (`ruler`, `label`) e modo "lado a lado" viram utilitários do `weapons-test-area`.
- Modelo 3D de explosivos (`buildExp`) e de cartuchos podem ficar aqui (são armas/munição), com os efeitos de fogo e explosão indo para `game-vfx`.

### 4.3 Pacotes de conteúdo

- **`game-weapons-arsenal`** (sugestão, nome a decidir; D1): o catálogo real genérico, **reutilizável por qualquer jogo**: os 71 modelos (nome, categoria, calibre, capacidade, comprimento, cano, peso, opções de modelo), os 22 calibres com dimensões. Não conhece o ZombiAdA.
- **Conteúdo ZombiAdA** (pacote próprio, p.ex. `game-weapons-zombiada`): pontos de dano/PEN/alcance/ruído por calibre (§04), tipos de munição (§05), raridade, rolagem de achados (§16), efeito de explosivos (EXP), confiabilidade `rel` e perfil de zumbi (o dano por região vai para o conteúdo de `game-characters`).
- **`game-items`** (novo, Fase 3): tipos de item, categoria, peso, durabilidade, validade (`idade_efetiva` por troca de lugar), porções, usos, receitas, tabelas de saque estendidas (raridade, lugar, região, decaimento por dia), mochila com carga. Reutiliza `ItemDef`/`LootTable`/`generateLoot` de `game-interactables` em vez de repetir.
- **`game-items-three`**: 24 modelos de ITE e o `setStage` (novo, gasto, estragado por tag de material).
- **Conteúdo do ZombiAdA** (`game-items-zombiada`, nome a decidir): os 257 itens, 24 lugares, 10 regiões, 33 receitas, 16 contêineres, regras de saque progressivo.

### 4.4 Exemplos `-test-area`

- `examples/weapons-test-area`: já existe. Acrescentar controles de pane/destravar, qualidade da arma (nova/usada/gasta/enferrujada), modo lado a lado com régua, aba de munição (22 calibres), aba de explosivos/lançadores, e golden de cada arma (monta, mede, anima). Os botões e teclas do GAL (espaço, R, B, D) mapeiam para eventos do `ModuleHost`, o que exige **eventos novos no contrato** (`jam`, `clear`, `burst`), já que `HostEvent` só tem `tool`, `shot`, `reload`, `empty` (`game-contracts/src/module.ts`). Contratos continuam genéricos.
- `examples/items-test-area` (Fase 3): vitrine dos 24 modelos e o filtro do catálogo.
- Zumbi, veículo e parede do GAL **não** vão para `weapons-test-area`: o zumbi vai para `characters-test-area`, o carro e a parede já têm ambiente em `game-vehicles-fleet` e `game-destruction`.

### 4.5 Genérico ou só do ZombiAdA

| Genérico | Só ZombiAdA |
|---|---|
| construtores de arma, `fitLength`, famílias de recarga, pane, calor, clarão, cartuchos, calibres reais, catálogo real de armas, lançadores, régua | pontos de dano/PEN, raridade, tabela de achados, tipos de munição com multiplicadores do jogo, ruído em escala do jogo, `rel`/qualidade, `FOR`/mochila, regiões do Vale, receitas, validade em dias, itens de facção (`LOOT`), zumbi e suas regiões |

---

## 5. Dúvidas para o dono

1. **Marcas e modelos reais** (D1): o `game-weapons` foi desenhado com arquétipos sem marca (`pistol_9mm`). O time entregou Glock, Colt, Taurus etc. e o ARS §09 avisa que marca registrada pode pedir licença. O catálogo real fica no SDK com nomes reais (pacote `game-weapons-arsenal`) ou nomes genéricos com a marca só no conteúdo do ZombiAdA?
2. **Fonte da verdade da lista** (D2): ARS diz 67 armas e GAL entrega 71 de fogo (+4 que o documento não tem: HK PSG-1, Steyr SSG 69, Barrett MRAD, CheyTac M200) mais 6 lançadores sem ficha no ARS. Entram todas? O ARS é atualizado?
3. **Calibres ausentes** (D3): o `.408 CheyTac` (CheyTac M200) não está em `AMMO` nem em ARS §04; a Remington 700 do ARS é ".308 / .300 WM" e a Rossi Puma ".38 / .357". Quem define o calibre real desses?
4. **Dano em pontos ou em joules** (D4): o ARS usa pontos de jogo (35 para 9×19, 45 para 5,56...) sem relação com energia. Mantemos joules no motor e os pontos como calibração do ZombiAdA, ou o ZombiAdA deve passar a usar joules?
5. **Escala de ruído** (D5): ARS §12 (pistola 150 m, fuzil 300 m, .50 600 m), SDK (mesma ordem de grandeza) e JML (60, 110, 130 m) divergem. Qual é a oficial?
6. **Dano por região** (D6): três versões (ARS §02, GAL 856-860, JML `zDamage`/`SEG`): vida de braço 45 contra 60, perna 55 contra 80, 5 regiões contra 11 segmentos. Qual vale para o `game-characters`?
7. **Tempo de recarga** (D7): usar os tempos do ARS §06 (tático e vazio) como regra e os de GAL só como animação? A animação deve ser esticada para igualar a regra (cinta 7,5 s) ou a regra manda e a animação repete?
8. **Itens com modelo 3D** (D8): só 24 dos 257 itens têm forma 3D. O resto fica com a dica `shape` do SDK ou o time de itens vai entregar mais modelos? E o tamanho real: ITE normaliza para 1,55 e o catálogo não tem dimensões em metros.
9. **Duas versões do catálogo de itens** (D9): o JML embute 146 itens (campos `dur`, `v`, `p`, `reg`, `ck`, `red`, `rap` ausentes) e ITE tem 257. O porte parte de ITE (a mais nova)? O jogo passa a consumir `game-items`?
10. **Itens do SDK existentes** (D10): `game-interactables-household` já tem 92 itens e saque determinístico. O catálogo do ZombiAdA é um segundo catálogo ou deve ser fundido (ex.: `canned_food` e `feijao_lata`)? Quem manda no `ItemDef`?
11. **Estado e sorte** (D11): GAL e JML usam `Math.random`. O SDK exige semente. Aceita-se que o "igual ao original" (R2) seja medido por **sequência de eventos com semente fixa** e não por pixels?
12. **Peças de mundo no Arsenal** (D12): carro (5 estados) e parede (4 materiais × 4 estados) do GAL duplicam `game-vehicles` e `game-destruction`. Aceita-se não portar essas duas abas e usar o SDK?
13. **Acessórios, supressor, durabilidade** (D13): existem só como texto (ARS §11, §10). Entram agora (como dado e regra) ou depois do porte das armas?
14. **Explosivos** (D14): ARS §13 e JML `EXP` descrevem raios letal/ferimento e efeitos. A regra vai para `game-weapons` (`throwable`) e o efeito para `game-vfx`? A reação em cadeia (botijão, tanque, posto) vai para `game-destruction`?
15. **Dependência do jogo no SDK** (D15): o JML embute o `game-weapons` mas não o usa para atirar. Depois do porte, o jogo troca `ARMAS`/`CALIBRES` por `createArsenal` (e mantém só o perfil de dano no conteúdo)?
16. **Versão do three** (D16): a galeria usa r128 (`outputEncoding`, `convertSRGBToLinear`, `RoundedBoxGeometry` do addon). O SDK usa three ^0.160. Aceita-se importar o addon (`three/examples/jsm/geometries/RoundedBoxGeometry.js`) como dependência opcional, ou escreve-se a geometria própria?

---

## 6. Ordem sugerida de porte (Fase 1 e 3 da spec)

1. Dados: calibres e armas reais (T1.1), dimensões no `WeaponDef`, calibres faltantes.
2. Modelos `-three` (T1.2, T1.3) com golden por arma (medida do bounding box = `WEAP` comprimento).
3. Regras no motor (`reloadEmpty`, `perRound` no ferrolho, capacidade com câmara, pane, calor, durabilidade) + testes com semente (T1.4).
4. Animação por família no `-three` (T1.4) e eventos novos no contrato de módulo.
5. Lançadores e explosivos (T1.5), com os efeitos visuais ligados ao `game-vfx` quando existir.
6. `weapons-test-area` com os controles novos (T1.7).
7. Itens (T3.x) só depois de responder D8 a D10.

---

## 7. Situação depois da Fase 1, T1.1 (R5)

Atualizado em 2026-10-23. O que do inventário acima já entrou, e onde. O restante segue como descrito nas seções 3 e 4.

| Item do inventário | Entrou? | Onde |
|---|---|---|
| Lista de armas (união GAL + ARS, A1) | Sim: 73 de fogo (71 da Galeria + Remington 700 .300 WM + M79), 6 lançadores e lança-chamas, 42 arquétipos | `packages/game-weapons/src/data/{firearms,launchers,archetypes}.json`, gerados por `tools/weapons-catalog` |
| Marcas e modelos reais (D1, G5) | Sim, com `maker`, `archetype` e `sources` | idem |
| Ficha de dimensões e `lengthCollapsed` | Sim (`dimensions`) | `types.ts` `WeaponDimensions`; dados em `firearms.json` |
| Calibres (22 de GAL/ARS §04) | Sim: 28 (10 novos), com estojo, aro, cartucho e ruído | `src/data/calibers.json` |
| Ruído do Arsenal §12 (D5, A3) | Sim, por calibre, com rajada de ruído (+5% por tiro em 3 s, até +50%) | `calibers.json`; `src/heat.ts` `burstNoise` |
| Tempos de recarga tática, vazia e por cartucho (D7, A5) | Sim, como `timings` por arma | `firearms.json`; `src/reload.ts` |
| Recarga por família e etapas | Sim, regra e ordem das etapas (a animação fica para a T1.4) | `src/reload-stages.ts` `RELOAD_STAGES`, `src/reload.ts` |
| Capacidade com câmara, carregadores alternativos, dois tubos | Dado (`chamber`, `magazineOptions`, `tubes`); `capacity` ainda é só o carregador | `types.ts`, `firearms.json` |
| Pane/engasgo (`QUAL`, `jamRoll`, `clearJam`, `rel`) | Sim: 4 tipos, 4 condições, `faultFactor`, desobstruir 1,2 s, qualidade da munição (Arsenal §05) | `src/faults.ts`, `src/weapon.ts`, `src/rules.ts` |
| Calor do cano (`heat`, `heatPer`, `stepWeapon`) | Sim, igual à Galeria (golden de calor e munição) | `src/heat.ts`; `tests/team-golden.test.ts` |
| Tiro, rajada, salva, ciclo manual | Sim (`roundTimes`, `volley`, `timings.cycle`) | `src/fire.ts`, `src/weapon.ts` |
| Lançadores (`launcher`) | Mínimo: um cartucho gera `Use` `throw` com velocidade e explosivo; a regra completa fica na T1.5 | `src/weapon.ts` `fireLauncher` |
| Explosivos (D14): raios letal e de ferimento, energia, ruído | Sim, 17 | `src/data/explosives.json` |
| Modelos 3D, animação por família, ejeção, carregador, cartucho 3D | Não (T1.2 a T1.4); só o construtor da Galeria foi extraído para `models.json` | `packages/game-weapons-three/src/data/models.json` |
| Área de armas com todas as armas | Não: mostra só os 42 arquétipos até a T1.3 | `packages/game-weapons-three/src/area.ts` |
| Dano em pontos, PEN, dano por região, raridade (D4, D6) | Não, de propósito (calibragem do jogo) | |
| Acessórios, supressor, durabilidade 0-100 (D13) | Não; o supressor é a sobrescrita `noise` da arma | |

Perguntas novas para o dono: ver `evidence.md`, "T1.1 (parte B)".
