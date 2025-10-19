// Inject shared header and mark the active nav link
async function injectHeader() {
  let mount = document.getElementById("SiteHeaderMount");
  if (!mount) { mount = document.createElement("div"); mount.id = "SiteHeaderMount"; document.body.prepend(mount); }
  try {
    const res = await fetch("/Header.html", { cache: "no-store" });
    mount.innerHTML = await res.text();
    setActiveNav();
  } catch (e) { console.error("Header load failed", e); }
}

function currentPageKey() {
  const p = location.pathname.toLowerCase();
  if (p === "/" || p.endsWith("/index.html")) return "home";
  if (p.endsWith("/pages/decklibrary.html")) return "library";
  if (p.endsWith("/pages/content.html")) return "content";
  if (p.endsWith("/pages/submitadeck.html")) return "submit";
  return "";
}

function setActiveNav() {
  const key = currentPageKey();
  document.querySelectorAll(".MainNav .NavLink").forEach(a =>
    a.classList.toggle("is-active", a.dataset.nav === key)
  );
}

document.addEventListener("DOMContentLoaded", injectHeader);
