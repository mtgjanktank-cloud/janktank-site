// Scripts/IncludeHeader.js
// Inject /Header.html and rewrite its links so they work under /janktank-site/ (dev)
// and also from site root (production).

// Fetch + inject
const headerUrl = new URL("../Header.html", import.meta.url);
const html = await (await fetch(headerUrl, { cache: "no-store" })).text();
document.body.insertAdjacentHTML("afterbegin", html);

// Base URL for rewriting (e.g., http://127.0.0.1:5500/janktank-site/)
const siteBaseUrl  = new URL("../", import.meta.url);
const siteBasePath = siteBaseUrl.pathname;

function normalize(val) {
  if (!val) return val;
  if (/^https?:\/\//i.test(val)) return val;           // absolute http(s)
  if (val.startsWith("data:")) return val;              // data URIs
  if (val.startsWith("/")) {                            // root-relative → prefix dev base
    return siteBasePath + val.replace(/^\/+/, "");
  }
  // relative → resolve against /janktank-site/
  return new URL(val, siteBaseUrl).pathname;
}

// Rewrite only inside the injected header
for (const a of document.querySelectorAll("header a[href]")) {
  a.setAttribute("href", normalize(a.getAttribute("href")));
}
for (const img of document.querySelectorAll("header img[src]")) {
  img.setAttribute("src", normalize(img.getAttribute("src")));
}
