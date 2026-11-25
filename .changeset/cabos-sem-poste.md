---
'@adatechnology/game-floorplan-three': patch
---

Os cabos da rede da rua não caem mais no chão quando a casa abre com o kit de interativos. O poste de entrada da casa, desenhado pelo kit (`service_entrance`), não é peça de destruição: os oito trechos da rede mais perto dele pediam `pole:<u>` como suporte, não achavam nada e entravam soltos no mundo. Agora cada trecho fica preso ao poste desenhado como peça na outra ponta do vão. Um trecho que nomeia um suporte que não foi construído entra em `structure.unheld` em vez de ficar solto em silêncio, e o teste `wire-anchors` constrói todas as tipologias (sem e com o kit) e exige que todo cabo esteja preso a uma peça que existe e que cada lado da rede termine num poste.
