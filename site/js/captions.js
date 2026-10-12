// Caption data model. Pure functions only — no DOM — so they run in the browser and in Node tests.
//
// A segment is one on-screen caption:
//   { id, start, end, words: [{ text, start, end }], approx }
// `approx` is true when word times were estimated (text edited, SRT import, or a model
// that only returned sentence-level times) rather than measured by the speech model.

let nextId = 1;
const newId = () => nextId++;
const round = n => Math.round(n * 1000) / 1000;

export const MIN_DUR = 0.2;

export function spreadWords(text, start, end) {
  const parts = String(text).split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  const step = (end - start) / parts.length;
  return parts.map((p, i) => ({ text: p, start: round(start + i * step), end: round(start + (i + 1) * step) }));
}

export function makeSegment(words, approx = false) {
  return { id: newId(), start: words[0].start, end: words[words.length - 1].end, words, approx };
}

export const segmentText = seg => seg.words.map(w => w.text).join(' ');

/** Group timed words into captions of at most `maxWords` words / `maxChars` characters. */
export function segmentsFromWords(words, maxWords = 3, maxChars = 32, approx = false) {
  const out = [];
  let cur = [], chars = 0;
  const flush = () => { if (cur.length) out.push(makeSegment(cur, approx || cur.some(w => w.approx))); cur = []; chars = 0; };
  words.forEach(w => {
    const prev = cur[cur.length - 1];
    if (cur.length && (cur.length >= maxWords || chars + w.text.length > maxChars || w.start - prev.end > 0.7)) flush();
    cur.push({ text: w.text, start: w.start, end: w.end, ...(w.approx ? { approx: true } : {}) });
    chars += w.text.length + 1;
    if (maxWords > 1 && /[.!?।|]$/.test(w.text)) flush();
  });
  flush();
  return out;
}

export function flattenWords(segments) {
  return segments.flatMap(s => s.words.map(w => (s.approx ? { ...w, approx: true } : w)));
}

/** Re-group all words with a new words-per-caption limit, keeping every word's timing. */
export function rechunk(segments, maxWords) {
  return segmentsFromWords(flattenWords(segments), maxWords);
}

/** Split n words into balanced piece sizes of at most `max` (7 words, max 3 → 3, 2, 2). */
function pieceSizes(n, max) {
  if (!(max < n)) return [n];
  const k = Math.ceil(n / max), base = Math.floor(n / k), extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Display groups for the renderer. A caption longer than the template's `maxWords` is shown in
 * balanced pieces, each timed by its own words — the caption itself is not changed.
 * Each piece stays up until the next one starts, unless there's a long pause, so text doesn't flicker.
 */
export function toChunks(segments, transform = t => t, maxWords = Infinity) {
  const parts = [];
  segments.forEach((s, i) => {
    let k = 0;
    for (const size of pieceSizes(s.words.length, Math.max(1, maxWords))) {
      const words = s.words.slice(k, k + size);
      k += size;
      parts.push({ index: i, start: words[0].start, wordsEnd: words[words.length - 1].end, segEnd: s.end, last: k === s.words.length,
        words: words.map(w => ({ ...w, text: transform(w.text) })) });
    }
  });
  return parts.map((p, j) => {
    const next = parts[j + 1];
    const own = p.last ? Math.max(p.segEnd, p.wordsEnd) : p.wordsEnd;
    const end = next ? Math.max(own, Math.min(next.start, own + 0.6)) : own + 0.6;
    return { index: p.index, start: p.start, end, words: p.words };
  });
}

/** Replace a caption's text. Keeps measured word times when the word count is unchanged. */
export function setText(seg, text) {
  const parts = String(text).split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === seg.words.length) {
    return { ...seg, words: seg.words.map((w, i) => ({ ...w, text: parts[i] })) };
  }
  return { ...seg, words: spreadWords(parts.join(' '), seg.start, seg.end), approx: true };
}

/** Move/resize a caption; word times are rescaled into the new range. */
export function setTimes(seg, start, end) {
  start = Math.max(0, +start); end = +end;
  if (!(end - start >= MIN_DUR)) end = start + MIN_DUR;
  const span = seg.end - seg.start || 1;
  const k = (end - start) / span;
  const words = seg.words.map(w => ({ ...w, start: round(start + (w.start - seg.start) * k), end: round(start + (w.end - seg.start) * k) }));
  return { ...seg, start: round(start), end: round(end), words };
}

/** Split before word `at` (1..n-1). */
export function split(seg, at) {
  if (seg.words.length < 2) return null;
  at = Math.min(Math.max(1, at), seg.words.length - 1);
  const a = seg.words.slice(0, at), b = seg.words.slice(at);
  return [makeSegment(a, seg.approx), makeSegment(b, seg.approx)];
}

export function merge(a, b) {
  return makeSegment([...a.words, ...b.words], a.approx || b.approx);
}

/** A new caption placed after index `i` (or at `at` seconds when the list is empty). */
export function newSegmentAfter(segments, i, text = 'New caption', at = 0) {
  const prev = segments[i];
  const next = segments[i + 1];
  const start = prev ? prev.end + 0.05 : at;
  const end = next ? Math.max(start + MIN_DUR, Math.min(start + 1.5, next.start - 0.05)) : start + 1.5;
  return makeSegment(spreadWords(text, round(start), round(end)), true);
}

/** Keep captions ordered and valid after manual edits. */
export function normalize(segments) {
  return segments
    .filter(s => s && s.words.length)
    .map(s => (s.end - s.start < MIN_DUR ? setTimes(s, s.start, s.start + MIN_DUR) : s))
    .sort((a, b) => a.start - b.start);
}

export function indexAt(segments, t) {
  for (let i = segments.length - 1; i >= 0; i--) if (segments[i].start <= t) return i;
  return -1;
}

// ---------- SRT ----------
const pad = (n, l = 2) => String(n).padStart(l, '0');
export function srtTime(s) {
  const ms = Math.max(0, Math.round(s * 1000));
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

export function toSRT(segments, transform = t => t) {
  return segments.map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${transform(segmentText(s))}\n`).join('\n');
}

function parseTime(t) {
  const m = t.trim().replace(',', '.').split(':').map(Number);
  if (m.some(isNaN)) return NaN;
  return m.length === 3 ? m[0] * 3600 + m[1] * 60 + m[2] : m.length === 2 ? m[0] * 60 + m[1] : m[0];
}

/** Parse SRT or WebVTT. Word times inside each cue are estimated. */
export function parseSRT(text) {
  const out = [];
  String(text).replace(/\r/g, '').split(/\n\s*\n/).forEach(block => {
    const lines = block.split('\n');
    const ti = lines.findIndex(l => l.includes('-->'));
    if (ti < 0) return;
    const [a, rest] = lines[ti].split('-->');
    const start = parseTime(a), end = parseTime(rest.trim().split(/\s+/)[0]);
    const cue = lines.slice(ti + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (!cue || isNaN(start) || isNaN(end) || end <= start) return;
    out.push(makeSegment(spreadWords(cue, start, end), true));
  });
  return normalize(out);
}
