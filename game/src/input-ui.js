// input-ui.js — kontrol keyboard + mouse, menu (start/pause/game over),
// HUD lengkap (nyawa, uang, wanted, misi, jam, distrik, bensin, koin)
// dan minimap. Semua teks HUD digambar di canvas utama.
import { WORLD_W, WORLD_H, V_ROADS, H_ROADS, LANDMARKS } from './world.js';

export const ACTION_PAUSE = 'pause';

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    up: false, down: false, left: false, right: false,
    mouseX: 0, mouseY: 0, mouseDown: false, mouseClicked: false,
    interactPressed: false, punchPressed: false, hornPressed: false,
    pausePressed: false, mutePressed: false, confirmPressed: false,
    anyKey: false,
  };
  const keyMap = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };
  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    state.anyKey = true;
    const dir = keyMap[e.code];
    if (dir) state[dir] = true;
    if (e.code === 'KeyE' && !e.repeat) state.interactPressed = true;
    if (e.code === 'Space' && !e.repeat) state.punchPressed = true;
    if (e.code === 'KeyH' && !e.repeat) state.hornPressed = true;
    if (e.code === 'KeyP' && !e.repeat) state.pausePressed = true;
    if (e.code === 'Escape' && !e.repeat) state.pausePressed = true;
    if (e.code === 'KeyM' && !e.repeat) state.mutePressed = true;
    if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) state.confirmPressed = true;
    keys.add(e.code);
  }
  function onKeyUp(e) {
    const dir = keyMap[e.code];
    if (dir) state[dir] = false;
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    state.mouseX = e.clientX - r.left;
    state.mouseY = e.clientY - r.top;
  }
  function onMouseDown(e) {
    state.mouseDown = true;
    state.mouseClicked = true;
    onMouseMove(e);
  }
  function onMouseUp() { state.mouseDown = false; }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  state.consumeClick = () => { const c = state.mouseClicked; state.mouseClicked = false; return c; };
  state.consumeInteract = () => { const v = state.interactPressed; state.interactPressed = false; return v; };
  state.consumePunch = () => { const v = state.punchPressed; state.punchPressed = false; return v; };
  state.consumePause = () => { const v = state.pausePressed; state.pausePressed = false; return v; };
  state.consumeMute = () => { const v = state.mutePressed; state.mutePressed = false; return v; };
  state.consumeConfirm = () => { const v = state.confirmPressed; state.confirmPressed = false; return v; };
  state.consumeHorn = () => { const v = state.hornPressed; state.hornPressed = false; return v; };
  return state;
}

// Jam dalam game: mulai 09:12, 1 detik nyata = 1 menit game.
export function gameClock(elapsedSec) {
  const totalMin = 9 * 60 + 12 + Math.floor(elapsedSec);
  const hh = Math.floor(totalMin / 60) % 24;
  const mm = totalMin % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- HUD ----
// view: {player, wanted, mission, progress, cash, time, speedKmh, inCar,
//   ammo, message, messageTimer, district, coins, coinsTotal, taxi}
export function drawHUD(ctx, w, h, view) {
  const { player, wanted, mission, progress, cash, time, speedKmh, inCar, ammo, message, messageTimer, district, coins, coinsTotal, taxi } = view;
  ctx.save();
  // Panel kiri atas: nama, nyawa, uang, senjata, koin.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRectPath(ctx, 14, 12, 258, 108, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('RAKA PRADANA', 26, 34);
  // Bilah nyawa.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(26, 42, 150, 12);
  ctx.fillStyle = player.hp > 50 ? '#2ecc71' : player.hp > 25 ? '#f39c12' : '#e74c3c';
  ctx.fillRect(26, 42, 150 * Math.max(0, player.hp / player.maxHp), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.fillText(`${Math.ceil(player.hp)} HP`, 182, 53);
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`$${cash}`, 26, 78);
  ctx.fillStyle = '#f1c40f';
  ctx.font = '13px sans-serif';
  ctx.fillText(`🪙 ${coins}/${coinsTotal} koin Arun`, 108, 78);
  ctx.fillStyle = '#f5d76e';
  ctx.font = '13px sans-serif';
  ctx.fillText(inCar ? `🚗 ${Math.round(speedKmh)} km/j  •  E keluar` : `🔫 Pistol ${ammo} peluru  •  E curi mobil`, 26, 100);
  // Bensin — hanya saat mengemudi (saran advisor: jangan penuhi HUD).
  if (inCar) {
    const fuel = player.inCar.fuel ?? 100;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(26, 104, 110, 7);
    ctx.fillStyle = fuel > 30 ? '#00cec9' : '#e74c3c';
    ctx.fillRect(26, 104, 110 * Math.max(0, fuel / 100), 7);
    ctx.fillStyle = fuel > 30 ? '#dfe6e9' : '#ff7675';
    ctx.font = '11px sans-serif';
    ctx.fillText(fuel <= 0 ? '⛽ HABIS!' : `⛽ ${Math.round(fuel)}%`, 142, 112);
  }

  // Kanan atas: bintang wanted + jam + distrik.
  ctx.textAlign = 'right';
  ctx.font = 'bold 26px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wanted.level ? '#ffd32a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', w - 24 - (4 - i) * 30, 44);
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  if (wanted.level > 0) {
    ctx.fillText(wanted.level >= 3 ? 'POLISI MENGEJAR' : 'WANTED', w - 24, 66);
    if (wanted.lastReason) {
      ctx.fillStyle = '#ffb8b8';
      ctx.font = '12px sans-serif';
      ctx.fillText(`Penyebab: ${wanted.lastReason}`, w - 24, 84);
    }
  }
  // Jam + distrik di bawah bintang.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`🕘 ${gameClock(time)}`, w - 24, wanted.level > 0 ? 106 : 66);
  ctx.fillStyle = '#dfe6e9';
  ctx.font = '13px sans-serif';
  ctx.fillText(`📍 ${district}`, w - 24, wanted.level > 0 ? 124 : 84);

  // Misi: banner atas-tengah + progres langkah.
  if (mission) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const tw = Math.min(w - 40, 580);
    roundRectPath(ctx, (w - tw) / 2, 12, tw, 58, 10);
    ctx.fill();
    ctx.fillStyle = '#f5d76e';
    ctx.font = 'bold 14px sans-serif';
    const prog = progress ? `  •  Misi ${progress.index}/${progress.total} — Langkah ${progress.step}/${progress.steps}` : '';
    ctx.fillText(mission.title + prog, w / 2, 32);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(mission.text, w / 2, 52);
    // Titik progres langkah.
    if (progress) {
      for (let i = 0; i < progress.steps; i++) {
        ctx.fillStyle = i < progress.step ? '#ffd32a' : 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(w / 2 - (progress.steps - 1) * 9 + i * 18, 62, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // Banner kerja taksi (di bawah banner misi).
  if (taxi && taxi.active) {
    ctx.textAlign = 'center';
    const label = taxi.phase === 'pickup'
      ? '🚕 Jemput penumpang (ikuti tanda $ di minimap)'
      : `🚕 Antar ke ${taxi.dest.label} — tarif $${taxi.fare}`;
    ctx.fillStyle = 'rgba(241,196,15,0.9)';
    const tw2 = ctx.measureText(label).width + 36;
    roundRectPath(ctx, (w - tw2) / 2, mission ? 78 : 12, tw2, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(label, w / 2, (mission ? 78 : 12) + 20);
  }

  // Pesan event (tengah bawah).
  if (message && messageTimer > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const mw = Math.min(w - 40, ctx.measureText(message).width + 36);
    roundRectPath(ctx, (w - mw) / 2, h - 84, mw, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffeaa7';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(message, w / 2, h - 62);
  }

  // Hint kontrol bawah-kiri.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD gerak/kemudi • E masuk/curi mobil • Klik tembak • Spasi pukul • P jeda • M suara', 16, h - 14);
  ctx.restore();
}

// ---- Minimap: kota kecil di kanan bawah ----
export function drawMinimap(ctx, w, h, view) {
  const { player, police, traffic, mission, enemies, coins, taxi } = view;
  const mw = 210, mh = 152;
  const x0 = w - mw - 16, y0 = h - mh - 16;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRectPath(ctx, x0 - 4, y0 - 4, mw + 8, mh + 8, 8);
  ctx.fill();
  // Laut + darat.
  ctx.fillStyle = '#1e6f8e';
  ctx.fillRect(x0, y0, mw, mh);
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(x0, y0, mw * (3300 / WORLD_W), mh);
  // Jalan.
  ctx.strokeStyle = '#9aa0a6';
  ctx.lineWidth = 1.5;
  for (const rx of V_ROADS) {
    ctx.beginPath(); ctx.moveTo(x0 + rx * sx, y0); ctx.lineTo(x0 + rx * sx, y0 + mh); ctx.stroke();
  }
  for (const ry of H_ROADS) {
    ctx.beginPath(); ctx.moveTo(x0, y0 + ry * sy); ctx.lineTo(x0 + mw, y0 + ry * sy); ctx.stroke();
  }
  const dot = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x0 + x * sx, y0 + y * sy, r || 3, 0, Math.PI * 2); ctx.fill();
  };
  // Landmark (titik kecil abu-abu terang) + SPBU (oranye).
  for (const lm of LANDMARKS) dot(lm.x, lm.y, lm.kind === 'gas' ? '#f39c12' : '#b2bec3', lm.kind === 'gas' ? 3.5 : 2.5);
  // Koin yang belum diambil.
  for (const c of coins || []) if (!c.taken) dot(c.x, c.y, '#f1c40f', 2);
  // Objektif misi (kuning berdenyut).
  if (mission) {
    const pulse = 3 + Math.sin(Date.now() / 200) * 1.2;
    ctx.strokeStyle = '#ffd32a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x0 + mission.x * sx, y0 + mission.y * sy, pulse + 3, 0, Math.PI * 2); ctx.stroke();
    dot(mission.x, mission.y, '#ffd32a', 4);
  }
  // Taksi: penumpang ($) lalu tujuan (hijau).
  if (taxi && taxi.active) {
    if (taxi.phase === 'pickup') dot(taxi.passenger.x, taxi.passenger.y, '#00cec9', 4);
    else dot(taxi.dest.x, taxi.dest.y, '#2ecc71', 4);
  }
  for (const e of enemies || []) dot(e.x, e.y, '#ff4757', 3);
  for (const c of traffic || []) dot(c.x, c.y, '#dfe6e9', 2);
  for (const p of police || []) dot(p.x, p.y, '#0984e3', 3.5);
  // Pemain: panah putih.
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  const pa = player.inCar ? player.inCar.angle : player.angle;
  ctx.save();
  ctx.translate(x0 + px * sx, y0 + py * sy);
  ctx.rotate(pa);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Label + panah utara.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('TELUK ARUN', x0 + 2, y0 - 8 < 12 ? y0 + 12 : y0 - 8);
  ctx.fillStyle = '#ffd32a';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('N ▲', x0 + mw, y0 - 8 < 12 ? y0 + 12 : y0 - 8);
  ctx.restore();
}

// ---- Menu overlay (DOM): start / pause / game over ----
export function showMenu(el, html) {
  el.innerHTML = html;
  el.style.display = 'flex';
}

export function hideMenu(el) {
  el.style.display = 'none';
}

export function startMenuHTML(saveExists) {
  return `
  <div class="panel">
    <h1>TELUK ARUN</h1>
    <p class="sub">Kisah Jalanan &mdash; open-world kriminal orisinal</p>
    <p>Raka Pradana, mantan kurir, terlilit utang geng Pelabuhan. Jelajahi kota pesisir Teluk Arun
    jalan kaki atau dengan mobil curian, hindari polisi, selesaikan 3 misi, kumpulkan 10 koin Arun,
    dan cari uang tambahan sebagai sopir taksi.</p>
    <ul>
      <li><b>WASD</b> jalan / kemudi &nbsp;•&nbsp; <b>E</b> masuk &amp; curi mobil</li>
      <li><b>Klik mouse</b> menembak &nbsp;•&nbsp; <b>Spasi</b> memukul &nbsp;•&nbsp; <b>H</b> klakson</li>
      <li><b>P</b> jeda &nbsp;•&nbsp; <b>M</b> suara &nbsp;•&nbsp; Isi bensin di <b>SPBU Arun</b></li>
    </ul>
    <button id="btn-play">${saveExists ? 'LANJUTKAN' : 'MULAI'}</button>
    ${saveExists ? '<button id="btn-new" class="ghost">Permainan Baru</button>' : ''}
    <p class="foot">Simpan otomatis. Kota, karakter, dan cerita 100% orisinal.</p>
  </div>`;
}

export function pauseMenuHTML() {
  return `
  <div class="panel">
    <h1>JEDA</h1>
    <p>Teluk Arun menunggumu. Progres tersimpan otomatis.</p>
    <button id="btn-resume">LANJUTKAN</button>
    <button id="btn-restart" class="ghost">Mulai dari Awal</button>
    <p class="foot">P / Esc untuk lanjut • M untuk suara</p>
  </div>`;
}

export function gameOverHTML(reason, cash) {
  return `
  <div class="panel">
    <h1>TERTANGKAP</h1>
    <p>${reason}</p>
    <p>Uang yang terkumpul: <b>$${cash}</b>. Teluk Arun belum selesai denganmu.</p>
    <button id="btn-retry">COBA LAGI</button>
    <p class="foot">Tip: kabur dari polisi sampai bintang wanted padam.</p>
  </div>`;
}

export function victoryHTML(cash, coins, fares) {
  return `
  <div class="panel">
    <h1>TAMAT — UTANG LUNAS!</h1>
    <p>Raka bebas. Darma tumbang, geng Pelabuhan bubar, dan Teluk Arun kembali miliknya.</p>
    <p>Total uang: <b>$${cash}</b> • Koin Arun: <b>${coins}/10</b> • Tarif taksi: <b>${fares}</b></p>
    <button id="btn-again">MAIN LAGI</button>
  </div>`;
}
