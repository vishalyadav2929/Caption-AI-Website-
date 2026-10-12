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
