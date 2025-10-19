// tools/sync_airtable.mjs
// Node 18+ (global fetch). No external deps.
// Outputs:
//   data/index.json
//   data/decks/<slug>.json

import { promises as fs } from "fs";
import path from "path";

// ---- ENV ----
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE  = process.env.AIRTABLE_BASE;
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE || "decks";
if (!AIRTABLE_TOKEN || !AIRTABLE_BASE || !AIRTABLE_TABLE) {
  console.error("Missing one of AIRTABLE_TOKEN / AIRTABLE_BASE / AIRTABLE_TABLE");
  process.exit(1);
}

// ---- FIELD MAP (exactly as in your screenshot) ----
const FIELDS = {
  NAME: "Deck Name",
  LIST: "Deck List",
  COVER_CARD: "Cover Card",
  ARCHETYPE: "Archetype",
  CHARACTERISTICS: "Characteristics",
  DATE_UPDATED: "Date Updated",
  COLORS: "Color(s)",
  AUTHOR: "Author",
  FORMAT: "Format",
  BANNED: "Contains Banned Cards?"
};

// ---- paths ----
const ROOT  = process.cwd();
const OUT   = path.join(ROOT, "data");
const DECKS = path.join(OUT, "decks");

// ---- helpers ----
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
// Split main/side from the Deck List text
function splitMainSide(deckText) {
  if (!deckText) return { mainText: "", sideText: "" };
  const text = deckText.replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  let split = lines.findIndex(l => l.trim().toLowerCase().startsWith("sideboard"));
  if (split === -1) split = lines.findIndex(l => l.trim() === ""); // first blank line
  if (split === -1) return { mainText: text.trim(), sideText: "" };
  return {
    mainText: lines.slice(0, split).join("\n").trim(),
    sideText: lines.slice(split + 1).join("\n").trim()
  };
}

// ---- airtable fetch ----
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

function normalizeRecord(r) {
  const f = r.fields || {};
  const name = f[FIELDS.NAME] ?? "";
  const slug = slugify(name);
  const list = f[FIELDS.LIST] ?? "";
  const { mainText, sideText } = splitMainSide(String(list));

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
      raw: String(list),
      mainText,
      sideText
    }
  };
}

// ---- write outputs ----
async function ensureDirs() { await fs.mkdir(DECKS, { recursive: true }); }

async function writeOutputs(decks) {
  const now = new Date().toISOString();
  const index = {
    updatedAt: now,
    decks: decks.map(d => ({
      slug: d.slug,
      name: d.name,
      author: d.author,
      format: d.format,
      archetype: d.archetype,
      colors: d.colors,
      updatedAt: d.updatedAt,
      containsBannedCards: d.containsBannedCards
    }))
  };
  await fs.writeFile(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
  for (const d of decks) {
    await fs.writeFile(path.join(DECKS, `${d.slug}.json`), JSON.stringify(d, null, 2));
  }
}

// ---- main ----
async function main() {
  await ensureDirs();
  console.log("Fetching Airtable records…");
  const records = await fetchAllRecords();
  console.log(`Fetched ${records.length} rows`);
  const decks = records.map(normalizeRecord).filter(d => d.name && d.slug);
  if (decks.length === 0) console.warn("Warning: no valid decks found.");
  await writeOutputs(decks);
  console.log(`Wrote data/index.json and ${decks.length} files in data/decks/`);
}

main().catch(err => { console.error(err); process.exit(1); });
