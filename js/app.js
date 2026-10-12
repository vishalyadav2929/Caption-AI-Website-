import { TEMPLATES, FONTS_URL, loadTemplateFonts } from './templates.js';
import { buildChunks, findChunk, drawCaption, spreadWords } from './renderer.js';
import { LANGUAGES, toHinglish } from './languages.js';
import { mountGallery } from './gallery.js';

const $ = id => document.getElementById(id);
document.getElementById('fonts').href = FONTS_URL;

const canvas = $('stage');
const ctx = canvas.getContext('2d');
const video = document.createElement('video');
video.playsInline = true;
video.preload = 'auto';

const S = {
  mode: 'file',
  tpl: TEMPLATES.find(t => t.id === new URLSearchParams(location.search).get('t')) || TEMPLATES[0],
  o: { scale: 1, pos: null, words: null, color: null, hiColor: null, upper: null },
  words: [],        // source of truth: [{ text, start, end }]
  chunks: [],       // derived groups for display
  file: null,
  hinglish: false,
  exporting: false,
  activeLine: -1,
};

// ---------- helpers ----------
const fmt = s => { if (!isFinite(s)) return '--:--'; s = Math.max(0, s || 0); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
let toastTimer;
function toast(msg, ms = 3200) {
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
function tpl() {
  const o = S.o, t = S.tpl;
  return {
    ...t,
    words: o.words ?? t.words,
    color: o.color ?? t.color,
    hiColor: o.hiColor ?? t.hiColor ?? '#FFE600',
    hi: t.hi === 'none' && o.hiColor ? 'color' : t.hi,
    upper: o.upper ?? !!t.upper,
    lower: (o.upper ?? !!t.upper) ? false : t.lower,
  };
}
function displayWords(words) {
  return S.hinglish ? words.map(w => ({ ...w, text: toHinglish(w.text) })) : words;
}

// ---------- language list ----------
LANGUAGES.forEach((l, i) => {
  const o = document.createElement('option');
  o.value = i; o.textContent = l.name;
  $('lang').appendChild(o);
});
$('lang').onchange = () => {
  const l = LANGUAGES[$('lang').value];
  if (l.hinglish) { $('hinglish').checked = true; S.hinglish = true; rebuild(); }
  if (S.mode === 'live' && recog) { stopRecognition(); startRecognition(); }
};

// ---------- templates & style controls ----------
function syncControls() {
  const t = tpl();
  $('words').value = t.words; $('wordsVal').textContent = t.words;
  $('color').value = toHex(t.color);
  $('hiColor').value = toHex(t.hiColor);
  $('upper').checked = t.upper;
  $('pos').value = Math.round((S.o.pos ?? S.tpl.pos ?? 0.72) * 100);
  $('sizeVal').textContent = `${Math.round(S.o.scale * 100)}%`;
}
function toHex(c) {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  const x = document.createElement('canvas').getContext('2d');
  x.fillStyle = c; return /^#/.test(x.fillStyle) ? x.fillStyle : '#ffffff';
}
const gallery = mountGallery({
  tabsEl: $('tabs'), gridEl: $('grid'), langEl: $('langTabs'), selected: S.tpl.id,
  onSelect: t => {
    S.tpl = t;
    Object.assign(S.o, { words: null, color: null, hiColor: null, upper: null });
    syncControls(); rebuild();
  },
});
$('size').oninput = e => { S.o.scale = e.target.value / 100; $('sizeVal').textContent = `${e.target.value}%`; };
$('pos').oninput = e => { S.o.pos = e.target.value / 100; };
$('words').oninput = e => { S.o.words = +e.target.value; $('wordsVal').textContent = e.target.value; rebuild(); };
$('color').oninput = e => { S.o.color = e.target.value; };
$('hiColor').oninput = e => { S.o.hiColor = e.target.value; };
$('upper').onchange = e => { S.o.upper = e.target.checked; };
$('hinglish').onchange = e => { S.hinglish = e.target.checked; rebuild(); };

// ---------- transcript ----------
function rebuild() {
  S.chunks = buildChunks(displayWords(S.words), tpl().words);
  renderLines();
  const has = S.words.length > 0;
  $('srtBtn').disabled = !has;
  $('exportBtn').disabled = S.exporting || !(has && S.file && S.mode === 'file');
}
function renderLines() {
  const box = $('lines');
  box.innerHTML = '';
  S.activeLine = -1;
  if (!S.chunks.length) {
    const p = document.createElement('p'); p.className = 'hint';
    p.textContent = 'Captions appear here. Edit any line to fix a word.';
    box.appendChild(p); return;
  }
  S.chunks.forEach((c, i) => {
    const row = document.createElement('div'); row.className = 'line'; row.dataset.i = i;
    const ts = document.createElement('div'); ts.className = 'ts'; ts.textContent = fmt(c.start);
    ts.title = 'Jump here';
    ts.onclick = () => { if (S.mode === 'file' && video.src) video.currentTime = c.start + 0.01; };
    const ta = document.createElement('textarea');
    ta.rows = 1; ta.value = c.words.map(w => w.text).join(' ');
    ta.onchange = () => {
      const src = S.words.slice(c.from, c.to);
      const end = src.length ? src[src.length - 1].end : c.end;
      S.words.splice(c.from, c.to - c.from, ...spreadWords(ta.value, c.start, end));
      rebuild();
    };
    row.append(ts, ta);
    box.appendChild(row);
  });
}
function highlightLine(t) {
  let idx = -1;
  for (let i = 0; i < S.chunks.length; i++) if (S.chunks[i].start <= t) idx = i; else break;
  if (idx === S.activeLine) return;
  const rows = $('lines').children;
  if (rows[S.activeLine]) rows[S.activeLine].classList.remove('on');
  if (rows[idx]) {
    rows[idx].classList.add('on');
    if (!video.paused) rows[idx].scrollIntoView({ block: 'nearest' });
  }
  S.activeLine = idx;
}

// ---------- file mode ----------
async function loadFile(file) {
  if (!file) return;
  if (!/^(video|audio)\//.test(file.type)) return toast('Please choose a video or audio file.');
  S.file = file; S.words = [];
  video.srcObject = null;
  if (S.fileURL) URL.revokeObjectURL(S.fileURL);
  S.fileURL = URL.createObjectURL(file);
  video.src = S.fileURL;
  video.muted = false;
  await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = () => rej(new Error('bad file')); })
    .catch(() => toast('This browser can’t play that file. Try MP4 or WEBM.'));
  fitCanvas(video.videoWidth || 1080, video.videoHeight || 1920);
  $('drop').classList.add('hide');
  $('playBtn').disabled = false; $('seek').disabled = false; $('genBtn').disabled = false;
  status(`Loaded “${file.name}”. Choose a language, then Generate captions.`);
  rebuild();
}
function fitCanvas(w, h) {
  if (!(w >= 16 && h >= 16)) return;
  const k = Math.min(1, 1920 / Math.max(w, h));
  canvas.width = Math.round(w * k / 2) * 2;
  canvas.height = Math.round(h * k / 2) * 2;
}
$('fileIn').onchange = e => loadFile(e.target.files[0]);
const box = $('box');
['dragenter', 'dragover'].forEach(ev => box.addEventListener(ev, e => { e.preventDefault(); $('drop').classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => box.addEventListener(ev, e => { e.preventDefault(); $('drop').classList.remove('over'); }));
box.addEventListener('drop', e => { if (S.mode === 'file') loadFile(e.dataTransfer.files[0]); });

$('playBtn').onclick = () => (video.paused ? video.play() : video.pause());
video.onplay = () => { $('playBtn').textContent = '❚❚ Pause'; };
video.onpause = () => { $('playBtn').textContent = '▶ Play'; };
$('seek').oninput = e => { if (isFinite(video.duration)) video.currentTime = e.target.value / 1000 * video.duration; };
canvas.addEventListener('click', () => { if (S.mode === 'file' && video.src && !S.exporting) $('playBtn').click(); });

// ---------- AI transcription (in-browser Whisper) ----------
let worker;
async function decodeAudio(file) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC({ sampleRate: 16000 });
  try {
    const buf = await ac.decodeAudioData(await file.arrayBuffer());
    if (buf.numberOfChannels === 1) return buf.getChannelData(0);
    const out = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) out[i] += d[i] / buf.numberOfChannels;
    }
    return out;
  } finally { ac.close(); }
}
// Runs speech-to-text on a file. hooks: { onStatus(text), onProgress(pct) }
async function transcribe(file, { lang, task, model }, hooks = {}) {
  const audio = await decodeAudio(file).catch(() => { throw new Error('Couldn’t read the audio track from this file.'); });
  worker = worker || new Worker(new URL('./whisper-worker.js', import.meta.url), { type: 'module' });
  const files = {};
  return new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') {
        files[data.file] = data.progress;
        const v = Object.values(files);
        hooks.onProgress && hooks.onProgress(v.reduce((a, b) => a + b, 0) / v.length);
      } else if (data.type === 'status') hooks.onStatus && hooks.onStatus(data.text);
      else if (data.type === 'error') reject(new Error(data.text));
      else if (data.type === 'done') resolve({ words: toWords(data), level: data.level });
    };
    worker.postMessage({ audio, model, language: lang.whisper, task }, [audio.buffer]);
  });
}

$('genBtn').onclick = async () => {
  if (!S.file) return;
  const lang = LANGUAGES[$('lang').value];
  $('genBtn').disabled = true;
  status('Reading audio…');
  try {
    const res = await transcribe(S.file, { lang, model: $('model').value, task: $('translate').checked ? 'translate' : 'transcribe' }, {
      onStatus: text => status(text),
      onProgress: pct => status('Downloading AI model (one time)…', pct),
    });
    S.words = res.words;
    if (lang.hinglish) { S.hinglish = true; $('hinglish').checked = true; }
    rebuild();
    status(S.words.length ? `Done. ${S.words.length} words captioned. Pick a style, then export.` : 'No speech found in this file.');
    if (res.level === 'segment') toast('Word timing is approximate for this model.');
  } catch (err) {
    status('Transcription failed: ' + err.message + ' Check your internet connection for the first model download, or try the Fast model.');
  } finally {
    $('genBtn').disabled = false;
  }
};
function toWords({ chunks, level, duration }) {
  const out = [];
  if (level === 'word') {
    chunks.forEach(c => {
      const text = (c.text || '').trim();
      if (!text) return;
      const [s, e] = c.timestamp;
      out.push({ text, start: s, end: e ?? s + 0.3 });
    });
  } else {
    chunks.forEach(c => out.push(...spreadWords(c.text.trim(), c.timestamp[0], c.timestamp[1] ?? duration)));
  }
  return out;
}

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
  $('liveControls').hidden = mode !== 'live';
  $('fileOnly').hidden = mode !== 'file';
  if (mode === 'live') {
    S.fileWords = S.words;
    S.words = [];
    video.pause();
    $('drop').classList.add('hide');
    fitCanvas(1080, 1920);
    status(SR ? 'Start the camera and speak. Captions appear as you talk.' : 'Live captions need Chrome, Edge or Safari. Uploading a video works in every browser.');
  } else {
    stopLive();
    $('drop').classList.toggle('hide', !!S.file);
    if (S.file) {
      video.muted = false;
      video.src = S.fileURL;
    }
    S.words = S.fileWords || [];
    status(S.file ? '' : 'Upload a video to get started.');
  }
  rebuild();
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
  video.src = '';
  video.srcObject = cam;
  video.muted = true;
  await video.play();
  fitCanvas(1080, 1920); // Reels are vertical; the camera is center-cropped to 9:16.
  liveT0 = performance.now(); liveFinal = []; liveInterim = []; interimTimes = [];
  S.words = []; rebuild();
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
          liveFinal.push({ text: p, start, end: Math.max(start + 0.2, interimTimes[k + 1] ?? now) });
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
    else if (e.error === 'language-not-supported') toast('This browser can’t do live captions in that language. Try uploading instead.');
  };
  // Browsers end recognition after silence. Restart while the camera is on.
  recog.onend = () => { if (wantLive && recog) try { recog.start(); } catch {} };
  try { recog.start(); } catch {}
}
function stopRecognition() {
  if (!recog) return;
  const r = recog; recog = null; r.onend = null;
  try { r.stop(); } catch {}
}
function stopLive() {
  wantLive = false;
  stopRecognition();
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  if (cam) cam.getTracks().forEach(t => t.stop());
  cam = null;
  if (S.mode === 'live') {
    video.srcObject = null;
    S.words = liveFinal.slice();
    rebuild();
  }
  $('camBtn').textContent = 'Start camera';
  $('recBtn').disabled = true;
}

// ---------- recording / export ----------
let recorder = null, audioCtx = null, mediaNode = null, audioDest = null;
function pickMime() {
  const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
}
function startRecorder(stream, name, onDone) {
  const mimeType = pickMime();
  const parts = [];
  recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  recorder.ondataavailable = e => e.data.size && parts.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(parts, { type: mimeType || 'video/webm' });
    download(blob, `${name}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`);
    onDone && onDone();
  };
  recorder.start(250);
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

$('recBtn').onclick = () => {
  if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
  if (!window.MediaRecorder) return toast('Recording isn’t supported in this browser.');
  const stream = canvas.captureStream(30);
  cam.getAudioTracks().forEach(t => stream.addTrack(t));
  startRecorder(stream, 'viralcaptionzone-live', () => {
    $('recBtn').textContent = '● Record';
    $('liveTime').textContent = '';
    toast('Recording saved to your downloads.');
  });
  $('recBtn').textContent = '■ Stop';
  $('liveTime').innerHTML = '<span class="live-dot"></span> REC';
};

$('exportBtn').onclick = async () => {
  if (S.exporting || !S.file) return;
  if (!window.MediaRecorder) return toast('Export isn’t supported in this browser.');
  S.exporting = true;
  $('exportBtn').disabled = true;
  status('Exporting… keep this tab open and visible. It takes as long as the video.');
  const AC = window.AudioContext || window.webkitAudioContext;
  audioCtx = audioCtx || new AC();
  await audioCtx.resume();
  if (!mediaNode) {
    mediaNode = audioCtx.createMediaElementSource(video);
    audioDest = audioCtx.createMediaStreamDestination();
    mediaNode.connect(audioCtx.destination);
    mediaNode.connect(audioDest);
  }
  video.pause();
  video.currentTime = 0;
  await new Promise(r => { video.onseeked = r; });
  const stream = canvas.captureStream(30);
  audioDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  const base = S.file.name.replace(/\.[^.]+$/, '');
  startRecorder(stream, `${base}-captioned`, () => {
    S.exporting = false; $('exportBtn').disabled = false;
    status('Export finished. Check your downloads.');
  });
  video.onended = () => { video.onended = null; if (recorder.state !== 'inactive') recorder.stop(); };
  await video.play();
};

// ---------- SRT ----------
const srtTime = s => {
  const ms = Math.round(s * 1000);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
$('srtBtn').onclick = () => {
  const srt = S.chunks.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.words.map(w => w.text).join(' ')}\n`).join('\n');
  download(new Blob([srt], { type: 'text/plain' }), `${S.file ? S.file.name.replace(/\.[^.]+$/, '') : 'captions'}.srt`);
};
$('srtIn').onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  const text = await f.text();
  const toSec = t => { const m = t.trim().replace(',', '.').split(':').map(Number); return m.length === 3 ? m[0] * 3600 + m[1] * 60 + m[2] : m[0] * 60 + m[1]; };
  const words = [];
  text.replace(/\r/g, '').split(/\n\n+/).forEach(block => {
    const lines = block.split('\n');
    const ti = lines.findIndex(l => l.includes('-->'));
    if (ti < 0) return;
    const [a, b] = lines[ti].split('-->');
    const cue = lines.slice(ti + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    words.push(...spreadWords(cue, toSec(a), toSec(b.split(' ').filter(Boolean)[0])));
  });
  if (!words.length) return toast('No captions found in that file.');
  S.words = words; rebuild();
  toast(`Imported ${words.length} words.`);
  e.target.value = '';
};

// ---------- render loop ----------
function drawPlaceholder() {
  const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  g.addColorStop(0, '#1c1630'); g.addColorStop(1, '#0d0d16');
  ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
}
function frame() {
  const W = canvas.width, H = canvas.height;
  const t0 = tpl(), opts = { scale: S.o.scale, pos: S.o.pos ?? undefined, fill: video };
  if (S.mode === 'file') {
    // Keep the canvas matched to the video's real size (it's only known after metadata loads).
    const vw = video.videoWidth, vh = video.videoHeight;
    if (vw && !S.exporting && Math.abs(W / H - vw / vh) > 0.01) { fitCanvas(vw, vh); return requestAnimationFrame(frame); }
    if (video.readyState >= 2) ctx.drawImage(video, 0, 0, W, H); else drawPlaceholder();
    const t = video.currentTime;
    drawCaption(ctx, W, H, findChunk(S.chunks, t), t, t0, opts);
    if (isFinite(video.duration) && video.duration) {
      $('time').textContent = `${fmt(t)} / ${fmt(video.duration)}`;
      if (!S.exporting) $('seek').value = Math.round(t / video.duration * 1000);
    }
    highlightLine(t);
  } else {
    if (cam && video.readyState >= 2) {
      // Mirror the selfie view, the way creators expect to see themselves.
      ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1);
      const vw = video.videoWidth, vh = video.videoHeight, k = Math.max(W / vw, H / vh);
      ctx.drawImage(video, (W - vw * k) / 2, (H - vh * k) / 2, vw * k, vh * k);
      ctx.restore();
      const t = liveNow();
      const words = displayWords(liveFinal.slice(-40).concat(liveInterim));
      const chunks = buildChunks(words, t0.words);
      drawCaption(ctx, W, H, findChunk(chunks, t), t, t0, opts);
    } else drawPlaceholder();
  }
  requestAnimationFrame(frame);
}

// ---------- start screen: upload → languages → generate ----------
function openEditor() {
  $('start').hidden = true;
  $('editor').hidden = false;
  $('navActions').hidden = false;
}

// A small searchable dropdown.
function combo(el, placeholder, searchText, onChange) {
  let items = [], value = null;
  el.innerHTML = '';
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'combo-btn empty';
  const label = document.createElement('span');
  btn.appendChild(label);
  el.appendChild(btn);
  let pop = null;
  const close = () => { if (pop) { pop.remove(); pop = null; el.classList.remove('open'); } };
  const render = () => { label.textContent = value ? value.label : placeholder; btn.classList.toggle('empty', !value); };
  btn.onclick = () => {
    if (pop) return close();
    el.classList.add('open');
    pop = document.createElement('div'); pop.className = 'combo-pop';
    const q = document.createElement('input'); q.placeholder = searchText;
    const list = document.createElement('div'); list.className = 'combo-list';
    const fill = () => {
      list.innerHTML = '';
      if (value) {
        const c = document.createElement('div'); c.className = 'combo-opt combo-clear'; c.textContent = '✕ Clear selection';
        c.onclick = () => { value = null; render(); close(); onChange(null); };
        list.appendChild(c);
      }
      items.filter(it => it.label.toLowerCase().includes(q.value.toLowerCase())).forEach(it => {
        const o = document.createElement('div');
        o.className = 'combo-opt' + (value && value.id === it.id ? ' on' : '');
        o.textContent = it.label;
        o.onclick = () => { value = it; render(); close(); onChange(it); };
        list.appendChild(o);
      });
    };
    q.oninput = fill; fill();
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

const spokenItems = LANGUAGES.map((l, i) => ({ id: i, label: l.name, lang: l }))
  .filter(it => !it.lang.hinglish)
  .sort((a, b) => (a.lang.whisper ? 1 : 0) - (b.lang.whisper ? 1 : 0) || a.label.localeCompare(b.label));
const start = { spoken: null, caption: null };
const captionCombo = combo($('captionCombo'), 'Select a language', 'Search caption language…', it => { start.caption = it; syncStart(); });
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
});
spokenCombo.setItems(spokenItems);

function syncStart() {
  const go = $('startGo');
  if (go.classList.contains('busy')) return;
  go.disabled = !(S.file && start.spoken && start.caption);
  $('startGoText').textContent = !S.file ? 'Upload Video First' : !start.spoken || !start.caption ? 'Choose Languages' : 'Generate Captions';
}

async function startFile(file) {
  if (!file) return;
  await loadFile(file);
  if (!S.file) return;
  $('startVideo').src = S.fileURL;
  $('startDrop').hidden = true;
  $('startPreview').hidden = false;
  syncStart();
}
$('startFile').onchange = e => startFile(e.target.files[0]);
const sd = $('startDrop');
['dragenter', 'dragover'].forEach(ev => sd.addEventListener(ev, e => { e.preventDefault(); sd.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => sd.addEventListener(ev, e => { e.preventDefault(); sd.classList.remove('over'); }));
sd.addEventListener('drop', e => startFile(e.dataTransfer.files[0]));
$('startRemove').onclick = () => {
  $('startVideo').removeAttribute('src'); $('startVideo').load();
  video.removeAttribute('src'); video.load();
  S.file = null; S.words = [];
  $('startFile').value = '';
  $('startPreview').hidden = true; $('startDrop').hidden = false;
  $('drop').classList.remove('hide');
  rebuild(); syncStart();
};

$('startGo').onclick = async () => {
  const go = $('startGo'), bar = $('startBar'), txt = $('startGoText');
  const lang = start.spoken.lang, mode = start.caption.id;
  const task = mode === 'english' && lang.whisper !== 'english' ? 'translate' : 'transcribe';
  go.classList.add('busy'); go.disabled = true;
  const t0 = Date.now();
  let phase = 'Reading audio…';
  const tick = setInterval(() => {
    if (phase === 'listen') txt.textContent = `Processing… this may take a minute (${Math.round((Date.now() - t0) / 1000)}s)`;
  }, 500);
  txt.textContent = phase;
  $('startMsg').textContent = '';
  try {
    const res = await transcribe(S.file, { lang, task, model: $('startModel').value }, {
      onProgress: pct => { bar.style.width = `${pct}%`; txt.textContent = `Downloading AI model… ${Math.round(pct)}%`; },
      onStatus: text => { if (/Listening/.test(text)) { phase = 'listen'; bar.style.width = '100%'; } else txt.textContent = text; },
    });
    S.words = res.words;
    S.hinglish = mode === 'hinglish';
    $('hinglish').checked = S.hinglish;
    $('lang').value = start.spoken.id;
    $('translate').checked = task === 'translate';
    $('model').value = $('startModel').value;
    rebuild();
    openEditor();
    status(S.words.length ? `Done. ${S.words.length} words captioned. Pick a template, then export.` : 'No speech found in this file.');
    if (res.level === 'segment') toast('Word timing is approximate for this model.');
  } catch (err) {
    $('startMsg').textContent = 'Couldn’t generate captions: ' + err.message + ' The first run needs internet to download the AI model.';
  } finally {
    clearInterval(tick);
    go.classList.remove('busy'); bar.style.width = '0';
    syncStart();
  }
};
$('startLive').onclick = e => { e.preventDefault(); openEditor(); setMode('live'); };
$('startSkip').onclick = e => { e.preventDefault(); openEditor(); };

// ---------- boot ----------
syncControls();
gallery.select(S.tpl.id);
status('Upload a video to get started.');
loadTemplateFonts();
if (location.hash === '#live') { openEditor(); setMode('live'); }
requestAnimationFrame(frame);
