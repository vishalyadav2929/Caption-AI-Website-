// Public details of a YouTube video (title, channel, thumbnail) from YouTube's own oEmbed endpoint,
// so the growth planner can check the packaging of a pasted link. No video or audio is downloaded.
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' } });

export function videoId(url) {
  const m = String(url || '').trim().match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export default async function handler(req) {
  const id = videoId(new URL(req.url).searchParams.get('url'));
  if (!id) return json({ error: 'Paste a YouTube video link.' }, 400);
  let res;
  try { res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`); } catch { return json({ error: 'YouTube unreachable' }, 502); }
  if (!res.ok) return json({ error: res.status === 404 || res.status === 401 ? 'Video not found, private or not embeddable.' : `YouTube error ${res.status}` }, res.status === 404 ? 404 : 502);
  const o = await res.json();
  return json({ id, title: String(o.title || ''), channel: String(o.author_name || ''), thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` });
}

export const config = { path: '/api/yt' };
