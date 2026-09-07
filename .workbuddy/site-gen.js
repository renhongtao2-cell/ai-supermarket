// ============================================================
// ⚠️ 已废弃 (DEPRECATED) — 2026-09-07
// 本脚本是旧版生成器，已与线上现状脱节。若直接运行会造成严重回退：
//   1. canonical / og:url / 站内链接 全部退回带 .html 的形式
//      （线上已统一为无扩展名，.html 会被 Cloudflare Pages 308 重定向）
//   2. llms.txt 会丢失 "Last updated" 日期，且链接退回 .html
//   3. sitemap.xml 只生成 24 条且带 .html（线上是 227 条无扩展名）
//   4. 21 个部门页的 id="ai-summary" TL;DR 块会被覆盖丢失
// 现行权威生成器是：scripts/gen-tool-pages.mjs
//   （203 个工具页 + 站内链接改造 + 227 条 sitemap 重建 + 动态日期）
// 如确需运行本脚本（例如重新生成 about/privacy），请显式设置：
//   I_KNOW_SITE_GEN_IS_DEPRECATED=1
// ============================================================
if (!process.env.I_KNOW_SITE_GEN_IS_DEPRECATED) {
  console.error('\n[site-gen.js] 已废弃，拒绝运行以免回退线上修复。');
  console.error('  现行生成器: node scripts/gen-tool-pages.mjs');
  console.error('  强制运行:   I_KNOW_SITE_GEN_IS_DEPRECATED=1 node .workbuddy/site-gen.js\n');
  process.exit(1);
}

// 注意:生成后需运行 node scripts/version-assets.mjs 补上 css/js 的 ?v= 版本号
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const BASE = 'https://ai.toolboxes.top/';
const TODAY = '2026-09-06';

const dataCode = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
const { DEPARTMENTS, TOOLS } = new Function(dataCode + ';return {DEPARTMENTS, TOOLS};')();
const N = TOOLS.length;
const DEPT_BY_ID = Object.fromEntries(DEPARTMENTS.map(d => [d.id, d]));
const DEPT_COUNTS = {};
TOOLS.forEach(t => { DEPT_COUNTS[t.dept] = (DEPT_COUNTS[t.dept] || 0) + 1; });

const PRICING = { free: { label: "Free", cls: "free" }, freemium: { label: "Freemium", cls: "freemium" }, paid: { label: "Paid", cls: "paid" } };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const domainOf = url => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };

function toolCard(t) {
  const dept = DEPT_BY_ID[t.dept], p = PRICING[t.pricing], d = domainOf(t.url);
  return `
    <article class="tool-card">
      <button class="cart-add" data-tool="${esc(t.name)}" aria-label="Add to my list" title="Save to my list">+</button>
      <a class="tool-main" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">
        <div class="tool-head">
          <span class="tool-logo" style="--dept:${dept.color}">${esc(t.name.charAt(0))}
            <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64" alt="" loading="lazy" onerror="this.remove()">
          </span>
          <div class="tool-id">
            <h3>${esc(t.name)}${t.isNew ? ' <span class="new-pill">NEW</span>' : ""}</h3>
            <span class="pill ${p.cls}">${p.label}</span>
          </div>
        </div>
        <p class="tool-desc">${esc(t.desc)}</p>
      </a>
      <div class="tool-foot">
        <span class="dept-chip" style="--dept:${dept.color}">${dept.icon} ${esc(dept.name)}</span>
        <span class="visit" aria-hidden="true">Visit ↗</span>
      </div>
    </article>`;
}

// ---------- 1. index.html surgery (template-based, idempotent) ----------
// Derive template on first run: strip prerendered content back to <!-- JS --> markers.
const TEMPLATE = path.join(__dirname, 'index.template.html');
if (!fs.existsSync(TEMPLATE)) {
  let t = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  t = t.replace(/(<nav id="deptList"[^>]*>)[\s\S]*?(<\/nav>)/, '$1<!-- JS -->$2');
  t = t.replace(/(<div id="deptGrid"[^>]*>)[\s\S]*?(<\/div>)/, '$1<!-- JS -->$2');
  t = t.replace(/(<div id="featuredGrid"[^>]*>)[\s\S]*?(<\/div>\n    <\/div>\n  <\/section>)/, '$1<!-- JS -->$2');
  t = t.replace(/(<div id="toolGrid"[^>]*>)[\s\S]*?(<div id="emptyState")/, '$1<!-- JS -->\n        $2');
  t = t.replace(/(<div id="sampleChips"[^>]*>)[\s\S]*?(<\/div>)/, '$1<!-- JS -->$2');
  t = t.replace(/(<nav id="footerDepts"[^>]*>)[\s\S]*?(<\/nav>)/, '$1<!-- JS -->$2');
  t = t.replace(/  <!-- ================= FAQ ================= -->[\s\S]*?<!-- ================= BROWSE ALL ================= -->/,
    '  <!-- ================= BROWSE ALL ================= -->');
  fs.writeFileSync(TEMPLATE, t);
  console.log('template derived ->', TEMPLATE);
}
let idx = fs.readFileSync(TEMPLATE, 'utf8');

const deptList = `<a class="dept-item active" href="#all">
          <span class="dept-emoji">🏪</span><span class="dept-name">All Departments</span>
          <span class="dept-count">${N}</span></a>` +
  DEPARTMENTS.map(d => `
          <a class="dept-item" href="#${d.id}">
            <span class="dept-emoji">${d.icon}</span><span class="dept-name">${esc(d.name)}</span>
            <span class="dept-count">${DEPT_COUNTS[d.id] || 0}</span>
          </a>`).join('');
idx = idx.replace('aria-label="Filter by department"><!-- JS --></nav>', 'aria-label="Filter by department">' + deptList + '</nav>');

const deptGrid = `<a class="dept-card all-card" href="#all">
            <span class="dept-card-icon">🏪</span>
            <h3>All Departments</h3><span class="dept-card-count">${N} tools</span></a>` +
  DEPARTMENTS.map(d => `
          <a class="dept-card" href="departments/${d.id}.html" style="--dept:${d.color}">
            <span class="dept-card-icon">${d.icon}</span>
            <h3>${esc(d.name)}</h3>
            <span class="dept-card-count">${DEPT_COUNTS[d.id] || 0} tools</span>
          </a>`).join('');
idx = idx.replace('<div id="deptGrid" class="dept-grid"><!-- JS --></div>', '<div id="deptGrid" class="dept-grid">' + deptGrid + '</div>');

const featured = TOOLS.filter(t => t.featured);
idx = idx.replace('<div id="featuredGrid" class="featured-grid"><!-- JS --></div>', '<div id="featuredGrid" class="featured-grid">' + featured.map(toolCard).join('') + '</div>');
idx = idx.replace(/(<div id="toolGrid" class="tool-grid">)(?:<!-- JS -->[\s\S]*?)?(<div id="emptyState")/, `$1${TOOLS.map(toolCard).join('')}\n        $2`);

const freeTools = TOOLS.filter(t => t.pricing === 'free').slice(0, 10);
idx = idx.replace('<div id="sampleChips" class="sample-chips"><!-- JS --></div>',
  '<div id="sampleChips" class="sample-chips">' + freeTools.map(t => `<a class="sample-chip" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">${esc(t.name)}</a>`).join('') + '<a class="sample-more" href="#all" id="allFreeLink">see all free tools →</a></div>');

const popular = ["assistants", "marketing", "design", "dev", "video", "productivity", "ecommerce", "education"];
idx = idx.replace('<nav id="footerDepts" class="footer-links"><!-- JS --></nav>',
  '<nav id="footerDepts" class="footer-links">' + popular.filter(id => DEPT_BY_ID[id]).map(id => `<a href="departments/${id}.html">${DEPT_BY_ID[id].icon} ${esc(DEPT_BY_ID[id].name)}</a>`).join('') + '</nav>');

// numbers → real count (idempotent, always current N)
idx = idx.replace(/Browse \d+\+? hand-picked AI tools/, `Browse ${N} hand-picked AI tools`);
idx = idx.replace(/\d+\+? AI tools organized by industry/, `${N} AI tools organized by industry`);
idx = idx.replace(/(<strong id="statTools">)[^<]*(<\/strong>)/, `$1${N}+$2`);
idx = idx.replace(/(\d+)\+? hand-picked AI tools across 21 industries/, `${N} hand-picked AI tools across 21 industries`);
idx = idx.replace(/curated directory of <strong>\d+ AI tools<\/strong> across <strong>\d+ industries<\/strong>/,
  `curated directory of <strong>${N} AI tools</strong> across <strong>${DEPARTMENTS.length} industries</strong>`);

// og:image (only if missing)
if (!idx.includes('og:image')) {
  idx = idx.replace('<meta property="og:site_name" content="AI Supermarket">',
    `<meta property="og:site_name" content="AI Supermarket">
  <meta property="og:image" content="${BASE}og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:image" content="${BASE}og-image.png">`);
}

// JSON-LD → @graph with FAQPage + ItemList
const FAQ = [
  ["What is AI Supermarket?", `AI Supermarket is a free, hand-curated directory of ${N} AI tools organized into 21 industry departments — from marketing and design to law and healthcare. Every listing links to the tool's official website, so you can evaluate and start using it in one click.`],
  ["Is AI Supermarket free to use?", "Yes. Browsing, search and My List are completely free and need no account. Each tool card shows the tool's own pricing model — free, freemium or paid — so you know what to expect before you click through."],
  ["How are the tools selected?", "Every tool is hand-picked: we look for products that are popular in their industry, actively maintained and useful for real work. The catalog is reviewed regularly and dead links are removed."],
  ["What is \u201CMy List\u201D?", "My List is a simple shopping basket for AI tools. Tap the + button on any card to save it, then copy the whole list to share with your team. It is stored locally in your browser — no signup, no tracking."],
  ["How do I suggest a new tool?", "Use the Submit a tool button and tell us the tool's name, URL and what makes it great. If it fits our curation standards, we will stock it within days — free."],
];
const ldGraph = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', name: 'AI Supermarket', url: BASE,
      potentialAction: { '@type': 'SearchAction', target: BASE + '?q={search_term_string}', 'query-input': 'required name=search_term_string' } },
    { '@type': 'Organization', name: 'AI Supermarket', url: BASE, logo: { '@type': 'ImageObject', url: BASE + 'og-image.png' } },
    { '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    { '@type': 'ItemList', name: 'AI tools', numberOfItems: N,
      itemListElement: TOOLS.map((t, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Thing', name: t.name, description: t.desc, url: t.url } })) },
  ],
};
idx = idx.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,
  `<script type="application/ld+json">\n  ${JSON.stringify(ldGraph, null, 2).replace(/\n/g, '\n  ')}\n  </script>`);

// FAQ section before BROWSE ALL
const faqHtml = `
  <!-- ================= FAQ ================= -->
  <section class="section section-alt" id="faq">
    <div class="container">
      <div class="section-head"><h2>🛒 Shopper Questions</h2><span class="section-note">Everything you need to know before you browse</span></div>
${FAQ.map(([q, a]) => `      <details class="faq-item"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
    </div>
  </section>

  <!-- ================= BROWSE ALL ================= -->`;
idx = idx.replace('  <!-- ================= BROWSE ALL ================= -->', faqHtml);

// footer: about/privacy links
idx = idx.replace('<nav class="footer-links">\n          <a href="mailto:renhongtao2@gmail.com">Contact us</a>',
  `<nav class="footer-links">
          <a href="/about.html">About</a>
          <a href="/privacy.html">Privacy Policy</a>
          <a href="mailto:renhongtao2@gmail.com">Contact us</a>`);

fs.writeFileSync(path.join(ROOT, 'index.html'), idx);

// ---------- 2. department pages ----------
const INTROS = {
  assistants: "General-purpose AI assistants answer questions, draft documents, write code and analyze images in a single chat. This shelf covers the leading assistants — from ChatGPT and Claude to Google Gemini — with a quick note on what each is best at. Start here if you are new to AI tools.",
  writing: "Writing and content tools help you draft blog posts, ads, emails and social captions in minutes. The picks below cover long-form drafting, copywriting and editing, each with a clear pricing model so you can test before you commit.",
  marketing: "Marketing and SEO tools find keywords, generate ad copy, optimize content and track rankings. These picks are the ones working marketers actually keep in their stack — from research to campaign creation.",
  design: "Design and art tools turn a prompt into logos, illustrations, product shots and slide decks. Whether you need a quick social graphic or production-ready brand assets, the tools below cover every skill level.",
  video: "Video and audio tools generate voiceovers, edit footage, add captions and even produce full clips from a script. This shelf covers the tools that shorten a studio-sized job into an afternoon.",
  dev: "Software and development tools write, review and refactor code, explain errors and generate boilerplate. The picks below are daily drivers for professional developers — editors, copilots and agents.",
  productivity: "Productivity tools take notes, manage tasks, automate busywork and summarize meetings. The shelf below focuses on tools that quietly save an hour a day rather than add another tab to manage.",
  ecommerce: "E-commerce tools write product descriptions, generate store imagery and handle customer questions at scale. These picks integrate with the major store platforms and pay for themselves in saved hours.",
  sales: "Sales and CRM tools research leads, draft outreach and keep the pipeline up to date automatically. The tools below cover prospecting, sequencing and call analysis for modern sales teams.",
  support: "Customer support tools deflect tickets, draft replies and summarize conversations without losing the human touch. These picks plug into the help desks most teams already use.",
  hr: "HR and recruiting tools screen resumes, draft job descriptions and run interview scheduling. The picks below help lean teams hire like companies ten times their size.",
  finance: "Finance and accounting tools automate bookkeeping, forecasting, invoice processing and close workflows. These picks are built for accountants and finance teams who want the numbers to reconcile themselves.",
  legal: "Legal AI tools review contracts, draft agreements and surface risks in plain language. The picks below serve law firms and in-house teams — always with a human lawyer in the loop.",
  health: "Healthcare AI tools draft clinical notes, transcribe visits and streamline documentation so practitioners can focus on patients. These picks are built for clinical settings and compliance.",
  education: "Education tools build lesson plans, quizzes, flashcards and personalized tutoring sessions. The picks below serve teachers, students and course creators across every subject.",
  realestate: "Real estate tools write listings, stage photos virtually and qualify leads. These picks help agents and brokers move properties faster with less manual work.",
  data: "Data and analytics tools clean data, build dashboards and turn plain-English questions into charts. These picks make analysis self-serve for teams without a dedicated data department.",
  travel: "Travel tools plan itineraries, find deals and translate on the go. The picks below take the spreadsheet out of trip planning for both leisure and business travelers.",
  gaming: "Gaming tools generate assets, write game logic, moderate communities and enhance play. These picks serve indie developers and studios alike.",
  manufacturing: "Manufacturing AI tools predict maintenance, inspect quality and optimize production lines. These picks bring industrial AI to factories of every size.",
  agriculture: "Agriculture tools monitor crops, predict yields and detect disease from imagery. These picks bring precision farming within reach of every grower.",
};
fs.mkdirSync(path.join(ROOT, 'departments'), { recursive: true });
for (const d of DEPARTMENTS) {
  const tools = TOOLS.filter(t => t.dept === d.id);
  const others = DEPARTMENTS.filter(x => x.id !== d.id).slice(0, 8);
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'AI Supermarket', item: BASE },
        { '@type': 'ListItem', position: 2, name: d.name + ' AI Tools' }] },
      { '@type': 'CollectionPage', name: d.name + ' AI Tools', url: BASE + 'departments/' + d.id + '.html',
        mainEntity: { '@type': 'ItemList', numberOfItems: tools.length,
          itemListElement: tools.map((t, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Thing', name: t.name, description: t.desc, url: t.url } })) } },
    ],
  };
  const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(d.name)} AI Tools — ${tools.length} Hand-Picked Picks | AI Supermarket</title>
  <meta name="description" content="${tools.length} best AI tools for ${esc(d.name.toLowerCase())}, hand-picked and one click from their official sites: ${tools.slice(0, 3).map(t => esc(t.name)).join(', ')} and more.">
  <link rel="canonical" href="${BASE}departments/${d.id}.html">
  <meta property="og:title" content="${esc(d.name)} AI Tools | AI Supermarket">
  <meta property="og:description" content="${tools.length} hand-picked AI tools for ${esc(d.name.toLowerCase())}.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${BASE}departments/${d.id}.html">
  <meta property="og:image" content="${BASE}og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%2310b981%22/><text y=%22.72em%22 x=%2250%22 text-anchor=%22middle%22 font-size=%2255%22>🛒</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../css/style.css">
  <style>
    .dept-hero{max-width:1100px;margin:0 auto;padding:34px 20px 10px}
    .crumb{font-size:13px;opacity:.65;margin-bottom:14px}
    .crumb a{color:inherit}
    .dept-hero h1{font-size:30px;margin:6px 0 10px}
    .dept-hero p.intro{max-width:760px;opacity:.8;font-size:15px}
    .dept-tools{max-width:1100px;margin:18px auto 40px;padding:0 20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
    .other-depts{max-width:1100px;margin:0 auto 40px;padding:0 20px}
    .other-depts a{display:inline-block;margin:4px 10px 4px 0;padding:6px 12px;border:1px solid rgba(128,128,128,.3);border-radius:999px;text-decoration:none;font-size:13.5px;color:inherit}
    details.faq-item{border-bottom:1px solid rgba(128,128,128,.2);padding:10px 0}
    details.faq-item summary{cursor:pointer;font-weight:600}
    details.faq-item p{opacity:.75;font-size:14px;margin-top:8px}
  </style>
  <script type="application/ld+json">
  ${JSON.stringify(ld, null, 2).replace(/\n/g, '\n  ')}
  </script>
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

  <div class="dept-hero">
    <div class="crumb"><a href="/">AI Supermarket</a> / ${esc(d.name)}</div>
    <h1>${d.icon} ${esc(d.name)} AI Tools</h1>
    <p class="intro">${esc(INTROS[d.id])}</p>
    <p class="intro" style="font-size:13.5px;opacity:.6">Showing ${tools.length} tools · pricing: ${['free','freemium','paid'].filter(p => tools.some(t => t.pricing === p)).map(p => PRICING[p].label).join(' / ')} · every card links to the official website.</p>
  </div>

  <div class="dept-tools">
${tools.map(toolCard).join('\n')}
  </div>

  <div class="other-depts">
    <h2 style="font-size:18px;margin-bottom:10px">Browse other departments</h2>
    ${others.map(x => `<a href="${x.id}.html">${x.icon} ${esc(x.name)}</a>`).join('\n    ')}
    <a href="/">🏪 All ${N} tools</a>
  </div>

  <footer class="site-footer">
    <div class="container footer-bottom">
      <p>© 2026 <a href="/" style="color:inherit">AI Supermarket</a> · <a href="/about.html" style="color:inherit">About</a> · <a href="/privacy.html" style="color:inherit">Privacy Policy</a></p>
      <p class="footer-disclaimer">Independent directory — not affiliated with the tools listed. All trademarks belong to their respective owners.</p>
    </div>
  </footer>
</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, 'departments', d.id + '.html'), page);
}

// ---------- 3. about.html / privacy.html ----------
const about = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About | AI Supermarket</title>
  <meta name="description" content="What AI Supermarket is, how tools are curated, and how to suggest a new one.">
  <link rel="canonical" href="${BASE}about.html">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%2310b981%22/><text y=%22.72em%22 x=%2250%22 text-anchor=%22middle%22 font-size=%2255%22>🛒</text></svg>">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
  <style>
    .page{max-width:760px;margin:0 auto;padding:40px 20px 60px}
    .page h1{font-size:28px;margin-bottom:14px}
    .page h2{font-size:17px;margin:22px 0 8px}
    .page p{opacity:.82;margin:10px 0;line-height:1.7}
  </style>
</head>
<body id="top">
  <header class="site-header">
    <div class="container header-inner">
      <a class="logo" href="/"><svg class="logo-cart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1.6"/><circle cx="19" cy="21" r="1.6"/><path d="M2.5 3h2l2.4 12.2a2 2 0 0 0 2 1.6h9.2a2 2 0 0 0 2-1.6L22 7H6"/></svg><span>AI<em>Supermarket</em></span></a>
    </div>
  </header>
  <main class="page">
    <h1>About AI Supermarket</h1>
    <p>AI Supermarket is an independent, hand-curated directory of ${N} AI tools, organized into 21 industry "departments" so you can find the right tool the way you find groceries — by aisle. We link only to official websites: no affiliate redirects, no sign-up walls, no sponsored rankings dressed up as picks.</p>
    <h2>How tools are curated</h2>
    <p>Every tool on the shelves is hand-picked. We look for products that are widely used in their industry, actively maintained, and genuinely useful for real work — then write a one-line description of what it is actually for. The catalog is reviewed regularly; dead links and dead products are removed.</p>
    <h2>Submit a tool</h2>
    <p>Found something the shelves are missing (or built something yourself)? Use the <strong>Submit a tool</strong> button on the homepage. If it meets the curation bar, it gets stocked within days — free.</p>
    <h2>Contact</h2>
    <p>Reach us at <a href="mailto:renhongtao2@gmail.com">renhongtao2@gmail.com</a>.</p>
  </main>
  <footer class="site-footer">
    <div class="container footer-bottom">
      <p>© 2026 <a href="/" style="color:inherit">AI Supermarket</a> · <a href="/privacy.html" style="color:inherit">Privacy Policy</a></p>
      <p class="footer-disclaimer">Independent directory — not affiliated with the tools listed. All trademarks belong to their respective owners.</p>
    </div>
  </footer>
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, 'about.html'), about);

const privacy = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy | AI Supermarket</title>
  <meta name="description" content="Privacy policy for AI Supermarket: data collection, cookies, analytics and advertising.">
  <link rel="canonical" href="${BASE}privacy.html">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%2310b981%22/><text y=%22.72em%22 x=%2250%22 text-anchor=%22middle%22 font-size=%2255%22>🛒</text></svg>">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
  <style>
    .page{max-width:760px;margin:0 auto;padding:40px 20px 60px}
    .page h1{font-size:28px;margin-bottom:14px}
    .page h2{font-size:17px;margin:22px 0 8px}
    .page p{opacity:.82;margin:10px 0;line-height:1.7}
  </style>
</head>
<body id="top">
  <header class="site-header">
    <div class="container header-inner">
      <a class="logo" href="/"><svg class="logo-cart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1.6"/><circle cx="19" cy="21" r="1.6"/><path d="M2.5 3h2l2.4 12.2a2 2 0 0 0 2 1.6h9.2a2 2 0 0 0 2-1.6L22 7H6"/></svg><span>AI<em>Supermarket</em></span></a>
    </div>
  </header>
  <main class="page">
    <h1>Privacy Policy</h1>
    <p class="page" style="opacity:.6;font-size:13px">Last updated: ${TODAY}</p>
    <h2>What we collect</h2>
    <p>This site has no accounts, no forms and no login. It does not ask for or store personal information. Your "My List" basket is stored locally in your own browser and never leaves your device. Standard server logs (IP address, user agent, requested URL) are processed automatically by Cloudflare for security and availability.</p>
    <h2>Cookies</h2>
    <p>The site itself sets no cookies (your dark-mode and list preferences are kept in browser local storage). If advertising is displayed, Google, as a third-party vendor, may use cookies (including the DoubleClick DART cookie) to serve ads based on your prior visits to this and other websites. You can opt out of personalized advertising via <a href="https://www.google.com/settings/ads">Google Ads Settings</a> or <a href="https://www.aboutads.info">aboutads.info</a>.</p>
    <h2>External links</h2>
    <p>We link to third-party websites (the official sites of the tools listed). We are not responsible for their content or privacy practices.</p>
    <h2>Changes</h2>
    <p>This policy may be updated as the site evolves; material changes get a new "last updated" date above.</p>
    <h2>Contact</h2>
    <p>Questions? Email <a href="mailto:renhongtao2@gmail.com">renhongtao2@gmail.com</a>.</p>
  </main>
  <footer class="site-footer">
    <div class="container footer-bottom">
      <p>© 2026 <a href="/" style="color:inherit">AI Supermarket</a> · <a href="/about.html" style="color:inherit">About</a></p>
      <p class="footer-disclaimer">Independent directory — not affiliated with the tools listed. All trademarks belong to their respective owners.</p>
    </div>
  </footer>
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, 'privacy.html'), privacy);

// ---------- 4. llms.txt ----------
const llms = `# AI Supermarket

> A hand-curated directory of ${N} AI tools organized into 21 industry departments — from marketing and design to law and healthcare. Every listing links to the tool's official website with a one-line description and pricing model (free / freemium / paid). Free to browse, no account needed. Updated regularly.

## Pages

- [AI Supermarket](${BASE}): browse and search all AI tools by department
- [About](${BASE}about.html): curation policy and contact
- [Privacy Policy](${BASE}privacy.html)

## Departments

${DEPARTMENTS.map(d => `- [${d.name} AI Tools](${BASE}departments/${d.id}.html): ${DEPT_COUNTS[d.id]} hand-picked tools`).join('\n')}

## All tools (${N})

${TOOLS.map(t => `- [${t.name}](${t.url}): ${t.desc} [${PRICING[t.pricing].label}]`).join('\n')}
`;
fs.writeFileSync(path.join(ROOT, 'llms.txt'), llms);

// ---------- 5. sitemap.xml ----------
const urls = [
  [BASE, '1.0', 'daily'],
  ...DEPARTMENTS.map(d => [BASE + 'departments/' + d.id + '.html', '0.8', 'weekly']),
  [BASE + 'about.html', '0.3', 'monthly'],
  [BASE + 'privacy.html', '0.3', 'monthly'],
];
const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, p, f]) => `  <url><loc>${u}</loc><lastmod>${TODAY}</lastmod><changefreq>${f}</changefreq><priority>${p}</priority></url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sm);

console.log(`done: index prerendered (${N} tools) | ${DEPARTMENTS.length} dept pages | about+privacy | llms.txt | sitemap ${urls.length} urls`);
