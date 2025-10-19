// tools/sync_airtable.mjs
import { promises as fs } from "fs";
import path from "path";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";
const AIRTABLE_BASE  = process.env.AIRTABLE_BASE  || "";
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE || "";

const ROOT  = process.cwd();
const OUT   = path.join(ROOT, "data");
const DECKS = path.join(OUT, "decks");

async function ensureDirs() {
  await fs.mkdir(DECKS, { recursive: true });
}

async function writeSample() {
  const now = new Date().toISOString();
  const sample = {
    slug: "hello-world",
    name: "Hello World (sample)",
    updatedAt: now,
    note: "Replace this with real Airtable data once ready."
  };

  const indexPayload = {
    updatedAt: now,
    decks: [{ slug: sample.slug, name: sample.name, updatedAt: sample.updatedAt }]
  };

  await fs.writeFile(path.join(OUT, "index.json"), JSON.stringify(indexPayload, null, 2));
  await fs.writeFile(path.join(DECKS, `${sample.slug}.json`), JSON.stringify(sample, null, 2));
}

async function main() {
  await ensureDirs();
  await writeSample();
  console.log("Wrote data/index.json and data/decks/hello-world.json");
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE || !AIRTABLE_TABLE) {
    console.log("Note: Airtable secrets present, but this placeholder doesn't fetch yet.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
