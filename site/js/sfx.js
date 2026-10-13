// Sound effects for Reels, synthesised in the browser (Web Audio), so they're ours: no samples,
// no licences, no copyright claims. Each sound is rendered once into an AudioBuffer and cached.

export const SOUNDS = [
  { id: 'whoosh', name: 'Whoosh', icon: '💨' },
  { id: 'swoosh', name: 'Swoosh', icon: '🌀' },
  { id: 'pop', name: 'Pop', icon: '🫧' },
  { id: 'bubble', name: 'Bubble', icon: '🔵' },
  { id: 'ding', name: 'Ding', icon: '🔔' },
  { id: 'cash', name: 'Ka-ching', icon: '💰' },
  { id: 'boom', name: 'Boom', icon: '💥' },
  { id: 'bass', name: 'Bass drop', icon: '🔊' },
  { id: 'riser', name: 'Riser', icon: '📈' },
  { id: 'click', name: 'Camera', icon: '📸' },
  { id: 'typing', name: 'Typing', icon: '⌨️' },
  { id: 'glitch', name: 'Glitch', icon: '📺' },
  { id: 'notify', name: 'Notification', icon: '📱' },
  { id: 'heart', name: 'Heartbeat', icon: '❤️' },
];

const LEN = { whoosh: 0.7, swoosh: 0.45, pop: 0.18, bubble: 0.3, ding: 1.2, cash: 1.1, boom: 1.4, bass: 1.6, riser: 1.8, click: 0.25, typing: 0.9, glitch: 0.6, notify: 0.7, heart: 1.1 };

function noise(ctx, seconds) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  let seed = 12345; // fixed seed: the same sound every time
  for (let i = 0; i < d.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = seed / 0x3fffffff - 1; }
  const s = ctx.createBufferSource(); s.buffer = b; return s;
}
function env(ctx, g, t0, a, peak, d, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(end, t0 + a + d);
}
function tone(ctx, out, type, f0, f1, t0, dur, peak = 0.6, a = 0.005) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  env(ctx, g, t0, a, peak, dur);
  o.connect(g).connect(out); o.start(t0); o.stop(t0 + a + dur + 0.02);
}
function swept(ctx, out, t0, dur, f0, f1, q, peak) {
  const n = noise(ctx, dur + 0.05), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  n.connect(f).connect(g).connect(out); n.start(t0); n.stop(t0 + dur + 0.05);
}

const BUILD = {
  whoosh: (c, o) => swept(c, o, 0, 0.65, 300, 3500, 1.2, 0.9),
  swoosh: (c, o) => swept(c, o, 0, 0.4, 4000, 600, 2, 0.8),
  pop: (c, o) => { tone(c, o, 'sine', 900, 220, 0, 0.12, 0.8); swept(c, o, 0, 0.05, 2000, 2000, 1, 0.3); },
  bubble: (c, o) => { tone(c, o, 'sine', 300, 1200, 0, 0.16, 0.6); tone(c, o, 'sine', 450, 1600, 0.12, 0.14, 0.4); },
  ding: (c, o) => { tone(c, o, 'sine', 1318, 1318, 0, 1.1, 0.5, 0.002); tone(c, o, 'sine', 2637, 2637, 0, 0.6, 0.15, 0.002); },
  cash: (c, o) => {
    swept(c, o, 0, 0.12, 3000, 3000, 3, 0.4); // drawer
    tone(c, o, 'triangle', 2093, 2093, 0.12, 0.9, 0.45, 0.002); tone(c, o, 'triangle', 2637, 2637, 0.22, 0.85, 0.4, 0.002);
  },
  boom: (c, o) => {
    tone(c, o, 'sine', 120, 35, 0, 1.3, 1, 0.003);
    const ws = c.createWaveShaper(); const k = new Float32Array(1024);
    for (let i = 0; i < k.length; i++) { const x = i / 512 - 1; k[i] = Math.tanh(3 * x); } ws.curve = k; // warm drive
    const g = c.createGain(); g.gain.value = 0.5; ws.connect(g).connect(o);
    tone(c, ws, 'sine', 80, 30, 0, 1.1, 0.9, 0.002);
    swept(c, o, 0, 0.15, 900, 200, 0.7, 0.35);
  },
  bass: (c, o) => { tone(c, o, 'sawtooth', 220, 30, 0, 1.5, 0.35, 0.01); tone(c, o, 'sine', 110, 28, 0, 1.5, 0.9, 0.01); },
  riser: (c, o) => { swept(c, o, 0, 1.75, 200, 6000, 1.5, 0.7); tone(c, o, 'sawtooth', 110, 880, 0, 1.75, 0.12, 1.2); },
  click: (c, o) => { swept(c, o, 0, 0.03, 4000, 4000, 1, 0.9); swept(c, o, 0.09, 0.05, 2500, 2500, 1, 0.7); tone(c, o, 'square', 1800, 900, 0, 0.02, 0.3, 0.001); },
  typing: (c, o) => { [0, 0.11, 0.19, 0.33, 0.42, 0.56, 0.63, 0.77].forEach((t, i) => swept(c, o, t, 0.035, 2500 + (i % 3) * 700, 2000, 3, 0.7)); },
  glitch: (c, o) => { [0, 0.08, 0.13, 0.26, 0.31, 0.44].forEach((t, i) => { tone(c, o, 'square', 200 + i * 170, 120 + i * 90, t, 0.05, 0.35, 0.001); swept(c, o, t, 0.04, 5000, 1500, 0.8, 0.4); }); },
  notify: (c, o) => { tone(c, o, 'sine', 880, 880, 0, 0.18, 0.5, 0.004); tone(c, o, 'sine', 1320, 1320, 0.16, 0.45, 0.5, 0.004); },
  heart: (c, o) => { [0, 0.22, 0.75, 0.97].forEach((t, i) => tone(c, o, 'sine', 70, 40, t, 0.16, i % 2 ? 0.6 : 0.95, 0.004)); },
};

const cache = new Map();
/** The rendered sound as an AudioBuffer (stereo, `sampleRate`). */
export async function soundBuffer(id, sampleRate = 48000) {
  const key = `${id}@${sampleRate}`;
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    const len = Math.ceil((LEN[id] || 1) * sampleRate);
    const OAC = self.OfflineAudioContext || self.webkitOfflineAudioContext;
    const ctx = new OAC(2, len, sampleRate);
    const master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    (BUILD[id] || BUILD.pop)(ctx, master);
    return ctx.startRendering();
  })();
  cache.set(key, p);
  return p;
}

/** Every sound to place: hand-placed ones plus (optionally) one at the start of each caption. */
export function sfxList(o, segments) {
  const list = (o.sfx || []).map(s => ({ ...s }));
  if (o.sfxAuto) for (const s of segments) list.push({ t: s.start, id: o.sfxAuto, vol: 0.6, auto: true });
  return list.sort((a, b) => a.t - b.t);
}

/**
 * Mix the video's own audio (AudioBuffer or null) with the sound effects into one AudioBuffer.
 * duration in seconds. Used for export.
 */
export async function mixWithSfx(base, duration, list, sampleRate = 48000) {
  const OAC = self.OfflineAudioContext || self.webkitOfflineAudioContext;
  const ctx = new OAC(2, Math.ceil(duration * sampleRate), sampleRate);
  if (base) { const s = ctx.createBufferSource(); s.buffer = base; s.connect(ctx.destination); s.start(0); }
  for (const fx of list) {
    if (fx.t >= duration) continue;
    const s = ctx.createBufferSource(); s.buffer = await soundBuffer(fx.id, sampleRate);
    const g = ctx.createGain(); g.gain.value = fx.vol ?? 0.8;
    s.connect(g).connect(ctx.destination); s.start(Math.max(0, fx.t));
  }
  return ctx.startRendering();
}
