# Spec 004 — Um corpo só para a 1ª e a 3ª pessoa

## Por quê

O jogador hoje tem **dois esqueletos**: os braços da 1ª pessoa (`game-characters-three/src/first-person/`, rig próprio em espaço de
câmera, clipes `FIRST_PERSON_CLIPS`) e o corpo da 3ª pessoa (`player/avatar.ts`, o humano do Bestiário/Elenco). A sala mostra um ou o
outro (`room.ts:1116-1120`). Toda ação precisou ser feita duas vezes: soco, empurrão, agachar, segurar, porta (#110) e sentar
(#119 → #121). O que entra só de um lado fica faltando do outro: o sentar saiu só na câmera, e o corpo ficou em pé no assento.

O dono (2026-10-30): "é um personagem, já deveria refletir… separar é muito errado". A spec 002 (D2, 2026-10-23) tinha decidido o
contrário, com braços de CPU à parte porque o corpo não tinha dedos. Isso deixou de valer: o corpo já usa a mesma mão do Retratos
(`hand.ts`, #120) e já alcança alvos com IK (`arm-reach.ts`, #112).

## Requisitos

- **R1 — Um corpo.** O mesmo `createPlayerAvatar` é desenhado nas duas vistas. Não existe mais rig de braços separado.
- **R2 — A câmera da 1ª pessoa mora na cabeça.** O olho é o ponto dos olhos do corpo depois da pose do quadro. Agachar, sentar,
  deitar, cair, curvar sobre um móvel baixo e empurrar mudam a câmera porque mudam o corpo, sem constantes paralelas (`CROUCH_DROP`,
  `setBend`, olho do assento).
- **R3 — A própria cabeça não tapa a vista.** Em 1ª pessoa, cabeça e pescoço não aparecem para a câmera do jogador, mas continuam
  para sombras, espelhos e outras câmeras.
- **R4 — Os braços que se vê são os do corpo.** A mão vai aos `HandTargets` (arma, item carregado, empurrão, porta) pelo IK do
  corpo, nas duas vistas. Em 1ª pessoa valem as restrições de vista que hoje estão nos braços: dobra mínima do cotovelo
  (`reachBend`) e mão fora da parede e a 0,12 m do olho (`keepOutside`). O `elbowView` não vem (decidido em 2026-10-31: ele só
  escondia a ponta cortada de um braço solto).
- **R5 — Uma animação por ação.** Os golpes usam os `ATTACK_CLIPS` do corpo nas duas vistas. Os `FIRST_PERSON_CLIPS` saem.
- **R6 — Arma e item no corpo.** A arma fica na mão do corpo (`holdFrame`/`bodyHold`) também em 1ª pessoa. Acaba o posicionamento
  em espaço de câmera (`HAND_OFFSET`, `HANDGUN_OFFSET`, escala de 0,55/0,75). O item carregado vai na mão do corpo, sem offsets de
  câmera.
- **R7 — Mesma pose nas duas vistas.** Trocar de vista (V) no meio de qualquer ação não muda a pose: um teste compara a posição
  das mãos, dos pés e da cabeça antes e depois da troca.
- **R8 — Tudo configurável** (`CLAUDE.md` §2): ponto do olho, camadas, restrições de vista e plano próximo da câmera por opção, com
  os valores atuais como padrão.

## Decisões (2026-10-30)

- **D1 — O corpo dirige o olho; o jogador dirige posição, direção e mira** (revista com o dono em 2026-10-31). `player.ts` continua
  dono de x, z, yaw, pitch, colisão e passos. O olho é o ponto dos olhos do corpo (soquete sob a cabeça, `eyeOffset` padrão
  `(0, −0,068, 0)`, que dá 1,70 m em pé), lido depois da pose e antes do IK das mãos. Se esse ponto cair dentro de uma parede, ele
  recua na linha do centro do jogador até sair dela. A câmera da 1ª pessoa fica nele, e a simulação (tiro, alcance, raio de mira)
  parte dele **nas duas vistas**.
- **D2 — Esconder só para a câmera do jogador** (revista com o dono em 2026-10-31). Cada malha da cabeça (tudo o que se desenha
  sob `headG`) e o pescoço (o cilindro que o construtor põe em `U` logo antes de `headG`, pego por identidade) ganham
  `onBeforeRender`/`onAfterRender`: quando a câmera é a do jogador em 1ª pessoa, desligam `colorWrite` e `depthWrite` só naquele
  desenho e religam em seguida. Sem clones. A sombra (que não chama `onBeforeRender`), os espelhos e as outras câmeras continuam
  vendo a cabeça. Camada foi descartada: no three r160 ela também apaga a sombra (`WebGLShadowMap.js:335`) e o espelho
  (`Reflector.js:50`).
- **D3 — Restrições de vista viram opção do IK do corpo** (`arm-reach.ts`), ligadas só em 1ª pessoa. O código vem de `arms.ts`
  (porte, não reescrita).
- **D4 — Ordem com o trabalho em andamento:** a fase 1 é aditiva e pode começar já. As fases 2 a 4 começam depois do merge do #110
  (portas), que hoje mexe em `room.ts`, `avatar.ts` e no alvo de mão da 1ª pessoa.
- **D6 — Sensação** (dono, 2026-10-31): agachado, o olho é o do corpo (1,38 m, não mais 1,15 m). O balanço da cabeça ao andar e
  correr passa para a câmera pela metade (`eyeBob` padrão 0,5, por opção).
- **D5 — A spec 002 é substituída** na parte de braços separados (R1, R3, D2 dela). O resto dela (câmera de ombro, agachar) segue.

## Fora do escopo

- Mira pelas miras da arma (ADS), recarga animada no corpo e câmera de ombro: ficam como estão ou na spec 002.
- Pernas visíveis ao olhar para baixo em 1ª pessoa: saem de graça com R1, mas não há trabalho para afinar.

## Pontos em aberto

Nenhum. As escolhas acima foram tomadas para não travar a execução. Mudar alguma delas é uma conversa com o dono antes da fase
correspondente.
