// Timeline under the preview: time ruler, one block per word, one per caption, the audio waveform and
// a playhead. Click to jump, double-click a word to fix it, Delete to remove it, zoom in/out.
// All edits go back through `api`, so undo/redo and the caption list stay in step.

const ZOOMS = [30, 60, 100, 160, 240, 360]; // pixels per second

/**
 * api: { segments(), duration(), time(), playing(), seek(t), editWord(si, wi, text), deleteWord(si, wi),
 *        selectSeg(i), wave(), show(text), pos(), setPos(p) }
 */
export function mountTimeline(root, api) {
  root.innerHTML = `
    <div class="tl-bar">
      <span class="tl-title">Timeline</span>
      <span class="tl-acts"><button type="button" data-act="split" title="Split the caption at the playhead">✂ Split</button><button type="button" data-act="del" title="Delete the selected word, caption, text or sound">🗑 Delete</button></span>
      <div class="tl-pos" role="group" aria-label="Caption position">
        <button type="button" data-pos="0.2">Top</button><button type="button" data-pos="0.5">Middle</button><button type="button" data-pos="0.78">Bottom</button>
      </div>
      <button type="button" class="tl-addtxt">+ Text</button>
      <button type="button" class="tl-add" aria-haspopup="true">+ Sound</button>
      <span class="tl-zoom"><button type="button" data-z="-1" aria-label="Zoom out">−</button><button type="button" data-z="1" aria-label="Zoom in">+</button></span>
    </div>
    <div class="tl-scroll" tabindex="0" aria-label="Timeline: click to jump, double-click a word to edit it, Delete removes the selected word">
      <div class="tl-inner">
        <div class="tl-ruler"></div>
        <div class="tl-row tl-words"></div>
        <div class="tl-row tl-caps"></div>
        <div class="tl-row tl-txt"></div>
        <div class="tl-row tl-sfx"></div>
        <canvas class="tl-wave" height="40"></canvas>
        <div class="tl-head"></div>
      </div>
    </div>
    <div class="tl-menu" hidden>
      <div class="tl-menu-h"><b>Sound effects</b><span>Tap ▶ to hear, + to add at the playhead</span></div>
      <div class="tl-sounds"></div>
      <label class="tl-auto">On every caption: <select class="tl-auto-sel"><option value="">Off</option></select></label>
    </div>
    <p class="tl-hint">Click a word to jump · double-click to fix it · Delete removes the selected word or sound</p>`;
  const $ = s => root.querySelector(s);
  const sfxRow = $('.tl-sfx'), txtRow = $('.tl-txt'), menu = $('.tl-menu');
  let sfxSel = null;
  (api.sounds || []).forEach(snd => {
    const row = document.createElement('div'); row.className = 'tl-snd';
    const play = document.createElement('button'); play.type = 'button'; play.textContent = '▶'; play.setAttribute('aria-label', `Play ${snd.name}`);
    play.onclick = () => api.previewSound(snd.id);
    const add = document.createElement('button'); add.type = 'button'; add.className = 'add'; add.textContent = `${snd.icon} ${snd.name} +`;
    add.onclick = () => { api.addSound(snd.id); };
    row.append(play, add); $('.tl-sounds').appendChild(row);
    const o = document.createElement('option'); o.value = snd.id; o.textContent = `${snd.icon} ${snd.name}`; $('.tl-auto-sel').appendChild(o);
  });
  // The sound list lives in a side panel instead of under the timeline.
  if (api.soundsHost) { api.soundsHost.appendChild(menu); menu.hidden = false; }
  $('.tl-add').onclick = () => { menu.querySelector('.tl-auto-sel').value = api.autoSound() || ''; if (api.openSounds) api.openSounds(); else menu.hidden = !menu.hidden; };
  $('.tl-addtxt').onclick = () => api.addText && api.addText();
  menu.querySelector('.tl-auto-sel').onchange = e => api.setAutoSound(e.target.value || null);
  const scroll = $('.tl-scroll'), inner = $('.tl-inner'), ruler = $('.tl-ruler'), wordsRow = $('.tl-words'), capsRow = $('.tl-caps'), wave = $('.tl-wave'), head = $('.tl-head');
  let zi = 2, pps = ZOOMS[zi], fitted = false, sel = null; // sel = [si, wi]

  root.querySelector('.tl-zoom').onclick = e => {
    const d = +(e.target.dataset.z || 0);
    if (!d) return;
    zi = Math.max(0, Math.min(ZOOMS.length - 1, zi + d)); pps = ZOOMS[zi]; fitted = true;
    renderNow();
  };
  root.querySelector('.tl-acts').onclick = e => {
    const act = e.target.closest('button') && e.target.closest('button').dataset.act;
    if (act === 'split') api.splitAt(api.time());
    if (act === 'del') {
      if (sfxSel != null) { const i = sfxSel; sfxSel = null; api.deleteSound(i); }
      else if (sel) { const [si, wi] = sel; sel = null; api.deleteWord(si, wi); }
      else api.deleteSelected();
    }
  };
  root.querySelector('.tl-pos').onclick = e => { const p = e.target.dataset.pos; if (p) { api.setPos(+p); syncPos(); } };
  function syncPos() {
    const p = api.pos();
    root.querySelectorAll('.tl-pos button').forEach(b => b.classList.toggle('on', Math.abs(+b.dataset.pos - p) < 0.12));
  }

  // Click on empty timeline → jump there.
  inner.addEventListener('click', e => {
    if (e.target.closest('.tw, .tc, .ttx')) return;
    const x = e.clientX - inner.getBoundingClientRect().left;
    api.seek(Math.max(0, x / pps));
  });
  scroll.addEventListener('keydown', e => {
    if (document.activeElement.isContentEditable) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && sfxSel != null) { e.preventDefault(); const i = sfxSel; sfxSel = null; api.deleteSound(i); return; }
    if (!sel) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); const [si, wi] = sel; sel = null; api.deleteWord(si, wi); }
  });

  // One edit often asks for several redraws in a row (caption list, undo, sounds): build the DOM once.
  let queued = false;
  function render() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; renderNow(); });
  }
  function renderNow() {
    const dur = api.duration() || 0;
    if (!fitted && dur) {
      // Start zoomed so a short reel fits the width; long videos get a comfortable reading zoom.
      const fit = (scroll.clientWidth - 20) / dur;
      zi = dur <= 15 ? ZOOMS.reduce((best, z, i) => (z <= Math.max(fit, ZOOMS[0]) ? i : best), 0) : 2; pps = ZOOMS[zi];
    }
    const W = Math.max(scroll.clientWidth - 2, Math.ceil(dur * pps) + 24);
    inner.style.width = `${W}px`;
    // Ruler
    ruler.innerHTML = '';
    const stepS = pps >= 160 ? 0.5 : pps >= 60 ? 1 : 2;
    for (let t = 0; t <= dur + 0.001; t += stepS) {
      const tick = document.createElement('span');
      tick.style.left = `${t * pps}px`;
      if (Math.abs(t - Math.round(t)) < 0.01) tick.textContent = `${Math.floor(t / 60)}:${String(Math.round(t) % 60).padStart(2, '0')}`;
      else tick.className = 'minor';
      ruler.appendChild(tick);
    }
    // Words and captions
    wordsRow.innerHTML = ''; capsRow.innerHTML = '';
    api.segments().forEach((seg, si) => {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'tc';
      c.style.left = `${seg.start * pps}px`; c.style.width = `${Math.max(6, (seg.end - seg.start) * pps - 2)}px`;
      c.textContent = api.show(seg.words.map(w => w.text).join(' '));
      c.title = c.textContent;
      c.onclick = () => { api.seek(seg.start); api.selectSeg(si); };
      capsRow.appendChild(c);
      seg.words.forEach((w, wi) => {
        const b = document.createElement('span');
        b.className = 'tw' + (sel && sel[0] === si && sel[1] === wi ? ' sel' : '');
        b.style.left = `${w.start * pps}px`; b.style.width = `${Math.max(8, (w.end - w.start) * pps - 2)}px`;
        b.textContent = api.show(w.text);
        b.title = `${b.textContent} · ${w.start.toFixed(2)}s`;
        b.onclick = () => { sel = [si, wi]; wordsRow.querySelectorAll('.tw.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); api.seek(w.start); scroll.focus({ preventScroll: true }); };
        b.ondblclick = () => {
          b.contentEditable = 'true'; b.textContent = w.text; b.classList.add('editing');
          const range = document.createRange(); range.selectNodeContents(b);
          const s = getSelection(); s.removeAllRanges(); s.addRange(range);
          const done = save => { b.contentEditable = 'false'; b.classList.remove('editing'); b.onblur = b.onkeydown = null; if (save) api.editWord(si, wi, b.textContent.trim()); else renderNow(); };
          b.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); done(true); } if (e.key === 'Escape') done(false); e.stopPropagation(); };
          b.onblur = () => done(true);
        };
        wordsRow.appendChild(b);
      });
    });
    sfxRow.innerHTML = '';
    (api.soundList ? api.soundList() : []).forEach((fx, i) => {
      const snd = (api.sounds || []).find(s => s.id === fx.id);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tsfx' + (fx.auto ? ' auto' : '') + (sfxSel === i && !fx.auto ? ' sel' : '');
      b.style.left = `${fx.t * pps}px`;
      b.textContent = snd ? snd.icon : '♪';
      b.title = `${snd ? snd.name : fx.id} at ${fx.t.toFixed(2)}s${fx.auto ? ' (automatic)' : ' · Delete removes it'}`;
      b.onclick = e => { e.stopPropagation(); api.previewSound(fx.id); if (!fx.auto) { sfxSel = fx.index; sel = null; renderNow(); scroll.focus({ preventScroll: true }); } };
      sfxRow.appendChild(b);
    });
    renderTexts(dur);
    drawWave(W);
    syncPos();
    tick(api.time());
  }

  // Text layers: drag the block to move it in time, drag its right edge to change how long it shows.
  function renderTexts(dur) {
    txtRow.innerHTML = '';
    const list = api.texts ? api.texts() : [];
    txtRow.hidden = !list.length;
    inner.classList.toggle('has-txt', list.length > 0);
    list.forEach(L => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ttx' + (api.selectedText && api.selectedText() === L.id ? ' sel' : '');
      b.style.left = `${L.start * pps}px`; b.style.width = `${Math.max(14, (L.end - L.start) * pps - 2)}px`;
      b.textContent = `T ${L.text.replace(/\s+/g, ' ')}`;
      b.title = `${L.text} · ${L.start.toFixed(2)}–${L.end.toFixed(2)}s · drag to move, drag the right edge to resize`;
      const grip = document.createElement('i'); grip.className = 'grip'; b.appendChild(grip);
      b.onpointerdown = e => {
        e.stopPropagation();
        const resize = e.target === grip, x0 = e.clientX, s0 = L.start, e0 = L.end, len = e0 - s0;
        let moved = false;
        b.setPointerCapture(e.pointerId);
        b.onpointermove = ev => {
          const dt = (ev.clientX - x0) / pps;
          if (!moved && Math.abs(ev.clientX - x0) < 4) return;
          moved = true;
          if (resize) api.timeText(L.id, s0, Math.min(dur || Infinity, Math.max(s0 + 0.2, e0 + dt)), false);
          else { const s = Math.max(0, Math.min((dur || Infinity) - len, s0 + dt)); api.timeText(L.id, s, s + len, false); }
          const now = api.texts().find(x => x.id === L.id);
          if (now) { b.style.left = `${now.start * pps}px`; b.style.width = `${Math.max(14, (now.end - now.start) * pps - 2)}px`; }
        };
        b.onpointerup = () => {
          b.onpointermove = b.onpointerup = null;
          if (moved) { const now = api.texts().find(x => x.id === L.id); api.timeText(L.id, now.start, now.end, true); }
          else { api.selectText(L.id); api.seek(L.start); }
        };
      };
      txtRow.appendChild(b);
    });
  }

  function drawWave(W) {
    const peaks = api.wave(), dur = api.duration() || 0;
    const w = Math.min(W, 16000); // canvas size limit; stretched by CSS if wider
    wave.width = w; wave.style.width = `${W}px`;
    const ctx = wave.getContext('2d');
    ctx.clearRect(0, 0, w, wave.height);
    if (!peaks || !dur) return;
    ctx.fillStyle = 'rgba(109,40,217,.35)';
    const mid = wave.height / 2, perPx = peaks.length / (dur * pps) * (W / w);
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let i = Math.floor(x * perPx), e = Math.floor((x + 1) * perPx); i <= e && i < peaks.length; i++) m = Math.max(m, peaks[i]);
      const h = Math.max(1, m * mid * 0.95);
      ctx.fillRect(x, mid - h, 1, h * 2);
    }
  }

  function tick(t) {
    const x = t * pps;
    head.style.transform = `translateX(${x}px)`;
    // Keep the playhead in view while playing.
    if (api.playing() && (x < scroll.scrollLeft || x > scroll.scrollLeft + scroll.clientWidth - 40)) scroll.scrollLeft = Math.max(0, x - 40);
  }

  return { render, renderNow, tick, menu, reset() { fitted = false; sel = null; scroll.scrollLeft = 0; } };
}

/** Loudness peaks (0..1) every `step` seconds, for drawing the waveform. */
export function wavePeaks(audio, sr = 16000, step = 0.02) {
  const n = Math.max(1, Math.floor(sr * step)), out = new Float32Array(Math.ceil(audio.length / n));
  let max = 1e-6;
  for (let i = 0; i < out.length; i++) {
    let m = 0;
    for (let j = i * n, e = Math.min(audio.length, j + n); j < e; j++) { const v = audio[j] < 0 ? -audio[j] : audio[j]; if (v > m) m = v; }
    out[i] = m; if (m > max) max = m;
  }
  for (let i = 0; i < out.length; i++) out[i] /= max;
  return out;
}
