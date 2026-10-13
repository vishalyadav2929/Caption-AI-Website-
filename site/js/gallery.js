import { TEMPLATES, TAGS, SAMPLES } from './templates.js';
import { buildChunks, findChunk, drawCaption, spreadWords } from './renderer.js';

const LOOP = 4.2;
const FRAME_MS = 1000 / 30 - 2;
const TW = 400, TH = 300;

function sampleChunks(tpl, lang = 'en') {
  // Devanagari-first styles preview in Hindi unless another script is picked.
  const id = lang === 'en' && tpl.tags.includes('hindi') ? 'hi' : lang;
  const words = spreadWords(SAMPLES.find(l => l.id === id).text, 0.1, LOOP - 0.3);
  return buildChunks(words, tpl.words, 40);
}

// A soft, moving bokeh backdrop for styles meant to sit over footage.
function paintScene(ctx, W, H, t) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#3a2a22'); g.addColorStop(0.5, '#6b4e3a'); g.addColorStop(1, '#1d1612');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 7; i++) {
    const x = W * ((i * 0.37 + 0.1 + Math.sin(t * 0.3 + i) * 0.03) % 1), y = H * (0.2 + ((i * 0.53) % 0.7));
    const r = H * (0.12 + (i % 3) * 0.06);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(255,${190 + i * 8},${120 + i * 10},.38)`); rg.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

// Colourful moving texture used to fill the letters of "video inside text" styles.
const fillCanvas = document.createElement('canvas');
fillCanvas.width = TW; fillCanvas.height = TH;
function paintFill(t) {
  const c = fillCanvas.getContext('2d');
  const g = c.createLinearGradient(0, 0, TW, TH);
  g.addColorStop(0, `hsl(${(t * 40) % 360},70%,60%)`);
  g.addColorStop(0.5, `hsl(${(t * 40 + 120) % 360},70%,55%)`);
  g.addColorStop(1, `hsl(${(t * 40 + 240) % 360},70%,60%)`);
  c.fillStyle = g; c.fillRect(0, 0, TW, TH);
  for (let i = 0; i < 6; i++) {
    c.fillStyle = `hsla(${(t * 60 + i * 60) % 360},90%,70%,.55)`;
    c.fillRect(((t * 40 + i * 70) % (TW + 80)) - 80, 0, 30, TH);
  }
}

/**
 * Mounts a filterable template grid.
 * opts: { tabsEl, gridEl, langEl?, countEl?, selected, onSelect }
 */
export function mountGallery({ tabsEl, gridEl, langEl, countEl, selected, onSelect }) {
  let filter = 'all';
  let current = selected;
  const tiles = [];
  const updateCount = () => {
    if (countEl) countEl.textContent = tiles.filter(x => x.el.style.display !== 'none').length;
  };

  tabsEl.innerHTML = '';
  TAGS.forEach(tag => {
    const b = document.createElement('button');
    b.className = 'tab' + (tag.id === filter ? ' on' : '');
    b.textContent = tag.name;
    b.onclick = () => {
      filter = tag.id;
      tabsEl.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
      tiles.forEach(tile => { tile.el.style.display = filter === 'all' || tile.tpl.tags.includes(filter) ? '' : 'none'; });
      updateCount();
    };
    tabsEl.appendChild(b);
  });

  if (langEl) {
    langEl.innerHTML = '';
    SAMPLES.forEach((l, i) => {
      const b = document.createElement('button');
      b.className = 'tab' + (i === 0 ? ' on' : '');
      b.append(l.name);
      if (l.en) { const sm = document.createElement('small'); sm.textContent = l.en; b.appendChild(sm); }
      b.onclick = () => {
        langEl.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
        tiles.forEach(tile => { tile.chunks = sampleChunks(tile.tpl, l.id); });
      };
      langEl.appendChild(b);
    });
  }

  gridEl.innerHTML = '';
  TEMPLATES.forEach(tpl => {
    const el = document.createElement('button');
    el.className = 'tpl' + (tpl.id === current ? ' on' : '');
    el.type = 'button';
    el.title = tpl.name;
    const cv = document.createElement('canvas');
    cv.width = TW; cv.height = TH;
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
    tiles.push({ el, tpl, ctx: cv.getContext('2d'), chunks: sampleChunks(tpl), visible: false, scene: /^estate/.test(tpl.id) });
  });
  updateCount();

  // Only animate tiles that are on screen.
  const byEl = new Map(tiles.map(x => [x.el, x]));
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    const tile = byEl.get(en.target);
    if (tile) tile.visible = en.isIntersecting;
  }), { rootMargin: '150px' });
  tiles.forEach(t => io.observe(t.el));

  const t0 = performance.now();
  let lastDraw = 0;
  (function loop(now) {
    requestAnimationFrame(loop);
    if (now - lastDraw < FRAME_MS) return; // 30 fps is plenty for previews and halves the CPU cost
    lastDraw = now;
    const sec = (now - t0) / 1000;
    const t = sec % LOOP;
    if (tiles.some(x => x.visible && x.tpl.fx === 'videoFill')) paintFill(sec);
    for (const tile of tiles) {
      if (!tile.visible || tile.el.style.display === 'none') continue;
      const { ctx } = tile;
      if (tile.scene) paintScene(ctx, TW, TH, sec);
      else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, TW, TH); }
      drawCaption(ctx, TW, TH, findChunk(tile.chunks, t), t, { ...tile.tpl, pos: tile.tpl.pos === 0.18 ? 0.25 : 0.5 }, { fill: fillCanvas });
    }
  })(t0);

  return { select(id) { current = id; tiles.forEach(x => x.el.classList.toggle('on', x.tpl.id === id)); } };
}

// A single looping phone mockup for the landing hero.
export function mountPhone(canvas, tplId, text, hue) {
  const tpl = TEMPLATES.find(t => t.id === tplId);
  const ctx = canvas.getContext('2d');
  const W = canvas.width = 360, H = canvas.height = 640;
  const chunks = buildChunks(spreadWords(text, 0.1, LOOP - 0.3), tpl.words, 40);
  const t0 = performance.now();
  let lastDraw = 0, visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  (function loop(now) {
    requestAnimationFrame(loop);
    if (!visible || now - lastDraw < FRAME_MS) return;
    lastDraw = now;
    const sec = (now - t0) / 1000, t = sec % LOOP;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, `hsl(${hue},40%,${20 + 4 * Math.sin(sec / 1.6)}%)`);
    g.addColorStop(1, `hsl(${(hue + 60) % 360},45%,8%)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawCaption(ctx, W, H, findChunk(chunks, t), t, tpl);
  })(t0);
}
