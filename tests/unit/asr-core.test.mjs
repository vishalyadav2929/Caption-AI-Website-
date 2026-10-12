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
