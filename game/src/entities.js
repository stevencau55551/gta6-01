// entities.js — pemain, kendaraan (lalu lintas, taksi, bus, polisi),
// pejalan kaki, dan rendernya. Semua entitas bergerak di koordinat dunia.
import { V_ROADS, H_ROADS, ROAD_W, WORLD_W, WORLD_H, isOnRoad, nearestRoadPoint, roadSpawn, resolveBuildingCollision, clampWorld } from './world.js';

export const CAR_COLORS = ['#d63031', '#0984e3', '#fdcb6e', '#00b894', '#e17055', '#6c5ce7', '#f5f6fa', '#2d3436', '#e84393', '#00cec9'];
export const TAXI_COLOR = '#f1c40f';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    hp: 100, maxHp: 100, cash: 250, ammo: 24, weapon: 'pistol',
    inCar: null, // referensi mobil yang dikendarai, atau null
    punchCooldown: 0, shootCooldown: 0, hurtFlash: 0, moving: false,
    coins: 0, faresDone: 0,
  };
}

// type: sedan | taxi | truck | bus | sport ; isPolice menandai mobil polisi.
export function createCar(x, y, angle, opts = {}) {
  const type = opts.type || 'sedan';
  return {
    x, y, angle, speed: 0,
    color: opts.color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    type, isPolice: !!opts.isPolice,
    isPlayerCar: false,
    driver: opts.driver !== false, // mobil lalu lintas berpengemudi
    targetSpeed: opts.targetSpeed || 90 + Math.random() * 60,
    turnAt: null, turnTarget: undefined, stuck: 0, sirenPhase: Math.random() * 10,
    // Kondisi mobil: rusak bila sering menabrak; berasap bila parah.
    health: 100, fuel: 100,
    w: type === 'truck' ? 56 : type === 'bus' ? 68 : 46,
    h: type === 'truck' ? 24 : type === 'bus' ? 24 : 22,
  };
}

export function createPedestrian(x, y, random) {
  const shirts = ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#2c3e50'];
  return {
    x, y, angle: random() * Math.PI * 2, speed: 28 + random() * 22,
    color: ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#ecf0f1'][Math.floor(random() * 6)],
    shirt: shirts[Math.floor(random() * shirts.length)],
    panic: 0, retarget: 0, waitingTaxi: false,
  };
}

export function angleDiff(target, current) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ---- Kendaraan pemain: fisika arcade + bahan bakar + kerusakan ----
export function updatePlayerCar(car, input, dt, buildings) {
  // Tangki kosong: mobil mogok (tidak bisa gas).
  const outOfFuel = car.fuel <= 0;
  const accel = outOfFuel ? 0 : (input.up ? 320 : input.down ? -220 : 0);
  car.speed += accel * dt;
  if (!input.up && !input.down) car.speed *= Math.pow(0.4, dt); // gesekan
  const maxF = 340, maxR = -140;
  car.speed = Math.max(maxR, Math.min(maxF, car.speed));
  // Bahan bakar habis sebanding dengan kecepatan.
  if (Math.abs(car.speed) > 20) car.fuel = Math.max(0, car.fuel - Math.abs(car.speed) * dt * 0.004);
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * 2.4 * dt * dir * Math.min(1, Math.abs(car.speed) / 120);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const oldX = car.x, oldY = car.y;
  car.x = nx; car.y = ny;
  clampWorld(car, 24);
  // Tabrak bangunan: pantulkan sedikit, kurangi kecepatan + kondisi mobil.
  if (resolveBuildingCollision(buildings, car, 20)) {
    if (Math.abs(car.speed) > 120) car.health = Math.max(0, car.health - 12);
    car.speed *= 0.45;
  }
  if (Math.abs(car.x - oldX) < 0.01 && Math.abs(car.y - oldY) < 0.01 && Math.abs(car.speed) > 60) {
    car.speed *= 0.5;
    car.health = Math.max(0, car.health - 6);
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
    // Perlambat bila ada mobil di depan; klakson bila macet lama.
    let ahead = false;
    for (const other of cars) {
      if (other === car) continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 70 && Math.cos(Math.atan2(dy, dx) - car.angle) > 0.6) { ahead = true; break; }
    }
    const want = ahead ? 0 : car.targetSpeed;
    car.speed += (want - car.speed) * Math.min(1, 1.6 * dt);
    if (ahead) car.stuck += dt; else car.stuck = 0;
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

// ---- Pejalan kaki: berjalan di trotoar, panik saat ada bahaya ----
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
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Bayangan.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
  // Badan (lebih gelap bila rusak).
  ctx.fillStyle = car.health < 40 ? shade(car.color, -40) : car.color;
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
    ctx.fillStyle = '#111';
    ctx.fillRect(-car.w / 2 + 6, -car.h / 2 - 4, 12, 4);
  }
  if (car.type === 'bus') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUS KOTA', 0, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let wx = -car.w / 2 + 14; wx < car.w / 2 - 8; wx += 12) ctx.fillRect(wx, -car.h / 2 + 5, 7, 4);
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
  // Asap bila mobil rusak parah (di luar rotasi agar naik ke atas layar).
  if (car.health < 40) {
    ctx.fillStyle = `rgba(80,80,80,${0.35 + 0.2 * Math.sin(time / 90)})`;
    ctx.beginPath();
    ctx.arc(car.x + Math.sin(time / 120) * 4, car.y - 14, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Gelapkan warna hex sebanyak amt (untuk mobil rusak).
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

export function drawPlayer(ctx, player, time) {
  ctx.save();
  ctx.translate(player.x, player.y);
  // Cincin putih tipis di bawah pemain jalan kaki: mudah dikenali di antara
  // pejalan kaki dan musuh (revisi setelah tinjau screenshot v2).
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
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

export function drawPedestrian(ctx, ped, time) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(1, 2, 9, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Penumpang taksi menunggu: tanda "!" kuning di atas kepala.
  if (ped.waitingTaxi) {
    ctx.fillStyle = '#ffd32a';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', ped.x, ped.y - 14 + Math.sin(time / 200) * 2);
  }
}

// Arah mobil diselaraskan sumbu jalan tempat ia di-spawn (perbaikan v1:
// dulu sudut 0/π dipakai untuk jalan vertikal juga, mobil melintang).
export function spawnTraffic(random, count, playerPos) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard < count * 40) {
    guard++;
    const p = roadSpawn(random);
    if (Math.hypot(p.x - playerPos.x, p.y - playerPos.y) < 320) continue;
    const roll = random();
    const type = roll < 0.1 ? 'taxi' : roll < 0.2 ? 'truck' : roll < 0.26 ? 'bus' : 'sedan';
    const angle = p.axis === 'v'
      ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2)
      : (random() < 0.5 ? 0 : Math.PI);
    cars.push(createCar(p.x, p.y, angle, {
      color: type === 'taxi' ? TAXI_COLOR : undefined, type,
    }));
  }
  return cars;
}

export function spawnPedestrians(random, count, playerPos) {
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard < count * 40) {
    guard++;
    const p = roadSpawn(random);
    if (Math.hypot(p.x - playerPos.x, p.y - playerPos.y) < 260) continue;
    peds.push(createPedestrian(p.x + 70, p.y + 70, random));
  }
  return peds;
}
