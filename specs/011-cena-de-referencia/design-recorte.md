# T2.1 — Formato do recorte e o recorte 1

Status: **proposta (2026-11-24), revisada contra o código pelo architect** (tipos de distrito, linhas que nada desenha, interiores e
estados); segunda revisão antes da T2.2. Decisões de origem: D2 (o traçado é dado), N1 (o recorte inteiro
com `missing`), N2 (lotes da rua do roteiro), N11 (cenário `caos`), §1 do `CLAUDE.md` (SDK primeiro).

## 1. Não inventar formato: o recorte é um plano de cidade do `game-urban` mais uma camada da cena

O `game-urban` já tem o formato de plano de cidade como dado (`CityPlanDef`, `packages/game-urban/src/cities/types.ts`): `districts` com
`kind` e `rect` em metros (x leste, z sul, o último que contém o ponto vence), `lines` (`avenue`, `street`, `river`...) e `landmarks`, com
`packs.cityPlans` e `extends` para um jogo trazer o seu. O recorte usa esse formato como está. O que o plano não tem e a cena precisa vai numa
segunda camada, do exemplo, não do kit:

| Camada | Onde mora | O que tem |
|---|---|---|
| `plan` | `CityPlanInput` do `game-urban`, registrado por `packs.cityPlans` | distritos de tipo `mixed` (centro) e `residential_popular` (bairro), ruas, rio, marcos |
| `site` | tipo do exemplo (`examples/reference-district/src/game/site.ts`) | lotes com tipologia e semente, peças soltas (barricada, carros), zonas de horda, marcadores `missing` |
| `scripts` | tipo do teste (`examples/reference-district/src/test/scripts.ts`) | os roteiros da §4 da spec: fases nomeadas, eventos com tempo de mundo, caminho do jogador |

A separação segue a D7: `plan` e `site` são escolha de jogo (`src/game/`), `scripts` só servem para medir (`src/test/`). Os três são JSON
(`data/recorte-1.plan.json`, `data/recorte-1.site.json`, `data/recorte-1.scripts.json`) lidos e checados por funções tipadas (sem `any`,
erro com o caminho do campo), para o teste de cobertura sem GPU (T2.3) ler o mesmo arquivo que a página.

## 2. `site`: o que vai em cada lugar

```ts
type Site = {
  readonly plan: string                        // id do plano do game-urban
  readonly seed: number                        // semente do recorte; cada coisa deriva a sua (hash da semente com o id)
  readonly lots: readonly Lot[]
  readonly props: readonly Prop[]              // o que é solto: barricada, sacos, carros parados
  readonly hordes: readonly HordeZone[]
  readonly missing: readonly Missing[]
}
type Lot = {
  readonly id: string
  readonly rect: PlanRect                      // o lote em metros; a frente é o lado da rua (`front`)
  readonly front: 'n' | 's' | 'e' | 'w'
  readonly typology: string                    // id de um motor de planta (budget_slab_house, pharmacy...); o pacote dono resolve
  readonly zone?: string                       // zona do lote quando difere da do distrito (a farmácia no bairro é `zc`); passa pela checagem de zoneamento
  readonly state?: 'none' | 'fortified' | 'abandoned' | 'draw'     // `none` = sem plugin de estado; `draw` sorteia 35/45/20 pela semente (N2)
  readonly enterable?: 'lod' | 'never'         // N10: `lod` = enterável quando o LOD de casa (`planLod`) chega perto
}
type Prop = { readonly id: string; readonly kind: 'vehicle' | 'prop'; readonly ref: string; readonly at: PlanPoint; readonly ry?: number; readonly y?: number }
type HordeZone = { readonly id: string; readonly rect: PlanRect; readonly share: number; readonly profile: 'runner' | 'walker' }
type Missing = {
  readonly id: string
  readonly what: string                        // ponte, prédio de 6 a 8 andares, semáforo...
  readonly owner: readonly string[]            // pacotes donos (kit_owner); a ponte tem dois (estrutura e traçado)
  readonly task: string                        // T3.x que a troca
  readonly rect: PlanRect
  readonly height: number                      // altura da caixa de aviso
}
```

- **Nenhuma peça tem geometria aqui.** `typology` é resolvida pelo motor da planta do pacote dono, `ref` de veículo pela frota
  (`createVehicleKit` + `installFleet`) e de prop pelo `game-props3d`; zona de horda vira pedido ao `game-crowd`. Ref desconhecido é erro de
  carga com o caminho do campo, não silêncio.
- **`missing` é desenhado como caixa de aviso**: caixa de arame na `rect` com a `height`, cor de aviso, e a etiqueta com `what`, `owner` e
  `task`. A caixa é do exemplo (`src/game/missing.ts`), não de pacote, porque é ferramenta de construção da cena e some quando a lista
  esvazia. Ela não colide e não entra na física (§12: nada invisível colide; a caixa é visível e não colide). O `kit_audit` lê o código-fonte e
  marca primitiva do three.js (`tools/kit-audit/audit.mjs`): o `missing.ts` entra no `allowlist.json` com o motivo ("caixa de aviso da peça
  que falta; some quando a lista `missing` esvazia"), e o R3 passa a dizer: nenhuma peça de origem `scene` fora dessa entrada, e cada caixa
  ligada a uma entrada `missing` com dono e task.
- **Troca de `missing` por peça**: quando a T3.x fecha na sala da área dela (D6), sai a entrada de `missing` e entra o lote, a linha ou o prop
  correspondente. O teste da T2.3 falha se uma entrada de `missing` aponta para um `owner` que não está em `packages/`.

## 3. `scripts`: os roteiros como dado

```ts
type Script = {
  readonly id: 'street' | 'crossing'           // §4.1 e §4.2 da spec
  readonly scenarios: readonly ('tipico' | 'pior' | 'caos')[]
  readonly seed: number
  readonly camera: readonly CameraCue[]        // { at: segundos de mundo, mode: 'shoulder' | 'first' | 'vehicle' }; nunca vista de cima
  readonly path: readonly PathPoint[]          // caminho do jogador { at, x, z }
  readonly phases: readonly { readonly id: string; readonly from: number; readonly to: number }[]
  readonly events: readonly ScriptEvent[]      // { at, kind, ... } em segundos de mundo, passo fixo
}
```

`kind` de evento é uma lista fechada, cada um com o pacote que o executa: `shoot` (`game-weapons`, arma e alvo), `throw` (`throwableUse`,
explosivo e ponto), `detonate` (C4), `fire_line` (fogo no chão, `game-terrain`/`game-vfx`, pontos), `horde_release` (zona e quantos),
`vehicle_drive` (veículo, caminho, velocidade), `door` e `open_container`. Enquanto a ação do jogador está na sala, o executor do roteiro chama
o SDK direto (N5); evento cujo pacote ainda não tem a ligação (L15 a L17) fica marcado `pending` no roteiro e a fase grava "pendente" na
régua, em vez de sumir.

Os cenários mudam só o que a §5 da spec diz: `tipico` 500 zumbis de dia nublado, `pior` 2.000 com chuva à noite, `caos` o roteiro do
cruzamento. Esses números ficam no `scripts`, não no `site`.

## 4. O recorte 1 (400 × 250 m)

Centro do mapa em (0, 0); x de −220 a 225 (oeste → leste), z de −135 a 135 (norte → sul), uns 445 × 270 m. O rio corre de norte a sul em
x ≈ −20. **Os retângulos dos distritos são escolhidos para as bordas dos quarteirões do `game-urban` caírem nas ruas** (`layout.blocks`
centra quarteirões inteiros no retângulo, `cities.ts` 130–140):

| Distrito | Tipo | `rect` | Quarteirão | Bordas em x | Bordas em z |
|---|---|---|---|---|---|
| centro | `mixed` | [−220, −120, −40, 120] | 60 m | −220, −160, −100, −40 | −120, −60, **0**, 60, 120 |
| bairro | `residential_popular` | [0, −135, 225, 135] | 45 m | 0, 45, 90, 135, 180, 225 | −135, −90, −45, **0**, 45, 90, 135 |

A rua principal z = 0 é borda dos dois; o cruzamento do `caos` é (−100, 0). O teste da T2.1 confere que a rua do roteiro e o cruzamento
estão sobre bordas de quarteirão.

| Faixa | x (m) | Distrito | Conteúdo |
|---|---|---|---|
| Borda do centro | −220 a −40 | tipo `mixed` (zona `zr3_zm`, padrão `downtown`, 2 a 8 andares) | 3 × 4 quarteirões de 60 m; o cruzamento do `caos` em (−100, 0); quarteirão de sobrados com loja (missing T3.2), prédio de 6 a 8 andares (missing T3.1, que faz a tipologia de 4 a 8), farmácia e mercado (modelos `pharmacy`, `market`), delegacia e igreja (`police_station` e `church`, que vêm dos `interiorModules` do `game-floorplan-commercial`, ids em `interiorTemplateIds`), barricada com viatura e ambulância no cruzamento, semáforo e faixa (missing T3.9) |
| Rio e ponte | −40 a 0 | — | linha `river` de 30 m de largura no plano (dado; **nada desenha linha de plano hoje**, ver abaixo), água pelo terreno (missing T3.4 até haver correnteza); ponte de concreto na rua principal z = 0 (missing T3.3); mata de margem (missing T3.10); margem de solo solto com cratera |
| Bairro popular | 0 a 225 | tipo `residential_popular` (zona `zr2`, padrão `working_class`, 1 a 3 andares, quarteirão de 45 m) | a **rua do roteiro** em z = 0, de x = 20 a x = 140, com os 10 lotes da N2 (5 de cada lado, 12 × 25 m); viela (missing T3.5), bar (missing T3.6), galinheiro (missing T3.8), laje com vergalhão (missing T3.7), bilhete com história (missing T3.11) |

Os 10 lotes da rua (N2): lado norte (z −30 a −5) e sul (z 5 a 30), frente para a rua; tipologias na ordem de x crescente, norte
`budget_slab_house`, `budget_slab_house`, `pharmacy`, `budget_semi_detached`, `budget_slab_house`; sul `budget_slab_house`, `townhouse`,
`budget_slab_house`, `budget_semi_detached`, `budget_slab_house`. A casa em que se entra é o 3º lote do sul (`budget_slab_house`, estado
`none` fixo). Os demais `draw`. Lote de 12 × 25 m cabe na zona do bairro (`zr2` pede 180 m² e 6 m de frente; a `budget_slab_house` já supõe 25 m de
fundo). A `zr2` não aceita uso comercial (`game-floorplan/src/zoning.ts`): a farmácia leva `zone: 'zc'` (150 m², 6 m de frente), e o teste da
T2.1 passa cada lote pela checagem de zoneamento sem violação. O tipo `downtown` **não** serve: é zona `zt` (1.000 m², 30 m de frente),
20 a 60 andares e quarteirão de 90 m.

As peças que faltam têm uma entrada `missing` cada (mesmo quando duas dividem a task, como a mata de margem e o peixe e a garça na T3.10),
com os donos do `plan.md` e a task da Fase 3. O sobrado misto fica com o `game-floorplan-commercial` (as zonas `mixed` e a loja no térreo;
a T3.2 confirma pelo `kit_owner`). Lista: ponte, rio, prédio de 4 a 8 andares, sobrado
misto, viela, bar, vergalhão exposto, galinheiro, cone/cavalete/fita, semáforo/faixa/meio-fio, mata de margem, peixe e garça, bilhete, e o desenho das linhas do plano (T3.13). O
visual nublado (Fase 4) e o host não são lugar e ficam fora da lista de caixas.

**Linhas do plano: o desenho das ruas e do rio não existe.** `PlanLine` é dado que o `game-urban` devolve e nada desenha (README: "Plans are
data"). A rua do roteiro e as do centro são desenhadas pelo montador da T2.2 com o que existe (`streets.road`, `walk` do `game-urban` e as
zonas de superfície do `game-terrain`), a partir das linhas do plano. Desenhar as linhas de um plano no próprio `game-urban` (`lines` →
`road`/`walk`, rio → zona de água do terreno) é a peça 15 da lista, dono `game-urban`, task nova **T3.13**, e até ela o montador faz a
tradução com as funções públicas, sem desenho à mão.

## 5. O que esta task entrega e o que fica para a T2.2

- **T2.1 (esta):** os tipos de `site` e `scripts` com o validador e seus testes (sem GPU); os três JSON do recorte 1; o plano registrado no
  `game-urban` por `packs.cityPlans`; teste que lê o recorte e confere: todo `typology` existe num motor registrado, todo `ref` existe na frota
  ou no `game-props3d`, todo `owner` de `missing` está em `packages/`, nenhum lote se sobrepõe a outro nem a uma linha, e as entradas
  `missing` batem com a tabela "Falta" do `plan.md`.
- **T2.2:** a página, o montador que lê os três arquivos e chama o `createKitWorld` e os pacotes, as caixas de aviso, câmera e cenários.

## 6. Riscos

- **Os padrões `downtown` e `working_class` desenham silhueta, não casa** (L2): o montador da T2.2 põe as plantas do `site.lots` e o `game-urban` só
  o resto do quarteirão. Se o `compose` do padrão puser silhueta em cima de um lote, o lote vence e a silhueta sai (um `HouseProvider` que
  recusa o pedido dentro dos lotes).
- **Escala do recorte e memória**: 400 × 250 m com 10 plantas enteráveis e dezenas de silhuetas. A régua da T2.6 mede; N4 fixa o teto.
- **Coordenadas à mão**: o teste de sobreposição e uma folha de planta vista de cima (print de conferência da T2.2, não câmera de jogo)
  seguram erro de digitação.
