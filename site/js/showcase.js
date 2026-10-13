// "Made with our captions": real clips with caption templates drawn live on top, like a finished reel.
// Clips and captions live in site/examples/ and are listed in examples/manifest.json:
//   { "items": [ { "video": "clip1.mp4", "captions": "clip1.srt", "templates": ["classic", "crazy"] } ] }
// "captions" can be an .srt file or a .json list of words [{ "text", "start", "end" }].
// One clip can be shown in several templates. Nothing is shown until the manifest lists something.
import { TEMPLATES } from './templates.js';
import { buildChunks, findChunk, drawCaption } from './renderer.js';
import { parseSRT } from './captions.js';

const W = 360, H = 640;

async function loadWords(file) {
  const res = await fetch(`examples/${file}`);
  if (!res.ok) throw new Error(file);
  if (/\.json$/i.test(file)) return res.json();
  return parseSRT(await res.text()).flatMap(s => s.words);
}

export async function mountShowcase(section, grid) {
  let manifest;
  try { manifest = await (await fetch('examples/manifest.json', { cache: 'no-cache' })).json(); } catch { return; }
  const cards = [];
  for (const it of manifest.items || []) {
    let words = [];
    try { if (it.captions) words = await loadWords(it.captions); } catch { continue; }
    for (const id of it.templates || []) {
      const tpl = TEMPLATES.find(t => t.id === id);
      if (tpl) cards.push({ it, tpl, chunks: buildChunks(words, tpl.words, 32) });
    }
  }
  if (!cards.length) return;
  section.hidden = false;

  const live = new Set();
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    const c = e.target.__card;
    if (e.isIntersecting) { live.add(c); c.video.play().catch(() => {}); } else { live.delete(c); c.video.pause(); }
  }), { rootMargin: '100px' });

  for (const c of cards) {
    const a = document.createElement('a');
    a.className = 'ex';
    a.href = `app.html?t=${encodeURIComponent(c.tpl.id)}`;
    a.title = `Use ${c.tpl.name}`;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const name = document.createElement('span');
    name.textContent = c.tpl.name;
    a.append(canvas, name);
    grid.appendChild(a);
    const video = document.createElement('video');
    Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'metadata', src: `examples/${c.it.video}` });
    video.setAttribute('playsinline', '');
    Object.assign(c, { video, ctx: canvas.getContext('2d') });
    a.__card = c;
    io.observe(a);
  }

  (function loop() {
    for (const c of live) {
      const { ctx, video } = c;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const vw = video.videoWidth, vh = video.videoHeight;
      if (vw && video.readyState >= 2) {
        const s = Math.max(W / vw, H / vh); // fill the card, crop the edges
        ctx.drawImage(video, (W - vw * s) / 2, (H - vh * s) / 2, vw * s, vh * s);
      }
      const t = video.currentTime;
      drawCaption(ctx, W, H, findChunk(c.chunks, t), t, c.tpl);
    }
    requestAnimationFrame(loop);
  })();
}
