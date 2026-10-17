import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeId, titleCheck, scriptOutline, ideas, calendar, milestones, NICHES } from '../../site/js/grow.js';
import { videoId } from '../../netlify/functions/yt.mjs';

test('YouTube ids from every link shape', () => {
  for (const u of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ?t=3', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube.com/watch?feature=x&v=dQw4w9WgXcQ', 'https://www.youtube.com/live/dQw4w9WgXcQ']) {
    assert.equal(youtubeId(u), 'dQw4w9WgXcQ', u); assert.equal(videoId(u), 'dQw4w9WgXcQ', u);
  }
  assert.equal(youtubeId('https://example.com/watch?v=abc'), null);
});

test('title check flags the usual packaging problems', () => {
  assert.ok(titleCheck('MY VLOG #vlog #daily SHOCKING').tips.length >= 3);
  assert.equal(titleCheck('I tried SIP for 30 days — honest result').ok, true);
});

test('script outline: cold open first, payoff last, chapters for the description', () => {
  const s = scriptOutline('5 SIP mistakes', 10);
  assert.match(s.parts[0].what, /Cold open/);
  assert.match(s.parts.at(-1).what, /Payoff/);
  assert.match(s.description, /Chapters\n0:00 Cold open/);
});

test('30 distinct ideas per niche, own topic first, each with 3 Shorts', () => {
  for (const k of Object.keys(NICHES)) {
    const l = ideas(k, 'my topic');
    assert.equal(l.length, 30); assert.equal(new Set(l.map(x => x.title)).size, 30);
    assert.match(l[0].title, /my topic/i); assert.equal(l[0].shorts.length, 3);
  }
});

test('calendar: 30 days, long videos on fixed days, shorts per week as asked', () => {
  const c = calendar(ideas('tech'), 2, 5);
  assert.equal(c.length, 30);
  const week = c.slice(0, 7).flatMap(d => d.tasks);
  assert.equal(week.filter(t => t.type === 'long').length, 2);
  assert.equal(week.filter(t => t.type === 'short').length, 5);
  assert.equal(milestones(150)[1].done, true);
});
