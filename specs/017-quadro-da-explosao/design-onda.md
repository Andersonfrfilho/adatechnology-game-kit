# Spec 017 — a explosão como frente de onda (D5, opção b)

> Estado: **validada com mudanças** por `architect` e `engenheiro-estrutural` (2026-11-20), e **reprovada no critério de entrada do §6**:
> a velocidades físicas a frente de onda tira só 3 a 6 ms do quadro do impacto (§9). A Fase 5 não foi construída.
> Decisão D5 = (b), dada pelo dono em 2026-11-20 com a condição: protótipo medido primeiro; menos de 15 ms de ganho no quadro do
> impacto, não entra.

## 1. O que o protótipo mediu

Protótipo descartável (`spec/017-d5b-prototipo`, `4a60473bf`): o trabalho por peça do `blastPlain` repartido em 3 fatias de custo estimado
igual, a mais perto primeiro, uma por `world.update`. Régua em modo de prazo, 1x, três pares alternados desligado/ligado, carga 1,7–2,0,
rodadas com a página travada (quadros de 400–700 ms, nos dois lados) descartadas:

| | desligado | ligado | ganho |
|---|---|---|---|
| explosão, f0 | ~66 ms (66, 66, 60, 67, 61) | ~50 ms (50, 49, 44, 58, 53, 51, 44) | ~16 ms |
| cratera, f0 | ~62 ms (67, 66, 62, 66, 62, 58, 60, 59) | ~47 ms (47, 44, 44, 52, 52) | ~15 ms |
| f1 | ~21 ms | ~31 ms (um 37) | |

Distribuição medida na casa da sala (ms dentro de `blastPart`): a parede de tijolo encostada na carga custa 8–13 ms sozinha e não se divide;
as ~500 peças restantes somam 8–10 ms, mais ~7 ms dos eventos estruturais que produzem. Piso da abordagem: ~40 ms no f0. **A meta de 33,3 ms
não sai daqui** (D5 d, worker, continua sendo o caminho para ela).

O protótipo não serve como está: a divisão usa pesos de custo calibrados numa casa (`breach: 650`...), o resultado depende do número de
fatias, peça que muda de objeto entre fatias é pulada, `serialize()` perde as fatias pendentes, e ele se apoia na ordem em que a sala chama
`explode` e `update`.

## 2. O desenho: a frente de onda

**A explosão tem uma frente que avança a uma velocidade fixa; cada peça recebe a sua parte quando a frente chega nela.**

### 2.1 A frente

- `BlastOptions.waveSpeed` (m/s). Ausente ou `Infinity`: tudo no `explode`, bytes de hoje. É o padrão do kit.
- `BlastOptions.waveStart` (m): o raio resolvido dentro do próprio `explode`. O mundo não conhece "passo" (`explode` não recebe `dt`), então
  o primeiro anel é uma distância declarada, não "velocidade × passo".
- A frente é função do tempo do mundo: `frente(t) = waveStart + waveSpeed × (time − t0)`, com `t0 = time` no `explode`. Não há contador de
  tiques nem dependência de quem chama o quê primeiro: a sala chama `explode` antes do `world.update` do mesmo tique
  (`room.ts:4166-4170`), então esse `update` já avança a frente em `waveSpeed × dt`. O valor de `waveStart` e de `waveSpeed` sai da
  medição (§6) com isso em conta.
- No `update` em que `frente + 1e-9 ≥ raio`, a frente vale exatamente o raio e a onda acaba (erro de ponto flutuante do `time += dt`).
- O primeiro anel cobre sempre `max(waveStart, raio da bola de fogo)`: vazamento furado dentro da bola de fogo acende no tique T, como hoje
  (`lightLeaksNear`, `world.ts:5253`). Além disso `lightLeaksNear` roda de novo no fim de cada tique da onda, com a bola de fogo guardada.

### 2.2 Quem pertence à onda

- No `explode`, as peças candidatas (`blastCandidates` dos objetos no raio) entram num conjunto **por onda**: `Set<PartRuntime>` (`p.rt`).
  `PartRT` é recriada no `build` quando o objeto se parte (`world.ts:840`, `2740`); `p.rt` é levado por referência e sobrevive a `splitInto`
  e a `load` (mesmo padrão de `chainDue`, `world.ts:848`).
- A cada avanço: percorrer os objetos, ficar com as peças cujo `rt` está no conjunto e cuja distância atual é ≤ frente, chamar `blastPart`
  com ponto, energia, raio (já depois de `buriedTransmission`), carga e bola de fogo guardados no `explode`, e tirar do conjunto.
- Quem não era candidato em T não recebe nada: objeto criado, `reset` ou `loadObject` no meio da onda fica de fora, como hoje.
- Membro que saiu do raio não recebe (`blastPart` devolve `null` com `dist ≥ raio`). O conjunto é descartado quando a onda acaba; nada
  fica gravado em `rt` depois dela.
- Ondas simultâneas são o caso normal (`coneBlast` chama `explode` uma vez por objeto no mesmo tique): um conjunto por onda, independentes.
- Ordem dentro de um tique: distância, depois **id do objeto, depois id da peça** (comparação de string). Não usar `o.order` nem `o.idx`:
  mudam com `splitInto` e com `load`. Distância `NaN` vale `Infinity` (nunca atingida), tratada antes de ordenar.

### 2.3 O que fica no tique T

Pessoas, implementos, estilhaços da carcaça, clarão, som e empurrão (`renderer.explode`), como hoje (D1). O retorno de `explode` cobre só
o tique T; o resto sai como eventos nos tiques seguintes. Quem lê o retorno: `reached`/`n` no log de `act.explode`
(`explosives.ts:430, 442`), `withCollapses` (`world.ts:5653-5662`) e `game-floorplan-structure/tests/tower.test.ts:88`; todos seguem com a
onda desligada ou passam a ler eventos.

### 2.4 Uma frente só

Já existe uma frente para vidro: `blastFrontSpeed` e `frontQueue` (`world.ts:660-662`, `4661-4664`, `5642-5650`, `types.ts:554-557`,
`blast-front.test.ts`). Ela não entra no `serialize` e perde o dano se o objeto foi refeito. Com `waveSpeed` definido, o vidro é só mais
uma peça da onda e `blastFrontSpeed` é ignorado; sem `waveSpeed`, `blastFrontSpeed` segue como está. A precedência vai no README e no tipo.

### 2.5 Empurrão dos pedaços que nascem depois

`renderer.explode` empurra os pedaços que existem no tique T (`renderer.ts:3063-3115`). Parede quebrada em T+1 viraria pedaço sem
empurrão e cairia no lugar. No fim de cada tique da onda o mundo emite um evento estrutural `blast_front` (`{ point, energy, radius, from,
to }`, classe `structural` em `EVENT_CLASS`); o renderer empurra os pedaços nascidos das peças atingidas naquele anel.

### 2.6 Salvar no meio da onda

`DestructionSnapshot` ganha o campo opcional `waves` (`{ point, energy, radius, src, tntPerJoule, fireball, t0, members: [objectId,
partId][] }[]`), escrito só quando não está vazio: com a onda desligada os bytes não mudam e a versão do formato fica em 1. `load` refaz
os conjuntos a partir dos ids. Salvar não avança a onda. Nada no contexto da explosão simples é não serializável (`reachAt` só existe no
`blastScene`).

### 2.7 Fora da onda

Explosão em cadeia (`drainBlasts`) fica inteira no tique em que acontece; com a onda ligada ela pode acontecer antes de a onda de fora
terminar (hoje acontece depois), o que é determinístico e fica documentado. Explosões com abrigo, estilhaço dirigido ou confinamento
(`blastScene`) não usam a onda; a sala tem botões que ligam esses modos (`room.ts:2930-2932`) e registra no log quando a onda se desliga
por causa deles.

## 3. Estrutura e caminho de carga

Conferido no código pelas duas validações: `world.update` roda dentro de `run()` (`world.ts:6039-6041`) e o fechamento é o mesmo do
`explode` (`729-739`: `settleAllStructure` → `flushCollapse` → `settleAllStructure` → `revealHostedIn` → `emitDetaches`). Apoio destruído em
T faz o que ele carrega entrar em colapso em T, tenha a frente chegado ou não. **A frente de dentro para fora é a ordem fisicamente certa.**
A regra do `design-tiques.md` §5 vira invariante por tique:

- **I1.** No fim de cada tique da onda, toda peça estrutural não perdida tem caminho até uma âncora ou está em `o.collapsed`.
- **I2.** Todo grupo que entra em colapso num tique da onda é solto pelo renderer nesse mesmo tique: cada tique da onda é um "quadro do
  golpe" para os eventos estruturais; com onda pendente a separação não é adiada por prazo.

Três mudanças de resultado que a onda traz e como ficam:

1. **Peça em colapso recebe a onda como corpo solto.** `bendByBlast` só confere `p.span <= 0` (`world.ts:1204-1207`) e peça sem apoio
   guarda o vão de quando estava apoiada (`1380-1386`): atingida em T+1 ainda no objeto original, fletiria entre apoios que não existem; se
   já tivesse sido separada, não. O resultado dependeria de quando a separação aconteceu. Regra: peça em `o.collapsed` não flete entre
   apoios, separada ou não.
2. **Alvenaria que esfarela antes da frente.** Parede que perde o apoio em T esfarela em T (`world.ts:1906`) e `blastPart` devolve `null`
   para ela depois (`4600`): cai a prumo, sem o empurrão que hoje recebe antes de esfarelar. **Decisão:** os fragmentos dela recebem o
   empurrão do anel em que estariam, pelo `blast_front` do §2.5. Não fica implícito.
3. **Sobrecarga entre anéis.** `stepObject` (`world.ts:5521-5548`) roda sobre o estado intermediário: a viga que perdeu o pilar em T leva
   sobrecarga por 1–2 tiques e pode sortear trinca antes de a frente chegar. É físico; muda a ordem dos sorteios. Ordem fixa dentro do
   `update`: anel da onda, perda de solo, `stepObject`, `releaseFront`/cadeia.

## 4. Onde liga

- Kit: desligado por padrão. `RECORDED_BLAST_OUTCOME`, `exact-floorplan destruction/*`, `exact-golden destruction/*` **não mudam e não são
  regravados**.
- Uma constante só, exportada pelo pacote dono (`game-destruction`): `DEFAULT_BLAST_WAVE` (`{ waveSpeed, waveStart }`). `makeRoom` a usa
  como padrão, então os testes da sala rodam com a onda ligada. `game-kit-defaults` hoje não tem opção nenhuma de destruição: entra lá a
  mesma constante.
- O teste do fixture de 60 Hz (`step-equivalence.json`) passa `waveSpeed: Infinity` explícito e segue provando o caminho antigo, sem
  regravar. Um **fixture novo**, com a onda ligada, é gravado ao lado (arquivo novo).
- `step-equivalence-window.test.ts` roda nos dois modos.
- Régua: mudar o padrão da página muda a variante do portão no mesmo PR (§15); a base da rodada noturna é semeada de novo depois do merge.

## 5. Testes exigidos

`packages/game-destruction/tests/`, mundo sem renderer, passo de 1/60:

1. **Sem caminho.** Pilar a 1 m, viga só nele, além do primeiro anel. Fim de T: viga em `collapsed`, `collapse` em T. T+1: dano na viga uma
   vez, nenhum `collapse` novo.
2. **Com caminho alternativo.** Viga em dois pilares, um por anel. Fim de T: de pé, tensão do vão novo. Fim de T+1: em colapso.
3. **Invariante I1 por tique**, na casa da sala e na torre, até a onda acabar.
4. **Separação não muda o resultado.** Com `splitGroups` logo após T e sem: mesmas peças por grupo, mesmo `hp`, mesmos eventos.
5. **Uma vez só.** Cada membro recebe `blastPart` exatamente uma vez, com `splitGroups` entre os tiques; duas ondas no mesmo tique (cone) e
   em tiques seguidos com raios sobrepostos ficam independentes.
6. **Quem não era candidato fica de fora**: objeto adicionado, `reset` e `loadObject` no meio da onda.
7. **Alvenaria fora do anel**: parede superior sobre parede perto da carga; afirmar o comportamento do §3 item 2.
8. **Cratera.** `groundLoss` em T com onda pendente: sapata sem chão cai em T, sem `collapse` repetido.
9. **Vidro.** Com `waveSpeed` e `blastFrontSpeed` definidos, o dano cai num tique só e sobrevive ao `splitGroups` da casa.
10. **Salvar no meio.** `serialize` em T, `load`, avançar: mesmos bytes de quem não salvou. Com a onda desligada, `serialize` idêntico ao de
    hoje.
11. **Ordem das chamadas.** `explode` antes e depois do `update` do tique: mesma sequência de anéis medida em tempo do mundo.
12. **Vazamento.** Tanque furado por um anel posterior dentro da bola de fogo acende.

`game-destruction-three`: nenhum `broken_floating` em nenhum tique da onda; grupo colapsado em T+1 separado no quadro de T+1 (I2); pedaços
nascidos em T+1 recebem empurrão (§2.5). `game-test-room`: mesmos bytes a 30/60/120/144 Hz e com tempo de quadro aleatório, onda ligada.

## 6. Critério de entrada

Antes de construir: o protótipo com a regra do §2.1 (frente por tempo do mundo, `waveStart`, sem pesos), três pares alternados, máquina
quieta, varrendo 3 combinações plausíveis de `waveSpeed`/`waveStart` (som no ar: 343 m/s, 5,7 m por tique de 1/60 s).

- **C-a.** f0 cai pelo menos 15 ms nas duas explosões.
- **C-b.** Nenhum quadro seguinte passa de 33,3 ms na mediana.
- **C-c.** A soma dos quadros da janela (f0 até a onda acabar) não passa de 110% da soma com a onda desligada: o trabalho por tique que
  depende do objeto (`settleAllStructure`, `rebuildHost`, `splitLoose`, colisor estático) é pago uma vez por anel.

Passou nos três: construir. Falhou em C-a: registrar, apagar a branch do protótipo, fechar a D5 como (a). Passou em C-a e falhou em C-b ou
C-c: parar e levar os números ao dono.

## 7. Riscos que ficam

- **Atraso visível:** a parede de fora cai 17–50 ms depois do clarão. Conferir na sala em primeira e terceira pessoa (§5 das regras).
- **Quem está atrás de uma parede condenada** fica abrigado por ela 1–2 tiques a mais; pessoas e implementos são resolvidos em T.
- **Piso de ~40 ms:** a peça cara perto da carga continua inteira no f0.
- **Custo total maior** (C-c): repartir não é de graça.

## 8. De onde veio cada mudança (validações de 2026-11-20)

| Mudança | Quem apontou |
|---|---|
| Frente por tempo do mundo e `waveStart` (o `explode` não conhece o passo; a sala pagaria dois anéis no f0) | os dois |
| Conjunto por onda em `p.rt`, não marca em `PartRT`; identidade da onda; quem não era candidato fica de fora | os dois |
| Absorver `blastFrontSpeed`/`frontQueue` | os dois |
| Desempate por id de objeto e de peça; `NaN` como `Infinity` | architect |
| Evento `blast_front` para o empurrão dos pedaços dos anéis seguintes | architect |
| `lightLeaksNear` por anel e primeiro anel cobrindo a bola de fogo | os dois |
| Peça em colapso não flete entre apoios; alvenaria esfarelada antes da frente; ordem dentro do `update` | engenheiro-estrutural |
| Campo `waves` no snapshot sem subir a versão | architect |
| Critérios C-b e C-c; constante única ligada no `makeRoom` | architect |
| Invariantes I1 e I2 e a lista de testes | engenheiro-estrutural |

## 9. Resultado do critério de entrada (T5.0, 2026-11-20)

Protótipo `08f2015c8` (`spec/017-d5b-prototipo`), regra do §2.1, `waveStart` 0 (primeiro anel = bola de fogo, ~1 m). Pares alternados,
modo de prazo, 1x, carga 1,8–2,0 no começo; rodadas com quadro acima de 300 ms descartadas. Processador entre 90 e 100 °C durante a série.

| Velocidade | f0 explosão | f0 cratera | contra o par desligado anterior | f1 | soma da janela |
|---|---|---|---|---|---|
| desligado (3 rodadas) | 64,2 / 63,5 / 67,1 | 66,7 / 63,6 / 70,8 | | ~20,5 | |
| 520 m/s | 60,6 | 63,0 | −3,6 / −3,7 | 22,1 / 21,3 | a onda acaba no f0 |
| 343 m/s (som) | 57,1 | 60,7 (uma rodada) | −6,4 / −2,9 | 26,0 / 27,6 | 103% / 105% |
| 255 m/s (abaixo do som) | 51,0 | 53,7 | −16,1 / −17,1 (−14 / −13 contra a média dos desligados) | 27,6 / 25,9 | 87% / 87% |

- **C-a falha** nas velocidades físicas. **C-b e C-c passam** em todas.
- **Por quê:** o quadro da régua (e a meta de 33,3 ms) é um quadro de 1/30 s, que roda **dois** `world.update` de 1/60 s. A 343 m/s a frente
  anda 11,4 m por quadro; a casa vai até 18 m, e ~87% das peças de longe caem no próprio f0. E o que sobra para mover é pouco: fora do
  primeiro anel (13–15 peças, 10–17 ms, quase tudo a parede encostada na carga), as outras ~505 peças somam 8–10 ms mais os eventos delas.
- O protótipo por pesos tirou ~15 ms porque empurrava as ~500 peças de longe para o quadro seguinte **sem olhar a distância**. A regra
  mínima que reproduz isso sem pesos é "primeiro anel no tique T, todo o resto no quadro seguinte": determinística e independente da cena,
  mas não é uma onda; é um adiamento fixo justificado só por desempenho.

**Leitura:** a divisão da explosão compra ~15 ms só com uma regra não física (adiamento fixo ou onda mais lenta que o som), leva o f0 a
~50 ms (não a 33,3) e custa a Fase 5 inteira (§2.2 a §2.6, §3 e os testes do §5, que valem para qualquer regra de divisão). O desenho e as
validações deste documento ficam como entrada para uma spec de worker (D5 d), onde a mesma divisão por tempo do mundo volta a ser necessária.
