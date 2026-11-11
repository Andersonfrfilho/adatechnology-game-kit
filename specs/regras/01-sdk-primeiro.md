# 1. O SDK guarda tudo o que os times já fizeram — **OBRIGATÓRIO**

Texto completo da seção 1 do `CLAUDE.md` da raiz (lá fica só o resumo). Regra em vigor: mudar aqui é mudar a regra.

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
  `tools/kit-audit/rules.json`; o MCP `game-kit` (`.mcp.json`) responde `kit_owner`, `kit_origin` e `kit_audit`, e a skill `game-kit` (seção "De onde vem cada peça") diz como.
- **Parede sempre como as casas** (dono, 2026-10-29): toda parede ou muro (sala de teste, área, prévia, cena de jogo) tem o mesmo visual e o
  mesmo padrão de sustentação das paredes das casas. Use `wallPiece` do `game-floorplan-three` (a estrutura do `game-floorplan-structure`:
  parede sobre a fundação, pilares de concreto armado ao longo dela (nas pontas, nos encontros, ao lado dos vãos e a cada 4 m no máximo), cinta de concreto em cima, camadas, tijolos e furo; desenhada pelo renderizador das casas com reboco, pintura, rodapé
  e calçada) ou a casa inteira. Nada de parede de blocos soltos, cubos coloridos ou estrutura montada à parte.
- **Peça fora do dono fica documentada**: `node tools/kit-audit/audit.mjs --check` roda no CI e falha numa peça nova desenhada fora do SDK
  dono. `node tools/kit-audit/scene.mjs --check` (na rodada diária de GPU, não no CI: abre o navegador, ver seção 9) abre cada área da sala de teste e falha em tudo o que aparece na tela sem a marca
  de origem de um construtor do kit (`markKitOrigin` do `game-contracts`); todo construtor de peça novo marca a raiz que devolve. O que ainda está fora está em `docs/pecas-fora-do-sdk.md` (peça, onde, dono certo, PR de origem, correção) e em `pending` do
  `tools/kit-audit/allowlist.json`; ao corrigir, tire das duas listas.
- Ao terminar uma migração, atualize o inventário da spec de migração (`specs/`) marcando o que entrou e onde.
