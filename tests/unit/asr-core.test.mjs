import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planWindows, chunksToWords, transcribeLong, isSilent } from '../../site/js/asr-core.js';

const SR = 16000;
function tone(seconds, gaps = []) {
  const a = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < a.length; i++) a[i] = 0.3 * Math.sin(i / 8);
  for (const [s, e] of gaps) a.fill(0, Math.round(s * SR), Math.round(e * SR));
  return a;
}

test('short audio is one window', () => {
  assert.deepEqual(planWindows(tone(12)), [{ start: 0, end: 12 * SR }]);
});

test('long audio is cut at the quietest point between 18 and 29 s', () => {
  const w = planWindows(tone(70, [[23, 23.6], [47, 47.5]]));
  assert.ok(w.length >= 3);
  assert.ok(Math.abs(w[0].end / SR - 23.3) < 0.4, `first cut at ${w[0].end / SR}`);
  for (let i = 1; i < w.length; i++) assert.equal(w[i].start, w[i - 1].end);
  assert.equal(w[w.length - 1].end, 70 * SR);
  w.forEach(x => assert.ok((x.end - x.start) / SR <= 29.01));
});

test('word chunks are shifted by the window offset', () => {
  const out = chunksToWords([{ text: ' Hello', timestamp: [0.5, 0.9] }, { text: ' world.', timestamp: [1.0, null] }, { text: ' ', timestamp: [2, 3] }], 'word', 30, 59);
  assert.deepEqual(out, [{ text: 'Hello', start: 30.5, end: 30.9 }, { text: 'world.', start: 31, end: 31.3 }]);
});

test('segment chunks are spread across words and marked as estimated', () => {
  const out = chunksToWords([{ text: ' one two', timestamp: [0, 2] }], 'segment', 10, 40);
  assert.deepEqual(out, [{ text: 'one', start: 10, end: 11, approx: true }, { text: 'two', start: 11, end: 12, approx: true }]);
});

test('transcribeLong runs each window, skips silence and reports progress', async () => {
  const audio = tone(80, [[25, 60]]); // 35 s of silence fills a whole window
  const calls = [];
  const progress = [];
  const res = await transcribeLong(async sub => {
    calls.push(sub.length / SR);
    return { level: 'word', chunks: [{ text: ' hi', timestamp: [0.1, 0.4] }] };
  }, audio, { onProgress: (d, t) => progress.push([d, t]) });
  const total = progress[progress.length - 1][1];
  assert.equal(progress.length, total);
  assert.ok(calls.length < total, 'a silent window should be skipped');
  assert.equal(res.level, 'word');
  assert.equal(res.words[0].start, 0.1);
});

test('transcribeLong stops when cancelled', async () => {
  await assert.rejects(transcribeLong(async () => ({ level: 'word', chunks: [] }), tone(5), { shouldStop: () => true }), /cancelled/);
});

test('isSilent', () => {
  assert.equal(isSilent(new Float32Array(1000), 0, 1000), true);
  assert.equal(isSilent(tone(1), 0, SR), false);
});

import { preprocess, cleanWords } from '../../site/js/asr-core.js';

test('preprocess removes low rumble and lifts a quiet voice', () => {
  const n = SR * 2, a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = 0.3 * Math.sin(2 * Math.PI * 30 * i / SR) + 0.01 * Math.sin(2 * Math.PI * 300 * i / SR);
  const before = a.slice();
  const out = preprocess(a);
  // 30 Hz rumble is attenuated far more than the 300 Hz "voice": correlate with each.
  // Amplitude of each frequency (sin + cos, so the filter's phase shift doesn't matter).
  const amp = f => { let s = 0, c = 0; for (let i = SR; i < n; i++) { s += out[i] * Math.sin(2 * Math.PI * f * i / SR); c += out[i] * Math.cos(2 * Math.PI * f * i / SR); } return 2 * Math.hypot(s, c) / SR; };
  // Input: rumble 30x louder than the voice. Output: voice clearly louder than the rumble.
  assert.ok(amp(300) > amp(30) * 1.5, `voice ${amp(300)} vs rumble ${amp(30)}`);
  let peak = 0; for (const v of out) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak <= 0.98, 'no clipping');
  assert.deepEqual(a, before, 'input untouched');
});

test('cleanWords drops invented filler and runaway repetition', () => {
  const w = t => t.split(' ').map((text, i) => ({ text, start: i, end: i + 0.5 }));
  assert.deepEqual(cleanWords(w('ok ok ok ok ok bhai')).map(x => x.text), ['ok', 'ok', 'bhai']);
  assert.deepEqual(cleanWords(w('kya haal kya haal kya haal kya haal hai')).map(x => x.text).join(' '), 'kya haal kya haal hai');
  assert.deepEqual(cleanWords([{ text: 'सब्सक्राइब', start: 0, end: 1 }, { text: 'नमस्ते', start: 1, end: 2 }]).map(x => x.text), ['नमस्ते']);
  assert.deepEqual(cleanWords(w('ye ek normal line hai')).map(x => x.text).join(' '), 'ye ek normal line hai');
});

test('snapToSpeech moves a word that starts in silence onto the voice', async () => {
  const { snapToSpeech } = await import('../../site/js/asr-core.js');
  const sr = 16000, a = new Float32Array(sr * 4);
  for (let i = 0; i < a.length; i++) a[i] = (Math.random() - 0.5) * 0.002; // quiet room noise
  for (let i = sr * 1.5; i < sr * 2.5; i++) a[i] += Math.sin(i / 7) * 0.3; // voice 1.5–2.5 s
  const [w] = snapToSpeech([{ text: 'hello', start: 0, end: 2.4 }], a);
  assert.ok(Math.abs(w.start - 1.45) < 0.06, `start ${w.start}`);
  // A word already on the voice is left alone.
  const [v] = snapToSpeech([{ text: 'x', start: 1.6, end: 2.0 }], a);
  assert.deepEqual([v.start, v.end], [1.6, 2.0]);
});

test('snapToSpeech spreads estimated words over the voiced part of their sentence', async () => {
  const { snapToSpeech } = await import('../../site/js/asr-core.js');
  const sr = 16000, a = new Float32Array(sr * 6);
  for (let i = sr * 3; i < sr * 5; i++) a[i] = Math.sin(i / 7) * 0.3; // voice only 3–5 s
  const words = ['one', 'two', 'three', 'four'].map((t, i) => ({ text: t, start: i * 1.5, end: (i + 1) * 1.5, approx: true }));
  const out = snapToSpeech(words, a);
  assert.ok(out[0].start >= 2.9 && out.at(-1).end <= 5.1, JSON.stringify(out));
  for (let i = 1; i < out.length; i++) assert.ok(out[i].start >= out[i - 1].start);
});

test('planWindows keeps the first window short when asked', async () => {
  const { planWindows } = await import('../../site/js/asr-core.js');
  const a = new Float32Array(16000 * 40).fill(0.1);
  const w = planWindows(a, { firstMax: 12 });
  assert.ok(w[0].end / 16000 <= 12 && w[0].end / 16000 >= 6, JSON.stringify(w));
  assert.equal(w.at(-1).end, a.length);
  assert.equal(planWindows(new Float32Array(16000 * 15), { firstMax: 12 }).length, 1, 'short clips stay one window');
});
