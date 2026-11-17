// entities.js — pemain, kendaraan (lalu lintas, polisi), pejalan kaki.
// Semua entitas bergerak di koordinat dunia; render digambar top-down.
import { V_ROADS, H_ROADS, ROAD_W, WORLD_W, WORLD_H, isOnRoad, nearestRoadPoint, roadSpawn, resolveBuildingCollision, clampWorld, mulberry32 } from './world.js';

export const CAR_COLORS = ['#d63031', '#0984e3', '#fdcb6e', '#00b894', '#e17055', '#6c5ce7', '#f5f6fa', '#2d3436', '#e84393', '#00cec9'];
export const TAXI_COLOR = '#f1c40f';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    hp: 100, maxHp: 100, cash: 250, ammo: 24, weapon: 'pistol',
    inCar: null, // referensi mobil yang dikendarai, atau null
    punchCooldown: 0, shootCooldown: 0, hurtFlash: 0, moving: false,
  };
}

export function createCar(x, y, angle, opts = {}) {
  return {
    x, y, angle, speed: 0,
    color: opts.color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    type: opts.type || 'sedan', // sedan | taxi | truck | police | sport
    isPolice: !!opts.isPolice,
    isPlayerCar: false,
    driver: opts.driver !== false, // mobil lalu lintas berpengemudi
    targetSpeed: opts.targetSpeed || 90 + Math.random() * 60,
    turnAt: null, stuck: 0, sirenPhase: Math.random() * 10,
    w: opts.type === 'truck' ? 56 : 46,
    h: opts.type === 'truck' ? 24 : 22,
  };
}

export function createPedestrian(x, y, random) {
  return {
    x, y, angle: random() * Math.PI * 2, speed: 28 + random() * 22,
    color: ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#ecf0f1'][Math.floor(random() * 6)],
    shirt: ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#2c3e50'][Math.floor(random() * 6)],
    panic: 0, retarget: 0,
  };
}

// ---- Kendaraan pemain: fisika arcade sederhana ----
export function updatePlayerCar(car, input, dt, buildings) {
  const accel = input.up ? 320 : input.down ? -220 : 0;
  car.speed += accel * dt;
  if (!input.up && !input.down) car.speed *= Math.pow(0.4, dt); // gesekan
  const maxF = 340, maxR = -140;
  car.speed = Math.max(maxR, Math.min(maxF, car.speed));
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * 2.4 * dt * dir * Math.min(1, Math.abs(car.speed) / 120);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const oldX = car.x, oldY = car.y;
  car.x = nx; car.y = ny;
  clampWorld(car, 24);
  // Tabrak bangunan: pantulkan sedikit, kurangi kecepatan.
  const hit = resolveBuildingCollision(buildings, car, 20);
  if (hit) car.speed *= 0.45;
  if (Math.abs(car.x - oldX) < 0.01 && Math.abs(car.y - oldY) < 0.01 && Math.abs(car.speed) > 60) {
    car.speed *= 0.5;
  }
  return car;
}

// ---- Lalu lintas AI: mengikuti jalan, belok di persimpangan ----
export function updateTrafficCar(car, dt, buildings, cars, random) {
  const onRoad = isOnRoad(car.x, car.y);
  if (!onRoad) {
    // Kembali ke jalan terdekat.
    const p = nearestRoadPoint(car.x, car.y);
    const target = Math.atan2(p.y - car.y, p.x - car.x);
    car.angle += angleDiff(target, car.angle) * Math.min(1, 3 * dt);
    car.speed = Math.min(car.speed + 120 * dt, 90);
  } else {
    // Di persimpangan, kadang belok.
    const nearIntersection = V_ROADS.some((rx) => Math.abs(car.x - rx) < 70) &&
      H_ROADS.some((ry) => Math.abs(car.y - ry) < 70);
    if (nearIntersection && !car.turnAt) {
      car.turnAt = { x: car.x, y: car.y, done: false };
      if (random() < 0.35) car.turnTarget = car.angle + (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    }
    if (car.turnTarget !== undefined && car.turnAt) {
      car.angle += angleDiff(car.turnTarget, car.angle) * Math.min(1, 4 * dt);
      if (Math.abs(angleDiff(car.turnTarget, car.angle)) < 0.05) {
        car.turnTarget = undefined; car.turnAt = null;
      }
    }
    // Perlambat bila ada mobil di depan.
    let ahead = false;
    for (const other of cars) {
      if (other === car) continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 70 && Math.cos(Math.atan2(dy, dx) - car.angle) > 0.6) { ahead = true; break; }
    }
    const want = ahead ? 0 : car.targetSpeed;
    car.speed += (want - car.speed) * Math.min(1, 1.6 * dt);
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  clampWorld(car, 24);
  resolveBuildingCollision(buildings, car, 20);
  // Jaga agar mobil tetap di jalan: bila tersesat jauh, snap halus.
  if (!isOnRoad(car.x, car.y)) {
    const p = nearestRoadPoint(car.x, car.y);
    if (Math.hypot(p.x - car.x, p.y - car.y) > ROAD_W) {
      car.x += (p.x - car.x) * Math.min(1, dt);
      car.y += (p.y - car.y) * Math.min(1, dt);
    }
  }
}

export function angleDiff(target, current) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ---- Polisi: mengejar pemain, menabrak untuk menghentikan ----
export function updatePoliceCar(car, playerPos, dt, buildings) {
  const target = Math.atan2(playerPos.y - car.y, playerPos.x - car.x);
  car.angle += angleDiff(target, car.angle) * Math.min(1, 3.2 * dt);
  const dist = Math.hypot(playerPos.x - car.x, playerPos.y - car.y);
  const want = dist > 60 ? 330 : 120;
  car.speed += (want - car.speed) * Math.min(1, 2.2 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.sirenPhase += dt * 6;
  clampWorld(car, 24);
  resolveBuildingCollision(buildings, car, 20);
  return dist;
}

// ---- Pejalan kaki: berjalan di trotoar, panik saat ada tembakan/kejar-kejaran ----
export function updatePedestrian(ped, dt, buildings, danger) {
  ped.retarget -= dt;
  if (ped.panic > 0) ped.panic -= dt;
  if (danger && Math.hypot(danger.x - ped.x, danger.y - ped.y) < 260) ped.panic = 2.5;
  const speed = ped.panic > 0 ? ped.speed * 2.6 : ped.speed;
  if (ped.retarget <= 0) {
    // Pilih arah sepanjang jalan (trotoar mengikuti sumbu jalan).
    const p = nearestRoadPoint(ped.x, ped.y);
    const alongV = Math.abs(ped.x - p.x) < Math.abs(ped.y - p.y);
    const dir = Math.random() < 0.5 ? 1 : -1;
    ped.angle = alongV ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    ped.retarget = 3 + Math.random() * 5;
  }
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  clampWorld(ped, 10);
  resolveBuildingCollision(buildings, ped, 10);
}

// ---- Gerakan pemain jalan kaki ----
export function updatePlayerOnFoot(player, input, dt, buildings) {
  const speed = 190;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  player.moving = len > 0;
  if (len > 0) {
    mx /= len; my /= len;
    player.x += mx * speed * dt;
    player.y += my * speed * dt;
    player.angle = Math.atan2(my, mx);
    resolveBuildingCollision(buildings, player, 12);
    clampWorld(player, 12);
  }
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
}

// ---- Render entitas ----
export function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Bayangan.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
  // Badan.
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 7);
  ctx.fill();
  // Kabin + kaca.
  ctx.fillStyle = 'rgba(20,40,60,0.85)';
  roundRect(ctx, -car.w / 2 + 10, -car.h / 2 + 4, car.w - 24, car.h - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.7)';
  ctx.fillRect(car.w / 2 - 12, -car.h / 2 + 5, 5, car.h - 10);
  // Lampu depan / belakang.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(car.w / 2 - 2, -car.h / 2 + 2, 3, 5);
  ctx.fillRect(car.w / 2 - 2, car.h / 2 - 7, 3, 5);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-car.w / 2, -car.h / 2 + 2, 3, 5);
  ctx.fillRect(-car.w / 2, car.h / 2 - 7, 3, 5);
  if (car.type === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (car.isPolice) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLISI', 0, 3);
    // Lampu strobo.
    const on = Math.sin(car.sirenPhase) > 0;
    ctx.fillStyle = on ? '#ff2d55' : '#0a84ff';
    ctx.beginPath(); ctx.arc(-4, -car.h / 2 - 1, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = on ? '#0a84ff' : '#ff2d55';
    ctx.beginPath(); ctx.arc(6, -car.h / 2 - 1, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawPlayer(ctx, player, time) {
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.hurtFlash > 0) ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time / 40);
  ctx.rotate(player.angle);
  // Bayangan.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
  // Badan (jaket oranye khas Raka) + kepala.
  ctx.fillStyle = '#ff7f2a';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f5c99b';
  ctx.beginPath(); ctx.arc(6, 0, 6, 0, Math.PI * 2); ctx.fill();
  // Pistol di tangan bila bersenjata.
  if (player.weapon === 'pistol') {
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 12, 4);
  }
  // Arah pandang.
  ctx.fillStyle = '#222';
  ctx.fillRect(10, -1, 6, 2);
  ctx.restore();
}

export function drawPedestrian(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(1, 2, 9, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function spawnTraffic(random, count, playerPos) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = roadSpawn(random);
    if (Math.hypot(p.x - playerPos.x, p.y - playerPos.y) < 320) { i--; continue; }
    const axis = Math.abs(p.x - Math.round(p.x)) < 1 ? 'v' : 'h';
    const angle = Math.random() < 0.5 ? 0 : Math.PI;
    const type = Math.random() < 0.12 ? 'taxi' : Math.random() < 0.1 ? 'truck' : 'sedan';
    cars.push(createCar(p.x, p.y, type === 'taxi' ? angle : angle, {
      color: type === 'taxi' ? TAXI_COLOR : undefined, type,
    }));
  }
  return cars;
}

export function spawnPedestrians(random, count, playerPos) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = roadSpawn(random);
    if (Math.hypot(p.x - playerPos.x, p.y - playerPos.y) < 260) { i--; continue; }
    peds.push(createPedestrian(p.x + 70, p.y + 70, random));
  }
  return peds;
}
