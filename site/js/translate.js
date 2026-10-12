// Caption translation helpers that work in every browser.
// Chrome's on-device Translator is used when present (see app.js); everywhere else (iPhone Safari,
// Firefox, Android) the free MyMemory service is used. It needs no key and only receives caption text.

// Which language is the caption text actually in? Judged from its script, not from the language the
// user picked: Whisper sometimes writes English even when Hindi was chosen.
const SCRIPTS = [
  [/[ऀ-ॿ]/, 'deva'], [/[ঀ-৿]/, 'bn'], [/[਀-੿]/, 'pa'], [/[઀-૿]/, 'gu'],
  [/[଀-୿]/, 'or'], [/[஀-௿]/, 'ta'], [/[ఀ-౿]/, 'te'], [/[ಀ-೿]/, 'kn'],
  [/[ഀ-ൿ]/, 'ml'], [/[฀-๿]/, 'th'], [/[가-힯]/, 'ko'], [/[぀-ヿ]/, 'ja'],
  [/[一-鿿]/, 'zh'], [/[؀-ۿ]/, 'arab'], [/[Ѐ-ӿ]/, 'cyrl'], [/[A-Za-zÀ-ɏ]/, 'latn'],
];
const LATIN = new Set(['en', 'es', 'fr', 'de', 'pt', 'it', 'tr', 'id', 'vi', 'nl', 'pl', 'sw']);

/** @param {string} text  @param {string|null} hint  code of the language the user picked (e.g. 'hi') */
export function detectTextLang(text, hint) {
  const counts = {};
  for (const ch of String(text)) {
    for (const [re, k] of SCRIPTS) if (re.test(ch)) { counts[k] = (counts[k] || 0) + 1; break; }
  }
  const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  if (!top) return hint || null;
  if (top === 'deva') return ['hi', 'mr', 'ne'].includes(hint) ? hint : 'hi';
  if (top === 'arab') return ['ur', 'fa', 'ar'].includes(hint) ? hint : 'ar';
  if (top === 'cyrl') return hint === 'uk' ? 'uk' : 'ru';
  if (top === 'latn') return LATIN.has(hint) ? hint : 'en';
  return top;
}

// Small models sometimes write Hindi speech as rough Roman letters ("namaste dosto") rather than
// English. Only real English (lots of common English words) should be auto-translated.
const EN_WORDS = new Set('the a an and or to of in on is are was were i you he she it we they this that my your for with be have do not will at so but what all can just'.split(' '));
export function looksEnglish(text) {
  const w = String(text).toLowerCase().match(/[a-z']+/g) || [];
  return w.length > 0 && w.filter(x => EN_WORDS.has(x)).length / w.length >= 0.15;
}

/** Split text into pieces the service accepts (its limit is 500 bytes), breaking between words. */
export function splitForService(text, maxBytes = 450) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '';
  for (const w of String(text).split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && enc.encode(next).length > maxBytes) { out.push(cur); cur = w; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

const decode = s => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Translate with MyMemory (free, no key, CORS enabled). Throws a readable error on quota or failure. */
export async function onlineTranslate(text, src, tgt, fetchFn = globalThis.fetch) {
  const parts = [];
  for (const piece of splitForService(text)) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(piece)}&langpair=${src}|${tgt}`;
    let r;
    try { r = await fetchFn(url); } catch { throw new Error('No internet connection to the translation service.'); }
    if (r.status === 429) throw new Error('The free translation limit for today is used up. Try again tomorrow.');
    if (!r.ok) throw new Error(`Translation service error (${r.status}).`);
    const j = await r.json();
    const out = j && j.responseData && j.responseData.translatedText;
    if (/MYMEMORY WARNING|USED ALL AVAILABLE FREE/i.test(out || '')) throw new Error('The free translation limit for today is used up. Try again tomorrow.');
    if (Number(j.responseStatus) !== 200 || !out) throw new Error(j.responseDetails || 'The translation service gave no result.');
    parts.push(decode(out).trim());
  }
  return parts.join(' ');
}
