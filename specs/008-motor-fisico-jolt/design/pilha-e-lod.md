# Spec 008 · T5.3 — Regra da pilha e LOD do corpo

Desenho da T5.3 (🧠, `opus`). v1 em 2026-11-25, reprovada pelo `architect` no mesmo dia (12 mudanças). Esta é a **v2**, com as 12 aplicadas.
Herdado por T5.4 (implementar), T5.5 (quadrúpede) e T7.1 (multidão).

**D-T5.3a decidida pelo dono em 2026-11-26: opção A** (`corpses.relocate`; §4). O aceite da T7.1 muda com ela.

## 1. O problema e o que está medido

| Medida | Valor | Fonte e ressalva |
|---|---|---|
| Ragdoll completo (17 segmentos) com `stabilize`, 20/8 | dorme a 3,12 s; 2 quadros acima de 0,1 rad | gate 0 B3 |
| 20 ragdolls caindo e empilhando | 2,8 ms mediana, 3,3 **p90** | `ragdoll.test.ts:87`: corpos e juntas soltos, sem `stabilize`, 60 Hz, **sem `expect`**. Não é o R0 de produção nem o `KIT_WORLD` |
| 100 corpos de 3 partes (`createRagdoll`, `stabilize`) | 2,2 / 2,6 ms; dormem a 9,47 s com sono 0,08 | **Mundo de 60 Hz, valor antigo**: `crowd.test.ts:54`: `fixedStep 1/60`, iterações padrão do Jolt. **Não** é o `KIT_WORLD` (120 Hz, 32/2, `contract.ts:272`) |
| 100 corpos de 3 partes no `KIT_WORLD`, nascendo em sequência (1 a cada 3 quadros) | limites: ≤ 6 / ≤ 10 ms, dormem em ≤ 14 s (decisão do dono 2026-11-26: o limite anterior foi medido a 60 Hz com iterações padrão) | medido na T5.4, `evidence.md` |
| Pilha de ragdolls inteiros (horda) | não dorme | `tasks.md:165` (T5.3); não é medição da spec |

Conclusão que não depende dos números: ragdoll completo cabe em poucos corpos perto do jogador; uma pilha de horda nunca cabe.
**Todos os números de cota abaixo são provisórios** até a T5.4 medi-los no `KIT_WORLD` com o código de produção (§7).

## 2. Cinco degraus por corpo

Todo corpo morto (pessoa, zumbi ou bicho) está em um degrau. O contrato conta **corpos rígidos**; o degrau diz quantos.

| Degrau | No motor | Corpos rígidos |
|---|---|---|
| **R0 ragdoll** | o ragdoll do rig, `stabilize`, `KIT_RAGDOLL_SOLVER` (20/8) | ~17 |
| **R1 corrente** | tronco, cabeça e pernas num `createRagdoll` com `stabilize` | 3 |
| **R2 cápsula** | uma cápsula dinâmica | 1 |
| **R2f congelado** | parte de um corpo **estático composto**, um por pilha, refeito em lote | 0 dinâmicos |
| **R3 sem corpo** | nada no motor; o desenho guarda a pose em que dormiu | 0 |

Todos os corpos de R0, R1 e R2 ficam na **camada nova `corpse`** (§5.2). Ela não colide com `agent`: a horda não empurra cadáveres. A
interação da horda com a pilha continua sendo o monte do `game-crowd`.

### 2.1 Regra da pilha

1. **Corpo em pilha nunca é R0.** Um corpo está em pilha quando encosta em ≥ 2 corpos mortos (`contactBodies`, §5.1) ou quando a célula do
   monte passa de `pileHeight` (padrão 2 × `corpseThickness` = 50 cm). Não uso `CLIMB_HEIGHT`: é constante privada do monte e mede outra coisa.
   Ao entrar numa pilha, um R0 vira R1 no mesmo passo fixo.
2. **Base da pilha congela.** Os corpos de uma pilha que dormem há ≥ 2 s e têm corpo por cima viram R2f: saem como corpos dinâmicos e entram
   no composto estático da pilha. Uma morte nova cai no composto e não acorda a base. Sem isso, cada morte sobre uma pilha de 100 acordaria
   ~300 corpos rígidos (`createRagdoll` sempre ativa, `joints.ts:166`), o pico da condição 10 a cada morte.
3. **Teto de corpos dinâmicos por ilha:** `islandBodiesMax`, provisório em 300 corpos rígidos (a cascata de 500 já passa da condição 10,
   `spec.md:106`). Acima dele, os mais antigos que dormem congelam (R2f) ou, longe, saem (R3).
4. Quem sustenta: se um R2f perde o que estava embaixo (corpo comido, expirado, despejado, chão escavado), o composto é refeito e o que estava
   em cima volta a ser dinâmico e cai (§12).

### 2.2 Degrau por distância

A distância é do **ponto de interesse amostrado no tique** (posição do jogador; o host pode passar mais de um), nunca da câmera, que anda
com o `dt` do quadro. Histerese para não piscar:

| Transição | Desce quando | Sobe quando |
|---|---|---|
| R0 → R1 | > 18 m, ou entrou em pilha, ou estourou a cota | não volta (ver abaixo) |
| R1 ↔ R2 | > 55 m e dormindo há ≥ 2 s | < 50 m e algo o acordou |
| R2 ↔ R3 | > 80 m dormindo, ou acima do teto | < 75 m; volta como R2 dormindo **onde o desenho o tem** |

18 m e 55 m são os degraus de LOD de cadáver que o renderer já usa (`game-crowd-three/src/data/render.json`), para física e desenho
trocarem no mesmo lugar. Todos os números são opções com padrão documentado (spec 008 D4), nunca constantes soltas.

**R1 nunca volta a R0**, exceto quando o jogador segura o corpo (Fase 4: segurar sobe a R0 com a pose da corrente e os braços na pose deitada
do rig). Trocar 3 corpos por 17 no quadro do tiro inventaria braços na frente do jogador. O tiro num R1 aplica o impulso no corpo da corrente
que o raio acerta.

### 2.3 Cotas (R0 medido na T5.1; o resto provisório, a medir na T5.4)

- `ragdollsMax` **1 R0** (medido, T5.1; decisão do dono em 2026-11-26, confirmada na T5.4: menos ragdolls completos, o resto em R1; a T5.6 otimiza o custo do R0 para 3 a 4 dentro do C7). É o maior N com 20 corpos mortos (N R0 + o resto R1 de 3 partes) dentro do C7 no `KIT_WORLD` (3,0 ms de mediana, 4,0 de p99, quadro de 1/60 s, 20/8, `stabilize`); N R0 sozinhos cabem até 3. Os 20 R0 do desenho davam 16,1 ms. Morte nova com a cota cheia rebaixa para R1 o R0 dormindo mais longe; se nenhum dorme, o novo nasce R1.
- `dynamicBodiesMax` 900 corpos rígidos (R0 + R1 + R2), com o teto por ilha do §2.1.3. Acima disso, o mais longe que dorme vai para R2f ou R3.
- Orçamento somado (escrever na T5.4): 20 R0 + uma pilha + 1 000 agentes + destroços no mesmo quadro, mediana e p99 contra o C7.

## 3. A troca de degrau

- **Trabalho de física, não de apresentação:** a troca é unidade de um `WorkKind` novo, `'lod'`, no `WorkBudget` de `game-physics`, e roda no
  passo fixo (regra §15: fila com relógio só para apresentação). Rebaixar por pilha, por cota ou por remoção entra no mesmo passo. Rebaixar por
  distância usa a cota de unidades. Assim os degraus não dependem da CPU.
- **Sem salto de pose:** o degrau novo nasce na pose do anterior. A cápsula e o tronco da corrente saem da pelve e do tronco; as pernas, da
  média das coxas; a cabeça, da cabeça. A velocidade do tronco vai junto. R2f → dinâmico nasce exatamente onde estava no composto.
- **Nada nasce dentro de nada (§12):** antes de criar, `overlapShape` (§5.1) contra `static`, `corpse`, `debris` e `prop`. Se sobrepõe, sobe
  o mínimo que separa (até 5 cm) ou a troca espera o próximo passo.
- **Ordem:** juntas antes dos corpos; o que sai passa pelo `release` (§8). O ragdoll pode nascer dormindo (`RagdollDesc.sleeping`, §5.1).
- **Prazo:** 100 trocas ≤ 5 ms (aceite da T5.4).

## 4. Uma verdade para a posição — D-T5.3a: **opção A, decidida pelo dono em 2026-11-26**

Hoje o monte do `game-crowd` é refeito a cada passo a partir de `x/z/yaw` do registro de cadáveres (`mound.ts:63-76`), que é só leitura. Um
corpo empurrado 3 m por um blast fica desenhado num lugar e com o monte em outro: a horda sobe um monte invisível. Isso já acontece em R0–R2,
não só em R3. Não há como ter as duas coisas por inteiro; uma delas cede.

| Opção | Ganha | Perde |
|---|---|---|
| **A (recomendada): `corpses.relocate(id, x, z, yaw)`.** Quando um corpo dorme a mais de uma célula da origem, o aplicador manda a posição para o `game-crowd` como evento estrutural dentro do tique (§15, `EVENT_CLASS`) | uma verdade só: monte, desenho e física concordam; R3 → R2 nasce onde está desenhado | o estado do `game-crowd` passa a depender da física quando há empurrão. **O aceite da T7.1 muda** de "`state-hash` e `team-golden` iguais" para "iguais quando nada empurra corpos" |
| B: o motor nunca escreve no `game-crowd` | o hash do `game-crowd` fica intocado em qualquer cena | monte errado depois de todo empurrão; um terceiro registro de poses no aplicador |

Decisão do dono: **A**. O aceite da T7.1 passa a ser "`state-hash` e `team-golden` do `game-crowd` iguais quando nada empurra corpos", e o teste 13 do §7 cobre o caso empurrado.

## 5. Contrato e onde mora cada peça

### 5.1 Contrato de `game-physics` (muda, ao contrário da v1)

| Acréscimo | Por quê |
|---|---|
| `overlapShape(shape, position, rotation, out, filter): number` | a `penetration` atual só olha `static` e exige corpo existente (`queries.ts:129`, `contract.ts:360`) |
| `contactBodies(id, out: BodyId[]): number` | `touching` é sim/não e `contacts` só traz o que fechou acima de 0,5 m/s; contato em repouso não aparece. O adaptador já guarda contatos por corpo (`world.ts:120`) |
| `RagdollDesc.sleeping?: boolean` | `createRagdoll` sempre ativa (`joints.ts:166`) |
| camada `corpse` em `LAYERS`/`LAYER_PAIRS`: colide com `static`, `debris`, `prop`, `character`, `vehicle` e `sensor`; **não** com `agent` | a horda escalando empurraria a pilha com massa infinita a cada passo |
| `WorkKind` `'lod'` no `WorkBudget` | §3 |

O adaptador implementa os cinco em `game-physics-jolt`. Nada de Jolt fora dele.

### 5.2 Peças

| Peça | Pacote | Nota |
|---|---|---|
| `ragdollOfRig(rig)` (R0) e `chainOfRig(rig)` (R1) | `game-characters` | **porte** de `game-physics-jolt/tests/scenes.ts:49-102` (`LIMITS`, `ragdollSpec`), não criação. O `describeBody` só tem juntas `fused`. O teste do Jolt passa a importar daqui, para o gate medir o código de produção. `game-characters` ganha dependência só de **tipos** de `game-physics` |
| Política `createBodyLod(options)`: entradas (distância, contatos, tempo dormindo, cotas) → degrau. Pura, sem motor | `game-physics` | já é onde moram `WakeQueue` e `WorkBudget`; serve a bicho sem que `game-animals` dependa de `game-characters` |
| **Um** aplicador: cria, troca, congela e remove pelo contrato | `game-physics`, no padrão de costura `engine-*.ts` (`SeamWorld \| PhysicsLoop`, `isPhysicsLoop`, `loop.ts:102`; modelo em `game-destruction-three/src/engine-pieces.ts`) | os pacotes `-three` só leem poses; três aplicadores seriam três cópias (§3) |
| R1 de quadrúpede (T5.5) | `game-animals`, a partir da pose de repouso pura | o esqueleto do bicho é three.js (`game-animals-three/src/context.ts:88`) |
| Identidade estável: `id` em `CorpseEntry` | `game-characters/src/corpses.ts` | o registro troca o removido pelo último e sobrescreve o mais velho quando cheio (`corpses.ts:34-56`); sem `id` o corpo físico perde o dono. Comido, expirado ou despejado remove o corpo físico e acorda o que estava em cima |

### 5.3 Desenho

O `game-crowd-three` desenha cadáver como instância com pose fixa e `y: 0` (`instances.ts:292-295`): não há onde a pose de R0/R1 aparecer.
Decisão: **R0 e R1 perto são desenhados como corpo com esqueleto do `game-characters-three`**, que lê a pose do aplicador. A instância fica para
R2, R2f e R3, que ganham só posição, altura na pilha e uma rotação (canal novo por instância: y + quaternion). A troca de desenho acontece
nos mesmos 18 m da troca de degrau.

## 6. Determinismo

- A política é pura, roda no passo fixo, com a distância amostrada no tique e as trocas em unidades: mesma partida, mesmos degraus, a 60, 120
  e 144 Hz.
- C8 (salvar e carregar): o Jolt reaproveita o índice do corpo (`world.ts:117`) e o `restoreState` exige os mesmos corpos na mesma ordem
  (`contract.ts:375-381`). O estado salvo inclui o degrau de cada corpo e o composto de cada pilha; carregar recria nessa ordem.

## 7. Testes que a T5.4 tem de ter

1. 100 corpos caindo, **um a cada 3 quadros como no jogo**, contra uma parede no `KIT_WORLD`: nenhum R0 na pilha, dormem em ≤ 14 s, mediana ≤ 6 ms e p99 ≤ 10 ms (decisão do dono 2026-11-26; a versão anterior pedia 10 s e 2,5 / 4,0 ms, medidos a 60 Hz com iterações padrão e com os 100 sobrepostos no mesmo quadro). O sono e a ausência de R0 valem no CI; a mediana e o p99, na faixa de custo (§7.1).
2. 20 R0 de produção no `KIT_WORLD`, mediana e p99 com `expect` (substitui o número do spike).
3. **Horda andando sobre uma pilha dormindo: a pilha continua dormindo.**
4. **Morte nova sobre uma pilha dormindo de 100:** pico do quadro ≤ condição 10; a pilha volta a dormir em ≤ 3 s.
5. Troca de 100 corpos (R1 → R2 e de volta) ≤ 5 ms: sem sobreposição (`overlapShape`), nada abaixo do chão, tronco no mesmo lugar ± 2 cm.
6. **Corpo empurrado 3 m, desce a R3 e volta:** sem teleporte; com a opção A, o monte fica na célula nova.
7. **Comido, expirado ou despejado com corpo em cima:** o de cima cai e assenta (§12).
8. Cota: a 21ª morte perto rebaixa o R0 dormindo mais longe; com nenhum dormindo, nasce R1.
9. Histerese: um corpo indo e voltando a 18 ± 1 m troca no máximo uma vez por segundo.
10. **Mesmo hash de degraus a 60, 120 e 144 Hz.**
11. **Salvar e carregar depois de 200 trocas:** bit a bit igual (C8).
12. **Ciclos de troca devolvem o heap ao mesmo byte** (C9).
13. Opção A: posição do motor e célula do monte dentro de 1 célula depois de `relocate`. Opção B: o `state-hash` do `game-crowd` igual com a
    política ligada **numa cena com cadáveres** (o `tests/physics/state-hash.ts` atual não tem cadáveres; teste novo).

### 7.1 Onde cada limite de custo é cobrado (2026-11-26)

Limite em milissegundos reprova por carga da máquina; por isso (regra §9, `CONTRIBUTING.md`) **não** é cobrado no `pnpm test` do CI. Roda na faixa de custo: `pnpm --filter @adatechnology/game-physics-jolt test:cost` (`PHYSICS_COST=1` sob `flock perf-measure.lock`), à mão sob a trava (a rodada diária é GPU e navegador e não roda o motor sozinho; ligar a faixa nela fica como pendência). No CI ficam as contagens, o sono em segundos simulados, a ausência de sobreposição e de R0 na pilha.

## 8. Ordem de implementação da T5.4

1. Contrato e adaptador (§5.1), com testes no `game-physics-jolt`.
2. Porte de `ragdollOfRig`/`chainOfRig` para `game-characters` e a troca do import no teste do Jolt.
3. `id` estável no registro de cadáveres.
4. Política pura e aplicador, sem o `relocate`.
5. Medições do §1 refeitas no `KIT_WORLD`; as cotas do §2.3 deixam de ser provisórias.
6. `corpses.relocate` no `game-crowd` (D-T5.3a, opção A) e o teste 13.

## 9. O que fica fora

- Corpo que queima, derrete ou desmembra: T5.2 (`setShape`). A política só vê corpo e degrau.
- Arrastar corpo: Fase 4 usa o corpo no degrau em que está; segurar sobe a R0 (§2.2).

## 10. O que a T5.4 mudou no desenho (2026-11-26)

- `contactBodies` de corpo que **dorme** consulta a forma alargada em 1 cm: o Jolt solta os contatos de quem adormece, então a tabela de parceiros some com o sono (§5.1).
- R2f vale para qualquer corpo da pilha que dorme ≥ 2 s com corpo por cima, não só para a base; quem repousa em corpo que sai (comido, expirado, despejado, dinâmico ou congelado) volta a R1 por cascata (§2.1.4).
- A troca encolhe a forma 5 mm antes do `overlapShape` (o repouso afunda 2 mm; sem a folga todo corpo em repouso subia 5 mm a cada troca) e usa `QueryFilter.ignore` para não encontrar as próprias partes.
- Permanência de 1 s por degrau (`dwellSeconds`) além da histerese de distância.
- `onSettled` só avisa a partir de 2 m: o tombo do próprio corpo move o tronco até ~1,3 m; é o que mantém o `state-hash` do `game-crowd` igual quando nada empurra.
- Medido no `KIT_WORLD` (`evidence.md` `## T5.4`): corpo R1 acordado custa ~0,055 ms; o C7 de 100 correntes (2,5 ms) foi do passo de 60 Hz com iterações padrão e não vale no `KIT_WORLD`.
