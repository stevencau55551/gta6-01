// effects.js — partikel, guncangan kamera, cahaya matahari, dan suara WebAudio
// (osilator murni, tanpa file eksternal; semua suara dibuat di kode).
export function createParticles() {
  return [];
}

export function spawnParticles(particles, x, y, opts = {}) {
  const n = opts.count || 10;
  const color = opts.color || '#ffcf5c';
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * (opts.speed || 220);
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.35 + Math.random() * 0.45, maxLife: 0.8, color,
      size: 2 + Math.random() * 4,
    });
  }
}

export function updateParticles(particles, dt) {
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= Math.pow(0.2, dt); p.vy *= Math.pow(0.2, dt);
    p.life -= dt;
  }
  return particles.filter((p) => p.life > 0);
}

export function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// Guncangan kamera: trauma 0..1, mereda sendiri.
export function createShake() {
  return { trauma: 0 };
}

export function addShake(shake, amount) {
  shake.trauma = Math.min(1, shake.trauma + amount);
}

export function shakeOffset(shake, dt, time) {
  shake.trauma = Math.max(0, shake.trauma - dt * 1.4);
  const s = shake.trauma * shake.trauma * 14;
  return {
    x: s * Math.sin(time / 31) * 0.6,
    y: s * Math.cos(time / 47) * 0.6,
  };
}

// Cahaya: gradien hangat matahari sore + vignette halus.
export function drawLighting(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, 'rgba(255, 214, 130, 0.06)');
  g.addColorStop(0.6, 'rgba(255, 214, 130, 0.0)');
  g.addColorStop(1, 'rgba(20, 20, 60, 0.10)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

// ---- Audio: WebAudio murni, aman bila AudioContext belum diizinkan ----
export function createAudio() {
  return { ctx: null, muted: false, engineOsc: null, engineGain: null, sirenTimer: 0 };
}

export function ensureAudio(audio) {
  if (audio.ctx) return audio.ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio.ctx = new AC();
  } catch {
    audio.ctx = null;
  }
  return audio.ctx;
}

function tone(audio, freq, dur, type, vol, slideTo) {
  const ctx = ensureAudio(audio);
  if (!ctx || audio.muted) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  } catch { /* suara opsional: gagal diam-diam */ }
}

export function playShot(audio) {
  tone(audio, 900, 0.09, 'square', 0.10, 120);
  tone(audio, 180, 0.12, 'sawtooth', 0.08, 60);
}

export function playPunch(audio) { tone(audio, 140, 0.08, 'square', 0.12, 70); }
export function playPickup(audio) { tone(audio, 660, 0.12, 'sine', 0.12); setTimeout(() => tone(audio, 990, 0.16, 'sine', 0.12), 90); }
export function playMission(audio) {
  tone(audio, 523, 0.14, 'triangle', 0.14);
  setTimeout(() => tone(audio, 659, 0.14, 'triangle', 0.14), 130);
  setTimeout(() => tone(audio, 784, 0.22, 'triangle', 0.14), 260);
}
export function playHorn(audio) { tone(audio, 370, 0.18, 'square', 0.08, 370); }
export function playCrash(audio) { tone(audio, 90, 0.25, 'sawtooth', 0.14, 40); }
export function playSiren(audio, dt, wanted) {
  if (!audio.ctx || audio.muted || wanted === 0) return;
  audio.sirenTimer -= dt;
  if (audio.sirenTimer <= 0) {
    audio.sirenTimer = 0.45;
    audio.sirenHigh = !audio.sirenHigh;
    tone(audio, audio.sirenHigh ? 880 : 660, 0.4, 'sine', 0.045);
  }
}

// Dengung mesin mengikuti kecepatan mobil pemain.
export function updateEngineSound(audio, speed, inCar) {
  const ctx = ensureAudio(audio);
  if (!ctx || audio.muted) return;
  try {
    if (!inCar) {
      if (audio.engineOsc) { audio.engineOsc.stop(); audio.engineOsc = null; }
      return;
    }
    if (!audio.engineOsc) {
      audio.engineOsc = ctx.createOscillator();
      audio.engineGain = ctx.createGain();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 60;
      audio.engineGain.gain.value = 0.02;
      audio.engineOsc.connect(audio.engineGain).connect(ctx.destination);
      audio.engineOsc.start();
    }
    audio.engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.45, ctx.currentTime, 0.08);
    audio.engineGain.gain.setTargetAtTime(0.015 + Math.abs(speed) * 0.00006, ctx.currentTime, 0.1);
  } catch { /* abaikan */ }
}
