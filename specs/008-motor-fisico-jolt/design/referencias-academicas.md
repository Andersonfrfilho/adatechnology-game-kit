# Referências acadêmicas e técnicas: destruição e terreno em tempo real

Levantamento de 2026-11-15 para a spec 008 (Jolt). Cada item foi achado por busca na web; o que não deu para
confirmar está marcado **não confirmado**. Resumos vêm de resumos oficiais (abstract), não de leitura integral dos PDFs,
salvo onde dito. A coluna "mapeia" usa as letras: (a) custo do split e do ajuste de caixas, (b) fratura variada e realista,
(c) CCD do Jolt em peças finas, (d) energia e empilhamento, (e) crateras no terreno, (f) colapso de prédio.

Custo de adotar: baixo / médio / alto. "Cabe" = cabe em browser, WASM de uma thread, sem GPU.

## 1. Os seis artigos pedidos

### 1.1 Müller, Chentanez, Kim: fratura dinâmica com decomposição convexa volumétrica
- Título exato: *Real Time Dynamic Fracture with Volumetric Approximate Convex Decompositions*. ACM Transactions on Graphics 32(4),
  art. 115, SIGGRAPH 2013. DOI 10.1145/2461912.2461934. Autores da NVIDIA (primeiro autor aparece como Müller-Fischer em alguns arquivos).
- Link: PDF no site do autor, `fractureSG2013.pdf` na página https://matthias-research.github.io/pages/publications/publications.html
  (URL do PDF resolvida a partir da página; conferir antes de citar). Registro: https://history.siggraph.org/?p=108389
- Ideia: a malha vira um conjunto de convexos aproximados por voxel (VACD). Quando algo bate, aplica-se um padrão de fratura
  (estilo Voronoi) centrado no ponto de impacto, cortando só os convexos atingidos, em vez de pré-quebrar tudo.
- Mapeia: (a) sim, a peça já nasce como convexos, então não há ajuste de caixa por triângulo; (b) sim, o padrão acompanha o impacto.
- Custo: médio (voxelizar e decompor offline por tipo de peça; cortar convexos em runtime é simples). Cabe: sim, o runtime é CPU;
  o artigo da época usava GPU para a decomposição, o que a nossa versão faria offline. (O uso de GPU no original: não confirmado no texto, só inferência.)

### 1.2 Sellán et al.: Breaking Good
- Título exato: *Breaking Good: Fracture Modes for Realtime Destruction*. Silvia Sellán, Jack Luong, Leticia Mattos Da Silva,
  Aravind Ramakrishnan, Yuchuan Yang, Alec Jacobson. ACM TOG 42(1), fevereiro de 2023 (apresentado no SIGGRAPH Asia 2022; versão arXiv
  de nov/2021 tinha o título "Fracture Modes for Realtime Destruction").
- Links: https://arxiv.org/abs/2111.05249 · https://www.dgp.toronto.edu/projects/breaking-good/ · código https://github.com/alecjacobson/fracture-modes
- Ideia: calcula offline os "modos de fratura" de um objeto (autovetores de um problema esparso, como modos de vibração, mas para
  quebrar). Em runtime o impacto é projetado nesses modos e dá cortes que seguem as regiões fracas, sem simular propagação de trinca.
  Os autores criticam o Voronoi por dar cacos reconhecíveis e artificiais.
- Mapeia: (b) forte; (a) ajuda se os pedaços saírem pré-calculados como convexos.
- Custo: alto para peça arbitrária (precisa de malha volumétrica e do solver de autovalores offline); baixo se só usarmos a ideia
  (cortes guiados por geometria da peça, não por sementes aleatórias). Cabe: runtime sim; o cálculo dos modos é offline, fora do browser.

### 1.3 Hahn e Wojtan: fratura frágil por elementos de contorno
- Título exato: *Fast Approximations for Boundary Element Based Brittle Fracture Simulation*. ACM TOG 35(4), art. 104, SIGGRAPH 2016.
  DOI 10.1145/2897824.2925902. David Hahn e Chris Wojtan (IST Austria).
- Link: https://pub.ista.ac.at/~wojtan/projects/2016_Hahn_FastFracture (projeto, com PDF e código) · https://core.ac.uk/download/268225468.pdf
- Ideia: método de elementos de contorno quase estático para calcular onde e como trincas se abrem; aproximações aceleram o solver e
  o resultado se acopla a um solver de corpo rígido padrão.
- Mapeia: (b) realismo alto; (a) não ajuda (é mais caro, não mais barato que o nosso corte).
- Custo: alto. Cabe: não em tempo real no browser; só como gerador offline de padrões de referência.

### 1.4 Parker e O'Brien: deformação e fratura em jogo
- Título exato: *Real-Time Deformation and Fracture in a Game Environment*. Eric G. Parker, James F. O'Brien. ACM SIGGRAPH/Eurographics
  Symposium on Computer Animation (SCA) 2009, pp. 165-175. DOI 10.1145/1599470.1599492. Usado em *Star Wars: The Force Unleashed* (Pixelux, motor DMM).
- Links: https://diglib.eg.org/handle/10.2312/14973 · PDF https://escholarship.org/content/qt2kj9p4bw/qt2kj9p4bw.pdf
- Ideia: elementos finitos corrotacionais em tetraedros, estáveis com a entrada imprevisível do jogador, com controle artístico,
  paralelizados no Xbox 360, PS3 e PC.
- Mapeia: (b) e (f) como referência de produção; para nós é inspiração, não código.
- Custo: alto (FEM com remalhagem). Cabe: não com o orçamento de ~16 ms em uma thread para uma casa inteira; muita parte do
  ganho de desempenho do artigo vinha de paralelismo (descrito no resumo).

### 1.5 Su, Schroeder, Fedkiw: estabilidade de energia
- Título exato: *Energy Stability and Fracture for Frame Rate Rigid Body Simulations*. SCA 2009, pp. 155-164. DOI 10.1145/1599470.1599491.
  Jonathan Su, Craig Schroeder, Ronald Fedkiw.
- Link: https://www.cs.ucr.edu/~craigs/papers/2009-energy/paper.pdf · https://diglib.eg.org/handle/10.2312/14972
- Ideia: com passo no ritmo do quadro, corpos mal condicionados e girando rápido ganharam energia por mais de uma ordem de magnitude num passo.
  Propõem (1) avançar a orientação conservando energia e momento e (2) limitar o ganho de energia em contatos e colisões.
  Também trazem um método de fratura com pré-pontuação centrada na colisão (detalhes não lidos).
- Mapeia: (d) direto, é o nosso sintoma (peças ganhando energia). Dá a justificativa para medir energia por passo como teste.
- Custo: médio (a correção de colisão exige mexer no solver; no Jolt só dá para aproximar por parâmetros e substeps). Cabe: sim.

### 1.6 Sumner, O'Brien, Hodgins: areia, lama e neve
- Título exato: *Animating Sand, Mud, and Snow*. Computer Graphics Forum 18(1), pp. 17-26, 1999 (versão anterior em Graphics Interface 1998).
  Robert W. Sumner, James F. O'Brien, Jessica K. Hodgins.
- Links: https://diglib.eg.org/items/a18f4810-e22f-4f61-971f-e33e29d70ee0 · PDF https://escholarship.org/content/qt9c74f83h/qt9c74f83h.pdf
- Ideia: o chão é um campo de alturas; um objeto que afunda desloca o material, que se acumula em volta (borda de pegada, de roda),
  com compactação por tipo de solo.
- Mapeia: (e) direto. A crateira vira "tirar volume no centro e depositar numa borda", com ângulo de repouso por camada do solo.
- Custo: baixo (operação sobre a grade que já temos, antes do `SetHeights`). Cabe: sim.

## 2. Palestras

| Palestra | Estado | Link | O que serve |
|---|---|---|---|
| Jorrit Rouwe, *Architecting Jolt Physics for Horizon Forbidden West*, GDC 2022 | confirmada | https://www.guerrilla-games.com/read/architecting-jolt-physics-for-horizon-forbidden-west · vídeo https://gdcvault.com/play/1027891/Architecting-Jolt-Physics-for-Horizon · slides (.pptx) https://d3d3g8mu99pzk9.cloudfront.net/JorritRouwe/ArchitectingJoltForHFW.pptx | Foca em broadphase sem lock e construção de ilhas de simulação sem lock. Não trata de CCD nem de empilhamento (a página não menciona). Útil para o futuro com Workers (ilhas). |
| Erin Catto, *Continuous Collision*, GDC 2013 | confirmada | https://box2d.org/files/ErinCatto_ContinuousCollision_GDC2013.pdf | (c): CCD por tempo de impacto e por que ele custa; conceitos valem para o LinearCast do Jolt (conteúdo não lido em detalhe). |
| Erin Catto, *Understanding Constraints*, GDC 2014 | confirmada | https://box2d.org/files/ErinCatto_UnderstandingConstraints_GDC2014.pdf | (d): solver de restrições, estabilidade. |
| Erin Catto, *Soft Constraints*, GDC 2011 | confirmada | https://box2d.org/files/ErinCatto_SoftConstraints_GDC2011.pdf | (d): restrições macias por frequência e amortecimento. |
| Erin Catto, "Numerical Methods", GDC 2015 | **não confirmado** | (não achei) | Não citar. |
| Erin Catto, post *Solver2D*, 5/2/2024 | confirmado | https://box2d.org/posts/2024/02/solver2d/ · release https://box2d.org/posts/2024/08/releasing-box2d-3.0 | (d): "Soft Step" = sub-passos + restrições macias + relaxamento; o relaxamento tira o excesso de energia de Baumgarte e das restrições macias. Não dá resultado numérico de empilhamento no texto. |
| DICE/Frostbite, palestra de destruição na GDC | **não confirmado** | (não achei uma palestra de GDC só sobre destruição) | Achei: Kihl, *Destruction Masking in Frostbite 2 using Volume Distance Fields* (SIGGRAPH 2010) https://www.slideshare.net/DICEStudio/siggraph10-arrdestruction-maskinginfrostbite2 (máscara de destruição na renderização, pouco útil para física) e a nota da EA sobre destruição por peças no Battlefield 6 https://www.ea.com/ea-studios/ea-sports/news/how-battlefield-6-redefined-destruction (texto de imprensa, pouco técnico). |

## 3. Trabalhos mais novos (2018 a 2026)

### 3.1 CoACD: decomposição convexa consciente da colisão
- *Approximate Convex Decomposition for 3D Meshes with Collision-Aware Concavity and Tree Search*. Xinyue Wei, Minghua Liu, Zhan Ling, Hao Su.
  ACM TOG 41(4), SIGGRAPH 2022. https://arxiv.org/abs/2205.02961 · código (MIT) https://github.com/SarahWeiii/CoACD
- Ideia: métrica de concavidade que olha a colisão, não só o volume, e busca em árvore de planos de corte. Menos convexos que o V-HACD
  para a mesma fidelidade (afirmação dos autores).
- Mapeia: (a) e (c): menos formas por peça fina e hulls convexos em vez de caixas ajustadas por triângulo; compound com menos filhos
  é mais barato no LinearCast (inferência nossa, medir). Custo: médio, e só offline (o `fitOrientedBoxes` em runtime não é substituído; os
  convexos viriam pré-calculados por tipo de peça). Cabe: runtime sim; a decomposição, não (é pesada).

### 3.2 V-HACD
- Khaled Mamou e Faouzi Ghorbel, *Volumetric Hierarchical Approximate Convex Decomposition* (as fontes confirmam só este nome e os autores; venue e ano **não confirmado**). Código: https://github.com/kmammou/v-hacd
- Ideia: voxeliza e escolhe planos de corte minimizando uma energia. Mais antigo e geralmente mais pesado que o CoACD.
- Mapeia: (a), (c), como alternativa mais simples ao CoACD. Custo: baixo a médio, offline.

### 3.3 Small Steps (substeps com XPBD)
- *Small Steps in Physics Simulation*. Macklin, Storey, Lu, Terdiman, Chentanez, Jeschke, Müller. SCA 2019. DOI 10.1145/3309486.3340247.
  https://diglib.eg.org/handle/10.1145/3309486-3340247
- Ideia: n passos pequenos com uma iteração valem mais que um passo grande com n iterações: menos erro de restrição e menos
  amortecimento artificial, e robusto a mau condicionamento.
- Mapeia: (d) direto. No Jolt isso vira mais `collisionSteps` com menos iterações de velocidade; testar (custo cresce com o número de passos). Custo: baixo (parâmetro de `Step`). Cabe: sim, se o orçamento aguentar.

### 3.4 XPBD para corpos rígidos
- *Detailed Rigid Body Simulation with Extended Position Based Dynamics*. Müller, Macklin, Chentanez, Jeschke, Kim.
  Computer Graphics Forum 39(8), pp. 101-112, SCA 2020. DOI 10.1111/cgf.14105. https://diglib.eg.org/handle/10.1111/cgf14105
- Ideia: integração quase explícita incondicionalmente estável, menos restrições, rastreia objetos rápidos contra geometria curva.
- Mapeia: (c) e (d) conceitualmente. Custo: alto (outro solver, fora do Jolt). Serve de referência, não de ação.

### 3.5 Estrutura e colapso de prédio (f)
- Não achei um artigo clássico de "integridade estrutural em tempo real para jogos". O que existe:
  - *BrickSim* (arXiv 2603.16853, 2026): simulador em tempo real de peças de encaixe, com grafo de conectividade ligado ao motor de física,
    colapso e quebra; ~5 ms de solução média nos testes deles. https://arxiv.org/abs/2603.16853 (título completo e venue **não confirmado**; li só o resumo da busca).
  - Texto de desenvolvedor sobre grafo de conexões e ilhas por busca em grafo, com divisão do trabalho em vários quadros:
    https://riordan-dc.github.io/gamedevelopment/2023/03/17/Real-Time-Destruction.html (blog, não é revisado por pares).
- Ideia: manter o grafo peça-peça (já temos a casa feita de peças reais), propagar suporte a partir do chão e soltar só o que perdeu
  caminho de carga, em vez de dividir a casa inteira.
- Mapeia: (f) e (a): só as peças que realmente soltam entram no split. Custo: médio (o `game-floorplan-structure` já tem caminho de carga). Cabe: sim, é busca em grafo; dá para fatiar por quadro.

### 3.6 Terreno deformável (e)
- Cossetin Neto, Franzin, Pozzer, *Real-Time Craters Generation On Dynamic Terrains*, SBGames 2024. https://sol.sbc.org.br/index.php/sbgames/article/download/32332/32129
  (título e autores vêm da busca; **detalhes não confirmados**). Usa compute shader: **não cabe** na nossa restrição de GPU.
- Crause, Flower, Marais (UCT), deformação de terreno persistente em GPU. https://pubs.cs.uct.ac.za/id/eprint/740/1/p77-crause.pdf (título **não confirmado**; GPU, **não cabe**).
- Wan e Tang, *Explosive Impact on Real-time* (2002), capítulo de livro, DOI 10.1007/978-1-4471-0103-1_16 (venue exato **não confirmado**): modelo de resistência e dano do terreno sob onda de choque.
- Rami e Proctor, cratera e fragmentação de terreno, *Simulation*, 2007 (título exato **não confirmado**). Validado contra explosão real em camadas.
- Mapeia: (e). São referências para a forma da cratera (profundidade, borda, camadas); nenhuma resolve o custo do `SetHeights`.

### 3.7 Voronoi dinâmico em voxels
- Domaradzki e Martyn, fraturar objetos em octree de voxels esparsos com padrões Voronoi dinâmicos (repositório da Univ. da Boêmia Ocidental,
  ano **não confirmado**). https://dspace.zcu.cz/bitstream/11025/34619/1/Domaradzki.pdf. Mapeia (b); baixa relevância (trabalho de graduação, não artigo).

## 4. Tabela resumo

| Referência | (a) | (b) | (c) | (d) | (e) | (f) | Custo | Cabe |
|---|---|---|---|---|---|---|---|---|
| Müller 2013 (VACD) | sim | sim | indireto | | | | médio | sim |
| Breaking Good 2023 | indireto | sim | | | | | alto (baixo só a ideia) | runtime sim, offline não |
| Hahn 2016 | | sim | | | | | alto | não |
| Parker 2009 | | sim | | | | sim | alto | não |
| Su 2009 | | | | sim | | | médio | sim |
| Sumner 1999 | | | | | sim | | baixo | sim |
| CoACD 2022 | sim | | sim | | | | médio (offline) | runtime sim |
| Small Steps 2019 | | | | sim | | | baixo | sim |
| Catto, Solver2D / Soft Step | | | | sim | | | baixo a médio | sim (conceito) |
| Grafo de conectividade (3.5) | sim | | | | | sim | médio | sim |

## 5. Três coisas para tentar primeiro

1. **Grafo de conectividade para escolher o que solta (3.5 + Müller 2013 só nas peças soltas).** Ataca o custo de 57 a 66 ms de frente: se só entram no split as peças que perderam suporte, o `fitOrientedBoxes` roda sobre muito menos triângulos, e o dado de estrutura já existe.
2. **Pré-calcular os convexos ou caixas por tipo de peça offline (CoACD ou V-HACD) e reusar no split.** Tira o ajuste por triângulo do quadro da explosão e, com menos formas filhas por peça fina, deve baratear o LinearCast; medir antes e depois com o mesmo cenário B5/B6.
3. **Substeps no estilo Small Steps / Soft Step com métrica de energia (Su 2009 como critério de teste).** É só parâmetro do Jolt, barato de testar, e dá um número (energia cinética por passo de uma pilha parada) para decidir sobre o ganho de energia das peças.

(Sumner 1999 fica como quarta opção barata para as crateras: deslocar volume para a borda antes do `SetHeights`.)
