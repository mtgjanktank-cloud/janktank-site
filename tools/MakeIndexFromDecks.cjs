// janktank-site/Tools/MakeIndexFromDecks.js
// Builds Data/index.json from the files in Data/Decks

const fs = require("node:fs/promises");
const path = require("node:path");

const SOURCE_DIR = path.resolve(__dirname, "../Data/Decks");
const OUT_DIR    = path.resolve(__dirname, "../Data");
const OUT_FILE   = path.join(OUT_DIR, "index.json");

(async () => {
  try {
    // Ensure output folder exists
    await fs.mkdir(OUT_DIR, { recursive: true });

    // Read all entries in Data/Decks
    const entries = await fs.readdir(SOURCE_DIR, { withFileTypes: true });

    // Collect deck slugs from *.json files
    const slugs = entries
      .filter(e => e.isFile() && e.name.toLowerCase().endsWith(".json"))
      .map(e => e.name.replace(/\.json$/i, ""))
      .sort((a, b) => a.localeCompare(b));

    // Write manifest
    const payload = JSON.stringify({ slugs }, null, 2);
    await fs.writeFile(OUT_FILE, payload, "utf8");

    console.log(`✅ Wrote ${slugs.length} slugs → ${OUT_FILE}`);
  } catch (err) {
    console.error("❌ Error building index.json:");
    console.error(err?.stack || err);
    process.exit(1);
  }
})();
