// Home page "See it in action": the same clip twice, without and with captions, and a row of styles
// that restyle the right-hand side instantly (the same renderer the editor and export use).
// Footage comes from examples/manifest.json → "demo": { "video", "captions" }. Until one is added,
// a soft animated backdrop with a sample line stands in.
import { TEMPLATES } from './templates.js';
import { buildChunks, findChunk, drawCaption, spreadWords } from './renderer.js';
import { parseSRT } from './captions.js';
import { paintScene } from './gallery.js';

const W = 360, H = 640, FRAME_MS = 1000 / 30 - 2;
const PICKS = ['classic', 'crazy', 'discipline', 'viral-pop', 'red-wipe', 'karaoke-gold', 'desi-bold', 'aesthetic-serif', 'neon-box', 'boxed', 'one-word', 'gilded'];
const SAMPLE = 'this is how your captions will look on every reel you post';

async function loadDemo() {
  try {
    const m = await (await fetch('examples/manifest.json', { cache: 'no-cache' })).json();
    if (!m.demo || !m.demo.video) return null;
    const res = await fetch(`examples/${m.demo.captions}`);
    const words = /\.json$/i.test(m.demo.captions) ? await res.json() : parseSRT(await res.text()).flatMap(s => s.words);
    return { video: `examples/${m.demo.video}`, words };
  } catch { return null; }
}

export async function mountDemo({ orig, cap, styles, playBtn, muteBtn }) {
  const demo = await loadDemo();
  const words = demo ? demo.words : spreadWords(SAMPLE, 0.3, 5.7);
  const loopLen = demo ? null : 6.4;
  let video = null;
  if (demo) {
    video = document.createElement('video');
    Object.assign(video, { src: demo.video, muted: true, loop: true, playsInline: true, preload: 'auto' });
    video.setAttribute('playsinline', '');
    playBtn.hidden = muteBtn.hidden = false;
    playBtn.onclick = () => (video.paused ? video.play() : video.pause());
    muteBtn.onclick = () => { video.muted = !video.muted; muteBtn.textContent = video.muted ? '🔇' : '🔊'; };
    video.onplay = () => { playBtn.textContent = '❚❚'; };
    video.onpause = () => { playBtn.textContent = '▶'; };
  }
  const picks = PICKS.map(id => TEMPLATES.find(t => t.id === id)).filter(Boolean);
  let tpl = picks[0];
  let chunks = buildChunks(words, tpl.words, 32);
  const octx = orig.getContext('2d'), cctx = cap.getContext('2d');
  orig.width = cap.width = W; orig.height = cap.height = H;

  // Style cards
  const cards = picks.map(t => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'demo-style' + (t === tpl ? ' on' : '');
    const c = document.createElement('canvas'); c.width = 240; c.height = 150;
    const nm = document.createElement('span'); nm.textContent = t.name;
    b.append(c, nm);
    b.onclick = () => {
      tpl = t; chunks = buildChunks(words, t.words, 32);
      cards.forEach(x => x.b.classList.toggle('on', x.t === t));
    };
    styles.appendChild(b);
    return { b, t, ctx: c.getContext('2d'), chunks: buildChunks(spreadWords('this is sample text now', 0.1, 3.8), t.words, 32) };
  });

  let visible = false;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (video) visible ? video.play().catch(() => {}) : video.pause();
  }, { rootMargin: '100px' }).observe(cap);

  const frame = (ctx, t) => {
    if (video && video.readyState >= 2) {
      const s = Math.max(W / video.videoWidth, H / video.videoHeight);
      ctx.drawImage(video, (W - video.videoWidth * s) / 2, (H - video.videoHeight * s) / 2, video.videoWidth * s, video.videoHeight * s);
    } else paintScene(ctx, W, H, t);
  };
  const t0 = performance.now();
  let last = 0;
  (function loop(now) {
    requestAnimationFrame(loop);
    if (!visible || now - last < FRAME_MS) return;
    last = now;
    const sec = (now - t0) / 1000;
    const t = video ? video.currentTime : sec % loopLen;
    frame(octx, sec); frame(cctx, sec);
    drawCaption(cctx, W, H, findChunk(chunks, t), t, tpl);
    const ct = sec % 4;
    for (const c of cards) {
      c.ctx.fillStyle = '#000'; c.ctx.fillRect(0, 0, 240, 150);
      drawCaption(c.ctx, 240, 150, findChunk(c.chunks, ct), ct, { ...c.t, pos: 0.5 });
    }
  })(t0);
}
