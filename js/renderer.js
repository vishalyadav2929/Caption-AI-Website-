import { fontString } from './templates.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = p => 1 - Math.pow(1 - p, 3);
const easeOutBack = p => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const easeOutBounce = p => {
  if (p < 1 / 2.75) return 7.5625 * p * p;
  if (p < 2 / 2.75) return 7.5625 * (p -= 1.5 / 2.75) * p + 0.75;
  if (p < 2.5 / 2.75) return 7.5625 * (p -= 2.25 / 2.75) * p + 0.9375;
  return 7.5625 * (p -= 2.625 / 2.75) * p + 0.984375;
};

// Group timed words into on-screen caption groups.
export function buildChunks(words, maxWords = 3, maxChars = 32) {
  const chunks = [];
  let cur = [], chars = 0, from = 0;
  const flush = (to) => {
    if (!cur.length) return;
    chunks.push({ words: cur, from, to, start: cur[0].start, end: cur[cur.length - 1].end });
    cur = []; chars = 0; from = to;
  };
  words.forEach((w, i) => {
    const prev = cur[cur.length - 1];
    if (cur.length && (cur.length >= maxWords || chars + w.text.length > maxChars || (prev && w.start - prev.end > 0.7))) flush(i);
    cur.push(w); chars += w.text.length + 1;
    if (maxWords > 1 && /[.!?।|]$/.test(w.text)) flush(i + 1);
  });
  flush(words.length);
  // Hold each group on screen until the next one starts, unless there's a long pause.
  chunks.forEach((c, i) => {
    const next = chunks[i + 1];
    c.end = next ? Math.max(c.end, Math.min(next.start, c.end + 0.6)) : c.end + 0.6;
  });
  return chunks;
}

export function findChunk(chunks, t) {
  let lo = 0, hi = chunks.length - 1, found = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (chunks[mid].start <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (found === null) return null;
  const c = chunks[found];
  return t < c.end ? c : null;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function displayText(text, tpl) {
  if (tpl.upper) return text.toUpperCase();
  if (tpl.lower) return text.toLowerCase();
  return text;
}

// opts: { scale, pos } user overrides for size multiplier and vertical position (0..1).
export function drawCaption(ctx, W, H, chunk, t, tpl, opts = {}) {
  if (!chunk || !chunk.words.length) return;
  const px = tpl.size * Math.min(H, W * 1.6) * (opts.scale || 1);
  const pos = opts.pos ?? tpl.pos ?? 0.72;
  const hasIndic = chunk.words.some(w => /[ऀ-෿]/.test(w.text));
  const lineH = px * (hasIndic ? 1.45 : 1.18);
  const maxW = W * 0.86;

  ctx.save();
  ctx.font = fontString(tpl, px);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(tpl.spacing || 0) * px}px`;
  const space = Math.max(ctx.measureText(' ').width, px * 0.26) + (tpl.spacing || 0) * px;

  // Per-word sizing. Templates with `emph` blow up the key (longest) word and shrink the rest.
  const em = tpl.emph;
  let key = -1;
  if (em) chunk.words.forEach((w, i) => { if (key < 0 || w.text.length > chunk.words[key].text.length) key = i; });
  const items = chunk.words.map((w, i) => {
    const text = displayText(w.text, tpl);
    const isKey = i === key;
    const ipx = em ? px * (isKey ? em.scale : (em.small || 1)) : px;
    const font = em
      ? fontString({ ...tpl, weight: isKey ? (em.weight ?? tpl.weight) : tpl.weight, italic: isKey ? !!em.italic : !!em.otherItalic }, ipx)
      : ctx.font;
    ctx.font = font;
    let width = ctx.measureText(text).width;
    // A single word wider than the frame (long Tamil/Malayalam words, big emphasis) is shrunk to fit.
    if (width > maxW) {
      const k = maxW / width;
      return { w, text, width: maxW, px: ipx * k, font: font.replace(/(\d+)px/, (_, n) => `${Math.round(n * k)}px`), isKey };
    }
    return { w, text, width, px: ipx, font, isKey };
  });

  // Word-wrap (or one word per line for stacked styles).
  const stack = tpl.layout === 'stack';
  const lines = [];
  let line = [], lw = 0;
  for (const it of items) {
    const add = (line.length ? space : 0) + it.width;
    if (line.length && (stack || lw + add > maxW)) { lines.push({ items: line, width: lw }); line = []; lw = 0; }
    lw += (line.length ? space : 0) + it.width; line.push(it);
  }
  if (line.length) lines.push({ items: line, width: lw });
  const lineFactor = stack ? (hasIndic ? 1.2 : 0.92) : lineH / px;
  lines.forEach(l => { l.h = Math.max(...l.items.map(it => it.px)) * lineFactor; });

  const blockH = lines.reduce((a, l) => a + l.h, 0);
  const cy = clamp(pos, 0.08, 0.95) * H;
  let y = cy - blockH / 2;
  lines.forEach(l => {
    let x = W / 2 - l.width / 2;
    const ly = y + l.h / 2;
    l.items.forEach(it => { it.x = x + it.width / 2; it.y = ly; x += it.width + space; });
    l.y = ly; y += l.h;
  });

  // Entry animation for the whole group.
  const e = clamp((t - chunk.start) / 0.22);
  let alpha = 1, gScale = 1, gx = 0, gy = 0;
  switch (tpl.anim) {
    case 'pop': gScale = 0.7 + 0.3 * easeOutBack(e); alpha = clamp(e * 3); break;
    case 'bounce': gy = (1 - easeOutBounce(e)) * px * 0.6; alpha = clamp(e * 3); break;
    case 'slide': gx = (1 - easeOut(e)) * -px * 0.6; alpha = easeOut(e); break;
    case 'fade': alpha = easeOut(e); break;
  }
  ctx.globalAlpha = alpha;
  ctx.translate(W / 2 + gx, cy + gy);
  ctx.scale(gScale, gScale);
  if (tpl.rotate) ctx.rotate(tpl.rotate * Math.PI / 180);
  ctx.translate(-W / 2, -cy);

  let active = -1;
  chunk.words.forEach((w, i) => { if (w.start <= t) active = i; });
  const typeMode = tpl.anim === 'type';

  // Background plate per line.
  if (tpl.bg) {
    const pad = tpl.bg.pad * px;
    ctx.fillStyle = tpl.bg.c;
    lines.forEach(l => {
      const vis = typeMode ? l.items.filter(it => chunk.words.indexOf(it.w) <= active) : l.items;
      if (!vis.length) return;
      const left = vis[0].x - vis[0].width / 2, right = vis[vis.length - 1].x + vis[vis.length - 1].width / 2;
      roundRect(ctx, left - pad, l.y - l.h / 2 - pad * 0.3 + l.h * 0.06, right - left + pad * 2, l.h + pad * 0.6 - l.h * 0.12, tpl.bg.r * px);
      ctx.fill();
    });
  }

  items.forEach((it, i) => {
    if (typeMode && i > active) return;
    const isActive = i === active;
    const isPast = i < active;
    ctx.save();
    let s = 1;
    if (typeMode) ctx.globalAlpha = alpha * clamp((t - it.w.start) / 0.08);
    if (tpl.hi === 'scale' && isActive) s = 1 + 0.14 * easeOutBack(clamp((t - it.w.start) / 0.15));
    ctx.translate(it.x, it.y);
    ctx.scale(s, s);
    ctx.font = it.font;
    const px = it.px;

    let fill = it.isKey && em.gradient ? em.gradient : tpl.color;
    if (tpl.hi === 'box' && isActive) {
      const p = easeOutBack(clamp((t - it.w.start) / 0.12));
      const padX = px * 0.16, padY = px * 0.08, bh = px * (hasIndic ? 1.35 : 1.12);
      ctx.save();
      ctx.scale(0.85 + 0.15 * p, 0.85 + 0.15 * p);
      ctx.fillStyle = tpl.hiColor;
      roundRect(ctx, -it.width / 2 - padX, -bh / 2 - padY, it.width + padX * 2, bh + padY * 2, px * 0.18);
      ctx.fill();
      ctx.restore();
      fill = tpl.boxText || '#fff';
    } else if ((tpl.hi === 'color' || tpl.hi === 'scale') && isActive) {
      fill = tpl.hiColor;
    } else if (tpl.hi === 'karaoke' && isPast) {
      fill = tpl.hiColor;
    }
    const dimmed = tpl.dim && tpl.hi === 'karaoke' && !isPast && !isActive;
    if (dimmed) ctx.globalAlpha *= tpl.dim;

    drawWord(ctx, it.text, fill, tpl, px, tpl.hi === 'box' && isActive, it.isKey && em.glow);

    if (tpl.hi === 'karaoke' && isActive) {
      const dur = Math.max(0.05, it.w.end - it.w.start);
      const p = clamp((t - it.w.start) / dur);
      ctx.beginPath();
      ctx.rect(-it.width / 2 - px * 0.3, -px, (it.width + px * 0.6) * p, px * 2);
      ctx.clip();
      ctx.globalAlpha = alpha;
      drawWord(ctx, it.text, tpl.hiColor, tpl, px, false);
    }
    ctx.restore();
  });
  ctx.restore();
}

function drawWord(ctx, text, fill, tpl, px, onBox, glow) {
  // An array fill is a top-to-bottom gradient, e.g. gold → orange.
  if (Array.isArray(fill)) {
    const g = ctx.createLinearGradient(0, -px * 0.45, 0, px * 0.45);
    fill.forEach((c, i) => g.addColorStop(i / (fill.length - 1), c));
    fill = g;
  }
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = px * 0.4;
    ctx.fillStyle = fill;
    ctx.fillText(text, 0, 0);
  }
  if (tpl.shadow) {
    ctx.shadowColor = tpl.shadow.c;
    ctx.shadowBlur = tpl.shadow.b * px;
    ctx.shadowOffsetX = tpl.shadow.x * px;
    ctx.shadowOffsetY = tpl.shadow.y * px;
  }
  if (tpl.stroke && !onBox) {
    ctx.strokeStyle = tpl.stroke.c;
    ctx.lineWidth = tpl.stroke.w * px;
    ctx.strokeText(text, 0, 0);
    ctx.shadowColor = 'transparent';
  }
  if (tpl.glow) {
    ctx.shadowColor = fill === tpl.color ? tpl.glow : fill;
    ctx.shadowBlur = px * 0.45;
    ctx.fillStyle = fill;
    ctx.fillText(text, 0, 0);
    ctx.shadowBlur = px * 0.15;
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.shadowColor = 'transparent';
}

// Evenly spread words across a time range — used for previews, manual edits and segment-level transcripts.
export function spreadWords(text, start, end) {
  const parts = text.split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  const step = (end - start) / parts.length;
  return parts.map((p, i) => ({ text: p, start: start + i * step, end: start + (i + 1) * step }));
}
