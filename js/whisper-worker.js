// Runs Whisper speech-to-text fully inside the browser, so transcription costs nothing to host.
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';

let asr = null, loadedModel = null;

async function getPipeline(model) {
  if (asr && loadedModel === model) return asr;
  const opts = {
    dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
    progress_callback: p => {
      if (p.status === 'progress') self.postMessage({ type: 'progress', file: p.file, progress: p.progress });
    },
  };
  // Try the word-timestamp build first, then the plain model; GPU first, then CPU.
  const names = [...new Set([model, model.replace('_timestamped', '')])];
  let lastErr;
  for (const name of names) {
    for (const device of ('gpu' in navigator ? ['webgpu', 'wasm'] : ['wasm'])) {
      try {
        const dev = device === 'wasm' ? { device, dtype: 'q8' } : { device };
        asr = await pipeline('automatic-speech-recognition', name, { ...opts, ...dev });
        loadedModel = model;
        return asr;
      } catch (err) { lastErr = err; }
    }
  }
  throw lastErr;
}

self.onmessage = async ({ data }) => {
  const { audio, model, language, task } = data;
  try {
    self.postMessage({ type: 'status', text: 'Loading speech model (first time only)…' });
    const run = await getPipeline(model);
    self.postMessage({ type: 'status', text: 'Listening to your video…' });
    const base = { chunk_length_s: 30, stride_length_s: 5, task: task || 'transcribe' };
    if (language) base.language = language;
    let out, level = 'word';
    try {
      out = await run(audio, { ...base, return_timestamps: 'word' });
    } catch {
      level = 'segment';
      out = await run(audio, { ...base, return_timestamps: true });
    }
    self.postMessage({ type: 'done', level, chunks: out.chunks || [], text: out.text, duration: audio.length / 16000 });
  } catch (err) {
    self.postMessage({ type: 'error', text: String(err && err.message || err) });
  }
};
