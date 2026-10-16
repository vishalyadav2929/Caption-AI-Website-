// Caption style presets. `size` is a fraction of the frame's short side (×1.6); stroke widths are fractions of font size.
// hi: highlight for the spoken word — color | box | scale | karaoke | none
// anim: how a caption group enters — pop | bounce | slide | rise | zoom | fade | type | none
// roles: per-word overrides by position in the group; lines: words per line; reveal: type | blur | slam
// pending / active / past: overrides by whether a word has been spoken yet.

const W = '#ffffff';
const SCRIPT = { font: 'Great Vibes', weight: 400, italic: false };
const SERIF_I = { font: 'Playfair Display', weight: 800, italic: true };
const small = (k = 0.45) => ({ size: k });

export const TEMPLATES = [
  // ---- Signature set ----
  { id: 'classic', name: 'Classic', tags: ['minimal'], font: 'Montserrat', weight: 700, size: 0.04, lower: true,
    color: W, hi: 'none', anim: 'fade', words: 3, pos: 0.5 },
  { id: 'crazy', name: 'Crazy', tags: ['viral', 'insta'], font: 'Montserrat', weight: 800, size: 0.036, layout: 'stack', title: true,
    color: W, hi: 'none', anim: 'pop', words: 3, pos: 0.5, lineGap: 0.82,
    emph: { scale: 2.1, weight: 900, small: 0.95, otherItalic: true, gradient: ['#FFE27A', '#FFB22E', '#F07800'], glow: 'rgba(255,140,0,.55)' } },
  { id: 'discipline', name: 'Discipline', tags: ['viral', 'insta'], font: 'Montserrat', weight: 900, size: 0.045, layout: 'stack', lower: true,
    color: W, hi: 'none', anim: 'fade', words: 3, pos: 0.5, lineGap: 0.82,
    roles: [{ size: 0.42, weight: 700 }, { size: 1.25 }, { ...SCRIPT, size: 1.25, color: '#D7263D' }] },
  { id: 'red-wipe', name: 'Red Wipe', tags: ['viral', 'insta'], font: 'Montserrat', weight: 800, size: 0.05, lines: [2, 2],
    color: W, hi: 'none', anim: 'slide', words: 4, pos: 0.5, lineGap: 1.05, title: true,
    roles: [{}, {}, { ...SERIF_I, title: false, lower: true, box: { c: '#C8102E', text: W, r: 0 } }, { ...SERIF_I, title: false, lower: true, box: { c: '#C8102E', text: W, r: 0 } }] },
  { id: 'spark', name: 'Spark', tags: ['viral', 'insta'], font: 'Montserrat', weight: 900, size: 0.046, lines: [2, 2, 1], lower: true,
    color: W, hi: 'none', anim: 'pop', words: 5, pos: 0.5, lineGap: 0.86,
    roles: [small(0.62), small(0.62), { color: '#B6FF2E', shadow: { c: 'rgba(0,0,0,.8)', b: 0.15, x: 0, y: 0.04 } }, { color: '#B6FF2E', shadow: { c: 'rgba(0,0,0,.8)', b: 0.15, x: 0, y: 0.04 } }, small(0.62)] },
  { id: 'creator-3', name: 'Creator 3', tags: ['viral', 'insta'], font: 'Montserrat', weight: 900, size: 0.05, layout: 'stack', lower: true,
    color: '#9BFF2E', hi: 'none', anim: 'fade', reveal: 'blur', words: 2, pos: 0.5, lineGap: 0.8,
    roles: [{ size: 1.3, glow: { c: 'rgba(110,255,0,.75)', b: 0.5 } }, { ...SCRIPT, size: 0.75 }] },
  { id: 'creator-4', name: 'Creator 4', tags: ['viral', 'insta', 'pinterest'], font: 'Montserrat', weight: 800, size: 0.042, lines: [3, 2], title: true,
    color: '#FFC531', hi: 'none', anim: 'fade', words: 5, pos: 0.5, lineGap: 0.95,
    roles: [{ gradient: ['#FFE07A', '#FFB300'], glow: { c: 'rgba(255,170,0,.7)', b: 0.45 } }, { gradient: ['#FFE07A', '#FFB300'], glow: { c: 'rgba(255,170,0,.7)', b: 0.45 } },
      { gradient: ['#FFE07A', '#FFB300'], glow: { c: 'rgba(255,170,0,.7)', b: 0.45 } }, { ...SCRIPT, size: 1.2, color: W, glow: { c: 'rgba(255,255,255,.85)', b: 0.3 } }] },
  { id: 'crazy-2', name: 'Crazy 2', tags: ['viral', 'insta'], font: 'Montserrat', weight: 900, size: 0.05, layout: 'stack', lower: true,
    color: W, hi: 'none', anim: 'pop', words: 3, pos: 0.5, lineGap: 0.8, roles: [{}, { color: '#1EA7FF' }, {}] },
  { id: 'perfect', name: 'Perfect', tags: ['viral', 'minimal'], font: 'Montserrat', weight: 900, size: 0.05, layout: 'stack', lower: true,
    color: W, hi: 'none', anim: 'pop', words: 3, pos: 0.5, lineGap: 0.78, roles: [small(0.5), { size: 1.35 }, small(0.5)] },
  { id: 'hind', name: 'Hind', tags: ['insta', 'pinterest'], font: 'Montserrat', weight: 800, size: 0.034, lines: [3, 3], lower: true,
    color: W, hi: 'none', anim: 'fade', words: 6, pos: 0.5, lineGap: 1.05, glow: 'rgba(255,255,255,.55)',
    roles: [{ ...SERIF_I, size: 1.35, color: '#FF9A4D', glow: { c: 'rgba(255,140,40,.8)', b: 0.45 } }, {}] },
  { id: 'boxed', name: 'Boxed', tags: ['minimal', 'pinterest'], font: 'Montserrat', weight: 600, size: 0.045, lines: [3, 1], lower: true,
    color: W, hi: 'none', anim: 'fade', fx: 'guides', words: 4, pos: 0.5, lineGap: 1,
    roles: [small(0.32), small(0.32), small(0.32), { ...SERIF_I, size: 1.25, color: '#E8F59A' }] },
  { id: 'sliding-highlight', name: 'Sliding Highlight', tags: ['minimal', 'insta'], font: 'Montserrat', weight: 700, size: 0.04, lower: true,
    color: W, hi: 'none', anim: 'fade', fx: 'slideHL', words: 3, pos: 0.5 },
  { id: 'solo', name: 'Solo', tags: ['minimal'], font: 'Lato', weight: 700, size: 0.034, lower: true,
    color: W, hi: 'none', anim: 'fade', words: 3, pos: 0.5 },
  { id: 'no-caption', name: 'No Caption', tags: ['minimal'], none: true, font: 'Montserrat', weight: 700, size: 0.04, color: W, hi: 'none', words: 3 },
  { id: 'master', name: 'Master', tags: ['viral', 'minimal'], font: 'Montserrat', weight: 800, size: 0.045, lines: [3, 1], lower: true,
    color: W, hi: 'none', anim: 'fade', words: 4, pos: 0.5, lineGap: 0.9,
    roles: [small(0.42), small(0.42), small(0.42), { size: 1.25, gradient: ['#FFFFFF', '#9DB8FF', '#3D6BFF', '#FFFFFF'], gradDir: 'x' }] },
  { id: 'simple', name: 'Simple', tags: ['minimal', 'insta'], font: 'Montserrat', weight: 800, size: 0.048, lower: true,
    color: W, hi: 'none', anim: 'fade', words: 2, pos: 0.5, roles: [small(0.55), { size: 1.2, color: '#22C3F0' }] },
  { id: 'podcast', name: 'Podcast', tags: ['minimal', 'viral'], font: 'Montserrat', weight: 800, size: 0.04, lines: [2, 2, 4], upper: true, align: 'left',
    color: W, hi: 'none', anim: 'fade', words: 8, pos: 0.5, lineGap: 1, pending: { color: '#6E6E6E' },
    roles: [{}, {}, {}, {}, small(0.5)] },
  { id: 'kinetic', name: 'Kinetic', tags: ['viral', 'insta'], font: 'Montserrat', weight: 800, size: 0.04, lines: [3, 2, 2], title: true, stagger: 0.35,
    color: W, hi: 'none', anim: 'rise', words: 7, pos: 0.5, lineGap: 0.92,
    roles: [{}, {}, {}, { color: '#FFE100', upper: true, weight: 900 }, { color: '#1FC8F0' }, { lower: true, title: false }, { lower: true, title: false }],
    pending: { opacity: 0.35 } },
  { id: 'impact', name: 'Impact', tags: ['viral'], font: 'Anton', weight: 400, size: 0.052, lines: [3, 2], upper: true,
    color: '#FF1A1A', hi: 'none', anim: 'zoom', words: 5, pos: 0.5, lineGap: 0.95, glow: 'rgba(255,0,0,.85)',
    roles: [{}, {}, {}, { size: 0.62, font: 'Montserrat', weight: 800, color: W, glow: { c: 'rgba(255,255,255,.5)', b: 0.3 } }] },
  { id: 'clean', name: 'Clean', tags: ['minimal'], font: 'Montserrat', weight: 800, size: 0.04, lines: [2, 3],
    color: W, hi: 'none', anim: 'fade', words: 5, pos: 0.5, lineGap: 0.95, title: true,
    roles: [{ size: 1.45 }, { size: 1.45, lower: true, title: false }, { size: 0.62, lower: true, title: false }] },
  { id: 'punch', name: 'Punch', tags: ['viral', 'insta'], font: 'Playfair Display', weight: 800, italic: true, size: 0.042, lines: [2, 1], lower: true,
    color: W, hi: 'none', anim: 'pop', words: 3, pos: 0.5, lineGap: 0.95,
    roles: [{}, { color: '#FFE600' }, { font: 'Anton', weight: 400, italic: false, upper: true, size: 2.1, color: '#FFE600' }] },
  { id: 'slam', name: 'Slam', tags: ['viral'], font: 'Anton', weight: 400, size: 0.06, layout: 'stack', upper: true,
    color: W, hi: 'none', anim: 'none', reveal: 'slam', words: 3, pos: 0.5, lineGap: 0.92 },
  { id: 'scatter', name: 'Scatter', tags: ['viral'], font: 'Anton', weight: 400, size: 0.05, lines: [2, 2], upper: true, gap: 0.5,
    color: W, hi: 'none', anim: 'none', reveal: 'blur', words: 4, pos: 0.5, lineGap: 0.95,
    roles: [small(0.55), small(0.55), { size: 1.15, color: '#FFF07A' }, { size: 1.15, color: '#FFF07A' }] },
  { id: 'creator', name: 'Creator', tags: ['viral', 'insta'], font: 'Montserrat', weight: 900, size: 0.04, lines: [3, 2], upper: true,
    color: W, hi: 'none', anim: 'rise', words: 5, pos: 0.5, lineGap: 0.95,
    roles: [{}, {}, {}, { italic: true, gradient: ['#BDE6FF', '#3F8CFF'] }, { italic: true, gradient: ['#BDE6FF', '#3F8CFF'] }] },
  { id: 'creator-2', name: 'Creator 2', tags: ['viral', 'insta'], font: 'Montserrat', weight: 500, size: 0.032, lines: [2, 4],
    color: W, hi: 'none', anim: 'fade', words: 6, pos: 0.5, lineGap: 0.9,
    roles: [{ size: 1.7, weight: 900, italic: true, title: true, color: '#5BE7FF', shadow: { c: '#0a3a66', b: 0, x: 0.05, y: 0.05 } },
      { size: 1.7, weight: 900, italic: true, title: true, color: '#5BE7FF', shadow: { c: '#0a3a66', b: 0, x: 0.05, y: 0.05 } }, { lower: true }] },
  { id: 'story', name: 'Story', tags: ['pinterest'], font: 'Playfair Display', weight: 800, italic: true, size: 0.05, lower: true,
    color: '#E0313F', hi: 'none', anim: 'fade', reveal: 'blur', words: 2, pos: 0.5, glow: 'rgba(224,49,63,.6)' },
  { id: 'gamer', name: 'Gamer', tags: ['viral'], font: 'Montserrat', weight: 900, size: 0.062, lower: true,
    color: '#3AA0FF', hi: 'none', anim: 'slide', words: 3, pos: 0.18, stroke: { w: 0.08, c: '#06213f' } },
  { id: 'cursive', name: 'Cursive', tags: ['pinterest', 'insta'], font: 'Montserrat', weight: 700, size: 0.04, lower: true,
    color: W, hi: 'none', anim: 'fade', words: 3, pos: 0.5, gap: 0.2,
    roles: [{ font: 'Dancing Script', weight: 700, size: 1.35, color: '#F07DB0', title: true }, {}] },
  { id: 'popular', name: 'Popular', tags: ['viral', 'insta'], font: 'Archivo Black', weight: 400, size: 0.04, upper: true,
    color: W, hiColor: '#FFD400', hi: 'color', anim: 'pop', words: 3, pos: 0.5 },
  { id: 'highlight', name: 'Highlight', tags: ['trending', 'viral', 'minimal'], font: 'Montserrat', weight: 700, size: 0.04, lower: true, spacing: 0.04,
    color: W, hiColor: '#FFD400', hi: 'color', anim: 'fade', words: 4, pos: 0.5 },
  { id: 'focus', name: 'Focus', tags: ['trending', 'viral', 'insta'], font: 'Montserrat', weight: 800, size: 0.042, upper: true, lines: [2, 2], spacing: 0.06,
    color: W, hiColor: '#FFE600', boxText: '#111111', hi: 'box', anim: 'fade', words: 4, pos: 0.5, lineGap: 1.25, gap: 0.3 },
  { id: 'open', name: 'Open', tags: ['viral'], font: 'Anton', weight: 400, size: 0.045, upper: true, spacing: 0.04,
    color: W, hi: 'none', anim: 'fade', words: 4, pos: 0.5, active: { outline: true } },
  { id: 'karaoke', name: 'Karaoke', tags: ['minimal', 'insta'], font: 'Montserrat', weight: 700, size: 0.036, lower: true,
    color: '#1A1A1A', hi: 'none', anim: 'fade', words: 3, pos: 0.5, pending: { color: '#EDEDED' },
    pill: { c: 'rgba(196,196,196,.95)', round: 0.35, padX: 0.35, padY: 0.18 } },
  { id: 'notification', name: 'Notification', tags: ['insta'], font: 'Inter', weight: 600, size: 0.05,
    color: '#111', hi: 'none', anim: 'rise', fx: 'notification', words: 4, pos: 0.5 },
  { id: 'mint-punch', name: 'Mint Punch', tags: ['viral', 'insta'], font: 'Archivo Black', weight: 400, size: 0.058, upper: true,
    color: '#7DF2B5', hi: 'none', anim: 'zoom', words: 3, pos: 0.5, glow: 'rgba(80,255,170,.55)' },
  { id: 'popup-chat', name: 'Pop-up Chat', tags: ['insta'], font: 'Montserrat', weight: 700, size: 0.034, lower: true,
    color: W, hi: 'none', anim: 'pop', words: 3, pos: 0.5,
    pill: { c: '#5FE3A1', tail: 'right', shadow: 'rgba(95,227,161,.7)', padX: 0.7, padY: 0.42 } },
  { id: 'popup-chat-left', name: 'Pop-up Chat Left', tags: ['insta'], font: 'Montserrat', weight: 700, size: 0.034, lower: true,
    color: W, hi: 'none', anim: 'pop', words: 3, pos: 0.5, rotate: -5,
    pill: { c: '#5FE3A1', tail: 'left', shadow: 'rgba(95,227,161,.7)', padX: 0.7, padY: 0.42 } },
  { id: 'glowly', name: 'Glowly', tags: ['insta', 'pinterest'], font: 'Montserrat', weight: 800, size: 0.045, lower: true,
    color: '#22E6FF', hi: 'none', anim: 'fade', words: 3, pos: 0.5, glow: 'rgba(0,220,255,.75)' },
  { id: 'shine', name: 'Shine', tags: ['insta', 'minimal'], font: 'Montserrat', weight: 700, size: 0.045, lower: true, spacing: 0.08,
    color: '#2E8BEA', hiColor: '#BFE3FF', hi: 'color', anim: 'fade', words: 3, pos: 0.5 },
  { id: 'fusion', name: 'Fusion', tags: ['insta', 'viral'], font: 'Montserrat', weight: 800, size: 0.045, lower: true,
    color: '#C8FF3A', hi: 'none', anim: 'fade', words: 3, pos: 0.5, roles: [{ gradient: ['#E9FF5A', '#7EDB2E'], gradDir: 'x' }] },
  { id: 'triple', name: 'Triple', tags: ['viral', 'insta'], font: 'Montserrat', weight: 900, size: 0.045, lines: [2, 2, 2], upper: true,
    color: W, hi: 'none', anim: 'pop', words: 6, pos: 0.5, lineGap: 1.05, gap: -0.1,
    roles: [small(0.42), small(0.42), { box: { c: '#C6FF3A', text: '#111', r: 0 } }, { box: { c: '#C6FF3A', text: '#111', r: 0 } }, small(0.42)] },
  { id: 'smooth', name: 'Smooth', tags: ['viral', 'insta'], font: 'Poppins', weight: 700, size: 0.045, lines: [1, 1, 2], title: true,
    color: W, hi: 'none', anim: 'rise', words: 4, pos: 0.5, lineGap: 0.9,
    roles: [small(0.42), { size: 1.6, weight: 800, color: '#FF3355', glow: { c: 'rgba(255,40,80,.6)', b: 0.4 } }, small(0.42)] },
  { id: 'smooth-fusion', name: 'Smooth Fusion', tags: ['viral', 'insta'], font: 'Poppins', weight: 700, size: 0.04, lines: [3, 3, 3], title: true,
    color: W, hi: 'none', anim: 'rise', words: 9, pos: 0.5, lineGap: 0.92,
    roles: [small(0.42), small(0.42), small(0.42), { gradient: ['#F0FF4A', '#7EE04A'], gradDir: 'x' }, { gradient: ['#F0FF4A', '#7EE04A'], gradDir: 'x' },
      { gradient: ['#F0FF4A', '#7EE04A'], gradDir: 'x' }, small(0.42)] },
  { id: 'girly', name: 'Girly', tags: ['pinterest'], font: 'Playfair Display', weight: 700, size: 0.04, lines: [2, 1], lower: true,
    color: '#FFE3EC', hi: 'none', anim: 'fade', words: 3, pos: 0.5, lineGap: 0.9,
    roles: [{}, {}, { ...SCRIPT, size: 1.45, color: W }] },
  { id: 'bubble', name: 'Bubble', tags: ['insta', 'pinterest'], font: 'Fredoka', weight: 700, size: 0.045, lines: [2, 2], title: true,
    color: '#FFD6E8', hi: 'none', anim: 'bounce', words: 4, pos: 0.5, lineGap: 1, stroke: { w: 0.16, c: '#E84D8A' } },
  { id: 'spotlight', name: 'Spotlight', tags: ['viral', 'insta'], font: 'Montserrat', weight: 900, size: 0.045, lines: [2, 1], title: true,
    color: W, hi: 'none', anim: 'zoom', words: 3, pos: 0.5, lineGap: 0.85,
    roles: [{ size: 0.38, weight: 700 }, { size: 0.38, weight: 700 }, { size: 1.5, color: '#6EF2E2' }] },
  { id: 'sticker', name: 'Sticker', tags: ['viral', 'insta'], font: 'Lilita One', weight: 400, size: 0.05, lines: [1, 2], upper: true,
    color: '#E63946', hi: 'none', anim: 'pop', words: 3, pos: 0.5, lineGap: 0.95,
    stroke2: null, roles: [{ size: 1.3, stroke2: { w: 0.42, c: '#1A1A1A' }, stroke: { w: 0.2, c: W } }, { size: 0.5, stroke2: { w: 0.42, c: '#1A1A1A' }, stroke: { w: 0.2, c: W } }] },
  { id: 'ransom-note', name: 'Ransom Note', tags: ['viral', 'insta'], font: 'Anton', weight: 400, size: 0.038, upper: true,
    color: W, hi: 'none', anim: 'none', reveal: 'type', fx: 'ransom', words: 3, pos: 0.5 },
  { id: 'ransom-live', name: 'Ransom Live', tags: ['viral', 'insta'], font: 'Anton', weight: 400, size: 0.034, upper: true,
    color: W, hi: 'none', anim: 'none', reveal: 'type', fx: 'ransomLive', words: 4, pos: 0.5 },
  { id: 'torn-paper', name: 'Torn Paper', tags: ['insta', 'pinterest'], font: 'Poppins', weight: 800, size: 0.04, title: true,
    color: W, hi: 'none', anim: 'slide', words: 4, pos: 0.5, stroke: { w: 0.26, c: '#A23E7A' }, shadow: { c: 'rgba(0,0,0,.6)', b: 0.1, x: 0.04, y: 0.06 } },
  { id: 'glow', name: 'Glow', tags: ['pinterest', 'minimal'], font: 'Montserrat', weight: 500, size: 0.04, lower: true,
    color: W, hi: 'none', anim: 'fade', words: 3, pos: 0.5,
    roles: [{}, {}, { ...SERIF_I, weight: 700, size: 1.2, glow: { c: 'rgba(255,255,255,.9)', b: 0.45 } }] },
  { id: 'gilded', name: 'Gilded', tags: ['pinterest'], font: 'Abril Fatface', weight: 400, size: 0.03, lines: [1, 5],
    color: '#F3E7A6', hi: 'none', anim: 'rise', words: 6, pos: 0.5, lineGap: 1.05,
    roles: [{ size: 2.4, upper: true }, { lower: true }] },
  { id: 'pill', name: 'Pill', tags: ['minimal', 'insta'], font: 'Montserrat', weight: 800, size: 0.045, upper: true,
    color: W, hi: 'none', anim: 'pop', words: 1, pos: 0.5, pill: { c: '#5E7F45', padX: 0.55, padY: 0.25 } },
  { id: 'cook', name: 'Cook', tags: ['viral'], font: 'Montserrat', weight: 900, size: 0.085, upper: true, spacing: 0.02,
    color: W, hi: 'none', anim: 'zoom', fx: 'videoFill', words: 1, pos: 0.5 },
  { id: 'estate', name: 'Estate', tags: ['viral', 'insta'], font: 'Montserrat', weight: 900, size: 0.085, title: true,
    color: W, hi: 'none', anim: 'zoom', words: 1, pos: 0.55,
    roles: [{ gradient: ['#FFFFFF', '#CFE0FF', '#5C8DFF'], extrude: { c: '#1B2C66', d: 0.06 } }] },
  { id: 'estate-2', name: 'Estate 2', tags: ['viral', 'insta'], font: 'Montserrat', weight: 900, size: 0.08, layout: 'stack', title: true,
    color: '#D41BD9', hi: 'none', anim: 'zoom', words: 2, pos: 0.55, lineGap: 0.8,
    roles: [{ extrude: { c: '#4A0B4F', d: 0.06 } }, { size: 0.28, color: W, lower: true, title: false }] },
  { id: 'estate-3', name: 'Estate 3', tags: ['viral', 'insta'], font: 'Montserrat', weight: 900, size: 0.085, title: true,
    color: '#F2B531', hi: 'none', anim: 'zoom', words: 1, pos: 0.55,
    roles: [{ gradient: ['#FFE9A8', '#F2B531', '#B87A10'], extrude: { c: '#5A3A00', d: 0.06 } }] },
  { id: 'estate-4', name: 'Estate 4', tags: ['viral', 'insta'], font: 'Montserrat', weight: 900, size: 0.06, lines: [2, 2, 1], lower: true,
    color: W, hi: 'none', anim: 'rise', words: 5, pos: 0.55, lineGap: 0.85,
    roles: [small(0.6), small(0.6), small(0.6), small(0.6), { size: 1.25, title: true, color: '#2EE04A', extrude: { c: '#0A5A12', d: 0.06 } }] },

  // ---- More styles ----
  { id: 'high-contrast', name: 'High Contrast', tags: ['minimal'], font: 'Inter', weight: 800, size: 0.05,
    color: '#FFFF00', hi: 'none', anim: 'none', words: 6, pos: 0.82, bg: { c: 'rgba(0,0,0,.92)', pad: 0.32, r: 0.08 } },
  // ---- Trending (2026): popular Reels/Shorts looks, made with this renderer ----
  { id: 'green-box', name: 'Green Box', tags: ['trending', 'viral', 'insta'], font: 'Montserrat', weight: 900, size: 0.064, upper: true,
    color: '#ffffff', hiColor: '#22C55E', boxText: '#0b0b0b', hi: 'box', stroke: { w: 0.12, c: '#000000' }, anim: 'pop', words: 3 },
  { id: 'emoji-pop', name: 'Emoji Pop', tags: ['trending', 'viral', 'insta'], font: 'Poppins', weight: 800, size: 0.06,
    color: '#ffffff', hiColor: '#FFE600', hi: 'scale', stroke: { w: 0.13, c: '#000000' }, anim: 'pop', words: 3, emoji: true },
  { id: 'gradient-pop', name: 'Gradient Pop', tags: ['trending', 'insta'], font: 'Montserrat', weight: 900, size: 0.064, upper: true,
    color: '#ffffff', hi: 'none', stroke: { w: 0.1, c: '#1a0633' }, anim: 'pop', words: 3,
    active: { gradient: ['#FF5EDB', '#8B5CF6', '#22D3EE'], pop: true } },
  { id: 'beast-bold', name: 'Beast Bold', tags: ['trending', 'viral'], font: 'Luckiest Guy', weight: 400, size: 0.085, upper: true,
    color: '#ffffff', hiColor: '#FFE600', hi: 'scale', stroke: { w: 0.22, c: '#000000' }, shadow: { c: 'rgba(0,0,0,.65)', b: 0.12, x: 0, y: 0.08 }, anim: 'bounce', words: 2 },
  { id: 'one-line-sub', name: 'One Line Sub', tags: ['trending', 'minimal'], font: 'Poppins', weight: 700, size: 0.042,
    color: '#ffffff', hiColor: '#FFD400', hi: 'color', shadow: { c: 'rgba(0,0,0,.75)', b: 0.25, x: 0, y: 0.04 }, anim: 'fade', words: 7, oneLine: true, pos: 0.8 },
  { id: 'viral-pop', name: 'Viral Pop', tags: ['trending', 'viral', 'insta'], font: 'Montserrat', weight: 900, size: 0.068, upper: true,
    color: '#ffffff', hiColor: '#FFE600', hi: 'scale', stroke: { w: 0.14, c: '#000000' }, anim: 'pop', words: 3 },
  { id: 'neon-box', name: 'Neon Box', tags: ['viral', 'insta'], font: 'Montserrat', weight: 800, size: 0.062, upper: true,
    color: '#ffffff', hiColor: '#7C3AED', boxText: '#ffffff', hi: 'box', stroke: { w: 0.1, c: '#000000' }, anim: 'pop', words: 3 },
  { id: 'bold-anton', name: 'Bold Anton', tags: ['viral', 'insta'], font: 'Anton', weight: 400, size: 0.08, upper: true,
    color: '#ffffff', hiColor: '#22FF88', hi: 'color', stroke: { w: 0.16, c: '#000000' }, anim: 'bounce', words: 2 },
  { id: 'karaoke-gold', name: 'Karaoke Gold', tags: ['trending', 'viral', 'insta'], font: 'Poppins', weight: 800, size: 0.055,
    color: '#ffffff', hiColor: '#FFD400', hi: 'karaoke', stroke: { w: 0.12, c: '#000000' }, anim: 'fade', words: 5 },
  { id: 'one-word', name: 'One Word Punch', tags: ['trending', 'viral', 'insta'], font: 'Bebas Neue', weight: 400, size: 0.12, upper: true,
    color: '#ffffff', hi: 'none', stroke: { w: 0.08, c: '#000000' }, shadow: { c: 'rgba(0,0,0,.6)', b: 0.2, x: 0, y: 0.06 }, anim: 'pop', words: 1 },
  { id: 'comic-burst', name: 'Comic Burst', tags: ['viral'], font: 'Bangers', weight: 400, size: 0.08, upper: true, spacing: 0.03,
    color: '#FFE600', hiColor: '#FF3B30', hi: 'scale', stroke: { w: 0.16, c: '#000000' }, rotate: -3, anim: 'bounce', words: 3 },
  { id: 'luckiest', name: 'Lucky Bubble', tags: ['viral', 'insta'], font: 'Luckiest Guy', weight: 400, size: 0.072, upper: true,
    color: '#ffffff', hiColor: '#00E5FF', hi: 'color', stroke: { w: 0.18, c: '#000000' }, anim: 'pop', words: 2 },
  { id: 'bungee-block', name: 'Bungee Block', tags: ['viral', 'insta'], font: 'Bungee', weight: 400, size: 0.058, upper: true,
    color: '#ffffff', hiColor: '#FF2D55', boxText: '#ffffff', hi: 'box', stroke: { w: 0.08, c: '#000000' }, anim: 'pop', words: 3 },
  { id: 'glow-neon', name: 'Glow Neon', tags: ['insta', 'pinterest'], font: 'Montserrat', weight: 800, size: 0.06, upper: true,
    color: '#ffffff', hiColor: '#FF00E5', hi: 'color', glow: '#00F0FF', anim: 'fade', words: 3 },
  { id: 'retro-groove', name: 'Retro Groove', tags: ['insta', 'pinterest'], font: 'Righteous', weight: 400, size: 0.066,
    color: '#FFB703', hiColor: '#FB5607', hi: 'color', stroke: { w: 0.1, c: '#3D1600' },
    shadow: { c: '#3D1600', b: 0, x: 0.06, y: 0.06 }, anim: 'bounce', words: 3 },
  { id: 'breaking', name: 'Breaking Bar', tags: ['viral', 'minimal'], font: 'Oswald', weight: 600, size: 0.05, upper: true,
    color: '#ffffff', hi: 'none', bg: { c: '#E11D48', pad: 0.25, r: 0.08 }, anim: 'slide', words: 5 },
  { id: 'clean-sub', name: 'Clean Subtitle', tags: ['minimal'], font: 'Inter', weight: 600, size: 0.04,
    color: '#ffffff', hi: 'none', bg: { c: 'rgba(0,0,0,.65)', pad: 0.3, r: 0.2 }, anim: 'fade', words: 7, pos: 0.84 },
  { id: 'cinema', name: 'Cinema', tags: ['minimal'], font: 'Inter', weight: 600, size: 0.04,
    color: '#ffffff', hi: 'none', shadow: { c: 'rgba(0,0,0,.9)', b: 0.15, x: 0, y: 0.04 }, anim: 'fade', words: 8, pos: 0.88 },
  { id: 'minimal-lower', name: 'Minimal Lower', tags: ['minimal', 'pinterest'], font: 'Inter', weight: 500, size: 0.042, lower: true,
    color: '#ffffff', hiColor: '#ffffff', hi: 'karaoke', dim: 0.55, shadow: { c: 'rgba(0,0,0,.7)', b: 0.2, x: 0, y: 0.03 }, anim: 'fade', words: 5 },
  { id: 'typewriter', name: 'Typewriter', tags: ['minimal', 'pinterest'], font: 'Space Mono', weight: 700, size: 0.042,
    color: '#ffffff', hi: 'none', bg: { c: '#000000', pad: 0.3, r: 0.05 }, anim: 'type', words: 5 },
  { id: 'aesthetic-serif', name: 'Aesthetic Serif', tags: ['pinterest', 'insta'], font: 'Playfair Display', weight: 700, italic: true, size: 0.06, lower: true,
    color: '#ffffff', hi: 'none', shadow: { c: 'rgba(0,0,0,.5)', b: 0.3, x: 0, y: 0.03 }, anim: 'fade', words: 4 },
  { id: 'pastel-pin', name: 'Pastel Pin', tags: ['pinterest'], font: 'Poppins', weight: 700, size: 0.048,
    color: '#3B2F2F', hi: 'none', bg: { c: '#FDE2E4', pad: 0.35, r: 0.5 }, anim: 'slide', words: 4 },
  { id: 'handwritten', name: 'Handwritten', tags: ['pinterest'], font: 'Caveat', weight: 700, size: 0.08,
    color: '#ffffff', hi: 'none', shadow: { c: 'rgba(0,0,0,.6)', b: 0.2, x: 0, y: 0.04 }, anim: 'type', words: 4 },
  { id: 'marker-note', name: 'Marker Note', tags: ['pinterest', 'insta'], font: 'Permanent Marker', weight: 400, size: 0.055,
    color: '#111111', hi: 'none', bg: { c: '#FFE66D', pad: 0.3, r: 0.06 }, rotate: -2, anim: 'slide', words: 4 },
  { id: 'pacifico-sunset', name: 'Sunset Script', tags: ['pinterest', 'insta'], font: 'Pacifico', weight: 400, size: 0.06,
    color: '#ffffff', hi: 'none', shadow: { c: '#FF6B6B', b: 0, x: 0.05, y: 0.05 }, anim: 'fade', words: 3 },
  // Devanagari-first styles for Hindi captions
  { id: 'desi-bold', name: 'Desi Bold', tags: ['hindi', 'viral'], font: 'Baloo 2', weight: 800, size: 0.07,
    color: '#ffffff', hiColor: '#FF9933', hi: 'scale', stroke: { w: 0.14, c: '#000000' }, anim: 'pop', words: 3 },
  { id: 'rozha-royal', name: 'Rozha Royal', tags: ['hindi', 'pinterest'], font: 'Rozha One', weight: 400, size: 0.07,
    color: '#FFD166', hi: 'none', shadow: { c: 'rgba(0,0,0,.7)', b: 0.2, x: 0, y: 0.04 }, anim: 'fade', words: 3 },
  { id: 'yatra-vibes', name: 'Yatra Vibes', tags: ['hindi', 'insta'], font: 'Yatra One', weight: 400, size: 0.066,
    color: '#ffffff', hiColor: '#138808', boxText: '#ffffff', hi: 'box', stroke: { w: 0.1, c: '#000000' }, anim: 'pop', words: 3 },
  { id: 'kalam-diary', name: 'Kalam Diary', tags: ['hindi', 'pinterest'], font: 'Kalam', weight: 700, size: 0.06,
    color: '#ffffff', hi: 'none', shadow: { c: 'rgba(0,0,0,.6)', b: 0.2, x: 0, y: 0.04 }, anim: 'type', words: 4 },
  { id: 'teko-sports', name: 'Teko Sports', tags: ['hindi', 'viral'], font: 'Teko', weight: 600, size: 0.1, upper: true,
    color: '#ffffff', hiColor: '#C6FF00', hi: 'color', stroke: { w: 0.1, c: '#000000' }, anim: 'bounce', words: 2 },
  { id: 'mukta-clean', name: 'Mukta Karaoke', tags: ['hindi', 'minimal'], font: 'Mukta', weight: 800, size: 0.05,
    color: '#ffffff', hiColor: '#FFD400', hi: 'karaoke', bg: { c: 'rgba(0,0,0,.6)', pad: 0.3, r: 0.25 }, anim: 'fade', words: 5 },
];

export const TAGS = [
  { id: 'all', name: 'All' },
  { id: 'trending', name: '🔥 Trending' },
  { id: 'viral', name: 'Viral' },
  { id: 'insta', name: 'Instagram' },
  { id: 'pinterest', name: 'Pinterest' },
  { id: 'hindi', name: 'Hindi' },
  { id: 'minimal', name: 'Minimal' },
];

export const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Anton&family=Archivo+Black&family=Bangers&family=Bebas+Neue&family=Bungee' +
  '&family=Dancing+Script:wght@700&family=Fredoka:wght@700&family=Great+Vibes&family=Lilita+One' +
  '&family=Baloo+2:wght@700;800&family=Caveat:wght@700&family=Inter:wght@400;500;600;800&family=Kalam:wght@700' +
  '&family=Lato:wght@700&family=Luckiest+Guy&family=Montserrat:ital,wght@0,500;0,600;0,700;0,800;0,900;1,800;1,900&family=Mukta:wght@800&family=Noto+Sans+Arabic:wght@700' +
  '&family=Noto+Sans+Bengali:wght@700&family=Noto+Sans+Devanagari:wght@700&family=Noto+Sans+Tamil:wght@700' +
  '&family=Noto+Sans+Gujarati:wght@700&family=Noto+Sans+Gurmukhi:wght@700&family=Noto+Sans+Kannada:wght@700' +
  '&family=Noto+Sans+Malayalam:wght@700&family=Noto+Sans+Oriya:wght@700&family=Noto+Sans+Telugu:wght@700' +
  '&family=Oswald:wght@600&family=Pacifico&family=Permanent+Marker&family=Playfair+Display:ital,wght@0,700;1,700;1,800' +
  '&family=Poppins:wght@700;800&family=Righteous&family=Rozha+One&family=Space+Mono:wght@700&family=Teko:wght@600' +
  '&family=Yatra+One&display=swap';

// Fallbacks so any script (Hindi, Arabic, Bengali, Tamil…) still renders inside a Latin-only font.
const FALLBACK = `'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans Gujarati', 'Noto Sans Gurmukhi', 'Noto Sans Tamil', 'Noto Sans Telugu', 'Noto Sans Kannada', 'Noto Sans Malayalam', 'Noto Sans Oriya', 'Noto Sans Arabic', sans-serif`;

export function fontString(tpl, px) {
  return `${tpl.italic ? 'italic ' : ''}${tpl.weight} ${Math.round(px)}px '${tpl.font}', ${FALLBACK}`;
}

export async function loadTemplateFonts() {
  if (!document.fonts) return;
  // Every font any template, role or state uses.
  const seen = new Set();
  const want = [];
  const add = st => { if (!st || !st.font) return; const k = fontString(st, 40); if (!seen.has(k)) { seen.add(k); want.push(k); } };
  TEMPLATES.forEach(t => {
    add(t);
    [...(t.roles || []), t.active, t.pending, t.past].forEach(r => r && add({ font: r.font || t.font, weight: r.weight ?? t.weight, italic: r.italic ?? t.italic }));
  });
  ['Anton', 'Archivo Black', 'Playfair Display', 'Bangers', 'Space Mono', 'Bebas Neue', 'Luckiest Guy', 'Inter'].forEach(f => add({ font: f, weight: 700 }));
  const loads = want.map(f => document.fonts.load(f, 'Aaअ').catch(() => {}));
  SAMPLES.forEach(l => { if (l.font) loads.push(document.fonts.load(`700 40px '${l.font}'`, l.text).catch(() => {})); });
  loads.push(document.fonts.load(`700 40px 'Noto Sans Arabic'`, 'ا').catch(() => {}));
  await Promise.all(loads);
}

// Preview text per script, so creators can see how each style sets their language.
export const SAMPLES = [
  { id: 'en', name: 'English', text: 'this is how your reels go viral every single time' },
  { id: 'hi', en: 'Hindi', name: 'हिन्दी', font: 'Noto Sans Devanagari', text: 'ऐसे होगी आपकी रील हर बार वायरल' },
  { id: 'gu', en: 'Gujarati', name: 'ગુજરાતી', font: 'Noto Sans Gujarati', text: 'આ રીતે તમારી રીલ દરેક વખતે વાયરલ થશે' },
  { id: 'mr', en: 'Marathi', name: 'मराठी', font: 'Noto Sans Devanagari', text: 'अशी तुमची रील प्रत्येक वेळी व्हायरल होईल' },
  { id: 'bn', en: 'Bengali', name: 'বাংলা', font: 'Noto Sans Bengali', text: 'এভাবেই তোমার রিল প্রতিবার ভাইরাল হবে' },
  { id: 'ta', en: 'Tamil', name: 'தமிழ்', font: 'Noto Sans Tamil', text: 'இப்படித்தான் உங்கள் ரீல் வைரலாகும்' },
  { id: 'te', en: 'Telugu', name: 'తెలుగు', font: 'Noto Sans Telugu', text: 'ఇలా మీ రీల్ ప్రతిసారీ వైరల్ అవుతుంది' },
  { id: 'kn', en: 'Kannada', name: 'ಕನ್ನಡ', font: 'Noto Sans Kannada', text: 'ಹೀಗೆ ನಿಮ್ಮ ರೀಲ್ ಪ್ರತಿ ಬಾರಿ ವೈರಲ್ ಆಗುತ್ತದೆ' },
  { id: 'ml', en: 'Malayalam', name: 'മലയാളം', font: 'Noto Sans Malayalam', text: 'ഇങ്ങനെ നിങ്ങളുടെ റീൽ വൈറലാകും' },
  { id: 'pa', en: 'Punjabi', name: 'ਪੰਜਾਬੀ', font: 'Noto Sans Gurmukhi', text: 'ਇਸ ਤਰ੍ਹਾਂ ਤੁਹਾਡੀ ਰੀਲ ਹਰ ਵਾਰ ਵਾਇਰਲ ਹੋਵੇਗੀ' },
  { id: 'or', en: 'Odia', name: 'ଓଡ଼ିଆ', font: 'Noto Sans Oriya', text: 'ଏହିପରି ତୁମର ରିଲ୍ ପ୍ରତିଥର ଭାଇରାଲ୍ ହେବ' },
];
