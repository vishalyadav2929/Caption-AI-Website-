import { TEMPLATES, FONTS_URL, loadTemplateFonts } from './templates.js';
import { buildChunks, findChunk, drawCaption } from './renderer.js';
import { LANGUAGES, toHinglish } from './languages.js';
import { mountGallery } from './gallery.js';
import * as C from './captions.js';
import './vendor/fix-webm-duration.js'; // sets window.ysFixWebmDuration (MIT)

const $ = id => document.getElementById(id);
$('fonts').href = FONTS_URL;

const canvas = $('stage');
const ctx = canvas.getContext('2d');
const video = document.createElement('video');
video.playsInline = true;
video.preload = 'auto';
video.crossOrigin = 'anonymous';

const urlTpl = new URLSearchParams(location.search).get('t');
const S = {
  mode: 'file',
  tplId: (TEMPLATES.find(t => t.id === urlTpl) || TEMPLATES[0]).id,
  o: { scale: 1 },     // style overrides on top of the template
  segments: [],        // source of truth for captions — see captions.js
  hinglish: false,
  file: null,
  fileURL: null,
  exporting: false,
  active: -1,
  selected: -1,
};

// ---------- small helpers ----------
const fmt = s => { if (!isFinite(s)) return '--:--'; s = Math.max(0, s || 0); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
const fmtT = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(2).padStart(5, '0')}`; };
const parseT = v => {
  v = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(v)) return +v;
  const m = v.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/);
  return m ? +m[1] * 60 + +m[2] : NaN;
};
const fmtBytes = b => (b > 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${Math.max(0.1, b / 1e6).toFixed(1)} MB`);
let toastTimer;
function toast(msg, ms = 3600) {
  $('toast').textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').textContent = ''; }, ms);
}
function status(text, progress) {
  const el = $('status');
  el.textContent = text || '';
  if (progress != null) {
    const bar = document.createElement('div'); bar.className = 'bar';
    const i = document.createElement('i'); i.style.width = `${Math.round(progress)}%`;
    bar.appendChild(i); el.appendChild(bar);
  }
}
const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
function toHex(c) {
  if (typeof c !== 'string') return '#ffffff';
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  const x = document.createElement('canvas').getContext('2d');
  x.fillStyle = c; return /^#[0-9a-f]{6}$/i.test(x.fillStyle) ? x.fillStyle : '#ffffff';
}
const baseTpl = () => TEMPLATES.find(t => t.id === S.tplId) || TEMPLATES[0];
const transform = t => (S.hinglish ? toHinglish(t) : t);

// The template with the user's style overrides applied. Used by preview AND export.
function tpl() {
  const t = baseTpl(), o = S.o, r = { ...t };
  if (o.color) r.color = o.color;
  if (o.hiColor) { r.hiColor = o.hiColor; if (t.hi === 'none') r.hi = 'color'; }
  if (o.weight) r.weight = +o.weight;
  if (o.case) {
    r.upper = o.case === 'upper'; r.lower = o.case === 'lower'; r.title = false;
    if (r.roles) r.roles = r.roles.map(x => ({ ...x, upper: undefined, lower: undefined, title: undefined }));
  }
  if (o.strokeW != null) r.stroke = o.strokeW > 0 ? { w: o.strokeW / 100, c: o.strokeColor || '#000000' } : null;
  else if (o.strokeColor && t.stroke) r.stroke = { ...t.stroke, c: o.strokeColor };
  if (o.shadow != null) r.shadow = o.shadow ? { c: 'rgba(0,0,0,.7)', b: 0.18, x: 0, y: 0.05 } : null;
  if (o.bgOp != null) r.bg = o.bgOp > 0 ? { c: hexA(o.bgColor || '#000000', o.bgOp / 100), pad: 0.3, r: 0.18 } : null;
  if (o.align) r.align = o.align;
  if (o.maxWidth) r.maxWidth = o.maxWidth;
  if (o.lineGap) r.lineGap = o.lineGap;
  return r;
}
const wordsPerCaption = () => S.o.words || baseTpl().words;

// ---------- undo / redo ----------
let hist = [], hIdx = -1;
const snap = () => JSON.stringify({ segments: S.segments, o: S.o, tplId: S.tplId, hinglish: S.hinglish });
function commit() {
  const s = snap();
  if (hist[hIdx] === s) return;
  hist = hist.slice(0, hIdx + 1);
  hist.push(s);
  if (hist.length > 100) hist.shift();
  hIdx = hist.length - 1;
  syncUndo();
}
function restore(s) {
  const d = JSON.parse(s);
  S.segments = d.segments; S.o = d.o; S.tplId = d.tplId; S.hinglish = d.hinglish;
  gallery.select(S.tplId);
  syncControls(); renderSegs(); syncActions();
}
function undo() { if (hIdx > 0 && !S.exporting) { hIdx--; restore(hist[hIdx]); syncUndo(); } }
function redo() { if (hIdx < hist.length - 1 && !S.exporting) { hIdx++; restore(hist[hIdx]); syncUndo(); } }
function syncUndo() {
  $('undoBtn').disabled = hIdx <= 0;
  $('redoBtn').disabled = hIdx >= hist.length - 1;
}
$('undoBtn').onclick = undo;
$('redoBtn').onclick = redo;

// ---------- languages ----------
LANGUAGES.forEach((l, i) => {
  const o = document.createElement('option');
  o.value = i; o.textContent = l.name;
  $('lang').appendChild(o);
});
$('lang').onchange = () => {
  const l = LANGUAGES[$('lang').value];
  if (l.hinglish && !S.hinglish) { S.hinglish = true; $('hinglish').checked = true; renderSegs(); commit(); }
  if (S.mode === 'live' && recog) { stopRecognition(); startRecognition(); }
};

// ---------- templates ----------
const gallery = mountGallery({
  tabsEl: $('tabs'), gridEl: $('grid'), langEl: $('langTabs'), selected: S.tplId,
  onSelect: t => {
    if (S.exporting) return;
    S.tplId = t.id;
    // Style overrides belong to the old template. Captions are untouched: each template shows long captions
    // in pieces of its own size at render time (e.g. one word at a time for "Pill").
    S.o = { scale: S.o.scale || 1 };
    syncControls(); renderSegs(); commit();
  },
});

// On phones and tablets the template strip sits right under the video, so a tap shows the change at once.
{
  const mq = window.matchMedia('(max-width: 1100px)');
  const home = $('grid').parentElement;
  const place = () => (mq.matches ? $('mTpl') : home).appendChild($('grid'));
  if (mq.addEventListener) mq.addEventListener('change', place); else mq.addListener(place);
  place();
}

// ---------- style controls ----------
function syncControls() {
  const t = tpl(), o = S.o;
  $('words').value = wordsPerCaption(); $('wordsVal').textContent = wordsPerCaption();
  $('size').value = Math.round((o.scale || 1) * 100); $('sizeVal').textContent = `${$('size').value}%`;
  $('weight').value = o.weight || '';
  $('caseSel').value = o.case || '';
  $('color').value = toHex(t.color);
  $('hiColor').value = toHex(t.hiColor || '#FFE600');
  $('strokeColor').value = toHex((t.stroke && t.stroke.c) || '#000000');
  $('strokeW').value = Math.round(((t.stroke && t.stroke.w) || 0) * 100); $('strokeWVal').textContent = $('strokeW').value;
  $('shadow').checked = !!t.shadow;
  $('bgColor').value = toHex(o.bgColor || '#000000');
  $('bgOp').value = o.bgOp ?? (t.bg ? 60 : 0); $('bgOpVal').textContent = `${$('bgOp').value}%`;
  $('pos').value = Math.round((o.pos ?? baseTpl().pos ?? 0.72) * 100); $('posVal').textContent = `${$('pos').value}%`;
  $('maxW').value = Math.round((t.maxWidth ?? 0.88) * 100); $('maxWVal').textContent = `${$('maxW').value}%`;
  $('lineGap').value = Math.round((t.lineGap ?? 1.16) * 100); $('lineGapVal').textContent = ($('lineGap').value / 100).toFixed(2);
  const align = t.align || 'center';
  $('alignCtl').querySelectorAll('button').forEach(b => { const on = b.dataset.v === align; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  $('hinglish').checked = S.hinglish;
}
const bind = (id, apply, label) => {
  const el = $(id);
  el.addEventListener('input', () => { apply(el); if (label) label(el); });
  el.addEventListener('change', () => commit());
};
bind('size', el => { S.o.scale = el.value / 100; }, el => { $('sizeVal').textContent = `${el.value}%`; });
bind('pos', el => { S.o.pos = el.value / 100; }, el => { $('posVal').textContent = `${el.value}%`; });
bind('maxW', el => { S.o.maxWidth = el.value / 100; }, el => { $('maxWVal').textContent = `${el.value}%`; });
bind('lineGap', el => { S.o.lineGap = el.value / 100; }, el => { $('lineGapVal').textContent = (el.value / 100).toFixed(2); });
bind('weight', el => { S.o.weight = el.value || null; });
bind('caseSel', el => { S.o.case = el.value || null; });
bind('color', el => { S.o.color = el.value; });
bind('hiColor', el => { S.o.hiColor = el.value; });
bind('strokeColor', el => { S.o.strokeColor = el.value; if (S.o.strokeW == null && !baseTpl().stroke) S.o.strokeW = 12; syncControls(); });
bind('strokeW', el => { S.o.strokeW = +el.value; }, el => { $('strokeWVal').textContent = el.value; });
bind('shadow', el => { S.o.shadow = el.checked; });
bind('bgColor', el => { S.o.bgColor = el.value; if (S.o.bgOp == null) S.o.bgOp = 60; syncControls(); });
bind('bgOp', el => { S.o.bgOp = +el.value; }, el => { $('bgOpVal').textContent = `${el.value}%`; });
$('alignCtl').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.o.align = b.dataset.v; syncControls(); commit();
});
$('resetStyle').onclick = () => { S.o = { scale: 1 }; syncControls(); commit(); toast('Style reset to the template.'); };
$('words').addEventListener('input', e => { $('wordsVal').textContent = e.target.value; });
$('words').addEventListener('change', e => {
  S.o.words = +e.target.value;
  if (S.segments.length) S.segments = C.rechunk(S.segments, S.o.words);
  renderSegs(); commit();
});
$('hinglish').onchange = e => { S.hinglish = e.target.checked; renderSegs(); commit(); };

// Panel tabs
function showTab(which) {
  const cap = which === 'captions';
  $('tabCaptions').classList.toggle('on', cap); $('tabCaptions').setAttribute('aria-selected', cap);
  $('tabStyle').classList.toggle('on', !cap); $('tabStyle').setAttribute('aria-selected', !cap);
  $('paneCaptions').hidden = !cap; $('paneStyle').hidden = cap;
}
$('tabCaptions').onclick = () => showTab('captions');
$('tabStyle').onclick = () => showTab('style');

// ---------- caption list ----------
function setSegments(next, keepSel = true) {
  S.segments = C.normalize(next);
  if (!keepSel) S.selected = -1;
  renderSegs(); syncActions(); commit();
}
function seekTo(t) { if (S.mode === 'file' && video.src) video.currentTime = Math.max(0, t + 0.01); }

function renderSegs() {
  const box = $('segs');
  box.innerHTML = '';
  S.active = -1;
  $('segCount').textContent = S.segments.length ? `· ${S.segments.length}` : '';
  if (!S.segments.length) {
    const p = document.createElement('div'); p.className = 'empty';
    p.innerHTML = '<strong>No captions yet</strong>';
    const d = document.createElement('p');
    d.textContent = genRunning ? 'Your captions are being generated. They will appear here.' : S.file ? 'Use “More options” below to generate captions, import an SRT file, or tap + Add.' : 'Upload a video first.';
    p.appendChild(d);
    box.appendChild(p);
    return;
  }
  S.segments.forEach((seg, i) => {
    const row = document.createElement('div');
    row.className = 'seg' + (i === S.selected ? ' sel' : '');
    row.dataset.i = i;

    const top = document.createElement('div'); top.className = 'seg-top';
    const num = document.createElement('button'); num.className = 'seg-num'; num.textContent = i + 1;
    num.title = 'Play from here'; num.setAttribute('aria-label', `Caption ${i + 1}: jump to ${fmtT(seg.start)}`);
    num.onclick = () => { S.selected = i; seekTo(seg.start); markSel(); };
    const tin = (val, which) => {
      const inp = document.createElement('input');
      inp.className = 't-in'; inp.value = fmtT(val); inp.inputMode = 'decimal';
      inp.setAttribute('aria-label', `Caption ${i + 1} ${which} time`);
      inp.onchange = () => {
        const v = parseT(inp.value);
        if (isNaN(v)) { inp.value = fmtT(val); return toast('Use a time like 0:03.25 or 3.25'); }
        const s = S.segments[i];
        const next = which === 'start' ? C.setTimes(s, v, Math.max(v + C.MIN_DUR, s.end)) : C.setTimes(s, s.start, v);
        const arr = S.segments.slice(); arr[i] = next; setSegments(arr);
      };
      return inp;
    };
    const arrow = document.createElement('span'); arrow.className = 'arrow'; arrow.textContent = '→';
    top.append(num, tin(seg.start, 'start'), arrow, tin(seg.end, 'end'));
    if (seg.approx) {
      const b = document.createElement('span'); b.className = 'est';
      b.textContent = 'est.'; b.title = 'Word timing inside this caption is estimated, not measured by the speech model.';
      top.appendChild(b);
    }
    const acts = document.createElement('span'); acts.className = 'seg-acts';
    const act = (label, title, fn, disabled) => {
      const b = document.createElement('button'); b.className = 'mini'; b.textContent = label; b.title = title;
      b.setAttribute('aria-label', `${title} (caption ${i + 1})`); b.disabled = !!disabled; b.onclick = fn; acts.appendChild(b);
    };
    act('✂', 'Split at cursor', () => {
      const ta = row.querySelector('textarea');
      const before = ta.value.slice(0, ta.selectionStart).trim().split(/\s+/).filter(Boolean).length;
      const at = before > 0 && before < seg.words.length ? before : Math.ceil(seg.words.length / 2);
      const parts = C.split(S.segments[i], at);
      if (!parts) return toast('A one-word caption can’t be split.');
      const arr = S.segments.slice(); arr.splice(i, 1, ...parts); setSegments(arr);
    }, seg.words.length < 2);
    act('⤓', 'Merge with next', () => {
      const arr = S.segments.slice(); arr.splice(i, 2, C.merge(arr[i], arr[i + 1])); setSegments(arr);
    }, i === S.segments.length - 1);
    act('+', 'Add caption after', () => {
      const arr = S.segments.slice(); arr.splice(i + 1, 0, C.newSegmentAfter(arr, i)); S.selected = i + 1; setSegments(arr);
      requestAnimationFrame(() => { const t = $('segs').children[i + 1]; t && t.querySelector('textarea').select(); });
    });
    act('🗑', 'Delete caption', () => {
      const arr = S.segments.slice(); arr.splice(i, 1); setSegments(arr, false); toast('Caption deleted. Press Ctrl+Z to undo.');
    });
    top.appendChild(acts);

    const ta = document.createElement('textarea');
    ta.rows = 1; ta.value = transform(C.segmentText(seg));
    ta.setAttribute('aria-label', `Caption ${i + 1} text`);
    ta.onfocus = () => { S.selected = i; markSel(); if (video.paused) seekTo(seg.start); };
    ta.onchange = () => {
      const next = C.setText(S.segments[i], ta.value);
      const arr = S.segments.slice();
      if (!next) arr.splice(i, 1); else arr[i] = next;
      setSegments(arr);
    };
    row.append(top, ta);
    box.appendChild(row);
  });
}
function markSel() {
  [...$('segs').children].forEach((r, k) => r.classList.toggle('sel', k === S.selected));
}
function highlightSeg(t) {
  const idx = C.indexAt(S.segments, t);
  const cur = idx >= 0 && t <= S.segments[idx].end + 0.6 ? idx : -1;
  if (cur === S.active) return;
  const rows = $('segs').children;
  if (rows[S.active]) rows[S.active].classList.remove('on');
  if (rows[cur] && rows[cur].classList) {
    rows[cur].classList.add('on');
    if (!video.paused && !$('segs').contains(document.activeElement)) rows[cur].scrollIntoView({ block: 'nearest' });
  }
  S.active = cur;
}
$('addSeg').onclick = () => {
  const t = S.mode === 'file' ? video.currentTime || 0 : 0;
  const i = C.indexAt(S.segments, t);
  const arr = S.segments.slice();
  const seg = i < 0 && !arr.length ? C.newSegmentAfter([], -1, 'New caption', t) : C.newSegmentAfter(arr, Math.max(i, -1) < 0 ? -1 : i, 'New caption', t);
  arr.splice(i + 1, 0, seg); S.selected = i + 1; setSegments(arr);
  showTab('captions');
  requestAnimationFrame(() => { const r = $('segs').children[S.selected]; r && r.querySelector('textarea').select(); });
};

function syncActions() {
  const has = S.segments.length > 0;
  $('srtBtn').disabled = !has || S.exporting;
  $('exportBtn').disabled = S.exporting || !(S.file && S.mode === 'file');
  $('genBtn').disabled = !S.file || S.exporting || genRunning;
}

// ---------- file input ----------
const OK_EXT = /\.(mp4|m4v|mov|webm|mkv|ogv|m4a|mp3|wav|aac|ogg|oga|flac)$/i;
function validateFile(file) {
  if (!file) return 'No file selected.';
  if (!(/^(video|audio)\//.test(file.type) || OK_EXT.test(file.name))) return `“${file.name}” isn’t a video or audio file.`;
  if (file.size > 2 * 1024 ** 3) return `That file is ${fmtBytes(file.size)}. The limit is 2 GB because everything runs inside your browser.`;
  return null;
}
async function loadFile(file) {
  const err = validateFile(file);
  if (err) { toast(err, 5000); return false; }
  const url = URL.createObjectURL(file);
  video.srcObject = null;
  video.src = url;
  video.muted = false;
  const ok = await new Promise(res => {
    const done = v => { clearTimeout(timer); video.onloadedmetadata = video.onerror = null; res(v); };
    const timer = setTimeout(() => done(false), 20000);
    video.onloadedmetadata = () => done(true);
    video.onerror = () => done(false);
  });
  if (!ok) {
    URL.revokeObjectURL(url);
    if (S.fileURL) video.src = S.fileURL;
    toast('This browser can’t play that file. iPhone HEVC videos often need converting to MP4 (H.264) first.', 6500);
    return false;
  }
  if (S.fileURL) URL.revokeObjectURL(S.fileURL);
  S.fileURL = url;
  S.file = file;
  S.decodeFailed = false;
  S.segments = []; S.selected = -1;
  hist = []; hIdx = -1; commit();
  fitCanvas(video.videoWidth || 1080, video.videoHeight || 1920);
  $('drop').classList.add('hide');
  $('playBtn').disabled = false; $('seek').disabled = false;
  const meta = fileMeta();
  $('meta').textContent = meta;
  status(`Loaded “${file.name}”. Generate captions, import an SRT, or add captions by hand.`);
  if (video.duration > 600) toast('Long video: transcription and export both take a while. Under 3 minutes works best.', 6000);
  renderSegs(); syncActions();
  return true;
}
function fileMeta() {
  if (!S.file) return '';
  const dims = video.videoWidth ? `${video.videoWidth}×${video.videoHeight}` : 'audio only';
  return `${S.file.name} · ${dims} · ${fmt(video.duration)} · ${fmtBytes(S.file.size)}`;
}
function fitCanvas(w, h) {
  if (!(w >= 16 && h >= 16)) return;
  const k = Math.min(1, 1920 / Math.max(w, h));
  canvas.width = Math.round(w * k / 2) * 2;
  canvas.height = Math.round(h * k / 2) * 2;
}
$('fileIn').onchange = async e => { await loadFile(e.target.files[0]); e.target.value = ''; };
const box = $('box');
['dragenter', 'dragover'].forEach(ev => box.addEventListener(ev, e => { e.preventDefault(); $('drop').classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => box.addEventListener(ev, e => { e.preventDefault(); $('drop').classList.remove('over'); }));
box.addEventListener('drop', e => { if (S.mode === 'file' && !S.exporting) loadFile(e.dataTransfer.files[0]); });

// ---------- playback ----------
function togglePlay() { if (!video.src || S.exporting || S.mode !== 'file') return; video.paused ? video.play() : video.pause(); }
$('playBtn').onclick = togglePlay;
video.onplay = () => { $('playBtn').textContent = '❚❚ Pause'; $('playBtn').setAttribute('aria-label', 'Pause'); };
video.onpause = () => { $('playBtn').textContent = '▶ Play'; $('playBtn').setAttribute('aria-label', 'Play'); };
$('seek').oninput = e => { if (isFinite(video.duration)) video.currentTime = e.target.value / 1000 * video.duration; };
canvas.addEventListener('click', togglePlay);
$('fsBtn').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else if (box.requestFullscreen) box.requestFullscreen().catch(() => toast('Full screen isn’t available here.'));
};

// ---------- speech-to-text ----------
let worker = null, busyGen = null;
// ---- audio extraction ----
// 1) Decode the whole file at the browser's native rate (works for MP4/WebM/M4A in Chrome, Edge, Firefox).
// 2) If the browser can't decode the container (e.g. iPhone .mov in Safari), play the video once,
//    silently, and record its sound in real time.
function toMono16k(chans, rate) {
  const n = chans[0].length, mono = new Float32Array(n);
  for (const ch of chans) for (let i = 0; i < n; i++) mono[i] += ch[i] / chans.length;
  if (rate === 16000) return mono;
  const ratio = rate / 16000, out = new Float32Array(Math.floor(n / ratio));
  const win = Math.max(1, Math.round(ratio));
  for (let i = 0; i < out.length; i++) {
    // Box low-pass over the source samples that map to this output sample, then pick.
    const c = Math.floor(i * ratio); let sum = 0, k = 0;
    for (let j = c; j < c + win && j < n; j++, k++) sum += mono[j];
    out[i] = k ? sum / k : 0;
  }
  return out;
}
// QuickTime (.mov) and MP4 share the same box layout; some browsers only refuse the 'qt  ' brand.
function patchMovBrand(buf) {
  const u = new Uint8Array(buf.slice(0));
  const tag = String.fromCharCode(...u.subarray(4, 8));
  if (tag !== 'ftyp') return null;
  const brand = String.fromCharCode(...u.subarray(8, 12));
  if (brand !== 'qt  ') return null;
  u.set([0x69, 0x73, 0x6f, 0x6d], 8); // 'isom'
  return u.buffer;
}
async function decodeBuffer(data) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  try {
    const buf = await new Promise((res, rej) => {
      const p = ac.decodeAudioData(data, res, rej);
      if (p && p.then) p.then(res, rej);
    });
    const chans = [];
    for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c));
    return toMono16k(chans, buf.sampleRate);
  } finally { ac.close && ac.close(); }
}
async function decodeFull(file) {
  const data = await file.arrayBuffer();
  try { return await decodeBuffer(data.slice(0)); } catch (err) {
    const patched = patchMovBrand(data);
    if (!patched) throw err;
    return decodeBuffer(patched);
  }
}
let realtimeJob = null;
async function captureRealtime(ui) {
  ensureAudioGraph();
  // iPhone only starts audio after a tap. Without it the video silently never plays.
  await Promise.race([audioCtx.resume(), new Promise(r => setTimeout(r, 1500))]);
  if (audioCtx.state !== 'running') throw new Error('needs-tap');
  const dur = video.duration;
  if (!isFinite(dur) || dur <= 0) throw new Error('Couldn’t read the video length.');
  const sp = audioCtx.createScriptProcessor(4096, 2, 1);
  const chunks = [];
  sp.onaudioprocess = e => {
    if (video.paused) return;
    const ib = e.inputBuffer, chans = [];
    for (let c = 0; c < ib.numberOfChannels; c++) chans.push(new Float32Array(ib.getChannelData(c)));
    chunks.push(chans);
  };
  mediaNode.connect(sp); sp.connect(audioCtx.destination);
  speakerGain.gain.value = 0;
  const job = realtimeJob = { cancelled: false };
  try {
    video.pause();
    video.currentTime = 0;
    await new Promise(r => { video.onseeked = () => { video.onseeked = null; r(); }; });
    try {
      await Promise.race([video.play(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
    } catch { throw new Error('needs-tap'); }
    const startedAt = Date.now();
    await new Promise((resolve, reject) => {
      const tick = setInterval(() => {
        if (video.currentTime < 0.05 && Date.now() - startedAt > 4000) { clearInterval(tick); reject(new Error('needs-tap')); return; }
        ui.onText(`Reading audio… ${fmt(video.currentTime)} of ${fmt(dur)} (your browser can’t extract it instantly)`);
        ui.onPct(video.currentTime / dur * 100);
        if (job.cancelled || video.ended) { clearInterval(tick); resolve(); }
      }, 200);
    });
    if (job.cancelled) throw new Error('cancelled');
  } finally {
    video.pause();
    sp.disconnect(); try { mediaNode.disconnect(sp); } catch { /* already */ }
    speakerGain.gain.value = 1;
    realtimeJob = null;
  }
  const nch = Math.max(...chunks.map(c => c.length), 1);
  const total = chunks.reduce((a, c) => a + c[0].length, 0);
  const merged = Array.from({ length: nch }, () => new Float32Array(total));
  let o = 0;
  for (const c of chunks) { for (let k = 0; k < nch; k++) merged[k].set(c[Math.min(k, c.length - 1)], o); o += c[0].length; }
  return toMono16k(merged, audioCtx.sampleRate);
}
async function extractAudio(ui) {
  if (!S.decodeFailed && !window.__vczForceRealtime) {
    try { return await decodeFull(S.file); } catch { S.decodeFailed = true; }
  }
  return captureRealtime(ui);
}

/**
 * Transcribe the loaded file. ui: { onText(text), onPct(pct|null) }
 * Resolves to { words, level } or rejects (Error 'cancelled' on cancel).
 */
async function transcribe({ lang, task, quality }, ui) {
  ui.onText('Reading the audio track…'); ui.onPct(null);
  const audio = await extractAudio(ui);
  window.__vczAudioLength = audio.length;
  let peak = 0;
  for (let i = 0; i < audio.length; i += 50) peak = Math.max(peak, Math.abs(audio[i]));
  if (!audio.length || peak < 0.002) throw new Error('This video seems to have no sound, so there is nothing to transcribe.');
  worker = worker || new Worker(new URL('./whisper-worker.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    busyGen = { reject };
    worker.onerror = e => {
      // Usually the speech library couldn't be fetched (offline, firewall or an ad-blocker). Start fresh next time.
      busyGen = null; worker.terminate(); worker = null;
      reject(new Error(e.message && !/^Script error/.test(e.message) ? e.message : 'Couldn’t load the speech library from cdn.jsdelivr.net (offline, firewall or ad-blocker?).'));
    };
    worker.onmessage = ({ data }) => {
      if (data.type === 'download') {
        const pct = data.loaded / data.total * 100;
        ui.onText(`Downloading speech model (one time)… ${fmtBytes(data.loaded)} of ${fmtBytes(data.total)}`); ui.onPct(pct);
      } else if (data.type === 'status') { ui.onText(data.text); }
      else if (data.type === 'transcribe') {
        ui.onText(`Transcribing… part ${Math.min(data.done + 1, data.total)} of ${data.total}`); ui.onPct(data.done / data.total * 100);
      } else if (data.type === 'error') { busyGen = null; worker.terminate(); worker = null; reject(new Error(data.text)); }
      else if (data.type === 'done') { busyGen = null; resolve(data); }
    };
    worker.postMessage({ type: 'transcribe', audio, quality, language: lang.whisper, task }, [audio.buffer]);
  });
}
function cancelTranscribe() {
  if (realtimeJob) { realtimeJob.cancelled = true; return; }
  if (!busyGen) return;
  worker.terminate(); worker = null;
  const r = busyGen.reject; busyGen = null;
  r(new Error('cancelled'));
}
function applyTranscript(res, captionMode) {
  if (!res.words.length) return false;
  S.hinglish = captionMode === 'hinglish';
  S.segments = C.segmentsFromWords(res.words, wordsPerCaption(), 32);
  S.selected = -1;
  syncControls(); renderSegs(); syncActions(); commit();
  return true;
}
function describeResult(res) {
  const n = res.words.length;
  return `Done: ${n} words in ${S.segments.length} captions.` +
    (res.level === 'segment' ? ' This model only gave sentence timing, so word-by-word highlights are estimated (marked “est.”).' : ' Word timing comes from the speech model.') +
    ' Check the text, pick a template, then export.';
}

// One generation runner for both the start screen and the editor. Progress shows in the editor's card.
let genRunning = false;
function genUI(on) {
  $('genOv').hidden = !on;
  $('genOvTap').hidden = true;
  $('genOvCancel').hidden = !on;
  $('genCancel').hidden = !on;
}
async function runGeneration({ lang, mode, quality }) {
  if (!S.file || genRunning) return;
  genRunning = true;
  const task = mode === 'english' && lang.whisper !== 'english' ? 'translate' : 'transcribe';
  S.pendingMode = mode;
  genUI(true); syncActions(); renderSegs(); status('');
  $('genOv').classList.remove('wait');
  $('genOvBar').style.width = '0';
  $('genOvText').textContent = 'Starting…';
  try {
    const res = await transcribe({ lang, task, quality }, {
      onText: t => { $('genOvText').textContent = t; },
      onPct: p => { $('genOvBar').style.width = p == null ? '0' : `${p}%`; },
    });
    if (!applyTranscript(res, mode)) status('No speech was found in this video. You can add captions by hand.');
    else status(describeResult(res));
    genUI(false);
  } catch (err) {
    if (err.message === 'needs-tap') {
      // iPhone needs a fresh tap before it will play the video to read its sound.
      $('genOvText').textContent = 'Tap once so your phone lets us read the video’s sound.';
      $('genOvBar').style.width = '0';
      $('genOvTap').hidden = false; $('genOvCancel').hidden = false;
      $('genOv').classList.add('wait');
      $('genOvTap').onclick = () => {
        // Unlock audio and playback inside the tap itself (required on iPhone), then retry.
        ensureAudioGraph();
        audioCtx.resume();
        const p = video.play(); if (p && p.then) p.then(() => video.pause(), () => {});
        S.decodeFailed = true; S.awaitingTap = null;
        $('genOvTap').hidden = true;
        genRunning = false;
        runGeneration({ lang, mode, quality });
      };
      genRunning = false;
      S.awaitingTap = { lang, mode, quality };
      return;
    }
    genUI(false);
    status(err.message === 'cancelled' ? 'Transcription cancelled. Open “Generate captions from audio” to try again.'
      : `Couldn’t generate captions: ${err.message} The first run needs internet to download the speech model.`);
    $('moreOpts').open = true;
  } finally {
    genRunning = false; syncActions();
  }
}
$('genOvCancel').onclick = () => {
  if (S.awaitingTap) { S.awaitingTap = null; genUI(false); status('Cancelled. Open “More options” to generate captions again.'); return; }
  cancelTranscribe();
};

$('genBtn').onclick = () => {
  if (!S.file || genRunning) return;
  if (S.segments.length && !confirm('Replace the current captions with a new transcription?')) return;
  const lang = LANGUAGES[$('lang').value];
  const mode = lang.hinglish || S.hinglish ? 'hinglish' : $('translate').checked ? 'english' : 'native';
  runGeneration({ lang, mode, quality: $('model').value });
};
$('genCancel').onclick = () => cancelTranscribe();

// ---------- live mode ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let cam = null, recog = null, liveT0 = 0, liveFinal = [], liveInterim = [], interimTimes = [], wantLive = false;
const liveNow = () => (performance.now() - liveT0) / 1000;

function setMode(mode) {
  if (S.exporting || mode === S.mode) return;
  S.mode = mode;
  $('modeFile').classList.toggle('on', mode === 'file');
  $('modeLive').classList.toggle('on', mode === 'live');
  $('fileControls').hidden = mode !== 'file';
  $('meta').hidden = mode !== 'file';
  $('liveControls').hidden = mode !== 'live';
  $('fileOnly').hidden = mode !== 'file';
  if (mode === 'live') {
    S.fileSegments = S.segments;
    S.segments = [];
    video.pause();
    $('drop').classList.add('hide');
    fitCanvas(1080, 1920);
    status(SR ? 'Start the camera and speak. Captions appear as you talk (Chrome, Edge or Safari). Their timing is approximate.'
      : 'Live captions need Chrome, Edge or Safari. Uploading a video works in every browser.');
  } else {
    stopLive();
    $('drop').classList.toggle('hide', !!S.file);
    if (S.file) { video.muted = false; video.src = S.fileURL; }
    S.segments = S.fileSegments || [];
    status(S.file ? '' : 'Upload a video to get started.');
  }
  renderSegs(); syncActions();
}
$('modeFile').onclick = () => setMode('file');
$('modeLive').onclick = () => setMode('live');

$('camBtn').onclick = async () => {
  if (cam) return stopLive();
  try {
    cam = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1080 }, height: { ideal: 1920 }, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
  } catch { return toast('Camera or microphone permission was denied.'); }
  video.removeAttribute('src');
  video.srcObject = cam;
  video.muted = true;
  await video.play();
  fitCanvas(1080, 1920); // Reels are vertical; the camera is centre-cropped to 9:16.
  liveT0 = performance.now(); liveFinal = []; liveInterim = []; interimTimes = [];
  S.segments = []; renderSegs();
  $('camBtn').textContent = 'Stop camera';
  $('recBtn').disabled = false;
  wantLive = true;
  startRecognition();
};

function startRecognition() {
  if (!SR) return;
  recog = new SR();
  recog.lang = LANGUAGES[$('lang').value].bcp;
  recog.continuous = true;
  recog.interimResults = true;
  recog.onresult = e => {
    const now = liveNow();
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        const parts = r[0].transcript.trim().split(/\s+/).filter(Boolean);
        parts.forEach((p, k) => {
          const prev = liveFinal[liveFinal.length - 1];
          const start = Math.max(prev ? prev.start + 0.05 : 0, interimTimes[k] ?? now);
          liveFinal.push({ text: p, start, end: Math.max(start + 0.2, interimTimes[k + 1] ?? now), approx: true });
        });
        interimTimes = [];
      } else interim += r[0].transcript;
    }
    const parts = interim.trim().split(/\s+/).filter(Boolean);
    while (interimTimes.length < parts.length) interimTimes.push(now);
    interimTimes.length = parts.length;
    liveInterim = parts.map((p, k) => ({ text: p, start: interimTimes[k], end: interimTimes[k] + 0.3 }));
  };
  recog.onerror = e => {
    if (e.error === 'not-allowed') { wantLive = false; toast('Microphone permission was denied.'); }
    else if (e.error === 'language-not-supported') toast('This browser can’t do live captions in that language. Try uploading a video instead.');
  };
  // Browsers end recognition after silence. Restart while the camera is on.
  recog.onend = () => { if (wantLive && recog) try { recog.start(); } catch { /* already started */ } };
  try { recog.start(); } catch { /* already started */ }
}
function stopRecognition() {
  if (!recog) return;
  const r = recog; recog = null; r.onend = null;
  try { r.stop(); } catch { /* not running */ }
}
function stopLive() {
  wantLive = false;
  stopRecognition();
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  if (cam) cam.getTracks().forEach(t => t.stop());
  cam = null;
  if (S.mode === 'live') {
    video.srcObject = null;
    if (liveFinal.length) { S.segments = C.segmentsFromWords(liveFinal, wordsPerCaption(), 32, true); renderSegs(); syncActions(); }
  }
  $('camBtn').textContent = 'Start camera';
  $('recBtn').disabled = true;
}

// ---------- recording & export ----------
let recorder = null, audioCtx = null, mediaNode = null, audioDest = null, speakerGain = null;
function pickMime() {
  // MP4 only with H.264 video (plays everywhere). A bare 'video/mp4' can mean VP9-in-MP4, which iPhones can't play,
  // so without H.264 we record WebM instead.
  const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,opus', 'video/mp4;codecs=avc1,opus', 'video/mp4;codecs=avc1',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

$('recBtn').onclick = () => {
  if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
  if (!window.MediaRecorder) return toast('Recording isn’t supported in this browser.');
  const mimeType = pickMime();
  const stream = canvas.captureStream(30);
  cam.getAudioTracks().forEach(t => stream.addTrack(t));
  const parts = [];
  recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  recorder.ondataavailable = e => e.data.size && parts.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(parts, { type: mimeType || 'video/webm' });
    if (blob.size) download(blob, `viralcaptionzone-live.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`);
    $('recBtn').textContent = '● Record'; $('liveTime').textContent = '';
    toast(blob.size ? 'Recording saved to your downloads.' : 'Recording was empty.');
  };
  recorder.start(500);
  $('recBtn').textContent = '■ Stop';
  $('liveTime').innerHTML = '<span class="live-dot"></span> REC';
};

function ensureAudioGraph() {
  const AC = window.AudioContext || window.webkitAudioContext;
  audioCtx = audioCtx || new AC();
  if (!mediaNode) {
    mediaNode = audioCtx.createMediaElementSource(video);
    speakerGain = audioCtx.createGain();
    audioDest = audioCtx.createMediaStreamDestination();
    mediaNode.connect(speakerGain).connect(audioCtx.destination);
    mediaNode.connect(audioDest);
  }
}

let exportJob = null;
function setExportUI(on) {
  S.exporting = on;
  $('exportOv').hidden = !on;
  document.body.classList.toggle('exporting', on);
  syncActions();
}

// Export canvas: separate from the preview so the file keeps the original resolution.
// One opaque canvas for normal video, one with an alpha channel for transparent captions.
const xcanvasOpaque = document.createElement('canvas');
const xcanvasAlpha = document.createElement('canvas');
const xctxOpaque = xcanvasOpaque.getContext('2d', { alpha: false });
const xctxAlpha = xcanvasAlpha.getContext('2d', { alpha: true });

function exportSizes() {
  const vw = video.videoWidth || 1080, vh = video.videoHeight || 1920;
  const long = Math.max(vw, vh), out = [];
  const add = (label, l) => {
    const k = Math.min(1, l / long);
    const w = Math.round(vw * k / 2) * 2, h = Math.round(vh * k / 2) * 2;
    if (!out.some(o => o.w === w)) out.push({ label: `${label} · ${w}×${h}`, w, h });
  };
  add('Original', long); add('1080p', 1920); add('720p', 1280);
  return out;
}
const alphaMime = () => ['video/webm;codecs=vp9', 'video/webm;codecs=vp8'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';

function openExportDialog() {
  if (S.exporting || !S.file) return;
  const sizes = exportSizes();
  const sel = $('xRes'); sel.innerHTML = '';
  sizes.forEach((o, i) => { const opt = document.createElement('option'); opt.value = i; opt.textContent = o.label; sel.appendChild(opt); });
  const hasAlpha = !!alphaMime();
  $('xKindAlpha').disabled = !hasAlpha;
  $('xAlphaNote').textContent = hasAlpha ? 'WebM with a real transparent background. Works in Premiere, DaVinci Resolve, After Effects and Final Cut (with a plug-in).'
    : 'Not available in this browser (Safari can’t record WebM). Use green screen instead, or open this site in Chrome.';
  if (!hasAlpha && $('xKindAlpha').checked) $('xKindVideo').checked = true;
  const long = Math.max(video.videoWidth, video.videoHeight);
  $('xNote').textContent = `Takes about ${fmt(video.duration)} (it records in real time). Keep this tab open.` +
    (long > 1920 ? ' Original 4K needs a fast computer; choose 1080p if the export stutters.' : '');
  $('xDlg').showModal ? $('xDlg').showModal() : $('xDlg').setAttribute('open', '');
}
$('exportBtn').onclick = openExportDialog;
$('xClose').onclick = () => $('xDlg').close();
$('xGo').onclick = e => {
  e.preventDefault();
  const kind = document.querySelector('input[name=xKind]:checked').value;
  const size = exportSizes()[+$('xRes').value];
  $('xDlg').close();
  exportVideo({ kind, size });
};

async function exportVideo({ kind = 'video', size } = {}) {
  if (S.exporting || !S.file) return;
  if (!window.MediaRecorder || !xcanvasOpaque.captureStream) return toast('Export needs MediaRecorder, which this browser doesn’t support. Try Chrome, Edge, Firefox or Safari.', 6000);
  const overlay = kind !== 'video';
  const mimeType = kind === 'alpha' ? alphaMime() : pickMime();
  if (!mimeType) return toast('This browser can’t record video. Try Chrome, Edge, Firefox or Safari.', 6000);
  const dur = video.duration;
  if (!isFinite(dur) || dur <= 0) return toast('Couldn’t read the video length, so it can’t be exported.');
  if (!S.segments.length && !confirm(overlay ? 'There are no captions yet, so this file would be empty. Continue anyway?' : 'There are no captions yet. Export the video without captions?')) return;
  if (dur > 300 && !confirm(`This video is ${fmt(dur)} long. Export runs in real time, so it will take about ${fmt(dur)} and the tab must stay open. Continue?`)) return;

  size = size || exportSizes()[0];
  const xcanvas = kind === 'alpha' ? xcanvasAlpha : xcanvasOpaque;
  const xctx = kind === 'alpha' ? xctxAlpha : xctxOpaque;
  xcanvas.width = size.w; xcanvas.height = size.h;
  setExportUI(true);
  $('exportTitle').textContent = kind === 'video' ? 'Exporting video…' : kind === 'alpha' ? 'Exporting transparent captions…' : 'Exporting green-screen captions…';
  $('exportBar').style.width = '0%';
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  $('exportText').textContent = `Preparing ${ext.toUpperCase()} · ${size.w}×${size.h}…`;
  const job = exportJob = { cancelled: false, hidden: false };
  const t0 = tpl(), opts = { scale: S.o.scale, pos: S.o.pos ?? undefined, fill: video };
  const paint = t => {
    if (kind === 'alpha') xctx.clearRect(0, 0, size.w, size.h);
    else if (kind === 'green') { xctx.fillStyle = '#00FF00'; xctx.fillRect(0, 0, size.w, size.h); }
    else if (video.readyState >= 2 && video.videoWidth) xctx.drawImage(video, 0, 0, size.w, size.h);
    else { xctx.fillStyle = '#0d0d16'; xctx.fillRect(0, 0, size.w, size.h); }
    drawCaption(xctx, size.w, size.h, findChunk(fileChunks(), t), t, t0, overlay ? { ...opts, fill: null } : opts);
  };
  let stopClock = null;
  try {
    // Match the source: bitrate from the file (capped), frame rate from the decoded frames.
    const srcBps = S.file.size * 8 / dur;
    const k = (size.w * size.h) / ((video.videoWidth || size.w) * (video.videoHeight || size.h));
    const vbr = Math.round(Math.min(60e6, Math.max(4e6, srcBps * 1.15 * k)));
    const useRVFC = !overlay && !!video.requestVideoFrameCallback;
    const stream = useRVFC ? xcanvas.captureStream() : xcanvas.captureStream(30);

    if (!overlay) {
      ensureAudioGraph();
      await audioCtx.resume();
      speakerGain.gain.value = 0; // silent while exporting; the audio still goes into the file
      audioDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      video.pause();
      video.currentTime = 0;
      await new Promise(r => { video.onseeked = () => { video.onseeked = null; r(); }; });
    }
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: vbr, ...(overlay ? {} : { audioBitsPerSecond: 192000 }) });
    const parts = [];
    rec.ondataavailable = e => e.data.size && parts.push(e.data);
    const stopped = new Promise(r => { rec.onstop = r; });
    const onVis = () => { if (document.hidden) job.hidden = true; };
    document.addEventListener('visibilitychange', onVis);
    let clock;
    const ended = new Promise(r => { job.finish = r; });
    if (overlay) {
      // Captions only: no video to play, so drive time from the clock.
      const start = performance.now();
      clock = () => (performance.now() - start) / 1000;
      paint(0);
      const timer = setInterval(() => { const t = clock(); paint(Math.min(t, dur)); if (t >= dur) job.finish(); }, 1000 / 30);
      stopClock = () => clearInterval(timer);
      rec.start(1000);
    } else {
      clock = () => video.currentTime;
      video.onended = () => job.finish();
      if (useRVFC) {
        const step = () => { if (S.exporting) { paint(video.currentTime); video.requestVideoFrameCallback(step); } };
        video.requestVideoFrameCallback(step);
      } else {
        const timer = setInterval(() => paint(video.currentTime), 1000 / 30);
        stopClock = () => clearInterval(timer);
      }
      paint(0);
      rec.start(1000);
      await video.play();
    }
    const tick = setInterval(() => {
      const p = Math.min(1, clock() / dur);
      $('exportBar').style.width = `${(p * 100).toFixed(1)}%`;
      $('exportText').textContent = `${Math.round(p * 100)}% · ${fmt(clock())} of ${fmt(dur)} · ${size.w}×${size.h}${job.hidden ? ' · tab was hidden, some frames may be missing' : ''}`;
    }, 250);
    await ended;
    clearInterval(tick);
    stopClock && stopClock();
    video.onended = null;
    document.removeEventListener('visibilitychange', onVis);
    video.pause();
    rec.stop();
    await stopped;
    stream.getVideoTracks().forEach(t => t.stop());
    if (job.cancelled) { status('Export cancelled.'); return; }
    let blob = new Blob(parts, { type: mimeType.split(';')[0] });
    if (!blob.size) throw new Error('The recorder produced an empty file.');
    // MediaRecorder WebM files have no duration header, so players can't show length or seek. Patch it in.
    if (ext === 'webm' && window.ysFixWebmDuration) {
      $('exportText').textContent = 'Finishing file…';
      blob = await window.ysFixWebmDuration(blob, dur * 1000, { logger: false });
    }
    const suffix = kind === 'video' ? 'captioned' : kind === 'alpha' ? 'captions-transparent' : 'captions-greenscreen';
    const name = `${S.file.name.replace(/\.[^.]+$/, '')}-${suffix}.${ext}`;
    download(blob, name);
    status(`Exported “${name}” (${fmtBytes(blob.size)}, ${size.w}×${size.h}).` +
      (kind === 'green' ? ' In CapCut or InShot: add it as an overlay, then use Chroma Key on the green.' : '') +
      (kind === 'video' && ext === 'webm' ? ' This browser can only record WebM. YouTube accepts it; for Instagram or iPhone, export from Chrome (126+) or Safari to get MP4.' : ''));
  } catch (err) {
    status(`Export failed: ${err.message || err}`);
  } finally {
    stopClock && stopClock();
    if (speakerGain) speakerGain.gain.value = 1;
    exportJob = null;
    setExportUI(false);
    video.currentTime = 0;
  }
}
$('exportCancel').onclick = () => { if (exportJob) { exportJob.cancelled = true; exportJob.finish && exportJob.finish(); } };

// ---------- SRT ----------
$('srtBtn').onclick = () => {
  download(new Blob([C.toSRT(S.segments, transform)], { type: 'text/plain' }), `${S.file ? S.file.name.replace(/\.[^.]+$/, '') : 'captions'}.srt`);
};
$('srtIn').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const segs = C.parseSRT(await f.text());
  if (!segs.length) return toast('No captions found in that file.');
  if (S.segments.length && !confirm('Replace the current captions with this file?')) return;
  S.selected = -1;
  setSegments(segs);
  status(`Imported ${segs.length} captions. Word timing inside each caption is estimated.`);
};

// ---------- render loop ----------
function drawPlaceholder() {
  const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  g.addColorStop(0, '#24203a'); g.addColorStop(1, '#0d0d16');
  ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
}
let chunkCache = { key: null, chunks: [] };
function fileChunks() {
  const key = S.segments;
  const max = wordsPerCaption();
  if (chunkCache.key !== key || chunkCache.hinglish !== S.hinglish || chunkCache.max !== max) chunkCache = { key, max, hinglish: S.hinglish, chunks: C.toChunks(S.segments, transform, max) };
  return chunkCache.chunks;
}
// Sample words shown on the video until real captions exist, so template choice is visible immediately.
const SAMPLE_TEXT = { hinglish: 'aapke captions bilkul aise dikhenge', native: 'your captions will look like this', english: 'your captions will look like this' };
let sampleCache = { key: null, chunks: [] };
function sampleChunks() {
  const lang = LANGUAGES[$('lang').value] || {};
  const text = S.pendingMode === 'hinglish' || S.hinglish ? SAMPLE_TEXT.hinglish
    : lang.whisper === 'hindi' && S.pendingMode !== 'english' ? 'आपके कैप्शन बिल्कुल ऐसे दिखेंगे' : SAMPLE_TEXT.native;
  const key = text + wordsPerCaption();
  if (sampleCache.key !== key) sampleCache = { key, chunks: C.toChunks([C.makeSegment(C.spreadWords(text, 0.15, 3.6))], t => t, wordsPerCaption()) };
  return sampleCache.chunks;
}
function drawFrame() {
  const W = canvas.width, H = canvas.height;
  const t0 = tpl(), opts = { scale: S.o.scale, pos: S.o.pos ?? undefined, fill: video };
  if (S.mode === 'file') {
    if (S.exporting) return video.currentTime; // the export canvas does the work; the preview is covered
    const vw = video.videoWidth, vh = video.videoHeight;
    if (vw && Math.abs(W / H - vw / vh) > 0.01) fitCanvas(vw, vh);
    if (video.readyState >= 2 && vw) ctx.drawImage(video, 0, 0, canvas.width, canvas.height); else drawPlaceholder();
    const t = video.currentTime;
    if (!S.segments.length && S.file) {
      const st = (performance.now() / 1000) % 4.2;
      drawCaption(ctx, canvas.width, canvas.height, findChunk(sampleChunks(), st), st, t0, opts);
      const fs = Math.max(11, canvas.width * 0.028);
      ctx.save(); ctx.font = `600 ${fs}px Inter, sans-serif`; ctx.textBaseline = 'top';
      const label = genRunning ? 'Sample text · your captions are being generated' : 'Sample text · no captions yet';
      const w = ctx.measureText(label).width + fs;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(fs * 0.6, fs * 0.6, w, fs * 1.6);
      ctx.fillStyle = '#fff'; ctx.fillText(label, fs * 1.1, fs * 0.9); ctx.restore();
    } else {
      drawCaption(ctx, canvas.width, canvas.height, findChunk(fileChunks(), t), t, t0, opts);
    }
    return t;
  }
  if (cam && video.readyState >= 2) {
    // Mirror the selfie view, the way creators expect to see themselves.
    ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1);
    const vw = video.videoWidth, vh = video.videoHeight, k = Math.max(W / vw, H / vh);
    ctx.drawImage(video, (W - vw * k) / 2, (H - vh * k) / 2, vw * k, vh * k);
    ctx.restore();
    const t = liveNow();
    const words = liveFinal.slice(-40).concat(liveInterim).map(w => ({ ...w, text: transform(w.text) }));
    drawCaption(ctx, W, H, findChunk(buildChunks(words, wordsPerCaption()), t), t, t0, opts);
  } else drawPlaceholder();
  return 0;
}
function loop() {
  const t = drawFrame();
  if (S.mode === 'file' && isFinite(video.duration) && video.duration) {
    $('time').textContent = `${fmt(t)} / ${fmt(video.duration)}`;
    if (!S.exporting && document.activeElement !== $('seek')) $('seek').value = Math.round(t / video.duration * 1000);
    highlightSeg(t);
  }
  requestAnimationFrame(loop);
}

// ---------- keyboard ----------
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); }
  else if (e.key === ' ' && !typing && document.activeElement.tagName !== 'BUTTON' && !$('editor').hidden) { e.preventDefault(); togglePlay(); }
});

// ---------- start screen: upload → languages → generate ----------
function openEditor() {
  $('start').hidden = true;
  $('editor').hidden = false;
  $('navActions').hidden = false;
}

// A small accessible searchable dropdown.
function combo(el, placeholder, searchText, onChange) {
  let items = [], value = null, pop = null, hi = -1, shown = [];
  el.innerHTML = '';
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'combo-btn empty';
  btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
  const label = document.createElement('span');
  btn.appendChild(label);
  el.appendChild(btn);
  const close = (focus) => {
    if (!pop) return;
    pop.remove(); pop = null; el.classList.remove('open'); btn.setAttribute('aria-expanded', 'false');
    if (focus) btn.focus();
  };
  const render = () => { label.textContent = value ? value.label : placeholder; btn.classList.toggle('empty', !value); };
  const choose = it => { value = it; render(); close(true); onChange(it); };
  btn.onclick = () => {
    if (pop) return close();
    el.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    pop = document.createElement('div'); pop.className = 'combo-pop';
    const q = document.createElement('input'); q.placeholder = searchText; q.setAttribute('aria-label', searchText);
    const list = document.createElement('div'); list.className = 'combo-list'; list.setAttribute('role', 'listbox');
    const fill = () => {
      list.innerHTML = '';
      if (value) {
        const c = document.createElement('div'); c.className = 'combo-opt combo-clear'; c.textContent = '✕ Clear selection';
        c.onclick = () => { value = null; render(); close(true); onChange(null); };
        list.appendChild(c);
      }
      shown = items.filter(it => it.label.toLowerCase().includes(q.value.toLowerCase()));
      hi = Math.max(0, shown.findIndex(it => value && it.id === value.id));
      shown.forEach((it, k) => {
        const o = document.createElement('div');
        o.className = 'combo-opt' + (k === hi ? ' on' : '');
        o.setAttribute('role', 'option'); o.setAttribute('aria-selected', !!(value && value.id === it.id));
        o.textContent = it.label;
        o.onclick = () => choose(it);
        list.appendChild(o);
      });
      if (!shown.length) { const n = document.createElement('div'); n.className = 'combo-none'; n.textContent = 'No match'; list.appendChild(n); }
    };
    const move = d => {
      if (!shown.length) return;
      hi = (hi + d + shown.length) % shown.length;
      const opts = list.querySelectorAll('[role=option]');
      opts.forEach((o, k) => o.classList.toggle('on', k === hi));
      opts[hi] && opts[hi].scrollIntoView({ block: 'nearest' });
    };
    q.oninput = fill;
    q.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); shown[hi] && choose(shown[hi]); }
      else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    };
    fill();
    pop.append(q, list);
    el.appendChild(pop);
    q.focus();
  };
  document.addEventListener('click', e => { if (pop && !el.contains(e.target)) close(); });
  render();
  return {
    setItems(next) { items = next; if (value && !items.some(i => i.id === value.id)) { value = null; render(); } },
    set(id) { value = items.find(i => i.id === id) || null; render(); },
    get() { return value; },
  };
}

const store = {
  get() { try { return JSON.parse(localStorage.getItem('vcz-langs') || 'null'); } catch { return null; } },
  set(v) { try { localStorage.setItem('vcz-langs', JSON.stringify(v)); } catch { /* private mode */ } },
};
const spokenItems = LANGUAGES.map((l, i) => ({ id: i, label: l.name, lang: l }))
  .filter(it => !it.lang.hinglish)
  .sort((a, b) => (a.lang.whisper ? 1 : 0) - (b.lang.whisper ? 1 : 0) || a.label.localeCompare(b.label));
const start = { spoken: null, caption: null };
const captionCombo = combo($('captionCombo'), 'Select a language', 'Search caption language…', it => { start.caption = it; syncStart(); beginFromStart(); });
const spokenCombo = combo($('spokenCombo'), 'Select a language', 'Search spoken language…', it => {
  start.spoken = it;
  const l = it && it.lang;
  const own = l ? l.name.split(' — ')[0].replace(/ \(.*\)/, '') : '';
  const opts = !l ? [] : l.whisper === 'hindi'
    ? [{ id: 'native', label: 'Hindi' }, { id: 'hinglish', label: 'Hinglish (Roman Hindi)' }, { id: 'english', label: 'English' }]
    : l.whisper === 'english' ? [{ id: 'native', label: 'English' }]
      : !l.whisper ? [{ id: 'native', label: 'Same as spoken' }, { id: 'english', label: 'English' }]
        : [{ id: 'native', label: own }, { id: 'english', label: 'English' }];
  captionCombo.setItems(opts);
  if (opts.length === 1 || (start.caption && !opts.some(o => o.id === start.caption.id))) captionCombo.set(opts[0] && opts[0].id);
  start.caption = captionCombo.get();
  syncStart();
  if (it) beginFromStart();
});
spokenCombo.setItems(spokenItems);
{
  // Remember last languages so the next upload starts captions immediately.
  const saved = store.get();
  const sp = saved && spokenItems.find(x => x.lang.name === saved.spoken);
  if (sp) {
    spokenCombo.set(sp.id);
    start.spoken = sp;
    const own = sp.lang.name.split(' — ')[0].replace(/ \(.*\)/, '');
    const opts = sp.lang.whisper === 'hindi'
      ? [{ id: 'native', label: 'Hindi' }, { id: 'hinglish', label: 'Hinglish (Roman Hindi)' }, { id: 'english', label: 'English' }]
      : sp.lang.whisper === 'english' ? [{ id: 'native', label: 'English' }]
        : !sp.lang.whisper ? [{ id: 'native', label: 'Same as spoken' }, { id: 'english', label: 'English' }]
          : [{ id: 'native', label: own }, { id: 'english', label: 'English' }];
    captionCombo.setItems(opts);
    captionCombo.set(saved.caption);
    start.caption = captionCombo.get();
    if (saved.quality) $('startModel').value = saved.quality;
  }
}

function syncStart() {
  const go = $('startGo');
  go.disabled = !(S.file && start.spoken && start.caption) || genRunning;
  $('startGoText').textContent = !S.file ? 'Upload Video First' : !start.spoken || !start.caption ? 'Choose Languages' : 'Generate Captions';
  if (S.file && (!start.spoken || !start.caption)) $('startMsg').textContent = 'Choose the spoken language. Captions start automatically.';
  else if ($('startMsg').textContent.startsWith('Choose the spoken')) $('startMsg').textContent = '';
}
function beginFromStart() {
  if (!S.file || !start.spoken || !start.caption || genRunning) return;
  store.set({ spoken: start.spoken.lang.name, caption: start.caption.id, quality: $('startModel').value });
  $('lang').value = start.spoken.id;
  $('model').value = $('startModel').value;
  $('translate').checked = start.caption.id === 'english';
  openEditor();
  runGeneration({ lang: start.spoken.lang, mode: start.caption.id, quality: $('startModel').value });
}

async function startFile(file) {
  if (!file || genRunning) return;
  if (!(await loadFile(file))) return;
  $('startVideo').src = S.fileURL;
  $('startDrop').hidden = true;
  $('startPreview').hidden = false;
  $('startMeta').textContent = fileMeta();
  syncStart();
  beginFromStart();
}
$('startFile').onchange = e => { startFile(e.target.files[0]); e.target.value = ''; };
const sd = $('startDrop');
['dragenter', 'dragover'].forEach(ev => sd.addEventListener(ev, e => { e.preventDefault(); sd.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => sd.addEventListener(ev, e => { e.preventDefault(); sd.classList.remove('over'); }));
sd.addEventListener('drop', e => startFile(e.dataTransfer.files[0]));
$('startRemove').onclick = () => {
  if (genRunning) return;
  $('startVideo').removeAttribute('src'); $('startVideo').load();
  video.removeAttribute('src'); video.load();
  if (S.fileURL) URL.revokeObjectURL(S.fileURL);
  S.file = null; S.fileURL = null; S.segments = [];
  $('startPreview').hidden = true; $('startDrop').hidden = false; $('startMeta').textContent = '';
  $('drop').classList.remove('hide');
  renderSegs(); syncActions(); syncStart();
};
$('startGo').onclick = () => beginFromStart();
$('startCancel').onclick = () => cancelTranscribe();
$('startLive').onclick = e => { e.preventDefault(); openEditor(); setMode('live'); };
$('startSkip').onclick = e => { e.preventDefault(); openEditor(); };

window.addEventListener('beforeunload', e => {
  if (S.exporting || busyGen) { e.preventDefault(); e.returnValue = ''; }
});
window.addEventListener('pagehide', () => { if (S.fileURL) URL.revokeObjectURL(S.fileURL); });

// ---------- boot ----------
syncControls();
renderSegs();
syncActions();
commit();
status('Upload a video to get started.');
loadTemplateFonts();
if (location.hash === '#live') { openEditor(); setMode('live'); }
requestAnimationFrame(loop);

// Exposed for automated end-to-end tests only.
window.__vcz = { S, tpl, setSegments, C };
