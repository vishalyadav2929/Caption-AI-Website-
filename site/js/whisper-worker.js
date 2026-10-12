// In-browser speech-to-text with OpenAI Whisper (MIT) via transformers.js (Apache-2.0).
// Nothing is uploaded: the model is downloaded once from the Hugging Face hub, cached by the
// browser, and run on this device (WebGPU when available, otherwise WebAssembly).
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
import { transcribeLong } from './asr-core.js';

env.allowLocalModels = false;
env.useBrowserCache = true;

// For each quality level: a build exported for word-level timestamps first, then the standard build.
const MODELS = {
  fast: ['onnx-community/whisper-tiny_timestamped', 'Xenova/whisper-tiny'],
  balanced: ['onnx-community/whisper-base_timestamped', 'Xenova/whisper-base'],
  best: ['onnx-community/whisper-small_timestamped', 'Xenova/whisper-small'],
};

let asr = null, loadedKey = null, loadedDevice = null, wordLevelBroken = false, forceCpu = false;
const post = msg => self.postMessage(msg);

async function load(quality) {
  if (asr && loadedKey === quality && !(forceCpu && loadedDevice === 'webgpu')) return asr;
  const files = {};
  const progress_callback = p => {
    if (p.status === 'progress' && p.total) {
      files[p.file] = [p.loaded, p.total];
      const v = Object.values(files);
      const loaded = v.reduce((a, [l]) => a + l, 0), total = v.reduce((a, [, t]) => a + t, 0);
      post({ type: 'download', loaded, total });
    }
  };
  // Phones: compressed 8-bit model on the CPU (≈ a quarter of the download, much less memory).
  // Computers with WebGPU: full-precision encoder + 4-bit decoder (smaller than full fp32), then fp32.
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
  const plans = [];
  if (!forceCpu && !mobile && 'gpu' in navigator) {
    plans.push({ device: 'webgpu', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' } });
    plans.push({ device: 'webgpu', dtype: 'fp32' });
  }
  plans.push({ device: 'wasm', dtype: 'q8' });
  let lastErr;
  for (const name of MODELS[quality] || MODELS.balanced) {
    for (const plan of plans) {
      try {
        post({ type: 'status', text: `Loading speech model (${plan.device === 'webgpu' ? 'GPU' : 'CPU'})…` });
        asr = await pipeline('automatic-speech-recognition', name, { ...plan, progress_callback });
        const device = plan.device;
        loadedKey = quality; loadedDevice = device; wordLevelBroken = false;
        post({ type: 'model', name, device });
        return asr;
      } catch (err) { lastErr = err; }
    }
  }
  throw lastErr || new Error('Could not load a speech model.');
}

async function transcribe({ audio, quality, language, task }) {
  {
    const run = await load(quality);
    const base = { task: task || 'transcribe' };
    if (language) base.language = language;
    const runWindow = async sub => {
      if (!wordLevelBroken) {
        try {
          const out = await run(sub, { ...base, return_timestamps: 'word' });
          return { chunks: out.chunks, level: 'word' };
        } catch {
          // This model build can't give word times; use sentence times from here on.
          wordLevelBroken = true;
        }
      }
      const out = await run(sub, { ...base, return_timestamps: true });
      return { chunks: out.chunks, level: 'segment' };
    };
    post({ type: 'status', text: 'Listening to your video…' });
    const res = await transcribeLong(runWindow, audio, {
      onProgress: (done, total) => post({ type: 'transcribe', done, total }),
    });
    post({ type: 'done', ...res });
  }
}

self.onmessage = async ({ data }) => {
  if (data.type !== 'transcribe') return;
  try {
    await transcribe(data);
  } catch (err) {
    // A GPU can load the model but still fail mid-run (out of memory, driver issues). Retry once on the CPU.
    if (loadedDevice === 'webgpu' && !forceCpu) {
      forceCpu = true;
      post({ type: 'status', text: 'GPU failed, retrying on CPU (slower)…' });
      try { await transcribe(data); return; } catch (e2) { err = e2; }
    }
    post({ type: 'error', text: String((err && err.message) || err) });
  }
};
