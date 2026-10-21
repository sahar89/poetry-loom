// Pulls every Khayyam quatrain (Ganjoor category 31) into public/data/quatrains.json.
// The app uses this file only when the live Ganjoor API is unreachable.
import { writeFile } from 'node:fs/promises';

const API = 'https://api.ganjoor.net/api/ganjoor';
const CAT_ID = 31;

async function getJSON(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  throw new Error(`Failed: ${url}`);
}

const cat = await getJSON(`${API}/cat/${CAT_ID}?poems=true`);
const list = cat.cat.poems;
const out = [];

for (let i = 0; i < list.length; i += 6) {
  const batch = list.slice(i, i + 6);
  const poems = await Promise.all(
    batch.map((p) => getJSON(`${API}/poem/${p.id}?verses=true&catInfo=false&rhymes=false&recitations=false&images=false&songs=false&comments=false&navigation=false`))
  );
  for (const poem of poems) {
    out.push({
      id: poem.id,
      url: poem.fullUrl,
      verses: poem.verses.sort((a, b) => a.vOrder - b.vOrder).map((v) => v.text),
    });
  }
  process.stdout.write(`\r${out.length}/${list.length}`);
}

await writeFile(new URL('../public/data/quatrains.json', import.meta.url), JSON.stringify(out));
console.log(`\nSaved ${out.length} quatrains.`);
