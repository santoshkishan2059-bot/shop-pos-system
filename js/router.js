/* ===============================
   PAGE LOADER (HTML + CSS + JS)
================================ */
async function loadPage(page, cssFile, jsFile) {
  try {
    const res = await fetch(page);
    if (!res.ok) throw new Error("Failed to load page");

    const html = await res.text();
    document.getElementById("app").innerHTML = html;

    if (cssFile) loadCSS(cssFile);
    if (jsFile) loadJS(jsFile);

    setActiveNav(page);

  } catch (err) {
    console.error(err);
    document.getElementById("app").innerHTML =
      "<p style='padding:20px'>Page load failed</p>";
  }
}

/* ===============================
   PAGE-SPECIFIC CSS
================================ */
function loadCSS(file) {
  // Remove old page CSS
  document
    .querySelectorAll("link[data-page-css]")
    .forEach(link => link.remove());

  // Add new page CSS
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = file;
  link.setAttribute("data-page-css", "true");
  document.head.appendChild(link);
}

/* ===============================
   PAGE-SPECIFIC JS (MODULE FIX)
================================ */
function loadJS(file) {
  // Remove old page JS
  document
    .querySelectorAll("script[data-page-js]")
    .forEach(script => script.remove());

  // Add new page JS as a module
  const script = document.createElement("script");
  script.type = "module";        // ✅ allows top-level await & import/export
  script.src = file;
  script.defer = true;
  script.setAttribute("data-page-js", "true");

  script.onload = () => console.log(file + " loaded");

  document.body.appendChild(script);
}

/* ===============================
   ACTIVE NAV STATE
================================ */
function setActiveNav(page) {
  document.querySelectorAll(".navbar a").forEach(a => {
    a.classList.remove("active");
    if (a.dataset.page === page) {
      a.classList.add("active");
    }
  });
}

/* ===============================
   DEFAULT LOAD
================================ */
window.addEventListener("DOMContentLoaded", () => {
  loadPage("pages/dashboard.html", "css/dashboard.css", "");
});

/* ===============================
   NAVIGATION HANDLER
================================ */
document.addEventListener("click", e => {
  const link = e.target.closest("[data-page]");
  if (!link) return;

  e.preventDefault();

  loadPage(
    link.dataset.page,
    link.dataset.css,
    link.dataset.js
  );
});
