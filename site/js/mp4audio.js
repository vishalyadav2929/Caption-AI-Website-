// Pull the AAC audio track out of an MP4 / MOV (iPhone) file and wrap it as an ADTS stream,
// which every browser's decodeAudioData can read — including Safari, which refuses .mov files.
// This replaces playing the whole video in real time just to capture its sound.
// Pure byte parsing, no DOM: also runs in Node tests.

const fourcc = (u, o) => String.fromCharCode(u[o], u[o + 1], u[o + 2], u[o + 3]);

function readBoxes(u, dv, start, end) {
  const out = [];
  let o = start;
  while (o + 8 <= end) {
    let size = dv.getUint32(o);
    const type = fourcc(u, o + 4);
    let header = 8;
    if (size === 1) { size = Number(dv.getBigUint64(o + 8)); header = 16; }
    else if (size === 0) size = end - o;
    if (size < header || o + size > end) break;
    out.push({ type, start: o, end: o + size, body: o + header });
    o += size;
  }
  return out;
}
const child = (u, dv, box, type) => readBoxes(u, dv, box.body, box.end).find(b => b.type === type);
const path = (u, dv, box, ...types) => types.reduce((b, t) => b && child(u, dv, b, t), box);

/** Find the AudioSpecificConfig inside an esds box (searching the sample entry, MOV 'wave' wrappers included). */
function findAsc(u, dv, from, to) {
  for (let o = from; o + 8 < to; o++) {
    if (u[o] === 0x65 && fourcc(u, o) === 'esds') {
      // Descriptor walk: ES_Descriptor(0x03) → DecoderConfig(0x04) → DecoderSpecificInfo(0x05).
      let p = o + 8; // skip 'esds' + version/flags
      const end = Math.min(to, o - 4 + dv.getUint32(o - 4));
      const readLen = () => { let n = 0; for (let i = 0; i < 4; i++) { const b = u[p++]; n = (n << 7) | (b & 0x7f); if (!(b & 0x80)) break; } return n; };
      while (p < end) {
        const tag = u[p++];
        const len = readLen();
        if (tag === 0x03) { const flags = u[p + 2]; p += 3; if (flags & 0x80) p += 2; if (flags & 0x40) p += 1 + u[p]; if (flags & 0x20) p += 2; }
        else if (tag === 0x04) p += 13;
        else if (tag === 0x05) return u.subarray(p, p + len);
        else p += len;
      }
    }
  }
  return null;
}

/**
 * The AAC audio track of an MP4 / MOV, as raw frames (no copying: views into `buf`).
 * @returns {{ asc: Uint8Array, objectType, freqIndex, sampleRate, channels, frames: Uint8Array[] }}
 * Throws if the file has no AAC audio track.
 */
export function readAacTrack(buf) {
  const u = new Uint8Array(buf), dv = new DataView(buf);
  const top = readBoxes(u, dv, 0, u.length);
  const moov = top.find(b => b.type === 'moov');
  if (!moov) throw new Error('no moov box');
  for (const trak of readBoxes(u, dv, moov.body, moov.end).filter(b => b.type === 'trak')) {
    const mdia = child(u, dv, trak, 'mdia');
    const hdlr = mdia && child(u, dv, mdia, 'hdlr');
    if (!hdlr || fourcc(u, hdlr.body + 8) !== 'soun') continue;
    const stbl = path(u, dv, mdia, 'minf', 'stbl');
    if (!stbl) continue;
    const stsd = child(u, dv, stbl, 'stsd');
    const entry = readBoxes(u, dv, stsd.body + 8, stsd.end)[0];
    if (!entry || entry.type !== 'mp4a') throw new Error(`audio codec ${entry && entry.type} is not AAC`);
    const asc = findAsc(u, dv, entry.body, entry.end);
    if (!asc || asc.length < 2) throw new Error('no AAC config');
    const objectType = asc[0] >> 3;
    const freqIndex = ((asc[0] & 7) << 1) | (asc[1] >> 7);
    const channels = (asc[1] >> 3) & 15;
    if (freqIndex === 15 || objectType < 1 || objectType > 4) throw new Error('unsupported AAC profile');
    const RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

    // Sample sizes.
    const stsz = child(u, dv, stbl, 'stsz');
    const fixed = dv.getUint32(stsz.body + 4), count = dv.getUint32(stsz.body + 8);
    const sizes = new Array(count);
    for (let i = 0; i < count; i++) sizes[i] = fixed || dv.getUint32(stsz.body + 12 + i * 4);
    // Chunk offsets.
    const stco = child(u, dv, stbl, 'stco'), co64 = child(u, dv, stbl, 'co64');
    const offsets = [];
    if (stco) { const n = dv.getUint32(stco.body + 4); for (let i = 0; i < n; i++) offsets.push(dv.getUint32(stco.body + 8 + i * 4)); }
    else if (co64) { const n = dv.getUint32(co64.body + 4); for (let i = 0; i < n; i++) offsets.push(Number(dv.getBigUint64(co64.body + 8 + i * 8))); }
    // Samples per chunk.
    const stsc = child(u, dv, stbl, 'stsc');
    const runs = [];
    { const n = dv.getUint32(stsc.body + 4); for (let i = 0; i < n; i++) runs.push([dv.getUint32(stsc.body + 8 + i * 12), dv.getUint32(stsc.body + 12 + i * 12)]); }

    const frames = [];
    let s = 0;
    for (let c = 0; c < offsets.length && s < count; c++) {
      let per = runs[0][1];
      for (const [first, n] of runs) if (c + 1 >= first) per = n; else break;
      let o = offsets[c];
      for (let k = 0; k < per && s < count; k++, s++) {
        if (o + sizes[s] > u.length) throw new Error('truncated audio data');
        frames.push(u.subarray(o, o + sizes[s]));
        o += sizes[s];
      }
    }
    return { asc: asc.slice(), objectType, freqIndex, sampleRate: RATES[freqIndex], channels, frames };
  }
  throw new Error('no audio track');
}

/**
 * @param {ArrayBuffer} buf  the whole file
 * @returns {{ adts: Uint8Array, sampleRate: number, channels: number, frames: number }}
 * Throws if the file has no AAC audio track.
 */
export function extractAacAdts(buf) {
  const { objectType, freqIndex, channels, sampleRate, frames } = readAacTrack(buf);
  const adts = new Uint8Array(frames.reduce((a, f) => a + f.length + 7, 0));
  let w = 0;
  for (const f of frames) {
    const len = f.length + 7;
    adts[w] = 0xff; adts[w + 1] = 0xf1; // MPEG-4, no CRC
    adts[w + 2] = ((objectType - 1) << 6) | (freqIndex << 2) | (channels >> 2);
    adts[w + 3] = ((channels & 3) << 6) | (len >> 11);
    adts[w + 4] = (len >> 3) & 0xff;
    adts[w + 5] = ((len & 7) << 5) | 0x1f;
    adts[w + 6] = 0xfc;
    adts.set(f, w + 7);
    w += len;
  }
  return { adts, sampleRate, channels, frames: frames.length };
}
