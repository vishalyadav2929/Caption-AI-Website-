import test from 'node:test';
import assert from 'node:assert/strict';
import { seriesOrder, partOf, partLabel, seriesCaptions } from '../../site/js/series.js';

const found = [{ start: 60, title: 'Best moment' }, { start: 10, title: 'Opening' }, { start: 30, title: 'Middle' }];

test('series order: story order or best first', () => {
  assert.deepEqual(seriesOrder(found, 'time'), [1, 2, 0]);
  assert.deepEqual(seriesOrder(found, 'score'), [0, 1, 2]);
  assert.equal(partOf(found, 0, 'time'), 3);
  assert.equal(partLabel(2, 3, 'Money tips'), 'MONEY TIPS · PART 2/3');
});

test('captions: one per part, each points to the next, the last asks for comments', () => {
  const c = seriesCaptions(found, { name: 'Money Tips', tags: ['finance'] });
  assert.equal(c.length, 3);
  assert.match(c[0].text, /^Money Tips · Part 1\/3 🔥\nOpening/);
  assert.match(c[0].text, /Part 2 is next/);
  assert.match(c[2].text, /last part/);
  assert.match(c[1].text, /#MoneyTips #part2 #series #reels #finance/);
});
