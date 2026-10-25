import data from '../data/models.json'

import { cannedBeans } from './canned-beans'
import { waterBottle } from './water-bottle'
import { rice } from './rice'
import { militaryRation } from './military-ration'
import { cachaca } from './cachaca'
import { firstAidKit } from './first-aid-kit'
import { bandage } from './bandage'
import { amoxicillin } from './amoxicillin'
import { crowbar } from './crowbar'
import { hammer } from './hammer'
import { machete } from './machete'
import { axe } from './axe'
import { nailBat } from './nail-bat'
import { hikingBackpack40L } from './hiking-backpack-40l'
import { flashlight } from './flashlight'
import { portableRadio } from './portable-radio'
import { houseKey } from './house-key'
import { survivorDiary } from './survivor-diary'
import { motorcycleHelmet } from './motorcycle-helmet'
import { lpgCylinder13Kg } from './lpg-cylinder-13kg'
import { fuelJerrycan } from './fuel-jerrycan'
import { walkieTalkies } from './walkie-talkies'
import { batteries } from './batteries'
import { woodenPlank } from './wooden-plank'
import { sugar } from './sugar'
import { chocolateBar } from './chocolate-bar'
import { potatoes } from './potatoes'
import { biscuits } from './biscuits'
import { coffee } from './coffee'
import { rawBeef } from './raw-beef'
import { gameMeat } from './game-meat'
import { jerkedBeef } from './jerked-beef'
import { homePreserves } from './home-preserves'
import { eggs } from './eggs'
import { cassavaFlour } from './cassava-flour'
import { beans } from './beans'
import { frozenChicken } from './frozen-chicken'
import { orange } from './orange'
import { condensedMilk } from './condensed-milk'
import { pasta } from './pasta'
import { instantNoodles } from './instant-noodles'
import { cassavaRoot } from './cassava-root'
import { cannedCornAndPeas } from './canned-corn-and-peas'
import { mortadella } from './mortadella'
import { freshFish } from './fresh-fish'
import { saltedFish } from './salted-fish'
import { bananaBunch } from './banana-bunch'
import { honeyJar } from './honey-jar'
import { bread } from './bread'
import { cheese } from './cheese'
import { rapadura } from './rapadura'
import { dogFood } from './dog-food'
import { salt } from './salt'
import { snackChips } from './snack-chips'
import { cannedSausages } from './canned-sausages'
import { cannedSardines } from './canned-sardines'
import { cookingOil } from './cooking-oil'
import { beerCan } from './beer-can'
import { energyDrink } from './energy-drink'
import { waterJug5l } from './water-jug-5l'
import { sportsDrink } from './sports-drink'
import { milkCarton } from './milk-carton'
import { sodaCan } from './soda-can'
import { juiceBox } from './juice-box'
import { communionWine } from './communion-wine'
import { coconutWater } from './coconut-water'
import { dirtyWater } from './dirty-water'
import { painkillers } from './painkillers'
import { tramadol } from './tramadol'
import { ibuprofen } from './ibuprofen'
import { antihistamine } from './antihistamine'
import { ceftriaxone } from './ceftriaxone'
import { clonazepam } from './clonazepam'
import { activatedCharcoal } from './activated-charcoal'
import { adhesiveBandages } from './adhesive-bandages'
import { medicalTape } from './medical-tape'
import { sterileGauze } from './sterile-gauze'
import { povidoneIodine } from './povidone-iodine'
import { sutureKit } from './suture-kit'
import { examGloves } from './exam-gloves'
import { n95Mask } from './n95-mask'
import { multivitamin } from './multivitamin'
import { maintenanceMedication } from './maintenance-medication'
import { rehydrationSalts } from './rehydration-salts'
import { syringe } from './syringe'
import { antivenom } from './antivenom'
import { salineIvBag } from './saline-iv-bag'
import { splint } from './splint'
import { thermometer } from './thermometer'
import { alcohol70 } from './alcohol-70'
import { canOpener } from './can-opener'
import { pliers } from './pliers'
import { boltCutters } from './bolt-cutters'
import { bucket } from './bucket'
import { binoculars } from './binoculars'
import { matches } from './matches'
import { pocketKnife } from './pocket-knife'
import { screwdriver } from './screwdriver'
import { adjustableWrench } from './adjustable-wrench'
import { hoe } from './hoe'
import { fireExtinguisher } from './fire-extinguisher'
import { ductTape } from './duct-tape'
import { campStove } from './camp-stove'
import { lighter } from './lighter'
import { lockpickKit } from './lockpick-kit'
import { sewingKit } from './sewing-kit'
import { carJack } from './car-jack'
import { mechanicToolbox } from './mechanic-toolbox'
import { gasTorch } from './gas-torch'
import { inverterWelder } from './inverter-welder'
import { pot } from './pot'
import { cordlessDrill } from './cordless-drill'
import { flintStriker } from './flint-striker'
import { sharpeningStone } from './sharpening-stone'
import { shovel } from './shovel'
import { hacksaw } from './hacksaw'
import { handsaw } from './handsaw'
import { scissors } from './scissors'
import { recurveBow } from './recurve-bow'
import { crossbow } from './crossbow'
import { ironPipe } from './iron-pipe'
import { meatCleaver } from './meat-cleaver'
import { slingshot } from './slingshot'
import { knife } from './knife'
import { tacticalKnife } from './tactical-knife'
import { arrowsAndBolts } from './arrows-and-bolts'
import { sickle } from './sickle'
import { castIronSkillet } from './cast-iron-skillet'
import { improvisedSpear } from './improvised-spear'
import { hatchet } from './hatchet'
import { sledgehammer } from './sledgehammer'
import { chainsaw } from './chainsaw'
import { pickaxe } from './pickaxe'
import { baseballBat } from './baseball-bat'
import { policeBaton } from './police-baton'
import { wireRoll } from './wire-roll'
import { barbedWire } from './barbed-wire'
import { glassShards } from './glass-shards'
import { sheetMetal } from './sheet-metal'
import { cementBag } from './cement-bag'
import { epoxyGlue } from './epoxy-glue'
import { electronicComponents } from './electronic-components'
import { rope } from './rope'
import { copperWire } from './copper-wire'
import { petBottle } from './pet-bottle'
import { glassBottle } from './glass-bottle'
import { emptyCan } from './empty-can'
import { firewood } from './firewood'
import { tarp } from './tarp'
import { screws } from './screws'
import { nails } from './nails'
import { raffiaSack } from './raffia-sack'
import { scrapMetal } from './scrap-metal'
import { bricks } from './bricks'
import { rag } from './rag'
import { rebar } from './rebar'
import { lubricantSpray } from './lubricant-spray'
import { armyCamouflageUniform } from './army-camouflage-uniform'
import type { ItemModelBuilder, ItemModelEntry } from './registry'

/** The builder of each model of the showcase, by catalog id. */
const BUILDERS: Readonly<Record<string, ItemModelBuilder>> = {
  canned_beans: cannedBeans,
  water_bottle: waterBottle,
  rice: rice,
  military_ration: militaryRation,
  cachaca: cachaca,
  first_aid_kit: firstAidKit,
  bandage: bandage,
  amoxicillin: amoxicillin,
  crowbar: crowbar,
  hammer: hammer,
  machete: machete,
  axe: axe,
  nail_bat: nailBat,
  hiking_backpack_40l: hikingBackpack40L,
  flashlight: flashlight,
  portable_radio: portableRadio,
  house_key: houseKey,
  survivor_diary: survivorDiary,
  motorcycle_helmet: motorcycleHelmet,
  lpg_cylinder_13kg: lpgCylinder13Kg,
  fuel_jerrycan: fuelJerrycan,
  walkie_talkies: walkieTalkies,
  batteries: batteries,
  wooden_plank: woodenPlank,
  sugar: sugar,
  chocolate_bar: chocolateBar,
  potatoes: potatoes,
  biscuits: biscuits,
  coffee: coffee,
  raw_beef: rawBeef,
  game_meat: gameMeat,
  jerked_beef: jerkedBeef,
  home_preserves: homePreserves,
  eggs: eggs,
  cassava_flour: cassavaFlour,
  beans: beans,
  frozen_chicken: frozenChicken,
  orange: orange,
  condensed_milk: condensedMilk,
  pasta: pasta,
  instant_noodles: instantNoodles,
  cassava_root: cassavaRoot,
  canned_corn_and_peas: cannedCornAndPeas,
  mortadella: mortadella,
  fresh_fish: freshFish,
  salted_fish: saltedFish,
  banana_bunch: bananaBunch,
  honey_jar: honeyJar,
  bread: bread,
  cheese: cheese,
  rapadura: rapadura,
  dog_food: dogFood,
  salt: salt,
  snack_chips: snackChips,
  canned_sausages: cannedSausages,
  canned_sardines: cannedSardines,
  cooking_oil: cookingOil,
  beer_can: beerCan,
  energy_drink: energyDrink,
  water_jug_5l: waterJug5l,
  sports_drink: sportsDrink,
  milk_carton: milkCarton,
  soda_can: sodaCan,
  juice_box: juiceBox,
  communion_wine: communionWine,
  coconut_water: coconutWater,
  dirty_water: dirtyWater,
  painkillers: painkillers,
  tramadol: tramadol,
  ibuprofen: ibuprofen,
  antihistamine: antihistamine,
  ceftriaxone: ceftriaxone,
  clonazepam: clonazepam,
  activated_charcoal: activatedCharcoal,
  adhesive_bandages: adhesiveBandages,
  medical_tape: medicalTape,
  sterile_gauze: sterileGauze,
  povidone_iodine: povidoneIodine,
  suture_kit: sutureKit,
  exam_gloves: examGloves,
  n95_mask: n95Mask,
  multivitamin: multivitamin,
  maintenance_medication: maintenanceMedication,
  rehydration_salts: rehydrationSalts,
  syringe: syringe,
  antivenom: antivenom,
  saline_iv_bag: salineIvBag,
  splint: splint,
  thermometer: thermometer,
  alcohol_70: alcohol70,
  can_opener: canOpener,
  pliers: pliers,
  bolt_cutters: boltCutters,
  bucket: bucket,
  binoculars: binoculars,
  matches: matches,
  pocket_knife: pocketKnife,
  screwdriver: screwdriver,
  adjustable_wrench: adjustableWrench,
  hoe: hoe,
  fire_extinguisher: fireExtinguisher,
  duct_tape: ductTape,
  camp_stove: campStove,
  lighter: lighter,
  lockpick_kit: lockpickKit,
  sewing_kit: sewingKit,
  car_jack: carJack,
  mechanic_toolbox: mechanicToolbox,
  gas_torch: gasTorch,
  inverter_welder: inverterWelder,
  pot: pot,
  cordless_drill: cordlessDrill,
  flint_striker: flintStriker,
  sharpening_stone: sharpeningStone,
  shovel: shovel,
  hacksaw: hacksaw,
  handsaw: handsaw,
  scissors: scissors,
  recurve_bow: recurveBow,
  crossbow: crossbow,
  iron_pipe: ironPipe,
  meat_cleaver: meatCleaver,
  slingshot: slingshot,
  knife: knife,
  tactical_knife: tacticalKnife,
  arrows_and_bolts: arrowsAndBolts,
  sickle: sickle,
  cast_iron_skillet: castIronSkillet,
  improvised_spear: improvisedSpear,
  hatchet: hatchet,
  sledgehammer: sledgehammer,
  chainsaw: chainsaw,
  pickaxe: pickaxe,
  baseball_bat: baseballBat,
  police_baton: policeBaton,
  wire_roll: wireRoll,
  barbed_wire: barbedWire,
  glass_shards: glassShards,
  sheet_metal: sheetMetal,
  cement_bag: cementBag,
  epoxy_glue: epoxyGlue,
  electronic_components: electronicComponents,
  rope: rope,
  copper_wire: copperWire,
  pet_bottle: petBottle,
  glass_bottle: glassBottle,
  empty_can: emptyCan,
  firewood: firewood,
  tarp: tarp,
  screws: screws,
  nails: nails,
  raffia_sack: raffiaSack,
  scrap_metal: scrapMetal,
  bricks: bricks,
  rag: rag,
  rebar: rebar,
  lubricant_spray: lubricantSpray,
  army_camouflage_uniform: armyCamouflageUniform,
}

/** The 24 models of the showcase in the page's order: the entry of `data/models.json` (generated by `tools/items-catalog`) and the builder ported from the page. */
export const SHIPPED_MODELS: ReadonlyArray<{ readonly entry: ItemModelEntry; readonly builder: ItemModelBuilder }> = (data as unknown as ItemModelEntry[]).map((entry) => {
  const builder = BUILDERS[entry.id]
  if (!builder) throw new Error(`game-items-three: no builder for the model "${entry.id}"`)
  return { entry, builder }
})
