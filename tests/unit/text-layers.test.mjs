import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapLines, layersAt, hitLayer, newLayer } from '../../site/js/text-layers.js';

const measure = s => s.length * 10; // 10 px per character

test('typed text stays on one line when it fits', () => {
  assert.deepEqual(wrapLines('Sale 50% off today', 400, measure), ['Sale 50% off today']);
});

test('the user’s own line breaks are kept and long lines wrap between words', () => {
  assert.deepEqual(wrapLines('Top line\nthis second line is long', 120, measure), ['Top line', 'this second', 'line is long']);
  assert.deepEqual(wrapLines('a\n\nb', 100, measure), ['a', '', 'b']);
});

test('layers show only inside their time range; photos show every layer', () => {
  const a = newLayer({ start: 0, end: 2 }), b = newLayer({ start: 1.5, end: 4 });
  assert.deepEqual(layersAt([a, b], 1).map(l => l.id), [a.id]);
  assert.deepEqual(layersAt([a, b], 1.8).map(l => l.id), [a.id, b.id]);
  assert.deepEqual(layersAt([a, b], 4).map(l => l.id), []);
  assert.equal(layersAt([a, b], 99, true).length, 2);
});

test('hit test picks the topmost layer under the pointer', () => {
  const boxes = [{ id: 'low', x0: 0, y0: 0, w: 100, h: 50, px: 20 }, { id: 'top', x0: 50, y0: 20, w: 100, h: 50, px: 20 }];
  assert.equal(hitLayer(boxes, 60, 30), 'top');
  assert.equal(hitLayer(boxes, 10, 10), 'low');
  assert.equal(hitLayer(boxes, 400, 400), null);
});
