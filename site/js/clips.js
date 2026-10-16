// Long video → short clips. Finds the moments most likely to work as Reels/Shorts from the transcript:
// whole sentences only, a strong opening line (the hook), fast and dense speech, few pauses, a length
// that suits Shorts. Pure functions (tested in Node). An AI pass can re-rank them when the site owner
// has switched it on (see netlify/functions/clips.mjs); this is the free, on-device version.

// Words that make people stop scrolling, in English, Hinglish and Hindi.
const HOOK_WORDS = new Set(`
secret secrets mistake mistakes never always why how what truth nobody everyone stop best worst
money rich poor free biggest hack hacks easy fast simple real fake shocking crazy insane actually
problem problems reason reasons trick tricks rule rules warning important exactly only must need
you your lakh lakhs crore crores rupees paisa paise salary profit loss business success fail failed
galti galtiyan sach jhooth raaz kabhi kyun kyon kaise kya sabse mat zaroor dhoka sikho seekho
log logo paise kamao kamana asli nakli suno dekho samjho matlab bilkul sirf pehle baad
गलती सच झूठ राज़ राज कभी क्यों कैसे क्या सबसे मत ज़रूर जरूर धोखा सीखो पैसा पैसे लाख करोड़ असली सिर्फ़ सिर्फ
`.trim().split(/\s+/));

const norm = w => String(w).toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

/** Words (with times) from caption segments, in order. */
export function wordsOf(segments) {
  const out = [];
  for (const s of segments || []) for (const w of s.words || []) if (String(w.text).trim()) out.push({ text: String(w.text).trim(), start: +w.start, end: +w.end });
  return out; // caption order: overlapping captions (e.g. from an SRT) must not interleave their words
}

/** Group words into sentences: end punctuation, or a pause of `gap` seconds. */
export function sentences(words, gap = 0.7) {
  const out = [];
  let cur = [];
  const push = () => { if (cur.length) out.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur, text: cur.map(w => w.text).join(' ') }); cur = []; };
  words.forEach((w, i) => {
    const next = words[i + 1];
    cur.push(w);
    if (/[.!?।…]["')\]]?$/.test(w.text) || !next || next.start - w.end > gap) push();
  });
  return out;
}

/** 0..1: how much a line sounds like a hook. */
export function hookScore(text) {
  const ws = String(text).split(/\s+/).map(norm).filter(Boolean);
  if (!ws.length) return 0;
  let s = 0;
  if (/\?/.test(text)) s += 0.35;
  if (/\d/.test(text)) s += 0.2;
  const hits = ws.filter(w => HOOK_WORDS.has(w)).length;
  s += Math.min(0.45, hits * 0.15);
  if (ws.length >= 4 && ws.length <= 16) s += 0.1; // short, punchy
  return Math.min(1, s);
}

/** A short on-screen hook title for a clip: its most hook-like early sentence, at most `maxWords`. */
export function hookTitle(clipSentences, maxWords = 9) {
  const early = clipSentences.filter(s => s.start - clipSentences[0].start < 12);
  const best = early.reduce((a, b) => (hookScore(b.text) > hookScore(a.text) ? b : a), early[0] || clipSentences[0]);
  if (!best) return '';
  let ws = best.text.replace(/\s+/g, ' ').trim().split(' ');
  const cut = ws.length > maxWords;
  ws = ws.slice(0, maxWords);
  let t = ws.join(' ').replace(/[,;:–-]+$/, '');
  if (cut && !/[.!?…]$/.test(t)) t += '…';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Up to `n` different hook lines for a clip, taken from what is actually said in its first seconds. */
export function hookOptions(clipSentences, n = 3, maxWords = 9) {
  const early = clipSentences.filter(x => x.start - clipSentences[0].start < 15);
  const ranked = [...early].sort((a, b) => hookScore(b.text) - hookScore(a.text));
  const out = [];
  for (const sn of ranked) {
    const t = hookTitle([sn], maxWords);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= n) break;
  }
  return out;
}

/**
 * Find the best clips.
 * @param {Array} segments  caption segments ({ words: [{ text, start, end }] })
 * @param {{ minLen?, maxLen?, ideal?, count?, energy?: (start, end) => number (0..1) }} o
 * @returns {Array<{ start, end, score, title, text, why }>} best first, never overlapping
 */
export function findClips(segments, { minLen = 15, maxLen = 60, ideal = 35, count = 8, energy } = {}) {
  const sents = sentences(wordsOf(segments));
  if (!sents.length) return [];
  const cands = [];
  for (let i = 0; i < sents.length; i++) {
    for (let j = i; j < sents.length; j++) {
      const start = sents[i].start, end = sents[j].end, len = end - start;
      if (len > maxLen) break;
      if (len < minLen) continue;
      const part = sents.slice(i, j + 1), words = part.flatMap(s => s.words);
      // Pauses inside the clip (dead air loses viewers).
      let pause = 0;
      for (let k = 1; k < words.length; k++) pause += Math.max(0, words[k].start - words[k - 1].end - 0.35);
      const wps = words.length / len;
      const hook = hookScore(part[0].text) * 0.7 + hookScore(part.slice(0, 2).map(s => s.text).join(' ')) * 0.3;
      const keywords = words.filter(w => HOOK_WORDS.has(norm(w.text))).length / words.length;
      const pace = Math.max(0, 1 - Math.abs(wps - 3) / 2); // ~3 words/s feels lively
      const fit = Math.exp(-(((len - ideal) / (maxLen - minLen || 1)) ** 2) * 3);
      const ends = /[.!?।…]["')\]]?$/.test(part[part.length - 1].text) ? 1 : 0.6;
      const loud = energy ? energy(start, end) : 0.5;
      // Ending on a strong line (a payoff) beats trailing off into filler.
      const tail = Math.min(1, hookScore(part[part.length - 1].text) * 1.5);
      const score = hook * 0.34 + pace * 0.16 + Math.min(1, keywords * 6) * 0.14 + fit * 0.08 + tail * 0.08 + ends * 0.06 + loud * 0.08 + (1 - Math.min(1, pause / len * 4)) * 0.06;
      const why = [];
      if (hook >= 0.45) why.push('strong opening line');
      if (pace >= 0.7) why.push('fast, lively speech');
      if (keywords >= 0.06) why.push('lots of hook words');
      if (pause / len < 0.05) why.push('no dead air');
      if (ends === 1) why.push('ends on a full sentence');
      cands.push({ start, end, score, part, why });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const c of cands) {
    if (picked.length >= count) break;
    if (picked.some(p => Math.min(p.end, c.end) - Math.max(p.start, c.start) > 0.2 * Math.min(p.end - p.start, c.end - c.start))) continue;
    picked.push(c);
  }
  const top = picked.length ? picked[0].score : 1;
  return picked.map(c => ({
    start: +c.start.toFixed(2), end: +c.end.toFixed(2),
    score: Math.round(Math.min(99, 50 + 49 * (c.score / (top || 1)) * Math.min(1, c.score * 1.6))),
    title: hookTitle(c.part), hooks: hookOptions(c.part), text: c.part.map(s => s.text).join(' '), why: c.why,
  }));
}

export const ASPECTS = { '9:16': 9 / 16, '1:1': 1, '16:9': 16 / 9 };
/** Output size for an aspect ratio (long side 1920, or 1080 for square). */
export const aspectSize = a => (a === '1:1' ? { w: 1080, h: 1080 } : a === '16:9' ? { w: 1920, h: 1080 } : { w: 1080, h: 1920 });

/** Crop rectangle (source pixels) for an output aspect ratio, `x` = 0 (left) … 1 (right). */
export function cropRect(vw, vh, aspect = 9 / 16, x = 0.5) {
  if (!vw || !vh) return { sx: 0, sy: 0, sw: vw, sh: vh };
  if (vw / vh > aspect) { const sw = Math.round(vh * aspect); return { sx: Math.round((vw - sw) * Math.min(1, Math.max(0, x))), sy: 0, sw, sh: vh }; }
  const sh = Math.round(vw / aspect);
  return { sx: 0, sy: Math.round((vh - sh) / 2), sw: vw, sh };
}
