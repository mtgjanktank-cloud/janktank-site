// Scripts/DeckLibrary.js
// Renders a searchable list of deck slugs from Data/index.json
// Expects: Pages/DeckLibrary.html to include this script as a module

const INDEX_URL = "../Data/index.json";                 // manifest lives in Data/
const linkTo = slug => `DeckDisplay.html?deck=${encodeURIComponent(slug)}`;

const $list = document.getElementById("deck-list");
const $search = document.getElementById("search");
const $count = document.getElementById("count");

init().catch(err => {
  console.error(err);
  if ($count) $count.textContent = "Failed to load deck index.";
});

async function init() {
  const { slugs = [] } = await fetchJSON(INDEX_URL);
  let filtered = slugs.slice();
  render(filtered);

  if ($search) {
    $search.addEventListener("input", () => {
      const q = $search.value.trim().toLowerCase();
      filtered = q ? slugs.filter(s => s.toLowerCase().includes(q)) : slugs.slice();
      render(filtered);
    });
  }
}

function render(items) {
  if (!$list) return;
  $list.innerHTML = "";
  if ($count) $count.textContent = `${items.length} deck${items.length === 1 ? "" : "s"}`;

  const frag = document.createDocumentFragment();
  for (const slug of items) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = linkTo(slug);
    a.className = "card-link";
    a.innerHTML = `<span class="slug">${slug}</span><span class="hint">open</span>`;
    li.appendChild(a);
    frag.appendChild(li);
  }
  $list.appendChild(frag);
}

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.status}`);
  return r.json();
}
