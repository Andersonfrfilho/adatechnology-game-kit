const W = new URL('../../../packages', import.meta.url).pathname.replace(/\/$/, '')
const { engine } = await import(W+'/game-floorplan/dist/index.js')
const names=['residential','commercial','rural','post-apocalyptic']
const mods = await Promise.all(names.map(p=>import(W+'/game-floorplan-'+p+'/dist/index.js')))
const st = await import(W+'/game-floorplan-structure/dist/index.js')
mods[0].register(engine,{region:'br'}); for (const m of mods.slice(1)) m.register(engine); st.register(engine)
const ids = [...mods[0].residentialTemplateIds.filter(i=>i!=='residential_tower'), ...mods[1].commercialTemplateIds, ...mods[2].ruralTemplateIds, ...(mods[3].postApocalypticTemplateIds ?? [])].filter(i=>!/tower|skyscraper/.test(i))
const variants = [['residential_tower',{floors:20}],['office_tower',{floors:20}]].concat(ids.map(i=>[i,{}])).concat([['high_end_contemporary',{floors:1}],['high_end_contemporary',{floors:3}],['mansion',{floors:1}],['mansion',{floors:2}],['mansion',{elevator:true}],['mid_modern_townhouse',{floors:3}],['mid_modern_townhouse',{floors:2}],['townhouse',{floors:3}],['budget_semi_detached',{floors:3}],['apartment_basic',{floors:2}],['budget_slab_house',{floors:2}],['budget_slab_house',{floors:3}],['apartment_modern',{tier:'high'}],['wood_frame_house', { floors: 2, basement: 'basement', fireplace: true }]])
const agg=new Map()
for (const [id,opt] of variants) for (const seed of (/tower/.test(id)?[1]:[1,2,3,4,5,6,7,8])) {
  let plan; try { plan = engine.generate(id,{seed,...opt}) } catch(e) { console.log('ERR',id,e.message); continue }
  if (!plan.structure) continue
  for (const v of st.validateStructure(plan.structure,{doors:plan.doors})) { const k=id+JSON.stringify(opt)+' '+v.code; const a=agg.get(k)??{n:0,ex:new Set()}; a.n++; if(a.ex.size<4) a.ex.add(v.message); agg.set(k,a) }
}
let total=0; for (const [k,a] of agg) { total+=a.n; console.log(k,a.n,'|',[...a.ex].slice(0,2).join(' || ')) } console.log('TOTAL', total)
console.log('done', variants.length)
