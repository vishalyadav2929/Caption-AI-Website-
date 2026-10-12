// Long-audio planning for Whisper. Pure functions — tested in Node with a fake model.
//
// Whisper reads 30-second windows. Rather than cutting blindly every 30 s (which splits words
// and gives no progress), we cut at the quietest moment between 18 and 29 s, transcribe each
// window, and shift its timestamps by the window's start. That gives real progress
// (windows done / total), lets the user cancel between windows, and skips silent windows
// (where Whisper tends to invent text like "Thank you.").

export const SR = 16000;

function rms(audio, from, to) {
  let s = 0;
  for (let i = from; i < to; i++) s += audio[i] * audio[i];
  return Math.sqrt(s / Math.max(1, to - from));
}

/** Window boundaries in samples: [{ start, end }]. */
export function planWindows(audio, { sr = SR, maxLen = 29, minLen = 18 } = {}) {
  const out = [];
  const frame = Math.floor(sr * 0.1);
  let start = 0;
  while (start < audio.length) {
    if (audio.length - start <= maxLen * sr) { out.push({ start, end: audio.length }); break; }
    let best = start + maxLen * sr, bestE = Infinity;
    for (let p = start + minLen * sr; p + frame <= start + maxLen * sr; p += frame) {
      const e = rms(audio, p, p + frame);
      if (e < bestE) { bestE = e; best = p + Math.floor(frame / 2); }
    }
    out.push({ start, end: best });
    start = best;
  }
  return out;
}

export function isSilent(audio, from, to, threshold = 0.004) {
  return rms(audio, from, to) < threshold;
}

/** Turn Whisper output chunks into words, shifted by `offset` seconds. */
export function chunksToWords(chunks, level, offset, windowEnd) {
  const words = [];
  for (const c of chunks || []) {
    const text = (c.text || '').trim();
    if (!text) continue;
    let [s, e] = c.timestamp || [0, null];
    if (s == null) continue;
    if (e == null) e = level === 'word' ? s + 0.3 : windowEnd - offset;
    if (level === 'word') {
      words.push({ text, start: +(s + offset).toFixed(3), end: +(Math.max(e, s + 0.05) + offset).toFixed(3) });
    } else {
      // Sentence-level only: spread its words evenly and mark them as estimated.
      const parts = text.split(/\s+/).filter(Boolean);
      const step = (e - s) / parts.length;
      parts.forEach((p, i) => words.push({
        text: p, start: +(offset + s + i * step).toFixed(3), end: +(offset + s + (i + 1) * step).toFixed(3), approx: true,
      }));
    }
  }
  return words;
}

/**
 * Transcribe audio of any length.
 * run(subarray) → Promise<{ chunks, level: 'word' | 'segment' }>
 * hooks: { onProgress(done, total), shouldStop() }
 */
export async function transcribeLong(run, audio, { sr = SR, onProgress, shouldStop } = {}) {
  const windows = planWindows(audio, { sr });
  const words = [];
  let level = 'word';
  for (let i = 0; i < windows.length; i++) {
    if (shouldStop && shouldStop()) throw new Error('cancelled');
    const { start, end } = windows[i];
    if (!isSilent(audio, start, end)) {
      const out = await run(audio.subarray(start, end));
      if (out.level === 'segment') level = 'segment';
      words.push(...chunksToWords(out.chunks, out.level, start / sr, end / sr));
    }
    onProgress && onProgress(i + 1, windows.length);
  }
  return { words, level, windows: windows.length };
}

// ---------- clean-up for noisy, real-world audio ----------

/**
 * Prepare speech for Whisper: remove DC offset and low rumble (wind, traffic, engine hum below ~80 Hz),
 * then bring the voice to a steady level so quiet speakers aren't lost under background noise.
 * Returns a new Float32Array; the input is not modified.
 */
export function preprocess(audio, { sr = SR, cutoff = 80, targetRms = 0.08, maxGain = 12 } = {}) {
  // 4th-order Butterworth-style high-pass: two cascaded RBJ biquads (Q = 0.54 and 1.31).
  let out = new Float32Array(audio);
  for (const q of [0.5412, 1.3066]) {
    const w = 2 * Math.PI * cutoff / sr, cos = Math.cos(w), alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = (1 + cos) / 2 / a0, b1 = -(1 + cos) / a0, b2 = b0, a1 = -2 * cos / a0, a2 = (1 - alpha) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < out.length; i++) {
      const x = out[i];
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      out[i] = y;
    }
  }
  // Loudness: measure the louder half of 50 ms frames (where the voice usually is), not the silences.
  const frame = Math.floor(sr * 0.05), levels = [];
  for (let i = 0; i + frame <= out.length; i += frame) {
    let s = 0; for (let j = i; j < i + frame; j++) s += out[j] * out[j];
    levels.push(Math.sqrt(s / frame));
  }
  if (!levels.length) return out;
  levels.sort((a, b) => a - b);
  const voiced = levels.slice(Math.floor(levels.length / 2));
  const level = voiced.reduce((a, b) => a + b, 0) / voiced.length;
  if (level < 1e-5) return out;
  const gain = Math.min(maxGain, targetRms / level);
  for (let i = 0; i < out.length; i++) {
    const v = out[i] * gain;
    out[i] = v > 0.98 ? 0.98 : v < -0.98 ? -0.98 : v; // soft ceiling, no wrap-around clipping
  }
  return out;
}

// Phrases Whisper is known to invent over noise or silence (trained on subtitled videos).
const HALLUCINATIONS = [
  /thank(s| you) for watching/i, /please subscribe/i, /like and subscribe/i, /subtitles? by/i, /amara\.org/i,
  /उपशीर्षक/, /सब्सक्राइब/, /देखने के लिए धन्यवाद/, /^\W*(music|applause|laughter)\W*$/i, /^[\s.…,!?-]*$/,
];

/** Remove invented filler and runaway repetition ("ok ok ok ok ok", "the same line the same line…"). */
export function cleanWords(words) {
  let out = words.filter(w => !HALLUCINATIONS.some(r => r.test(w.text)));
  // Drop phrases (1–4 words) that repeat more than twice in a row.
  for (let n = 1; n <= 4; n++) {
    const keep = [];
    for (let i = 0; i < out.length; i++) {
      keep.push(out[i]);
      if (keep.length >= n * 3) {
        const k = keep.length;
        const key = j => keep.slice(k - n * (j + 1), k - n * j).map(w => w.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')).join(' ');
        if (key(0) && key(0) === key(1) && key(1) === key(2)) keep.splice(k - n, n);
      }
    }
    out = keep;
  }
  return out;
}
