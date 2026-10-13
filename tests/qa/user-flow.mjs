// Real user flow with the real speech model: upload → captions → captions visible on the video →
// switch templates several times and check the preview really changes each time.
// Usage: node tests/qa/user-flow.mjs <video.webm> [desktop|phone] [spoken=hindi] [caption=Hinglish]
// Needs the model cache from `npm run test:asr` (tests/asr/.cache).
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..'), SITE = join(REPO, 'site'), OUT = join(REPO, 'tests/qa/out');
const [video, vp = 'desktop', spoken = 'hindi', captionOpt = 'Hinglish'] = process.argv.slice(2);
const CACHE = join(REPO, 'tests/asr/.cache'), TF = join(CACHE, 'tf/package/dist');
const MODEL_DIRS = [join(CACHE, 'wb/package/models'), join(CACHE, 'ws/package/models')];
const T = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  try { const b = await readFile(join(SITE, p)); res.writeHead(200, { 'content-type': T[extname(p)] || 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://localhost:${server.address().port}`;
let pw; try { pw = await import('playwright'); } catch { pw = await import(join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright', 'index.mjs')); }
const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext(vp === 'phone'
  ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' }
  : { viewport: { width: 1366, height: 768 } });
const fileRoute = async (route, path) => { try { route.fulfill({ status: 200, body: await readFile(path), headers: { 'content-type': T[extname(path)] || 'application/octet-stream', 'access-control-allow-origin': '*' } }); } catch { route.fulfill({ status: 404, body: '', headers: { 'access-control-allow-origin': '*' } }); } };
await ctx.route('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/**', r => fileRoute(r, join(TF, new URL(r.request().url()).pathname.split('/dist/')[1])));
// Model files (up to 157 MB) are too big to hand over through Playwright, so redirect to a local server.
const modelServer = createServer(async (req, res) => {
  const m = decodeURIComponent(new URL(req.url, 'http://x').pathname).match(/^\/([^/]+\/[^/]+)\/resolve\/[^/]+\/(.+)$/);
  const dir = m && MODEL_DIRS.find(d => m[1].startsWith('Xenova/whisper-small') ? d.includes('/ws/') : d.includes('/wb/'));
  try { const b = await readFile(join(dir, m[1], m[2])); res.writeHead(200, { 'content-type': 'application/octet-stream', 'access-control-allow-origin': '*' }); res.end(b); }
  catch { res.writeHead(404, { 'access-control-allow-origin': '*' }); res.end(); }
}).listen(0);
await ctx.route('https://huggingface.co/**', r => r.fulfill({ status: 302, headers: { location: `http://localhost:${modelServer.address().port}${new URL(r.request().url()).pathname}`, 'access-control-allow-origin': '*' } }));
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
const page = await ctx.newPage();
browser.on('disconnected', () => console.log('BROWSER DISCONNECTED at', ((Date.now() - (globalThis.T0 || Date.now())) / 1000).toFixed(1), 's'));
const log = [];
page.on('console', m => { if (/error|warn/.test(m.type())) log.push(m.type() + ': ' + m.text().slice(0, 200)); });
page.on('pageerror', e => log.push('PAGEERROR ' + e.message));
page.on('close', () => console.log('PAGE CLOSED'));
page.on('crash', () => console.log('PAGE CRASHED (out of memory?) after', ((Date.now() - (globalThis.T0 || Date.now())) / 1000).toFixed(1), 's'));
await mkdir(OUT, { recursive: true });
const report = [];
const ok = (cond, msg) => { report.push(`${cond ? 'PASS' : 'FAIL'} ${msg}`); };
await page.goto(`${BASE}/app.html`);
await page.evaluate(() => localStorage.clear());
await page.setInputFiles('#startFile', video);
await page.waitForSelector('#startPreview:not([hidden])');
await page.click('#spokenCombo .combo-btn'); await page.fill('#spokenCombo input', spoken); await page.keyboard.press('Enter');
await page.waitForTimeout(300);
if (await page.isVisible('#captionCombo .combo-btn')) { await page.click('#captionCombo .combo-btn'); await page.click(`#captionCombo [role=option]:has-text("${captionOpt}")`); }
const t0 = globalThis.T0 = Date.now(); const stages = [];
for (;;) {
  const st = await page.evaluate(() => ({ n: window.__vcz.S.segments.length, s: document.getElementById('status').textContent, ov: document.getElementById('genOvText').textContent, hid: document.getElementById('genOv').hidden }));
  if (stages.at(-1) !== st.ov) { stages.push(st.ov); console.log(((Date.now() - t0) / 1000).toFixed(1), 's', st.ov); }
  if (/Couldn’t|failed|No speech/i.test(st.s) || (st.hid && Date.now() - t0 > 3000)) { stages.push('STATUS: ' + st.s); break; }
  if (Date.now() - t0 > 300000) { stages.push('TIMEOUT'); break; }
  await page.waitForTimeout(300);
}
const segs = await page.evaluate(() => window.__vcz.S.segments.map(s => `[${s.start.toFixed(2)}-${s.end.toFixed(2)}] ${s.words.map(w => w.text).join(' ')}`));
ok(segs.length > 0, `captions generated in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${segs.length} captions`);
// If the model heard nothing usable, still test the editor with typed captions (as a user would add them).
if (!segs.length) await page.evaluate(() => window.__vcz.setSegments([window.__vcz.C.makeSegment(window.__vcz.C.spreadWords('bhaiya ye AC ko kya ho raha hai', 0.6, 3.8))]));
// Captions must be drawn on the preview while the video plays at a time inside a caption.
const mid = await page.evaluate(() => { const s = window.__vcz.S.segments[0]; return s ? (s.start + s.end) / 2 : 1; });
const shot = async name => { const b = await page.locator('#stage').screenshot(); await writeFile(join(OUT, `${vp}-${name}.png`), b); return createHash('md5').update(b).digest('hex'); };
await page.evaluate(t => { const v = window.__vczVideo; v.pause(); v.currentTime = t; }, mid);
await page.waitForTimeout(600);
const withCap = await shot('caption');
// Same frame without captions, for comparison.
const saved = await page.evaluate(() => { const s = window.__vcz.S.segments; window.__vcz.setSegments([]); return s; });
await page.waitForTimeout(400);
const noCapHash = await shot('nocaption');
await page.evaluate(s => window.__vcz.setSegments(s), saved);
await page.waitForTimeout(400);
ok(withCap !== noCapHash, 'captions are drawn on the video');
// Template switching: each click must change the preview and the selected template.
const tiles = vp === 'phone' ? '#mTpl .tpl' : '#grid .tpl';
const names = await page.$$eval(tiles, els => els.slice(0, 8).map(e => e.textContent.trim()));
const hashes = new Set([await shot('tpl-0')]);
for (let i = 1; i < 7; i++) {
  await page.locator(tiles).nth(i).scrollIntoViewIfNeeded();
  await page.locator(tiles).nth(i).click();
  await page.waitForTimeout(500);
  const id = await page.evaluate(() => window.__vcz.S.tplId);
  const h = await shot(`tpl-${i}`);
  ok(!hashes.has(h), `template ${i} "${names[i]}" (${id}) changes the preview`);
  hashes.add(h);
}
// Play through: captions appear while playing.
await page.evaluate(() => { const v = window.__vczVideo; v.currentTime = 0; v.muted = true; return v.play(); });
await page.waitForTimeout(1500);
await shot('playing');
console.log(`== ${vp} | ${video.split('/').pop()}`);
console.log('STAGES:', stages.join(' | '));
console.log('CAPTIONS:\n  ' + segs.join('\n  '));
console.log(report.join('\n'));
if (log.length) console.log('CONSOLE:\n  ' + log.slice(0, 12).join('\n  '));
await browser.close(); server.close(); modelServer.close();
process.exit(report.some(r => r.startsWith('FAIL')) ? 1 : 0);
