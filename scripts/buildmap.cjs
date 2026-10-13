const tc=require('topojson-client');const fs=require('fs');
const t=require('../data/prov.topo.json');const obj=Object.values(t.objects)[0];
const fc=tc.feature(t,obj);const nbs=tc.neighbors(obj.geometries);
const W=2000, R=W/(2*Math.PI);
const proj=([lon,lat])=>{lat=Math.max(-60,Math.min(84,lat));const y=1.25*Math.log(Math.tan(Math.PI/4+0.4*lat*Math.PI/180));return [Math.round((lon+180)/360*W*10)/10, Math.round((1.25*Math.log(Math.tan(Math.PI/4+0.4*84*Math.PI/180))-y)*R*10)/10];};
const countries=[],cidx={};const provs=[];
fc.features.forEach((f,i)=>{const p=f.properties;if(!(p.adm0_a3 in cidx)){cidx[p.adm0_a3]=countries.length;countries.push({code:p.adm0_a3,name:p.admin});}
 const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
 const rings=[];let ax=0,ay=0,aa=0;let minx=1e9,maxx=-1e9;
 for(const poly of polys){const ring=poly[0].map(proj);ring.forEach(q=>{minx=Math.min(minx,q[0]);maxx=Math.max(maxx,q[0])});
  for(let j=0;j<ring.length-1;j++){const [x0,y0]=ring[j],[x1,y1]=ring[j+1];const c=x0*y1-x1*y0;aa+=c;ax+=(x0+x1)*c;ay+=(y0+y1)*c;}
  rings.push(ring.flat());}
 let cx=ax/(3*aa),cy=ay/(3*aa);if(!isFinite(cx)){cx=rings[0][0];cy=rings[0][1]}
 const name=p.k.split('|')[1]||p.admin;
 provs.push({n:name,c:cidx[p.adm0_a3],r:rings,x:Math.round(cx*10)/10,y:Math.round(cy*10)/10,a:Math.abs(aa/2)|0,nb:nbs[i].slice()});});
// sea hops: connect province to nearest provinces of other components within 40px if few neighbors
for(let i=0;i<provs.length;i++){const a=provs[i];const cand=[];for(let j=0;j<provs.length;j++){if(i===j||a.nb.includes(j))continue;const b=provs[j];const d=Math.hypot(a.x-b.x,a.y-b.y);if(d<(a.nb.length?22:45))cand.push([d,j]);}
 cand.sort((p,q)=>p[0]-q[0]);for(const [,j] of cand.slice(0,a.nb.length?1:3)){a.nb.push(j);provs[j].nb.push(i);}}
provs.forEach(p=>p.nb=[...new Set(p.nb)]);
fs.writeFileSync('public/world.json',JSON.stringify({w:W,h:Math.ceil(Math.max(...provs.map(p=>p.y))+40),countries,provinces:provs}));
console.log(provs.length,countries.length,fs.statSync('public/world.json').size);
