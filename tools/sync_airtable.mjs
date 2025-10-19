// tools/sync_airtable.mjs
import { promises as fs } from "fs";
import path from "path";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE  = process.env.AIRTABLE_BASE;
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE || "decks";
if (!AIRTABLE_TOKEN || !AIRTABLE_BASE || !AIRTABLE_TABLE) {
  console.error("Missing one of AIRTABLE_TOKEN / AIRTABLE_BASE / AIRTABLE_TABLE");
  process.exit(1);
}

const FIELDS = {
  NAME: "Deck Name",
  LIST: "Deck List",            // <-- attachment array OR text
  COVER_CARD: "Cover Card",
  ARCHETYPE: "Archetype",
  CHARACTERISTICS: "Characteristics",
  DATE_UPDATED: "Date Updated",
  COLORS: "Color(s)",
  AUTHOR: "Author",
  FORMAT: "Format",
  BANNED: "Contains Banned Cards?",
};

const ROOT  = process.cwd();
const OUT   = path.join(ROOT, "data");
const DECKS = path.join(OUT, "decks");

function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function toArray(x) { return x == null ? [] : (Array.isArray(x) ? x : [x]); }
function normalizeBool(x) {
  if (typeof x === "boolean") return x;
  if (typeof x === "string") return ["true","yes","y","1"].includes(x.toLowerCase());
  if (typeof x === "number") return x !== 0;
  return false;
}

// Read the Deck List field whether it's a string or attachments[]
async function readDeckListField(value) {
  // Case 1: already a string
  if (typeof value === "string") return value;

  // Case 2: attachments array
  if (Array.isArray(value) && value.length) {
    // Prefer text/* or .txt
    const pick =
      value.find(a => (a.type && a.type.toLowerCase().startsWith("text/")) ||
                       (a.filename && a.filename.toLowerCase().endsWith(".txt"))) ||
      value[0];

    if (pick?.url) {
      const res = await fetch(pick.url); // Airtable attachment URLs are signed; no auth needed
      if (!res.ok) throw new Error(`Attachment fetch failed ${res.status} for ${pick.filename || pick.url}`);
      return await res.text();
    }
  }

  // Fallback: nothing usable
  return "";
}

// Split mainboard / sideboard (robust: handles "Sideboard", "Side Board", markers, or just a blank line)
function splitMainSide(deckText) {
  if (!deckText) return { mainText: "", sideText: "" };

  // Normalize line endings and outer whitespace
  const text = String(deckText).replace(/\r\n?/g, "\n").trim();
  const lines = text.split("\n");

  // 1) Explicit marker (most reliable)
  const isSideboardMarker = (s) =>
    /^(?:-+\s*)?(?:side\s*board|sideboard)\s*:?\s*(?:-+)?$/i.test(s.trim());

  let idx = lines.findIndex(isSideboardMarker);

  // 2) If no explicit marker, try structural split on a blank line that looks like a section break
  if (idx === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() !== "") continue;

      const hasMainAbove = lines.slice(0, i).some(l => l.trim() !== "");
      const nonEmptyAfter = lines.slice(i + 1).filter(l => l.trim() !== "").length;

      if (hasMainAbove && nonEmptyAfter >= 2) { idx = i; break; }
    }
  }

  // 3) If still no split, everything is mainboard
  if (idx === -1) return { mainText: text, sideText: "" };

  const mainText = lines.slice(0, idx).join("\n").trim();
  const sideText = lines.slice(idx + 1).join("\n").trim();

  return { mainText, sideText };
}

// Airtable fetch (pagination)
async function fetchAllRecords() {
  const baseUrl = `https://api.airtable.com/v0/${encodeURIComponent(AIRTABLE_BASE)}/${encodeURIComponent(AIRTABLE_TABLE)}`;
  const headers = { Authorization: `Bearer ${AIRTABLE_TOKEN}` };
  const all = [];
  let url = baseUrl + `?pageSize=100&sort[0][field]=${encodeURIComponent(FIELDS.DATE_UPDATED)}&sort[0][direction]=desc`;
  while (url) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
    const json = await res.json();
    all.push(...json.records);
    url = json.offset ? baseUrl + `?pageSize=100&offset=${encodeURIComponent(json.offset)}` : null;
  }
  return all;
}

// Normalize ONE record (now async because we may download the attachment)
async function normalizeRecord(r) {
  const f = r.fields || {};
  const name = f[FIELDS.NAME] ?? "";
  const slug = slugify(name);

  const rawList = await readDeckListField(f[FIELDS.LIST]);
  const { mainText, sideText } = splitMainSide(String(rawList || ""));

  return {
    id: r.id,
    slug,
    name,
    author: f[FIELDS.AUTHOR] ?? "",
    format: f[FIELDS.FORMAT] ?? "",
    archetype: f[FIELDS.ARCHETYPE] ?? "",
    characteristics: toArray(f[FIELDS.CHARACTERISTICS]),
    colors: toArray(f[FIELDS.COLORS]),
    updatedAt: f[FIELDS.DATE_UPDATED] ? new Date(f[FIELDS.DATE_UPDATED]).toISOString() : new Date().toISOString(),
    containsBannedCards: normalizeBool(f[FIELDS.BANNED]),
    coverCard: (f[FIELDS.COVER_CARD] ?? "").toString().trim(),
    decklist: {
      raw: String(rawList || ""),
      mainText,
      sideText,
    },
  };
}

async function ensureDirs() { await fs.mkdir(DECKS, { recursive: true }); }
async function writeOutputs(decks) {
  const now = new Date().toISOString();
  const index = {
    updatedAt: now,
    decks: decks.map(d => ({
      slug: d.slug, name: d.name, author: d.author, format: d.format,
      archetype: d.archetype, colors: d.colors, updatedAt: d.updatedAt,
      containsBannedCards: d.containsBannedCards
    })),
  };
  await fs.writeFile(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
  for (const d of decks) {
    await fs.writeFile(path.join(DECKS, `${d.slug}.json`), JSON.stringify(d, null, 2));
  }
}

async function main() {
  await ensureDirs();
  console.log("Fetching Airtable records…");
  const records = await fetchAllRecords();
  console.log(`Fetched ${records.length} rows`);
  const decks = (await Promise.all(records.map(normalizeRecord))).filter(d => d.name && d.slug);
  console.log(`Normalized ${decks.length} decks`);
  await writeOutputs(decks);
  console.log(`Wrote data/index.json and ${decks.length} files in data/decks/`);
}

main().catch(err => { console.error(err); process.exit(1); });
