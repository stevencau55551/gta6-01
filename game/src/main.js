// main.js — init, game loop, dan koordinasi state Teluk Arun.
// Layar: title | play | paused | over | victory. Mode ?shot=... menata adegan
// untuk screenshot (overview | drive | chase | action) lalu set window.__shotReady.
import { WORLD_W, WORLD_H, generateCity, mulberry32, drawWorld, isOnRoad, roadSpawn } from './world.js';
import {
  createPlayer, createCar, createPedestrian, updatePlayerCar, updateTrafficCar,
  updatePoliceCar, updatePedestrian, updatePlayerOnFoot, drawCar, drawPlayer,
  drawPedestrian, spawnTraffic, spawnPedestrians, angleDiff,
} from './entities.js';
import {
  MISSIONS, createMissionState, currentMission, currentStep, missionObjective,
  createWanted, addWanted, updateWanted, wantedPoliceCount, createBullet,
  updateBullets, createEnemy, updateEnemy, drawEnemy, updateMission,
  spawnMissionEnemies, spawnBoss, spawnSportCar,
} from './systems.js';
import {
  createParticles, spawnParticles, updateParticles, drawParticles,
  createShake, addShake, shakeOffset, drawLighting,
  createAudio, ensureAudio, playShot, playPunch, playPickup, playMission,
  playHorn, playCrash, playSiren, updateEngineSound,
} from './effects.js';
import {
  createInput, drawHUD, drawMinimap, showMenu, hideMenu,
  startMenuHTML, pauseMenuHTML, gameOverHTML, victoryHTML,
} from './input-ui.js';

const SAVE_KEY = 'teluk-arun-save-v1';
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261117;
const random = mulberry32(seed);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const menuEl = document.getElementById('menu');
const statusEl = document.getElementById('status');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const city = generateCity(seed);
const input = createInput(canvas);
const audio = createAudio();
const particles = createParticles();
const shake = createShake();

// ---- State permainan ----
const state = {
  screen: shot ? 'play' : 'title',
  player: createPlayer(720, 620),
  traffic: [],
  peds: [],
  police: [],
  enemies: [],
  bullets: [],
  mission: createMissionState(),
  wanted: createWanted(),
  camera: { x: 0, y: 0, w: canvas.width, h: canvas.height },
  message: '', messageTimer: 0,
  time: 0, elapsed: 0,
  enemiesSpawned: false, bossSpawned: false, sportSpawned: false,
  events: [],
};

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      missionIndex: state.mission.index, cash: state.player.cash,
      hp: state.player.hp, ammo: state.player.ammo,
    }));
  } catch { /* penyimpanan boleh mati */ }
}

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function announce(msg) {
  statusEl.textContent = msg;
  state.message = msg;
  state.messageTimer = 4;
}

function setScreen(name) {
  state.screen = name;
  if (name === 'title') showMenu(menuEl, startMenuHTML(!!loadSave()));
  else if (name === 'paused') showMenu(menuEl, pauseMenuHTML());
  else if (name === 'over') showMenu(menuEl, gameOverHTML('Polisi menangkap Raka di tengah jalan.', state.player.cash));
  else if (name === 'victory') showMenu(menuEl, victoryHTML(state.player.cash));
  else hideMenu(menuEl);
  wireMenuButtons();
}

function wireMenuButtons() {
  const play = document.getElementById('btn-play');
  if (play) play.onclick = () => { ensureAudio(audio); startGame(false); };
  const fresh = document.getElementById('btn-new');
  if (fresh) fresh.onclick = () => { ensureAudio(audio); startGame(true); };
  const resume = document.getElementById('btn-resume');
  if (resume) resume.onclick = () => setScreen('play');
  const restart = document.getElementById('btn-restart');
  if (restart) restart.onclick = () => startGame(true);
  const retry = document.getElementById('btn-retry');
  if (retry) retry.onclick = () => startGame(true);
  const again = document.getElementById('btn-again');
  if (again) again.onclick = () => startGame(true);
}

function startGame(fresh) {
  const save = fresh ? null : loadSave();
  state.player = createPlayer(720, 620);
  state.mission = createMissionState();
  state.wanted = createWanted();
  state.police = [];
  state.enemies = [];
  state.bullets = [];
  state.enemiesSpawned = false;
  state.bossSpawned = false;
  state.sportSpawned = false;
  state.traffic = spawnTraffic(random, 14, state.player);
  state.peds = spawnPedestrians(random, 22, state.player);
  if (save) {
    state.mission.index = Math.min(save.missionIndex || 0, MISSIONS.length - 1);
    state.player.cash = save.cash || 250;
    state.player.hp = save.hp || 100;
    state.player.ammo = save.ammo ?? 24;
    announce(`Selamat datang kembali, Raka. Misi ${state.mission.index + 1} menanti.`);
  } else {
    announce('Misi 1: ambil paket di gudang pelabuhan.');
  }
  setScreen('play');
}

// ---- Aksi pemain ----
function nearestCar(maxDist) {
  let best = null; let bestD = maxDist;
  for (const c of [...state.traffic, ...state.police]) {
    const d = Math.hypot(c.x - state.player.x, c.y - state.player.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function enterCar(car) {
  state.player.inCar = car;
  car.isPlayerCar = true;
  car.driver = true;
  state.traffic = state.traffic.filter((c) => c !== car);
  if (car.isPolice) {
    state.police = state.police.filter((c) => c !== car);
    car.isPolice = false;
  }
  playHorn(audio);
}

function exitCar() {
  const car = state.player.inCar;
  if (!car) return;
  car.isPlayerCar = false;
  car.speed = 0;
  state.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  state.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  state.player.inCar = null;
  state.traffic.push(car);
}

function stealCar() {
  const car = nearestCar(70);
  if (!car) return;
  if (car.driver && !car.isPlayerCar) {
    // Mobil berpengemudi: curi = kejahatan, wanted naik.
    addWanted(state.wanted, 1, 'curi mobil');
    announce('Mobil dicuri! Polisi mengejarmu.');
    spawnParticles(particles, car.x, car.y, { count: 8, color: '#ff7675' });
  }
  enterCar(car);
}

function playerShoot() {
  const p = state.player;
  if (p.inCar || p.shootCooldown > 0 || p.ammo <= 0) return;
  p.shootCooldown = 0.28;
  p.ammo -= 1;
  const cam = state.camera;
  const wx = input.mouseX + cam.x;
  const wy = input.mouseY + cam.y;
  const angle = Math.atan2(wy - p.y, wx - p.x);
  p.angle = angle;
  state.bullets.push(createBullet(p.x + Math.cos(angle) * 18, p.y + Math.sin(angle) * 18, angle, true));
  playShot(audio);
  addShake(shake, 0.12);
  spawnParticles(particles, p.x + Math.cos(angle) * 22, p.y + Math.sin(angle) * 22, { count: 5, color: '#fdcb6e', speed: 160 });
}

function playerPunch() {
  const p = state.player;
  if (p.inCar || p.punchCooldown > 0) return;
  p.punchCooldown = 0.45;
  playPunch(audio);
  for (const e of state.enemies) {
    if (e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < 46) {
      e.hp -= 26;
      spawnParticles(particles, e.x, e.y, { count: 8, color: '#ff7675' });
      addShake(shake, 0.2);
      if (e.hp <= 0) onEnemyDown(e);
    }
  }
}

function onEnemyDown(e) {
  state.mission.kills += 1;
  state.player.cash += 50;
  spawnParticles(particles, e.x, e.y, { count: 18, color: '#e17055' });
  announce(e.isBoss ? 'Darma tumbang! Utang lunas.' : 'Anak buah tumbang. +$50');
  if (e.isBoss) addWanted(state.wanted, 1, 'kalahkan bos');
}

// ---- Polisi ----
function syncPolice(dt) {
  const want = wantedPoliceCount(state.wanted);
  while (state.police.length < want) {
    const p = state.player.inCar ? state.player.inCar : state.player;
    const a = Math.random() * Math.PI * 2;
    const car = createCar(
      Math.max(80, Math.min(WORLD_W - 80, p.x + Math.cos(a) * 620)),
      Math.max(80, Math.min(WORLD_H - 80, p.y + Math.sin(a) * 620)),
      a, { color: '#0a3d91', type: 'sedan', isPolice: true },
    );
    state.police.push(car);
  }
  while (state.police.length > want) state.police.pop();
}

// ---- Update per frame ----
function update(dt) {
  state.time += dt;
  state.elapsed += dt;
  const p = state.player;

  if (input.consumeMute()) {
    audio.muted = !audio.muted;
    announce(audio.muted ? 'Suara mati.' : 'Suara hidup.');
  }
  if (input.consumePause()) {
    setScreen(state.screen === 'play' ? 'paused' : 'play');
    return;
  }
  if (state.screen !== 'play') return;

  // Misi 2: mobil sport muncul saat misi aktif.
  if (state.mission.index === 1 && !state.sportSpawned) {
    state.sportSpawned = true;
    state.traffic.push(spawnSportCar());
  }
  // Misi 3: musuh muncul saat langkah sergapan.
  if (state.mission.index === 2 && state.mission.step === 0 && !state.enemiesSpawned) {
    state.enemiesSpawned = true;
    state.enemies = spawnMissionEnemies(random);
    announce('Anak buah Darma menghadang di pelabuhan!');
  }
  if (state.mission.index === 2 && state.mission.step === 1 && !state.bossSpawned) {
    state.bossSpawned = true;
    state.enemies.push(spawnBoss());
    announce('DARMA muncul! Kalahkan dia!');
  }

  // Input aksi.
  if (input.consumeInteract()) {
    if (p.inCar) exitCar();
    else stealCar();
  }
  if (input.consumePunch()) playerPunch();
  if (input.consumeClick()) playerShoot();
  if (input.consumeHorn() && p.inCar) playHorn(audio);

  // Gerakan pemain / mobil.
  if (p.inCar) {
    const prevSpeed = p.inCar.speed;
    updatePlayerCar(p.inCar, input, dt, city.buildings);
    if (Math.abs(prevSpeed - p.inCar.speed) > 180) { playCrash(audio); addShake(shake, 0.3); }
    // Tabrak pejalan kaki = kejahatan.
    for (const ped of state.peds) {
      if (Math.hypot(ped.x - p.inCar.x, ped.y - p.inCar.y) < 26 && Math.abs(p.inCar.speed) > 80) {
        ped.panic = 3;
        addWanted(state.wanted, 1, 'tabrak pejalan kaki');
      }
    }
  } else {
    updatePlayerOnFoot(p, input, dt, city.buildings);
    // Arah hadap mengikuti mouse saat membidik.
    if (input.mouseDown) {
      const wx = input.mouseX + state.camera.x;
      const wy = input.mouseY + state.camera.y;
      p.angle = Math.atan2(wy - p.y, wx - p.x);
    }
  }

  // Lalu lintas & pejalan kaki.
  const danger = { x: p.inCar ? p.inCar.x : p.x, y: p.inCar ? p.inCar.y : p.y };
  for (const c of state.traffic) updateTrafficCar(c, dt, city.buildings, [...state.traffic, ...state.police, ...(p.inCar ? [p.inCar] : [])], random);
  for (const ped of state.peds) updatePedestrian(ped, dt, city.buildings, state.wanted.level > 0 ? danger : null);
  // Jaga populasi.
  if (state.traffic.length < 12) state.traffic.push(...spawnTraffic(random, 1, danger));
  if (state.peds.length < 18) state.peds.push(...spawnPedestrians(random, 1, danger));

  // Polisi mengejar.
  syncPolice(dt);
  let policeNear = false;
  for (const pc of state.police) {
    const d = updatePoliceCar(pc, danger, dt, city.buildings);
    if (d < 420) policeNear = true;
    // Polisi menabrak pemain: tangkap bila pelan, rusak bila kencang.
    if (d < 34) {
      if (p.inCar && Math.abs(p.inCar.speed) > 60) {
        p.inCar.speed *= 0.6;
        addShake(shake, 0.35);
        playCrash(audio);
      } else if (!p.inCar) {
        p.hp -= 34 * dt * 4;
        p.hurtFlash = 0.3;
        if (p.hp <= 0) { p.hp = 0; setScreen('over'); announce('Raka tertangkap polisi.'); return; }
      }
    }
  }
  updateWanted(state.wanted, dt, policeNear, false);
  playSiren(audio, dt, state.wanted.level);

  // Musuh menembak pemain.
  const playerTarget = { x: p.inCar ? p.inCar.x : p.x, y: p.inCar ? p.inCar.y : p.y, hp: p.hp };
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    updateEnemy(e, playerTarget, dt, city.buildings, state.bullets, (b) => state.bullets.push(b));
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0);

  // Peluru.
  const targets = [...state.enemies, playerTarget];
  state.bullets = updateBullets(state.bullets, dt, city.buildings, targets, (t, b) => {
    if (t === playerTarget) {
      // playerTarget hanya membawa posisi; damage sungguhan masuk ke p.hp.
      p.hp -= b.damage;
      p.hurtFlash = 0.3;
      addShake(shake, 0.15);
      if (p.hp <= 0) { p.hp = 0; setScreen('over'); }
    } else {
      spawnParticles(particles, t.x, t.y, { count: 6, color: '#ff7675' });
      if (t.hp <= 0) onEnemyDown(t);
    }
  });
  // Ammo pickup pasif: peluru bertambah pelan saat tenang.
  if (state.wanted.level === 0 && p.ammo < 24 && Math.random() < dt * 0.2) p.ammo += 1;

  // Misi.
  const before = state.mission.index;
  const beforeStep = state.mission.step;
  updateMission(state.mission, p, state.enemies, state.events);
  if (state.mission.index !== before || state.mission.step !== beforeStep) {
    const m = currentMission(state.mission);
    if (m) {
      p.cash += 0; // reward diberikan di akhir misi
      playMission(audio);
      announce(m.steps[state.mission.step].text);
      saveGame();
    }
  }
  // Reward misi selesai (terdeteksi dari event).
  for (const ev of state.events) {
    if (ev.type === 'mission') {
      const idx = state.mission.index - 1;
      if (idx >= 0) p.cash += MISSIONS[idx].reward;
      playMission(audio);
      announce(ev.text);
      saveGame();
    } else if (ev.type === 'step') {
      playPickup(audio);
    } else if (ev.type === 'story') {
      announce(ev.text);
      setScreen('victory');
      saveGame();
    }
  }
  state.events.length = 0;

  // Regenerasi HP pelan saat wanted 0.
  if (state.wanted.level === 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 2 * dt);

  updateParticles(particles, dt);
  updateEngineSound(audio, p.inCar ? p.inCar.speed : 0, !!p.inCar);

  // Kamera mengikuti pemain dengan mulus.
  const focus = p.inCar ? p.inCar : p;
  const tx = Math.max(0, Math.min(WORLD_W - canvas.width, focus.x - canvas.width / 2));
  const ty = Math.max(0, Math.min(WORLD_H - canvas.height, focus.y - canvas.height / 2));
  state.camera.x += (tx - state.camera.x) * Math.min(1, 5 * dt);
  state.camera.y += (ty - state.camera.y) * Math.min(1, 5 * dt);
  state.camera.w = canvas.width;
  state.camera.h = canvas.height;
  if (state.messageTimer > 0) state.messageTimer -= dt;
}

// ---- Render ----
function render() {
  const cam = state.camera;
  const so = shakeOffset(shake, 1 / 60, state.time * 1000);
  ctx.save();
  ctx.translate(-cam.x + so.x, -cam.y + so.y);
  drawWorld(ctx, city, { x: cam.x, y: cam.y, w: canvas.width, h: canvas.height }, state.time * 1000);
  // Penanda objektif misi di dunia.
  const obj = missionObjective(state.mission);
  if (obj && state.screen === 'play') {
    const pulse = 26 + Math.sin(state.time * 4) * 6;
    ctx.strokeStyle = '#ffd32a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(obj.x, obj.y, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd32a';
    ctx.beginPath(); ctx.arc(obj.x, obj.y, 6, 0, Math.PI * 2); ctx.fill();
    // Garis penunjuk dari pemain ke objektif.
    const p = state.player.inCar ? state.player.inCar : state.player;
    ctx.strokeStyle = 'rgba(255,211,42,0.35)';
    ctx.setLineDash([12, 10]);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(obj.x, obj.y); ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const c of state.traffic) drawCar(ctx, c, state.time);
  for (const pc of state.police) drawCar(ctx, pc, state.time);
  if (state.player.inCar) drawCar(ctx, state.player.inCar, state.time);
  for (const ped of state.peds) drawPedestrian(ctx, ped);
  for (const e of state.enemies) drawEnemy(ctx, e);
  if (!state.player.inCar) drawPlayer(ctx, state.player, state.time * 1000);
  drawParticles(ctx, particles);
  // Peluru.
  ctx.fillStyle = '#ffeaa7';
  for (const b of state.bullets) {
    ctx.fillRect(b.x - 2, b.y - 2, 5, 5);
  }
  ctx.restore();

  drawLighting(ctx, canvas.width, canvas.height);

  if (state.screen === 'play' || state.screen === 'paused') {
    const p = state.player;
    drawHUD(ctx, canvas.width, canvas.height, {
      player: p, wanted: state.wanted,
      mission: obj ? { title: currentMission(state.mission)?.title || '', text: obj.text } : null,
      cash: p.cash, time: state.time,
      speedKmh: p.inCar ? Math.abs(p.inCar.speed) * 0.36 : 0,
      inCar: !!p.inCar, ammo: p.ammo,
      message: state.message, messageTimer: state.messageTimer,
    });
    drawMinimap(ctx, canvas.width, canvas.height, {
      player: p, police: state.police, traffic: state.traffic,
      mission: obj, enemies: state.enemies,
    });
  }
}

// ---- Mode screenshot: tata adegan, gambar, tandai siap ----
function stageShot(name) {
  state.traffic = spawnTraffic(random, 14, { x: 1500, y: 900 });
  state.peds = spawnPedestrians(random, 20, { x: 1500, y: 900 });
  if (name === 'overview') {
    state.player = createPlayer(1520, 900);
    state.player.cash = 650;
    state.mission.index = 0; state.mission.step = 1;
    state.camera.x = 1520 - canvas.width / 2;
    state.camera.y = 900 - canvas.height / 2;
    announce('Misi 1: antar paket ke warung Bu Sari.');
  } else if (name === 'drive') {
    const car = createCar(1500, 980, 0, { color: '#0984e3', type: 'sedan' });
    car.speed = 240;
    state.player = createPlayer(1500, 980);
    state.player.inCar = car;
    car.isPlayerCar = true;
    state.mission.index = 0; state.mission.step = 1;
    state.camera.x = 1500 - canvas.width / 2;
    state.camera.y = 980 - canvas.height / 2;
    announce('Mengemudi ke warung Bu Sari — ikuti marker kuning!');
  } else if (name === 'chase') {
    const car = createCar(1920, 1340, 0, { color: '#f1c40f', type: 'sport' });
    car.speed = 300;
    state.player = createPlayer(1920, 1340);
    state.player.inCar = car;
    car.isPlayerCar = true;
    state.wanted.level = 3;
    state.mission.index = 1; state.mission.step = 1;
    for (let i = 0; i < 3; i++) {
      state.police.push(createCar(1920 - 160 - i * 90, 1340 + (i - 1) * 60, 0, { color: '#0a3d91', type: 'sedan', isPolice: true }));
    }
    state.camera.x = 1920 - canvas.width / 2;
    state.camera.y = 1340 - canvas.height / 2;
    announce('KABUR! Polisi mengejar — wanted ★★★');
  } else if (name === 'action') {
    state.player = createPlayer(260, 2060);
    state.player.hp = 68;
    state.player.ammo = 18;
    state.wanted.level = 4;
    state.mission.index = 2; state.mission.step = 0;
    state.enemies = spawnMissionEnemies(random);
    state.enemies.push(spawnBoss());
    spawnParticles(particles, 260, 2060, { count: 12, color: '#fdcb6e' });
    state.camera.x = 260 - canvas.width / 2;
    state.camera.y = 2060 - canvas.height / 2;
    announce('Pelabuhan malam: kalahkan anak buah Darma!');
  }
  // Kamera dijepit ke dunia.
  state.camera.x = Math.max(0, Math.min(WORLD_W - canvas.width, state.camera.x));
  state.camera.y = Math.max(0, Math.min(WORLD_H - canvas.height, state.camera.y));
  state.messageTimer = 10;
  render();
  render();
  window.__shotReady = true;
}

// ---- Loop utama ----
let last = performance.now();
let accumulator = 0;
const STEP = 1 / 60;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (state.screen === 'play') {
    accumulator += dt;
    while (accumulator >= STEP) { update(STEP); accumulator -= STEP; }
  }
  if (state.screen !== 'title') render();
  requestAnimationFrame(frame);
}

if (shot) {
  stageShot(shot);
} else {
  setScreen('title');
  announce('Selamat datang di Teluk Arun.');
}
requestAnimationFrame(frame);
