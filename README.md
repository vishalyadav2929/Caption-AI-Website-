# ViralCaptionZone

A free, browser-based caption editor for Reels, Shorts and Pins. Upload a video, generate captions from its audio, fix the text and timing, pick one of 85 animated caption styles, and download the video with the captions burned in.

There's no account, payment or server. Everything runs in the visitor's browser.

## What works

| Step | How |
|---|---|
| Upload | Drag-and-drop or click. Shows a preview with name, resolution, duration and size. Rejects non-media files and files over 2 GB with a message. Unplayable formats (e.g. HEVC `.mov` in Chrome) get a conversion hint. |
| Speech to text | OpenAI **Whisper** running **on the device** through **transformers.js** (WebGPU, falling back to WebAssembly). Supports Hindi, English and ~30 more languages, auto-detect, Hinglish (Roman Hindi) output, and translation to English. Long audio is cut at pauses into ≤29 s parts, which gives real progress, a working **Cancel**, and skips silent parts. |
| Timing | Uses Whisper's word-level timestamps. If a model build only gives sentence timing, captions are marked **est.** in the editor and word highlights are spread across each sentence. |
| Caption editing | Edit text, set start/end times, split at the cursor, merge, add, delete, jump to a caption, **undo/redo** (Ctrl+Z / Ctrl+Shift+Z). SRT/VTT import and SRT export. |
| Templates | 85 styles: 58 matching the reference set (Classic, Crazy, Discipline, Red Wipe … Estate 4), 26 more, and High Contrast. Selecting one updates the live video preview. Previews work in English and 10 Indian scripts. |
| Style | Size, weight, case, text colour, spoken-word colour, outline colour and thickness, shadow, background colour and opacity, alignment, vertical position, max line width, line spacing. **Reset to template** is included. |
| Preview | Canvas preview with play/pause, seek, time, full screen, portrait and landscape. Preview and export use the same renderer, and captions are kept inside the frame. |
| Export | Captions are drawn into the video pixels, original audio is kept, there's a progress bar and Cancel, and the file is downloaded directly. **MP4 (H.264)** when the browser can record it, otherwise **WebM** (VP9/Opus) with a corrected duration header. |
| Translation | Hindi ↔ Hinglish on the device. Other languages (Hindi → Bangla, English → Hindi, …) use Chrome's on-device translator when present, otherwise the free MyMemory service (caption text only, no key, about 5,000 characters per day per visitor). The caption language is detected from the text's script. |
| Live mode | Camera + browser speech recognition, with captions drawn live and recordable. |

## Technology choices

- **Static HTML/CSS/vanilla JS, no build step.** It loads quickly and needs nothing on Netlify.
- **Speech:** `@huggingface/transformers@3.8.1` (Apache-2.0) loaded from jsDelivr **only when captions are generated**, plus Whisper ONNX models (MIT) from the Hugging Face hub, cached by the browser after the first download. Model choice by quality:
  - Fast: `whisper-tiny`, ~40 MB
  - Balanced: `whisper-base`, ~80 MB (default)
  - Best for Hindi: `whisper-small`, ~250 MB

  Each tries the `onnx-community/*_timestamped` build (exported for word timestamps) first, then `Xenova/*`. The browser's Web Speech API is used only for Live mode, never for uploaded videos.
- **Export:** Canvas + `MediaRecorder` + Web Audio. It works in Chrome, Edge, Firefox and Safari without a 30 MB FFmpeg.wasm download. The trade-off is that export runs in real time, so a 1-minute video takes about 1 minute. WebM duration is patched with [fix-webm-duration](https://github.com/yusitnikov/fix-webm-duration) (MIT, vendored in `site/js/vendor/`).
- **Fonts:** Google Fonts (open licences), with Noto fallbacks for Devanagari, Bengali, Gujarati, Gurmukhi, Tamil, Telugu, Kannada, Malayalam, Odia and Arabic.

## Formats

- **Input:** anything the browser can play, typically MP4 (H.264/AAC), WebM, MOV (H.264), MKV, plus audio-only M4A/MP3/WAV/OGG (which produces a captioned video on a plain background). Max 2 GB.
- **Output:** MP4 (H.264) in Chrome 126+, Edge and Safari; WebM in Firefox and in browsers without an H.264 encoder. Captions: SRT.

## Browser support and limits

- Desktop Chrome or Edge is the best experience (WebGPU makes transcription fast). Firefox and Safari work using the slower WebAssembly path.
- Phones work, but `whisper-small` can run out of memory. Use Fast or Balanced there.
- Export is real time and the tab must stay visible. Background tabs are throttled, and the export screen warns if that happened.
- Very long videos (10+ minutes) use a lot of memory, because the whole audio track is decoded at once.
- Live captions need Chrome, Edge or Safari, and their timing is approximate.

## Run locally

```sh
npm start              # serves ./site on http://localhost:8080
npm test               # unit tests (Node 20+)
npm run test:e2e       # browser test: needs Playwright + Chromium and ffmpeg
```

## Deploy to Netlify (free)

1. Push this repo to GitHub.
2. In Netlify: **Add new project → Import an existing project → GitHub** → choose this repository.
3. Netlify reads `netlify.toml`: publish directory **`site`**, no real build. Leave the defaults and click **Deploy**.
4. The site is live at `https://<name>.netlify.app`. Every push to the production branch redeploys.
5. Make it public: **Project configuration → Access & security → Visitor access**. Turn off password or team login if it's on.

**Custom domain (later):** **Domain management → Add a domain**, enter it, then either point your registrar's nameservers to Netlify DNS or add the CNAME/A records Netlify shows. HTTPS is issued automatically.

No environment variables or API keys are needed.

## Project layout

```
site/            ← what Netlify publishes
  index.html     landing page
  templates.html all templates, live previews, 11 preview languages
  app.html       editor (upload → languages → generate → edit → export)
  privacy.html   every outside request the site makes
  css/styles.css
  js/app.js            editor
  js/captions.js       caption data model (split/merge/retime/SRT), pure + tested
  js/asr-core.js       long-audio planning for Whisper, pure + tested
  js/whisper-worker.js on-device speech recognition (Web Worker)
  js/renderer.js       canvas caption renderer (preview and export)
  js/templates.js      caption styles
  js/gallery.js        template previews
  js/languages.js      languages + Hindi → Hinglish
  js/translate.js      caption language detection + online translation fallback
tests/unit       node --test
tests/e2e        Playwright end-to-end test incl. export verified with ffprobe
tests/fixtures   small test videos
```
