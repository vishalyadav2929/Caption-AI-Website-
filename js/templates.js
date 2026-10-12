// Caption style presets. Sizes are fractions of the frame; stroke width is a fraction of font size.
// hi: highlight mode for the spoken word — color | box | scale | karaoke | none
// anim: how a caption group enters — pop | bounce | slide | fade | type | none

export const TEMPLATES = [
  { id: 'viral-pop', name: 'Viral Pop', tags: ['viral', 'insta'], font: 'Montserrat', weight: 900, size: 0.068, upper: true,
    color: '#ffffff', hiColor: '#FFE600', hi: 'scale', stroke: { w: 0.14, c: '#000000' }, anim: 'pop', words: 3 },
  { id: 'neon-box', name: 'Neon Box', tags: ['viral', 'insta'], font: 'Montserrat', weight: 800, size: 0.062, upper: true,
    color: '#ffffff', hiColor: '#7C3AED', boxText: '#ffffff', hi: 'box', stroke: { w: 0.1, c: '#000000' }, anim: 'pop', words: 3 },
  { id: 'bold-anton', name: 'Bold Anton', tags: ['viral', 'insta'], font: 'Anton', weight: 400, size: 0.08, upper: true,
    color: '#ffffff', hiColor: '#22FF88', hi: 'color', stroke: { w: 0.16, c: '#000000' }, anim: 'bounce', words: 2 },
  { id: 'karaoke-gold', name: 'Karaoke Gold', tags: ['viral', 'insta'], font: 'Poppins', weight: 800, size: 0.055,
    color: '#ffffff', hiColor: '#FFD400', hi: 'karaoke', stroke: { w: 0.12, c: '#000000' }, anim: 'fade', words: 5 },
  { id: 'one-word', name: 'One Word Punch', tags: ['viral', 'insta'], font: 'Bebas Neue', weight: 400, size: 0.12, upper: true,
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
  { id: 'viral', name: 'Viral' },
  { id: 'insta', name: 'Instagram' },
  { id: 'pinterest', name: 'Pinterest' },
  { id: 'hindi', name: 'Hindi' },
  { id: 'minimal', name: 'Minimal' },
];

export const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Anton&family=Bangers&family=Bebas+Neue&family=Bungee' +
  '&family=Baloo+2:wght@700;800&family=Caveat:wght@700&family=Inter:wght@400;500;600;800&family=Kalam:wght@700' +
  '&family=Luckiest+Guy&family=Montserrat:wght@800;900&family=Mukta:wght@800&family=Noto+Sans+Arabic:wght@700' +
  '&family=Noto+Sans+Bengali:wght@700&family=Noto+Sans+Devanagari:wght@700&family=Noto+Sans+Tamil:wght@700' +
  '&family=Oswald:wght@600&family=Pacifico&family=Permanent+Marker&family=Playfair+Display:ital,wght@1,700' +
  '&family=Poppins:wght@700;800&family=Righteous&family=Rozha+One&family=Space+Mono:wght@700&family=Teko:wght@600' +
  '&family=Yatra+One&display=swap';

// Fallbacks so any script (Hindi, Arabic, Bengali, Tamil…) still renders inside a Latin-only font.
const FALLBACK = `'Noto Sans Devanagari', 'Noto Sans Arabic', 'Noto Sans Bengali', 'Noto Sans Tamil', sans-serif`;

export function fontString(tpl, px) {
  return `${tpl.italic ? 'italic ' : ''}${tpl.weight} ${Math.round(px)}px '${tpl.font}', ${FALLBACK}`;
}

export async function loadTemplateFonts() {
  if (!document.fonts) return;
  const loads = TEMPLATES.map(t => document.fonts.load(fontString(t, 40), 'Aaअ').catch(() => {}));
  ['Noto Sans Devanagari', 'Noto Sans Arabic', 'Noto Sans Bengali', 'Noto Sans Tamil'].forEach(f =>
    loads.push(document.fonts.load(`700 40px '${f}'`, 'अاঅஅ').catch(() => {})));
  await Promise.all(loads);
}
