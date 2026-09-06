// gen-tool-pages.mjs — 生成 224 个工具详情页 + 站内链接改造 + sitemap 重建
// 运行:node scripts/gen-tool-pages.mjs
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEPT_DIR = path.join(ROOT, "departments");
const TOOL_DIR = path.join(ROOT, "tool");

/* ---------- load data.js ---------- */
const raw = fs.readFileSync(path.join(ROOT, "js", "data.js"), "utf8");
const { DEPARTMENTS, TOOLS } = new Function(
  raw + "\n;return { DEPARTMENTS, TOOLS };"
)();

/* ---------- slug ---------- */
const slugify = (s) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "tool";

const used = new Set();
const slugOf = new Map(); // tool.name -> slug (名字在库内唯一,重复时加 dept 后缀)
for (const t of TOOLS) {
  let base = slugify(t.name);
  let slug = base;
  if (used.has(slug)) {
    slug = base + "-" + t.dept;
    let n = 2;
    while (used.has(slug)) slug = base + "-" + t.dept + "-" + n++;
  }
  used.add(slug);
  slugOf.set(t.name, slug);
  t._slug = slug;
}
const dupNames = TOOLS.length - new Set(TOOLS.map(t => t.name)).size;
const deptById = Object.fromEntries(DEPARTMENTS.map(d => [d.id, d]));
const SITE = "https://ai.toolboxes.top";

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pricingLabel = p => ({ free: "Free", freemium: "Freemium", paid: "Paid" }[p] || p);
const pricingAnswer = p => ({
  free: "Yes. It is completely free to use.",
  freemium: "It follows a freemium model: core features are free, while advanced features require a paid plan.",
  paid: "No. It is a paid tool — check the official website for current plans and pricing."
}[p] || "Check the official website for current pricing.");

/* ---------- 生成单个工具详情页 ---------- */
function toolPage(t) {
  const dept = deptById[t.dept];
  const slug = t._slug;
  const url = `${SITE}/tool/${slug}`;
  const alts = TOOLS.filter(x => x.dept === t.dept && x.name !== t.name).slice(0, 6);
  const tagList = (t.tags || []).map(x => `<span class="tag-chip">${esc(x)}</span>`).join(" ");
  const altCards = alts.map(a => `
      <a class="alt-card" href="/tool/${a._slug}">
        <strong>${esc(a.name)}</strong>
        <span class="pill ${a.pricing}">${pricingLabel(a.pricing)}</span>
        <p>${esc(a.desc)}</p>
      </a>`).join("\n");
  const faq = `
    <details class="faq-item" open><summary>What is ${esc(t.name)}?</summary>
      <p>${esc(t.desc)} ${esc(t.name)} is listed under ${esc(dept.name)} on AI Supermarket, and you can reach the official site from this page.</p></details>
    <details class="faq-item"><summary>Is ${esc(t.name)} free to use?</summary>
      <p>${pricingAnswer(t.pricing)}</p></details>
    <details class="faq-item"><summary>What are the best alternatives to ${esc(t.name)}?</summary>
      <p>${alts.length ? "Other " + esc(dept.name) + " tools on AI Supermarket: " + alts.map(a => `<a href="/tool/${a._slug}">${esc(a.name)}</a>`).join(", ") + "." : "Browse the " + esc(dept.name) + " department for similar tools."}</p></details>`;

  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "SoftwareApplication", name: t.name, applicationCategory: "BusinessApplication",
        operatingSystem: "Web", url: t.url, description: t.desc,
        offers: { "@type": "Offer", price: t.pricing === "free" ? "0" : undefined, priceCurrency: "USD",
                  availability: "https://schema.org/InStock" } },
      { "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "AI Supermarket", item: SITE + "/" },
          { "@type": "ListItem", position: 2, name: dept.name, item: `${SITE}/departments/${dept.id}` },
          { "@type": "ListItem", position: 3, name: t.name } ] },
      { "@type": "FAQPage", mainEntity: [
          { "@type": "Question", name: `What is ${t.name}?`, acceptedAnswer: { "@type": "Answer", text: `${t.desc} It is listed under ${dept.name} on AI Supermarket.` } },
          { "@type": "Question", name: `Is ${t.name} free to use?`, acceptedAnswer: { "@type": "Answer", text: pricingAnswer(t.pricing) } },
          { "@type": "Question", name: `What are the best alternatives to ${t.name}?`,
            acceptedAnswer: { "@type": "Answer", text: alts.map(a => a.name).join(", ") || `Other ${dept.name} tools on AI Supermarket.` } } ] }
    ]
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(t.name)} — Pricing, Features &amp; Alternatives | AI Supermarket</title>
  <meta name="description" content="${esc(t.desc)} ${esc(t.name)} is a ${pricingLabel(t.pricing).toLowerCase()} AI tool for ${esc(dept.name)}. See details, alternatives and the official site.">
  <link rel="canonical" href="${url}">
  <meta property="og:title" content="${esc(t.name)} — ${esc(dept.name)} AI Tool | AI Supermarket">
  <meta property="og:description" content="${esc(t.desc)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%2310b981%22/><text y=%22.72em%22 x=%2250%22 text-anchor=%22middle%22 font-size=%2255%22>🛒</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../css/style.css">
  <style>
    .tool-hero{max-width:1100px;margin:0 auto;padding:34px 20px 10px}
    .crumb{font-size:13px;opacity:.65;margin-bottom:14px}
    .crumb a{color:inherit}
    .tool-hero h1{font-size:30px;margin:6px 0 10px}
    .tool-sub{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0 14px}
    .visit-btn{display:inline-block;background:var(--green,#10b981);color:#fff;padding:11px 22px;border-radius:10px;text-decoration:none;font-weight:700}
    .visit-btn:hover{filter:brightness(1.08)}
    .tool-body{max-width:1100px;margin:18px auto 40px;padding:0 20px;display:grid;grid-template-columns:1.6fr 1fr;gap:24px}
    .card-panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px}
    .card-panel h2{font-size:17px;margin:0 0 10px}
    .card-panel p{opacity:.85;font-size:14.5px;line-height:1.65}
    .fact{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid rgba(128,128,128,.15);font-size:14px}
    .fact span:first-child{opacity:.6}
    .alt-grid{display:grid;grid-template-columns:1fr;gap:10px;margin-top:10px}
    .alt-card{display:block;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;text-decoration:none;color:inherit}
    .alt-card:hover{border-color:var(--green,#10b981)}
    .alt-card p{opacity:.7;font-size:13px;margin:6px 0 0}
    .pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600}
    .pill.free{background:rgba(16,185,129,.15);color:#10b981}
    .pill.freemium{background:rgba(14,165,233,.15);color:#0ea5e9}
    .pill.paid{background:rgba(232,118,58,.15);color:#e8763a}
    .tag-chip{display:inline-block;margin:3px 6px 3px 0;padding:4px 10px;border-radius:999px;border:1px solid rgba(128,128,128,.3);font-size:12.5px;opacity:.8}
    details.faq-item{border-bottom:1px solid rgba(128,128,128,.2);padding:10px 0}
    details.faq-item summary{cursor:pointer;font-weight:600}
    details.faq-item p{opacity:.75;font-size:14px;margin-top:8px}
    @media (max-width:800px){.tool-body{grid-template-columns:1fr}}
  </style>
  <script type="application/ld+json">${ld}</script>
  <script>
    try { var t = localStorage.getItem("asm-theme");
      if (t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches)) document.documentElement.dataset.theme = "dark";
    } catch (e) {}
  </script>
</head>
<body id="top">
  <header class="site-header">
    <div class="container header-inner">
      <a class="logo" href="/" aria-label="AI Supermarket home">
        <svg class="logo-cart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="9" cy="21" r="1.6"/><circle cx="19" cy="21" r="1.6"/>
          <path d="M2.5 3h2l2.4 12.2a2 2 0 0 0 2 1.6h9.2a2 2 0 0 0 2-1.6L22 7H6"/>
        </svg>
        <span>AI<em>Supermarket</em></span>
      </a>
      <div class="header-actions"><a class="list-btn" href="/" style="text-decoration:none"><span aria-hidden="true">🏪</span> All departments</a></div>
    </div>
  </header>
  <div class="awning" aria-hidden="true"></div>

  <div class="tool-hero">
    <div class="crumb"><a href="/">AI Supermarket</a> / <a href="/departments/${dept.id}">${esc(dept.name)}</a> / ${esc(t.name)}</div>
    <h1>${esc(t.name)}</h1>
    <p class="intro">${esc(t.desc)}</p>
    <div class="tool-sub">
      <span class="pill ${t.pricing}">${pricingLabel(t.pricing)}</span>
      <span class="tag-chip">${dept.icon} ${esc(dept.name)}</span>
      <span class="tag-chip">${esc(new URL(t.url).hostname.replace(/^www\\./, ""))}</span>
    </div>
    <a class="visit-btn" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">Visit official site ↗</a>
  </div>

  <div class="tool-body">
    <div>
      <div class="card-panel">
        <h2>What is ${esc(t.name)}?</h2>
        <p>${esc(t.desc)} ${esc(t.name)} works in the browser and fits into ${esc(dept.name)} workflows. On this page you can review what it does, check its pricing model, compare it with alternatives and jump straight to the official site.</p>
        <p style="margin-top:10px">${tagList || ""}</p>
      </div>
      <div class="card-panel" style="margin-top:16px">
        <h2>Frequently asked questions</h2>
        ${faq}
      </div>
    </div>
    <div>
      <div class="card-panel">
        <h2>Quick facts</h2>
        <div class="fact"><span>Pricing</span><span>${pricingLabel(t.pricing)}</span></div>
        <div class="fact"><span>Category</span><span>${esc(dept.icon)} ${esc(dept.name)}</span></div>
        <div class="fact"><span>Official site</span><span>${esc(new URL(t.url).hostname.replace(/^www\\./, ""))}</span></div>
        <div class="fact"><span>Listed on</span><span>AI Supermarket</span></div>
      </div>
      <div class="card-panel" style="margin-top:16px">
        <h2>Alternatives in ${esc(dept.name)}</h2>
        <div class="alt-grid">${altCards || "<p>More listings coming soon.</p>"}</div>
      </div>
    </div>
  </div>

  <footer class="site-footer">
    <div class="container" style="padding:24px 20px">
      <a href="https://plugins.jetbrains.com/plugin/34120-fast-excel-viewer" style="color:inherit;opacity:.6;text-decoration:none;font-size:13px">Also try Fast Excel Viewer — our streaming Excel viewer for JetBrains IDEs</a>
    </div>
  </footer>
</body>
</html>`;
}

/* ---------- 生成全部页面 ---------- */
fs.rmSync(TOOL_DIR, { recursive: true, force: true });
fs.mkdirSync(TOOL_DIR, { recursive: true });
let made = 0;
for (const t of TOOLS) {
  fs.writeFileSync(path.join(TOOL_DIR, t._slug + ".html"), toolPage(t));
  made++;
}
console.log(`生成详情页: ${made} 个 → tool/`);

/* ---------- app.js:动态卡片改内部链接 ---------- */
let app = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
if (!app.includes("_slug")) {
  app = app.replace(
    'const DEPT_BY_ID = Object.fromEntries(DEPARTMENTS.map(d => [d.id, d]));',
    `const DEPT_BY_ID = Object.fromEntries(DEPARTMENTS.map(d => [d.id, d]));

  const slugify = s => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "tool";
  const _used = new Set();
  TOOLS.forEach(t => {
    let base = slugify(t.name), s = base;
    if (_used.has(s)) { s = base + "-" + t.dept; let n = 2; while (_used.has(s)) s = base + "-" + t.dept + "-" + n++; }
    _used.add(s); t._slug = s;
  });`
  );
  app = app.replace('<a class="tool-main" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">',
                    '<a class="tool-main" href="/tool/${t._slug}">');
  app = app.replace('<span class="visit" aria-hidden="true">Visit ↗</span>',
                    '<span class="visit" aria-hidden="true">Details →</span>');
  fs.writeFileSync(path.join(ROOT, "js", "app.js"), app);
  console.log("app.js: 动态卡片已改为站内详情页链接");
}

/* ---------- 静态卡片改写(index + departments) ---------- */
const cardBlock = /<article class="tool-card">[\s\S]*?<\/article>/g;
const toolMain = /(<a class="tool-main") href="https?:\/\/[^"]*"([^>]*>)/;
let rewritten = 0;
function rewriteFile(f) {
  let html = fs.readFileSync(f, "utf8");
  let changed = false;
  html = html.replace(cardBlock, block => {
    const m = block.match(/data-tool="([^"]+)"/);
    const slug = m && slugOf.get(m[1]);
    if (!slug) return block;
    const nb = block.replace(toolMain, `$1 href="/tool/${slug}"$2`)
                    .replace(/<span class="visit" aria-hidden="true">Visit ↗<\/span>/,
                             '<span class="visit" aria-hidden="true">Details →</span>');
    if (nb !== block) { changed = true; rewritten++; }
    return nb;
  });
  if (changed) fs.writeFileSync(f, html);
}
rewriteFile(path.join(ROOT, "index.html"));
for (const f of fs.readdirSync(DEPT_DIR)) {
  if (f.endsWith(".html")) rewriteFile(path.join(DEPT_DIR, f));
}
console.log(`静态卡片改写: ${rewritten} 张 → 站内详情页`);

/* ---------- sitemap 重建 ---------- */
const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: `${SITE}/`, priority: "1.0" },
  ...DEPARTMENTS.map(d => ({ loc: `${SITE}/departments/${d.id}`, priority: "0.9" })),
  ...TOOLS.map(t => ({ loc: `${SITE}/tool/${t._slug}`, priority: "0.8" })),
  { loc: `${SITE}/about`, priority: "0.4" },
  { loc: `${SITE}/privacy`, priority: "0.3" },
];
const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sm);
console.log(`sitemap.xml: ${urls.length} 个 URL`);
