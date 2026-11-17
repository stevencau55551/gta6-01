// systems.js — wanted level, misi berantai + cerita, combat, koin Arun,
// kerja taksi, dan progresi. Misi "Teluk Arun": Raka Pradana, mantan kurir,
// terseret utang geng Pelabuhan.
import { WORLD_W, WORLD_H, V_ROADS, H_ROADS, coinSpots } from './world.js';
import { createCar, angleDiff } from './entities.js';

export const MISSIONS = [
  {
    id: 'pesanan-terakhir',
    title: 'Misi 1 — Pesanan Terakhir',
    story: 'Raka butuh uang cepat. Antar paket ke warung Bu Sari di Jl. Arun sebelum tengah hari.',
    steps: [
      { id: 'ambil', text: 'Ambil paket di gudang pelabuhan (barat daya).', x: 180, y: 2060, radius: 90 },
      { id: 'antar', text: 'Antar paket ke warung Bu Sari di Jl. Arun.', x: 1520, y: 980, radius: 90 },
    ],
    reward: 400,
  },
  {
    id: 'utang-lama',
    title: 'Misi 2 — Utang Lama',
    story: 'Paket itu jebakan: isinya utang geng Pelabuhan. Curi mobil sport di Jl. Pelita dan kabur dari polisi.',
    steps: [
      { id: 'curi', text: 'Curi mobil sport kuning di Jl. Pelita (tekan E di dekatnya).', x: 1120, y: 620, radius: 110, needCar: 'sport' },
      { id: 'kabur', text: 'Kabur! Hilangkan kejaran polisi, lalu sampai ke tempat aman di taman kota.', x: 1720, y: 1520, radius: 120, needWantedZero: true },
    ],
    reward: 800,
  },
  {
    id: 'pelabuhan-malam',
    title: 'Misi 3 — Pelabuhan Malam',
    story: 'Bos geng, Darma, menunggu di pelabuhan. Hadapi anak buahnya dan akhiri utang ini — malam ini juga.',
    steps: [
      { id: 'sergap', text: 'Ke pelabuhan. Kalahkan 4 anak buah Darma.', x: 200, y: 2060, radius: 130, needKills: 4 },
      { id: 'darma', text: 'Kalahkan Darma, bos geng Pelabuhan!', x: 200, y: 2060, radius: 130, needKills: 5 },
      { id: 'pulang', text: 'Utang lunas. Kembali ke apartemen Raka di Jl. Merdeka.', x: 720, y: 260, radius: 100 },
    ],
    reward: 1500,
  },
];

export function createMissionState() {
  return { index: 0, step: 0, kills: 0, done: false, allDone: false, objective: null };
}

export function currentMission(state) {
  return state.allDone ? null : MISSIONS[state.index];
}

export function currentStep(state) {
  const m = currentMission(state);
  return m ? m.steps[state.step] : null;
}

export function missionObjective(state) {
  const step = currentStep(state);
  return step ? { x: step.x, y: step.y, text: step.text, title: currentMission(state).title } : null;
}

// "Langkah 2/3" untuk HUD — progresi yang terlihat di screenshot.
export function missionProgress(state) {
  const m = currentMission(state);
  if (!m) return null;
  return { index: state.index + 1, total: MISSIONS.length, step: state.step + 1, steps: m.steps.length };
}

// ---- Wanted: 0-5 bintang. Naik karena kejahatan, turun bila tenang. ----
export function createWanted() {
  return { level: 0, heat: 0, decayTimer: 0, lastReason: '' };
}

export function addWanted(wanted, amount, reason) {
  wanted.level = Math.max(0, Math.min(5, wanted.level + amount));
  wanted.heat = 100;
  wanted.lastReason = reason || '';
  return wanted.level;
}

export function updateWanted(wanted, dt, policeNear, committingCrime) {
  if (wanted.level === 0) return;
  if (committingCrime) { wanted.heat = 100; wanted.decayTimer = 0; return; }
  wanted.decayTimer += dt;
  // Bintang turun tiap ~25 detik tenang (lebih cepat bila polisi jauh).
  const interval = policeNear ? 40 : 22;
  if (wanted.decayTimer > interval) {
    wanted.decayTimer = 0;
    wanted.level = Math.max(0, wanted.level - 1);
  }
}

// Jumlah polisi aktif mengikuti bintang: 1 + level.
export function wantedPoliceCount(wanted) {
  return wanted.level === 0 ? 0 : 1 + wanted.level;
}

// ---- Combat: tembakan pemain & musuh, pukulan, peluru ----
export function createBullet(x, y, angle, fromPlayer, damage = 34) {
  return { x, y, angle, speed: 780, fromPlayer, damage, life: 0.9, dead: false };
}

export function updateBullets(bullets, dt, buildings, targets, onHit) {
  for (const b of bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD_W || b.y > WORLD_H) { b.dead = true; continue; }
    // Tabrak bangunan.
    let blocked = false;
    for (const bl of buildings) {
      if (b.x > bl.x && b.x < bl.x + bl.w && b.y > bl.y && b.y < bl.y + bl.h) { blocked = true; break; }
    }
    if (blocked) { b.dead = true; continue; }
    for (const t of targets) {
      if (t.hp <= 0) continue;
      if (Math.hypot(t.x - b.x, t.y - b.y) < 16) {
        t.hp -= b.damage;
        b.dead = true;
        onHit(t, b);
        break;
      }
    }
  }
  return bullets.filter((b) => !b.dead);
}

// Musuh misi 3: anak buah geng + bos Darma.
export function createEnemy(x, y, isBoss) {
  return {
    x, y, angle: 0, hp: isBoss ? 220 : 80, maxHp: isBoss ? 220 : 80,
    isBoss: !!isBoss, name: isBoss ? 'Darma' : 'Anak buah',
    shootCooldown: 1 + Math.random(), speed: isBoss ? 95 : 75,
    color: isBoss ? '#7d3c98' : '#922b21',
    strafeDir: Math.random() < 0.5 ? 1 : -1, strafeTimer: 2 + Math.random() * 2,
  };
}

// Musuh mendekat sampai jarak tembak, lalu bergerak menyamping (strafe)
// sambil menembak — tidak lagi diam di tempat seperti v1.
export function updateEnemy(e, playerPos, dt, buildings, bullets, onShoot) {
  const dist = Math.hypot(playerPos.x - e.x, playerPos.y - e.y);
  const target = Math.atan2(playerPos.y - e.y, playerPos.x - e.x);
  e.angle += angleDiff(target, e.angle) * Math.min(1, 4 * dt);
  e.strafeTimer -= dt;
  if (e.strafeTimer <= 0) { e.strafeDir *= -1; e.strafeTimer = 1.5 + Math.random() * 2; }
  if (dist > 260) {
    e.x += Math.cos(e.angle) * e.speed * dt;
    e.y += Math.sin(e.angle) * e.speed * dt;
  } else if (dist < 120) {
    e.x -= Math.cos(e.angle) * e.speed * 0.6 * dt;
    e.y -= Math.sin(e.angle) * e.speed * 0.6 * dt;
  } else {
    // Strafe menyamping dalam jarak tembak.
    const sa = e.angle + (Math.PI / 2) * e.strafeDir;
    e.x += Math.cos(sa) * e.speed * 0.55 * dt;
    e.y += Math.sin(sa) * e.speed * 0.55 * dt;
  }
  e.x = Math.max(20, Math.min(WORLD_W - 20, e.x));
  e.y = Math.max(20, Math.min(WORLD_H - 20, e.y));
  e.shootCooldown -= dt;
  if (e.shootCooldown <= 0 && dist < 520) {
    e.shootCooldown = e.isBoss ? 0.9 : 1.6 + Math.random() * 0.8;
    onShoot(createBullet(e.x + Math.cos(e.angle) * 16, e.y + Math.sin(e.angle) * 16, e.angle + (Math.random() - 0.5) * 0.14, false, e.isBoss ? 12 : 8));
  }
  return dist;
}

export function drawEnemy(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(e.angle);
  ctx.fillStyle = e.color;
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f5c99b';
  ctx.beginPath(); ctx.arc(5, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(8, -2, 13, 4);
  ctx.restore();
  // Bilah HP musuh.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(e.x - 18, e.y - 26, 36, 5);
  ctx.fillStyle = e.isBoss ? '#af7ac5' : '#e74c3c';
  ctx.fillRect(e.x - 18, e.y - 26, 36 * Math.max(0, e.hp / e.maxHp), 5);
  if (e.isBoss) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DARMA', e.x, e.y - 32);
  }
}

// ---- Koin Arun: 10 koleksi tersembunyi, +$60 tiap koin ----
// Perbaikan v1: koin memakai posisi deterministik dari seed (coinSpots),
// bukan acak tiap sesi — bisa diverifikasi & dipotret.
export const COIN_VALUE = 60;
export function createCoins(seed) {
  return coinSpots(seed);
}

export function updateCoins(coins, player, onCollect) {
  let got = 0;
  for (const c of coins) {
    if (c.taken) continue;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    if (Math.hypot(c.x - px, c.y - py) < 30) {
      c.taken = true;
      got += 1;
      onCollect(c);
    }
  }
  return got;
}

export function drawCoin(ctx, c, time) {
  if (c.taken) return;
  const bob = Math.sin(time / 300 + c.id) * 3;
  ctx.save();
  ctx.translate(c.x, c.y + bob);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 8 - bob, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f39c12';
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('A', 0, 3.5);
  ctx.restore();
}

// ---- Kerja taksi: masuk taksi -> penumpang muncul -> antar -> dibayar ----
// Destinasi tetap (persimpangan bernama) supaya tarif bisa dihitung jujur.
export const TAXI_STOPS = [
  { x: 720, y: 260, label: 'Jl. Merdeka' },
  { x: 2320, y: 620, label: 'Jl. Pelita' },
  { x: 3080, y: 1700, label: 'Jl. Ombak' },
  { x: 3400, y: 980, label: 'Pantai Arun' },
  { x: 1520, y: 2360, label: 'Permukiman Senja' },
];

export function createTaxiJob() {
  return { active: false, phase: 'idle', passenger: null, dest: null, fare: 0, timer: 0 };
}

// Penumpang menunggu di trotoar dekat pemain saat taksi diambil.
export function startTaxiJob(job, player, random) {
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  const dest = TAXI_STOPS[Math.floor(random() * TAXI_STOPS.length)];
  const dist = Math.hypot(dest.x - px, dest.y - py);
  job.active = true;
  job.phase = 'pickup';
  job.passenger = { x: px + 60, y: py + 40 };
  job.dest = dest;
  job.fare = 40 + Math.round(dist / 20);
  job.timer = 0;
  return job;
}

export function updateTaxiJob(job, player, dt, events) {
  if (!job.active) return;
  job.timer += dt;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  if (job.phase === 'pickup') {
    if (Math.hypot(job.passenger.x - px, job.passenger.y - py) < 46) {
      job.phase = 'drive';
      events.push({ type: 'taxi', text: `Penumpang naik! Antar ke ${job.dest.label} — tarif $${job.fare}.` });
    }
  } else if (job.phase === 'drive') {
    if (Math.hypot(job.dest.x - px, job.dest.y - py) < 90) {
      job.active = false;
      job.phase = 'done';
      events.push({ type: 'taxi-paid', text: `Tarif dibayar: +$${job.fare}.`, fare: job.fare });
    }
  }
  // Penumpang kabur bila pemain keluar taksi terlalu lama.
  if (job.phase === 'pickup' && !player.inCar && job.timer > 30) {
    job.active = false;
    job.phase = 'idle';
    events.push({ type: 'taxi', text: 'Penumpang taksi pergi — terlalu lama menunggu.' });
  }
}

// ---- Progresi misi: cek objektif tercapai ----
// Perbaikan v1 (bug nyata): langkah needWantedZero dulu membaca
// `events.wantedLevel` yang tidak pernah diisi siapa pun, sehingga misi 2
// langkah 2 TIDAK PERNAH bisa selesai. Kini wantedLevel jadi parameter.
export function updateMission(state, player, enemies, events, wantedLevel) {
  const m = currentMission(state);
  if (!m) return;
  const step = m.steps[state.step];
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  const d = Math.hypot(step.x - px, step.y - py);
  if (step.needKills !== undefined) {
    if (state.kills >= step.needKills && d < step.radius + 220) advanceStep(state, m, events);
    return;
  }
  if (step.needCar === 'sport') {
    if (player.inCar && player.inCar.type === 'sport' && d < step.radius) advanceStep(state, m, events);
    return;
  }
  if (step.needWantedZero) {
    if (d < step.radius && wantedLevel === 0) advanceStep(state, m, events);
    return;
  }
  if (d < step.radius) advanceStep(state, m, events);
}

function advanceStep(state, mission, events) {
  state.step += 1;
  events.push({ type: 'step', text: 'Objektif selesai!' });
  if (state.step >= mission.steps.length) {
    events.push({ type: 'mission', text: `${mission.title} selesai! +$${mission.reward}` });
    state.index += 1;
    state.step = 0;
    state.kills = 0;
    if (state.index >= MISSIONS.length) {
      state.allDone = true;
      events.push({ type: 'story', text: 'TAMAT — Raka bebas dari utang. Teluk Arun miliknya lagi.' });
    }
  }
}

// Spawn musuh saat misi 3 dimulai (langkah sergapan).
export function spawnMissionEnemies(random) {
  const list = [];
  const spots = [
    [140, 1980], [260, 2140], [320, 2000], [120, 2160],
  ];
  for (const [x, y] of spots) list.push(createEnemy(x, y, false));
  return list;
}

export function spawnBoss() {
  return createEnemy(200, 2060, true);
}

// Mobil sport kuning untuk misi 2, diparkir di Jl. Pelita.
export function spawnSportCar() {
  return createCar(1120, 620, Math.PI / 2, { color: '#f1c40f', type: 'sport' });
}
