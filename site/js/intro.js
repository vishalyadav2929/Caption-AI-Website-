// The cinematic intro at the top of the home page: a warp tunnel of light streaks with media files
// (MP4, LUT, SRT…) flying out of a glowing core. Canvas 2D, no libraries; animates only while on
// screen, draws one still frame when the visitor prefers reduced motion. go() = warp-speed burst.

const LABELS = ['MP4', 'MOV', 'LUT', 'SRT', 'PNG', 'WAV', '4K', 'HDR', 'AI', 'FX', 'MP3', 'JPG', 'CUBE', 'TXT', 'Aa', '🎬', '🎵', '✨'];
const TINTS = ['#2dd4bf', '#a78bfa', '#f472b6', '#38bdf8', '#fbbf24', '#34d399'];

export function mountIntro(canvas) {
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1, visible = true, speed = 1, boost = 0, t0 = performance.now(), last = t0;
  const small = () => W < 700;
  const rand = (a, b) => a + Math.random() * (b - a);
  const star = () => ({ x: rand(-1, 1), y: rand(-1, 1), z: rand(0.05, 1), pz: 0 });
  const card = () => ({ x: rand(-1.1, 1.1), y: rand(-0.8, 0.8), z: rand(0.25, 1), label: LABELS[(Math.random() * LABELS.length) | 0], tint: TINTS[(Math.random() * TINTS.length) | 0], rot: rand(-0.5, 0.5), spin: rand(-0.4, 0.4) });
  let stars = [], cards = [];
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    stars = Array.from({ length: small() ? 160 : 340 }, star);
    cards = Array.from({ length: small() ? 10 : 18 }, card);
  }
  resize();
  addEventListener('resize', resize);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const sec = (now - t0) / 1000;
    speed += ((1 + boost) - speed) * Math.min(1, dt * 3);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Deep teal-violet space with a breathing core.
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
    bg.addColorStop(0, '#0b2a2c'); bg.addColorStop(0.5, '#0a1220'); bg.addColorStop(1, '#05060a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, f = Math.min(W, H) * 0.9;
    // Light streaks.
    ctx.lineCap = 'round';
    for (const s of stars) {
      s.pz = s.z;
      s.z -= dt * 0.22 * speed;
      if (s.z <= 0.02) { Object.assign(s, star(), { z: 1 }); s.pz = 1; }
      const x = cx + s.x / s.z * f * 0.5, y = cy + s.y / s.z * f * 0.5;
      const px = cx + s.x / s.pz * f * 0.5, py = cy + s.y / s.pz * f * 0.5;
      const a = Math.min(1, (1 - s.z) * 1.4);
      ctx.strokeStyle = `rgba(110,255,230,${a * 0.75})`;
      ctx.lineWidth = Math.max(0.6, (1 - s.z) * 2.4);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x + (x - px) * (speed > 2 ? 3 : 0.4), y + (y - py) * (speed > 2 ? 3 : 0.4)); ctx.stroke();
    }
    // Core glow.
    const pulse = 0.8 + 0.2 * Math.sin(sec * 2.2);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, f * 0.28 * pulse * (1 + boost * 0.15));
    core.addColorStop(0, 'rgba(180,255,240,.85)'); core.addColorStop(0.2, 'rgba(45,212,191,.35)'); core.addColorStop(1, 'rgba(45,212,191,0)');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, f * 0.3, 0, Math.PI * 2); ctx.fill();
    // Floating file cards, far ones first.
    cards.sort((a, b) => b.z - a.z);
    for (const c of cards) {
      c.z -= dt * 0.07 * speed; c.rot += c.spin * dt;
      if (c.z <= 0.12) Object.assign(c, card(), { z: 1 });
      const k = 1 / c.z, x = cx + c.x * k * f * 0.32, y = cy + c.y * k * f * 0.32, s = Math.min(160, 26 * k);
      const a = Math.min(1, (1 - c.z) * 2) * Math.min(1, (c.z - 0.12) * 6);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(x, y); ctx.rotate(c.rot * 0.4);
      const r = s * 0.18;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-s / 2, -s * 0.62, s, s * 1.24, r) : ctx.rect(-s / 2, -s * 0.62, s, s * 1.24);
      ctx.fillStyle = 'rgba(160,255,240,.08)'; ctx.fill();
      ctx.lineWidth = Math.max(1, s * 0.02); ctx.strokeStyle = 'rgba(180,255,245,.45)'; ctx.stroke();
      ctx.fillStyle = c.tint; ctx.globalAlpha = a * 0.9;
      ctx.fillRect(-s / 2 + s * 0.12, -s * 0.62 + s * 0.12, s * 0.28, s * 0.08);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#e6fffb';
      ctx.font = `800 ${Math.round(s * 0.26)}px Montserrat, Inter, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c.label, 0, s * 0.08);
      ctx.restore();
    }
    // Flash on warp.
    if (boost > 0.5) { ctx.fillStyle = `rgba(200,255,245,${Math.min(0.35, (speed - 1) / 40)})`; ctx.fillRect(0, 0, W, H); }
  }
  if (still) { frame(performance.now()); return { go: () => {} }; }
  (function loop(now) {
    requestAnimationFrame(loop);
    if (!visible || canvas.offsetParent === null) { last = now; return; }
    frame(now);
  })(t0);
  return {
    /** Warp-speed burst for `ms`, then back to cruising. */
    go(ms = 900) { boost = 14; setTimeout(() => { boost = 0; }, ms); },
  };
}
