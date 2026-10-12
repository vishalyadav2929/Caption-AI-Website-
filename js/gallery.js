import { TEMPLATES, TAGS } from './templates.js';
import { buildChunks, findChunk, drawCaption, spreadWords } from './renderer.js';

const SAMPLE_EN = 'this is how your reels go viral every single time';
const SAMPLE_HI = 'ऐसे होगी आपकी रील हर बार वायरल';
const LOOP = 4.2;

function sampleChunks(tpl) {
  const words = spreadWords(tpl.tags.includes('hindi') ? SAMPLE_HI : SAMPLE_EN, 0.1, LOOP - 0.3);
  return buildChunks(words, Math.min(tpl.words, 3), 22);
}

// Draws a soft gradient "video" background so tiles look like real footage.
function paintBg(ctx, W, H, hue, t) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, `hsl(${hue},45%,${22 + 4 * Math.sin(t)}%)`);
  g.addColorStop(1, `hsl(${(hue + 60) % 360},50%,12%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,.06)';
  ctx.beginPath();
  ctx.arc(W * 0.5, H * 0.38, W * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Mounts a filterable template grid.
 * opts: { tabsEl, gridEl, selected, onSelect }
 */
export function mountGallery({ tabsEl, gridEl, selected, onSelect }) {
  let filter = 'all';
  let current = selected;
  const tiles = [];

  tabsEl.innerHTML = '';
  TAGS.forEach(tag => {
    const b = document.createElement('button');
    b.className = 'tab' + (tag.id === filter ? ' on' : '');
    b.textContent = tag.name;
    b.onclick = () => {
      filter = tag.id;
      tabsEl.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
      tiles.forEach(tile => { tile.el.style.display = filter === 'all' || tile.tpl.tags.includes(filter) ? '' : 'none'; });
    };
    tabsEl.appendChild(b);
  });

  gridEl.innerHTML = '';
  TEMPLATES.forEach((tpl, i) => {
    const el = document.createElement('button');
    el.className = 'tpl' + (tpl.id === current ? ' on' : '');
    el.type = 'button';
    el.title = tpl.name;
    const cv = document.createElement('canvas');
    cv.width = 320; cv.height = 400;
    const nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = tpl.name;
    el.append(cv, nm);
    el.onclick = () => {
      current = tpl.id;
      tiles.forEach(x => x.el.classList.toggle('on', x.tpl.id === current));
      onSelect && onSelect(tpl);
    };
    gridEl.appendChild(el);
    tiles.push({ el, tpl, ctx: cv.getContext('2d'), chunks: sampleChunks(tpl), hue: (i * 47) % 360, visible: true });
  });

  // Only animate tiles that are on screen.
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    const tile = tiles.find(x => x.el === en.target);
    if (tile) tile.visible = en.isIntersecting;
  }));
  tiles.forEach(t => io.observe(t.el));

  const t0 = performance.now();
  (function loop(now) {
    const t = ((now - t0) / 1000) % LOOP;
    for (const tile of tiles) {
      if (!tile.visible || tile.el.style.display === 'none') continue;
      const { ctx } = tile;
      paintBg(ctx, 320, 400, tile.hue, (now - t0) / 1600);
      drawCaption(ctx, 320, 400, findChunk(tile.chunks, t), t, { ...tile.tpl, pos: 0.55 });
    }
    requestAnimationFrame(loop);
  })(t0);

  return { select(id) { current = id; tiles.forEach(x => x.el.classList.toggle('on', x.tpl.id === id)); } };
}

// A single looping phone mockup for the landing hero.
export function mountPhone(canvas, tplId, text, hue) {
  const tpl = TEMPLATES.find(t => t.id === tplId);
  const ctx = canvas.getContext('2d');
  const W = canvas.width = 360, H = canvas.height = 640;
  const chunks = buildChunks(spreadWords(text, 0.1, LOOP - 0.3), tpl.words, 24);
  const t0 = performance.now();
  (function loop(now) {
    const t = ((now - t0) / 1000) % LOOP;
    paintBg(ctx, W, H, hue, (now - t0) / 1600);
    drawCaption(ctx, W, H, findChunk(chunks, t), t, tpl);
    requestAnimationFrame(loop);
  })(t0);
}
