// YouTube growth planner: niche → content pillars, video ideas with packaging (title + thumbnail
// text), a script outline built for retention, a Shorts plan per long video, a 30-day calendar and the
// YouTube Partner Program milestones. Pure functions, on-device; nothing here predicts views or money.

export const NICHES = {
  finance: { name: 'Finance & money', layout: 'money', pillars: ['Money mistakes', 'Saving & investing basics', 'Side income'],
    topics: ['SIP vs FD', 'credit card traps', 'first salary plan', 'emergency fund', 'term insurance', 'mutual fund mistakes', 'gold vs stocks', 'tax saving', 'UPI scams', 'budget for students'] },
  tech: { name: 'Tech & gadgets', layout: 'big-bold', pillars: ['Honest reviews', 'Tips & hidden features', 'Buying guides'],
    topics: ['phone under 20k', 'hidden Android settings', 'laptop for students', 'AI tools for work', 'battery myths', 'earbuds under 2000', 'smartwatch worth it', 'WiFi speed fix', 'phone camera tricks', 'free apps you need'] },
  study: { name: 'Study & careers', layout: 'side-story', pillars: ['Study methods', 'Exam strategy', 'Career guidance'],
    topics: ['study 10 hours', 'topper timetable', 'board exam last month', 'JEE mistakes', 'remember what you read', 'phone addiction while studying', 'English speaking', 'first job interview', 'resume mistakes', 'skills that pay'] },
  motivation: { name: 'Self-improvement', layout: 'desi-bold', pillars: ['Discipline', 'Mindset stories', 'Habits'],
    topics: ['5 AM routine', 'stop overthinking', 'dopamine detox', 'confidence', 'no excuses', 'lessons from failure', 'focus', 'consistency', 'morning habits', 'quit wasting time'] },
  vlog: { name: 'Vlogs & travel', layout: 'vlog', pillars: ['Day in my life', 'Travel on a budget', 'Challenges'],
    topics: ['Goa in 5000', 'one day in Jaipur', 'train journey', 'hostel life', 'street food tour', 'Manali budget trip', 'living alone', 'first salary day', '24 hour challenge', 'village life'] },
  food: { name: 'Cooking & food', layout: 'big-bold', pillars: ['Quick recipes', 'Street food at home', 'Food reviews'],
    topics: ['10 minute dinner', 'hostel recipes', 'restaurant paneer at home', 'healthy breakfast', 'street momos', 'one pot meals', 'cheap vs expensive', 'tiffin ideas', 'dhaba dal', 'no oven cake'] },
  fitness: { name: 'Fitness & health', layout: 'side-story', pillars: ['Home workouts', 'Diet basics', 'Transformations'],
    topics: ['lose belly fat', 'home workout no equipment', 'protein on a budget', 'gym mistakes', 'walking 10000 steps', 'veg diet plan', 'skinny to fit', 'posture fix', 'sleep better', 'myths about weight loss'] },
  gaming: { name: 'Gaming', layout: 'gaming', pillars: ['Tips & tricks', 'Challenges', 'Reactions'],
    topics: ['BGMI settings', 'rank push tips', 'budget gaming phone', 'noob vs pro', 'hidden map spots', 'sensitivity guide', 'clutch moments', 'free fire tricks', 'best PC under 50k', 'game reviews'] },
  beauty: { name: 'Beauty & fashion', layout: 'pin-minimal', pillars: ['Styling', 'Skincare', 'Budget hauls'],
    topics: ['outfits under 999', 'skincare for oily skin', 'college outfits', 'wedding looks', 'Meesho haul', 'hair care', 'makeup mistakes', 'ethnic styling', 'capsule wardrobe', 'men grooming'] },
  podcast: { name: 'Podcast & interviews', layout: 'podcast', pillars: ['Guest stories', 'Hot takes', 'Expert advice'],
    topics: ['founder story', 'doctor answers myths', 'CA explains taxes', 'struggle to success', 'relationship advice', 'startup failures', 'career switch', 'mental health', 'money mindset', 'small town to big city'] },
};

const FORMULAS = [
  t => `I tried ${t} for 30 days — honest result`,
  t => `${cap(t)}: 5 mistakes everyone makes`,
  t => `Why most people get ${t} wrong`,
  t => `${cap(t)} — the complete beginner guide`,
  t => `${cap(t)} explained in 10 minutes`,
  t => `Stop doing this if you care about ${t}`,
  t => `${cap(t)}: what nobody tells you`,
  t => `I asked experts about ${t}. Here's the truth`,
];
const THUMB_TEXT = ['30 DAYS LATER', '5 MISTAKES', "DON'T DO THIS", 'BEGINNER GUIDE', '10 MIN', 'STOP!', 'NOBODY TELLS YOU', 'THE TRUTH'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/** The YouTube video id in a watch, youtu.be, shorts, live or embed link (or null). */
export function youtubeId(url) {
  const m = String(url).trim().match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

/** Packaging check for a long-form title: things that usually hurt the click, with fixes. */
export function titleCheck(title) {
  const t = String(title).trim(), tips = [];
  const len = [...t].length;
  if (len > 70) tips.push(`Long (${len} characters): the end gets cut off on phones. Aim for 40–70 and put the key words first.`);
  if (len < 25) tips.push('Very short: add what the viewer gets (a number, a result or a question).');
  if (!/\d/.test(t)) tips.push('No number: specific numbers ("5 mistakes", "30 days", "₹10,000") make a promise concrete.');
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (letters.length > 10 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.6) tips.push('Mostly CAPITALS: reads like shouting. Capitalise one or two words at most.');
  if (/#\w+/.test(t)) tips.push('Hashtags in the title waste space; put them in the description.');
  if (/\b(shocking|gone wrong|you won'?t believe|must watch)\b/i.test(t)) tips.push('Clickbait words: if the video doesn’t deliver it, viewers leave early and YouTube shows it to fewer people.');
  if (!/[?:—-]|\b(how|why|what|kaise|kyun|kya)\b/i.test(t)) tips.push('No curiosity hook: a question or a "how/why" makes people want the answer.');
  return { ok: tips.length === 0, length: len, tips };
}

/** A retention-first outline: cold open that pays off the title, a re-hook every ~90 s, a clear next video. */
export function scriptOutline(title, minutes = 10, next = 'your next video') {
  const n = Math.max(3, Math.min(8, Math.round(minutes / 1.5)));
  const parts = [
    { at: '0:00', what: 'Cold open (no intro, no "hey guys")', say: `Show the result or the problem from “${title}” in the first sentence. Promise exactly what the title promised.` },
    { at: '0:20', what: 'Why it matters', say: 'One line on the stakes for the viewer: what they lose or gain. Then "let’s start".' },
  ];
  for (let i = 1; i <= n; i++) {
    const s = Math.round(30 + (i - 1) * (minutes * 60 - 90) / n);
    parts.push({ at: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, what: `Point ${i}`, say: i === n ? 'Save the strongest point for last and say it’s coming early on.' : 'One idea, one example, then a re-hook: "but the next one surprised me".' });
  }
  const end = minutes * 60 - 30;
  parts.push({ at: `${Math.floor(end / 60)}:${String(end % 60).padStart(2, '0')}`, what: 'Payoff + next video', say: `Close the promise in one line, then point to ${next} with a reason to watch it now (end screen).` });
  const chapters = parts.map(p => `${p.at} ${p.what.replace(/ \(.+\)$/, '')}`).join('\n');
  return { parts, description: `${title}\n\nIn this video: …\n\nChapters\n${chapters}\n\n#shorts version: link in comments`, chapters };
}

/** Ideas for a niche (and an optional topic of the user's own), with packaging and 3 Shorts each. */
export function ideas(nicheId, topic, count = 30) {
  const n = NICHES[nicheId] || NICHES.tech;
  const topics = topic && topic.trim() ? [topic.trim().toLowerCase(), ...n.topics] : n.topics;
  const out = [];
  // Round r gives every topic a different formula, so no title repeats until all pairs are used.
  for (let i = 0; out.length < count && i < topics.length * FORMULAS.length; i++) {
    const ti = i % topics.length, t = topics[ti], f = (Math.floor(i / topics.length) + ti) % FORMULAS.length;
    out.push({
      title: FORMULAS[f](t),
      pillar: n.pillars[i % n.pillars.length], thumbText: THUMB_TEXT[f], layout: n.layout,
      shorts: [`The #1 mistake in ${t} (from the video)`, `${cap(t)} in 30 seconds`, `My honest result: ${t}`],
    });
  }
  return out;
}

/** A 30-day calendar: long videos on fixed days, Shorts cut from them on the others. */
export function calendar(list, longPerWeek = 2, shortsPerWeek = 5) {
  const longDays = longPerWeek >= 3 ? [0, 2, 4] : longPerWeek === 2 ? [1, 4] : [3];
  const days = [];
  let li = 0, si = 0;
  for (let d = 0; d < 30; d++) {
    const dow = d % 7, item = { day: d + 1, tasks: [] };
    if (longDays.includes(dow) && li < list.length) item.tasks.push({ type: 'long', text: list[li++].title });
    const shortsToday = Math.ceil(shortsPerWeek / 7 * (dow + 1)) - Math.ceil(shortsPerWeek / 7 * dow);
    for (let k = 0; k < shortsToday; k++) {
      const src = list[Math.max(0, li - 1)];
      if (src) item.tasks.push({ type: 'short', text: src.shorts[si++ % 3] });
    }
    days.push(item);
  }
  return days;
}

/** Partner Program steps (check YouTube's own page for your country; thresholds change). */
export function milestones(subs = 0) {
  return [
    { goal: 'Channel basics', detail: 'Channel name, logo, banner, about text with your niche, and 3 pillar playlists.', done: false },
    { goal: '100 subscribers', detail: 'Usually comes from a few videos that answer a searched question. Reply to every comment.', done: subs >= 100 },
    { goal: '500 subscribers + 3 uploads in 90 days + 3,000 watch hours (12 months) or 3M Shorts views (90 days)', detail: 'Early Partner Program tier in many countries: memberships, Supers, Shopping (no ad revenue yet).', done: false },
    { goal: '1,000 subscribers + 4,000 watch hours (12 months) or 10M Shorts views (90 days)', detail: 'Full Partner Program: ad revenue. Then YouTube reviews the channel (originality matters).', done: false },
  ];
}
