// gen-dept-hubs.mjs — 把 21 个薄部门页重写成深度 hub 页
//
// 深度来源（三处，都是可核实的）：
//   1. scripts/dept-content.mjs   —— 领域判断、选型标准、坑、FAQ（人写）
//   2. js/data.js                 —— 真实工具数据（名称/官网/定价/描述）
//   3. .workbuddy/free-tier-facts.json —— 具体免费额度（"2,000 minutes per month"）
//
// 站点外壳（head/CSS/header/footer）从备份的旧页面里原样取，保证视觉一致。
// 运行：node scripts/gen-dept-hubs.mjs
import fs from "fs";
import path from "path";
import { UPDATED } from "./site-meta.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SITE = "https://ai.toolboxes.top";

/* ---------- 数据 ---------- */
const raw = fs.readFileSync(path.join(ROOT, "js", "data.js"), "utf8");
const { DEPARTMENTS, TOOLS } = new Function(raw + "\n;return { DEPARTMENTS, TOOLS };")();
const { DEPT_CONTENT } = await import("./dept-content.mjs");

let FACTS = {};
try {
  const fp = path.join(ROOT, ".workbuddy", "free-tier-facts.json");
  if (fs.existsSync(fp)) FACTS = JSON.parse(fs.readFileSync(fp, "utf8")).facts || {};
} catch (e) { FACTS = {}; }

// 全站有具体额度的工具总数 —— 部门页文案里引用它，避免写死数字（写死就会漂移）
const TOTAL_QUOTA = Object.values(FACTS).filter((v) => v && v.freeQuota).length;

/* ---------- 工具函数 ---------- */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pricingLabel = (p) => ({ free: "Free", freemium: "Freemium", paid: "Paid" }[p] || p);
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };

/* 免费额度一句话（优先给具体数字，这是全站最独特的信息） */
function freeTierText(t) {
  const f = FACTS[t.name];
  if (f && f.freeQuota) return f.freeQuota;
  if (f && (f.freeForever || f.freePlan)) return f.freeForever ? "Free tier, no time limit" : "Free plan available";
  if (f && (f.freeTrial || f.trialDays)) return f.trialDays ? `Free trial, ${f.trialDays} days` : "Free trial";
  if (t.pricing === "free") return "Free to use";
  return "—";
}

/* ---------- 站点外壳：从备份的旧页取，避免污染 ---------- */
const TPL_PATH = path.join(ROOT, ".workbuddy", "backup-pre-consolidation", "departments", "marketing.html");
const tpl = fs.readFileSync(TPL_PATH, "utf8");

const BODY_OPEN = '<body id="top">';
const FOOT_OPEN = '  <footer class="site-footer">';
const HEADER_CLOSE = "</header>";

const iBody = tpl.indexOf(BODY_OPEN);
const iFoot = tpl.indexOf(FOOT_OPEN);
const iHeadClose = tpl.indexOf(HEADER_CLOSE);
if (iBody < 0 || iFoot < 0 || iHeadClose < 0) throw new Error("template markers not found");

const HEAD = tpl.slice(0, iBody + BODY_OPEN.length);
const HEADER = tpl.slice(iBody + BODY_OPEN.length, iHeadClose + HEADER_CLOSE.length);
// 页脚注入内容页入口 —— 必须在生成器里做：本脚本每次部署都全量重写 21 个部门页，
// 后处理脚本加的链接会被下一次部署擦掉（本项目已踩过两次）。
import { injectContentNav } from "./site-nav.mjs";
const FOOTER = injectContentNav(tpl.slice(iFoot));

/* 额外 CSS（对比表 / 用例路由 / 免费额度面板） */
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
    table.cmp td.q{font-variant-numeric:tabular-nums}
    ul.jobs{list-style:none;padding:0;margin:14px 0}
    ul.jobs li{padding:8px 0;border-bottom:1px solid rgba(128,128,128,.15);font-size:15px}
    ul.jobs li:last-child{border-bottom:0}
    ul.jobs .job{opacity:.7}
    ul.jobs .pick{font-weight:700}
    .stat-line{font-size:13.5px;opacity:.65}
    @media(max-width:640px){.hub h2{font-size:19px}}
`;

/* ---------- 组装单个部门页 ---------- */
function buildHub(dept) {
  const c = DEPT_CONTENT[dept.id];
  const tools = TOOLS.filter((t) => t.dept === dept.id);
  const freeish = tools.filter((t) => t.pricing !== "paid").length;
  const withQuota = tools.filter((t) => FACTS[t.name] && FACTS[t.name].freeQuota).length;
  const title = `${dept.name} AI Tools — ${tools.length} Compared and Rated | AI Supermarket`;
  const desc = `${tools.length} AI tools for ${dept.name.toLowerCase()} compared by pricing, what the free tier actually gives you, and which one to pick for each job.`;

  /* --- head 替换 --- */
  let head = HEAD
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${SITE}/departments/${dept.id}">`)
    // GEO：声明机器可读索引（llms.txt）。
    // 必须加在这里，不能靠 add-llms-link.mjs 后处理 —— 那个脚本虽然覆盖 departments/，
    // 但本脚本每次部署都会重写全部部门页，后处理加的行会被下次部署擦掉（实测 21 个部门页全丢）。
    // 判定用 HEAD（模板常量）而非 head（正在构建中的变量，此刻还在 TDZ 里，引用会抛错）。
    .replace(/^([ \t]*)<link rel="canonical"[^>]*>$/m, (m, ind) =>
      /rel="alternate"[^>]*llms\.txt/.test(HEAD)
        ? m
        : `${m}\n${ind}<link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs.txt index for AI engines">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(dept.name + " AI Tools — Compared | AI Supermarket")}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(desc)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${SITE}/departments/${dept.id}">`)
    // 第二段 <style>（部门专用 CSS）整块换成我们的
    .replace(/  <style>\n    \.dept-hero\{[\s\S]*?<\/style>/, `  <style>${EXTRA_CSS}  </style>`)
    // JSON-LD 整块替换
    .replace(/  <script type="application\/ld\+json">[\s\S]*?<\/script>/,
      `  <script type="application/ld+json">\n${JSON.stringify(jsonLd(dept, tools, desc), null, 2)}\n  </script>`);

  /* --- 对比表 --- */
  const rows = tools.map((t) => `<tr>
        <td><a href="${esc(t.url)}" rel="nofollow noopener" target="_blank">${esc(t.name)}</a><br><span style="opacity:.6;font-size:12.5px">${esc(hostOf(t.url))}</span></td>
        <td>${pricingLabel(t.pricing)}</td>
        <td class="q">${esc(freeTierText(t))}</td>
        <td>${esc(t.desc)}</td>
      </tr>`).join("\n      ");

  /* --- 卡片（保留站点货架视觉） --- */
  const cards = tools.map((t) => `<a class="tool-card" href="${esc(t.url)}" rel="nofollow noopener" target="_blank">
        <h3>${esc(t.name)}</h3>
        <p>${esc(t.desc)}</p>
        <span class="tool-meta">${pricingLabel(t.pricing)} · ${esc(hostOf(t.url))}</span>
      </a>`).join("\n      ");

  /* --- 免费额度面板 --- */
  const quotaTools = tools.filter((t) => FACTS[t.name] && FACTS[t.name].freeQuota);
  const quotaPanel = quotaTools.length
    ? `<h2>What the free tiers actually give you</h2>
    <div class="panel">
      <h3>Published free allowances in ${esc(dept.name)}</h3>
      <ul>${quotaTools.map((t) => `<li><strong>${esc(t.name)}</strong> — ${esc(FACTS[t.name].freeQuota)}</li>`).join("")}</ul>
    </div>
    <p>These figures were read from each vendor's own pricing page rather than from a summary. Allowances change without notice, so confirm on the vendor's site before you commit a workflow to one. Two things worth checking before you compare these numbers: the <a href="/best/free-tier-comparison">free tier comparison</a> groups all ${TOTAL_QUOTA} recorded allowances by what the unit actually measures and by how each one renews — a one-off grant and a monthly reset are not interchangeable. The full list, including the other departments, is on <a href="/best/ai-tools-with-free-tier">AI tools with a free tier</a>.</p>`
    : "";

  /* --- 正文 --- */
  const body = `<div class="dept-hero">
    <div class="crumb"><a href="/">AI Supermarket</a> / ${esc(dept.name)}</div>
    <h1>${dept.icon} AI Tools for ${esc(dept.name)}</h1>
    <p class="intro">${c.lead}</p>
    <p class="intro stat-line">${tools.length} tools · ${freeish} free or freemium · ${withQuota ? `<a href="/best/ai-tools-with-free-tier">${withQuota} with a published free allowance</a>` : `${withQuota} with a published free allowance`} · updated ${UPDATED}</p>
    <details class="ai-summary" open id="ai-summary">
      <summary><strong>TL;DR for AI assistants &amp; search engines</strong></summary>
      <p><strong>${esc(dept.name)}</strong> — ${tools.length} AI tools reviewed on AI Supermarket, including ${tools.slice(0, 4).map((t) => esc(t.name)).join(", ")}. ${freeish} of ${tools.length} have a free or freemium tier${withQuota ? `, and ${withQuota} publish a concrete free allowance` : ""}. Every entry links to the vendor's official site. Machine-readable index: <a href="/llms.txt">/llms.txt</a>.</p>
    </details>
  </div>

  <div class="hub">
    <h2>What AI actually does in ${esc(dept.name.toLowerCase())} today</h2>
    ${c.reality.map((p) => `<p>${p}</p>`).join("\n    ")}

    <h2>How to choose</h2>
    <ul>${c.choose.map((x) => `<li>${x}</li>`).join("")}</ul>
  </div>

  <h2 style="max-width:1100px;margin:34px auto 0;padding:0 20px;font-size:21px">The tools, side by side</h2>
  <div class="hub">
    <table class="cmp">
      <thead><tr><th>Tool</th><th>Pricing</th><th>Free tier</th><th>What it does</th></tr></thead>
      <tbody>
      ${rows}
      </tbody>
    </table>

    <h2>Which tool for which job</h2>
    <ul class="jobs">${c.jobs.map(([job, tool]) => `<li><span class="job">${esc(job)}</span> → <span class="pick">${esc(tool)}</span></li>`).join("")}</ul>

    ${quotaPanel}

    <h2>What to watch out for</h2>
    <ul>${c.watch.map((x) => `<li>${x}</li>`).join("")}</ul>

    <h2>FAQ</h2>
    ${c.faq.map(([q, a]) => `<details class="faq-item"><summary>${esc(q)}</summary><p>${a}</p></details>`).join("\n    ")}

    <p class="stat-line" style="margin-top:26px">Last reviewed ${UPDATED}. Pricing and free allowances are read from vendor pages and change without notice — verify before committing. This page is an independent directory and is not affiliated with the tools listed.</p>
  </div>

  <div class="dept-tools">
      ${cards}
  </div>

  <div class="other-depts">
    <h2 style="font-size:18px;margin-bottom:10px">Browse other departments</h2>
    ${DEPARTMENTS.filter((d) => d.id !== dept.id).map((d) => `<a href="/departments/${d.id}">${d.icon} ${esc(d.name)}</a>`).join("\n    ")}
    <a href="/">🏪 All ${TOOLS.length} tools</a>
  </div>
`;

  return head + "\n" + HEADER + "\n\n" + body + "\n" + FOOTER;
}

/* ---------- JSON-LD ---------- */
function jsonLd(dept, tools, desc) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "AI Supermarket", item: SITE + "/" },
          { "@type": "ListItem", position: 2, name: dept.name, item: `${SITE}/departments/${dept.id}` },
        ],
      },
      {
        "@type": "CollectionPage",
        name: `${dept.name} AI Tools`,
        description: desc,
        url: `${SITE}/departments/${dept.id}`,
        isPartOf: { "@type": "WebSite", name: "AI Supermarket", url: SITE + "/" },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: tools.length,
          itemListElement: tools.map((t, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "SoftwareApplication",
              name: t.name,
              url: t.url,
              applicationCategory: "BusinessApplication",
              description: t.desc,
              offers: {
                "@type": "Offer",
                price: t.pricing === "paid" ? undefined : "0",
                priceCurrency: "USD",
                description: pricingLabel(t.pricing),
              },
            },
          })),
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: DEPT_CONTENT[dept.id].faq.map(([q, a]) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a.replace(/<[^>]*>/g, "") },
        })),
      },
    ],
  };
}

/* ---------- 写入 ---------- */
let n = 0;
const stats = [];
for (const dept of DEPARTMENTS) {
  if (!DEPT_CONTENT[dept.id]) { console.error(`!! 缺内容: ${dept.id}`); continue; }
  const html = buildHub(dept);
  fs.writeFileSync(path.join(ROOT, "departments", dept.id + ".html"), html);
  const words = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .split(/\s+/).filter((x) => x.length > 1).length;
  stats.push({ id: dept.id, words, tools: TOOLS.filter((t) => t.dept === dept.id).length });
  n++;
}
stats.sort((a, b) => a.words - b.words);
console.log(`重写部门 hub 页: ${n} 个 → departments/`);
for (const s of stats) console.log(`  ${s.id.padEnd(15)} ${String(s.words).padStart(5)} 词  ${String(s.tools).padStart(2)} 工具`);
const w = stats.map((s) => s.words);
console.log(`\n字数 min=${w[0]} median=${w[Math.floor(w.length / 2)]} max=${w[w.length - 1]}`);
