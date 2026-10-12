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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webm': 'video/webm', '.srt': 'text/plain' };

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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
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

await step('language pickers: Hindi offers Hindi / Hinglish / English', async () => {
  await page.click('#spokenCombo .combo-btn');
  await page.fill('#spokenCombo input', 'hindi');
  await page.keyboard.press('Enter');
  await page.click('#captionCombo .combo-btn');
  const opts = await page.$$eval('#captionCombo [role=option]', els => els.map(e => e.textContent));
  assert.deepEqual(opts, ['Hindi', 'Hinglish (Roman Hindi)', 'English']);
  await page.click('#captionCombo [role=option]:has-text("Hinglish")');
  assert.equal(await page.textContent('#startGoText'), 'Generate Captions');
});

await step('generate fails honestly when the model can’t be downloaded (offline sandbox)', async () => {
  await page.click('#startGo');
  await page.waitForFunction(() => document.getElementById('startMsg').textContent.length > 0, null, { timeout: 60000 });
  const msg = await page.textContent('#startMsg');
  assert.match(msg, /Couldn’t generate captions/);
  console.log('   message shown:', msg);
  assert.equal(await vcz(() => window.__vcz.S.segments.length), 0, 'no fake captions');
  // A second attempt must fail again with a message, not hang.
  await page.evaluate(() => { document.getElementById('startMsg').textContent = ''; });
  await page.click('#startGo');
  await page.waitForFunction(() => document.getElementById('startMsg').textContent.length > 0, null, { timeout: 60000 });
});

await step('editor opens with an empty-state message', async () => {
  await page.click('#startSkip');
  await page.waitForSelector('#editor:not([hidden])');
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

let exported;
await step('export produces a downloadable video with burned-in captions and audio', async () => {
  await page.locator('#grid .tpl', { hasText: 'High Contrast' }).first().click();
  await page.waitForTimeout(200);
  const dl = page.waitForEvent('download', { timeout: 60000 });
  await page.click('#exportBtn');
  await page.waitForSelector('#exportOv:not([hidden])');
  const d = await dl;
  exported = join(OUT, d.suggestedFilename());
  await d.saveAs(exported);
  await page.waitForSelector('#exportOv', { state: 'hidden' });
  const streams = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height', '-of', 'csv=p=0', exported]).toString();
  assert.match(streams, /video/); assert.match(streams, /audio/);
  assert.match(streams, /540,960/);
  if (exported.endsWith('.mp4')) assert.match(streams, /h264/, 'MP4 must contain H.264 video');
  const fmtDur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', exported]).toString().trim();
  assert.ok(+fmtDur > 5, `container duration header: ${fmtDur}`);
  const dec = execFileSync('sh', ['-c', `ffmpeg -i "${exported}" -f null - 2>&1 | grep -o 'time=[0-9:.]*' | tail -1`]).toString();
  const [, h, m, s] = dec.match(/time=(\d+):(\d+):([\d.]+)/);
  const dur = +h * 3600 + +m * 60 + +s;
  assert.ok(dur > 5 && dur < 7.5, `duration ${dur}`);
  // Audio must be the original track, not silence.
  const vol = execFileSync('sh', ['-c', `ffmpeg -i "${exported}" -vn -af volumedetect -f null - 2>&1 | grep -o 'mean_volume: [-0-9.]*'`]).toString();
  const mean = +vol.split(':')[1];
  assert.ok(mean > -35, `exported audio too quiet: ${mean} dB`);
  // Frame at 1 s should contain the yellow caption text of the High Contrast style.
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1.2', '-i', exported, '-frames:v', '1', join(OUT, 'export-frame.png')]);
  const yellow = execFileSync('sh', ['-c', `ffmpeg -v error -i "${join(OUT, 'export-frame.png')}" -vf "crop=iw:ih*0.25:0:ih*0.68,format=rgb24" -f rawvideo - | od -An -tu1 -v -w3 | awk '$1>200 && $2>200 && $3<90' | wc -l`]).toString();
  assert.ok(+yellow > 200, `caption pixels in exported frame: ${yellow.trim()}`);
  console.log('   exported', d.suggestedFilename(), '| streams', streams.trim().replace(/\n/g, ' / '), '| decoded', dur.toFixed(2), 's | header', fmtDur, 's | caption px', yellow.trim());
});

await step('landscape video sizes the canvas to 16:9', async () => {
  await page.setInputFiles('#fileIn', join(FIX, 'landscape.webm'));
  await page.waitForFunction(() => document.getElementById('meta').textContent.includes('960×540'));
  await page.waitForTimeout(300);
  const dims = await vcz(() => [document.getElementById('stage').width, document.getElementById('stage').height]);
  assert.deepEqual(dims, [960, 540]);
});

await step('mobile layout has no horizontal scroll', async () => {
  const m = await browser.newPage({ viewport: { width: 375, height: 812 } });
  for (const p of ['index.html', 'templates.html', 'app.html']) {
    await m.goto(`${BASE}/${p}`);
    await m.waitForTimeout(800);
    const over = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 1, `${p} overflows by ${over}px`);
    await m.screenshot({ path: join(OUT, `mobile-${p.replace('.html', '')}.png`) });
  }
  await m.close();
});

await step('no uncaught page errors', async () => { assert.deepEqual(errors, []); });

await browser.close();
server.close();
const failed = results.filter(r => r[0] === 'FAIL');
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
