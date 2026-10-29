# Checklist das animações por arma

Gerado por `packages/game-weapons-three/tests/support/checklist-doc.ts` a partir de `tests/checklist.test.ts` (rode `WRITE_DOCS=1 pnpm --filter @adatechnology/game-weapons-three exec vitest run tests/docs.test.ts`); `tests/docs.test.ts` falha se este arquivo ficar diferente do que o teste mede. Cada ✓ ou ✗ vem de um teste automático que passa por **todas** as armas com modelo (114):

- **mão de apoio**: as duas mãos existem, ficam na frente do olho, dentro da vista e a até 12 cm do modelo na mão.
- **dedo no gatilho**: com peça de gatilho no modelo, o indicador direito repousa estendido, vai ao gatilho e puxa a cada tiro (metralhadora e lança-chamas seguram o gatilho), e volta; sem peça de gatilho a empunhadura é a normal (—).
- **recarga tática** e **recarga vazia/passos**: existe clipe para o tipo de recarga que a regra planeja, ele dura o tempo da regra (0,05 s) e marca os passos da regra nos mesmos segundos; na recarga vazia a mão que trabalha a ação está nos dados para o clipe que toca (`recargas-por-arma.md` tem os passos e as fontes).
- **tempo**: tática / vazia em segundos, a duração do clipe igual à da regra.
- **contato (não atravessa)**: com uma parede a 0,5 m do olho a arma recua e nenhuma parte dela passa da parede; a mão que atira sobe se ficaria fora da vista embaixo.
- **chute**: n/a (o chute é do corpo, não da arma; a arma segue como está).
- **som**: os cues de som dos clipes de recarga estão em ordem dentro da duração, cada um tem receita (`reload-sounds.json`); armas de tubo recarregam por cartucho e soam a cada `feed` da regra.

| arma | mão de apoio | dedo no gatilho | recarga tática | recarga vazia/passos | tempo (tática / vazia) | contato (não atravessa) | chute | som |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 9 mm service pistol (`pistol_9mm`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,00 s / 2,00 s | ✓ | n/a | ✓ |
| .45 ACP pistol (`pistol_45`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,20 s / 2,20 s | ✓ | n/a | ✓ |
| .357 Magnum revolver (`revolver_357`) | ✓ | ✓ | ✓ | ✓ | ✓ 4,00 s / 4,00 s | ✓ | n/a | ✓ |
| .38 Special revolver (`revolver_38`) | ✓ | ✓ | ✓ | ✓ | ✓ 3,80 s / 3,80 s | ✓ | n/a | ✓ |
| 9 mm submachine gun (`smg_9mm`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,40 s / 2,40 s | ✓ | n/a | ✓ |
| .22 LR carbine (`carbine_22`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,20 s / 2,20 s | ✓ | n/a | ✓ |
| 5.56 mm assault rifle (`rifle_5_56`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,50 s / 2,50 s | ✓ | n/a | ✓ |
| 7.62×39 mm assault rifle (`rifle_7_62x39`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,80 s / 2,80 s | ✓ | n/a | ✓ |
| .308 bolt-action rifle (`rifle_bolt_308`) | ✓ | ✓ | ✓ | ✓ | ✓ 3,50 s / 3,50 s | ✓ | n/a | ✓ |
| .338 Lapua sniper rifle (`sniper_338`) | ✓ | ✓ | ✓ | ✓ | ✓ 4,00 s / 4,00 s | ✓ | n/a | ✓ |
| .50 BMG anti-materiel rifle (`anti_materiel_50`) | ✓ | ✓ | ✓ | ✓ | ✓ 4,50 s / 4,50 s | ✓ | n/a | ✓ |
| 12 gauge pump-action shotgun (`shotgun_pump_12`) | ✓ | ✓ | ✓ | ✓ | ✓ 0,60 s / 4,77 s | ✓ | n/a | ✓ |
| 12 gauge double-barrel shotgun (`shotgun_double_12`) | ✓ | ✓ | ✓ | ✓ | ✓ 3,50 s / 3,50 s | ✓ | n/a | ✓ |
| 12 gauge semi-automatic shotgun (`shotgun_semi_12`) | ✓ | ✓ | ✓ | ✓ | ✓ 0,70 s / 3,50 s | ✓ | n/a | ✓ |
| Flamethrower (`flamethrower`) | ✓ | ✓ | — | — | — | ✓ | n/a | — |
| Glock 17 (`glock_17`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,80 s / 1,80 s | ✓ | n/a | ✓ |
| Glock 18 (`glock_18`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,80 s / 1,80 s | ✓ | n/a | ✓ |
| Glock 19 (`glock_19`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,70 s / 1,70 s | ✓ | n/a | ✓ |
| Taurus G2C (`taurus_g2c`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,70 s / 1,70 s | ✓ | n/a | ✓ |
| Taurus TS9 (`taurus_ts9`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,80 s / 1,80 s | ✓ | n/a | ✓ |
| Beretta 92FS (`beretta_92fs`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,90 s / 1,90 s | ✓ | n/a | ✓ |
| SIG Sauer P226 (`sig_sauer_p226`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,90 s / 1,90 s | ✓ | n/a | ✓ |
| CZ 75 (`cz_75`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,90 s / 1,90 s | ✓ | n/a | ✓ |
| Taurus PT100 (`taurus_pt100`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,90 s / 1,90 s | ✓ | n/a | ✓ |
| Colt M1911 (`colt_m1911`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,80 s / 1,80 s | ✓ | n/a | ✓ |
| Makarov PM (`makarov_pm`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,70 s / 1,70 s | ✓ | n/a | ✓ |
| FN Five-seveN (`fn_five_seven`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,80 s / 1,80 s | ✓ | n/a | ✓ |
| Desert Eagle Mark XIX (`desert_eagle_mark_xix`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,00 s / 2,00 s | ✓ | n/a | ✓ |
| Taurus 82 (`taurus_82`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,00 s / 6,00 s | ✓ | n/a | ✓ |
| S&W 686 (`sw_686`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,00 s / 7,00 s | ✓ | n/a | ✓ |
| S&W Model 29 (`sw_model_29`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,00 s / 6,00 s | ✓ | n/a | ✓ |
| HK MP5A3 (`hk_mp5a3`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,60 s / 2,60 s | ✓ | n/a | ✓ |
| Taurus SMT9 (`taurus_smt9`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,50 s / 2,50 s | ✓ | n/a | ✓ |
| HK UMP-45 (`hk_ump_45`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,70 s / 2,70 s | ✓ | n/a | ✓ |
| Uzi (`uzi`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,40 s / 2,40 s | ✓ | n/a | ✓ |
| FN P90 (`fn_p90`) | ✓ | ✓ | ✓ | ✓ | ✓ 3,00 s / 3,00 s | ✓ | n/a | ✓ |
| Kriss Vector (`kriss_vector`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,50 s / 2,50 s | ✓ | n/a | ✓ |
| Thompson M1A1 (`thompson_m1a1`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,90 s / 2,90 s | ✓ | n/a | ✓ |
| CZ Scorpion EVO 3 (`cz_scorpion_evo_3`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,40 s / 2,40 s | ✓ | n/a | ✓ |
| MAC-10 (`mac_10`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,20 s / 2,20 s | ✓ | n/a | ✓ |
| Remington 870 (`remington_870`) | ✓ | ✓ | ✓ | ✓ | ✓ 0,55 s / 4,43 s | ✓ | n/a | ✓ |
| Mossberg 500 (`mossberg_500`) | ✓ | ✓ | ✓ | ✓ | ✓ 0,55 s / 3,85 s | ✓ | n/a | ✓ |
| CBC Pump Military 3.0 (`cbc_pump_military_3_0`) | ✓ | ✓ | ✓ | ✓ | ✓ 0,60 s / 5,45 s | ✓ | n/a | ✓ |
| Benelli M4 (`benelli_m4`) | ✓ | ✓ | ✓ | ✓ | ✓ 0,50 s / 4,66 s | ✓ | n/a | ✓ |
| Franchi SPAS-12 (`franchi_spas_12`) | ✓ | ✓ | ✓ | ✓ | ✓ 0,55 s / 5,68 s | ✓ | n/a | ✓ |
| Kel-Tec KSG (`kel_tec_ksg`) | ✓ | ✓ | ✓ | ✓ | ✓ 0,55 s / 9,43 s | ✓ | n/a | ✓ |
| Saiga-12 (`saiga_12`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,80 s / 2,80 s | ✓ | n/a | ✓ |
| AA-12 (`aa_12`) | ✓ | ✓ | ✓ | ✓ | ✓ 3,00 s / 3,00 s | ✓ | n/a | ✓ |
| Boito double-barrel (`boito_double_barrel`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,00 s / 2,00 s | ✓ | n/a | ✓ |
| AK-47 (`ak_47`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,60 s / 3,40 s | ✓ | n/a | ✓ |
| AKM (`akm`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,60 s / 3,40 s | ✓ | n/a | ✓ |
| AK-74 (`ak_74`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,60 s / 3,40 s | ✓ | n/a | ✓ |
| AK-12 (`ak_12`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,50 s / 3,30 s | ✓ | n/a | ✓ |
| IMBEL IA2 (`imbel_ia2`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,40 s / 3,10 s | ✓ | n/a | ✓ |
| Taurus T4 (`taurus_t4`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,40 s / 3,10 s | ✓ | n/a | ✓ |
| Colt M4A1 (`colt_m4a1`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,30 s / 3,00 s | ✓ | n/a | ✓ |
| Colt M16A2 (`colt_m16a2`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,40 s / 3,10 s | ✓ | n/a | ✓ |
| HK416 (`hk416`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,30 s / 3,00 s | ✓ | n/a | ✓ |
| Steyr AUG A1 (`steyr_aug_a1`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,80 s / 3,40 s | ✓ | n/a | ✓ |
| FN FAL (`fn_fal`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,70 s / 3,50 s | ✓ | n/a | ✓ |
| HK G3A3 (`hk_g3a3`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,70 s / 3,60 s | ✓ | n/a | ✓ |
| SKS (`sks`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,20 s / 2,20 s | ✓ | n/a | ✓ |
| M14 EBR (`m14_ebr`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,80 s / 2,80 s | ✓ | n/a | ✓ |
| SVD Dragunov (`svd_dragunov`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,90 s / 2,90 s | ✓ | n/a | ✓ |
| FN SCAR-H (`fn_scar_h`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,60 s / 2,60 s | ✓ | n/a | ✓ |
| Knight's SR-25 (Mk 11) (`knights_sr_25_mk11`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,70 s / 2,70 s | ✓ | n/a | ✓ |
| HK PSG-1 (`hk_psg_1`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,70 s / 3,60 s | ✓ | n/a | ✓ |
| Steyr SSG 69 (`steyr_ssg_69`) | ✓ | ✓ | ✓ | ✓ | ✓ 0,70 s / 3,50 s | ✓ | n/a | ✓ |
| Barrett MRAD (`barrett_mrad`) | ✓ | ✓ | ✓ | ✓ | ✓ 3,20 s / 3,20 s | ✓ | n/a | ✓ |
| CheyTac M200 (`cheytac_m200`) | ✓ | ✓ | ✓ | ✓ | ✓ 3,20 s / 3,20 s | ✓ | n/a | ✓ |
| Remington 700 (`remington_700`) | ✓ | ✓ | ✓ | ✓ | ✓ 0,70 s / 2,80 s | ✓ | n/a | ✓ |
| M24 SWS (`m24_sws`) | ✓ | ✓ | ✓ | ✓ | ✓ 0,70 s / 3,50 s | ✓ | n/a | ✓ |
| Mosin-Nagant 91/30 (`mosin_nagant_91_30`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,40 s / 2,40 s | ✓ | n/a | ✓ |
| Accuracy AWM (`accuracy_awm`) | ✓ | ✓ | ✓ | ✓ | ✓ 3,20 s / 3,20 s | ✓ | n/a | ✓ |
| Sako TRG-42 (`sako_trg_42`) | ✓ | ✓ | ✓ | ✓ | ✓ 3,00 s / 3,00 s | ✓ | n/a | ✓ |
| Barrett M82A1 (`barrett_m82a1`) | ✓ | ✓ | ✓ | ✓ | ✓ 4,00 s / 4,00 s | ✓ | n/a | ✓ |
| Ruger 10/22 (`ruger_10_22`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,90 s / 1,90 s | ✓ | n/a | ✓ |
| CBC 7022 (`cbc_7022`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,90 s / 1,90 s | ✓ | n/a | ✓ |
| CBC 122 (`cbc_122`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,90 s / 1,90 s | ✓ | n/a | ✓ |
| Winchester 1894 (`winchester_1894`) | ✓ | ✓ | ✓ | ✓ | ✓ 0,60 s / 5,50 s | ✓ | n/a | ✓ |
| Rossi Puma (`rossi_puma`) | ✓ | ✓ | ✓ | ✓ | ✓ 0,50 s / 6,41 s | ✓ | n/a | ✓ |
| .30-06 hunting rifle (`hunting_rifle_30_06`) | ✓ | ✓ | ✓ | ✓ | ✓ 0,70 s / 2,80 s | ✓ | n/a | ✓ |
| FN Minimi (`fn_minimi`) | ✓ | ✓ | ✓ | ✓ | ✓ 7,50 s / 7,50 s | ✓ | n/a | ✓ |
| PKM (`pkm`) | ✓ | ✓ | ✓ | ✓ | ✓ 8,00 s / 8,00 s | ✓ | n/a | ✓ |
| M60 (`m60`) | ✓ | ✓ | ✓ | ✓ | ✓ 8,50 s / 8,50 s | ✓ | n/a | ✓ |
| Browning M2 .50 (`browning_m2`) | ✓ | — | ✓ | ✓ | ✓ 10,00 s / 10,00 s | ✓ | n/a | ✓ |
| Remington 700 (.300 WM) (`remington_700_300wm`) | ✓ | ✓ | ✓ | ✓ | ✓ 0,70 s / 2,10 s | ✓ | n/a | ✓ |
| HK MP5SD3 (`hk_mp5sd3`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,60 s / 2,60 s | ✓ | n/a | ✓ |
| FN ParaFAL (`fn_parafal`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,70 s / 3,50 s | ✓ | n/a | ✓ |
| Taurus T4 (civil) (`taurus_t4_civil`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,40 s / 3,10 s | ✓ | n/a | ✓ |
| Taurus TH380 (`taurus_th380`) | ✓ | ✓ | ✓ | ✓ | ✓ 1,70 s / 1,70 s | ✓ | n/a | ✓ |
| Mossberg 500 Cruiser (`mossberg_500_cruiser`) | ✓ | ✓ | ✓ | ✓ | ✓ 0,55 s / 3,85 s | ✓ | n/a | ✓ |
| HK MP5K (`hk_mp5k`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,60 s / 2,60 s | ✓ | n/a | ✓ |
| HK UMP9 (`hk_ump9`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,70 s / 2,70 s | ✓ | n/a | ✓ |
| Mini Uzi (`mini_uzi`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,40 s / 2,40 s | ✓ | n/a | ✓ |
| HK MP7A1 (`hk_mp7a1`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,60 s / 2,60 s | ✓ | n/a | ✓ |
| HK G36 (`hk_g36`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,30 s / 3,00 s | ✓ | n/a | ✓ |
| HK G36K (`hk_g36k`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,30 s / 3,00 s | ✓ | n/a | ✓ |
| HK G36C (`hk_g36c`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,30 s / 3,00 s | ✓ | n/a | ✓ |
| FN M249 (`fn_m249`) | ✓ | ✓ | ✓ | ✓ | ✓ 7,50 s / 7,50 s | ✓ | n/a | ✓ |
| FN Minimi Para (`fn_minimi_para`) | ✓ | ✓ | ✓ | ✓ | ✓ 7,50 s / 7,50 s | ✓ | n/a | ✓ |
| FN MAG (`fn_mag`) | ✓ | ✓ | ✓ | ✓ | ✓ 8,50 s / 8,50 s | ✓ | n/a | ✓ |
| RPK (`rpk`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,60 s / 3,40 s | ✓ | n/a | ✓ |
| SIG MPX (`sig_mpx`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,60 s / 2,60 s | ✓ | n/a | ✓ |
| MG3 (`mg3`) | ✓ | ✓ | ✓ | ✓ | ✓ 8,50 s / 8,50 s | ✓ | n/a | ✓ |
| PP-19 Bizon (`pp19_bizon`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,50 s / 2,50 s | ✓ | n/a | ✓ |
| vz. 61 Škorpion (`vz61`) | ✓ | ✓ | ✓ | ✓ | ✓ 2,40 s / 2,40 s | ✓ | n/a | ✓ |
| M134 Minigun (`m134`) | ✓ | ✓ | — | — | — | ✓ | n/a | — |
| RPG-7 (`rpg_7`) | ✓ | ✓ | ✓ | — | ✓ 4,50 s / — | ✓ | n/a | ✓ |
| M72 LAW (`m72_law`) | ✓ | ✓ | ✓ | — | ✓ 1,15 s / — | ✓ | n/a | ✓ |
| AT4 (`at4`) | ✓ | ✓ | ✓ | — | ✓ 1,15 s / — | ✓ | n/a | ✓ |
| Carl Gustaf M4 (`carl_gustaf_m4`) | ✓ | ✓ | ✓ | — | ✓ 1,05 s / — | ✓ | n/a | ✓ |
| M2 flamethrower (`m2_flamethrower`) | ✓ | ✓ | — | — | — | ✓ | n/a | — |
| Improvised flamethrower (`improvised_flamethrower`) | ✓ | ✓ | — | — | — | ✓ | n/a | — |

## Sem gatilho no modelo

Mantêm a empunhadura normal (sem o indicador estendido): `browning_m2`.

## Continuam ✗

Nenhuma arma com modelo fica ✗.

## Sem modelo (caixas e props genéricos)

O kit mostra estas armas com o prop genérico da categoria (`props.ts`), não com modelo da galeria: não têm peças para animar nem gatilho para o dedo. Se o time entregar o modelo, entram na tabela de cima automaticamente.

- Hand (`hand`): hand, hand
- Kick (`kick`): melee_blunt, melee
- Shove (`shove`): melee_blunt, melee
- .22 LR pistol (`pistol_22`): pistol, firearm
- Compound bow (`bow_compound`): bow, firearm
- Crossbow (`crossbow`): crossbow, firearm
- Hammer (`hammer`): melee_blunt, melee
- Sledgehammer (`sledgehammer`): melee_blunt, melee
- Baseball bat (`baseball_bat`): melee_blunt, melee
- Crowbar (`crowbar`): melee_blunt, melee
- Machete (`machete`): melee_blade, melee
- Axe (`axe`): melee_blade, melee
- Knife (`knife`): melee_blade, melee
- Fists (`fists`): melee_blunt, melee
- Lighter (`lighter`): flame, flame
- Molotov cocktail (`molotov`): throwable, throwable
- Oxy-fuel cutting torch (`cutting_torch`): heat, heat
- Blowtorch (`blowtorch`): heat, heat
- Fragmentation grenade (`frag_grenade`): throwable, throwable
- Pipe bomb (`pipe_bomb`): throwable, throwable
- Screwdriver (`screwdriver`): tool, tool
- Wrench (`wrench`): tool, tool
- Pry bar (`pry_bar`): tool, tool
- Hacksaw (`hacksaw`): tool, tool
- Utility knife (`utility_knife`): tool, tool
- Claw hammer (`claw_hammer`): tool, tool
- Fire extinguisher (`extinguisher`): extinguisher, extinguisher
- M79 grenade launcher (`m79`): launcher, launcher
- M203 grenade launcher (`m203`): launcher, launcher
- GP-25 grenade launcher (`gp_25`): launcher, launcher
- AG36 grenade launcher (`ag36`): launcher, launcher
- Flashbang (`flashbang`): throwable, throwable
- Dynamite (`dynamite`): throwable, throwable
- C4 charge (`c4`): throwable, throwable
- Claymore mine (`claymore`): throwable, throwable
- Tactical knife (`tactical_knife`): melee_blade, melee
- Meat cleaver (`meat_cleaver`): melee_blade, melee
- Hatchet (`hatchet`): melee_blade, melee
- Nail bat (`nail_bat`): melee_blunt, melee
- Iron pipe (`iron_pipe`): melee_blunt, melee
- Pickaxe (`pickaxe`): melee_blade, melee
- Sickle (`sickle`): melee_blade, melee
- Police baton (`police_baton`): melee_blunt, melee
- Cast iron skillet (`cast_iron_skillet`): melee_blunt, melee
- Improvised spear (`improvised_spear`): melee_blade, melee
- Chainsaw (`chainsaw`): melee_blade, melee
- Recurve bow (`recurve_bow`): bow, firearm

## Prévias

As imagens `examples/test-room/shots/fp-all-weapons-*.png` mostram cada arma empunhada em primeira pessoa (folhas de contato).
