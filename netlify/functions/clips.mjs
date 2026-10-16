// AI hooks for Shorts: re-ranks the clips the browser found and writes a scroll-stopping hook title for
// each, in the language and script of the video. Uses the same GROQ_API_KEY as Fast mode (off until the
// site owner adds it). Only caption text is sent, never audio or video.
const GROQ = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const key = () => (globalThis.Netlify && Netlify.env.get('GROQ_API_KEY')) || process.env.GROQ_API_KEY || '';

export function buildPrompt(clips) {
  const list = clips.map((c, i) => `#${i} (${Math.round(c.end - c.start)}s): ${String(c.text).slice(0, 900)}`).join('\n\n');
  return [
    { role: 'system', content: 'You are a short-form video editor for Indian creators. You judge which moments of a long video will hold viewers on Instagram Reels and YouTube Shorts, and write the on-screen hook text for the first 3 seconds. Hooks are at most 8 words, punchy, curiosity-driven, never clickbait lies, and written in the SAME language and script as the transcript (Hinglish stays in Roman script, Hindi stays in Devanagari). Reply with JSON only.' },
    { role: 'user', content: `Rate each clip 1-100 for viral potential and write its hook.\nReturn {"clips":[{"i":0,"score":87,"hook":"...","why":"one short reason"}]} with one entry per clip.\n\n${list}` },
  ];
}

/** Keep only well-formed entries that point at real clips. */
export function parseReply(text, n) {
  let j;
  try { j = JSON.parse(String(text).replace(/^```(json)?|```$/g, '').trim()); } catch { return []; }
  const out = [];
  for (const c of (j && j.clips) || []) {
    const i = Number(c.i);
    if (!Number.isInteger(i) || i < 0 || i >= n || out.some(o => o.i === i)) continue;
    const hook = String(c.hook || '').replace(/\s+/g, ' ').trim().split(' ').slice(0, 10).join(' ');
    out.push({ i, score: Math.max(1, Math.min(100, Math.round(Number(c.score) || 0))), hook, why: String(c.why || '').slice(0, 140) });
  }
  return out;
}

export default async function handler(req) {
  if (req.method === 'GET') return json({ enabled: !!key() });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!key()) return json({ error: 'AI hooks are not set up on this site.' }, 404);
  const origin = req.headers.get('origin');
  if (!origin || new URL(origin).host !== new URL(req.url).host) return json({ error: 'forbidden' }, 403);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad request' }, 400); }
  const clips = (Array.isArray(body && body.clips) ? body.clips : []).slice(0, 15).map(c => ({ start: +c.start || 0, end: +c.end || 0, text: String(c.text || '') }));
  if (!clips.length) return json({ error: 'no clips' }, 400);
  let res;
  try {
    res = await fetch(GROQ, {
      method: 'POST',
      headers: { authorization: `Bearer ${key()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: buildPrompt(clips), temperature: 0.4, response_format: { type: 'json_object' } }),
    });
  } catch { return json({ error: 'AI server unreachable' }, 502); }
  if (!res.ok) return json({ error: res.status === 429 ? 'busy' : `AI server error ${res.status}` }, res.status === 429 ? 429 : 502);
  const out = await res.json();
  return json({ clips: parseReply(out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content, clips.length) });
}

export const config = { path: '/api/clips' };
