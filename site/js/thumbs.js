// Thumbnail maker: output sizes, background overlays and starter layouts. A layout is only a starting
// point: its texts become ordinary text layers (font, colours, words, position all editable), and the
// overlay can be changed or removed. Pure data + drawing helpers.

export const SIZES = [
  { id: 'yt', name: 'YouTube thumbnail · 1280×720', w: 1280, h: 720 },
  { id: 'reel', name: 'Reels / Shorts cover · 1080×1920', w: 1080, h: 1920 },
  { id: 'pin', name: 'Pinterest pin · 1000×1500', w: 1000, h: 1500 },
  { id: 'ig', name: 'Instagram post · 1080×1350', w: 1080, h: 1350 },
  { id: 'sq', name: 'Square · 1080×1080', w: 1080, h: 1080 },
];

export const OVERLAYS = [
  ['none', 'None'], ['shade-bottom', 'Dark bottom'], ['shade-left', 'Dark left side'], ['vignette', 'Vignette'],
  ['bar-top', 'Colour bar top'], ['bar-bottom', 'Colour bar bottom'], ['split', 'Colour panel left'], ['frame', 'Frame'],
];

const T = (o) => ({ x: 0.5, y: 0.5, size: 0.1, font: 'Anton', bold: false, italic: false, color: '#ffffff', stroke: '#000000', strokeW: 0, bg: '#000000', bgOp: 0, shadow: true, align: 'center', ...o });

export const THUMBS = [
  { id: 'big-bold', name: 'Big Bold', overlay: { type: 'shade-bottom' },
    texts: [T({ text: "YOU WON'T\nBELIEVE THIS", y: 0.74, size: 0.17, color: '#FFE600', strokeW: 0.14, wordColors: { 2: '#ffffff' } })] },
  { id: 'side-story', name: 'Side Story', overlay: { type: 'shade-left' },
    texts: [T({ text: 'I TRIED THIS\nFOR 30 DAYS', x: 0.27, y: 0.5, size: 0.13, align: 'left', strokeW: 0.1, wordColors: { 3: '#FFE600', 4: '#FFE600' } })] },
  { id: 'podcast', name: 'Podcast', overlay: { type: 'bar-bottom', color: '#111111' },
    texts: [T({ text: 'EP 12 · GUEST NAME', x: 0.5, y: 0.08, size: 0.045, font: 'Montserrat', bold: true, color: '#111111', bg: '#ffffff', bgOp: 92, shadow: false }),
      T({ text: 'The truth about money nobody tells you', y: 0.9, size: 0.065, font: 'Montserrat', bold: true, shadow: false, wordColors: { 1: '#FFD400' } })] },
  { id: 'breaking', name: 'Breaking', overlay: { type: 'bar-top', color: '#E11D48' },
    texts: [T({ text: 'BREAKING', y: 0.07, size: 0.08, shadow: false }),
      T({ text: 'Your big headline goes here', y: 0.84, size: 0.07, font: 'Montserrat', bold: true, bg: '#000000', bgOp: 82, shadow: false })] },
  { id: 'vlog', name: 'Vlog Day', overlay: { type: 'vignette' },
    texts: [T({ text: 'a day in my life', y: 0.15, size: 0.1, font: 'Pacifico' }),
      T({ text: 'DAY 1', y: 0.88, size: 0.06, font: 'Montserrat', bold: true, color: '#111111', bg: '#ffffff', bgOp: 95, shadow: false })] },
  { id: 'money', name: 'Money', overlay: { type: 'shade-bottom' },
    texts: [T({ text: '₹1,00,000', y: 0.64, size: 0.17, color: '#22C55E', strokeW: 0.12 }),
      T({ text: 'IN 30 DAYS?', y: 0.86, size: 0.1, strokeW: 0.1 })] },
  { id: 'gaming', name: 'Gaming', overlay: { type: 'vignette' },
    texts: [T({ text: 'EPIC WIN', y: 0.8, size: 0.17, font: 'Bungee', color: '#00F0FF', stroke: '#2A0057', strokeW: 0.16 })] },
  { id: 'pin-minimal', name: 'Pinterest Minimal', overlay: { type: 'frame', color: '#ffffff' },
    texts: [T({ text: '10 Outfit Ideas', y: 0.83, size: 0.08, font: 'Playfair Display', italic: true, bold: true, color: '#111111', bg: '#ffffff', bgOp: 92, shadow: false })] },
  { id: 'desi-bold', name: 'Desi Bold', overlay: { type: 'shade-bottom' },
    texts: [T({ text: 'ये गलती मत करना', y: 0.8, size: 0.14, font: 'Rozha One', color: '#FFD400', strokeW: 0.12 })] },
  { id: 'split-panel', name: 'Colour Panel', overlay: { type: 'split', color: '#7C3AED' },
    texts: [T({ text: 'HOW I\nGREW\n10X', x: 0.22, y: 0.5, size: 0.14, align: 'center', strokeW: 0 })] },
];

/** Where the photo goes inside the frame (cover or contain), with x/y panning (0..1). */
export function photoRect(iw, ih, W, H, f = {}) {
  const k = f.fit === 'contain' ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih);
  const w = iw * k, h = ih * k;
  return { x: (W - w) * (f.x ?? 0.5), y: (H - h) * (f.y ?? 0.5), w, h };
}

export function drawOverlay(ctx, W, H, o) {
  if (!o || o.type === 'none') return;
  const c = o.color || '#7C3AED';
  ctx.save();
  if (o.type === 'shade-bottom') {
    const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.88)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else if (o.type === 'shade-left') {
    const g = ctx.createLinearGradient(0, 0, W * 0.7, 0);
    g.addColorStop(0, 'rgba(0,0,0,.88)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else if (o.type === 'vignette') {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.75)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else if (o.type === 'bar-top') { ctx.fillStyle = c; ctx.fillRect(0, 0, W, H * 0.14); }
  else if (o.type === 'bar-bottom') { ctx.fillStyle = c; ctx.fillRect(0, H * 0.8, W, H * 0.2); }
  else if (o.type === 'split') { ctx.fillStyle = c; ctx.fillRect(0, 0, W * 0.44, H); }
  else if (o.type === 'frame') { const b = Math.min(W, H) * 0.04; ctx.lineWidth = b; ctx.strokeStyle = c; ctx.strokeRect(b / 2, b / 2, W - b, H - b); }
  ctx.restore();
}
