import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../netlify/functions/transcribe.mjs';
import { toWav } from '../../site/js/cloud-asr.js';

const req = (method, url, init = {}) => new Request(url, { method, ...init });

test('fast mode is off until the site owner sets GROQ_API_KEY', async () => {
  delete process.env.GROQ_API_KEY;
  assert.deepEqual(await (await handler(req('GET', 'https://x.app/api/transcribe'))).json(), { enabled: false });
  const r = await handler(req('POST', 'https://x.app/api/transcribe', { body: 'x', headers: { origin: 'https://x.app' } }));
  assert.equal(r.status, 404);
});

test('fast mode forwards audio to Groq with the key on the server and returns words', async () => {
  process.env.GROQ_API_KEY = 'secret-key';
  const real = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = { url, auth: init.headers.authorization, form: init.body };
    return new Response(JSON.stringify({ language: 'hindi', words: [{ word: 'नमस्ते', start: 1.5, end: 1.9 }, { word: ' दोस्तों', start: 1.9, end: 2.4 }] }), { status: 200 });
  };
  try {
    assert.deepEqual(await (await handler(req('GET', 'https://x.app/api/transcribe'))).json(), { enabled: true });
    const wav = await toWav(new Float32Array(16000)).arrayBuffer();
    const r = await handler(req('POST', 'https://x.app/api/transcribe?lang=hi&task=transcribe', { body: wav, headers: { origin: 'https://x.app' } }));
    assert.equal(r.status, 200);
    const out = await r.json();
    assert.deepEqual(out.words, [{ text: 'नमस्ते', start: 1.5, end: 1.9 }, { text: 'दोस्तों', start: 1.9, end: 2.4 }]);
    assert.match(sent.url, /transcriptions$/);
    assert.equal(sent.auth, 'Bearer secret-key');
    assert.equal(sent.form.get('language'), 'hi');
    assert.equal(sent.form.get('model'), 'whisper-large-v3-turbo');
    assert.deepEqual(sent.form.getAll('timestamp_granularities[]'), ['word', 'segment']);
    // Other websites can't use it, and quota errors are passed on so the browser falls back.
    assert.equal((await handler(req('POST', 'https://x.app/api/transcribe', { body: wav, headers: { origin: 'https://evil.example' } }))).status, 403);
    globalThis.fetch = async () => new Response('{}', { status: 429 });
    assert.equal((await handler(req('POST', 'https://x.app/api/transcribe', { body: wav, headers: { origin: 'https://x.app' } }))).status, 429);
  } finally {
    globalThis.fetch = real;
    delete process.env.GROQ_API_KEY;
  }
});

test('toWav writes a valid 16 kHz mono 16-bit WAV', async () => {
  const b = new Uint8Array(await toWav(new Float32Array([0, 1, -1])).arrayBuffer());
  assert.equal(new TextDecoder().decode(b.slice(0, 4)), 'RIFF');
  assert.equal(b.length, 44 + 6);
  const v = new DataView(b.buffer);
  assert.equal(v.getUint32(24, true), 16000);
  assert.equal(v.getInt16(46, true), 32767);
  assert.equal(v.getInt16(48, true), -32768);
});
