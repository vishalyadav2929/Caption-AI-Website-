// Real speech-to-text test: the real editor + the real Whisper model, on a 47 s English video
// whose word times are known (synthesized with espeak-ng by make-speech.py, 1.5 s silence first).
// Checks accuracy, caption timing and how soon the first captions appear.
// Usage: npm run test:asr   (downloads transformers.js + whisper-base, ~80 MB, from npm once)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..'), SITE = join(REPO, 'site');
const video = join(REPO, 'tests/fixtures/speech-en.webm'), truthFile = join(REPO, 'tests/fixtures/speech-en.truth.json');
const spoken = 'english', captionOpt = 'English', vp = 'phone';
// The same files the site loads from jsDelivr / Hugging Face, fetched from npm (works offline after the first run).
const CACHE = join(REPO, 'tests/asr/.cache');
const unpack = (pkg, dir) => {
  if (existsSync(join(CACHE, dir))) return;
  mkdirSync(join(CACHE, dir), { recursive: true });
  const tgz = execFileSync('npm', ['pack', '--ignore-scripts', '--silent', pkg], { cwd: CACHE }).toString().trim().split('\n').pop();
  execFileSync('tar', ['xzf', tgz, '-C', dir], { cwd: CACHE });
};
mkdirSync(CACHE, { recursive: true });
unpack('@huggingface/transformers@3.8.1', 'tf');
unpack('sts-whisper-base@1.0.0', 'wb');
const TF = join(CACHE, 'tf/package/dist'), MODELS = join(CACHE, 'wb/package/models');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const b = await readFile(join(SITE, p === '/' ? 'index.html' : p)); res.writeHead(200, { 'content-type': T[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://localhost:${server.address().port}`;
let pw;
try { pw = await import('playwright'); } catch { pw = await import(join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright', 'index.mjs')); }
const { chromium } = pw;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext(vp === 'phone'
  ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' }
  : { viewport: { width: 1440, height: 900 } });
const fileRoute = async (route, path) => { try { const b = await readFile(path); route.fulfill({ status: 200, body: b, headers: { 'content-type': T[extname(path)] || 'application/octet-stream', 'access-control-allow-origin': '*' } }); } catch { route.fulfill({ status: 404, body: 'nf', headers: { 'access-control-allow-origin': '*' } }); } };
await ctx.route('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/**', r => fileRoute(r, join(TF, new URL(r.request().url()).pathname.split('/dist/')[1])));
await ctx.route('https://huggingface.co/**', r => {
  const m = new URL(r.request().url()).pathname.match(/^\/([^/]+\/[^/]+)\/resolve\/[^/]+\/(.+)$/);
  // Serve the same files for both builds, so the "switch build when word timing fails" path runs.
  const model = m && m[1] === 'onnx-community/whisper-base_timestamped' ? 'Xenova/whisper-base' : m && m[1];
  return fileRoute(r, m ? join(MODELS, model, m[2]) : '/nonexistent');
});
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
const page = await ctx.newPage();
const log = [];
page.on('console', m => { if (/error|warn/.test(m.type())) log.push(m.text().slice(0, 200)); });
page.on('pageerror', e => log.push('PAGEERROR ' + e.message));
await page.goto(`${BASE}/app.html`);
await page.evaluate(() => localStorage.clear());
// Pretend the first build can't give word timing on this "phone": the worker must switch builds, not fall back to estimates.
await page.evaluate(() => { window.__vczDebugFailWord = ['onnx-community/whisper-base_timestamped']; });
const t0 = Date.now();
await page.setInputFiles('#startFile', video);
await page.waitForSelector('#startPreview:not([hidden])');
await page.click('#spokenCombo .combo-btn'); await page.fill('#spokenCombo input', spoken); await page.keyboard.press('Enter');
await page.waitForTimeout(300);
if (await page.isVisible('#captionCombo .combo-btn')) { await page.click('#captionCombo .combo-btn'); await page.click(`#captionCombo [role=option]:has-text("${captionOpt}")`); }
if (await page.isVisible('#startGo') && await page.isEnabled('#startGo')) await page.click('#startGo');
const tStart = Date.now();
let firstCap = null;
const statusLog = [];
for (;;) {
  const st = await page.evaluate(() => ({ n: window.__vcz.S.segments.length, s: document.getElementById('status').textContent, ov: document.getElementById('genOvText').textContent, hid: document.getElementById('genOv').hidden }));
  if (statusLog.at(-1) !== st.ov) statusLog.push(st.ov);
  if (st.n && firstCap == null) firstCap = Date.now();
  if (/Couldn’t|failed|No speech/i.test(st.s) || (st.n && st.hid)) { statusLog.push('STATUS ' + st.s); break; }
  if (Date.now() - tStart > 600000) { statusLog.push('TIMEOUT'); break; }
  await page.waitForTimeout(250);
}
const tEnd = Date.now();
const segs = await page.evaluate(() => window.__vcz.S.segments);
const truth = JSON.parse(await readFile(truthFile, 'utf8'));
const OFF = 1.5;
const norm = s => s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');
const tw = truth.words.map(w => ({ t: norm(w.text), s: w.start + OFF }));
const errs = [];
const words = segs.flatMap(s => s.words.map(w => ({ ...w, approx: s.approx })));
for (const w of words) {
  const n = norm(w.text); if (!n) continue;
  let best = null;
  for (const t of tw) if (t.t === n && Math.abs(t.s - w.start) < 3 && (!best || Math.abs(t.s - w.start) < Math.abs(best.s - w.start))) best = t;
  if (best) { errs.push(w.start - best.s); if (Math.abs(w.start - best.s) > 0.3) console.log('  off', w.text, w.start.toFixed(2), 'truth', best.s.toFixed(2)); }
}
const abs = errs.map(Math.abs).sort((a, b) => a - b);
const q = p => abs.length ? abs[Math.min(abs.length - 1, Math.floor(p * abs.length))].toFixed(2) : '-';
const mean = errs.length ? (errs.reduce((a, b) => a + b, 0) / errs.length).toFixed(2) : '-';
const result = { vp, total_s: ((tEnd - tStart) / 1000).toFixed(1), first_caption_s: firstCap ? ((firstCap - tStart) / 1000).toFixed(1) : null,
  recognized: words.length, truth: tw.length, matched: errs.length, err_median: q(0.5), err_p90: q(0.9), err_mean_signed: mean, approx: segs.some(s => s.approx) };
console.log(JSON.stringify(result));
console.log('TEXT:', segs.map(s => `[${s.start.toFixed(2)}-${s.end.toFixed(2)}] ${s.words.map(w => w.text).join(' ')}`).join('\n'));
console.log('STAGES:', statusLog.join(' | '));
if (log.length) console.log('CONSOLE:', log.slice(0, 10).join('\n'));
await browser.close(); server.close();
assert.ok(result.matched / result.truth >= 0.9, `only ${result.matched} of ${result.truth} words recognized`);
assert.equal(result.approx, false, 'word timing kept by switching model builds');
assert.ok(+result.err_median <= 0.15, `median timing error ${result.err_median} s`);
assert.ok(+result.err_p90 <= 0.4, `90% timing error ${result.err_p90} s`);
assert.ok(segs[0].start >= OFF - 0.15, `first caption at ${segs[0].start} s, before the speech at ${OFF} s`);
assert.ok(firstCap && firstCap < tEnd - 2000, 'captions appear part by part, before the whole video is done');
console.log('PASS real speech-to-text: accuracy, timing and progressive captions');
