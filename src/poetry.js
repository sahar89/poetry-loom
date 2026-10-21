// Loads Khayyam quatrains: live from the Ganjoor API, or from the bundled snapshot
// (public/data/quatrains.json, made by `npm run snapshot`) when Ganjoor is unreachable.

// Proxied to api.ganjoor.net by Netlify (netlify.toml) and by Vite in development.
const API = '/api/ganjoor';
const RUBAIYAT_CAT = 31;
const LIVE_COUNT = 60;
const MIN_LIVE = 24;
const TIMEOUT_MS = 9000;
const POEM_QUERY = 'verses=true&catInfo=false&rhymes=false&recitations=false&images=false&songs=false&comments=false&navigation=false';

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function getJSON(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function fetchLive() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const cat = await getJSON(`${API}/cat/${RUBAIYAT_CAT}?poems=true`, ctrl.signal);
    const ids = shuffle(cat.cat.poems.map((p) => p.id)).slice(0, LIVE_COUNT);
    const quatrains = [];
    // Small concurrent batches to stay polite to Ganjoor.
    for (let i = 0; i < ids.length; i += 12) {
      const batch = await Promise.allSettled(
        ids.slice(i, i + 12).map((id) => getJSON(`${API}/poem/${id}?${POEM_QUERY}`, ctrl.signal))
      );
      for (const r of batch) {
        if (r.status !== 'fulfilled' || !r.value.verses?.length) continue;
        const poem = r.value;
        quatrains.push({
          id: poem.id,
          url: poem.fullUrl,
          verses: poem.verses.sort((a, b) => a.vOrder - b.vOrder).map((v) => v.text),
        });
      }
    }
    if (quatrains.length < MIN_LIVE) throw new Error('Too few quatrains from Ganjoor');
    return quatrains;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchArchive() {
  const res = await fetch('/data/quatrains.json');
  return shuffle(await res.json());
}

export async function loadQuatrains() {
  try {
    return { quatrains: await fetchLive(), source: 'live' };
  } catch (err) {
    console.warn('Ganjoor live fetch failed, using bundled quatrains:', err);
    return { quatrains: await fetchArchive(), source: 'archive' };
  }
}

// Splits quatrains into a word stream that reads right-to-left, row by row.
export function toWords(quatrains) {
  const words = [];
  for (const q of quatrains) {
    for (const line of q.verses) {
      for (const w of line.split(/\s+/)) {
        const clean = w.replace(/[،؛.!?«»"]/g, '').trim();
        if (clean) words.push(clean);
      }
    }
  }
  return words;
}
