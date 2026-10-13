// Fast mode: speech-to-text on Groq's servers (Whisper large-v3), for instant and more accurate captions.
// Off until the site owner adds GROQ_API_KEY in Netlify → Project configuration → Environment variables.
// The key stays on the server; browsers only send short audio clips (≤ 30 s, 16 kHz WAV), never video.
const GROQ = 'https://api.groq.com/openai/v1/audio';
const MAX_BYTES = 4.5 * 1024 * 1024;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const key = () => (globalThis.Netlify && Netlify.env.get('GROQ_API_KEY')) || process.env.GROQ_API_KEY || '';

export default async function handler(req) {
  if (req.method === 'GET') return json({ enabled: !!key() });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!key()) return json({ error: 'Fast mode is not set up on this site.' }, 404);

  // Only this site's own pages may use it (stops other sites spending the free quota).
  const origin = req.headers.get('origin');
  if (!origin || new URL(origin).host !== new URL(req.url).host) return json({ error: 'forbidden' }, 403);

  const audio = await req.arrayBuffer();
  if (!audio.byteLength || audio.byteLength > MAX_BYTES) return json({ error: 'audio clip too large' }, 413);

  const q = new URL(req.url).searchParams;
  const translate = q.get('task') === 'translate';
  const lang = (q.get('lang') || '').toLowerCase();
  const form = new FormData();
  form.append('file', new Blob([audio], { type: 'audio/wav' }), 'clip.wav');
  // turbo is faster but can't translate; large-v3 does both.
  form.append('model', translate ? 'whisper-large-v3' : 'whisper-large-v3-turbo');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('timestamp_granularities[]', 'segment');
  form.append('temperature', '0');
  if (!translate && /^[a-z]{2,3}$/.test(lang)) form.append('language', lang);

  let res;
  try {
    res = await fetch(`${GROQ}/${translate ? 'translations' : 'transcriptions'}`, { method: 'POST', headers: { authorization: `Bearer ${key()}` }, body: form });
  } catch {
    return json({ error: 'speech server unreachable' }, 502);
  }
  if (!res.ok) {
    // 429 = free quota used up for now; the browser then falls back to on-device captions.
    return json({ error: res.status === 429 ? 'busy' : `speech server error ${res.status}` }, res.status === 429 ? 429 : 502);
  }
  const out = await res.json();
  let words = (out.words || []).map(w => ({ text: String(w.word || '').trim(), start: +w.start, end: +w.end })).filter(w => w.text);
  let level = 'word';
  if (!words.length && out.segments) {
    // Translations come back with sentence timing only.
    level = 'segment';
    words = out.segments.map(s => ({ text: String(s.text || '').trim(), start: +s.start, end: +s.end, segment: true })).filter(w => w.text);
  }
  return json({ level, words, language: out.language || null });
}

export const config = { path: '/api/transcribe' };
