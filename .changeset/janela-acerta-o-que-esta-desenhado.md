---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-destruction-three': patch
'@adatechnology/game-floorplan-structure': minor
'@adatechnology/game-floorplan-three': minor
---

O tiro na janela acerta o que está desenhado. `PartSpec.apertures`: vãos de uma peça (o vão da janela numa parede, a área do vidro num caixilho, o vão de uma grade com as barras); o raio que entra num vão segue, a não ser que bata numa barra. No detalhe `coarse` (o das casas), cada parede leva os vãos das suas janelas (`withWindowApertures`): antes, o tiro na janela batia no tijolo invisível da parede ou na caixa maciça do caixilho. O caixilho tem massa real (perfis de alumínio e peitoril: 18 kg numa janela de 1,4 m, antes 182 kg) e é aberto onde está o vidro; a grade virou peça de aço própria (`window_grille:*`), com as barras. O raio que passa pelo buraco aberto numa parede usa o mesmo referencial do objeto em todos os lugares.

A área de casas abre direto numa casa pelo endereço (`?area=floorplan_area&template=mansion&seed=1&state=abandoned`, `floorplanAreaParams`), e planta registrada que nenhum grupo lista entra no grupo "Outros" da bancada.

O pó e as fibras de uma peça desenhada pela casa (sem malha própria no renderizador) saem na cor padrão, em vez de um erro "failed to apply debris".
