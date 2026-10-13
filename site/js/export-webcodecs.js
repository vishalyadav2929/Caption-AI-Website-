// High-quality export with WebCodecs (Safari 16.4+, Chrome, Edge).
// The captioned frames are encoded with the browser's H.264 encoder at a bitrate at or above the
// source's, and the original AAC audio is copied into the MP4 unchanged (no re-encoding at all).
// MediaRecorder (the fallback) gives the browser no such control and often softens the picture.
import { Muxer, ArrayBufferTarget } from './vendor/mp4-muxer.js';
import { readAacTrack } from './mp4audio.js';

// H.264 High → Main → Baseline, at a level that allows 4K; then (tests only) VP9.
const H264 = ['avc1.640033', 'avc1.64002a', 'avc1.4d0033', 'avc1.4d002a', 'avc1.42003e', 'avc1.42002a'];

export function canUseWebCodecs() {
  return typeof VideoEncoder === 'function' && typeof VideoFrame === 'function';
}

async function pickVideoConfig(width, height, bitrate, framerate) {
  const list = [...H264, ...(self.__vczExportCodecs || [])];
  for (const codec of list) {
    const config = { codec, width, height, bitrate, framerate, latencyMode: 'quality', bitrateMode: 'variable' };
    if (codec.startsWith('avc1')) config.avc = { format: 'avc' };
    try {
      const r = await VideoEncoder.isConfigSupported(config);
      if (r.supported) return r.config;
    } catch { /* try the next one */ }
  }
  return null;
}

/** Audio for the MP4: the source's own AAC frames if it has them, otherwise re-encoded from PCM. */
async function prepareAudio(file, decodePcm, mustEncode) {
  if (!mustEncode) try {
    const t = readAacTrack(await file.arrayBuffer());
    if (t.frames.length) return { kind: 'copy', ...t };
  } catch { /* not an MP4/MOV with AAC */ }
  if (typeof AudioEncoder !== 'function') return null;
  for (const codec of ['mp4a.40.2', 'opus']) {
    const pcm = await decodePcm(); // AudioBuffer at its native rate, or null
    if (!pcm) return { kind: 'none' };
    const config = { codec, sampleRate: pcm.sampleRate, numberOfChannels: Math.min(2, pcm.numberOfChannels), bitrate: 192000 };
    try { if ((await AudioEncoder.isConfigSupported(config)).supported) return { kind: 'encode', codec, config, pcm }; } catch { /* next */ }
  }
  return null;
}

/**
 * @param {object} o
 *   video        the playing <video> element (decoding, HDR→SDR and rotation are left to the browser)
 *   file         the original File
 *   canvas       the export canvas (size = output size)
 *   paint(t)     draws the frame at video time t, captions included, onto `canvas`
 *   dur          duration in seconds
 *   srcBps       source bitrate estimate (bits/s)
 *   job          { cancelled }
 *   onProgress(p, t)
 *   decodePcm()  → Promise<AudioBuffer|null>, used only when the file has no AAC track
 * @returns {Promise<Blob|null>} null when this browser can't do it (caller falls back to MediaRecorder)
 */
export async function exportWebCodecs({ video, file, canvas, paint, dur, srcBps, job, onProgress, decodePcm, mixAudio = false }) {
  if (!canUseWebCodecs()) return null;
  const { width, height } = canvas;
  const fps = 30;
  // At least the source's bitrate (H.264 needs ~1.5× what an iPhone's HEVC needs), never starved.
  const bitrate = Math.round(Math.min(80e6, Math.max(srcBps * 1.5, width * height * fps * 0.15, 4e6)));
  const vconf = await pickVideoConfig(width, height, bitrate, fps);
  if (!vconf) return null;
  const audio = await prepareAudio(file, decodePcm, mixAudio);
  if (!audio) return null;

  const vcodec = vconf.codec.startsWith('avc1') ? 'avc' : vconf.codec.startsWith('vp09') ? 'vp9' : 'av1';
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: vcodec, width, height },
    ...(audio.kind === 'copy' ? { audio: { codec: 'aac', sampleRate: audio.sampleRate, numberOfChannels: audio.channels } }
      : audio.kind === 'encode' ? { audio: { codec: audio.codec === 'opus' ? 'opus' : 'aac', sampleRate: audio.config.sampleRate, numberOfChannels: audio.config.numberOfChannels } } : {}),
    fastStart: false,
    firstTimestampBehavior: 'offset',
  });

  let failure = null;
  const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { failure = e; } });
  venc.configure(vconf);

  // Audio first: it doesn't depend on playback.
  if (audio.kind === 'copy') {
    const step = 1024 / audio.sampleRate * 1e6;
    const meta = { decoderConfig: { codec: `mp4a.40.${audio.objectType}`, sampleRate: audio.sampleRate, numberOfChannels: audio.channels, description: audio.asc } };
    audio.frames.forEach((f, i) => {
      if (i * step > dur * 1e6 + step) return;
      muxer.addAudioChunkRaw(f, 'key', Math.round(i * step), Math.round(step), i === 0 ? meta : undefined);
    });
  } else if (audio.kind === 'encode') {
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: e => { failure = e; } });
    aenc.configure(audio.config);
    const { pcm } = audio, ch = audio.config.numberOfChannels, sr = pcm.sampleRate, block = 4096;
    for (let o = 0; o < pcm.length; o += block) {
      const n = Math.min(block, pcm.length - o), data = new Float32Array(n * ch);
      for (let c = 0; c < ch; c++) data.set(pcm.getChannelData(Math.min(c, pcm.numberOfChannels - 1)).subarray(o, o + n), c * n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round(o / sr * 1e6), data });
      aenc.encode(ad); ad.close();
    }
    await aenc.flush();
    aenc.close();
  }

  // Video: play once and encode every decoded frame, stamped with its own media time.
  video.pause();
  video.currentTime = 0;
  await new Promise(r => { video.onseeked = () => { video.onseeked = null; r(); }; });
  const muted = video.muted;
  video.muted = true; // the sound is already in the file
  let last = -1, lastKey = -Infinity, frames = 0;
  const encodeAt = t => {
    const ts = Math.round(t * 1e6);
    if (ts <= last) return;
    last = ts;
    paint(t);
    const frame = new VideoFrame(canvas, { timestamp: ts, duration: Math.round(1e6 / fps) });
    const key = t - lastKey >= 2;
    if (key) lastKey = t;
    venc.encode(frame, { keyFrame: key });
    frame.close();
    frames++;
  };
  await new Promise((resolve, reject) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    job.finish = finish;
    video.onended = finish;
    // The sound is copied separately, so playback speed doesn't matter: if frames are being missed
    // (slow device), slow the video down until every frame gets through.
    let rate = 1, lastPresented = null;
    const onFrame = async (_, meta) => {
      if (done) return;
      if (job.cancelled || failure) return finish();
      if (lastPresented != null && meta.presentedFrames - lastPresented > 1 && rate > 0.25) {
        rate = Math.max(0.25, rate * 0.7);
        video.playbackRate = rate;
      }
      lastPresented = meta.presentedFrames;
      encodeAt(meta.mediaTime ?? video.currentTime);
      onProgress && onProgress(Math.min(1, video.currentTime / dur), video.currentTime);
      // Don't let the encoder fall behind (slow phones): pause playback until it catches up.
      if (venc.encodeQueueSize > 6) {
        video.pause();
        while (venc.encodeQueueSize > 2 && !job.cancelled) await new Promise(r => setTimeout(r, 15));
        if (!done) video.play().catch(reject);
      }
      if (!done) video.requestVideoFrameCallback(onFrame);
    };
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(onFrame);
    else {
      const timer = setInterval(() => { if (done) return clearInterval(timer); encodeAt(video.currentTime); onProgress && onProgress(video.currentTime / dur, video.currentTime); }, 1000 / fps);
    }
    encodeAt(0);
    video.play().catch(reject);
  }).finally(() => { video.onended = null; video.pause(); video.muted = muted; video.playbackRate = 1; });

  if (job.cancelled) { venc.close(); return 'cancelled'; }
  await venc.flush();
  venc.close();
  if (failure) throw failure;
  if (!frames) throw new Error('No video frames were captured.');
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}
