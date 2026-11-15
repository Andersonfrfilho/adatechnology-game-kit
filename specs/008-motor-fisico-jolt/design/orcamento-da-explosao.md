# Orçamento da explosão: física dentro de 5 ms por quadro no Jolt

Spec 008, 2026-11-15. Revisão de arquiteto (`architect`, só leitura) das quatro frentes de desempenho e da literatura.
Fontes de número: `evidence.md` T3.6c, T3.8o, T3.8q, T3.8v, T3.8x, T3.8y. Fontes de código: as linhas citadas são da `main` em `a74a71d1`
(worktree `espalhar-explosao`) e da `perf/corte-da-casa` em `a194fd2c`. Item que não deu para confirmar na web está marcado **não confirmado**.

## 1. Alvo

- **B6 (spec):** física ≤ 5 ms em **todo** quadro e p99 ≤ 4 ms, explosão de casa no Jolt, passo de 120 Hz e 32 passadas (D1) fixos.
- **"Física" aqui é tudo o que roda entre o evento e o fim do passo:** `splitLoose` (corte da casa), `prepare` (`sync`, `layGround`,
  `layTile`) e `stepFixed`. Na sala é isso que aparece no quadro; separar os três é o que permite dar orçamento a cada um.
- **Divisão proposta do orçamento de 5 ms** (máquina forte, 1×): passo do Jolt ≤ 3 ms, chão e corpos novos ≤ 1 ms, corte e ativação ≤ 1 ms.
  Em máquina fraca (4×, 6×) o orçamento em **unidades de trabalho** cai na mesma proporção e o trabalho se espalha por mais quadros,
  até um teto de quadros (§12, seção 7); passado o teto, quem decide é o dono (seção 7, tensão T1).
- **Restrições do dono:** experiência e desempenho não pioram; tudo configurável; determinismo (T3.7); nada flutua (§12).

## 2. Para onde vai o tempo hoje

| família de quadro | antes da T3.8y | depois da T3.8y (main de hoje) | onde | dono hoje |
|---|---|---|---|---|
| f0, corte da casa | 57–66 ms sem navegador: `splitLoose` 49 (`fitOrientedBoxes` 26, `rebuildHost` 14, dos quais `computeVertexNormals` 12) | despertar na sala 22–30 ms (T3.8y §5) | `renderer.ts:1985` `splitLoose`, `:2034` `adoptSplit`, `visual.ts:922` `rebuildHost` | `corte-da-casa` |
| ladrilhos de chão em rajada | f96 144 ms (`layTile` 65: `makeShape` 37, `createBody` 30), f110 144–160 ms (`layTile` 113, `readTile` 42) | não reatribuído; o quadro mediano subiu de 5,9 para 9,1 ms porque os 21 trechos de fio assentam chão cada um (T3.8y §4) | `engine-pieces.ts:742` `layGround`, `:851` `layTile`; sem orçamento nenhum | **ninguém** |
| reassentamento por `groundChanged` | 94 ladrilhos no quadro 35, 86 no 44; 150–190 em 70 quadros (T3.8o §1) | idem | `engine-ground*.ts`; sólido de cratera 3,8 ms por ladrilho (T3.8q) | **ninguém** |
| `Step` com o poste varrido (CCD) | f124–f130: 130–190 ms, 12 passos de ~70 ms | **resolvido**: `stepFixed` dos 6 piores quadros 123 → 6,5 ms (máx. 15) | `engine-pieces.ts:481` `continuous: true`; limiar `mLinearCastThreshold` | (T3.8y) |
| despertar de 500 corpos (bench B6 isolado) | quadro de despertar 10,1 ms, p99 5,68 ms; piso do Jolt sem ouvinte no f1 5,2 ms | idem | `game-physics/src/wake-queue.ts` | `espalhar-explosao` / `passo-jolt-pecas` |
| 2ª explosão ou colapso criando peças | 144–193 ms (T3.8o §1) | não reatribuído | corte + corpos novos + chão | `corte-da-casa` + `espalhar-explosao` |

Resultado agregado da main de hoje, sem navegador (T3.8y §4, blast): p50 9,1 ms, p99 49 ms, máx. 52 ms, soma de 240 quadros 3091 ms
(12,9 ms de média). Sala: p99 42–50 ms, máx. 49–61 ms.

**Lacuna de medida:** depois da T3.8y ninguém reatribuiu por estágio os quadros de 42–61 ms. O f0 caiu para 22–30 ms na sala, então os
piores quadros de hoje são outra coisa: provavelmente ladrilhos novos e a segunda leva de peças (inferência, não medida). A ação 0 é medir isso.

## 3. Fontes (só o que não está em `referencias-academicas.md`, ou o que acrescenta a ele)

Frentes: **C** = `corte-da-casa`, **E** = `espalhar-explosao`, **P** = `passo-jolt-pecas`, **M** = `medir-maquina-fraca`, **G** = frente nova do chão (seção 5).
"Cabe" = cabe em browser, WASM de uma thread, sem GPU.

| # | Fonte | Link | Ideia que serve | Frente | Cabe | Custo |
|---|---|---|---|---|---|---|
| 1 | Jolt, documentação: ilhas e sono | https://jrouwe.github.io/JoltPhysics/ (seções Sleeping, Creating Bodies, Broad Phase, Deterministic Simulation) | O sono é **por ilha**: um corpo agitado mantém a pilha toda acordada. **Remover um corpo não acorda os vizinhos.** Corpos se criam em lote (`AddBodiesPrepare`/`Finalize`); um por vez "deixa a broadphase ineficiente"; se não der, `OptimizeBroadPhase`. Determinismo exige **a mesma ordem de chamadas** da API. | P, E, §12 | sim | baixo |
| 2 | Jolt, `PhysicsSettings` | https://jrouwe.github.io/JoltPhysics/struct_physics_settings.html | `mLinearCastThreshold` 0,75 do raio interno; `mLinearCastMaxPenetration` 0,25. A varredura recua o corpo e "rouba tempo"; um corpo longo girando rápido ainda atravessa. | P | sim | baixo (decisão do dono, T3.8v §6.1) |
| 3 | Catto, *Simulation Islands* (Box2D, 8/10/2023) | https://box2d.org/posts/2023/10/simulation-islands/ | Ilhas persistentes, divididas aos poucos (no máximo uma por passo), divisão só quando os corpos querem dormir. Uma ilha enorme domina o quadro. Pilha de 10 mil corpos: 0,69 ms de DFS contra 0,01 ms persistente. | P | conceito (o Jolt faz por dentro) | baixo |
| 4 | Catto, *Continuous Collision*, GDC 2013 (acrescenta ao arquivo) | https://box2d.org/files/ErinCatto_ContinuousCollision_GDC2013.pdf | No Diablo 3 o CCD caro ficou **só entre dinâmico e estático**; contatos especulativos como alternativa barata. | P | sim | médio |
| 5 | Carlson e Hodgins, *Simulation Levels of Detail for Real-time Animation*, Graphics Interface 1997, pp. 1–8 | https://graphicsinterface.org/proceedings/gi1997/gi1997-1 | LOD de simulação: o que importa menos vira simulação mais barata (menos graus de liberdade, híbrido, cinemático). | P, E | sim | médio |
| 6 | Chenney e Forsyth, *View-Dependent Culling of Dynamic Systems in Virtual Environments*, SI3D 1997, pp. 55–58 | https://www.cs.princeton.edu/courses/archive/spr01/cs598b/papers/chenney97.pdf | Não simular o que não aparece; o problema é recriar um estado coerente quando volta à vista. | E (com cautela) | sim | alto: depende da câmera e quebra o determinismo se a câmera não for entrada gravada |
| 7 | NVIDIA Blast, extensão de tensão (`NvBlastExtStress`) | https://nvidia-omniverse.github.io/PhysX/blast/docs/api/extensions/ext_stress.html · https://docs.nvidia.com/gameworks/content/gameworkslibrary/blast/1.1/api_docs/files/pageextstress.html | Grafo de suporte com ligações; o solver de tensão tem **número de iterações por quadro** (converge ao longo de quadros) e **redução do grafo** (cerca de 2^nível menor). | E (grafo amortizado) | sim (algoritmo de CPU) | médio |
| 8 | Unreal, Chaos Destruction (`UGeometryCollection`) | https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/GeometryCollectionEngine/UGeometryCollection · bug https://issues.unrealengine.com/issue/UE-358545 | Limiar de dano por nível de cluster (o cluster só se divide quando o golpe passa do limiar), `bRemoveOnMaxSleep` (sai da simulação ao dormir). O bug UE-358545 mostra o risco: remoção por timer fez sumir peças de um objeto meio quebrado. | P (remoção), frente de clusters (seção 5) | sim | médio |
| 9 | Müller, Chentanez, Kim 2013 (acrescenta ao arquivo) | https://history.siggraph.org/?p=108389 | Além da fratura parcial: detecta as **ilhas desconectadas do estático** para decidir o que perdeu suporte, e evita análise de tensão de propósito. É o que `recomputeGroups` já faz (`game-destruction/src/world.ts:758`). | C (confirma o desenho) | sim | já feito |
| 10 | Glondu, Marchal, Dumont, *Real-Time Simulation of Brittle Fracture Using Modal Analysis*, IEEE TVCG 19(2), 2013 | https://hal.archives-ouvertes.fr/hal-00752372 | Início da trinca por análise modal pré-calculada, propagação por energia, rápida. Fratura recursiva exige refazer a análise (caro). | nenhuma agora | runtime sim, pré-cálculo não | alto |
| 11 | Richter (Remedy), *Destructible Environments in Control*, GDC Summer 2020 | https://gdcvault.com/play/1030643/Destructible-Environments-in-Control-Lessons · resumo https://cgworld.jp/feature/202008-gdccontrol-2.html | Três camadas de destroço: peças grandes como corpo rígido; pequenas como partícula e decalque; poeira e faísca como flipbook. Conteúdo lido só em resumo de terceiros. | E, P | sim | baixo (o kit já tem `chipSize` e `maxPhysicsPieces` em `blast-debris.ts:70`) |
| 12 | L'Heureux (Ubisoft), *The Art of Destruction in Rainbow Six: Siege*, GDC 2016 | https://gdcvault.com/play/1023003/The-Art-of-Destruction-in | Destruição procedural (RealBlast) como mecânica central. Como o orçamento é cumprido: **não confirmado** (palestra não assistida). | referência | — | — |
| 13 | Isaksson (Embark), *Engineering Mayhem: environmental destruction in THE FINALS*, GDC 2024 | https://schedule.gdconf.com/session/engineering-mayhem-technical-deep-dive-into-environmental-destruction-in-the-finals/900179 | Destroço totalmente simulado e persistente, no servidor; descartaram o Chaos por isso. Detalhes de orçamento: **não confirmado** (só o resumo). | referência | — | — |
| 14 | Catto, *Determinism* (Box2D, 8/2024) | https://box2d.org/posts/2024/08/determinism/ | A ordem de criação de corpos e formas determina a ordem dos contatos (Box2D, mas o Jolt pede o mesmo: item 1). Lido só no trecho da busca. | E | sim | baixo |
| 15 | 7 Days to Die, integridade estrutural | https://gamever.io/knowledge-base/how-structural-integrity-works-in-7-days-to-die | O primeiro bloco de uma cadeia horizontal carrega a carga de tudo atrás dele. **Não confirmado**: fonte de comunidade, sem documento oficial. | referência | sim | — |
| 16 | Teardown, integridade estrutural | https://80.lv/articles/this-real-time-voxel-building-demolition-is-so-satisfying/ | Protótipo de integridade estrutural em voxel. **Não confirmado** se entrou no jogo (a PC Gamer diz que não). O *Teardown Frame Teardown* de Wittens (https://acko.net/blog/teardown-frame-teardown/) é sobre renderização, não serve. | referência | — | — |
| 17 | Red Faction: Guerrilla, Geo-Mod 2.0 | https://www.redfactionwiki.com/wiki/GeoMod_2.0 | Malhas pré-quebradas e colapso por tensão. Palestra de GDC sobre o sistema: **não confirmado**. | referência | — | — |
| 18 | Zafar et al. 2010, destruição de prédio com milhares de corpos rígidos e restrições ponto a ponto | citado em https://users.cs.utah.edu/~benjones/LiERBF2018.pdf | Prédio rígido mantido por restrições. Título, venue e conteúdo: **não confirmado**. | referência | — | — |

Não achei, e marco **não confirmado**: palestra de GDC da Havok sobre "fracture on demand" ou fratura parcial; palestra de GDC
sobre a Destruction 2.0 do Battlefield (só houve demonstração à imprensa em 2009); artigo acadêmico de grafo de suporte para jogos
com solver amortizado (o mais perto é o Blast, item 7, que é documentação de SDK).

**O que a literatura muda no plano.** O "top 1" do levantamento anterior (grafo de suporte decidindo o que solta) **já existe**:
`world.ts` tem o grafo de apoio com carga distribuída até o ancorado (`world.ts:1098`), as partes sem caminho de suporte (`world.ts:312`)
e os grupos por união e busca (`recomputeGroups`, `world.ts:758`). O que falta não é decidir **o que** solta, é decidir **quando** e
**com que custo** cada coisa solta: isso é a frente E. A ideia nova útil do Blast e do Chaos é outra: **cluster por distância** (seção 5).

## 4. Plano por frente

### C, `corte-da-casa` (já tem dois commits)
- Feito em `perf/corte-da-casa`: caixas ajustadas antes do golpe, em sobra de quadro (`runPrefit`, até 1 ms, `PREFIT_SLICE_MS`), com cache
  por `MeshVis` comparando pontos e triângulos número a número (`fitRanged`); e um `rebuildHost` por hospedeiro por lote (`batchRebuilds`).
- Falta medir: **taxa de acerto do cache na explosão de verdade.** Se a explosão amassa a parede (`work` muda) antes de soltar o grupo,
  os pontos mudam e o cache erra; o ganho dos 26 ms depende disso. A sonda da T3.8v resolve: contar `fitOrientedBoxes` no f0 com e sem `fitBoxesAhead`.
- Falta medir: **memória (§8).** O cache guarda pontos e triângulos de toda parte de toda casa vinculada. Medir o heap com 1 e com 20 casas;
  se passar de alguns MB, guardar só um hash dos números mais as caixas.
- Ganho esperado: f0 de ~49 ms de kit para ~10–15 ms (26 de ajuste e ~12 de normais a menos). Ainda acima de 5 ms: o resto vai para E.

### E, `espalhar-explosao` (o integrador)
1. **Trocar o relógio por unidades de trabalho.** Hoje o corte e os fragmentos param por relógio (`renderer.ts:1897` e `:1994`, `drainClock() >= sliceDeadline`),
   e a T3.8v §5 registra que por isso a sala não repete bit a bit. Cada tipo de trabalho ganha um custo fixo em unidades (triângulos ajustados,
   vértices refeitos, corpos criados, amostras de chão lidas); o quadro tem um orçamento em unidades; o relógio só escolhe a **faixa da máquina**
   uma vez, no início (de M), e a faixa fica gravada no estado salvo e no replay.
2. **Um árbitro só para o orçamento do quadro:** corte, ajuste antecipado de C, chão (G), criação de corpos e despertar (`WakeQueue`) tiram do mesmo
   orçamento, em ordem fixa. Sem isso cada fila acha que tem o quadro inteiro.
3. **Ordem:** primeiro o que já perdeu apoio e está à vista (risco de flutuar), depois por distância ao jogador, desempate por id estável.
4. **Teto em quadros, não em ms:** todo grupo solto vira peça em até N quadros (proposta: 3 a 60 Hz), qualquer que seja o custo.
5. **Fila em dados, não em closures:** `slices: Array<() => void>` (`renderer.ts:355`) não se salva; salvar no meio do espalhamento quebra o salvar/carregar bit a bit da T3.7.
6. **Despertar:** o B6 mostra que 500 corpos num quadro passam de 5 ms com qualquer código (piso do Jolt 5,2 ms no f1). O `WakeQueue`
   (`wake-queue.ts`, alvo 4 ms, atraso máximo 0,08 s, mínimo 8 por quadro) já espalha; precisa ler o custo da faixa (`debrisCost: fixed`), não do relógio.

### P, `passo-jolt-pecas`
1. **Criar corpos em lote.** Peças e ladrilhos nascem um a um (`engine-pieces.ts:466`, `:865`, `:903`, `:904`, `:914`, todos `createBody`);
   o lote já existe no adaptador (`game-physics-jolt/src/world.ts:306`, `AddBodiesPrepare`/`Finalize`) e só os estáticos o usam (`engine-statics.ts:154`).
   O f96 tinha 30 ms de `createBody`. Coletar os descritores no `prepare` e criar uma vez por quadro. Medir: a doc do Jolt diz que um a um degrada a broadphase.
2. **Remover acorda os vizinhos.** `removeBody` (`game-physics-jolt/src/world.ts:313`) não chama `wakeInBox` (`:456`); o Jolt não acorda sozinho.
   `fadePiece` (`renderer.ts:2555`) e o teto `maxLivePieces` removem peças em repouso: o que estiver dormindo em cima fica no ar. É §12 e custa uma linha.
3. **Sono e ilhas:** medir quantas ilhas e quantos corpos por ilha com 26–32 peças acordadas; uma peça tremendo segura a pilha toda (fonte 1, 3).
4. **CCD:** generalizar o achado do poste. Listar as peças de composto cujo raio interno (a menor parte) dá limiar abaixo de ~2 m/s
   (0,75 × raio / (1/120 s)); para cada uma, decisão do dono entre as opções da T3.8v §6.1. Não desligar em massa: a T3.8u mediu C1 de 45–61 kg·m sem CCD.
5. **Tabela de subpassos para o dono:** custo do passo por (Hz, passos de colisão, passadas) com o mesmo cenário; o dono escolhe. Não muda o padrão sem ele.
6. `maxLivePieces` e a regra "longe e velho" já existem (`pieces.ts:1431`, `blast-debris.ts:49`): calibrar por faixa de máquina, não criar outra.

### M, `medir-maquina-fraca`
1. **Primeiro de tudo, a ação 0:** reatribuir por estágio os quadros de 42–61 ms da main de hoje (sonda da T3.8v, `decision/probes/t38v/`).
2. Gate em 1×, 4× e 6× de CPU, um processo por vez, A/B intercalado (a T3.6c mostrou deriva térmica de 0,6 ms entre horas).
3. O resultado define a **faixa da máquina** que E usa: um número no início da sessão, nunca um relógio por quadro.
4. Limite do método: o estrangulamento de CPU no Chrome não reproduz cache, memória nem o JIT de WASM de uma AMD de verdade
   (inferência). Medir numa AMD antes de fechar (memória do projeto: desempenho por faixa, não por marca).

## 5. Frente nova: começar? Qual?

**Sim, uma: G, "chão sob as peças com orçamento".** É o maior custo sem dono. Ladrilhos novos fizeram os quadros de 144–160 ms antes da T3.8y,
e depois dela são o motivo de o quadro mediano subir de 5,9 para 9,1 ms. `layGround` (`engine-pieces.ts:742`) não tem orçamento nenhum, e não pode
simplesmente esperar: peça acordada sobre chão não assentado atravessa (`fellThrough`). Por isso G entrega custo menor, e E decide a ordem.
1. Laje plana barata: ler poucas amostras primeiro e só ler as 26 mil (`readGround`, T3.8v §6.3) se o chão não for plano. Hoje um ladrilho de laje custa 0,5–0,66 ms, quase tudo leitura (T3.8o §1).
2. Reaproveitar os cascos convexos do sólido que não mudaram (pendência da T3.8q: 3,8 ms por ladrilho de cratera).
3. Pré-assentar no próprio evento da explosão, no raio dela, com o orçamento de E (a T3.8o mediu ~20 ms a menos no quadro 1 com pré-assento).
4. Juntar avisos de `groundChanged` do mesmo quadro (rajadas de 86–94 ladrilhos).

**Não começar agora: "grafo de suporte".** Já existe (seção 3). **Não começar agora: clusters por distância** (Chaos, Blast: grupos soltos longe do
jogador ficam um corpo só e se dividem no próximo golpe). Corta muitos corpos, mas muda o que se vê e a física (o cluster cai inteiro): só com decisão do dono,
e depois de E, como degradação de máquina fraca.

## 6. Ordem de merge

1. **M** (só medida e gate; nenhum arquivo de produto). Dá a linha de base e a ação 0.
2. **C** (`renderer.ts` `splitLoose`/`adoptSplit`/`runBudgeted`, `visual.ts`). Autocontida; muda o custo do corte, que E precisa conhecer.
3. **P** (adaptador Jolt, `engine-pieces.ts` criação e remoção, `KIT_WORLD` só com o dono). Muda o custo por corpo.
4. **G** (`engine-pieces.ts` `layGround`/`layTile`, `engine-ground*.ts`).
5. **E por último.** Os custos fixos por unidade e a faixa da máquina dependem dos outros três: calibrar antes deles é calibrar duas vezes.
6. Rodar M de novo sobre o resultado.

**Conflitos certos:**
- `renderer.ts` `splitLoose` (`:1985`): C embrulhou o laço em `batchRebuilds` com uma bandeira `deferred`; E troca o teste do relógio do mesmo laço. E rebaseia sobre C.
- `renderer.ts` `runBudgeted` (`:1012`): C pôs `runPrefit` no fim, com relógio próprio (`clock() + PREFIT_SLICE_MS`); E vai substituir o relógio. O ajuste antecipado precisa entrar no árbitro de E.
- `engine-pieces.ts` `prepare` (`:278`): P (lote de corpos), G (chão), E (ativação condicionada ao chão). Combinar antes de codar: P dono da criação, G do chão, E só chama.
- `blast-debris.ts` e `wake-queue.ts`: E (custo da faixa) e P (`maxLivePieces`, custo por corpo). Um dono só: E.

## 7. Riscos

**Determinismo (T3.7).**
- D1. Relógio decidindo trabalho (`renderer.ts:1897`, `:1994`, o `lastStepMs` medido do `WakeQueue`, o `PREFIT_SLICE_MS` de C) muda a ordem de criação de corpos,
  e o Jolt só repete com a mesma ordem de chamadas (fonte 1). Correção: unidades de trabalho, faixa fixa por sessão.
- D2. **Sutil, entre C e E:** o ajuste antecipado avança pelo relógio, então no instante da explosão o cache está cheio ou não por acaso. Se E estimar o custo do corte
  pelo estado do cache, o cronograma deixa de ser determinístico. Correção: E conta o ajuste como se nunca estivesse em cache (conservador), ou o ajuste antecipado também é por unidades.
- D3. Prioridade pela posição do jogador é entrada: ler o foco uma vez por quadro num ponto fixo e desempatar por id.
- D4. Fila em closures não se salva (seção 4, E5).

**§12 (nada fica no ar, nada invisível colide).**
- F1. Grupo solto esperando na fila continua desenhado e estático na casa: se o apoio sumiu, flutua enquanto espera. Teto em quadros e prioridade para o que perdeu apoio.
- F2. Remover peça em repouso sem acordar vizinhos (P2) deixa o que estava em cima dormindo no ar. Já acontece hoje com `fadePiece`.
- F3. Ativação atrasada não pode ser "corpo nenhum": peça desenhada sem corpo deixa outra atravessá-la. Esperar dormindo no motor, nunca fora dele.
- F4. Chão atrasado (G) faz peça cair através: o chão é pré-condição da ativação, nunca o contrário.
- F5. CCD desligado em peça fina volta o túnel e o C1 alto (T3.8u §3).

**Tensões que só o dono decide.**
- T1. Em 6× de CPU, o teto de quadros (§12) e o orçamento de 5 ms não cabem juntos para uma casa inteira. Ou se espalha por mais quadros (risco de flutuar e
  de atraso visível), ou se reduz conteúdo (menos peças, clusters), que é "experiência pior". A regra "não piora" não diz qual das duas piora menos.
- T2. O ganho de G e P muda ids e ordem de criação; a T3.8v viu o poste mudar de 3/30 para 9/30 com uma mudança "neutra". Toda frente precisa da régua por distribuição (30 rodadas por lado), não só bit a bit.
- T3. Steelman contra E (espalhar): espalhar não reduz trabalho, só o muda de quadro, e soma custo de fila e de recálculo. Com C, P e G cortando custo de verdade,
  o pico pode cair abaixo de 5 ms sem escalonador em máquina forte. Resposta: o B6 mostra que o despertar de 500 corpos passa de 5 ms com qualquer código
  (piso do Jolt), e máquina fraca multiplica todo o resto. E é necessário, mas deve ser o último a entrar e o mais simples possível.
