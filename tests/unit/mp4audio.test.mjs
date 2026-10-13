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

test('export copies the original AAC audio into the new MP4 bit for bit', async () => {
  const { readFileSync, writeFileSync, mkdtempSync } = await import('node:fs');
  const { execFileSync } = await import('node:child_process');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { readAacTrack } = await import('../../site/js/mp4audio.js');
  const { Muxer, ArrayBufferTarget } = await import('../../site/js/vendor/mp4-muxer.js');
  for (const name of ['iphone-like.mov', 'stereo44k.mp4']) {
    const src = new URL(`../fixtures/${name}`, import.meta.url);
    const b = readFileSync(src);
    const t = readAacTrack(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    const muxer = new Muxer({ target: new ArrayBufferTarget(), audio: { codec: 'aac', sampleRate: t.sampleRate, numberOfChannels: t.channels }, fastStart: false });
    const step = 1024 / t.sampleRate * 1e6;
    const meta = { decoderConfig: { codec: `mp4a.40.${t.objectType}`, sampleRate: t.sampleRate, numberOfChannels: t.channels, description: t.asc } };
    t.frames.forEach((f, i) => muxer.addAudioChunkRaw(f, 'key', Math.round(i * step), Math.round(step), i ? undefined : meta));
    muxer.finalize();
    const out = join(mkdtempSync(join(tmpdir(), 'vcz-')), 'out.mp4');
    writeFileSync(out, new Uint8Array(muxer.target.buffer));
    const hashes = f => execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-map', '0:a', '-c', 'copy', '-f', 'framemd5', '-']).toString()
      .split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split(',')[5].trim()); // packet data hash (later fields are side data)
    assert.deepEqual(hashes(out), hashes(src.pathname), `${name}: audio packets identical`);
  }
});
