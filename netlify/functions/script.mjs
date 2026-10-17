// AI script writer for the YouTube growth planner: a full, retention-first script for one video idea,
// in the creator's language. Uses the same GROQ_API_KEY as Fast mode (off until the site owner adds it).
const GROQ = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const key = () => (globalThis.Netlify && Netlify.env.get('GROQ_API_KEY')) || process.env.GROQ_API_KEY || '';
const LANGS = { hinglish: 'Hinglish (Hindi in Roman script, mixed with English)', hindi: 'Hindi in Devanagari', english: 'simple Indian English' };

export function buildPrompt({ title, niche, minutes, lang }) {
  return [
    { role: 'system', content: `You write YouTube long-form scripts for Indian creators. Retention first: the first 20 seconds pay off the title's promise (no "hey guys", no channel intro), a re-hook every 60-90 seconds, one topic, no padding, a strong last point, and an ending that sends viewers to the next video. Never invent statistics, studies or quotes: write [check: ...] where a fact needs a source. No clickbait the video can't deliver. Write in ${LANGS[lang] || LANGS.hinglish}.` },
    { role: 'user', content: `Write a ${minutes}-minute script for the ${niche} video titled "${title}". Format: timestamped sections (0:00 …) with the exact lines to say and [B-roll: …] notes. Then 3 alternative titles, thumbnail text (max 4 words) and 3 Shorts to cut from it.` },
  ];
}

export default async function handler(req) {
  if (req.method === 'GET') return json({ enabled: !!key() });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!key()) return json({ error: 'AI scripts are not set up on this site.' }, 404);
  const origin = req.headers.get('origin');
  if (!origin || new URL(origin).host !== new URL(req.url).host) return json({ error: 'forbidden' }, 403);
  let b;
  try { b = await req.json(); } catch { return json({ error: 'bad request' }, 400); }
  const p = { title: String(b.title || '').slice(0, 160), niche: String(b.niche || '').slice(0, 60), minutes: Math.max(3, Math.min(20, +b.minutes || 10)), lang: String(b.lang || 'hinglish') };
  if (!p.title) return json({ error: 'no title' }, 400);
  let res;
  try {
    res = await fetch(GROQ, { method: 'POST', headers: { authorization: `Bearer ${key()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: buildPrompt(p), temperature: 0.6, max_tokens: 2500 }) });
  } catch { return json({ error: 'AI server unreachable' }, 502); }
  if (!res.ok) return json({ error: res.status === 429 ? 'busy' : `AI server error ${res.status}` }, res.status === 429 ? 429 : 502);
  const out = await res.json();
  return json({ script: String((out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content) || '').slice(0, 20000) });
}

export const config = { path: '/api/script' };
