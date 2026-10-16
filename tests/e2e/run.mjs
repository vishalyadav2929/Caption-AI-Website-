// End-to-end test of the real editor in Chromium: upload → captions → edit → template → style → export.
// Verifies the exported file with ffprobe/ffmpeg (duration, audio track, caption pixels).
// Usage: npm run test:e2e   (needs Playwright + Chromium and ffmpeg on PATH)
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = join(REPO, 'site');
const OUT = join(REPO, 'tests', 'e2e', 'out');
const FIX = join(REPO, 'tests', 'fixtures');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webm': 'video/webm', '.srt': 'text/plain', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* fall back to a global install */ }
  const g = execFileSync('npm', ['root', '-g']).toString().trim();
  return import(join(g, 'playwright', 'index.mjs'));
}

const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const body = await readFile(join(ROOT, p === '/' ? 'index.html' : p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://localhost:${server.address().port}`;

const results = [];
const step = async (name, fn) => {
  try { await fn(); results.push(['PASS', name]); console.log('PASS', name); }
  catch (e) { results.push(['FAIL', name, e.message]); console.log('FAIL', name, '\n  ', e.message); }
};

const { chromium } = await loadPlaywright();
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, serviceWorkers: 'block' });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
const vcz = fn => page.evaluate(fn);

await step('start screen loads with upload card and disabled button', async () => {
  await page.goto(`${BASE}/app.html`);
  await page.waitForSelector('#startDrop');
  assert.equal(await page.textContent('#startGoText'), 'Upload Video First');
  assert.equal(await page.isDisabled('#startGo'), true);
});

await step('rejects a non-video file with a clear message', async () => {
  await page.setInputFiles('#startFile', join(FIX, 'sample.srt'));
  await page.waitForFunction(() => document.getElementById('toast').textContent.includes('isn’t a video'));
});

await step('upload shows preview and real metadata', async () => {
  await page.setInputFiles('#startFile', join(FIX, 'portrait.webm'));
  await page.waitForSelector('#startPreview:not([hidden])');
  const meta = await page.textContent('#startMeta');
  assert.match(meta, /portrait\.webm · 540×960 · 0:06/);
});

await step('upload without saved languages asks for them', async () => {
  assert.match(await page.textContent('#startMsg'), /Choose the spoken language/);
  assert.equal(await page.isVisible('#editor'), false);
});

await step('choosing languages starts captions automatically and opens the editor', async () => {
  await page.click('#spokenCombo .combo-btn');
  await page.fill('#spokenCombo input', 'hindi');
  await page.keyboard.press('Enter');
  await page.click('#captionCombo .combo-btn');
  const opts = await page.$$eval('#captionCombo [role=option]', els => els.map(e => e.textContent));
  assert.deepEqual(opts, ['Hindi', 'Hinglish (Roman Hindi)', 'English']);
  await page.click('#captionCombo [role=option]:has-text("Hinglish")');
  await page.waitForSelector('#editor:not([hidden])');
  // Offline sandbox: the model can't download, so it must fail with a clear message and no fake captions.
  await page.waitForFunction(() => /Couldn’t generate captions/.test(document.getElementById('status').textContent), null, { timeout: 60000 });
  console.log('   message shown:', await page.textContent('#status'));
  assert.equal(await vcz(() => window.__vcz.S.segments.length), 0, 'no fake captions');
  assert.equal(await vcz(() => window.__vczAudioLength), 6 * 16000, 'decoded 6 s of 16 kHz audio');
  const saved = await page.evaluate(() => localStorage.getItem('vcz-langs'));
  assert.match(saved, /hinglish/);
});

await step('sample caption shows the template on the video before captions exist', async () => {
  await page.locator('#grid .tpl', { hasText: 'Classic' }).first().click();
  await page.waitForTimeout(300);
  const a = await page.locator('#stage').screenshot();
  await page.locator('#grid .tpl', { hasText: 'Pop-up Chat' }).first().click();
  await page.waitForTimeout(300);
  const b = await page.locator('#stage').screenshot();
  assert.notDeepEqual(a, b);
  await writeFile(join(OUT, 'sample-caption.png'), b);
});

await step('real-time audio fallback (used when a browser can’t decode the file) reads the full track', async () => {
  await page.evaluate(() => { window.__vczForceRealtime = true; window.__vczAudioLength = 0; window.__vczKeepAudio = true; });
  await page.evaluate(() => { document.getElementById('moreOpts').open = true; });
  await page.click('#genBtn');
  await page.waitForFunction(() => /Couldn’t generate captions/.test(document.getElementById('status').textContent) && window.__vczAudioLength > 0, null, { timeout: 60000 });
  const len = await vcz(() => window.__vczAudioLength);
  assert.ok(Math.abs(len / 16000 - 6) < 0.6, `captured ${len / 16000}s`);
  // Captured faster than real time, but the 440 Hz test tone must come back at 440 Hz (no chipmunk voice).
  const hz = await page.evaluate(() => {
    const a = window.__vczAudio; let z = 0;
    const from = 16000, to = Math.min(a.length, 16000 * 4);
    for (let i = from + 1; i < to; i++) if (a[i - 1] <= 0 && a[i] > 0) z++;
    return z / ((to - from) / 16000);
  });
  assert.ok(Math.abs(hz - 440) < 15, `pitch ${hz.toFixed(1)} Hz`);
  console.log('   fast capture pitch', hz.toFixed(1), 'Hz');
  await page.evaluate(() => { window.__vczForceRealtime = false; window.__vczKeepAudio = false; });
});

await step('editor shows an empty-state message', async () => {
  assert.match(await page.textContent('#segs'), /No captions yet/);
});

await step('SRT import creates timed captions', async () => {
  await page.setInputFiles('#srtIn', join(FIX, 'sample.srt'));
  await page.waitForFunction(() => window.__vcz.S.segments.length > 0);
  const segs = await vcz(() => window.__vcz.S.segments.map(s => [s.start, s.end, s.words.map(w => w.text).join(' ')]));
  assert.equal(segs.length, 3);
  assert.deepEqual(segs[0], [0.3, 2, 'this is how your']);
});

await step('edit text, split, merge, add, delete, undo, redo', async () => {
  const ta = page.locator('#segs .seg textarea').first();
  await ta.fill('this is exactly how your');
  await ta.blur();
  let t = await vcz(() => window.__vcz.S.segments[0].words.map(w => w.text).join(' '));
  assert.equal(t, 'this is exactly how your');
  await page.locator('#segs .seg').first().locator('button[title="Split at cursor"]').click();
  assert.equal(await vcz(() => window.__vcz.S.segments.length), 4);
  await page.locator('#segs .seg').first().locator('button[title="Merge with next"]').click();
  assert.equal(await vcz(() => window.__vcz.S.segments.length), 3);
  await page.locator('#segs .seg').nth(2).locator('button[title="Add caption after"]').click();
  assert.equal(await vcz(() => window.__vcz.S.segments.length), 4);
  await page.locator('#segs .seg').nth(3).locator('button[title="Delete caption"]').click();
  assert.equal(await vcz(() => window.__vcz.S.segments.length), 3);
  await page.click('#undoBtn');
  assert.equal(await vcz(() => window.__vcz.S.segments.length), 4);
  await page.click('#redoBtn');
  assert.equal(await vcz(() => window.__vcz.S.segments.length), 3);
});

await step('editing a time moves the caption', async () => {
  const inp = page.locator('#segs .seg').nth(1).locator('.t-in').first();
  await inp.fill('0:02.50');
  await inp.press('Enter');
  await inp.blur();
  const s = await vcz(() => window.__vcz.S.segments[1].start);
  assert.equal(s, 2.5);
});

async function captionPixels() {
  // Count bright, saturated-white pixels in the canvas centre band (captions), at 1.0 s.
  return vcz(async () => {
    const v = document.querySelector('canvas#stage');
    await new Promise(r => setTimeout(r, 120));
    const d = v.getContext('2d').getImageData(0, 0, v.width, v.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) n++;
    return n;
  });
}

await step('template change updates the real preview', async () => {
  await vcz(() => { const v = document.querySelector('video'); });
  await page.evaluate(() => { window.__vcz.S.o.pos = 0.5; });
  await page.locator('#seek').evaluate(el => { el.value = 170; el.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(300);
  await page.locator('#grid .tpl', { hasText: 'Classic' }).first().click();
  const before = await page.locator('#stage').screenshot();
  await page.locator('#grid .tpl', { hasText: 'Pop-up Chat' }).first().click();
  await page.waitForTimeout(400);
  const after = await page.locator('#stage').screenshot();
  assert.notDeepEqual(before, after);
  assert.equal(await vcz(() => window.__vcz.tpl().id), 'popup-chat');
  await writeFile(join(OUT, 'preview-popup-chat.png'), after);
});

await step('style controls change the template used for preview and export', async () => {
  await page.click('#tabStyle');
  await page.locator('#strokeW').fill('20');
  await page.locator('#strokeW').dispatchEvent('change');
  await page.locator('#bgOp').fill('70');
  await page.locator('#bgOp').dispatchEvent('change');
  await page.click('#alignCtl button[data-v="left"]');
  const t = await vcz(() => window.__vcz.tpl());
  assert.equal(t.stroke.w, 0.2);
  assert.match(t.bg.c, /rgba\(0,0,0,0\.7\)/);
  assert.equal(t.align, 'left');
  await page.click('#resetStyle');
  const r = await vcz(() => window.__vcz.tpl());
  assert.equal(r.align, undefined);
  await page.click('#tabCaptions');
});

async function doExport(kind, res = 0) {
  const dl = page.waitForEvent('download', { timeout: 90000 });
  await page.click('#exportBtn');
  await page.waitForSelector('#xDlg[open]');
  await page.check(`input[name=xKind][value=${kind}]`);
  await page.selectOption('#xRes', String(res));
  await page.click('#xGo');
  const d = await dl;
  const file = join(OUT, d.suggestedFilename());
  await d.saveAs(file);
  await page.waitForSelector('#exportOv', { state: 'hidden' });
  const streams = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height:stream_tags=alpha_mode', '-of', 'csv=p=0', file]).toString();
  const dec = execFileSync('sh', ['-c', `ffmpeg -i "${file}" -f null - 2>&1 | grep -o 'time=[0-9:.]*' | tail -1`]).toString();
  const [, h, m, sec] = dec.match(/time=(\d+):(\d+):([\d.]+)/);
  return { file, streams, dur: +h * 3600 + +m * 60 + +sec };
}

await step('export: video with burned-in captions at original resolution with original audio', async () => {
  await page.locator('#grid .tpl', { hasText: 'High Contrast' }).first().click();
  await page.waitForTimeout(200);
  const { file, streams, dur } = await doExport('video', 0);
  assert.match(streams, /video/); assert.match(streams, /audio/);
  assert.match(streams, /540,960/, 'original resolution kept');
  if (file.endsWith('.mp4')) assert.match(streams, /h264/, 'MP4 must contain H.264 video');
  assert.ok(dur > 5 && dur < 7.5, `duration ${dur}`);
  const fmtDur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim();
  assert.ok(+fmtDur > 5, `container duration header: ${fmtDur}`);
  const vol = execFileSync('sh', ['-c', `ffmpeg -i "${file}" -vn -af volumedetect -f null - 2>&1 | grep -o 'mean_volume: [-0-9.]*'`]).toString();
  assert.ok(+vol.split(':')[1] > -35, `exported audio too quiet: ${vol}`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1.2', '-i', file, '-frames:v', '1', join(OUT, 'export-frame.png')]);
  const yellow = execFileSync('sh', ['-c', `ffmpeg -v error -i "${join(OUT, 'export-frame.png')}" -vf "crop=iw:ih*0.25:0:ih*0.68,format=rgb24" -f rawvideo - | od -An -tu1 -v -w3 | awk '$1>200 && $2>200 && $3<90' | wc -l`]).toString();
  assert.ok(+yellow > 200, `caption pixels in exported frame: ${yellow.trim()}`);
  console.log('   video:', file.split('/').pop(), '|', streams.trim().replace(/\n/g, ' / '), '|', dur.toFixed(2), 's | header', fmtDur, '| audio', vol.trim(), '| caption px', yellow.trim());
});

await step('export (WebCodecs path): every frame encoded, original resolution, audio kept, captions burned in', async () => {
  // This Chromium has no H.264 encoder, so let the WebCodecs path use VP9 for the test; on Safari/Chrome it's H.264.
  await page.evaluate(() => { window.__vczExportCodecs = ['vp09.00.40.08']; });
  const { file, streams, dur } = await doExport('video', 0);
  const used = await page.evaluate(() => window.__vczLastExport);
  await page.evaluate(() => { delete window.__vczExportCodecs; });
  assert.equal(used, 'webcodecs');
  assert.ok(file.endsWith('.mp4'), file);
  assert.match(streams, /video/); assert.match(streams, /audio/);
  assert.match(streams, /540,960/, 'original resolution kept');
  assert.ok(dur > 5.5 && dur < 6.6, `duration ${dur}`);
  const srcFrames = +execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', join(FIX, 'portrait.webm')]).toString().trim();
  const outFrames = +execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file]).toString().trim();
  assert.ok(outFrames >= srcFrames * 0.9, `frames: ${outFrames} of ${srcFrames}`);
  const vol = execFileSync('sh', ['-c', `ffmpeg -i "${file}" -vn -af volumedetect -f null - 2>&1 | grep -o 'mean_volume: [-0-9.]*'`]).toString();
  assert.ok(+vol.split(':')[1] > -35, `exported audio too quiet: ${vol}`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1.2', '-i', file, '-frames:v', '1', join(OUT, 'export-wc-frame.png')]);
  const yellow = execFileSync('sh', ['-c', `ffmpeg -v error -i "${join(OUT, 'export-wc-frame.png')}" -vf "crop=iw:ih*0.25:0:ih*0.68,format=rgb24" -f rawvideo - | od -An -tu1 -v -w3 | awk '$1>200 && $2>200 && $3<90' | wc -l`]).toString();
  assert.ok(+yellow > 200, `caption pixels in exported frame: ${yellow.trim()}`);
  console.log('   webcodecs:', file.split('/').pop(), '|', streams.trim().replace(/\n/g, ' / '), '| frames', outFrames, 'of', srcFrames, '| audio', vol.trim(), '| caption px', yellow.trim());
});

await step('export: captions only with a transparent background', async () => {
  const { file, streams, dur } = await doExport('alpha', 0);
  assert.match(streams, /540,960/);
  assert.match(streams, /,1\s*$/m, 'alpha_mode=1');
  assert.doesNotMatch(streams, /audio/);
  assert.ok(dur > 5 && dur < 7.5, `duration ${dur}`);
  const codec = /vp8/.test(streams) ? 'libvpx' : 'libvpx-vp9';
  const stats = execFileSync('sh', ['-c', `ffmpeg -v error -c:v ${codec} -ss 1.2 -i "${file}" -frames:v 1 -vf "alphaextract,format=gray" -f rawvideo - | od -An -tu1 -v -w1 | awk '$1<10{t++} $1>245{o++} END{print t, o}'`]).toString().trim().split(' ').map(Number);
  const [transparent, opaque] = stats;
  assert.ok(transparent > 540 * 960 * 0.6, `transparent px ${transparent}`);
  assert.ok(opaque > 1000, `opaque caption px ${opaque}`);
  console.log('   transparent:', file.split('/').pop(), '| transparent px', transparent, '| opaque px', opaque);
});

await step('export: captions only on green screen', async () => {
  const { file, streams } = await doExport('green', 0);
  assert.match(streams, /540,960/);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1.2', '-i', file, '-frames:v', '1', join(OUT, 'green-frame.png')]);
  const green = execFileSync('sh', ['-c', `ffmpeg -v error -i "${join(OUT, 'green-frame.png')}" -vf format=rgb24 -f rawvideo - | od -An -tu1 -v -w3 | awk '$1<60 && $2>200 && $3<60' | wc -l`]).toString();
  assert.ok(+green > 540 * 960 * 0.6, `green px ${green.trim()}`);
  console.log('   green screen:', file.split('/').pop(), '| green px', green.trim());
});

await step('replacing the video asks first when there are captions; landscape sizes the canvas to 16:9', async () => {
  const hadCaptions = await vcz(() => window.__vcz.S.segments.length);
  let asked = '';
  page.once('dialog', d => { asked = d.message(); d.accept(); });
  await page.setInputFiles('#fileIn', join(FIX, 'landscape.webm'));
  await page.waitForFunction(() => document.getElementById('meta').textContent.includes('960×540'));
  await page.waitForTimeout(300);
  const dims = await vcz(() => [document.getElementById('stage').width, document.getElementById('stage').height]);
  assert.deepEqual(dims, [960, 540]);
  if (hadCaptions) assert.match(asked, /captions will be removed/);
});

await step('no horizontal overflow on phones, tablets and laptops (incl. editor with a video loaded)', async () => {
  const sizes = [[375, 667, true], [390, 844, true], [412, 915, true], [768, 1024, true], [1024, 768, true], [1280, 720, false], [1440, 900, false]];
  for (const [w, h, mobile] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile && w < 1000, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, serviceWorkers: 'block' });
    const m = await ctx.newPage();
    const over = async label => {
      const r = await m.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth, innerWidth]);
      assert.ok(r[0] <= r[1] + 1 && r[2] <= r[1] + 1, `${w}px ${label}: page is ${r[0]}px wide (viewport ${r[1]}, innerWidth ${r[2]})`);
    };
    for (const p of ['index.html', 'templates.html', 'privacy.html', 'app.html']) { await m.goto(`${BASE}/${p}`); await m.waitForTimeout(300); await over(p); }
    await m.click('#startSkip');
    await m.setInputFiles('#fileIn', join(FIX, 'portrait.webm'));
    await m.waitForTimeout(400);
    await m.setInputFiles('#srtIn', join(FIX, 'sample.srt'));
    await m.waitForTimeout(300);
    await over('editor with video');
    if (w === 390) await m.screenshot({ path: join(OUT, 'mobile-editor.png') });
    await m.click('#exportBtn'); await m.waitForTimeout(150); await over('export dialog');
    await ctx.close();
  }
});

await step('iPhone-style audio lock: shows “Tap to start captions”, and a tap reads the audio', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    localStorage.setItem('vcz-langs', JSON.stringify({ spoken: 'Hindi — हिन्दी', caption: 'hinglish', quality: 'balanced' }));
    window.__vczForceRealtime = true; // the path iPhone takes when it can't decode a .mov directly
    let tapped = false;
    addEventListener('pointerdown', () => { tapped = true; }, true);
    addEventListener('touchstart', () => { tapped = true; }, true);
    const AC = window.AudioContext, resume = AC.prototype.resume, play = HTMLMediaElement.prototype.play;
    Object.defineProperty(AC.prototype, 'state', { get() { return this.__running ? 'running' : 'suspended'; } });
    AC.prototype.resume = function () { if (tapped) { this.__running = true; return resume.call(this); } return new Promise(() => {}); };
    HTMLMediaElement.prototype.play = function () { return tapped ? play.call(this) : Promise.reject(new DOMException('blocked', 'NotAllowedError')); };
  });
  const m = await ctx.newPage();
  await m.goto(`${BASE}/app.html`);
  await m.setInputFiles('#startFile', join(FIX, 'portrait.webm'));
  await m.waitForSelector('#editor:not([hidden])');
  await m.waitForSelector('#genOvTap:not([hidden])', { timeout: 15000 });
  await m.screenshot({ path: join(OUT, 'mobile-tap-to-start.png') });
  await m.tap('#genOvTap');
  await m.waitForFunction(() => window.__vczAudioLength > 0, null, { timeout: 30000 });
  const len = await m.evaluate(() => window.__vczAudioLength);
  assert.ok(Math.abs(len / 16000 - 6) < 0.6, `read ${len / 16000}s of audio after the tap`);
  await ctx.close();
});

await step('drag the captions up/down on the video; A−/A+ change size', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  const m = await ctx.newPage();
  await m.goto(`${BASE}/app.html`);
  await m.click('#startSkip');
  await m.setInputFiles('#fileIn', join(FIX, 'portrait.webm'));
  await m.waitForTimeout(400);
  await m.setInputFiles('#srtIn', join(FIX, 'sample.srt'));
  const box = await m.locator('#stage').boundingBox();
  const before = await m.evaluate(() => window.__vcz.tpl().pos ?? 0.72);
  await m.mouse.move(box.x + box.width / 2, box.y + box.height * 0.5);
  await m.mouse.down();
  await m.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3, { steps: 6 });
  await m.mouse.up();
  const after = await m.evaluate(() => window.__vcz.S.o.pos);
  assert.ok(after < before - 0.15, `position moved up: ${before} → ${after}`);
  assert.equal(await m.evaluate(() => document.querySelector('video').paused), true, 'dragging must not start playback');
  await m.click('#szUp'); await m.click('#szUp');
  assert.equal(await m.evaluate(() => window.__vcz.S.o.scale), 1.2);
  await m.click('#szDown');
  assert.equal(await m.evaluate(() => window.__vcz.S.o.scale), 1.1);
  await ctx.close();
});

await step('translate captions with the browser translator (mocked) keeps the timing', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    self.Translator = {
      availability: async () => 'available',
      create: async ({ sourceLanguage, targetLanguage }) => ({ translate: async t => `[${sourceLanguage}>${targetLanguage}] ` + t.toUpperCase() }),
    };
  });
  const m = await ctx.newPage();
  await m.goto(`${BASE}/app.html`);
  await m.click('#startSkip');
  await m.setInputFiles('#fileIn', join(FIX, 'portrait.webm'));
  await m.waitForTimeout(300);
  await m.setInputFiles('#srtIn', join(FIX, 'sample.srt'));
  await m.evaluate(() => { document.getElementById('lang').value = '3'; }); // English (US) as caption language
  const before = await m.evaluate(() => window.__vcz.S.segments.map(s => [s.start, s.end]));
  await m.selectOption('#trTarget', { label: 'Spanish — Español' });
    await m.waitForFunction(() => /Translated to/.test(document.getElementById('status').textContent));
  const text = await m.evaluate(() => window.__vcz.S.segments.map(s => s.words.map(w => w.text).join(' ')).join(' | '));
  assert.match(text, /\[en>es\]/);
  assert.match(text.replace(/ \| /g, ' '), /THIS IS HOW YOUR/);
  const span = await m.evaluate(() => [window.__vcz.S.segments[0].start, window.__vcz.S.segments.at(-1).end]);
  assert.deepEqual(span, [before[0][0], before.at(-1)[1]], 'overall timing kept');
  await m.click('#undoBtn');
  assert.doesNotMatch(await m.evaluate(() => window.__vcz.S.segments.map(s => s.words.map(w => w.text).join(' ')).join(' ')), /\[en>es\]/);
  await ctx.close();
});

await step('without a browser translator: English captions → Hinglish → Hindi → Bangla (online service mocked)', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const asked = [];
  const HI = { 'this is how your reels go viral': 'ऐसे तुम्हारी रील्स वायरल होती हैं', 'my friend': 'मेरा दोस्त' };
  await ctx.route('https://api.mymemory.translated.net/**', route => {
    const u = new URL(route.request().url());
    const q = u.searchParams.get('q'), pair = u.searchParams.get('langpair');
    asked.push(pair);
    const out = pair === 'en|hi' ? (HI[q.replace(/[.!?]$/, '')] || q) : `[${pair}] ${q}`;
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ responseData: { translatedText: out }, responseStatus: 200 }) });
  });
  await ctx.addInitScript(() => { delete self.Translator; }); // like iPhone Safari
  const m = await ctx.newPage();
  await m.goto(`${BASE}/app.html`);
  assert.equal(await m.evaluate(() => 'Translator' in self), false);
  await m.click('#startSkip');
  await m.setInputFiles('#fileIn', join(FIX, 'portrait.webm'));
  await m.waitForTimeout(300);
  const srt = '1\n00:00:00,300 --> 00:00:02,000\nthis is how your\n\n2\n00:00:02,000 --> 00:00:04,000\nreels go viral.\n\n3\n00:00:05,000 --> 00:00:06,500\nmy friend\n';
  await m.setInputFiles('#srtIn', { name: 'en.srt', mimeType: 'text/plain', buffer: Buffer.from(srt) });
  await m.evaluate(() => { document.getElementById('lang').value = '0'; }); // Hindi picked, but the text is English
  const shown = () => m.evaluate(() => window.__vcz.S.segments.map(s => s.words.map(w => w.text).join(' ')).join(' '));
  await m.selectOption('#trTarget', { label: 'Hinglish (Hindi → Roman)' });
    await m.waitForFunction(() => /Translated to/.test(document.getElementById('status').textContent));
  assert.deepEqual(asked, ['en|hi', 'en|hi'], 'English text is detected and sent as en → hi');
  assert.match(await shown(), /वायरल/);
  assert.equal(await m.evaluate(() => window.__vcz.S.hinglish), true, 'Hinglish turns on, so it shows in Roman letters');
  // Hinglish → Hindi script needs no network.
  await m.selectOption('#trTarget', { label: 'Hindi — हिन्दी' });
    assert.equal(await m.evaluate(() => window.__vcz.S.hinglish), false);
  assert.equal(asked.length, 2);
  // Hindi → Bangla.
  await m.evaluate(() => { document.getElementById('status').textContent = ''; });
  await m.selectOption('#trTarget', { label: 'Bengali — বাংলা' });
    await m.waitForFunction(() => /Translated to/.test(document.getElementById('status').textContent));
  assert.equal(asked.at(-1), 'hi|bn');
  assert.match(await shown(), /\[hi\|bn\]/);
  await ctx.close();
});

await step('phone: full screen works without the Fullscreen API (iPhone), typing un-pins the preview, home shows 12 templates', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false }); });
  const m = await ctx.newPage();
  await m.goto(`${BASE}/app.html`);
  await m.click('#startSkip');
  await m.setInputFiles('#fileIn', join(FIX, 'portrait.webm'));
  await m.waitForTimeout(300);
  await m.setInputFiles('#srtIn', join(FIX, 'sample.srt'));
  await m.click('#fsBtn');
  const box = await m.locator('#box').boundingBox();
  assert.ok(box.width >= 389 && box.height >= 840, `fills the screen: ${box.width}x${box.height}`);
  assert.equal(await m.isVisible('#fsExit'), true);
  await m.click('#fsPlay');
  await m.waitForTimeout(200);
  assert.equal(await m.evaluate(() => !window.__vczVideo.paused), true, 'play from full screen');
  await m.click('#fsExit');
  assert.ok((await m.locator('#box').boundingBox()).height < 600, 'back to normal');
  await m.locator('.seg textarea').first().focus();
  assert.equal(await m.evaluate(() => getComputedStyle(document.querySelector('.stage')).position), 'static', 'un-pinned while typing');
  await m.locator('.seg textarea').first().blur();
  await m.waitForTimeout(100);
  assert.equal(await m.evaluate(() => getComputedStyle(document.querySelector('.stage')).position), 'sticky', 'pinned again');
  await m.goto(`${BASE}/index.html`);
  await m.waitForSelector('#grid .tpl');
  const visible = () => m.$$eval('#grid .tpl', els => els.filter(e => e.offsetParent).length);
  assert.equal(await visible(), 12);
  await m.click('#moreTpl');
  assert.ok(await visible() > 50);
  await ctx.close();
});

await step('home: example videos show live captions on real clips (from examples/manifest.json)', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const m = await ctx.newPage();
  await m.goto(`${BASE}/index.html`);
  assert.equal(await m.isVisible('#showcase'), false, 'hidden while the manifest is empty');
  await m.route('**/examples/manifest.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [{ video: 'demo.webm', captions: 'demo.srt', templates: ['classic', 'crazy', 'nope'] }] }) }));
  await m.route('**/examples/demo.webm', async r => r.fulfill({ contentType: 'video/webm', body: await readFile(join(FIX, 'portrait.webm')) }));
  await m.route('**/examples/demo.srt', async r => r.fulfill({ contentType: 'text/plain', body: await readFile(join(FIX, 'sample.srt')) }));
  await m.reload();
  await m.waitForSelector('#showcase:not([hidden]) .ex');
  assert.equal(await m.locator('#exGrid .ex').count(), 2, 'unknown template ids are skipped');
  assert.match(await m.getAttribute('#exGrid .ex >> nth=0', 'href'), /app\.html\?t=classic/);
  await m.locator('#exGrid .ex').first().scrollIntoViewIfNeeded();
  await m.waitForTimeout(1500);
  const lit = await m.evaluate(() => {
    const c = document.querySelector('#exGrid canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 60) n++;
    return n;
  });
  assert.ok(lit > 1000, `video frame drawn (${lit} lit px)`);
  await ctx.close();
});

await step('fast mode (server): captions in one go when the owner has set it up; busy server falls back to the device', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  let posts = 0, cdn = 0, busy = false;
  await ctx.route('**/api/transcribe**', async r => {
    if (r.request().method() === 'GET') return r.fulfill({ contentType: 'application/json', body: '{"enabled":true}' });
    posts++;
    if (busy) return r.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"busy"}' });
    assert.equal(new URL(r.request().url()).searchParams.get('lang'), 'hi');
    const wav = r.request().postDataBuffer();
    assert.equal(wav.subarray(0, 4).toString(), 'RIFF');
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ level: 'word', words: [{ text: 'नमस्ते', start: 0.3, end: 0.9 }, { text: 'दोस्तों', start: 0.9, end: 1.6 }, { text: 'आज', start: 2.0, end: 2.4 }] }) });
  });
  await ctx.route('https://cdn.jsdelivr.net/**', r => { cdn++; r.abort(); });
  const m = await ctx.newPage();
  await m.goto(`${BASE}/app.html`);
  await m.setInputFiles('#startFile', join(FIX, 'portrait.webm'));
  await m.waitForSelector('#startPreview:not([hidden])');
  await m.click('#spokenCombo .combo-btn'); await m.fill('#spokenCombo input', 'hindi'); await m.keyboard.press('Enter');
  await m.click('#captionCombo .combo-btn'); await m.click('#captionCombo [role=option]:has-text("Hinglish")');
  await m.waitForFunction(() => /Fast mode/.test(document.getElementById('status').textContent), null, { timeout: 30000 });
  assert.equal(posts, 1, 'one 6 s clip sent');
  assert.equal(cdn, 0, 'no on-device model download in fast mode');
  const words = await m.evaluate(() => window.__vcz.S.segments.flatMap(s => s.words.map(w => w.text)));
  assert.deepEqual(words, ['नमस्ते', 'दोस्तों', 'आज']);
  assert.equal(await m.isVisible('#cloudRow'), false, 'option lives under More options');
  await m.evaluate(() => { document.getElementById('moreOpts').open = true; });
  assert.equal(await m.isVisible('#cloudRow'), true);
  // Busy server: falls back to on-device captions (which can't download here, so it ends with a clear message).
  busy = true;
  m.once('dialog', d => d.accept()); // "replace the current captions?"
  await m.click('#genBtn');
  await m.waitForFunction(() => /Couldn’t generate captions/.test(document.getElementById('status').textContent), null, { timeout: 60000 });
  assert.equal(posts, 2);
  assert.ok(cdn > 0, 'fell back to the on-device model');
  await ctx.close();
});

await step('installable app: manifest, icons, service worker, opens offline', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const m = await ctx.newPage();
  await m.goto(`${BASE}/index.html`);
  const man = await m.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
  assert.equal(man.display, 'standalone');
  for (const ic of man.icons) assert.equal((await m.request.get(`${BASE}/${ic.src}`)).status(), 200, ic.src);
  await m.evaluate(() => navigator.serviceWorker.ready);
  await m.goto(`${BASE}/app.html`); // cached by the worker
  await m.waitForTimeout(500);
  await ctx.setOffline(true);
  await m.reload();
  assert.equal(await m.isVisible('#startDrop'), true, 'editor opens offline');
  await ctx.setOffline(false);
  await ctx.close();
});

await step('home: live demo plays the manifest clip and switches caption style on tap', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const m = await ctx.newPage();
  await m.route('**/examples/manifest.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], demo: { video: 'demo.webm', captions: 'demo.srt' } }) }));
  await m.route('**/examples/demo.webm', async r => r.fulfill({ contentType: 'video/webm', body: await readFile(join(FIX, 'portrait.webm')) }));
  await m.route('**/examples/demo.srt', async r => r.fulfill({ contentType: 'text/plain', body: await readFile(join(FIX, 'sample.srt')) }));
  await m.goto(`${BASE}/index.html`);
  await m.locator('#demo').scrollIntoViewIfNeeded();
  await m.waitForSelector('.demo-style');
  assert.ok(await m.locator('.demo-style').count() >= 8);
  assert.equal(await m.isVisible('#demoPlay'), true, 'play/mute shown when a clip exists');
  await m.waitForTimeout(1500);
  const shot = () => m.locator('#demoCap').screenshot();
  const a = await shot();
  await m.locator('.demo-style').nth(1).click();
  assert.match(await m.getAttribute('.demo-style >> nth=1', 'class'), /\bon\b/);
  await m.waitForTimeout(300);
  assert.notDeepEqual(a, await shot(), 'captioned side changes');
  await ctx.close();
});

await step('editor upload: captions start by themselves (saved languages) or a "Make captions" button shows', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: 'block' });
  const m = await ctx.newPage();
  await m.goto(`${BASE}/app.html`);
  await m.click('#startSkip');
  await m.setInputFiles('#fileIn', join(FIX, 'portrait.webm'));
  await m.waitForSelector('#makeCaptions');
  assert.match(await m.textContent('.make-lang'), /Spoken language/);
  await m.click('#makeCaptions');
  await m.waitForFunction(() => /Couldn’t generate captions/.test(document.getElementById('status').textContent), null, { timeout: 60000 });
  // With languages saved from an earlier visit, a new video starts captions straight away.
  await m.evaluate(() => localStorage.setItem('vcz-langs', JSON.stringify({ spoken: 'Hindi — हिन्दी', caption: 'hinglish', quality: 'balanced' })));
  await m.setInputFiles('#fileIn', join(FIX, 'landscape.webm'));
  await m.waitForFunction(() => !document.getElementById('genOv').hidden || /Couldn’t generate/.test(document.getElementById('status').textContent), null, { timeout: 30000 });
  await ctx.close();
});

await step('colour grading: looks change the preview, .cube import, undo, and the export carries the grade', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true, serviceWorkers: 'block' });
  const m = await ctx.newPage();
  const errs = []; m.on('pageerror', e => errs.push(e.message));
  m.on('dialog', d => d.accept()); // "export without captions?"
  await m.goto(`${BASE}/app.html`);
  await m.click('#startSkip');
  await m.setInputFiles('#fileIn', join(FIX, 'portrait.webm'));
  await m.waitForTimeout(500);
  await m.evaluate(() => { const v = window.__vczVideo; v.currentTime = 2; });
  await m.waitForTimeout(400);
  const mean = () => m.evaluate(() => { const c = document.getElementById('stage'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 64) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } return [r / n, g / n, b / n].map(Math.round); });
  const before = await mean();
  await m.click('#tabColor');
  assert.ok(await m.locator('.look').count() >= 9, 'built-in looks listed');
  await m.click('.look[data-look="bw"]');
  await m.waitForTimeout(300);
  const bw = await mean();
  assert.ok(Math.abs(bw[0] - bw[1]) <= 2 && Math.abs(bw[1] - bw[2]) <= 2, `B&W preview is grey: ${bw}`);
  assert.notDeepEqual(bw, before);
  await m.click('#undoBtn');
  await m.waitForTimeout(300);
  const undone = await mean();
  assert.ok(undone.every((v, i) => Math.abs(v - before[i]) <= 3), `undo removes the look: ${before} vs ${undone}`);
  // A .cube file that swaps red and blue.
  const rows = []; for (let b = 0; b < 2; b++) for (let g = 0; g < 2; g++) for (let r = 0; r < 2; r++) rows.push(`${b} ${g} ${r}`);
  await m.setInputFiles('#cubeIn', { name: 'swap.cube', mimeType: 'text/plain', buffer: Buffer.from(`TITLE "Swap"\nLUT_3D_SIZE 2\n${rows.join('\n')}\n`) });
  await m.waitForSelector('.look[data-look="custom"].on');
  await m.waitForTimeout(300);
  const sw = await mean();
  assert.ok(Math.abs(sw[0] - before[2]) <= 4 && Math.abs(sw[2] - before[0]) <= 4, `red/blue swapped: ${before} -> ${sw}`);
  // Export (WebCodecs path) carries the grade.
  await m.evaluate(() => { window.__vczExportCodecs = ['vp09.00.40.08']; });
  const dl = m.waitForEvent('download', { timeout: 90000 });
  await m.click('#exportBtn'); await m.waitForSelector('#xDlg[open]');
  await m.check('input[name=xKind][value=video]'); await m.click('#xGo');
  const d0 = await dl.catch(async e => { throw new Error(e.message + ' | status: ' + await m.textContent('#status') + ' | errs: ' + errs.join(';')); });
  const file = join(OUT, 'graded-' + d0.suggestedFilename()); await d0.saveAs(file);
  const px = execFileSync('sh', ['-c', `ffmpeg -v error -ss 2 -i "${file}" -frames:v 1 -vf scale=54:96,format=rgb24 -f rawvideo - | od -An -tu1 -v -w3 | awk '{r+=$1;g+=$2;b+=$3;n++} END {printf "%d %d %d", r/n, g/n, b/n}'`]).toString().split(' ').map(Number);
  assert.ok(Math.abs(px[0] - before[2]) <= 25 && Math.abs(px[2] - before[0]) <= 25, `exported frame graded: ${px} (preview before ${before})`);
  assert.deepEqual(errs, []);
  await ctx.close();
});

await step('timeline: words, captions and waveform; click jumps, double-click edits, Delete removes, Top/Bottom moves captions', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: 'block' });
  const m = await ctx.newPage();
  const errs = []; m.on('pageerror', e => errs.push(e.message));
  await m.goto(`${BASE}/app.html`);
  await m.click('#startSkip');
  await m.setInputFiles('#fileIn', join(FIX, 'portrait.webm'));
  await m.waitForSelector('#timeline:not([hidden])');
  await m.setInputFiles('#srtIn', join(FIX, 'sample.srt'));
  await m.waitForTimeout(400);
  const words = await m.locator('.tw').count();
  assert.equal(words, await m.evaluate(() => window.__vcz.S.segments.reduce((n, s) => n + s.words.length, 0)));
  assert.equal(await m.locator('.tc').count(), 3);
  const lit = await m.evaluate(() => { const c = document.querySelector('.tl-wave'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
  assert.ok(lit > 100, 'waveform drawn');
  // Click the 5th word: the video jumps to it.
  const w5 = await m.evaluate(() => window.__vcz.S.segments.flatMap(s => s.words)[4].start);
  await m.locator('.tw').nth(4).click();
  await m.waitForTimeout(200);
  assert.ok(Math.abs(await m.evaluate(() => window.__vczVideo.currentTime) - w5) < 0.1);
  // Double-click the first word and retype it.
  await m.locator('.tw').first().dblclick();
  await m.keyboard.type('THAT');
  await m.keyboard.press('Enter');
  assert.equal(await m.evaluate(() => window.__vcz.S.segments[0].words[0].text), 'THAT');
  // Select a word and delete it.
  await m.locator('.tw').nth(1).click();
  await m.keyboard.press('Delete');
  assert.equal(await m.locator('.tw').count(), words - 1);
  await m.click('#undoBtn');
  assert.equal(await m.locator('.tw').count(), words, 'undo brings the word back');
  // Position buttons.
  await m.click('.tl-pos button:has-text("Top")');
  assert.equal(await m.evaluate(() => window.__vcz.S.o.pos), 0.2);
  assert.match(await m.getAttribute('.tl-pos button:has-text("Top")', 'class'), /on/);
  await m.click('.tl-pos button:has-text("Bottom")');
  assert.equal(await m.evaluate(() => window.__vcz.S.o.pos), 0.78);
  // Click empty timeline: jump.
  const box = await m.locator('.tl-inner').boundingBox();
  await m.mouse.click(box.x + 5, box.y + 110);
  assert.ok(await m.evaluate(() => window.__vczVideo.currentTime) < 0.5);
  assert.deepEqual(errs, []);
  await ctx.close();
});

await step('sound effects: add from the menu, auto pop on captions, delete, and the export contains them', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true, serviceWorkers: 'block' });
  const m = await ctx.newPage();
  const errs = []; m.on('pageerror', e => errs.push(e.message));
  await m.goto(`${BASE}/app.html`);
  await m.click('#startSkip');
  await m.setInputFiles('#fileIn', join(FIX, 'portrait.webm'));
  await m.waitForSelector('#timeline:not([hidden])');
  await m.setInputFiles('#srtIn', join(FIX, 'sample.srt'));
  await m.click('.tl-add');
  assert.ok(await m.locator('.tl-snd').count() >= 12, 'sound list');
  await m.evaluate(() => { window.__vczVideo.currentTime = 2.5; });
  await m.waitForTimeout(200);
  await m.locator('.tl-snd .add', { hasText: 'Boom' }).click();
  assert.equal(await m.locator('.tsfx:not(.auto)').count(), 1);
  assert.equal(await m.evaluate(() => window.__vcz.S.o.sfx[0].id), 'boom');
  await m.selectOption('.tl-auto-sel', 'pop');
  assert.equal(await m.locator('.tsfx.auto').count(), 3, 'one pop per caption');
  // Select and delete the boom, then undo it back.
  await m.locator('.tsfx:not(.auto)').click();
  await m.keyboard.press('Delete');
  assert.equal(await m.locator('.tsfx:not(.auto)').count(), 0);
  await m.click('#undoBtn');
  assert.equal(await m.locator('.tsfx:not(.auto)').count(), 1);
  // Export: the boom at 2.5 s must be louder there than the original audio.
  await m.evaluate(() => { window.__vczExportCodecs = ['vp09.00.40.08']; });
  const dl = m.waitForEvent('download', { timeout: 90000 });
  await m.click('#exportBtn'); await m.waitForSelector('#xDlg[open]');
  await m.check('input[name=xKind][value=video]'); await m.click('#xGo');
  const d = await dl; const file = join(OUT, 'sfx-' + d.suggestedFilename()); await d.saveAs(file);
  const rms = (f, ss) => +execFileSync('sh', ['-c', `ffmpeg -v error -ss ${ss} -t 0.25 -i "${f}" -vn -af "lowpass=f=150,astats=metadata=1:reset=0" -f null - 2>&1; ffmpeg -ss ${ss} -t 0.25 -i "${f}" -vn -af "lowpass=f=150,volumedetect" -f null - 2>&1 | grep -o 'mean_volume: [-0-9.]*' | grep -o '[-0-9.]*$'`]).toString().trim().split('\n').pop();
  const orig = rms(join(FIX, 'portrait.webm'), 2.55), out = rms(file, 2.55);
  assert.ok(out > orig + 10, `boom audible in export: low-band ${orig} dB -> ${out} dB`);
  console.log('   sfx export: low band at 2.55 s', orig, 'dB ->', out, 'dB');
  assert.deepEqual(errs, []);
  await ctx.close();
});

await step('phones: timeline sits below the pinned preview and its buttons can be tapped (iPhone SE, Android, iPad)', async () => {
  for (const [w, h] of [[375, 667], [360, 740], [412, 915], [820, 1180]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const m = await ctx.newPage();
    await m.goto(`${BASE}/app.html`);
    await m.click('#startSkip');
    await m.setInputFiles('#fileIn', join(FIX, 'portrait.webm'));
    await m.waitForSelector('#timeline:not([hidden])');
    assert.equal(await m.evaluate(() => !!document.getElementById('timeline').closest('.stage')), false, `${w}x${h}: timeline not inside the pinned preview`);
    await m.locator('.tl-add').scrollIntoViewIfNeeded();
    await m.click('.tl-add');
    assert.equal(await m.isVisible('.tl-menu'), true, `${w}x${h}: sound menu opens`);
    const pinned = await m.evaluate(() => document.querySelector('.stage').getBoundingClientRect().height / innerHeight);
    assert.ok(pinned < 0.68, `${w}x${h}: pinned preview takes ${(pinned * 100).toFixed(0)}% of the screen`);
    assert.equal(await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `${w}x${h}: no sideways scroll`);
    await ctx.close();
  }
});

const redPx = (file, ss, crop = '') => +execFileSync('sh', ['-c', `ffmpeg -v error ${ss != null ? `-ss ${ss}` : ''} -i "${file}" -frames:v 1 -vf "${crop ? crop + ',' : ''}format=rgb24" -f rawvideo - | od -An -tu1 -v -w3 | awk '$1>200 && $2<80 && $3<80' | wc -l`]).toString();

await step('manual text: typed by hand, shown all at once, drag to move, on the timeline, burned into the export', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true, serviceWorkers: 'block' });
  const m = await ctx.newPage();
  const errs = []; m.on('pageerror', e => errs.push(e.message));
  await m.goto(`${BASE}/app.html`);
  await m.click('#startSkip');
  await m.setInputFiles('#fileIn', join(FIX, 'portrait.webm'));
  await m.waitForSelector('#timeline:not([hidden])');
  await m.click('#ltabText');
  await m.click('#txtAdd');
  await m.fill('#txtText', 'SALE 50% OFF\nAaj hi kharido');
  await m.locator('#txtText').blur();
  await m.fill('#txtColor', '#ff0000');
  await m.locator('#txtColor').dispatchEvent('change');
  const L = await m.evaluate(() => window.__vcz.S.o.texts[0]);
  assert.equal(L.text, 'SALE 50% OFF\nAaj hi kharido', 'text kept exactly as typed');
  assert.equal(L.color, '#ff0000');
  assert.equal(await m.locator('.ttx').count(), 1, 'text block on the timeline');
  // One block with both lines, drawn together.
  const b = await m.evaluate(() => window.__vcz.S.textBoxes[0]);
  assert.equal(b.lines.length, 2);
  // Drag it down on the video.
  const r = await m.locator('#stage').boundingBox();
  const cw = await m.evaluate(() => document.getElementById('stage').width);
  const k = r.width / cw;
  const sx = r.x + (b.x0 + b.w / 2) * k, sy = r.y + (b.y0 + b.h / 2) * k;
  await m.mouse.move(sx, sy); await m.mouse.down(); await m.mouse.move(sx, sy + 40, { steps: 5 }); await m.mouse.up();
  const y2 = await m.evaluate(() => window.__vcz.S.o.texts[0].y);
  assert.ok(y2 > L.y + 0.05, `text moved down: ${L.y} -> ${y2}`);
  await m.click('#undoBtn');
  assert.ok(Math.abs(await m.evaluate(() => window.__vcz.S.o.texts[0].y) - L.y) < 0.001, 'undo moves it back');
  // Template change keeps the text (it used to wipe sounds and colour too).
  await m.click('#ltabTpl');
  await m.locator('#grid .tpl', { hasText: 'Classic' }).first().click();
  assert.equal(await m.evaluate(() => window.__vcz.S.o.texts.length), 1, 'template change keeps text');
  // Export: red text in the frame at 1 s.
  await m.evaluate(() => { window.__vczExportCodecs = ['vp09.00.40.08']; });
  const dl = m.waitForEvent('download', { timeout: 90000 });
  await m.click('#exportBtn'); await m.waitForSelector('#xDlg[open]');
  await m.check('input[name=xKind][value=video]'); await m.click('#xGo');
  const d = await dl; const file = join(OUT, 'text-' + d.suggestedFilename()); await d.saveAs(file);
  // Pixels in the top half that differ strongly from the source video at the same moment = the text.
  const diffPx = ss => +execFileSync('bash', ['-c', `paste -d' ' <(ffmpeg -v error -ss ${ss} -i "${file}" -frames:v 1 -vf "crop=iw:ih*0.5:0:0,format=rgb24" -f rawvideo - | od -An -tu1 -v -w3) <(ffmpeg -v error -ss ${ss} -i "${join(FIX, 'portrait.webm')}" -frames:v 1 -vf "crop=iw:ih*0.5:0:0,format=rgb24" -f rawvideo - | od -An -tu1 -v -w3) | awk '{d=($1-$4)^2+($2-$5)^2+($3-$6)^2; if (d>20000) n++} END {print n+0}'`]).toString();
  const at1 = diffPx(1), at5 = diffPx(5);
  assert.ok(at1 > 300, `text in export at 1 s: ${at1} changed px`);
  assert.ok(at5 < at1 / 10, `text gone after its end time: ${at5} changed px at 5 s`);
  console.log('   text export: changed px at 1 s', at1, '| at 5 s', at5);
  assert.deepEqual(errs, []);
  await ctx.close();
});

await step('photo: open a JPG, type on it, download it at full size with the text', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true, serviceWorkers: 'block' });
  const m = await ctx.newPage();
  const errs = []; m.on('pageerror', e => errs.push(e.message));
  await m.goto(`${BASE}/app.html`);
  await m.setInputFiles('#startFile', join(FIX, 'photo.jpg'));
  await m.waitForSelector('#editor:not([hidden])');
  assert.equal(await m.evaluate(() => document.body.classList.contains('photo')), true);
  assert.equal(await m.isHidden('#timeline'), true, 'no timeline for a photo');
  assert.equal(await m.isVisible('#txtText'), true, 'text editor opens straight away');
  await m.fill('#txtText', 'Hello India');
  await m.fill('#txtColor', '#ff0000');
  await m.locator('#txtColor').dispatchEvent('change');
  const dl = m.waitForEvent('download', { timeout: 30000 });
  await m.click('#exportBtn');
  const d = await dl; const file = join(OUT, d.suggestedFilename()); await d.saveAs(file);
  assert.match(file, /\.jpg$/);
  const dims = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim();
  assert.equal(dims, '1080,1350', 'full size kept');
  const red = redPx(file, null);
  assert.ok(red > 500, `text on the photo: ${red} red px`);
  console.log('   photo:', file.split('/').pop(), dims, '| red px', red);
  assert.deepEqual(errs, []);
  await ctx.close();
});

await step('export can be cancelled: Cancel is on screen even on a short laptop window', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 560 }, acceptDownloads: true, serviceWorkers: 'block' });
  const m = await ctx.newPage();
  let downloads = 0; m.on('download', () => downloads++);
  await m.goto(`${BASE}/app.html`);
  await m.click('#startSkip');
  await m.setInputFiles('#fileIn', join(FIX, 'portrait.webm'));
  await m.waitForSelector('#timeline:not([hidden])');
  await m.setInputFiles('#srtIn', join(FIX, 'sample.srt'));
  await m.evaluate(() => { window.__vczExportCodecs = ['vp09.00.40.08']; });
  await m.click('#exportBtn'); await m.waitForSelector('#xDlg[open]');
  await m.click('#xGo');
  await m.waitForSelector('#exportOv:not([hidden])');
  await m.waitForTimeout(800);
  const c = await m.locator('#exportCancel').boundingBox();
  assert.ok(c && c.y >= 0 && c.y + c.height <= 560 && c.x >= 0 && c.x + c.width <= 1280, `Cancel button on screen: ${JSON.stringify(c)}`);
  await m.click('#exportCancel');
  await m.waitForSelector('#exportOv', { state: 'hidden', timeout: 10000 });
  assert.match(await m.textContent('#status'), /cancelled/i);
  await m.waitForTimeout(500);
  assert.equal(downloads, 0, 'nothing downloaded');
  assert.equal(await m.isEnabled('#exportBtn'), true, 'can export again');
  await ctx.close();
});

await step('layout: preview left/middle/right and panel sizes are saved across reloads', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, serviceWorkers: 'block' });
  const m = await ctx.newPage();
  await m.goto(`${BASE}/app.html`);
  await m.click('#startSkip');
  await m.setInputFiles('#fileIn', join(FIX, 'portrait.webm'));
  await m.waitForSelector('#timeline:not([hidden])');
  const x = async sel => (await m.locator(sel).boundingBox()).x;
  assert.ok(await x('.panel.tools') < await x('.stage') && await x('.stage') < await x('.panel.props'), 'CapCut order by default');
  const tl = await m.locator('#timeline').boundingBox(), st = await m.locator('.stage').boundingBox();
  assert.ok(tl.y >= st.y + st.height - 1 && tl.width > 1200, 'timeline runs full width under the preview');
  await m.click('#layBtn'); await m.click('[data-lay="left"]');
  assert.ok(await x('.stage') < await x('.panel.tools'), 'preview moved to the left');
  const h0 = (await m.locator('#timeline').boundingBox()).height;
  const s = await m.locator('#splitT').boundingBox();
  await m.mouse.move(s.x + s.width / 2, s.y + s.height / 2); await m.mouse.down();
  await m.mouse.move(s.x + s.width / 2, s.y - 80, { steps: 5 }); await m.mouse.up();
  const h1 = (await m.locator('#timeline').boundingBox()).height;
  assert.ok(h1 > h0 + 50, `timeline taller: ${h0} -> ${h1}`);
  await m.reload();
  await m.click('#startSkip');
  assert.equal(await m.getAttribute('#editor', 'data-lay'), 'left', 'layout remembered');
  assert.match(await m.evaluate(() => document.getElementById('editor').style.getPropertyValue('--th')), /^\d+px$/);
  assert.notEqual(await m.evaluate(() => document.getElementById('editor').style.getPropertyValue('--th')), '230px', 'timeline size remembered');
  await ctx.close();
});

await step('no uncaught page errors', async () => { assert.deepEqual(errors, []); });

await browser.close();
server.close();
const failed = results.filter(r => r[0] === 'FAIL');
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
