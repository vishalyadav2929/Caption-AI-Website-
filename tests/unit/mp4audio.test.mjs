import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extractAacAdts } from '../../site/js/mp4audio.js';

const load = f => { const b = readFileSync(new URL(`../fixtures/${f}`, import.meta.url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
let hasFfmpeg = true;
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { hasFfmpeg = false; }

for (const f of ['iphone-like.mov', 'stereo44k.mp4']) {
  test(`extracts AAC from ${f} as valid ADTS`, () => {
    const r = extractAacAdts(load(f));
    assert.equal(r.sampleRate, 44100);
    assert.ok(r.frames > 200);
    // Every frame starts with the ADTS sync word and its length field walks to the next frame.
    let o = 0, n = 0;
    while (o < r.adts.length) {
      assert.equal(r.adts[o], 0xff); assert.equal(r.adts[o + 1] & 0xf0, 0xf0);
      o += ((r.adts[o + 3] & 3) << 11) | (r.adts[o + 4] << 3) | (r.adts[o + 5] >> 5); n++;
    }
    assert.equal(o, r.adts.length); assert.equal(n, r.frames);
    if (hasFfmpeg) {
      const out = execFileSync('ffmpeg', ['-v', 'error', '-f', 'aac', '-i', 'pipe:0', '-af', 'volumedetect', '-f', 'null', '-'], { input: Buffer.from(r.adts), stdio: ['pipe', 'pipe', 'pipe'] });
      assert.equal(out.length, 0, 'decodes without errors');
    }
  });
}

test('a file without AAC audio is rejected', () => {
  assert.throws(() => extractAacAdts(load('portrait.webm')), /moov|audio/);
});
