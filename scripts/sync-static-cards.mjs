// sync-static-cards.mjs — 让 index.html 的静态卡片与 js/data.js 保持一致
// 新增工具补卡片、已移除工具删卡片。幂等。
//
// 注意：卡片现在直接链到厂商官网 —— /tool/<slug> 详情页已于 2026-09-17 收敛移除
// （221 个薄页 → 21 个部门深度页，301 见根目录 _redirects）。
// departments/*.html 由 scripts/gen-dept-hubs.mjs 全量生成，本脚本不再触碰。
// 运行: node scripts/sync-static-cards.mjs
import fs from "fs";
import path from "path";
import { outbound } from "./affiliate.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const raw = fs.readFileSync(path.join(ROOT, "js", "data.js"), "utf8");
const { DEPARTMENTS, TOOLS } = new Function(raw + "\n;return { DEPARTMENTS, TOOLS };")();

const deptById = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d]));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pricingLabel = (p) => ({ free: "Free", freemium: "Freemium", paid: "Paid" }[p] || p);

function card(t) {
  const d = deptById[t.dept];
  const domain = t.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const o = outbound(t.name, t.url);
  return `<article class="tool-card">
      <button class="cart-add" data-tool="${esc(t.name)}" aria-label="Add to my list" title="Save to my list">+</button>
      <a class="tool-main" href="${esc(o.href)}" ${o.attrs}>
        <div class="tool-head">
          <span class="tool-logo" style="--dept:${d.color}">${esc(t.name[0])}
            <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="" loading="lazy" onerror="this.remove()">
          </span>
          <div class="tool-id">
            <h3>${esc(t.name)}</h3>
            <span class="pill ${esc(t.pricing)}">${pricingLabel(t.pricing)}</span>
          </div>
        </div>
        <p class="tool-desc">${esc(t.desc)}</p>
      </a>
      <div class="tool-foot">
        <span class="dept-chip" style="--dept:${d.color}">${d.icon} ${esc(d.name)}</span>
        <span class="visit" aria-hidden="true">Visit ↗</span>
      </div>
    </article>`;
}

const ART = /[ \t]*<article class="tool-card">[\s\S]*?<\/article>\n?/g;

function sync(file, tools) {
  let html = fs.readFileSync(file, "utf8");
  const want = new Set(tools.map((t) => t.name));
  let removed = 0;

  // 1) 删除已不在 TOOLS 里的卡片
  html = html.replace(ART, (block) => {
    const m = block.match(/data-tool="([^"]+)"/);
    if (m && !want.has(m[1])) { removed++; return ""; }
    return block;
  });

  // 2) 补齐缺失卡片：插到同部门最后一张卡之后；该部门一张都没有则插到最后一张卡之后
  const have = new Set();
  for (const m of html.matchAll(/data-tool="([^"]+)"/g)) have.add(m[1]);
  const missing = tools.filter((t) => !have.has(t.name));
  for (const t of missing) {
    const blocks = [...html.matchAll(ART)].map((m) => ({ text: m[0], idx: m.index }));
    let anchor = null;
    for (let i = blocks.length - 1; i >= 0; i--) {
      const nm = blocks[i].text.match(/data-tool="([^"]+)"/);
      const bTool = nm && TOOLS.find((x) => x.name === nm[1]);
      if (bTool && bTool.dept === t.dept) { anchor = blocks[i]; break; }
    }
    const insertAt = anchor
      ? anchor.idx + anchor.text.length
      : (blocks.length ? blocks[blocks.length - 1].idx + blocks[blocks.length - 1].text.length : -1);
    if (insertAt < 0) { console.warn("  跳过(找不到锚点):", file, t.name); continue; }
    html = html.slice(0, insertAt) + card(t) + "\n" + html.slice(insertAt);
  }

  if (removed || missing.length) fs.writeFileSync(file, html);
  return { removed, added: missing.length };
}

const r = sync(path.join(ROOT, "index.html"), TOOLS);
console.log(`index.html: +${r.added} -${r.removed}`);
console.log(`[sync-static-cards] 新增卡片 ${r.added}，移除卡片 ${r.removed}`);
console.log("（departments/*.html 由 gen-dept-hubs.mjs 负责，本脚本不触碰）");
