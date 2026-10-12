import test from 'node:test';
import assert from 'node:assert/strict';
import { detectTextLang, splitForService, onlineTranslate } from '../../site/js/translate.js';

test('detectTextLang trusts the script over the picked language', () => {
  assert.equal(detectTextLang('this is how your reels go', 'hi'), 'en');
  assert.equal(detectTextLang('यह मेरा दोस्त है', 'hi'), 'hi');
  assert.equal(detectTextLang('माझा मित्र', 'mr'), 'mr');
  assert.equal(detectTextLang('আমার বন্ধু', 'hi'), 'bn');
  assert.equal(detectTextLang('hola amigo', 'es'), 'es');
  assert.equal(detectTextLang('میرا دوست', 'ur'), 'ur');
  assert.equal(detectTextLang('', 'hi'), 'hi');
});

test('splitForService keeps each piece under the byte limit, between words', () => {
  const text = 'मेरा दोस्त '.repeat(60).trim();
  const parts = splitForService(text, 450);
  assert.ok(parts.length > 1);
  for (const p of parts) assert.ok(new TextEncoder().encode(p).length <= 450);
  assert.equal(parts.join(' '), text);
});

test('onlineTranslate builds the request, decodes entities and reports quota', async () => {
  let url;
  const ok = async u => { url = u; return { ok: true, status: 200, json: async () => ({ responseStatus: 200, responseData: { translatedText: 'it&#39;s my friend' } }) }; };
  assert.equal(await onlineTranslate('मेरा दोस्त', 'hi', 'en', ok), "it's my friend");
  assert.match(url, /langpair=hi\|en/);
  const quota = async () => ({ ok: true, status: 200, json: async () => ({ responseStatus: 403, responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY' } }) });
  await assert.rejects(onlineTranslate('hi', 'en', 'hi', quota), /limit for today/);
  await assert.rejects(onlineTranslate('hi', 'en', 'hi', async () => { throw new TypeError('offline'); }), /No internet/);
});
