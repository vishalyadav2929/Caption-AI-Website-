import test from 'node:test';
import assert from 'node:assert/strict';
import { sentences, wordsOf, hookScore, hookTitle, hookOptions, findClips, cropRect, aspectSize } from '../../site/js/clips.js';

// A fake 3-minute talk: filler sentences, with one strong stretch starting at 90 s.
function talk() {
  const segs = [];
  let t = 0;
  const say = (text, wps = 2.2) => {
    const words = text.split(' ').map(w => { const s = t; t += 1 / wps; return { text: w, start: +s.toFixed(2), end: +(t - 0.05).toFixed(2) }; });
    segs.push({ start: words[0].start, end: words[words.length - 1].end, words });
    t += 0.4;
  };
  while (t < 88) say('so today we are going to talk about the weather and other things in general.');
  say('Why do 90% of people lose money in their first business?', 3.2);
  say('The biggest mistake is simple and nobody tells you the truth about it.', 3.2);
  for (let i = 0; i < 3; i++) say('You must track every rupee, never borrow for ads, and stop copying others.', 3.2);
  while (t < 180) say('anyway let us move on to the next topic of the day and see what happens.');
  return segs;
}

test('sentences split on punctuation and long pauses', () => {
  const w = [{ text: 'hello', start: 0, end: 0.4 }, { text: 'there.', start: 0.5, end: 0.9 }, { text: 'next', start: 2.5, end: 2.9 }, { text: 'one', start: 3.0, end: 3.3 }];
  const s = sentences(w);
  assert.equal(s.length, 2);
  assert.equal(s[0].text, 'hello there.');
});

test('hook lines score higher than filler', () => {
  assert.ok(hookScore('Why do 90% of people lose money?') > 0.6);
  assert.ok(hookScore('Ye sabse badi galti kyun hai?') > 0.6);
  assert.ok(hookScore('so we went there and came back') < 0.2);
});

test('finds the strong stretch, whole sentences, Shorts length, no overlaps', () => {
  const clips = findClips(talk(), { count: 4 });
  assert.ok(clips.length >= 2);
  const best = clips[0];
  const hookAt = talk().find(s => s.words[0].text === "Why").start;
  assert.equal(best.start, hookAt, "best clip starts exactly on the hook sentence");
  assert.ok(best.end - best.start >= 15 && best.end - best.start <= 60);
  assert.match(best.title, /^Why do 90% of people lose money/);
  assert.ok(best.score >= clips[clips.length - 1].score);
  for (let i = 0; i < clips.length; i++) for (let j = i + 1; j < clips.length; j++) {
    const a = clips[i], b = clips[j];
    assert.ok(Math.min(a.end, b.end) - Math.max(a.start, b.start) <= 0.2 * Math.min(a.end - a.start, b.end - b.start), 'no big overlaps');
  }
});

test('hook titles are short', () => {
  const s = sentences(wordsOf(talk())).filter(x => x.start > 88).slice(0, 2);
  assert.ok(hookTitle(s, 6).split(' ').length <= 6);
});

test('9:16 crop from a 16:9 frame', () => {
  assert.deepEqual(cropRect(1920, 1080, 9 / 16, 0.5), { sx: 656, sy: 0, sw: 608, sh: 1080 });
  assert.equal(cropRect(1920, 1080, 9 / 16, 0).sx, 0);
  assert.equal(cropRect(1920, 1080, 9 / 16, 1).sx, 1312);
  assert.deepEqual(cropRect(1080, 1920, 9 / 16, 0.5), { sx: 0, sy: 0, sw: 1080, sh: 1920 });
});

test('AI hook replies are validated', async () => {
  const { parseReply, buildPrompt } = await import('../../netlify/functions/clips.mjs');
  const r = parseReply('```json\n{"clips":[{"i":1,"score":140,"hook":"90% log yahi galti karte hain","why":"strong"},{"i":7,"score":50,"hook":"x"},{"i":1,"score":3,"hook":"dup"}]}\n```', 2);
  assert.deepEqual(r, [{ i: 1, score: 100, hook: '90% log yahi galti karte hain', why: 'strong' }]);
  assert.deepEqual(parseReply('not json', 2), []);
  assert.match(buildPrompt([{ start: 0, end: 20, text: 'hello' }])[1].content, /#0 \(20s\): hello/);
});

test('several hook options, all taken from the clip itself', () => {
  const best = findClips(talk(), { count: 1 })[0];
  assert.ok(best.hooks.length >= 2);
  for (const h of best.hooks) assert.ok(best.text.toLowerCase().includes(h.replace(/…$/, '').toLowerCase().slice(0, 20)), `hook comes from the transcript: ${h}`);
  assert.equal(new Set(best.hooks).size, best.hooks.length);
});

test('square and landscape crops', () => {
  assert.deepEqual(cropRect(1920, 1080, 1, 0.5), { sx: 420, sy: 0, sw: 1080, sh: 1080 });
  assert.deepEqual(cropRect(1080, 1920, 16 / 9, 0.5), { sx: 0, sy: 656, sw: 1080, sh: 608 });
  assert.deepEqual(aspectSize('1:1'), { w: 1080, h: 1080 });
});
