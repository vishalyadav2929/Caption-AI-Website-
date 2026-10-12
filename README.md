# ViralCaptionZone

A free website for adding viral, animated captions to Reels, Shorts and Pins.

- **26 caption templates**: viral pop, word box, karaoke, neon glow, Pinterest serif and script styles, and Devanagari styles for Hindi.
- **Upload & auto-caption**: Whisper speech-to-text runs inside the browser through transformers.js. You pay nothing for servers and videos never leave the user's device.
- **Live captions**: camera + mic, with captions drawn as you speak. Uses the browser's Web Speech API, which works best in Chrome and Edge.
- **Hindi, Hinglish (Roman Hindi), English and 30+ languages.**
- **Export** video with captions burned in (MP4 where the browser supports it, otherwise WebM), plus SRT import and export.

## Run locally

It's a static site with no build step. It needs to be served over HTTP, because module workers don't load from `file://`.

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Deploy by uploading the folder to any static host (GitHub Pages, Netlify, Vercel or Cloudflare Pages).

## Files

- `index.html`: landing page
- `app.html` + `js/app.js`: editor
- `js/templates.js`: caption style presets (add new styles here)
- `js/renderer.js`: canvas caption renderer and animations
- `js/whisper-worker.js`: in-browser speech-to-text
- `js/languages.js`: language list and the Hindi → Hinglish transliterator
