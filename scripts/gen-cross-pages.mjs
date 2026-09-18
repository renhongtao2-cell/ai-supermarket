// gen-cross-pages.mjs — 跨类目页 + 重写 about
//
// 产出：
//   about.html                            重写（原来只有 168 词，且写着过期的 "203 AI tools"）
//   best/free-ai-tools.html               22 个真正免费的工具
//   best/ai-tools-with-free-tier.html     38 个有具体免费额度的工具（全站最独特的数据）
//   guides/how-to-choose-an-ai-tool.html  选型指南
//
// 站点外壳从 .workbuddy/backup-pre-consolidation/ 的旧页原样取，保证视觉一致。
// 运行：node scripts/gen-cross-pages.mjs
import fs from "fs";
import path from "path";
import { injectContentNav, CONTENT_LINKS } from "./site-nav.mjs";
import { UPDATED } from "./site-meta.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SITE = "https://ai.toolboxes.top";

const { DEPARTMENTS, TOOLS } = new Function(
  fs.readFileSync(path.join(ROOT, "js", "data.js"), "utf8") + "\n;return { DEPARTMENTS, TOOLS };"
)();
const FACTS = JSON.parse(
  fs.readFileSync(path.join(ROOT, ".workbuddy", "free-tier-facts.json"), "utf8")
).facts || {};

const deptName = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d.name]));
const deptIcon = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d.icon]));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pricingLabel = (p) => ({ free: "Free", freemium: "Freemium", paid: "Paid" }[p] || p);
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };
const link = (t) => `<a href="${esc(t.url)}" rel="nofollow noopener" target="_blank">${esc(t.name)}</a>`;

/* ---------- 外壳提取 ---------- */
function chrome(file) {
  const tpl = fs.readFileSync(path.join(ROOT, ".workbuddy", "backup-pre-consolidation", file), "utf8");
  const BODY_OPEN = '<body id="top">';
  const FOOT_OPEN = '  <footer class="site-footer">';
  const iBody = tpl.indexOf(BODY_OPEN), iFoot = tpl.indexOf(FOOT_OPEN);
  const iHdr = tpl.indexOf("</header>");
  if (iBody < 0 || iFoot < 0 || iHdr < 0) throw new Error("markers not found in " + file);
  return {
    HEAD: tpl.slice(0, iBody + BODY_OPEN.length),
    HEADER: tpl.slice(iBody + BODY_OPEN.length, iHdr + "</header>".length),
    FOOTER: tpl.slice(iFoot),
  };
}
const _nav = (c) => ({ ...c, FOOTER: injectContentNav(c.FOOTER) });
// 内容页入口注入页脚：生成时注入，不靠后处理（否则会被下次部署擦掉）
const DEPT_CHROME = _nav(chrome("departments/marketing.html"));
const ABOUT_CHROME = _nav(chrome("about.html"));

const EXTRA_CSS = `
    .hub{max-width:900px;margin:0 auto;padding:0 20px 10px}
    .hub h2{font-size:21px;margin:34px 0 10px}
    .hub h3{font-size:16.5px;margin:22px 0 6px}
    .hub p{opacity:.85;font-size:15.5px;line-height:1.75}
    .hub ul,.hub ol{opacity:.85;font-size:15.5px;line-height:1.75}
    .hub li{margin:7px 0}
    .hub a{color:inherit;text-decoration:underline;text-decoration-color:rgba(128,128,128,.45)}
    .hub a:hover{text-decoration-color:currentColor}
    .hub .panel{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.3);
      border-radius:12px;padding:15px 18px;margin:20px 0}
    .hub .panel h3{margin:0 0 8px;font-size:15.5px}
    .hub .panel ul{margin:0;padding-left:20px;font-size:15px}
    table.cmp{width:100%;border-collapse:collapse;margin:18px 0;font-size:14.5px;
      display:block;overflow-x:auto;white-space:nowrap}
    table.cmp th,table.cmp td{text-align:left;padding:9px 12px;
      border-bottom:1px solid rgba(128,128,128,.22);vertical-align:top}
    table.cmp th{font-weight:700;background:rgba(128,128,128,.08)}
    table.cmp td{white-space:normal}
    .stat-line{font-size:13.5px;opacity:.65}
    .page .hub{max-width:none;padding:0}
`;

/* ---------- 通用 head 重写 ---------- */
function rewriteHead(chromeObj, { title, desc, canonPath, jsonLd }) {
  let head = chromeObj.HEAD
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${SITE}${canonPath}">`)
    // GEO：每页都声明机器可读索引（幂等，缺失才补）
    .replace(/^([ \t]*)<link rel="canonical"[^>]*>$/m, (m, ind) =>
      /rel="alternate"[^>]*llms\.txt/.test(chromeObj.HEAD)
        ? m
        : `${m}\n${ind}<link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs.txt index for AI engines">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(desc)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${SITE}${canonPath}">`);
  if (chromeObj === DEPT_CHROME) {
    head = head.replace(/  <style>\n    \.dept-hero\{[\s\S]*?<\/style>/, `  <style>${EXTRA_CSS}  </style>`);
  } else {
    // about.html 自带 .page 样式，必须保留 —— 把我们的 CSS 追加进去，而不是替换
    head = head.replace(/(  <style>\n[\s\S]*?)(<\/style>)/, `$1${EXTRA_CSS}$2`);
  }
  head = head.replace(/  <script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `  <script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n  </script>`);
  return head;
}

const crumbs = (leafName, leafPath) => ({
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AI Supermarket", item: SITE + "/" },
    { "@type": "ListItem", position: 2, name: leafName, item: SITE + leafPath },
  ],
});

/* ---------- 页脚：所有部门 ---------- */
const otherDepts = (exclude) => `<div class="other-depts">
    <h2 style="font-size:18px;margin-bottom:10px">Browse departments</h2>
    ${DEPARTMENTS.filter((d) => d.id !== exclude).map((d) => `<a href="/departments/${d.id}">${d.icon} ${esc(d.name)}</a>`).join("\n    ")}
    <a href="/">🏪 All ${TOOLS.length} tools</a>
  </div>`;

/* 内容页互链：4 个内容页各自链向另外 3 个。
   清单从 site-nav.mjs 复用 —— 加新内容页只改那一处，不会出现两份清单对不上。 */
const relatedBlock = (selfPath) => `<div class="panel">
    <h3>Related</h3>
    <ul>${CONTENT_LINKS.filter((l) => l.href !== selfPath)
      .map((l) => `<li><a href="${l.href}">${esc(l.label)}</a> — ${esc(l.desc)}</li>`)
      .join("")}</ul>
  </div>`;

const hero = (h1, lead, statLine, summary) => `<div class="dept-hero">
    <div class="crumb"><a href="/">AI Supermarket</a> / ${esc(h1)}</div>
    <h1>${h1}</h1>
    <p class="intro">${lead}</p>
    ${statLine ? `<p class="intro stat-line">${statLine}</p>` : ""}
    ${summary ? `<details class="ai-summary" open id="ai-summary"><summary><strong>TL;DR for AI assistants &amp; search engines</strong></summary><p>${summary}</p></details>` : ""}
  </div>`;

/* ============================================================
   1. about.html —— 重写（原文 168 词 + 过期计数）
   ============================================================ */
const freeCount = TOOLS.filter((t) => t.pricing === "free").length;
const freeishCount = TOOLS.filter((t) => t.pricing !== "paid").length;
const quotaCount = TOOLS.filter((t) => FACTS[t.name] && FACTS[t.name].freeQuota).length;

const aboutBody = `<main class="page">
  <div class="hub">
    <h1 style="font-size:30px;margin:6px 0 12px">About AI Supermarket</h1>
    <p>AI Supermarket is an independent directory of <strong>${TOOLS.length} AI tools</strong>, organised into <strong>${DEPARTMENTS.length} departments</strong> so you can find what you need the way you find groceries — by aisle. Every entry links directly to the vendor's official website. There are no affiliate redirects, no sign-up walls, and no sponsored placements presented as recommendations.</p>

    <h2>What changed, and why</h2>
    <p>Earlier versions of this site had a separate page for every tool: a short description, a link, and little else. Those pages were thin — the same template with a different name in it — and thin pages are worth nothing to a reader and nothing to a search engine.</p>
    <p>The catalogue is now organised as <strong>${DEPARTMENTS.length} department guides</strong>. Each one covers what AI actually does in that field, how to choose between the options, a side-by-side comparison with real pricing, which tool fits which job, and the failure modes to watch for. Every tool still links to its official site; the difference is that the page around it is now worth reading.</p>

    <h2>How tools are chosen</h2>
    <ul>
      <li><strong>Widely used in their field.</strong> Not the newest launch — the products practitioners actually keep in their stack.</li>
      <li><strong>Actively maintained.</strong> Dead products and dead links are removed rather than left to rot.</li>
      <li><strong>Genuinely useful for real work.</strong> A tool that only works in a demo does not make the shelf.</li>
      <li><strong>Official links only.</strong> Every card goes to the vendor. We do not proxy, wrap or monetise the destination.</li>
    </ul>

    <h2>Where the pricing and free-tier data comes from</h2>
    <p>Pricing labels (free, freemium, paid) come from the vendor's own pricing page. For <strong>${quotaCount} tools</strong> we also record the concrete free allowance — the actual number, such as a monthly credit count or minute limit — rather than a vague claim that a free tier exists. Of ${TOOLS.length} tools, ${freeCount} are free to use outright and ${freeishCount} have some free tier.</p>
    <div class="panel">
      <h3>Why the specific numbers matter</h3>
      <p style="margin:0;font-size:15px">"Free tier available" tells you nothing. "2,000 minutes per month" tells you whether the tool can carry your actual workload. Vendors change these limits without notice, so every figure is dated and should be confirmed on the vendor's page before you build a process around it.</p>
    </div>

    <h2>What this site is not</h2>
    <ul>
      <li>It is not affiliated with any tool listed. All trademarks belong to their respective owners.</li>
      <li>It does not accept payment for placement or ranking.</li>
      <li>It is not professional advice. For legal, medical, financial or HR decisions, the department pages explain the regulatory context — and the answer in every one of them is that a qualified human remains responsible.</li>
    </ul>

    <h2>Corrections and submissions</h2>
    <p>Found a dead link, a wrong price, or a tool that belongs on a shelf? Use the <strong>Submit a tool</strong> button on the homepage, or write to <a href="mailto:renhongtao2@gmail.com">renhongtao2@gmail.com</a>. Pricing corrections are the most useful thing you can send — they go stale fastest.</p>

    <h2>How the site is funded</h2>
    <p>The directory is free to use and carries no accounts or paywalls. It is supported by advertising. Ads never influence which tools are listed, how they are ordered, or what the guides say — the curation is independent of the commercial arrangement, and that separation is the whole point of the site.</p>

    <p class="stat-line" style="margin-top:26px">Last reviewed ${UPDATED} · ${TOOLS.length} tools · ${DEPARTMENTS.length} departments</p>
  </div>
</main>
${otherDepts(null)}`;

fs.writeFileSync(
  path.join(ROOT, "about.html"),
  rewriteHead(ABOUT_CHROME, {
    title: `About — ${TOOLS.length} AI Tools, ${DEPARTMENTS.length} Departments | AI Supermarket`,
    desc: `How AI Supermarket is curated: ${TOOLS.length} AI tools across ${DEPARTMENTS.length} departments, official links only, no paid placement, and where the pricing and free-tier data comes from.`,
    canonPath: "/about",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        crumbs("About", "/about"),
        { "@type": "AboutPage", name: "About AI Supermarket", url: SITE + "/about", description: "Curation policy and data sources for the AI Supermarket directory." },
      ],
    },
  }) + "\n" + ABOUT_CHROME.HEADER + "\n" + aboutBody + "\n" + ABOUT_CHROME.FOOTER
);

/* ============================================================
   2. /best/free-ai-tools —— 22 个真正免费
   ============================================================ */
const freeTools = TOOLS.filter((t) => t.pricing === "free");
const freeByDept = {};
for (const t of freeTools) (freeByDept[t.dept] = freeByDept[t.dept] || []).push(t);

const freeBody = `${hero(
  "🧾 Genuinely Free AI Tools",
  `Not freemium, not a trial — <strong>${freeTools.length} tools</strong> that are free to use with no paid tier gating the core product. Each one is listed with the department it belongs to and a direct link to the vendor.`,
  `${freeTools.length} free tools · across ${Object.keys(freeByDept).length} departments · reviewed ${UPDATED}`,
  `<strong>${freeTools.length} AI tools that are free to use outright</strong> on AI Supermarket, including ${freeTools.slice(0, 5).map((t) => esc(t.name)).join(", ")}. "Free" here means the core product has no paid gate — distinct from freemium tools, which are listed separately at /best/ai-tools-with-free-tier. Machine-readable index: <a href="/llms.txt">/llms.txt</a>.`
)}
<div class="hub">
  <h2>What "free" means here</h2>
  <p>Most tools described as free are freemium: the useful part sits behind a subscription and the free plan exists to show you what you are missing. This page lists the other kind — products where the free version is the product.</p>
  <p>That usually means the business model is something other than software subscriptions. Ramp and Brex earn interchange on card spend. Zillow, Redfin, Expedia and Booking.com earn on transactions or advertising. Stable Diffusion is open source. OneSoil and Plantix are free because they feed a wider commercial business. None of them need you to upgrade.</p>

  <h2>The trade you are making</h2>
  <p>Free is not the same as costless, and it is worth being explicit about what you give up:</p>
  <ul>
    <li><strong>You are the product.</strong> Advertising and transaction models need your attention or your spend. That is a legitimate trade, but it is a trade.</li>
    <li><strong>Support is minimal.</strong> No subscription means no support contract and no account manager.</li>
    <li><strong>Features arrive later.</strong> Paid competitors ship capabilities first.</li>
    <li><strong>It can change.</strong> A free product can be discontinued or gated at any time, and you have no contractual protection. Do not build a critical process on one without a fallback.</li>
  </ul>

  <h2>The free tools, by department</h2>
  ${Object.entries(freeByDept)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([d, arr]) => `<h3>${deptIcon[d]} ${esc(deptName[d])}</h3>
  <ul>${arr.map((t) => `<li>${link(t)} — ${esc(t.desc)}</li>`).join("")}</ul>`)
    .join("\n  ")}

  <h2>Where free stops being enough</h2>
  <p>Free tools are genuinely sufficient for individuals and small teams. They stop working when you need one of four things: <strong>team accounts and permissions</strong>, <strong>an API or integration</strong>, <strong>support with a response time</strong>, or <strong>a data processing agreement</strong> for regulated work. Those are the four reasons people upgrade, and they are rarely about feature quality.</p>

  <div class="panel">
    <h3>Looking for a free tier rather than a free product?</h3>
    <p style="margin:0;font-size:15px">Many tools are freemium with a generous free allowance — ${quotaCount} of them publish a specific limit. See <a href="/best/ai-tools-with-free-tier">AI tools with a free tier, and what you actually get</a> for the concrete numbers.</p>
  </div>

  ${relatedBlock("/best/free-ai-tools")}

  <p class="stat-line" style="margin-top:26px">Reviewed ${UPDATED}. "Free" reflects the vendor's own pricing page at review time; free products can be changed or withdrawn. Independent directory — not affiliated with the tools listed.</p>
</div>
${otherDepts(null)}`;

fs.mkdirSync(path.join(ROOT, "best"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "best", "free-ai-tools.html"),
  rewriteHead(DEPT_CHROME, {
    title: `Genuinely Free AI Tools — ${freeTools.length} With No Paid Gate | AI Supermarket`,
    desc: `${freeTools.length} AI tools that are actually free to use — not trials and not freemium. Listed by department with official links and what you give up in exchange.`,
    canonPath: "/best/free-ai-tools",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        crumbs("Genuinely Free AI Tools", "/best/free-ai-tools"),
        {
          "@type": "CollectionPage",
          name: "Genuinely Free AI Tools",
          url: SITE + "/best/free-ai-tools",
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: freeTools.length,
            itemListElement: freeTools.map((t, i) => ({
              "@type": "ListItem", position: i + 1,
              item: { "@type": "SoftwareApplication", name: t.name, url: t.url, description: t.desc, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
            })),
          },
        },
      ],
    },
  }) + "\n" + DEPT_CHROME.HEADER + "\n" + freeBody + "\n" + DEPT_CHROME.FOOTER
);

/* ============================================================
   3. /best/ai-tools-with-free-tier —— 具体免费额度（独特数据）
   ============================================================ */
const quotaTools = TOOLS.filter((t) => FACTS[t.name] && FACTS[t.name].freeQuota);
const planTools = TOOLS.filter((t) => FACTS[t.name] && !FACTS[t.name].freeQuota && (FACTS[t.name].freePlan || FACTS[t.name].freeForever));

const quotaRows = quotaTools
  .map((t) => `<tr>
        <td>${link(t)}<br><span style="opacity:.6;font-size:12.5px">${esc(hostOf(t.url))}</span></td>
        <td><a href="/departments/${t.dept}">${deptIcon[t.dept]} ${esc(deptName[t.dept])}</a></td>
        <td>${pricingLabel(t.pricing)}</td>
        <td><strong>${esc(FACTS[t.name].freeQuota)}</strong></td>
      </tr>`).join("\n      ");

const planRows = planTools
  .map((t) => `<tr>
        <td>${link(t)}</td>
        <td><a href="/departments/${t.dept}">${deptIcon[t.dept]} ${esc(deptName[t.dept])}</a></td>
        <td>${FACTS[t.name].freeForever ? "Free tier, no time limit" : "Free plan available"}</td>
      </tr>`).join("\n      ");

const tierBody = `${hero(
  "🎁 AI Tools With a Free Tier — and What You Actually Get",
  `"Free tier" tells you nothing. For <strong>${quotaTools.length} tools</strong> we recorded the concrete allowance — the actual credits, minutes or projects — read from the vendor's own pricing page.`,
  `${quotaTools.length} tools with a specific free allowance · ${planTools.length} more with a free plan · reviewed ${UPDATED}`,
  `Concrete free-tier allowances for <strong>${quotaTools.length} AI tools</strong> on AI Supermarket, read from vendor pricing pages: for example ${quotaTools.slice(0, 3).map((t) => `${esc(t.name)} (${esc(FACTS[t.name].freeQuota)})`).join(", ")}. ${planTools.length} further tools have a free plan without a published figure. Machine-readable index: <a href="/llms.txt">/llms.txt</a>.`
)}
<div class="hub">
  <h2>Why the number is the only part that matters</h2>
  <p>Nearly every AI tool advertises a free tier. The claim is close to meaningless, because a free tier can mean five messages a month or ten thousand. What determines whether a tool can carry your actual work is the specific allowance, and that figure is usually buried in a pricing page rather than stated in the marketing.</p>
  <p>So we read it and recorded it. The table below is the allowance as published by each vendor at review time. Treat it as a starting point for evaluation, not a contract — limits change without notice, and vendors frequently adjust them when a model gets cheaper or more expensive to run.</p>

  <h2>How to read these numbers</h2>
  <ul>
    <li><strong>Credits are not comparable across vendors.</strong> A credit is whatever the vendor says it is. 1,000 credits might be ten generations or a thousand.</li>
    <li><strong>Monthly resets beat one-off allowances</strong> if you want to use a tool continuously. A one-time 50-credit grant runs out and does not come back.</li>
    <li><strong>"No time limit" is the strongest claim here.</strong> It means the free allowance renews indefinitely rather than expiring after a trial window.</li>
    <li><strong>Check what is excluded.</strong> Commercial use, watermark removal, API access and higher-resolution output are the features most often held back on free plans.</li>
    <li><strong>Watch the reset date.</strong> A monthly allowance consumed in the first week leaves you waiting three weeks.</li>
  </ul>

  <h2>Tools with a specific published free allowance</h2>
  <table class="cmp">
    <thead><tr><th>Tool</th><th>Department</th><th>Pricing</th><th>Free allowance</th></tr></thead>
    <tbody>
      ${quotaRows}
    </tbody>
  </table>

  <h2>Further tools with a free plan</h2>
  <p>These vendors state that a free plan exists but do not publish a concrete figure on their pricing page. We record the claim rather than invent a number to fill the cell.</p>
  <table class="cmp">
    <thead><tr><th>Tool</th><th>Department</th><th>Free plan</th></tr></thead>
    <tbody>
      ${planRows}
    </tbody>
  </table>

  <div class="panel">
    <h3>Free outright beats free tier</h3>
    <p style="margin:0;font-size:15px">If you would rather not manage an allowance at all, ${freeTools.length} tools in this directory are free with no paid gate. See <a href="/best/free-ai-tools">genuinely free AI tools</a>.</p>
  </div>

  <div class="panel">
    <h3>Comparing two of these numbers? Read the units first</h3>
    <p style="margin:0;font-size:15px">The table above is a list, not a comparison — 500 credits and 500 minutes are not the same thing. See the <a href="/best/free-tier-comparison">like-for-like free tier comparison</a>, which groups these ${quotaTools.length} allowances by what the unit actually measures and by how each one renews.</p>
  </div>

  <h2>When a free tier is the wrong choice</h2>
  <p>Free tiers are designed to convert you, which means they are usually fine for evaluation and awkward for production. Three signals that you have outgrown one: you are rationing usage and therefore avoiding the tool, the allowance resets at a moment that does not match your workflow, or you need an API key for automation. At that point the paid plan is cheaper than the workaround.</p>

  ${relatedBlock("/best/ai-tools-with-free-tier")}

  <p class="stat-line" style="margin-top:26px">Allowances read from vendor pricing pages and reviewed ${UPDATED}. Vendors change limits without notice — confirm before committing a workflow. Independent directory — not affiliated with the tools listed.</p>
</div>
${otherDepts(null)}`;

fs.writeFileSync(
  path.join(ROOT, "best", "ai-tools-with-free-tier.html"),
  rewriteHead(DEPT_CHROME, {
    title: `AI Tools With a Free Tier — ${quotaTools.length} Actual Allowances | AI Supermarket`,
    desc: `The concrete free allowance for ${quotaTools.length} AI tools — credits, minutes and projects read from vendor pricing pages — plus ${planTools.length} more with a free plan.`,
    canonPath: "/best/ai-tools-with-free-tier",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        crumbs("AI Tools With a Free Tier", "/best/ai-tools-with-free-tier"),
        {
          "@type": "CollectionPage",
          name: "AI Tools With a Free Tier",
          url: SITE + "/best/ai-tools-with-free-tier",
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: quotaTools.length,
            itemListElement: quotaTools.map((t, i) => ({
              "@type": "ListItem", position: i + 1,
              item: { "@type": "SoftwareApplication", name: t.name, url: t.url, description: t.desc },
            })),
          },
        },
      ],
    },
  }) + "\n" + DEPT_CHROME.HEADER + "\n" + tierBody + "\n" + DEPT_CHROME.FOOTER
);

/* ============================================================
   3b. /best/free-tier-comparison —— 同类额度横向对比
   ------------------------------------------------------------
   为什么单独做一页：36 条额度单位五花八门（credits / minutes / characters /
   requests / orders…），平铺在一张表里根本没法比 —— 500 credits 和 500 minutes
   不可比。这一页按「单位族」分组，让同类只跟同类站一起；
   再按「续期方式」切一刀（能不能重置比数字大小更决定可用性）。
   数据全部来自 free-tier-facts.json 的 freeQuota，未经改写的原值照录。
   ============================================================ */

/* 单位族：先取「主单位」再归族。
   ⚠️ 不能用「字符串里出现哪个单位词」来判定 —— 实测会错：
   Originality.ai 的值是 "3 AI scans per day (up to 2,000 words each)"，
   括号里的次要单位 "words" 会把它劫持到「文本量」族，而它真正的主单位是 scans。
   所以只认**数字后第一个出现的单位词**。 */
const UNIT_RE = /\b(credits?|tokens?|characters?|words?|minutes?|hours?|requests?|searches?|messages?|orders?|emails?|projects?|scans?|videos?|tasks?|interactions?|conversations?|spaces?|completions?)\b/i;
const FAMILY_OF_UNIT = {
  credit: "credits", token: "credits",
  minute: "time", hour: "time",
  character: "text", word: "text",
  request: "turns", search: "turns", message: "turns", interaction: "turns",
  conversation: "turns", completion: "turns", scan: "turns",
  order: "objects", email: "objects", task: "objects", project: "objects",
  video: "objects", space: "objects",
};
const unitOf = (v) => {
  const m = v.match(UNIT_RE);
  return m ? m[1].toLowerCase().replace(/s$/, "") : null;
};
const familyOf = (v) => FAMILY_OF_UNIT[unitOf(v)] || "other";

const FAMILIES = [
  {
    id: "credits", title: "Credits and points",
    blurb: "Vendor-defined units. A credit is whatever the vendor says it is — on one platform 1,000 credits is ten generations, on another it is a thousand. Compare these against each other, never against minutes or words.",
  },
  {
    id: "time", title: "Time",
    blurb: "Minutes of audio or video the free tier will process. This is the most directly comparable family on the page, because a minute is a minute.",
  },
  {
    id: "text", title: "Text volume",
    blurb: "Words and characters. Useful for writing tools where the limit is the amount of copy you can put through, not the number of actions you can take.",
  },
  {
    id: "turns", title: "Requests and turns",
    blurb: "API calls, search requests, chat exchanges and scanned items. These bound how much automation or conversation you get, and they are usually the limit that bites first in production.",
  },
  {
    id: "objects", title: "Outputs and objects",
    blurb: "Finished items — videos, projects, processed orders, analysed emails. The limit is stated in the unit of the work itself, which makes it the easiest family to reason about.",
  },
];

/* 续期方式：决定「能不能长期靠它干活」，比数字大小更关键 */
const PERIODS = {
  month:       { rank: 1, label: "Resets monthly",        note: "The only kind you can build a habit on." },
  day:         { rank: 2, label: "Resets daily",          note: "Small but frequent — good for steady light use." },
  forever:     { rank: 3, label: "No time limit",         note: "Does not expire, but does not refill either." },
  lifetime:    { rank: 4, label: "One-off, never expires",note: "A fixed grant with no expiry date." },
  "one-time":  { rank: 5, label: "One-off grant",         note: "Runs out and does not come back." },
  trial:       { rank: 6, label: "Trial only",            note: "Ends on a clock, not on usage." },
  unspecified: { rank: 7, label: "Renewal not stated",    note: "The vendor does not say whether or how it renews." },
};

function periodOf(v) {
  if (/one-time/i.test(v)) return "one-time";
  if (/lifetime/i.test(v)) return "lifetime";
  if (/free forever|no time limit/i.test(v)) return "forever";
  if (/trial/i.test(v)) return "trial";
  if (/per month|monthly/i.test(v)) return "month";
  if (/per day|daily/i.test(v)) return "day";
  return "unspecified";
}
const qtyOf = (v) => parseFloat(((v.match(/[\d][\d,]*/) || ["0"])[0]).replace(/,/g, "")) || 0;

const quotaParsed = quotaTools.map((t) => {
  const raw = FACTS[t.name].freeQuota;
  return { tool: t, raw, fam: familyOf(raw), unit: unitOf(raw), period: periodOf(raw), qty: qtyOf(raw) };
});

const byFam = Object.fromEntries(FAMILIES.map((f) => [f.id, quotaParsed.filter((q) => q.fam === f.id)]));
const byPeriod = {};
for (const q of quotaParsed) byPeriod[q.period] = (byPeriod[q.period] || 0) + 1;

// 自检：归不了族的额度说明 UNIT_RE / FAMILY_OF_UNIT 需要补词。
// 不能静默丢掉 —— 否则新加一条额度时它会从页面上凭空消失，没人会发现。
{
  const orphans = quotaParsed.filter((q) => q.fam === "other");
  if (orphans.length) {
    console.warn(`⚠ ${orphans.length} 条额度未归入单位族（请补 UNIT_RE / FAMILY_OF_UNIT）：`);
    orphans.forEach((q) => console.warn(`    ${q.tool.name} = ${q.raw}`));
  }
  const sum = FAMILIES.reduce((n, f) => n + byFam[f.id].length, 0);
  if (sum !== quotaParsed.length) {
    throw new Error(`单位族行数合计 ${sum} ≠ 额度总数 ${quotaParsed.length} —— 有额度会从页面上消失`);
  }
}

// 每族内：先按续期排序（月度最优先），再按数量从大到小 —— 同类同续期才真正可比
const famRows = (id) =>
  (byFam[id] || [])
    .slice()
    .sort((a, b) => PERIODS[a.period].rank - PERIODS[b.period].rank || b.qty - a.qty)
    .map((q) => `<tr>
        <td>${link(q.tool)}<br><span style="opacity:.6;font-size:12.5px">${esc(hostOf(q.tool.url))}</span></td>
        <td><a href="/departments/${q.tool.dept}">${deptIcon[q.tool.dept]} ${esc(deptName[q.tool.dept])}</a></td>
        <td><strong>${esc(q.raw)}</strong></td>
        <td>${PERIODS[q.period].label}</td>
      </tr>`)
    .join("\n      ");

// 每族的「同类里给得最多」—— 只在可续期的档里挑（一次性/trial 不参与，否则会误导）
const famLeader = (id) => {
  const pool = (byFam[id] || []).filter((q) => q.period === "month" || q.period === "day");
  if (pool.length < 2) return null;
  const best = pool.slice().sort((a, b) => b.qty - a.qty)[0];
  return best;
};

const famTables = FAMILIES.map((f) => {
  const rows = famRows(f.id);
  if (!rows) return "";
  const lead = famLeader(f.id);
  const leadLine = lead
    ? `<p class="stat-line">Highest recurring allowance in this family: <strong>${esc(lead.tool.name)}</strong> — ${esc(lead.raw)}.</p>`
    : "";
  return `<h2>${esc(f.title)} <span style="font-weight:400;opacity:.6;font-size:15px">${byFam[f.id].length} tools</span></h2>
  <p>${esc(f.blurb)}</p>
  ${leadLine}
  <table class="cmp">
    <thead><tr><th>Tool</th><th>Department</th><th>Free allowance</th><th>Renewal</th></tr></thead>
    <tbody>
      ${rows}
    </tbody>
  </table>`;
}).join("\n\n  ");

// 续期方式汇总表
const periodRows = Object.entries(PERIODS)
  .filter(([k]) => byPeriod[k])
  .sort((a, b) => a[1].rank - b[1].rank)
  .map(([k, p]) => `<tr>
        <td><strong>${p.label}</strong></td>
        <td>${byPeriod[k]}</td>
        <td>${esc(p.note)}</td>
      </tr>`)
  .join("\n      ");

const recurring = quotaParsed.filter((q) => q.period === "month" || q.period === "day").length;
const oneOff = quotaParsed.filter((q) => q.period === "one-time" || q.period === "lifetime" || q.period === "forever").length;
const trialOnly = quotaParsed.filter((q) => q.period === "trial").length;

// 按部门：同一用途里谁给得最多
const deptGroups = {};
for (const q of quotaParsed) (deptGroups[q.tool.dept] = deptGroups[q.tool.dept] || []).push(q);
const deptRows = Object.entries(deptGroups)
  .sort((a, b) => b[1].length - a[1].length)
  .map(([d, arr]) => `<tr>
        <td><a href="/departments/${d}">${deptIcon[d]} ${esc(deptName[d])}</a></td>
        <td>${arr.length}</td>
        <td>${arr.map((q) => `${esc(q.tool.name)} <span style="opacity:.7">(${esc(q.raw)})</span>`).join(" · ")}</td>
      </tr>`)
  .join("\n      ");

const cmpBody = `${hero(
  "⚖️ Free Tier Comparison — Like-for-Like, Not a List",
  `A flat list of free allowances is not a comparison. <strong>500 credits and 500 minutes are not the same thing</strong>, and a one-off grant is not a monthly reset. So we grouped the <strong>${quotaParsed.length} allowances</strong> we recorded by what the unit actually measures, then split each group by how it renews.`,
  `${quotaParsed.length} allowances · ${FAMILIES.length} unit families · ${recurring} renew on a schedule · reviewed ${UPDATED}`,
  `A like-for-like comparison of ${quotaParsed.length} AI tool free tiers on AI Supermarket, grouped by unit family (credits, time, text volume, requests, outputs) and by renewal (monthly, daily, one-off, trial). ${recurring} of the ${quotaParsed.length} allowances reset on a schedule; ${oneOff} are one-off or non-expiring grants; ${trialOnly} are trial-only. Machine-readable index: <a href="/llms.txt">/llms.txt</a>.`
)}
<div class="hub">
  <h2>Why grouping by unit is the whole point</h2>
  <p>The most common mistake when reading free-tier tables is comparing the numbers. A tool offering "10,000 credits" looks ten times more generous than one offering "1,000 credits" — until you find out that the first tool charges 200 credits per generation and the second charges 5. The unit is vendor-invented, and it is deliberately not standardised, because a bespoke unit makes it harder to compare against a competitor.</p>
  <p>Where a unit is objective — minutes of audio, words of text, API requests — the comparison is real and you can trust it. Where it is vendor-defined — credits, points, tokens — the number tells you almost nothing on its own, and the honest thing to do is show it next to its family so at least the incomparability is visible rather than hidden.</p>
  <p>So this page does not rank the ${quotaParsed.length} tools into a single "best free tier" list, because that ranking would be meaningless. It groups them so that the only rows sitting side by side are ones that can actually be judged against each other.</p>

  <h2>The second axis: does it come back?</h2>
  <p>How an allowance renews matters more than how large it is. A small monthly allowance supports a habit; a large one-off grant supports a single project and then leaves you stranded. Of the ${quotaParsed.length} allowances recorded here, <strong>${recurring} reset on a schedule</strong> (monthly or daily), <strong>${oneOff} are one-off or non-expiring grants</strong>, and <strong>${trialOnly} are trial-only</strong>.</p>
  <table class="cmp">
    <thead><tr><th>Renewal</th><th>Tools</th><th>What it means in practice</th></tr></thead>
    <tbody>
      ${periodRows}
    </tbody>
  </table>
  <div class="panel">
    <h3>The one-line rule</h3>
    <p style="margin:0;font-size:15px">If you intend to use a tool continuously, only the <strong>${recurring} allowances that reset</strong> are candidates. A one-off grant is a demo with extra steps, however large the number looks.</p>
  </div>

  ${famTables}

  <h2>By category — what is on offer within one kind of work</h2>
  <p>Unit families answer "can I compare these two numbers". Categories answer a different question: "I need a tool for this kind of work, what does each free tier give me". Both views are on this page because they are useful at different moments in the same decision.</p>
  <table class="cmp">
    <thead><tr><th>Department</th><th>Tools with a stated allowance</th><th>Allowances</th></tr></thead>
    <tbody>
      ${deptRows}
    </tbody>
  </table>

  <h2>What this page deliberately does not do</h2>
  <ul>
    <li><strong>It does not declare a winner.</strong> A winner across incompatible units would be an invention, not a finding.</li>
    <li><strong>It does not normalise the numbers.</strong> Multiplying a daily allowance by thirty to manufacture a monthly figure would put a number on the page that no vendor ever published.</li>
    <li><strong>It does not fill the gaps.</strong> Tools whose vendors state a free plan but publish no figure are listed on the <a href="/best/ai-tools-with-free-tier">free-tier page</a> without a number, rather than with a guess.</li>
    <li><strong>It does not carry a "commercial use" column.</strong> That answer is per-plan and per-jurisdiction, and reading it off a marketing page reliably produces errors. Check the licence attached to the plan you are actually on.</li>
  </ul>

  <h2>Before you rely on any of these numbers</h2>
  <p>Free tiers are the part of a pricing page most likely to change without notice, because they are a marketing lever rather than a revenue line. Every figure here was read from the vendor's own pricing page and reviewed ${UPDATED}; several were re-fetched to confirm, because cached copies go stale. Treat this as a starting point for your own check, not as a contract — and when a number decides your choice, open the vendor's pricing page yourself before you commit.</p>

  <div class="panel">
    <h3>Where these numbers come from</h3>
    <p style="margin:0;font-size:15px">Every allowance on this page was read from the vendor's published pricing page, not inferred. Vendors that state a free plan without publishing a figure are recorded as such. Full list: <a href="/best/ai-tools-with-free-tier">AI tools with a free tier</a>.</p>
  </div>

  ${relatedBlock("/best/free-tier-comparison")}

  <p class="stat-line" style="margin-top:26px">Allowances read from vendor pricing pages and reviewed ${UPDATED}. Vendors change limits without notice — confirm before committing a workflow. Independent directory — not affiliated with the tools listed.</p>
</div>
${otherDepts(null)}`;

fs.writeFileSync(
  path.join(ROOT, "best", "free-tier-comparison.html"),
  rewriteHead(DEPT_CHROME, {
    title: `Free Tier Comparison — ${quotaParsed.length} AI Allowances, Grouped by Unit | AI Supermarket`,
    desc: `A like-for-like comparison of ${quotaParsed.length} AI tool free tiers: grouped by unit family (credits, minutes, words, requests, outputs) and by renewal — monthly, daily, one-off or trial.`,
    canonPath: "/best/free-tier-comparison",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        crumbs("Free Tier Comparison", "/best/free-tier-comparison"),
        {
          "@type": "CollectionPage",
          name: "Free Tier Comparison",
          url: SITE + "/best/free-tier-comparison",
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: quotaParsed.length,
            itemListElement: quotaParsed.map((q, i) => ({
              "@type": "ListItem", position: i + 1,
              item: { "@type": "SoftwareApplication", name: q.tool.name, url: q.tool.url, description: q.tool.desc },
            })),
          },
        },
      ],
    },
  }) + "\n" + DEPT_CHROME.HEADER + "\n" + cmpBody + "\n" + DEPT_CHROME.FOOTER
);

/* ============================================================
   4. /guides/how-to-choose-an-ai-tool
   ============================================================ */
const guideBody = `${hero(
  "🧭 How to Choose an AI Tool Without Wasting Money",
  `Most AI subscriptions are bought on a demo and cancelled three months later. These are the questions that actually predict whether a tool survives contact with your real work.`,
  `Applies to all ${TOOLS.length} tools in this directory · reviewed ${UPDATED}`,
  `A buying guide for AI tools: evaluate on your own task, check the data terms before the features, model the real cost of the pricing unit, and treat free tiers as evaluation rather than production. Applies to all ${TOOLS.length} tools listed on AI Supermarket.`
)}
<div class="hub">
  <h2>1. Test on your own work, not the demo</h2>
  <p>Every AI product is demonstrated on a task it was tuned for. The only evaluation that predicts anything is running it on your actual input — your documents, your codebase, your language, your edge cases.</p>
  <p>Pick three real examples: one typical, one hard, and one you already know the correct answer to. The third is the most important, because it is the only way to catch a tool that is fluent and wrong. If you cannot get a trial on your own data, that is itself the answer.</p>

  <h2>2. Ask where your data goes before you look at the features</h2>
  <p>This is the question that disqualifies tools fastest, and it is usually answered on a page nobody reads. Four things to establish:</p>
  <ul>
    <li><strong>Is your input used for training?</strong> Many consumer tiers say yes by default. Business tiers usually say no.</li>
    <li><strong>How long is it retained?</strong> "We delete it" means little without a period attached.</li>
    <li><strong>Where is it processed?</strong> Relevant if you have data-residency obligations.</li>
    <li><strong>Is there a processing agreement?</strong> If you handle personal data belonging to other people, you need one.</li>
  </ul>
  <p>If the answers are not published, assume the least favourable reading. A vendor that will not state its data terms has told you something.</p>

  <h2>3. Model the real cost, not the sticker price</h2>
  <p>AI pricing units are deliberately hard to compare. Before committing, work out what one month of your actual usage costs:</p>
  <ul>
    <li><strong>Per seat</strong> multiplies with your team and punishes sharing.</li>
    <li><strong>Per credit</strong> is unpredictable unless you know how many credits your work consumes. Test that first — the variance is usually large.</li>
    <li><strong>Per word or per minute</strong> scales with output, which is exactly the thing that grows when the tool works.</li>
    <li><strong>Per outcome</strong> looks expensive and is often the cheapest, because you pay only when it delivers.</li>
  </ul>
  <p>The trap is a cheap unit price on a unit you will consume far more of than you expect.</p>

  <h2>4. Treat a free tier as an evaluation, not a plan</h2>
  <p>Free tiers exist to create a habit and then interrupt it. That is a rational business model, not a trick — but it means building a production process on one is a bet that the limits will not change. They change regularly.</p>
  <p>Use the free allowance to run your three test cases, then decide. ${quotaCount} tools in this directory publish their exact free allowance, which makes that evaluation faster — see <a href="/best/ai-tools-with-free-tier">what you actually get for free</a>.</p>

  <h2>5. Check the exit before you enter</h2>
  <p>The cost of an AI tool is not the subscription; it is the subscription plus the work of leaving. Ask how you get your data out and in what format. If the answer involves exporting from a proprietary store you cannot query, the switching cost is the real price.</p>
  <p>This matters most for anything that accumulates your content — transcripts, generated assets, knowledge bases, automation workflows. A tool you cannot leave cheaply is a tool that will raise its price.</p>

  <h2>6. Ignore benchmarks and leaderboards</h2>
  <p>Public model rankings reshuffle monthly, measure tasks you do not have, and say nothing about the interface, the integration or the data terms — which is where most of your experience will actually come from.</p>
  <p>It is also worth remembering that capability differences between the leading models are small relative to the differences between a tool that fits your workflow and one that does not.</p>

  <h2>7. Decide whether you need a specialist at all</h2>
  <p>General assistants now do a competent version of a great many narrow tasks. A specialist tool has to justify itself with something a general assistant cannot provide: access to live data, workflow integration, a compliance posture, or output that is consistently in your brand's voice.</p>
  <p>If you cannot name which of those four you are buying, you are probably buying a general assistant with a narrower interface. That is not always wrong — but it should be a decision, not a default.</p>

  <h2>8. Plan for the failure mode</h2>
  <p>Every tool in this directory fails in a characteristic way, and each department page documents the specific ones. The general pattern is worth internalising: AI tools fail <em>confidently</em>. A wrong answer reads exactly like a right one, which means the review step is not optional and cannot be skipped when you are busy.</p>
  <p>Ask, before you buy: who checks the output, and what happens when nobody has time? If the answer is "nobody", the tool is not ready for that workflow.</p>

  <div class="panel">
    <h3>Start from a department</h3>
    <p style="margin:0;font-size:15px">Each of the ${DEPARTMENTS.length} department guides applies these questions to a specific field, with the tools compared side by side and the domain-specific pitfalls listed. <a href="/">Browse all departments</a>.</p>
  </div>

  ${relatedBlock("/guides/how-to-choose-an-ai-tool")}

  <p class="stat-line" style="margin-top:26px">Reviewed ${UPDATED}. This guide is general information, not professional advice — for legal, medical, financial or HR decisions the regulatory context on each department page applies. Independent directory — not affiliated with the tools listed.</p>
</div>
${otherDepts(null)}`;

fs.mkdirSync(path.join(ROOT, "guides"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "guides", "how-to-choose-an-ai-tool.html"),
  rewriteHead(DEPT_CHROME, {
    title: "How to Choose an AI Tool Without Wasting Money | AI Supermarket",
    desc: "A practical guide to evaluating AI tools: test on your own data, check the data terms before the features, model the real cost of the pricing unit, and plan for how it fails.",
    canonPath: "/guides/how-to-choose-an-ai-tool",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        crumbs("How to Choose an AI Tool", "/guides/how-to-choose-an-ai-tool"),
        {
          "@type": "TechArticle",
          headline: "How to Choose an AI Tool Without Wasting Money",
          url: SITE + "/guides/how-to-choose-an-ai-tool",
          inLanguage: "en",
          description: "Evaluating AI tools: own-data testing, data terms, true cost of the pricing unit, exit cost, and failure planning.",
        },
      ],
    },
  }) + "\n" + DEPT_CHROME.HEADER + "\n" + guideBody + "\n" + DEPT_CHROME.FOOTER
);

/* ============================================================
   5. privacy.html —— 重写（原 173 词，且写着 "if advertising is displayed"，
      现在 AdSense 是确定的，披露必须确定；AdSense 审批要求这些条款）
   ============================================================ */
const privacyBody = `<main class="page">
  <div class="hub">
    <h1 style="font-size:30px;margin:6px 0 12px">Privacy Policy</h1>
    <p class="stat-line">Last updated ${UPDATED}. This policy covers ai.toolboxes.top only.</p>

    <h2>The short version</h2>
    <p>There are no accounts, no sign-up forms and no user profiles. We do not ask for your name, email address or any other personal detail, and we have no database of visitors to sell, lose or leak. The only third party that receives data about your visit is our advertising and infrastructure provider, and this page explains exactly what that means.</p>

    <h2>What we collect</h2>
    <p><strong>Nothing that identifies you.</strong> The site has no login, no contact form and no newsletter. Your "My List" basket and your light/dark preference are stored in your own browser's local storage and never transmitted anywhere — clearing your browser data removes them permanently.</p>
    <p><strong>Server logs.</strong> Like any website, requests pass through our host, Cloudflare, which processes standard technical data — IP address, user agent, requested URL and timestamp — for security, abuse prevention and availability. This is routine infrastructure logging, not profiling.</p>
    <p><strong>Outbound clicks.</strong> When you click through to a tool, you leave this site. The destination site's own privacy policy applies from that moment, and we have no visibility into what you do there.</p>

    <h2>Cookies and advertising</h2>
    <p>This site is supported by advertising served through <strong>Google AdSense</strong>. That has specific consequences you should know about:</p>
    <ul>
      <li>Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website and other websites.</li>
      <li>Google's use of advertising cookies enables it and its partners to serve ads to you based on your visits to this site and/or other sites on the internet.</li>
      <li>These cookies may include the DoubleClick DART cookie and similar identifiers used for ad delivery, frequency capping and measurement.</li>
      <li>We do not control these cookies, and we cannot read them. They are set by Google and its advertising partners, not by us.</li>
    </ul>
    <p><strong>How to opt out.</strong> You can opt out of personalised advertising by visiting <a href="https://www.google.com/settings/ads" rel="nofollow noopener" target="_blank">Google Ads Settings</a>, or opt out of third-party vendor cookies for personalised advertising at <a href="https://www.aboutads.info/choices/" rel="nofollow noopener" target="_blank">aboutads.info</a>. For details of how Google uses data from sites that use its services, see <a href="https://policies.google.com/technologies/partner-sites" rel="nofollow noopener" target="_blank">How Google uses information from sites that use our services</a>.</p>

    <h2>Consent, and visitors in the EEA, UK and Switzerland</h2>
    <p>Where the law requires it, a consent message is shown before any advertising cookies are set, and you can change or withdraw your choice at any time. If you decline personalised advertising, non-personalised ads may still be shown — these rely on contextual information rather than a profile of your browsing. Visitors in the European Economic Area, the United Kingdom and Switzerland are shown a consent message from a Google-certified consent management platform.</p>

    <h2>Your rights</h2>
    <p>Data protection law in several jurisdictions — including the GDPR and UK GDPR, and consumer privacy statutes in various US states — gives you rights of access, correction, deletion, portability and objection in relation to personal data held about you.</p>
    <p>We hold no personal data about you, so in practice there is nothing for us to retrieve or erase: we have no account to look up and no visitor record to delete. Requests about advertising data should be directed to Google, since that data is held by them and not by us. If you have a question about this policy, write to <a href="mailto:renhongtao2@gmail.com">renhongtao2@gmail.com</a> and we will answer it.</p>

    <h2>Data retention</h2>
    <p>We retain no personal data, because we collect none. Technical server logs held by our hosting provider are retained for the short period needed for security and operational purposes and then discarded. Advertising data is retained by Google under its own retention policies.</p>

    <h2>External links</h2>
    <p>Every tool listing links to a third-party website. Those sites are not covered by this policy and we are not responsible for their content, their cookies or their privacy practices. We recommend reading the privacy policy of any service before creating an account or entering payment details.</p>

    <h2>Children</h2>
    <p>This site is a directory of business and productivity software and is not directed at children. We do not knowingly collect information from children, and there is no mechanism on this site through which a child could submit personal information.</p>

    <h2>Changes to this policy</h2>
    <p>This policy may be updated as the site evolves — for example if the advertising arrangements change. Material changes are reflected in the "last updated" date at the top of this page. Continuing to use the site after a change means you accept the updated policy.</p>

    <h2>Contact</h2>
    <p>Questions about this policy, or about anything on the site: <a href="mailto:renhongtao2@gmail.com">renhongtao2@gmail.com</a>.</p>
  </div>
</main>
${otherDepts(null)}`;

fs.writeFileSync(
  path.join(ROOT, "privacy.html"),
  rewriteHead(ABOUT_CHROME, {
    title: "Privacy Policy | AI Supermarket",
    desc: "What AI Supermarket collects (nothing personal), how Google AdSense cookies work, how to opt out of personalised advertising, consent for the EEA/UK/Switzerland, and your rights.",
    canonPath: "/privacy",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        crumbs("Privacy Policy", "/privacy"),
        { "@type": "WebPage", name: "Privacy Policy", url: SITE + "/privacy", description: "Privacy policy for the AI Supermarket directory, including advertising cookies and opt-out options." },
      ],
    },
  }) + "\n" + ABOUT_CHROME.HEADER + "\n" + privacyBody + "\n" + ABOUT_CHROME.FOOTER
);

console.log("生成跨类目页 + about + privacy:");
for (const f of ["about.html", "privacy.html", "best/free-ai-tools.html", "best/ai-tools-with-free-tier.html", "best/free-tier-comparison.html", "guides/how-to-choose-an-ai-tool.html"]) {
  const h = fs.readFileSync(path.join(ROOT, f), "utf8");
  const w = h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").split(/\s+/).filter((x) => x.length > 1).length;
  console.log(`  ${f.padEnd(40)} ${String(w).padStart(5)} 词`);
}
console.log(`\n数据：${freeTools.length} 免费 / ${quotaTools.length} 有具体额度 / ${planTools.length} 有免费计划`);
