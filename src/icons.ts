// Procedurally drawn map icons (original art), cached as small bitmaps.
const cache = new Map<string, HTMLCanvasElement>();
export function icon(kind: string, lvl: number, mine: boolean, px: number): HTMLCanvasElement {
  const key = `${kind}${lvl}${mine}${px}`; let c = cache.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d')!; g.scale(px / 32, px / 32);
  const fg = mine ? '#e8f1ff' : '#d8d2c4', ac = mine ? '#4fb3ff' : '#c9a24a', dark = '#10161d';
  const plate = (col = dark) => { g.fillStyle = col; g.strokeStyle = ac; g.lineWidth = 1.6; g.beginPath(); g.roundRect(2, 2, 28, 28, 6); g.fill(); g.stroke(); };
  g.lineJoin = 'round';
  switch (kind) {
    case 'city': {
      if (lvl >= 4) { const gr = g.createRadialGradient(16, 18, 2, 16, 18, 16); gr.addColorStop(0, ac + 'cc'); gr.addColorStop(1, ac + '00'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); }
      g.fillStyle = dark + 'dd'; g.beginPath(); g.ellipse(16, 27, 14, 4, 0, 0, 7); g.fill();
      const towers: [number, number, number][] = lvl === 1 ? [[12, 8, 8]] : lvl === 2 ? [[6, 7, 8], [13, 7, 12], [21, 6, 7]] : lvl === 3 ? [[4, 6, 10], [10, 6, 16], [17, 6, 13], [23, 5, 9]] : [[3, 5, 12], [8, 5, 18], [13, 6, 24], [19, 5, 16], [24, 5, 11]];
      for (const [x, w, h] of towers) { g.fillStyle = fg; g.strokeStyle = dark; g.lineWidth = 1; g.fillRect(x, 27 - h, w, h); g.strokeRect(x, 27 - h, w, h);
        if (lvl === 1) { g.fillStyle = ac; g.beginPath(); g.moveTo(x - 2, 27 - h); g.lineTo(x + w / 2, 27 - h - 6); g.lineTo(x + w + 2, 27 - h); g.fill(); }
        g.fillStyle = ac; for (let yy = 27 - h + 2; yy < 25; yy += 3) for (let xx = x + 1.5; xx < x + w - 1; xx += 2.5) g.fillRect(xx, yy, 1, 1.2); }
      if (lvl >= 4) { g.strokeStyle = fg; g.lineWidth = 1; g.beginPath(); g.moveTo(16, 3); g.lineTo(16, 0); g.stroke(); }
      break; }
    case 'base': plate(); g.fillStyle = fg; g.beginPath(); g.moveTo(16, 5); g.lineTo(26, 9); g.lineTo(24, 20); g.lineTo(16, 27); g.lineTo(8, 20); g.lineTo(6, 9); g.closePath(); g.fill();
      g.fillStyle = ac; star(g, 16, 15, 6, 2.5); break;
    case 'airfield': plate(); g.fillStyle = fg; g.beginPath(); g.moveTo(16, 4); g.lineTo(18, 12); g.lineTo(28, 17); g.lineTo(28, 19); g.lineTo(18, 17); g.lineTo(17.5, 24); g.lineTo(21, 27); g.lineTo(11, 27); g.lineTo(14.5, 24); g.lineTo(14, 17); g.lineTo(4, 19); g.lineTo(4, 17); g.lineTo(14, 12); g.closePath(); g.fill(); break;
    case 'port': plate(); g.strokeStyle = fg; g.lineWidth = 2.4; g.beginPath(); g.arc(16, 9, 3, 0, 7); g.moveTo(16, 12); g.lineTo(16, 26); g.moveTo(10, 15); g.lineTo(22, 15); g.moveTo(7, 19); g.quadraticCurveTo(9, 26, 16, 26); g.quadraticCurveTo(23, 26, 25, 19); g.stroke(); break;
    case 'factory': plate(); g.fillStyle = fg; g.beginPath(); g.moveTo(5, 26); g.lineTo(5, 14); g.lineTo(11, 18); g.lineTo(11, 14); g.lineTo(17, 18); g.lineTo(17, 14); g.lineTo(23, 18); g.lineTo(23, 6); g.lineTo(27, 6); g.lineTo(27, 26); g.closePath(); g.fill(); pips(g, lvl, ac); break;
    case 'bunker': plate('#2a2f26'); g.fillStyle = '#9aa58a'; g.beginPath(); g.moveTo(5, 24); g.lineTo(8, 13); g.quadraticCurveTo(16, 7, 24, 13); g.lineTo(27, 24); g.closePath(); g.fill(); g.fillStyle = dark; g.fillRect(11, 16, 10, 2.5); pips(g, lvl, ac); break;
    case 'sam': plate('#22263a'); g.fillStyle = fg; for (const x of [10, 16, 22]) { g.beginPath(); g.moveTo(x, 5); g.lineTo(x + 2, 9); g.lineTo(x + 2, 22); g.lineTo(x - 2, 22); g.lineTo(x - 2, 9); g.closePath(); g.fill(); } g.fillStyle = '#ff6a4a'; g.fillRect(6, 22, 20, 3); pips(g, lvl, ac); break;
    case 'artillery': plate('#2e2620'); g.strokeStyle = fg; g.lineWidth = 3; g.beginPath(); g.moveTo(10, 20); g.lineTo(26, 7); g.stroke(); g.fillStyle = fg; g.beginPath(); g.arc(11, 21, 5, 0, 7); g.fill(); g.fillStyle = dark; g.beginPath(); g.arc(11, 21, 2, 0, 7); g.fill(); pips(g, lvl, ac); break;
    case 'outpost': g.fillStyle = '#3b3a2a'; g.strokeStyle = ac; g.lineWidth = 1.5; g.beginPath(); g.moveTo(16, 4); g.lineTo(29, 27); g.lineTo(3, 27); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#b8a77a'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(8 + i * 5.3, 25, 3, 2, 0, 0, 7); g.fill(); } g.strokeStyle = fg; g.lineWidth = 1.4; g.beginPath(); g.moveTo(16, 21); g.lineTo(16, 9); g.stroke(); g.fillStyle = ac; g.fillRect(16, 9, 7, 4.5); break;
  }
  cache.set(key, c); return c;
}
function pips(g: CanvasRenderingContext2D, n: number, col: string) { g.fillStyle = col; for (let i = 0; i < n; i++) g.fillRect(5 + i * 5, 27.5, 3.5, 2); }
function star(g: CanvasRenderingContext2D, x: number, y: number, R: number, r: number) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
