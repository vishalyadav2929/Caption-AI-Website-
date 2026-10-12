// whisper: language name the speech model expects; bcp: code for the browser's live speech recognition.
export const LANGUAGES = [
  { whisper: 'hindi', bcp: 'hi-IN', name: 'Hindi — हिन्दी' },
  { whisper: 'hindi', bcp: 'hi-IN', name: 'Hinglish (Hindi → Roman)', hinglish: true },
  { whisper: 'english', bcp: 'en-IN', name: 'English (India)' },
  { whisper: 'english', bcp: 'en-US', name: 'English (US)' },
  { whisper: 'english', bcp: 'en-GB', name: 'English (UK)' },
  { whisper: 'urdu', bcp: 'ur-PK', name: 'Urdu — اردو' },
  { whisper: 'bengali', bcp: 'bn-IN', name: 'Bengali — বাংলা' },
  { whisper: 'marathi', bcp: 'mr-IN', name: 'Marathi — मराठी' },
  { whisper: 'tamil', bcp: 'ta-IN', name: 'Tamil — தமிழ்' },
  { whisper: 'telugu', bcp: 'te-IN', name: 'Telugu — తెలుగు' },
  { whisper: 'gujarati', bcp: 'gu-IN', name: 'Gujarati — ગુજરાતી' },
  { whisper: 'kannada', bcp: 'kn-IN', name: 'Kannada — ಕನ್ನಡ' },
  { whisper: 'malayalam', bcp: 'ml-IN', name: 'Malayalam — മലയാളം' },
  { whisper: 'punjabi', bcp: 'pa-IN', name: 'Punjabi — ਪੰਜਾਬੀ' },
  { whisper: 'nepali', bcp: 'ne-NP', name: 'Nepali — नेपाली' },
  { whisper: 'spanish', bcp: 'es-ES', name: 'Spanish — Español' },
  { whisper: 'french', bcp: 'fr-FR', name: 'French — Français' },
  { whisper: 'german', bcp: 'de-DE', name: 'German — Deutsch' },
  { whisper: 'portuguese', bcp: 'pt-BR', name: 'Portuguese — Português' },
  { whisper: 'italian', bcp: 'it-IT', name: 'Italian — Italiano' },
  { whisper: 'russian', bcp: 'ru-RU', name: 'Russian — Русский' },
  { whisper: 'arabic', bcp: 'ar-SA', name: 'Arabic — العربية' },
  { whisper: 'turkish', bcp: 'tr-TR', name: 'Turkish — Türkçe' },
  { whisper: 'persian', bcp: 'fa-IR', name: 'Persian — فارسی' },
  { whisper: 'indonesian', bcp: 'id-ID', name: 'Indonesian — Bahasa' },
  { whisper: 'vietnamese', bcp: 'vi-VN', name: 'Vietnamese — Tiếng Việt' },
  { whisper: 'thai', bcp: 'th-TH', name: 'Thai — ไทย' },
  { whisper: 'japanese', bcp: 'ja-JP', name: 'Japanese — 日本語' },
  { whisper: 'korean', bcp: 'ko-KR', name: 'Korean — 한국어' },
  { whisper: 'chinese', bcp: 'zh-CN', name: 'Chinese — 中文' },
  { whisper: 'dutch', bcp: 'nl-NL', name: 'Dutch — Nederlands' },
  { whisper: 'polish', bcp: 'pl-PL', name: 'Polish — Polski' },
  { whisper: 'ukrainian', bcp: 'uk-UA', name: 'Ukrainian — Українська' },
  { whisper: 'swahili', bcp: 'sw-KE', name: 'Swahili — Kiswahili' },
  { whisper: null, bcp: 'en-US', name: 'Auto-detect (file only)' },
];

// Rough Devanagari → Roman (Hinglish) transliteration, tuned for how people type Hindi on Instagram.
const V = { 'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o' };
const M = { 'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e' };
const C = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
  'ष': 'sh', 'स': 's', 'ह': 'h',
};
// Consonant + nukta (़): क़ ख़ ग़ ज़ ड़ ढ़ फ़ य़
const NUKTA = { 'क': 'q', 'ख': 'kh', 'ग': 'g', 'ज': 'z', 'ड': 'r', 'ढ': 'rh', 'फ': 'f', 'य': 'y' };
const DEV = /[ऀ-ॿ]/;

// Common words spelled the way people actually type them.
const COMMON = {
  'में': 'mein', 'मैं': 'main', 'है': 'hai', 'हैं': 'hain', 'नहीं': 'nahi', 'यह': 'yeh', 'वह': 'woh', 'क्या': 'kya',
  'कि': 'ki', 'की': 'ki', 'के': 'ke', 'को': 'ko', 'से': 'se', 'पर': 'par', 'और': 'aur', 'भी': 'bhi', 'तो': 'toh',
  'हो': 'ho', 'भाई': 'bhai', 'ये': 'ye', 'वो': 'wo', 'था': 'tha', 'थी': 'thi', 'हूँ': 'hoon', 'हूं': 'hoon',
  'कुछ': 'kuch', 'बहुत': 'bahut', 'अच्छा': 'accha', 'क्यों': 'kyun', 'कैसे': 'kaise', 'यार': 'yaar', 'आप': 'aap',
  'तुम': 'tum', 'हम': 'hum', 'मेरा': 'mera', 'मेरी': 'meri', 'तेरा': 'tera', 'अब': 'ab', 'एक': 'ek',
  'लिए': 'liye', 'रहा': 'raha', 'रही': 'rahi', 'गया': 'gaya', 'करो': 'karo', 'होगा': 'hoga', 'दोस्तों': 'doston',
};

export function toHinglish(word) {
  if (!DEV.test(word)) return word;
  const m = word.normalize('NFC').match(/^([ऀ-ॿ]+)(.*)$/s);
  if (m && COMMON[m[1]]) return COMMON[m[1]] + m[2];
  const chars = [...word.normalize('NFD')];

  // 1. Split into units: consonant (with vowel sign / inherent a / none), vowel, or other.
  const u = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (C[ch]) {
      let r = C[ch];
      if (chars[i + 1] === '़') { r = NUKTA[ch] || r; i++; }
      const next = chars[i + 1];
      if (next === '्') { u.push({ c: r, v: '' }); i++; }
      else if (M[next]) { u.push({ c: r, v: M[next] }); i++; }
      else u.push({ c: r, v: 'a', inh: true });
    } else if (V[ch]) u.push({ s: V[ch], vowel: true });
    else if (ch === 'ं' || ch === 'ँ') u.push({ s: 'n' });
    else if (ch === 'ः') u.push({ s: 'h' });
    else if (ch === '।') u.push({ s: '.' });
    else if (/[०-९]/.test(ch)) u.push({ s: String(ch.charCodeAt(0) - 0x966) });
    else if (ch !== '़') u.push({ s: ch, other: true });
  }

  // 2. Schwa deletion, the way Hindi is spoken: "aapaki" → "aapki", "vaayaral" → "vaayral".
  const endsVowel = x => x && (x.vowel || (x.c && x.v));
  const isLetter = x => x && !x.other;
  for (let i = 0; i < u.length; i++) {
    const x = u[i];
    if (!x.inh) continue;
    const next = u[i + 1];
    if (!isLetter(next)) { if (i > 0) x.v = ''; continue; }   // word-final
    const nextIsFinalSchwa = next.inh && !isLetter(u[i + 2]);
    if (i > 0 && endsVowel(u[i - 1]) && next.c && next.v && !nextIsFinalSchwa) x.v = '';
  }

  const out = u.map(x => x.c ? x.c + x.v : x.s).join('');
  return out.replace(/aaee$/, 'ai').replace(/ee$/, 'i').replace(/(..)aa$/, '$1a');
}
