// world.js — Kota Teluk Arun v2: jalan, distrik, landmark, pantai, taman,
// pelabuhan, SPBU, koin koleksi, collision, dan render dunia.
// Semua koordinat dalam piksel dunia; kota deterministik per seed.
export const WORLD_W = 3600;
export const WORLD_H = 2600;

// Jalan vertikal dan horizontal (pusat garis), lebar jalan 96.
export const V_ROADS = [320, 720, 1120, 1520, 1920, 2320, 2720, 3080];
export const H_ROADS = [260, 620, 980, 1340, 1700, 2060, 2360];
export const ROAD_W = 96;

// SPBU Arun: kanopi + 2 pompa di sudut Jl. Karang / Jl. Arun.
export const GAS_STATION = { x: 2780, y: 1030, radius: 110 };
// Pasar Senja: alun-alun pasar di blok tengah-timur.
export const MARKET = { x0: 1980, y0: 690, x1: 2260, y1: 920 };
// Taman Kota: blok vi=3, hi=3 (sama seperti v1).
export const PARK = { x0: 1582, y0: 1402, x1: 1858, y1: 1638 };

// Mulberry32: RNG deterministik supaya kota sama di setiap sesi/seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  ['#e8a87c', '#d98e5f', '#f2c094'], // bata hangat
  ['#7fb3d5', '#5d9bbf', '#a8cce0'], // biru pesisir
  ['#f0e6d2', '#e3d3ae', '#f7efe0'], // krem
  ['#c98a8a', '#b56e6e', '#e0a8a8'], // merah muda bata
  ['#9db98a', '#86a573', '#b9cfa8'], // hijau zaitun
  ['#8a7fbf', '#6f64a8', '#a89ed0'], // ungu senja
  ['#f4b183', '#e08a4e', '#ffd9b0'], // oranye senja
];

function pick(random, arr) {
  return arr[Math.floor(random() * arr.length)];
}

// Nama distrik berdasarkan posisi — dipakai HUD + minimap.
export function districtAt(x, y) {
  if (x >= 3180) return 'Pantai Arun';
  if (x < 720 && y >= 1700) return 'Pelabuhan';
  if (x < 720 && y < 980) return 'Kampung Nelayan';
  if (x >= PARK.x0 && x <= PARK.x1 && y >= PARK.y0 && y <= PARK.y1) return 'Taman Kota';
  if (x >= MARKET.x0 && x <= MARKET.x1 && y >= MARKET.y0 && y <= MARKET.y1) return 'Pasar Senja';
  if (Math.hypot(x - GAS_STATION.x, y - GAS_STATION.y) < 190) return 'SPBU Arun';
  if (y >= 2060 && x >= 1120) return 'Permukiman Senja';
  if (y < 620) return 'Kota Utara';
  return 'Pusat Kota';
}

// Landmark tetap (bukan acak): rumah sakit, kantor polisi, pasar, SPBU.
export const LANDMARKS = [
  { kind: 'hospital', label: 'RS Teluk', x: 2440, y: 1150 },
  { kind: 'police', label: 'Kantor Polisi', x: 830, y: 760 },
  { kind: 'market', label: 'Pasar Senja', x: 2120, y: 800 },
  { kind: 'gas', label: 'SPBU Arun', x: GAS_STATION.x, y: GAS_STATION.y },
  { kind: 'dock', label: 'Pelabuhan', x: 200, y: 2060 },
  { kind: 'beach', label: 'Pantai Arun', x: 3400, y: 1300 },
];

// 10 koin Arun tersembunyi — posisi tetap per seed, tersebar di 6 distrik.
export function coinSpots(seed) {
  const random = mulberry32(seed ^ 0x9e3779b9);
  const base = [
    [420, 420], [980, 1500], [1400, 300], [2100, 800], [2500, 1500],
    [3000, 500], [3350, 1900], [500, 2250], [1600, 2200], [2900, 2150],
  ];
  return base.map(([x, y], i) => ({
    x: x + Math.floor((random() - 0.5) * 60),
    y: y + Math.floor((random() - 0.5) * 60),
    taken: false, id: i,
  }));
}

// Bangunan: {x, y, w, h, color, roof, trim, floors, landmark?}
export function generateCity(seed) {
  const random = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const containers = [];
  const stalls = [];
  // Blok di antara jalan: isi dengan 1-4 bangunan per blok.
  for (let vi = 0; vi < V_ROADS.length - 1; vi++) {
    for (let hi = 0; hi < H_ROADS.length - 1; hi++) {
      const x0 = V_ROADS[vi] + ROAD_W / 2 + 14;
      const x1 = V_ROADS[vi + 1] - ROAD_W / 2 - 14;
      const y0 = H_ROADS[hi] + ROAD_W / 2 + 14;
      const y1 = H_ROADS[hi + 1] - ROAD_W / 2 - 14;
      const isPark = vi === 3 && hi === 3;
      const isDock = vi === 0 && hi === 5;
      const isMarket = vi === 4 && hi === 1;
      const isHospital = vi === 5 && hi === 2;
      const isPolice = vi === 1 && hi === 1;
      if (isPark) {
        for (let t = 0; t < 16; t++) {
          trees.push({ x: x0 + random() * (x1 - x0), y: y0 + random() * (y1 - y0), r: 10 + random() * 14 });
        }
        continue;
      }
      if (isDock) {
        for (let c = 0; c < 10; c++) {
          containers.push({
            x: x0 + random() * (x1 - x0 - 70), y: y0 + random() * (y1 - y0 - 30),
            w: 58 + random() * 20, h: 24, color: pick(random, ['#c0392b', '#2471a3', '#d4ac0d', '#229954', '#7d3c98']),
          });
        }
        continue;
      }
      if (isMarket) {
        // Los pasar: deretan lapak beratap warna-warni, tanpa bangunan padat.
        for (let s = 0; s < 8; s++) {
          stalls.push({
            x: x0 + 20 + (s % 4) * 62, y: y0 + 24 + Math.floor(s / 4) * 78,
            w: 52, h: 40, color: pick(random, ['#e74c3c', '#f39c12', '#16a085', '#8e44ad', '#2980b9']),
          });
        }
        for (let t = 0; t < 4; t++) {
          trees.push({ x: x0 + random() * (x1 - x0), y: y0 + random() * (y1 - y0), r: 9 + random() * 8 });
        }
        continue;
      }
      if (isHospital) {
        buildings.push({
          x: x0 + 30, y: y0 + 20, w: x1 - x0 - 60, h: y1 - y0 - 40,
          color: '#eaf2f8', roof: '#aed6f1', trim: '#2e86c1', floors: 3, landmark: 'hospital',
        });
        continue;
      }
      if (isPolice) {
        buildings.push({
          x: x0 + 40, y: y0 + 30, w: x1 - x0 - 80, h: y1 - y0 - 60,
          color: '#d6dbdf', roof: '#2471a3', trim: '#f1c40f', floors: 2, landmark: 'police',
        });
        continue;
      }
      const cols = random() < 0.5 ? 2 : 1;
      const rows = random() < 0.5 ? 2 : 1;
      const cw = (x1 - x0) / cols;
      const ch = (y1 - y0) / rows;
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if (random() < 0.12) continue; // lahan kosong / parkir
          const pal = pick(random, PALETTES);
          const bw = cw * (0.62 + random() * 0.26);
          const bh = ch * (0.62 + random() * 0.26);
          buildings.push({
            x: x0 + cx * cw + (cw - bw) / 2,
            y: y0 + cy * ch + (ch - bh) / 2,
            w: bw, h: bh,
            color: pal[0], roof: pal[1], trim: pal[2],
            floors: 1 + Math.floor(random() * 4),
          });
        }
      }
    }
  }
  // Deret ruko di tepi pantai timur (x > 3160) — kawasan wisata Teluk Arun.
  for (let y = 120; y < WORLD_H - 200; y += 150) {
    buildings.push({
      x: 3180, y, w: 110, h: 96,
      color: pick(random, PALETTES)[0], roof: '#f7dc6f', trim: '#fdfefe',
      floors: 2, beachfront: true,
    });
  }
  // Pohon jalanan: sepasang di tiap blok taman kota + tepi pantai.
  for (let i = 0; i < 10; i++) {
    trees.push({ x: 3320 + random() * 60, y: 200 + i * 220, r: 12 + random() * 8 });
  }
  return { buildings, trees, containers, stalls };
}

export function isOnRoad(x, y) {
  for (const rx of V_ROADS) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of H_ROADS) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = null; let bestD = Infinity;
  for (const rx of V_ROADS) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, axis: 'v' }; }
  }
  for (const ry of H_ROADS) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, axis: 'h' }; }
  }
  return best;
}

// Titik jalan terdekat yang aman untuk spawn (di tengah jalan).
export function roadSpawn(random, margin = 120) {
  const rx = pick(random, V_ROADS);
  const ry = pick(random, H_ROADS);
  if (random() < 0.5) return { x: rx + (random() - 0.5) * 30, y: margin + random() * (WORLD_H - margin * 2), axis: 'v' };
  return { x: margin + random() * (WORLD_W - margin * 2), y: ry + (random() - 0.5) * 30, axis: 'h' };
}

export function collideBuildings(buildings, x, y, r) {
  for (const b of buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// Geser posisi keluar dari bangunan (resolve AABB sederhana).
export function resolveBuildingCollision(buildings, pos, r) {
  const b = collideBuildings(buildings, pos.x, pos.y, r);
  if (!b) return false;
  const dxLeft = pos.x + r - b.x;
  const dxRight = b.x + b.w - (pos.x - r);
  const dyTop = pos.y + r - b.y;
  const dyBottom = b.y + b.h - (pos.y - r);
  const m = Math.min(dxLeft, dxRight, dyTop, dyBottom);
  if (m === dxLeft) pos.x = b.x - r;
  else if (m === dxRight) pos.x = b.x + b.w + r;
  else if (m === dyTop) pos.y = b.y - r;
  else pos.y = b.y + b.h + r;
  return true;
}

export function clampWorld(pos, r) {
  pos.x = Math.max(r, Math.min(WORLD_W - r, pos.x));
  pos.y = Math.max(r, Math.min(WORLD_H - r, pos.y));
}

// ---- Render dunia (dipanggil tiap frame, hanya area kamera) ----
// sun: 0..1 — posisi matahari sore; memengaruhi warna tint (diterapkan di effects).
export function drawWorld(ctx, city, cam, time) {
  const { x: cx, y: cy, w: vw, h: vh } = cam;
  const x0 = Math.max(0, cx - 40); const y0 = Math.max(0, cy - 40);
  const x1 = Math.min(WORLD_W, cx + vw + 40); const y1 = Math.min(WORLD_H, cy + vh + 40);

  // Tanah dasar: rumput kota.
  ctx.fillStyle = '#8fbf6f';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Pantai timur: pasir + laut.
  if (x1 > 3300) {
    ctx.fillStyle = '#f2ddab';
    ctx.fillRect(Math.max(x0, 3300), y0, x1 - Math.max(x0, 3300), y1 - y0);
    ctx.fillStyle = '#2fa8c9';
    ctx.fillRect(Math.max(x0, 3440), y0, x1 - Math.max(x0, 3440), y1 - y0);
    // Ombak: garis putih berdenyut di garis pantai.
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    for (let wy = Math.floor(y0 / 90) * 90; wy < y1; wy += 90) {
      const wob = Math.sin(time / 700 + wy / 120) * 6;
      ctx.beginPath();
      ctx.moveTo(3440 + wob, wy);
      ctx.quadraticCurveTo(3468 + wob, wy + 22, 3440 + wob, wy + 44);
      ctx.stroke();
    }
  }

  // Taman kota: rumput lebih gelap + kolam.
  ctx.fillStyle = '#6aa84f';
  ctx.fillRect(PARK.x0, PARK.y0, PARK.x1 - PARK.x0, PARK.y1 - PARK.y0);
  ctx.fillStyle = '#3d85c6';
  ctx.beginPath();
  ctx.ellipse((PARK.x0 + PARK.x1) / 2, (PARK.y0 + PARK.y1) / 2, 52, 34, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trotoar di sekitar jalan.
  ctx.fillStyle = '#cfc8b8';
  for (const rx of V_ROADS) ctx.fillRect(rx - ROAD_W / 2 - 12, y0, ROAD_W + 24, y1 - y0);
  for (const ry of H_ROADS) ctx.fillRect(x0, ry - ROAD_W / 2 - 12, x1 - x0, ROAD_W + 24);

  // Aspal jalan.
  ctx.fillStyle = '#3c3f46';
  for (const rx of V_ROADS) ctx.fillRect(rx - ROAD_W / 2, y0, ROAD_W, y1 - y0);
  for (const ry of H_ROADS) ctx.fillRect(x0, ry - ROAD_W / 2, x1 - x0, ROAD_W);

  // Garis tengah putus-putus.
  ctx.strokeStyle = '#f5d76e';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  for (const rx of V_ROADS) {
    ctx.beginPath(); ctx.moveTo(rx, y0); ctx.lineTo(rx, y1); ctx.stroke();
  }
  for (const ry of H_ROADS) {
    ctx.beginPath(); ctx.moveTo(x0, ry); ctx.lineTo(x1, ry); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Zebra cross di tiap persimpangan.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const rx of V_ROADS) {
    for (const ry of H_ROADS) {
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(rx - ROAD_W / 2 + 8, ry + i * 16 - 5, 18, 10);
        ctx.fillRect(rx + ROAD_W / 2 - 26, ry + i * 16 - 5, 18, 10);
      }
    }
  }

  // Pelabuhan: dermaga kayu di barat daya.
  ctx.fillStyle = '#8d6e63';
  ctx.fillRect(60, H_ROADS[5] - 10, 220, 26);
  ctx.fillStyle = '#5d4037';
  for (let px = 70; px < 280; px += 24) ctx.fillRect(px, H_ROADS[5] - 10, 3, 26);

  // SPBU Arun: kanopi kuning + 2 pompa + garis parkir.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(GAS_STATION.x - 60, GAS_STATION.y - 44, 150, 90);
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(GAS_STATION.x - 66, GAS_STATION.y - 50, 150, 14);
  ctx.fillStyle = '#d35400';
  ctx.fillRect(GAS_STATION.x - 66, GAS_STATION.y - 50, 150, 4);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(GAS_STATION.x - 40, GAS_STATION.y - 20, 18, 30);
  ctx.fillRect(GAS_STATION.x + 10, GAS_STATION.y - 20, 18, 30);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SPBU', GAS_STATION.x + 9, GAS_STATION.y - 56);
  ctx.fillText('ARUN', GAS_STATION.x + 9, GAS_STATION.y + 62);

  // Lapak Pasar Senja: atap garis + bayangan.
  for (const s of city.stalls) {
    if (s.x > x1 || s.x + s.w < x0 || s.y > y1 || s.y + s.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(s.x + 3, s.y + 4, s.w, s.h);
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x, s.y, s.w, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let lx = s.x + 6; lx < s.x + s.w; lx += 12) ctx.fillRect(lx, s.y, 6, 14);
    ctx.fillStyle = '#7e5109';
    ctx.fillRect(s.x + 4, s.y + 16, s.w - 8, s.h - 16);
  }

  // Kontainer pelabuhan.
  for (const c of city.containers) {
    if (c.x > x1 || c.x + c.w < x0 || c.y > y1 || c.y + c.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(c.x + 4, c.y + 4, c.w, c.h);
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    for (let lx = c.x + 8; lx < c.x + c.w; lx += 10) {
      ctx.beginPath(); ctx.moveTo(lx, c.y); ctx.lineTo(lx, c.y + c.h); ctx.stroke();
    }
  }

  // Pohon.
  for (const t of city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#43a047';
    ctx.beginPath(); ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }

  // Bangunan: bayangan, badan, atap, jendela, ikon landmark.
  for (const b of city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, Math.min(16, b.h - 10));
    ctx.strokeStyle = b.trim;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Jendela berbaris.
    ctx.fillStyle = 'rgba(20,40,70,0.75)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 30));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        if (cy === 0) continue;
        ctx.fillRect(b.x + 10 + cx * ((b.w - 20) / cols), b.y + 24 + cy * ((b.h - 34) / rows), 10, 12);
      }
    }
    if (b.landmark === 'hospital') {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(b.x + b.w / 2 - 22, b.y + b.h / 2 - 6, 44, 12);
      ctx.fillRect(b.x + b.w / 2 - 6, b.y + b.h / 2 - 22, 12, 44);
    } else if (b.landmark === 'police') {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
        const px = b.x + b.w / 2 + Math.cos(a) * 20;
        const py = b.y + b.h / 2 + Math.sin(a) * 20;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    }
  }

  // Label landmark (membantu orientasi + menunjukkan kota yang hidup).
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  for (const lm of LANDMARKS) {
    if (lm.x < x0 || lm.x > x1 || lm.y < y0 || lm.y > y1) continue;
    if (lm.kind === 'gas' || lm.kind === 'dock' || lm.kind === 'beach') continue;
    ctx.fillText(lm.label, lm.x, lm.y - 46);
  }
  // Nama jalan di persimpangan besar.
  const streetNames = ['Jl. Merdeka', 'Jl. Pelita', 'Jl. Arun', 'Jl. Senja', 'Jl. Karang', 'Jl. Ombak'];
  V_ROADS.forEach((rx, i) => {
    ctx.fillText(streetNames[i % streetNames.length], rx, H_ROADS[0] - ROAD_W / 2 - 18);
  });
}
