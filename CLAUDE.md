# AdA Technology Game Kit — regras do projeto

## 1. O SDK guarda tudo o que os times já fizeram — **OBRIGATÓRIO**

Este repositório é a base de **todo jogo futuro**, não só do ZombiAdA. Um jogo novo tem que começar com armas, casas, itens,
zumbis, personagens, veículos, vegetação, efeitos e animais **já prontos, com os comportamentos funcionando**.
Por isso o trabalho que os times entregaram vem para cá **uma vez**, e daí em diante tudo se monta a partir daqui.

**SDK primeiro em todo jogo** (dono, 2026-10-29): todo desenvolvimento de jogo do nosso lado (este repositório, o `zombiada` e qualquer
jogo novo) começa verificando se o SDK já tem aquilo. Tem: usa o pacote, importado. Não tem: cria primeiro no pacote certo do SDK e só depois
usa no jogo. Assim nunca se escreve o mesmo código duas vezes. O repositório de cada jogo repete esta regra no seu `CLAUDE.md`.

Antes de construir qualquer coisa (modelo 3D, animação, comportamento, efeito, tela ou ambiente de teste), nesta ordem:

1. **Procure no SDK** (`packages/*`, os README de cada pacote).
2. **Procure nas entregas dos times**: o site das equipes (`Andersonfrfilho/zombiada`, pastas `site/pages/<seção>/` e o portal
   `site/portal/portal-equipes.html`, que lista cada time com suas prévias e arquivos). Exemplos: Galeria 3D do Arsenal
   (armas com medida real, munição por calibre, tiro, recarga por tipo, pane, explosivos), Itens do Vale Cinzento, Bestiário e Elenco
   (zumbis, corpos, cortes, andar), Retratos e Os Vivos do Vale (sobreviventes), Bichos do Vale, Oficina de VFX e Laboratório de
   Explosões, Galeria do Vale Cinzento (tipologias de casa, prédios, mobília, postes, interiores), Bancada de Hordas.
3. **Só então crie**, e só o que de fato não existe.

- Achou na entrega de um time e não está no SDK: **porte a entrega** para o pacote certo, preservando medidas, animações,
  comportamentos e nomes de peças. **Proibido reescrever "parecido"** ou pôr substituto (caixas, placeholder) quando o time já
  entregou a versão real.
- Não achou nem no SDK nem nas entregas, ou a entrega está incompleta: **pergunte** antes de inventar.
- **Nada desenhado à mão quando o kit já tem** (dono, 2026-10-29): cenário de sala de teste, área de exemplo, prévia ou cena de jogo
  usa as peças do kit (móveis, paredes, itens, veículos, plantas) pelo catálogo, nunca caixas ou geometria montada na hora "parecida".
  Se a peça não existe no kit, ela entra primeiro num pacote do kit e só então é usada.
- **Cada peça vem do SDK dono, importada** (dono, 2026-10-29): carro e veículo sempre do SDK de veículos (`game-vehicles-three` com a
  frota), parede e casa do `game-floorplan`, móvel do catálogo de móveis, pessoa do `game-characters`, planta do `game-vegetation`, item do
  `game-items-goods`, arma e explosivo do `game-weapons`. Importe pelo pacote (ou receba o construtor por opção, como o `vehicles` do
  `createWeatherVisual`), nunca copie o modelo: a mudança no SDK tem que aparecer em todo lugar que usa a peça. Quem é dono de quê está em
  `tools/kit-audit/rules.json`; o MCP `game-kit` (`.mcp.json`) responde `kit_owner`, `kit_origin` e `kit_audit`, e a skill `kit-origem` diz como.
- **Parede sempre como as casas** (dono, 2026-10-29): toda parede ou muro (sala de teste, área, prévia, cena de jogo) tem o mesmo visual e o
  mesmo padrão de sustentação das paredes das casas. Use `wallPiece` do `game-floorplan-three` (a estrutura do `game-floorplan-structure`:
  parede sobre a fundação, cinta de concreto em cima, camadas, tijolos e furo; desenhada pelo renderizador das casas com reboco, pintura, rodapé
  e calçada) ou a casa inteira. Nada de parede de blocos soltos, cubos coloridos ou estrutura montada à parte.
- **Peça fora do dono fica documentada**: `node tools/kit-audit/audit.mjs --check` roda no CI e falha numa peça nova desenhada fora do SDK
  dono. `node tools/kit-audit/scene.mjs --check` também: abre cada área da sala de teste e falha em tudo o que aparece na tela sem a marca
  de origem de um construtor do kit (`markKitOrigin` do `game-contracts`); todo construtor de peça novo marca a raiz que devolve. O que ainda está fora está em `docs/pecas-fora-do-sdk.md` (peça, onde, dono certo, PR de origem, correção) e em `pending` do
  `tools/kit-audit/allowlist.json`; ao corrigir, tire das duas listas.
- Ao terminar uma migração, atualize o inventário da spec de migração (`specs/`) marcando o que entrou e onde.

## 2. Motor genérico; conteúdo de cada jogo no repositório do jogo

- O núcleo de cada pacote não conhece o ZombiAdA (nada de Vale Cinzento, facções ou nomes de cidade no código do motor).
- Conteúdo **reaproveitável por qualquer jogo** fica no SDK em pacote de conteúdo, como `-fleet`, `-species`, `-household`,
  `-residential`. Isso inclui coisas do mundo real com o nome real: armas com marca e modelo, calibres, veículos (decisão de 2026-10-23).
- **Teste do GTA** (dono, 2026-10-23): estamos fazendo um jogo de zumbi, mas o kit tem que servir igual a um GTA. Prédios, veículos,
  armas, pessoas e cidade são genéricos; o que é só de apocalipse zumbi (horda, triagem militar, barricada, infecção) entra como pacote
  à parte, estado (ex.: `game-floorplan-post-apocalyptic`) ou conteúdo do jogo, nunca no núcleo.
- **Mundo normal primeiro** (dono, 2026-10-23): o jogo começa antes do surto. O padrão de cada pacote é o mundo funcionando; o
  apocalipse é uma camada gradual (ver `game-infection`), nunca o estado único.
- **Tudo configurável** (dono, 2026-10-23): o kit já vem com muito conteúdo próprio pronto (armas, prédios, zumbis, itens, sons), e
  por isso cada jogo tem que poder usar o padrão, trocar valores, acrescentar e tirar itens **sem mexer no núcleo**: catálogos por
  registro, regras e números por opção, comportamento por plugin. Valor fixo no código só quando for constante física.
- Conteúdo **só de um jogo** (histórias, personagens nomeados, Vale Cinzento, sangue e marcas da horda) fica **no repositório do
  jogo**, que consome os SDKs do game-kit.
- three.js fica num adaptador `<lib>-three`, como `destruction-three`, `fluids-three`, `interactables-three` e `weapons-three`.

## 3. Os SDKs se compõem; o jogo só junta

A ideia do kit (dono, 2026-10-23) é **um SDK usar os outros para formar os itens e os elementos do mapa e do jogo**, e o jogo usar tudo
isso pronto. Exemplos: a casa (`game-floorplan-*`) usa os materiais e a estrutura da destruição (concreto armado, tijolo), os móveis
interativos, o catálogo de itens para os achados e a vegetação para o quintal; a cidade (`game-urban`) usa as casas, os veículos e a
multidão; a arma usa a destruição, os efeitos e o som. Antes de reimplementar algo dentro de um pacote, use o pacote que já faz aquilo.

## 4. Testes: contrato genérico, módulo específico por lib

- `game-test-room` e `game-contracts` têm **só contratos genéricos** (`TestableModule`, `ModuleArea`, `ModuleHost`, eventos de
  ferramenta). Nada de arma, carro ou móvel neles.
- O que é específico de um domínio (balcão de armas, arma na mão, cápsulas, sons) fica no pacote da lib e num
  `examples/<lib>-test-area` que carrega o módulo na sala com `room.loadModule`.
- Cada área da página do kit abre o seu ambiente de teste já montado (`?area=`).
