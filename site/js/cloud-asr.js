// Fast mode client: sends the audio (never the video) in ≤ 29 s clips to /api/transcribe, several at
// once, and returns words with times. Used only when the site owner has switched Fast mode on and
// the visitor leaves it ticked; any failure falls back to on-device captions.
import { planWindows, cleanWords, snapToSpeech, SR, chunksToWords } from './asr-core.js';

let enabledP = null;
/** Is Fast mode set up on this site? (cached; false on any error, e.g. a plain static server) */
export function cloudAvailable() {
  if (!enabledP) {
    enabledP = fetch('api/transcribe', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { enabled: false }))
      .then(j => !!j.enabled)
      .catch(() => false);
  }
  return enabledP;
}

/** 16-bit mono WAV. */
export function toWav(samples, sr = SR) {
  const buf = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) { const x = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  return new Blob([buf], { type: 'audio/wav' });
}

/**
 * @param {Float32Array} audio  16 kHz mono
 * @param {{ lang: string|null, task: 'transcribe'|'translate', onWords?, onProgress?, signal? }} o
 * @returns {Promise<{ words, level }>}
 */
export async function cloudTranscribe(audio, { lang, task, onWords, onProgress, signal, parallel = 3 }) {
  const windows = planWindows(audio, { firstMax: 12 });
  const results = new Array(windows.length);
  let next = 0, done = 0, shown = 0, level = 'word';
  const one = async i => {
    const { start, end } = windows[i];
    const qs = new URLSearchParams({ task });
    if (lang) qs.set('lang', lang);
    const res = await fetch(`api/transcribe?${qs}`, { method: 'POST', body: toWav(audio.subarray(start, end)), signal });
    if (!res.ok) { const e = new Error(res.status === 429 ? 'busy' : `fast mode failed (${res.status})`); e.status = res.status; throw e; }
    const out = await res.json();
    if (out.level === 'segment') level = 'segment';
    const chunks = out.words.map(w => ({ text: w.text, timestamp: [w.start, w.end] }));
    results[i] = chunksToWords(chunks, out.level === 'segment' ? 'segment' : 'word', start / SR, end / SR);
    done++;
    onProgress && onProgress(done, windows.length);
    // Show parts in order as soon as everything before them is in.
    while (shown < results.length && results[shown]) {
      onWords && onWords(snapToSpeech(cleanWords(results[shown]), audio));
      shown++;
    }
  };
  const workers = Array.from({ length: Math.min(parallel, windows.length) }, async () => {
    while (next < windows.length) await one(next++);
  });
  await Promise.all(workers);
  return { words: snapToSpeech(cleanWords(results.flat()), audio), level, windows: windows.length };
}
