// Build-time: Natural Earth (public domain) countries + populated places -> public/world2.json
const fs = require('fs');
const gj = require('../data/countries.json'), places = require('../data/places.json');
const W = 2000, R = W / (2 * Math.PI), top = 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * 84 * Math.PI / 180));
const pr = (lon, lat) => { lat = Math.max(-58, Math.min(84, lat)); const y = 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * Math.PI / 180)); return [Math.round((lon + 180) / 360 * W * 10) / 10, Math.round((top - y) * R * 10) / 10]; };
const countries = [], cities = [];
for (const f of gj.features) { const p = f.properties; const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = polys.map(poly => poly[0].map(([a, b]) => pr(a, b)).flat()).filter(r => r.length >= 8);
  if (!rings.length) continue; countries.push({ code: p.ADM0_A3, name: p.NAME, pop: Math.max(50000, p.POP_EST || 0), polys: rings }); }
const inside = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) { const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
countries.forEach((C, ci) => {
  const want = Math.max(1, Math.min(22, Math.round(1 + Math.sqrt(C.pop / 1e6) * 1.0)));
  const ps = places.filter(p => p.adm0_a3 === C.code).sort((a, b) => (b.adm0cap - a.adm0cap) || (b.pop_max - a.pop_max));
  const chosen = [];
  for (const p of ps) { if (chosen.length >= want) break; const [x, y] = pr(p.longitude, p.latitude);
    if (!C.polys.some(r => inside(x, y, r))) continue;
    if (chosen.some(c => Math.hypot(c.x - x, c.y - y) < 16)) continue;
    chosen.push({ n: p.name, c: ci, x, y, pop: p.pop_max, cap: chosen.length === 0 ? 1 : 0 }); }
  if (!chosen.length) { // fallback: centroid of largest ring
    const r = C.polys.reduce((a, b) => b.length > a.length ? b : a); let sx = 0, sy = 0; for (let i = 0; i < r.length; i += 2) { sx += r[i]; sy += r[i + 1]; }
    chosen.push({ n: C.name, c: ci, x: Math.round(sx / (r.length / 2)), y: Math.round(sy / (r.length / 2)), pop: Math.round(C.pop * 0.2), cap: 1 }); }
  cities.push(...chosen);
});
fs.writeFileSync('public/world2.json', JSON.stringify({ w: W, h: 1100, countries, cities }));
console.log(countries.length, 'countries', cities.length, 'cities', fs.statSync('public/world2.json').size, 'bytes');
