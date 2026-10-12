import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toHinglish, LANGUAGES } from '../../site/js/languages.js';
import { TEMPLATES } from '../../site/js/templates.js';
import { buildChunks, findChunk, spreadWords } from '../../site/js/renderer.js';

test('Hinglish transliteration of common words', () => {
  const out = 'भाई ये सच में वायरल होगी आपकी रील हर बार ज़िंदगी कमाल समझ करना'.split(' ').map(toHinglish).join(' ');
  assert.equal(out, 'bhai ye sach mein vaayral hogi aapki reel har baar zindagi kamaal samajh karna');
  assert.equal(toHinglish('hello'), 'hello');
});

test('every language has a browser speech code', () => {
  LANGUAGES.forEach(l => assert.match(l.bcp, /^[a-z]{2}-[A-Z]{2}$/));
});

test('templates have unique ids and required fields', () => {
  const ids = new Set();
  TEMPLATES.forEach(t => {
    assert.ok(!ids.has(t.id), `duplicate ${t.id}`); ids.add(t.id);
    assert.ok(t.name && t.font && t.size > 0 && t.words >= 1, t.id);
  });
  assert.ok(TEMPLATES.length >= 80);
});

test('renderer chunk lookup', () => {
  const ch = buildChunks(spreadWords('a b c d e f', 0, 6), 3);
  assert.equal(ch.length, 2);
  assert.equal(findChunk(ch, 4).words[0].text, 'd');
  assert.equal(findChunk(ch, -1), null);
});
