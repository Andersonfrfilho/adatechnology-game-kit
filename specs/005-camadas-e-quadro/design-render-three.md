# Desenho — `@adatechnology/game-render-three` (T4.3)

Desenho da API e da migração para a T4.3 da spec 005 (decisão D4 do [`plan.md`](plan.md)), com o plano das T4.4 a T4.6. Escrito em
2026-10-31, depois do merge de `perf/explosion-frame-budget`. O `architect` validou a primeira versão com **APPROVE WITH CHANGES**
(conferida contra `three@0.160.1` e o código); esta é a revisão com as mudanças pedidas.

## Revisão 2 (2026-10-31)

Segunda passada do `architect` (APPROVE WITH CHANGES), conferida contra `three@0.160.1`:

| Item | O que mudou | Seção |
|---|---|---|
| F-a | Um material tem **um programa por chave** em que já foi desenhado (`properties.get(m).programs`, um `Map` de `cacheKey` → programa, `WebGLRenderer.js:1614-1648`), e o `dispose` libera **todos** (`releaseMaterialProgramReferences`, `WebGLRenderer.js:756-762`). A leitura passa a ser `programKeysOf` (todas as chaves); `offer` guarda o material se **alguma** chave ainda não tem âncora; o modo conservador fica igual | §5.2, §7 (teste 13) |
| F-b | Neblina neutra cabe em `mediump` (máximo 65 504): `near = 6,0e4`, `far = 6,4e4` (os dois exatos em meia precisão); `seal`/`check` exigem `camera.far < near`; a identidade do pixel vale nas duas precisões porque o fator é exatamente 0 quando `d < near` | §4.1, §7 (teste 4) |
| Menor | T4.4f: a contagem hemisférica da sala passa de 1 para 2 desde o boot quando ainda não há renderizador de clima (hoje o `createLightning`, `game-weather-three/src/renderer.ts:69`, só cria a segunda quando o clima nasce); inofensivo porque o `warmUp` roda no boot já com 2 e a vaga tem intensidade 0 | §6.2 (T4.4f) |

## Revisão 2026-10-31

| Item | O que mudou | Seção |
|---|---|---|
| Erro 1 | `opaque` (`transparent === false && blending === NormalBlending`) **entra** na chave do programa no r160 (`WebGLPrograms.js:248`, camada 17 em `:549`) | §5.2 |
| Erro 2 | Guardar uma referência JS não segura programa: `dispose()` do material o libera. Âncora é material **nunca descartado**; as sondas entregam os materiais ao conjunto de âncoras em vez de descartá-los (hoje `room.ts:3170-3196` depende do `pinPrograms`) | §4 (passo 5), §5.2 |
| Erro 3 | Inventário ganhou a `HemisphereLight` do relâmpago (`game-weather-three/src/lightning.ts:23`) e as luzes da cena de miniatura (`game-items-three/src/thumbnails.ts:99-103`) | §1.1, §3.6, §6.4 |
| Erro 4 | Vaga de sombra com `autoUpdate = false` e sem `needsUpdate` nunca aloca mapa nem liga o programa de distância (`WebGLShadowMap.js:110,140`) | §3.4, §4 (passo 2) |
| Erro 6 | O antigo teste 2 (reproduzir a ordenação em Node) não provava nada; trocado por uma checagem no navegador, no `perf.mjs`, que lê o uniforme `pointLights[slot]` depois de um render | §7 |
| R9 | O grupo do orçamento entra **antes** de qualquer outra luz na travessia; `check()` confirma que não há `PointLight`/`SpotLight` fora do orçamento | §3.2, §3.1 |
| R10 | Família de âncora pela `cacheKey` real do programa depois do primeiro render (`renderer.properties.get(m).currentProgram.cacheKey`), com o risco de ser interno do r160 | §5.2 |
| R11 | ver Erro 6 | §7 |
| R12 | T4.6 (âncoras) antes da T4.5c (sai `pinPrograms`) | §6.2 |
| R13 | Baforadas do veículo mudam o próprio material por quadro (`game-vehicles/src/particles.ts:231-232`): material por partícula fica, o pool guarda só a âncora da família; o pool chega ao `game-vehicles` (L2) por um tipo estrutural de opção | §6.2 (T4.5a) |
| R14 | `warmUp` liga `needsUpdate` em toda vaga de sombra | §3.4, §4 |
| R15 | Vaga hemisférica do host para o relâmpago; a cena de miniatura fora da tela entra na allowlist | §3.1, §3.6, §3.7, §6.4 |
| R16 | `seal()`/`check()` cobrem também neblina (presença e tipo), `scene.environment`, `toneMapping`, `outputColorSpace`, `shadowMap.type`; desenho da neblina do clima sem recompilar e sem mudar visual nem golden | §1.2, §4.1 |
| R17 | `LightSource.follow?: Object3D`, lido uma vez por `present` | §3.1, §3.7 |
| Riscos | Custo fixo do laço de luzes com 2.000 zumbis instanciados (checagem de `MAX_FRAGMENT_UNIFORM_VECTORS` no `warmUp`, qualidade decidida contra `dense_horde` em Intel); escala e máscara de membro por instância chegam ao passe de sombra por `customDepthMaterial`/`customDistanceMaterial` pré-aquecidos; `warmUp` aceita o alvo de render real (pós-processamento); a T4.6 mede se os quadros de 36 ms são envio de buffer ou variante de shader do driver | §3.5, §4 |
| Opcional | Aviso em desenvolvimento ao descartar recurso de pool (`heavy.ts:138-141` descarta os da chama); luzes do vfx liberadas ao voltar a 0; `linkedSince` conta chamadas de `linkProgram` | §5.2, §3.7, §4 |

## 1. O que existe hoje

### 1.1 Luzes criadas fora de um dono (inventário completo, `grep -E "(PointLight|SpotLight|HemisphereLight|DirectionalLight|AmbientLight|RectAreaLight)\(" packages/*/src`)

| Onde | Luzes | Quando nascem | Sombra |
|---|---|---|---|
| `game-vfx-three/src/lights.ts:16,22` | 4 de explosão + 2 de fogo (`BLAST_LIGHTS`, `FIRE_LIGHTS` do `game-vfx`) | na criação do renderer, intensidade 0 | não |
| `game-vfx-three/src/workshop-layers.ts:341-342` | 4 de clarão (`LIGHT_CAPACITY`) + 2 de fogo (`workshop/waves.ts`) | na primeira vez que a Oficina existe (`attachWorkshopLayers`, agora no pré-aquecimento) | não |
| `game-floorplan-three/src/lights/room-light.ts:41` | `n` (padrão 6, até `MAX_LIGHTS = 12`) luzes de cômodo, `shadows` (padrão 2) com sombra cúbica de 512 | em `lighting(o)` | 2 primeiras |
| `game-weapons-three/src/fx/heavy.ts:35` | 1 do foguete (`createRocketLight`), fixa, ligada pela intensidade | uma vez, pela composição | não |
| `game-weapons-three/src/models/attachments/light.ts:26` | 1 `SpotLight` por lanterna de trilho | ao montar o acessório | não |
| `game-interactables-three/src/mesh.ts:155` | 1 por lâmpada (`api.light`) | ao montar o móvel; some quando o móvel sai | não |
| `game-characters-three/src/rich/accessories/hand-items.ts:26` | 1 do sinalizador na mão | ao pôr o item na mão | não |
| `game-weather-three/src/headlights.ts:54` | `SpotLight` dos faróis | ao ligar os faróis | não |
| `game-urban-three/src/draw.ts:216,226` | uma por parte `light` da cena urbana (o contador do `game-urban`, `DEFAULT_LIGHT_BUDGET = 16`, decide quantas) | ao desenhar a cena | não |
| `game-weather-three/src/lightning.ts:23` | 1 `HemisphereLight` do relâmpago (`weather-lightning`), intensidade 0 fora do clarão | ao criar o relâmpago (`createLightning`), **depois** do boot quando o clima é ligado no meio do jogo | não |
| `game-items-three/src/thumbnails.ts:99-103` | 1 `HemisphereLight` + 2 `DirectionalLight` (sol e contraluz) | numa `Scene` própria, fora da tela, a cada miniatura (`composeThumbnailScene`), desenhada pelo `ThumbnailRenderer` que o chamador passa | não |

A sala ainda tem `HemisphereLight` e `DirectionalLight` (sol com sombra) em `game-test-room/src/arena.ts`. Luz direcional, hemisférica e
ambiente são do host, nascem no boot e ficam fora do orçamento de vagas pontuais (seção 3.6). O relâmpago é o único adaptador que cria
uma luz hemisférica, e ela muda `numHemiLights` da cena quando o clima nasce: vira uma vaga hemisférica do host (seção 3.6).

### 1.2 Por que o número de luzes nunca pode mudar depois do boot

No three r160, a chave do programa de todo material com luz (`WebGLPrograms.getParameters`) inclui `numPointLights`, `numSpotLights`,
`numPointLightShadows`, `numSpotLightShadows` (e os de mapa de sombra e de `map` da spot). Se qualquer um desses números muda, **todos**
os materiais com luz da cena viram outro programa: é a recompilação de 595 programas da tempestade (`desempenho-explosoes.md`). E
esses números mudam por mais caminhos do que `new PointLight`:

- `light.visible = false` (o `projectObject` só coleta luzes visíveis);
- tirar a luz da cena ou do pai, ou o pai ficar invisível;
- trocar `castShadow` (muda `numPointLightShadows`);
- `light.layers` sem a camada da câmera que desenha (o `projectObject` testa `layers` também para luzes; a sala tem `debugView`).

Por isso o orçamento cria todas as luzes no boot, nunca as esconde, nunca as remove, nunca troca `castShadow` e liga todas as camadas.
"Desligar" é intensidade 0. Uma luz em intensidade 0 contribui com exatamente 0 (`directLight.color = pointLight.color * falloff` com
cor 0), então o pixel não muda; o que muda é o custo fixo do laço de luzes no shader, que é o preço da estabilidade e é decidido pelo
tamanho do orçamento (seção 3.5).

As luzes não são o único estado da cena e do renderer que entra na chave. No r160 (`WebGLPrograms.getParameters` e
`getProgramCacheKey`, conferido no código) também entram, para **todo** material que os usa: `fog` (há neblina na cena), `fogExp2` (o tipo
dela, `:301-303`, `:444`), `envMap` vindo de `scene.environment` (`:53`), `toneMapping` (`:165-171`), `outputColorSpace` (`:202`, que
depende do alvo de render atual) e `shadowMapType` (`:338`). Trocar qualquer um deles no meio do jogo recompila a cena como uma luz nova.
O caso real de hoje é a neblina do clima: `game-weather-three/src/fog.ts:45-54` troca `scene.fog` entre `Fog` e `FogExp2`, e o `clear()`
devolve `null`. Por isso o selo do orçamento cobre esse estado também (seção 4.1).

### 1.3 Um defeito escondido que o orçamento conserta

A máscara de luz por cômodo (`room-light.ts`) indexa `uRB0[i]`…`uREx[i]` pelo índice `i` do laço `NUM_POINT_LIGHTS` do shader e
assume que as luzes de cômodo `PL[i]` são as de índice `i`. O three ordena as luzes com `castShadow` primeiro e, no resto, pela ordem
de travessia da cena. As 2 com sombra caem certo; as outras 4 só caem certo se nenhuma outra `PointLight` sem sombra vier antes delas
na cena. Com o grupo do vfx adicionado antes da casa, a máscara do cômodo 3 vai para uma luz de explosão. Além disso, os vetores
uniformes têm `MAX_LIGHTS = 12` entradas e a cena pode ter mais luzes que isso (6 vfx + 6 Oficina + 1 foguete + 6 cômodos = 19).

O orçamento resolve por construção: **é o único dono de `PointLight`/`SpotLight`, e cria as vagas numa ordem fixa, com as de sombra
primeiro**. Assim `handle.slot` é o índice da luz no shader, e a casa grava a máscara no índice certo.

### 1.4 Pré-aquecimento e pools de hoje

- `room.ts` `warmUp()` (`:3179-3198`): junta `renderer.warmUpProbes()`, `vfx.warmUpProbes()`, `fluidView.warmUpProbes()` e duas sondas
  de sprite (com e sem neblina), desenha uma vez, chama `pinPrograms()` e **descarta** as sondas (`probe.dispose()`,
  `material.dispose()`). Só funciona por causa do `pinPrograms` (`:3170-3176`): sem o `usedTimes++`, o `dispose` levaria o `usedTimes` a
  0 e o three liberaria o programa que acabou de ligar. É refeito quando a assinatura das luzes muda (`lightsKey`, de 250 em 250 ms).
- `room.ts` `warmUpEffects()`: `gl.compile`, toca `m67` e um fogo, 3 quadros, para e limpa.
- `pinPrograms()`: soma 1 ao `usedTimes` de todo programa, para o three nunca liberar programa. É o contorno do material descartado
  por baforada em `game-vehicles/src/particles.ts:136` (`P.own`) e das gotas de `game-weapons-three/src/fx/heavy.ts:107,122` (geometria e
  material novos por gota, `clone()` do material da chama).
- `game-vfx-three/src/mesh-layer.ts`: geometria unitária por forma e malhas estacionadas (até 256 por tipo), material junto.
- `game-vfx-three/src/marks.ts`: anel de 64 marcas e `InstancedMesh` para sangue, pedras e placas, ligadas na primeira marca do tipo
  (lição 2 dos goldens).
- O que sobrou: 2 quadros de 36 ms na primeira granada e 1 no primeiro molotov, do lado da GPU, no primeiro envio dos buffers do efeito
  (210 na primeira granada).

## 2. Pacote

- **Nome:** `@adatechnology/game-render-three`, camada **L4**. Depende de `game-contracts` e `three` (peer `^0.160.0`). Nenhum núcleo.
- **Arquivos:** `src/three-lib.ts`, `src/lights/budget.ts`, `src/lights/slots.ts`, `src/lights/arbiter.ts`, `src/warmup.ts`,
  `src/pools/geometry.ts`, `src/pools/material.ts`, `src/pools/anchors.ts`, `src/program-key.ts` (a leitura interna isolada, seção 5.2),
  `src/scene-state.ts` (o estado selado, seção 4.1), `src/probes.ts` (sondas embutidas: sprite com e sem neblina), `src/index.ts`.
- **Nada de `test-area`** no `.` (D6).

### 2.1 `ThreeLib`

```ts
/** The one name of the three.js namespace in the kit. Packages narrow it with Pick<ThreeLib, ...>. */
export type ThreeLib = typeof import('three')
```

- Os `ThreeLib`, `Three`, `ThreeNamespace` e `ThreeNS` locais (`game-vfx-three/src/types.ts`, `game-interactables-three/src/types.ts`,
  `game-fluids-three/src/types.ts`, `game-camera`, `game-devtools`…) passam a ser `Pick<ThreeLib, ...>` do tipo central, com o nome
  antigo mantido como alias `@deprecated` (D2).
- `type Three = any` (`game-urban-three/src/draw.ts:10`, `game-vehicles/src/api.ts:10`) sai. Núcleos L2 não importam `game-render-three`
  (L4): o `game-camera` e o `game-devtools` declaram o próprio `Pick<typeof import('three'), ...>` só com `import type`, o que não cria
  dependência de execução, e o `check:layers` permite `import type` de `three` em L2 só para esses dois (allowlist com o motivo).

## 3. `LightBudget`

### 3.1 API

```ts
export type LightKind = 'point' | 'spot'
export type LinearRgb = readonly [number, number, number]

export interface LightBudgetOptions {
  /** Point lights created at boot. Default 16. */
  readonly point?: number
  /** Spot lights created at boot. Default 4. */
  readonly spot?: number
  /** How many of the point lights cast shadows (cube maps). Default 2. Fixed for the life of the budget. */
  readonly pointShadows?: number
  /** How many of the spot lights cast shadows. Default 0. */
  readonly spotShadows?: number
  /** Shadow map size of the shadow slots. Default 512 (the room lights' value today). */
  readonly shadowMapSize?: number
  /** Point slots only `urgent` requests may take while others are free. Default 2. */
  readonly urgentReserve?: number
  /** Milliseconds a light fades out when a source loses its slot to arbitration, and fades in when it gets one. Default 120. */
  readonly fadeMs?: number
  /** A source keeps its slot until a challenger scores this much better (0.15 = 15%). Default 0.15. */
  readonly hysteresis?: number
  /** HemisphereLights created at boot for adapters that flash the sky (weather lightning). Default 0; leased with `leaseHemisphere`. */
  readonly hemisphere?: number
}

/** A light that lives as long as the request: a blast, a rocket in flight, a muzzle flash, a flare in the hand. */
export interface LightRequest {
  readonly owner: string
  readonly kind?: LightKind
  /** Higher wins a slot; see LIGHT_PRIORITY. */
  readonly priority: number
  /** Hex (sRGB, like `new Color(hex)`) or linear RGB (like the vfx pool's `setRGB(..., LinearSRGBColorSpace)`). */
  readonly color: number | LinearRgb
  readonly intensity: number
  readonly distance: number
  readonly decay?: number
  readonly position: readonly [number, number, number]
  /** Spot only. */
  readonly target?: readonly [number, number, number]
  readonly angle?: number
  readonly penumbra?: number
  /** Takes a slot at once: cuts the lowest victim instead of fading it, and may use the urgent reserve. For flashes that peak in 1-3 frames. */
  readonly urgent?: boolean
  /** Called once when a higher priority took the slot; the handle is dead from then on. */
  readonly onLost?: () => void
}

export interface LightHandle {
  /** Index of this light among the scene's point (or spot) lights in the shader; stable while the handle lives. */
  readonly slot: number
  readonly kind: LightKind
  readonly alive: boolean
  update(patch: Partial<Pick<LightRequest, 'color' | 'intensity' | 'distance' | 'decay' | 'position' | 'target' | 'angle' | 'penumbra'>>): void
  /** Gives the slot back; with fadeMs the light fades first. Idempotent. */
  release(options?: { readonly fadeMs?: number }): void
}

/** A light that exists in the world for a long time and competes for a slot every frame: a lamp, a street light, a headlight. */
export interface LightSource extends Omit<LightRequest, 'urgent' | 'onLost'> {
  /** Wants a shadow slot (only point shadow slots exist by default). */
  readonly shadow?: boolean
  /**
   * The object the light sits on (a lamp's bulb, a headlight, a weapon's rail). Its world position (and, for a spot, its world -z as the
   * direction when `target` is absent) is read once per `present`, after the scene's matrices are updated; `position` is then an offset
   * in its local space. A source whose `follow` left the scene (`!follow.parent` up to the root) counts as off.
   */
  readonly follow?: import('three').Object3D
}

export interface SourceHandle {
  /** Slot now, or -1 while it has none (its light is not drawn). */
  readonly slot: number
  update(patch: Partial<LightSource>): void
  remove(): void
}

/** Slots a client keeps for itself for good, chosen at boot: the room lights of a house (their masks are indexed by slot). */
export interface LightLease {
  readonly handles: readonly LightHandle[]
  release(): void
}

export interface LightBudget {
  /** The group holding every light; added to the scene by createLightBudget. Never hidden, never removed while the budget lives. */
  readonly group: import('three').Group
  readonly sizes: { readonly point: number; readonly spot: number; readonly pointShadows: number; readonly spotShadows: number }
  acquire(request: LightRequest): LightHandle | null
  addSource(source: LightSource): SourceHandle
  /** Takes `point` slots (of which `shadows` shadow slots) for good. null when not enough unleased slots remain. */
  lease(options: { readonly owner: string; readonly point: number; readonly shadows?: number }): LightLease | null
  /** Takes one of the boot HemisphereLights for good (weather lightning). null when none is left. Its intensity starts at 0. */
  leaseHemisphere(owner: string): import('three').HemisphereLight | null
  /**
   * Arbitrates sources against free slots, runs fades, reads every `follow` once and writes every light. Once per frame, in `present`,
   * with the camera (or the player) as focus. `dtSeconds` is real time (the runtime's `ctx.realDt`): fades do not stop in pause.
   */
  present(focus: readonly [number, number, number], dtSeconds: number): void
  /**
   * After this, any change in the program-key state of the scene is a bug and `check()` reports it: the light counts, and the scene and
   * renderer state of §4.1 (fog presence and type, `scene.environment`, `toneMapping`, `outputColorSpace`, `shadowMap.type`).
   * ProgramWarmup.warmUp seals.
   */
  seal(renderer: import('three').WebGLRenderer, scene: import('three').Scene, options?: SealOptions): void
  /**
   * Dev check: the scene's visible light signature and the sealed state are the ones sealed, and no PointLight/SpotLight exists in the
   * scene outside the budget's group (`strays` lists their paths).
   */
  check(renderer: import('three').WebGLRenderer, scene: import('three').Scene): LightCheck
  stats(): LightBudgetStats
  dispose(): void
}

export interface SealOptions {
  /** Fog states the game will switch between at run time; each one is warmed (§4.1). Default: only the state at seal time. */
  readonly fogStates?: ReadonlyArray<'none' | 'linear' | 'exp2'>
}

export interface LightCheck {
  readonly ok: boolean
  readonly expected: string
  readonly actual: string
  /** Paths of PointLight/SpotLight found outside the budget's group. */
  readonly strays: readonly string[]
}

export interface LightBudgetStats {
  readonly lit: number
  readonly free: number
  readonly leased: number
  readonly sources: number
  readonly sourcesWithoutSlot: number
  readonly preempted: number
  readonly refused: number
}

export const LIGHT_PRIORITY = {
  blast: 900,
  rocket: 800,
  muzzle: 750,
  fire: 600,
  flare: 500,
  headlight: 400,
  weaponLight: 400,
  lamp: 200,
  street: 150,
} as const

export function createLightBudget(
  THREE: Pick<ThreeLib, 'Group' | 'PointLight' | 'SpotLight' | 'HemisphereLight' | 'Object3D' | 'Vector3' | 'Color' | 'LinearSRGBColorSpace'>,
  scene: import('three').Object3D,
  options?: LightBudgetOptions,
): LightBudget
```

### 3.2 Vagas

- O `createLightBudget` cria `point` `PointLight`, `spot` `SpotLight` e `hemisphere` `HemisphereLight` num `Group`
  (`name = 'light-budget'`) e o põe na cena **como primeiro filho** (`scene.add(group)` seguido de mover o grupo para `children[0]`,
  com `group.parent` e o evento `added` normais). As de sombra vêm primeiro no grupo, com `shadow.autoUpdate = false` (como a casa faz
  hoje), `mapSize = shadowMapSize`. Todas: `intensity = 0`, `position (0, -50, 0)`, `layers.enableAll()`, `visible = true`, alvo da spot
  como filho do grupo.
- **Primeiro na travessia.** O `projectObject` do three coleta as luzes na ordem da travessia da cena, e o `WebGLLights.setup` ordena
  só por sombra/mapa, de forma estável. Com o grupo em `children[0]`, as luzes do orçamento são as primeiras da sua classe, e uma luz
  avulsa que escapasse do lint iria para o fim, sem deslocar nenhum `slot`. Mover o grupo para o índice 0 muda os índices dos filhos da
  cena da sala, que nenhum golden lê (os goldens leem o `root` de cada adaptador, seção 6.1).
- **Ordem do shader = ordem da vaga.** Com o grupo em primeiro e sem luz pontual ou spot fora dele, `slot` é o índice no shader. O
  `check()` confirma a segunda condição em desenvolvimento: percorre a cena e lista em `strays` toda `PointLight`/`SpotLight` que não está
  no grupo (o `ok` cai). O teste que prova o índice roda no navegador (seção 7, teste 2).
- Três classes de vaga: **arrendadas** (`lease`, fixas, nunca tomadas), **de sombra** (só para fonte com `shadow: true` ou arrendamento
  com `shadows`) e **comuns** (pedidos e fontes). `urgentReserve` vagas comuns ficam para pedidos `urgent` enquanto houver outras livres.

### 3.3 Prioridade e preempção

- `acquire` pega uma vaga comum livre (fora da reserva; a reserva só para `urgent`). Sem vaga livre:
  1. procura a vítima de **menor prioridade** entre pedidos e fontes; no empate, a de menor contribuição percebida
     (`intensity / max(1, distância ao foco)²`);
  2. se a vítima tem prioridade **maior ou igual**, devolve `null` (`refused++`): quem chama segue sem luz, como o `game-vfx` já faz
     quando o seu pool está cheio;
  3. se a vítima é uma fonte, ela perde a vaga (volta para a fila da arbitragem, `slot = -1`); se é um pedido, `onLost()` é chamado e o
     handle morre.
- **Esmaecer na preempção:** com `urgent` (explosão, foguete, clarão), a vítima é cortada no mesmo quadro (um clarão que espera 120 ms
  perde o pico; o corte de uma lâmpada distante, a de menor contribuição, não se nota). Sem `urgent`, a vaga esmaece a vítima por `fadeMs`
  e só então passa ao novo dono; nesse intervalo o handle novo já existe (`alive`), e as escritas dele são guardadas e aplicadas no fim
  do esmaecer.
- **Fontes** (`addSource`): a cada `present`, as vagas comuns que nenhum pedido ocupa vão para as fontes de maior
  `priority`, e no empate para as mais perto do foco. Uma fonte que tem vaga só perde para uma desafiante com pontuação melhor em mais de
  `hysteresis`. Quem ganha acende em `fadeMs`; quem perde apaga em `fadeMs`. É o algoritmo de `room-light.ts` (cômodos mais perto
  primeiro) generalizado.

### 3.4 Sombras

- Número de vagas de sombra fixo no boot (`pointShadows`, padrão 2; `spotShadows`, padrão 0). `castShadow` nunca muda depois do boot.
- **O mapa nasce no `warmUp`.** No r160, o `WebGLShadowMap.render` pula a luz com `autoUpdate === false && needsUpdate === false`
  (`WebGLShadowMap.js:110`) **antes** de criar o mapa (`shadow.map = new WebGLRenderTarget`, `:140`) e antes de desenhar com o material
  de distância. Uma vaga que nunca recebeu `needsUpdate` fica sem mapa e sem o programa de distância ligado: o primeiro dono que a
  acendesse no jogo criaria o alvo de render e ligaria `MeshDistanceMaterial` (e os `customDistanceMaterial` da cena) no meio da partida.
  Por isso o `warmUp` liga `shadow.needsUpdate = true` em **toda** vaga de sombra antes do seu render (seção 4, passo 2), e o mapa de
  cada vaga existe desde a carga.
- Depois disso, uma vaga de sombra vazia fica em intensidade 0 com o mapa parado (`autoUpdate = false`, sem `needsUpdate`): custa o laço
  do shader e a amostra do mapa, não o desenho do mapa.
- O mapa só é redesenhado quando o dono da vaga ou a posição mudam (`shadow.needsUpdate = true`), como faz a casa hoje (`sig[i]`).
- Pedido transitório nunca recebe vaga de sombra: um clarão de explosão dura poucos quadros, e o mapa cúbico custa seis desenhos da cena.
- Quem usa vaga de sombra hoje: as luzes de cômodo (arrendamento com `shadows: 2`). Uma fonte com `shadow: true` (farol de veículo no
  futuro) disputa as vagas de sombra que sobrarem.

### 3.5 Tamanhos padrão

| | Padrão | Por quê |
|---|---|---|
| `point` | 16 | Cobre o que a sala usa ao mesmo tempo depois da arbitragem: 6 de cômodo (arrendadas), 4 de explosão + 2 de fogo + 1 de foguete (pedidos `urgent`), 3 para lâmpadas e sinalizador |
| `pointShadows` | 2 | As 2 da casa de hoje |
| `spot` | 4 | 2 faróis + 1 lanterna de trilho + 1 holofote urbano perto; o resto das spots urbanas disputa por distância |
| `urgentReserve` | 2 | Uma explosão sempre acende sem preempção, mesmo com a casa acesa |

- O custo de cada vaga é fixo e existe mesmo apagada (laço do shader de todo material com luz). O jogo escolhe pela qualidade, **no boot**:
  `low` 8/2, `medium` 12/2, `high` 16/4. Trocar a qualidade depois do boot é `budget.dispose()` + novo orçamento + `ProgramWarmup.warmUp`
  atrás da tela de carregamento, nunca no meio do jogo.
- Na sala, durante a migração, o orçamento começa com o número de luzes que a sala já tem e é reduzido no fim (seção 6).

**O custo fixo com a horda.** O laço de luzes roda no shader de fragmento de **todo** material com luz, inclusive o corpo instanciado da
horda (`game-characters-three/src/instanced/body-batch.ts`). Com 2.000 zumbis na tela, 16 vagas apagadas custam 16 iterações por
fragmento coberto pela horda, e a horda cobre boa parte da tela. Além do tempo, há um teto duro: os uniformes das luzes
(`pointLights[]`, `spotLights[]`, `pointShadowMap[]`, as matrizes de sombra) mais os da horda (paleta, máscaras) e os da máscara de
cômodo (`uRB0`…`uREx`, cinco vetores por vaga pontual) precisam caber em `MAX_FRAGMENT_UNIFORM_VECTORS`, que costuma ser 1.024 no
ANGLE do Windows (o caminho das GPUs Intel no Chrome) e cujo mínimo no WebGL2 é 224. Por isso:

- o `warmUp` lê `gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)`, e um programa que falha ao ligar por falta de uniforme vira erro com
  o tamanho do orçamento no relatório (`WarmupReport.uniformVectors`), não uma tela preta;
- a qualidade (`low`/`medium`/`high`) é escolhida **medindo** o cenário `dense_horde` do `perf.mjs` (Fase 4b) numa GPU Intel integrada:
  o padrão do kit é o maior tamanho que mantém esse cenário dentro do orçamento de quadro nessa máquina, e esse número entra aqui quando a
  medição existir. Até lá, os tamanhos da tabela valem como teto, não como padrão garantido.

### 3.6 O que fica fora do orçamento

`DirectionalLight`, `HemisphereLight`, `AmbientLight` e `RectAreaLight`: são do host, nascem no boot e entram na assinatura selada. O
lint (seção 6.4) proíbe também essas fora de pacote de host (`game-test-room`, `examples/*`, o jogo), para que nenhum adaptador crie uma.

- **Relâmpago do clima.** O `createLightning` cria hoje a própria `HemisphereLight` (`lightning.ts:23`). Com orçamento, ele recebe a luz
  por opção: `createLightning(THREE, scene, vfx, { light: budget.leaseHemisphere('weather.lightning') })`, e só anima intensidade e cor,
  como já faz. O host decide no boot quantas vagas hemisféricas existem (`hemisphere: 1` quando o jogo tem clima). Sem a opção, o caminho
  legado cria a luz como hoje (D2).
- **Cena de miniatura fora da tela** (`game-items-three/src/thumbnails.ts:99-103`). É uma `Scene` própria, com as próprias luzes, que
  nunca entra na cena do jogo, desenhada pelo `ThumbnailRenderer` do chamador (que chama `setSize` e `toDataURL`: na prática, um renderer
  próprio, não o do jogo). As luzes dela não mudam a chave de nenhum material da cena do jogo. Entra na allowlist do lint com esse
  motivo (seção 6.4), com uma condição escrita no JSDoc de `renderItemThumbnail`: não passar o renderer do jogo. Se um jogo fizer isso,
  as miniaturas ligam programas no renderer do jogo, e o `linkedSince` mostra.

### 3.7 Como cada pool de hoje vira cliente

| Pool de hoje | Vira | Detalhe |
|---|---|---|
| `game-vfx-three` `createLightLayer` (4 + 2) | `acquire` por entrada do `LightPool` | Entrada com `intensity > 0.05` e sem handle: `acquire({ owner: 'vfx.blast', priority: blast, urgent: true, ... })`; a cada `sync`, `handle.update`; voltou a 0 (abaixo de 0,05): `release()` na hora, sem esmaecer, para a vaga voltar ao orçamento no mesmo quadro. Recusado: a entrada não acende (o mesmo que o pool cheio de hoje). O `lights.group` continua no `root`, **vazio**, para não mudar o índice dos filhos que o golden lê (`root.children[5]` e `at(-1)`) |
| Oficina (4 + fogo) | idem, `owner: 'vfx.workshop'` | E a Oficina deixa de mudar a contagem de luzes: `attachWorkshopLayers` no pré-aquecimento vira desnecessário para luzes (continua para as camadas de sprite) |
| `game-floorplan-three` `lighting(o)` | `lease({ owner: 'floorplan.rooms', point: n, shadows: NS })` | O algoritmo de cômodos fica igual, escrevendo em `lease.handles[i]` em vez de `PL[i]`. As máscaras (`uRB0`…`uREx`) passam a ter `budget.sizes.point` entradas e são gravadas em `handles[i].slot`. As vagas que não são da casa recebem a caixa `EMPTY` (máscara 0 nos materiais da casa), que é o que já acontece hoje com as luzes de explosão: o comportamento visual não muda |
| `createRocketLight` | `acquire({ owner: 'weapons.rocket', priority: rocket, urgent: true })` no lançamento, `release()` no impacto | `createRocketLight` fica `@deprecated` para quem não passa orçamento |
| Lanterna de trilho | `addSource({ kind: 'spot', priority: weaponLight, follow: rail })` ao ligar | a direção é o −z do trilho |
| Lâmpada (`api.light`) | `addSource({ priority: lamp, follow: bulb })` por lâmpada; a posição é lida do bulbo uma vez por `present` | Uma casa tem dezenas de lâmpadas e o orçamento acende as mais perto. Quebrar a lâmpada: `source.remove()`; a contagem não muda |
| Sinalizador na mão | `acquire({ priority: flare })` ao pegar, `release()` ao soltar | a posição vem da mão a cada quadro por `handle.update`; um pedido não tem `follow` porque vive pouco |
| Faróis | `addSource({ kind: 'spot', priority: headlight, follow: lamp })` por farol | |
| Relâmpago (`createLightning`) | `leaseHemisphere('weather.lightning')` no boot, passado por opção | só intensidade e cor mudam, como hoje (seção 3.6) |
| `game-urban-three` partes `light` | `addSource` por parte; o `animator` da lâmpada falhando faz `source.update({ intensity })`; o holofote que gira, `update({ target })` | O contador do `game-urban` continua decidindo quantas partes `light` a cena tem (é dado, L2) |

**Nome:** o `game-urban` já exporta `createLightBudget(count)` e o tipo `LightBudget` (o contador). Para não haver dois `LightBudget` no
mesmo jogo, o `game-urban` ganha `createLightAllowance`/`LightAllowance` e os nomes antigos ficam `@deprecated` (D2).

**Como o cliente recebe o orçamento:** por opção (`lights?: LightBudget`) na criação do renderer, da casa, do móvel, da cena urbana. Na
sala de testes, o `ModuleHost` ganha `lights?: unknown` (o contrato não conhece three), e os adaptadores leem com o guarda
`isLightBudget(value): value is LightBudget` exportado pelo `game-render-three`.

## 4. `ProgramWarmup`

```ts
/** What `warmUpProbes()` of the adapters already returns: a group to draw once. */
export interface WarmupProbe {
  readonly id: string
  /**
   * The group to draw once. `materials` are handed to the warmup's anchor set and are **never** disposed (their programs stay linked);
   * `dispose` frees only what is not a material (geometries of the probe meshes, the group).
   */
  build(): { readonly group: import('three').Object3D; readonly materials: readonly import('three').Material[]; dispose(): void }
}

/** An effect played once at load so its programs are linked and its buffers and textures reach the GPU before play. */
export interface EffectWarmup {
  readonly id: string
  /** Starts the effect where the camera sees it. */
  play(): void
  /** Advances it; the warmup renders after each step. */
  step(dtSeconds: number): void
  /** Stops and clears everything it left (world, log, sound), keeping the pools filled. */
  stop(): void
  /** Frames to render. Default 3 (today's warmUpEffects). */
  readonly frames?: number
}

export interface WarmupOptions {
  readonly lights?: LightBudget
  /** Fog states to warm (§4.1); passed on to `lights.seal`. */
  readonly fogStates?: ReadonlyArray<'none' | 'linear' | 'exp2'>
  /**
   * Where the game really draws. A host with post-processing renders the scene into a render target, and the program key carries the
   * target's colour space and tone mapping (`WebGLPrograms.js:165-171,202`): warming on the canvas would link the wrong variant. Default
   * null (the canvas).
   */
  readonly target?: import('three').WebGLRenderTarget | null
}

export interface WarmupReport {
  readonly programs: number
  readonly geometries: number
  readonly textures: number
  readonly milliseconds: number
  readonly lightSignature: string
  /** `MAX_FRAGMENT_UNIFORM_VECTORS` of this GPU (§3.5). */
  readonly uniformVectors: number
  /** Anchors kept alive (one material per program family, §5.2). */
  readonly anchors: number
}

export interface ProgramWarmup {
  register(probe: WarmupProbe): () => void
  registerEffect(effect: EffectWarmup): () => void
  registerTexture(texture: import('three').Texture): () => void
  /** Seals the budget and the scene state, then warms (procedure below). */
  warmUp(renderer: import('three').WebGLRenderer, scene: import('three').Scene, camera: import('three').Camera, options?: WarmupOptions): WarmupReport
  /**
   * Calls to `gl.linkProgram` since warmUp (dev and perf.mjs): should stay 0. Counted by wrapping `linkProgram` of the renderer's context
   * at warmUp (the same wrap `perf.mjs` does today), not by `renderer.info.programs.length`, which drops when a program is released and
   * so can hide a release followed by a relink.
   */
  linkedSince(renderer: import('three').WebGLRenderer): number
  /** The anchor set: materials that are never disposed while the warmup lives (§5.2). Pools and probes hand theirs here. */
  readonly anchors: MaterialAnchors
}

export function createProgramWarmup(THREE: Pick<ThreeLib, 'Group' | 'Sprite' | 'SpriteMaterial' | 'DataTexture' | 'Fog' | 'FogExp2'>): ProgramWarmup

/** The sprite probes the room builds by hand today: with and without fog. */
export function spriteProbes(THREE: Pick<ThreeLib, 'Sprite' | 'SpriteMaterial' | 'DataTexture'>): WarmupProbe
```

**Procedimento do `warmUp`:**

1. `options.lights?.seal(renderer, scene, { fogStates })`: daqui em diante a contagem de luzes e o estado da seção 4.1 são fixos.
2. Liga `shadow.needsUpdate = true` em toda vaga de sombra do orçamento (seção 3.4) e em toda luz de sombra do host (o sol), para que os
   mapas e os programas de profundidade e de distância nasçam aqui.
3. Junta todas as sondas na cena, `renderer.setRenderTarget(options.target ?? null)`, `renderer.compile(scene, camera)` e um
   `renderer.render(scene, camera)` (o `compile` liga os programas; só o `render` envia os buffers de geometria e desenha os mapas de
   sombra). **O passe de sombra entra:** a horda instanciada desenha a sombra com `customDepthMaterial` (`body-batch.ts:50`) para que a
   escala e a máscara de membro por instância apareçam na sombra; o `warmUp` exige que toda malha instanciada com `castShadow` registre
   uma sonda que tenha também `customDistanceMaterial` (as vagas de sombra pontuais desenham com material de distância, não de
   profundidade), e o render deste passo, com as vagas em `needsUpdate`, liga os dois.
4. Repete o passo 3 para cada estado de neblina pedido em `fogStates` (seção 4.1), restaurando o original no fim.
5. Para cada efeito: `play()`, e `frames` vezes `step(1/50)` + `render`; depois `stop()`. É o `warmUpEffects` da sala, generalizado, e é
   aqui que a T4.6 ataca os 2 quadros de 36 ms: o `game-vfx-three` registra **um efeito por explosivo do catálogo** (os nove do arsenal,
   não só `m67` e um fogo). Os buffers ficam vivos porque as malhas e geometrias dos efeitos voltam aos pools (`mesh-layer` estaciona,
   `marks` reaproveita o anel), que nunca descartam.
6. `renderer.initTexture(t)` para cada textura registrada (marcas em canvas, sprites da fumaça).
7. Remove as sondas da cena e chama `dispose()` delas, que libera só geometria e grupo. **Os materiais das sondas vão para
   `anchors`** e nunca são descartados: no three, o programa é liberado quando o último material que o usa é descartado
   (`WebGLRenderer.js:764`, `releaseProgram` em `WebGLPrograms.js:611-613` com `--usedTimes === 0`), e guardar uma referência JS a um
   material descartado não muda isso. Só um material vivo e não descartado segura o programa. Isto substitui o `pinPrograms`.
8. Lê `MAX_FRAGMENT_UNIFORM_VECTORS` e conta os programas que falharam ao ligar (seção 3.5), registra `renderer.info.programs.length`, a
   assinatura das luzes e o número de âncoras no relatório, e começa a contar `linkProgram` para o `linkedSince`.

- **Tela de carregamento:** o `warmUp` desenha no canvas (ou no alvo do host), então o host chama atrás da tela de carregamento (a sala
  já tem `loading`).
- **Assíncrono:** `warmUpAsync` com `renderer.compileAsync` (r158+, usa `KHR_parallel_shader_compile`) fica como opção, sem mudar o
  passo 5 (que precisa de render síncrono).
- **Quem registra** (T4.6): destruição (`renderer.warmUpProbes`), vfx (`warmUpProbes` + efeitos), fluidos, armas (viewmodel e
  partículas), veículos (partículas, depois da T4.5), a horda (corpo com `customDepthMaterial` e `customDistanceMaterial`), a sonda de
  sprite embutida. O `warmUpProbes()` de cada adaptador continua exportado e `@deprecated`; o novo é `adapter.registerWarmup(warmup)`,
  que devolve os materiais em `materials` em vez de descartá-los.
- **O que some da sala:** `warmUp`, `warmUpEffects`, `pinPrograms`, `pinnedPrograms` e a verificação de luzes de 250 ms (que vira
  `budget.check(renderer, scene)` em modo de desenvolvimento, com um `log` de erro `light_count_changed` ou `scene_state_changed` em vez
  de pré-aquecer de novo).
- **Medir antes de atacar os 36 ms (T4.6).** O desenho supõe que os 2 quadros de 36 ms são o primeiro envio dos buffers do efeito. Pode
  ser outra coisa que o `linkProgram` não conta: o driver compila uma variante nova do shader no primeiro uso com um estado novo (blend,
  formato do alvo), sem nenhum `linkProgram` novo. A T4.6 mede **antes e depois**, no perfil de GPU do `perf.mjs` (`cold_frag_grenade`,
  `cold_molotov`): chamadas de `bufferData`/`bufferSubData` e bytes enviados no quadro lento, `linkProgram` no quadro lento, e o tempo
  do quadro com o `warmUp` dos efeitos ligado e desligado. Se os buffers já estiverem quentes e o quadro continuar lento, a causa é
  variante do driver, e o remédio é desenhar o efeito no `warmUp` com o **mesmo** estado de blend e alvo do jogo (o passo 5 já faz isso
  quando `target` é o alvo real), não mais pré-envio de buffer. O relatório da T4.6 diz qual das duas era.

### 4.1 Estado selado da cena e a neblina do clima

O `seal` grava, além da assinatura das luzes: presença e tipo da neblina (`none`, `linear`, `exp2`), `scene.environment` (presente ou
não, e o `mapping` dele), `renderer.toneMapping`, `renderer.outputColorSpace` (e o do alvo, quando há `target`) e
`renderer.shadowMap.type`. O `check` compara tudo isso a cada chamada em desenvolvimento.

A neblina é o único desses estados que um adaptador muda hoje durante o jogo: `game-weather-three/src/fog.ts:45-54` troca `scene.fog`
entre `Fog` (linear) e `FogExp2` conforme o tempo, e o `clear()` (camada desligada) devolve a neblina original ou `null`. Cada troca de
tipo ou de presença muda `fog`/`fogExp2` na chave e recompila todo material com `fog: true`.

Uma neblina só, sempre presente, com parâmetros animados, não serve sem mudar o visual: a linear (`smoothstep(near, far, depth)`) e a
exponencial ao quadrado (`1 − exp(−d²·z²)`) são curvas diferentes, e os testes do clima leem o tipo (`renderer.test.ts:177-181` espera
`isFog` com `far` 110 e depois a exponencial na neblina; `bench-visual.test.ts:56-57` espera `scene.fog` nulo com a camada desligada). Por
isso o desenho tem duas partes:

1. **Estados declarados e aquecidos.** O host declara no boot os estados que o jogo usa (`fogStates: ['linear', 'exp2']` quando há
   clima). O `warmUp` desenha a cena uma vez em cada estado (passo 4), então trocar entre eles no jogo encontra os programas prontos. O
   preço é dobrar os programas dos materiais com neblina, pago na carga. O `check` aceita qualquer estado declarado e acusa os outros.
2. **"Sem neblina" sem `null`.** Com orçamento, o `createFog` ganha a opção `stable: true`: o `clear()` não põe `null`, põe uma `Fog`
   linear neutra (`near = 6.0e4`, `far = 6.4e4`), em que `smoothstep(near, far, vFogDepth)` dá exatamente 0 em toda distância visível
   (`fog_fragment.glsl.js` do r160) e o `mix` com fator 0 devolve o pixel de sem neblina.
   - **Por que esses números.** `fogNear`/`fogFar` são `uniform float` do fragmento (`fog_pars_fragment.glsl.js:13-14`); num aparelho em
     que o fragmento só tem `mediump`, o maior valor é 65 504, e `1e9` viraria infinito (e `smoothstep(inf, inf, x)` é indefinido). 60 000
     e 64 000 são exatos em meia precisão (múltiplos de 32, o passo entre 32 768 e 65 504) e cabem com folga. `near = far` não serve
     (`smoothstep` com bordas iguais é indefinido no GLSL).
   - **Identidade do pixel nas duas precisões.** `vFogDepth` é a profundidade de vista do fragmento, menor que `camera.far` para tudo o que
     é desenhado (140 na sala, `room.ts:179`; 400 no showroom). Com `d < near`, `smoothstep` calcula `t = clamp((d − near) / (far − near), 0, 1)`:
     o numerador é negativo e o denominador positivo, então `t` é exatamente 0 em `highp` e em `mediump` (o `clamp` não depende de
     arredondamento), e `t·t·(3 − 2t) = 0`. O `mix(cor, corDaNeblina, 0)` dá `cor·1 + corDaNeblina·0 = cor` exato, já que a cor da
     neblina é finita.
   - **Guarda.** `seal()` grava `camera.far` (e o do alvo de cada câmera que o host registrar) e `check()` acusa `camera.far >= near` da
     neblina neutra: uma câmera com `far` de 60 km faria a neblina neutra aparecer no horizonte. Quando o host tinha uma neblina própria antes do clima, o `clear()` a devolve, como hoje. Assim o
   estado `none` não existe no jogo, e a camada ligada e desligada não recompila. A cor e os parâmetros continuam sendo escritos no objeto
   existente, como hoje (`fog.ts:46-52`).

Sem `stable`, o `createFog` é o de hoje, e os testes do clima (`renderer.test.ts`, `bench-visual.test.ts`, `rain-curtain-golden.test.ts`)
ficam iguais: eles rodam no caminho padrão. O caminho `stable` ganha teste próprio (o `clear()` deixa uma `Fog` neutra; `fogOf` não muda).
O golden `rain-curtain-golden.test.ts` lê as linhas da página (`FOG_NEAR`, `fog.far`), que este desenho não toca.

## 5. Pools de geometria e de material

### 5.1 Geometria

```ts
export interface GeometryPool {
  /** The geometry for `key`, built once with `build`. Counts one use. */
  acquire(key: string, build: () => import('three').BufferGeometry): import('three').BufferGeometry
  release(geometry: import('three').BufferGeometry): void
  /** Never disposed while the pool lives (unit shapes, effect geometries warmed at load). */
  retain(key: string): void
  /** Disposes unretained geometries with no use, oldest first, down to `keep`. Only at load points (area change), never in play. */
  trim(keep?: number): number
  stats(): { readonly entries: number; readonly retained: number; readonly inUse: number }
  dispose(): void
}

export function createGeometryPool(): GeometryPool

/** Builds a key from a kind and its numbers, rounded to `step` (default 1e-3), so near-equal sizes share one geometry. */
export function geometryKey(kind: string, params: readonly number[], step?: number): string
```

- **Prefira forma unitária + escala** (prática do `mesh-layer`): a chave fica `sphere|6|4`, não o raio.
- Contagem de uso: em 0, a geometria **não** é descartada no meio do jogo; vai para a lista de ociosas e só sai no `trim()` de um ponto
  de carga. Descartar geometria não religa programa, mas obriga a reenviar o buffer na próxima vez (é o primeiro envio da granada).

### 5.2 Material

```ts
export interface MaterialPool {
  /**
   * The material for `key`, built once. Shared: callers must not change it (the pool warns in dev when `material.version` moves after
   * the first render). Per-instance variety goes into instance attributes, not into new materials.
   */
  acquire<TMaterial extends import('three').Material>(key: string, build: () => TMaterial): TMaterial
  release(material: import('three').Material): void
  /** Declares a variant that must never be disposed (its program stays linked). Effects register theirs at load. */
  register<TMaterial extends import('three').Material>(key: string, build: () => TMaterial): TMaterial
  /**
   * A material the caller owns and changes per frame (a puff's opacity): not shared, disposable. The first one of its program family is
   * handed to the anchors instead (§ below), so disposing the others never frees the program.
   */
  own<TMaterial extends import('three').Material>(build: () => TMaterial): TMaterial
  trim(keep?: number): number
  stats(): { readonly entries: number; readonly registered: number; readonly inUse: number; readonly families: number }
  dispose(): void
}

/** Materials kept alive and never disposed, one per program family: what keeps a program linked once its users are gone. */
export interface MaterialAnchors {
  /**
   * Keeps `material` if any of its program keys (`programKeysOf`) has no anchor yet; returns true when it was kept (the caller must then
   * not dispose it). A material whose keys are all covered returns false and may be disposed.
   */
  offer(material: import('three').Material): boolean
  readonly size: number
}

export function createMaterialPool(options?: { readonly anchors?: MaterialAnchors; readonly renderer?: import('three').WebGLRenderer }): MaterialPool

/** Key from the material class and every parameter that changes its look, sorted, numbers rounded. */
export function materialKey(type: string, params: Readonly<Record<string, unknown>>): string
```

- **Nunca descartar uma variante registrada:** o three libera o programa quando o último material que o usa é descartado
  (`usedTimes` vai a 0, `WebGLPrograms.js:611-613`). Guardar uma referência JS a um material não segura nada: o `dispose()` dispara
  `onMaterialDispose` → `releaseMaterialProgramReferences` → `releaseProgram` (`WebGLRenderer.js:764`) mesmo com a referência viva. Só um
  material **vivo e nunca descartado** segura o programa. Por isso a âncora é um material que ninguém descarta, e todo descarte de material
  de pool passa pelo pool, nunca direto.
- **Âncora por família = pela `cacheKey` real do programa.** A primeira versão deste desenho montava a família à mão (classe + `defines`
  + `customProgramCacheKey()` + flags) e errou uma flag: no r160, `opaque` (`material.transparent === false && material.blending ===
  NormalBlending`, `WebGLPrograms.js:248`) **entra** na chave (camada 17 de `_programLayers`, `:549`). Montar a chave à mão vai errar de
  novo na próxima versão do three. A família passa a ser a chave que o próprio three calculou: depois do primeiro render em que o material
  aparece, as chaves dos programas que o three ligou para ele.
  - **Um material, várias chaves.** O three guarda por material um `Map` de `cacheKey` → programa (`properties.get(material).programs`,
    criado e preenchido em `getProgram`, `WebGLRenderer.js:1614-1648`; as entradas nunca saem até o descarte). O mesmo material desenhado
    com neblina linear e exponencial, com e sem sombra, ou com contagens de luz diferentes tem uma chave por estado, e o `dispose` libera
    **todas** (`releaseMaterialProgramReferences` percorre o `Map`, `WebGLRenderer.js:756-762`). Olhar só o `currentProgram` deixaria a
    chave de outro estado sem âncora e o descarte a liberaria.
  - O pool (com `renderer` nas opções) lê **todas** as chaves no primeiro `release`/descarte e as entrega a `anchors.offer`. O `offer`
    guarda o material como âncora se **alguma** das chaves dele ainda não está coberta, e então marca todas as chaves dele como cobertas;
    se todas já estão cobertas, o material pode ser descartado sem religar nada. "Coberta" é o conjunto das chaves dos `Map` das âncoras,
    relido a cada `offer` (as âncoras são poucas, uma por família, e uma âncora que ainda é desenhada ganha chaves novas).
  - **Risco:** `renderer.properties` e o `Map` `programs` são internos do r160 (não documentados, sem garantia entre versões). O pacote
    isola a leitura numa função `programKeysOf(renderer, material): readonly string[] | undefined` (`[...programs.keys()]`), com teste que
    roda contra o three instalado; se a leitura devolver `undefined` (outro three), o pool cai para o modo conservador: **todo** material
    vira âncora no primeiro descarte da sua chave exata (mais memória, nenhuma recompilação). O `peerDependency` de three fica em
    `^0.160.0` e o teste falha numa major nova.
  - Um material que ainda não foi desenhado não tem o `Map` (ou o tem vazio): descartá-lo não libera programa, e ele não é oferecido.
- **Chaves de cor exata ilimitadas** (a fumaça do veículo com cor por baforada) não religam programa: só a família importa para o
  programa, e a âncora da família fica.
- **Aviso em desenvolvimento ao descartar recurso de pool:** o pool marca o que entrega (`userData.__pooled = key`) e, em
  desenvolvimento, embrulha o `dispose` desses materiais e geometrias com um `console.warn` que diz quem é o dono. É o caso de hoje em
  `game-weapons-three/src/fx/heavy.ts:138-141`, que descarta a geometria e o material de cada chama e os materiais do foguete ao apagar
  o fogo; com o pool, esse descarte vira `release`, e o aviso pega quem esquecer.
- **Variedade por instância (D11):** o pool não multiplica materiais por agente. A variedade da horda (tom de pele, paleta, escala,
  máscara de ferimento e membro, fase e velocidade da animação) entra como atributos de instância (`InstancedBufferAttribute` `aTint`,
  `aScale`, `aWound`, `aPhase`) lidos por um `onBeforeCompile` registrado **uma vez** por família (`customProgramCacheKey` fixo, por
  exemplo `'|crowd-variety-1'`). O número de programas é tipos × patches, nunca × agentes. Escala e máscara de membro mudam a silhueta,
  então o mesmo patch vai para o `customDepthMaterial` (já existe em `body-batch.ts:50`) **e** para um `customDistanceMaterial` novo, e os
  dois são sondas do `warmUp` (seção 4, passo 3).
- **Lição da cor por instância** (`game-terrain-three/src/layers.ts`): `instanceColor` muda a chave do programa (`instancingColor`).
  O pool de malhas instanciadas cria o atributo de cor por instância **na criação**, nunca no primeiro uso.

## 6. Migração por pacote (T4.4 a T4.6) e os goldens

### 6.1 O que os goldens e testes leem (conferido no código)

| Teste | O que lê | Efeito da migração | Decisão |
|---|---|---|---|
| `game-urban-three/tests/parts-golden.test.ts`, `patterns-golden.test.ts` (fixtures `urban-parts.json`, `urban-patterns.json`) | cada nó `PointLight`/`SpotLight` da cena com posição, cor, intensidade, distância, decaimento, ângulo | caminho com orçamento não tem esses nós | goldens ficam no **caminho legado** (sem `lights`), que é o padrão; teste novo para o caminho com orçamento |
| `game-interactables-three/tests/fixtures/exact-mesh-api.json` | nós `PointLight` dentro do grupo do móvel (`"0/2 PointLight …"`) | idem | idem; `mesh.test.ts` "creates real lights for api.light" fica no legado |
| `game-vfx-three/tests/team-golden.test.ts` | `root.children[5]` (choques) e `root.children.at(-1)` (marcas) | tirar `lights.group` mudaria índices | `lights.group` fica no `root`, vazio, no caminho com orçamento |
| `game-vfx-three/tests/renderer.test.ts:44`, `viewmodel-flash.test.ts:88` | `PointLight` acesa no grupo do vfx | não há luz no grupo com orçamento | ficam no legado; testes novos leem `budget.stats().lit` |
| `game-weapons-three/tests/viewmodel.test.ts:191-214` | contagem de luzes da cena constante e `getObjectByName('rocket-light')` | contagem constante continua verdadeira; o nome some com orçamento | fica no legado; teste novo prova o mesmo com o orçamento (`budget.check(renderer, scene).ok`) |
| goldens de geometria (`game-vehicles`, `game-floorplan-three`, `game-weapons-three`, `game-vfx-three` marcas) | buffers, versões de atributo, nós | pools só mudam a **identidade** do objeto (dois nós apontam para a mesma geometria), nunca o conteúdo | iguais; a regra é não mexer em `version` de atributo fora do caminho que já mexia (lição 1) |
| `game-weather-three/tests/renderer.test.ts:177-181`, `bench-visual.test.ts:49-57`, `rain-curtain-golden.test.ts` | tipo da neblina (`isFog`, `isFogExp2`, `far`, `density`) e `scene.fog` nulo com a camada desligada; linhas da página | a neblina estável (seção 4.1) não põe `null` | ficam no caminho padrão (sem `stable`); teste novo para `stable`; o relâmpago com vaga do orçamento ganha teste novo e o legado fica |
| chave de programa e pixel | nenhum golden faz hash de chave de programa nem de pixel (`grep` por `readPixels\|toDataURL\|customProgramCacheKey` nos `tests/` só acha miniaturas de itens, `merge.test.ts` e `node-skin.test.ts`, que não tocam em luzes) | a contagem de luzes muda o programa, não o golden | os goldens rodam em Node sem WebGL; quem prova o programa é o `perf.mjs` (`linkProgram` contado) |

**Regra:** todo cliente ganha a opção `lights?: LightBudget`; sem ela, o caminho é o de hoje, byte a byte. O caminho legado fica
`@deprecated` (D2) e sai na próxima major, quando os fixtures de luz são regenerados num changeset que explica a troca.

### 6.2 Ordem dos commits

Cada commit: `typecheck` e `test` do pacote, `git diff --exit-code` nos fixtures, `node examples/test-room/test.mjs` e `perf.mjs` (CI).
**Conservação da contagem:** a sala cria o orçamento já no T4.3 com tamanho 0 e, a cada commit, o tamanho sobe exatamente pelas luzes
que o cliente migrado deixou de criar. Assim o número de luzes da cena da sala nunca muda num commit, e o `perf.mjs` compara igual.

| Commit | Pacote | O que muda |
|---|---|---|
| T4.3 | `game-render-three` | pacote com `ThreeLib`, `LightBudget`, `ProgramWarmup`, pools, testes; a sala cria `createLightBudget(THREE, scene, { point: 0, spot: 0 })` |
| T4.4a | `game-vfx-three` | `lights` opcional; blast, fogo e Oficina viram pedidos; sala `point += 12` |
| T4.4b | `game-floorplan-three` | `lighting({ budget })` arrenda; máscaras indexadas por `slot` e com `sizes.point` entradas; sala `point += 6`, `pointShadows = 2` |
| T4.4c | `game-weapons-three` | foguete por pedido; lanterna de trilho por fonte; sala `point += 1`, `spot += 1` |
| T4.4d | `game-interactables-three` | lâmpadas por fonte (aqui a contagem **cai**: as lâmpadas passam a disputar vagas; a sala fixa `point += 3` e o `perf.mjs` mostra 0 programas ao quebrar lâmpadas, que hoje recompila) |
| T4.4e | `game-characters-three` | sinalizador por pedido |
| T4.4f | `game-weather-three` | faróis por fonte; `spot += 2`; relâmpago por `leaseHemisphere` (sala `hemisphere = 1`). A contagem hemisférica da cena **muda de 1 para 2 desde o boot** quando ainda não há renderizador de clima: hoje a sala tem só a hemisférica da arena até o `createLightning` (`game-weather-three/src/renderer.ts:69`) criar a segunda quando o clima nasce; com a vaga, a segunda existe desde o boot. É inofensivo: o `warmUp` do boot já compila com 2, a vaga fica com intensidade 0 (soma 0 na irradiância, o pixel não muda) e o clima, ao nascer, não muda mais a contagem (era essa troca que recompilava); `createFog({ stable: true })` e `fogStates: ['linear', 'exp2']` no `warmUp` da sala |
| T4.4g | `game-urban-three` | partes `light` por fonte; `game-urban` ganha `LightAllowance` |
| T4.4h | lint | `no-runtime-light` vira `error` (seção 6.4); a sala passa a `point: 16, spot: 4` (o padrão) se o `perf.mjs` mantiver os orçamentos |
| T4.5a | `game-render-three` + `game-vehicles` | Fumaça e faíscas do veículo. As baforadas **mudam o próprio material a cada quadro** (`particles.ts:231-232`: `material.rotation`, `material.opacity`, `material.userData.dis.value`), então não podem dividir um material. Escolha: o material continua **por partícula** (`pool.own(build)`), e o `killParticle` (`particles.ts:133-138`, hoje `P.m.material.dispose()`) passa a chamar `pool.release(material)`, que oferece o primeiro de cada família às âncoras e descarta os outros sem liberar o programa. Mover as baforadas para o `host.effects` com atributos por instância (opacidade, rotação, dissolução) é a metade da T4.5 que tira os materiais por partícula de vez; fica num commit depois deste. **Camada:** o `game-vehicles` é L2 e não importa `game-render-three` (L4): o pool chega por opção com um tipo estrutural declarado no próprio `game-vehicles` (`type ParticleMaterials = { own<T>(build: () => T): T; release(material: unknown): void }`), que o `MaterialPool` satisfaz. Sem a opção, o caminho é o de hoje |
| T4.5b | `game-weapons-three/src/fx` | gotas e chamas do foguete: geometria do pool (`acquire('sphere|6|4')` com escala), material do pool, sem `clone()` por gota; os `dispose()` de `heavy.ts:138-141` viram `release` |
| T4.6 | todos os adaptadores com `warmUpProbes` + sala | `registerWarmup` (materiais das sondas vão para as âncoras); efeitos de todos os explosivos; sai `warmUp`/`warmUpEffects` da sala; **o `pinPrograms` continua** neste commit; medição dos 36 ms antes e depois (seção 4) |
| T4.5c | `game-test-room` | sai `pinPrograms`; o `perf.mjs` prova 0 programas (`linkedSince`) na tempestade e no repouso depois dela sem ele |

**Por que a T4.6 vem antes da T4.5c.** O `warmUp` da sala descarta as sondas (`room.ts:3195-3197`) e só não perde os programas porque o
`pinPrograms` segura um uso de cada um. Tirar o `pinPrograms` antes de as sondas entregarem os materiais às âncoras faria cada sonda
descartada liberar o programa que acabou de ligar, e o primeiro tiro religaria tudo. Na ordem nova, a T4.6 põe as âncoras (materiais
das sondas e dos pools, nunca descartados) com o `pinPrograms` ainda ligado, e o `perf.mjs` mostra que nada muda; a T4.5c tira o
`pinPrograms` e o `perf.mjs` prova que as âncoras bastam. Se a T4.5c tiver de vir antes por algum motivo, ela mantém os materiais das
sondas vivos (sem `dispose`) até a T4.6.

A ida das partículas para o `host.effects` (a outra metade da T4.5) usa os mesmos pools e não muda nada aqui.

### 6.3 Por que cada commit mantém os goldens

- **Luz:** os goldens que leem nós de luz rodam no caminho legado, que não muda. O caminho novo não tem golden antigo para quebrar.
- **Intensidade 0:** uma vaga apagada contribui 0 ao pixel; e não há golden de pixel.
- **Contagem de luzes:** muda a chave de programa da cena da sala, que nenhum golden lê; a conservação da seção 6.2 mantém o
  `perf.mjs` comparável commit a commit.
- **Pools:** compartilhar a geometria não muda o conteúdo dos buffers que os goldens leem. A exceção a vigiar é quem **escreve** na
  geometria ou no material depois de recebê-los (amassar, desgaste): esses continuam com cópia própria (`clone` na hora de deformar,
  como já fazem), e o modo de desenvolvimento do pool avisa quando a `version` de um compartilhado muda.

### 6.4 Lint

A regra de hoje (`eslint.config.mjs`, aviso, ignora `game-render-three` e `game-vfx-three`) passa a:

```js
{
  files: ['packages/*/src/**/*.{ts,tsx}'],
  ignores: ['packages/game-render-three/**', 'packages/game-test-room/**'],
  rules: {
    'no-restricted-syntax': ['error',
      { selector: "NewExpression[callee.property.name=/^(PointLight|SpotLight|RectAreaLight|DirectionalLight|HemisphereLight|AmbientLight)$/]", message: 'Ask the LightBudget of game-render-three (spec 005 D4).' },
      { selector: "NewExpression[callee.name=/^(PointLight|SpotLight|RectAreaLight|DirectionalLight|HemisphereLight|AmbientLight)$/]", message: 'Ask the LightBudget of game-render-three (spec 005 D4).' },
      { selector: "AssignmentExpression[left.property.name='castShadow'][left.object.name=/[Ll]ight$/]", message: 'Shadow slots are fixed at boot (spec 005 D4).' },
    ],
  },
}
```

- `game-vfx-three` sai da lista de ignorados (as luzes dele passam pelo orçamento).
- O caminho legado de cada pacote leva `// eslint-disable-next-line no-restricted-syntax -- D2: legacy path without LightBudget, removed in the next major`.
  A regra `eslint-comments/require-description` (ou o `reportUnusedDisableDirectives` do ESLint) impede desligamento sem motivo, e o
  CI conta os desligamentos: o número só pode cair.
- O `arena.ts` da sala é host e fica fora (sol e céu no boot).
- **Allowlist com motivo** (arquivo, não pacote): `packages/game-items-three/src/thumbnails.ts` (cena de miniatura própria, fora da tela,
  com renderer próprio; seção 3.6). O relâmpago **não** entra na allowlist: o caminho com orçamento usa `leaseHemisphere`, e o legado
  leva o comentário `D2: legacy path` como os outros.

## 7. Testes do pacote

Vitest, em Node (sem WebGL), salvo o teste 2:

1. **Vagas:** `point: 4, pointShadows: 2, hemisphere: 1` cria 4 luzes pontuais, as 2 primeiras com `castShadow`, e 1 hemisférica, todas
   visíveis, `intensity` 0, `layers` com todas as camadas; o grupo é `scene.children[0]` mesmo numa cena que já tinha filhos.
2. **Índice do shader, no navegador** (em `examples/test-room/perf.mjs`, fase nova `light_slots`, CI e GPU). Reproduzir a ordenação do
   three em Node só provaria que a cópia da ordenação concorda consigo mesma. A prova lê o que o three de fato enviou: com a sala montada
   (casa, vfx, armas, tudo o que ela carrega), para cada vaga `k`, acende só ela com uma cor única e posição única via
   `acquire`/`handle.update`, desenha um quadro e lê, de um material com luz da cena,
   `renderer.properties.get(material).uniforms.pointLights.value[handle.slot]` (cor igual a `cor × intensidade`; posição igual à
   posição da vaga em espaço de vista). Falha se qualquer `slot` apontar para outra luz. Mesmo teste para `spotLights` e para a máscara
   de cômodo (a vaga arrendada `k` tem a caixa do cômodo no índice `handle.slot` de `uRB0`).
3. **Contagem fixa:** 1.000 `acquire`/`release`/`addSource`/`remove` aleatórios (semente fixa) e a assinatura `check(renderer, scene)` nunca
   muda; uma `PointLight` avulsa posta na cena aparece em `strays` e derruba `ok`.
4. **Estado selado:** depois do `seal`, trocar `scene.fog` de `Fog` para `FogExp2` com `fogStates: ['linear']` dá `ok: false`; com
   `['linear', 'exp2']` dá `ok: true`; trocar `toneMapping`, `outputColorSpace`, `shadowMap.type` ou pôr `scene.environment` dá
   `ok: false`; com a neblina neutra (`near = 6.0e4`), uma câmera com `far = 7e4` dá `ok: false` e com `far = 140` dá `ok: true`.
5. **Preempção:** cheio de lâmpadas, um `urgent` toma a vaga da de menor prioridade e menor contribuição no mesmo `present`; sem
   `urgent`, a vítima esmaece em `fadeMs` antes; pedido de prioridade menor que todos recebe `null`.
6. **Reserva:** com `urgentReserve: 2`, lâmpadas nunca ocupam as 2 últimas vagas livres.
7. **Histerese:** duas fontes à mesma distância trocando de lugar 1 cm por quadro não trocam de vaga.
8. **`follow`:** uma fonte com `follow` acompanha o objeto movido entre dois `present`; o objeto lido uma vez por `present` (contado com um
   `getWorldPosition` espionado); `follow` fora da cena apaga a fonte.
9. **Arrendamento:** `lease` devolve vagas fixas, nunca preemptadas; arrendar mais que o livre dá `null`; `leaseHemisphere` além do
   tamanho dá `null`.
10. **Warmup:** com um renderer falso que conta `compile`/`render`/`initTexture`/`setRenderTarget`, cada sonda e efeito é desenhado o
    número de vezes certo, uma vez por estado de neblina pedido, no `target` pedido; toda vaga de sombra recebe `needsUpdate = true` antes
    do render; o orçamento fica selado; nenhum material de sonda é descartado (espião no `dispose`), e `anchors.size` cresce.
11. **`linkedSince`:** com um contexto falso, chamadas de `linkProgram` depois do `warmUp` são contadas, inclusive as que não mudam
    `renderer.info.programs.length` (programa liberado e religado).
12. **Pools:** a mesma chave devolve o mesmo objeto; `release` até 0 não descarta; `trim` não descarta registrado nem âncora de família;
    `own` + `release` de dois materiais da mesma família guarda o primeiro e descarta o segundo; `dispose` direto de um recurso de pool
    gera o aviso em desenvolvimento.
13. **`programKeysOf`:** contra o three instalado, com um `WebGLRenderer` sobre contexto falso (o mesmo truque dos testes do
    `game-vfx-three`) ou no `perf.mjs` quando não houver contexto falso que chegue a ligar programa: dois materiais que só diferem em
    `transparent` dão chaves diferentes (a flag `opaque`); dois que só diferem em `color` dão a mesma; um material desenhado com `Fog` e
    depois com `FogExp2` devolve **duas** chaves, e um segundo material igual desenhado só com `Fog` é oferecido depois do primeiro e
    recusado (coberto), enquanto o inverso (âncora só com `Fog`, oferta com as duas) é guardado. O teste falha se a leitura devolver
    `undefined`, que é o aviso de que o three mudou o interno.

## Aceite

```bash
pnpm --filter @adatechnology/game-render-three typecheck && pnpm --filter @adatechnology/game-render-three test
pnpm -r --filter "./packages/game-{vfx,floorplan,weapons,interactables,characters,weather,urban}-three" test
pnpm --filter @adatechnology/game-vehicles test && pnpm --filter @adatechnology/game-urban test
git diff --exit-code -- 'packages/*/tests/fixtures'          # goldens iguais em todos os commits
pnpm lint                                                     # no-runtime-light em erro, 0 violações
grep -rnE "(PointLight|SpotLight)\(" packages/*/src | grep -v game-render-three | grep -v "D2: legacy path"   # vazio
grep -n "pinPrograms\|warmUpEffects" packages/game-test-room/src/room.ts                                    # vazio (T4.5c, T4.6)
pnpm build && node examples/test-room/build.mjs && node examples/test-room/test.mjs
node examples/test-room/perf.mjs                              # CI: 0 programas em todas as fases, buffers ≤ 40 por explosão quente
PERF_MODE=gpu node examples/test-room/perf.mjs                # GPU: cold_frag_grenade e cold_molotov sem quadro > 33,4 ms
# perf.mjs fase light_slots: pointLights[slot] e spotLights[slot] conferem com cada vaga (seção 7, teste 2)
pnpm check:layers                                             # game-render-three em L4; nenhum -three de domínio importa outro para luz
```

## Perguntas em aberto

- **Explosão iluminando dentro da casa.** Hoje a máscara de cômodo zera, nos materiais da casa, toda luz que não é de cômodo, e por
  isso o clarão de uma granada dentro da sala não ilumina as paredes. Este desenho mantém isso (os goldens e o visual não mudam). Com o
  `slot` confiável, dá para dar à luz de explosão a caixa do cômodo onde ela está e acender as paredes certas. Recomendação: fazer, mas
  num commit próprio depois da T4.4b, com print antes e depois, porque muda o visual. Decide o dono.
