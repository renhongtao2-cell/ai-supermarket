// regen-seo-blocks.mjs — 把 index.html 的 JSON-LD ItemList 与 departments/*.html 的
// ai-summary（GEO TL;DR）块，按 js/data.js 重新生成，消除手工维护导致的计数漂移。
// 幂等：内容一致时不写盘。
// 运行: node scripts/regen-seo-blocks.mjs [--check]
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHECK_ONLY = process.argv.includes("--check");
const raw = fs.readFileSync(path.join(ROOT, "js", "data.js"), "utf8");
const { DEPARTMENTS, TOOLS } = new Function(raw + "\n;return { DEPARTMENTS, TOOLS };")();

const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 纯空白/缩进差异不算「待更新」，否则 --check 每次都误报（内容其实已同步）。
const norm = s => s.replace(/\s+/g, " ").trim();
const differs = (a, b) => norm(a) !== norm(b);

/* ---------- 1) index.html 的 JSON-LD ItemList ---------- */
function findArrayEnd(s, openIdx) {
  let depth = 0, inStr = false, esc = false;
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) return i; }
  }
  throw new Error("unbalanced array");
}

function rebuildItemList(html) {
  const mi = html.indexOf('"@type": "ItemList"');
  if (mi < 0) throw new Error("index.html 找不到 ItemList");
  const keyIdx = html.indexOf('"itemListElement"', mi);
  const arrOpen = html.indexOf("[", keyIdx);
  const arrClose = findArrayEnd(html, arrOpen);

  const items = TOOLS.map((t, i) => {
    const p = n => " ".repeat(n);
    return [
      `${p(10)}{`,
      `${p(12)}"@type": "ListItem",`,
      `${p(12)}"position": ${i + 1},`,
      `${p(12)}"item": {`,
      `${p(14)}"@type": "Thing",`,
      `${p(14)}"name": ${JSON.stringify(t.name)},`,
      `${p(14)}"description": ${JSON.stringify(t.desc)},`,
      `${p(14)}"url": ${JSON.stringify(t.url)}`,
      `${p(12)}}`,
      `${p(10)}}`
    ].join("\n");
  }).join(",\n");

  let out = html.slice(0, arrOpen + 1) + "\n" + items + "\n" + html.slice(arrClose);
  out = out.replace(/"numberOfItems":\s*\d+/, `"numberOfItems": ${TOOLS.length}`);
  return out;
}

/* ---------- 2) departments/*.html 的 ai-summary ---------- */
function pricingLine(tools) {
  const order = ["free", "freemium", "paid"];
  const counts = {};
  for (const t of tools) counts[t.pricing] = (counts[t.pricing] || 0) + 1;
  return order.filter(k => counts[k]).map(k => `${counts[k]} ${k}`).join(", ");
}

function rebuildDeptSummary(html, dept) {
  const tools = TOOLS.filter(t => t.dept === dept.id);
  if (!tools.length) return html;
  const top5 = tools.slice(0, 5).map(t => escHtml(t.name)).join(", ");
  const p = `<p><strong>${escHtml(dept.name)}</strong> — ${tools.length} hand-picked AI tools on AI Supermarket (ai.toolboxes.top), including ${top5}. Pricing: ${pricingLine(tools)}. Every card links to the tool's official website. Machine-readable index: <a href="/llms.txt">/llms.txt</a>.</p>`;
  // 只替换 ai-summary 容器内的 <p>...</p>
  const re = /(<details[^>]*id="ai-summary"[^>]*>)([\s\S]*?)(<\/details>)|(<section[^>]*id="ai-summary"[^>]*>)([\s\S]*?)(<\/section>)/;
  return html.replace(re, (m, o1, b1, c1, o2, b2, c2) => {
    const open = o1 || o2, body = b1 || b2, close = c1 || c2;
    const indent = (body.match(/\n\s+/) || ["\n      "])[0].replace(/\n/, "");
    return open + body.replace(/<p>[\s\S]*?<\/p>/, p.replace(/^/, "")) + close;
  });
}

/* ---------- 执行 ---------- */
const log = [];
const idxPath = path.join(ROOT, "index.html");
let idx = fs.readFileSync(idxPath, "utf8");
const idxNew = rebuildItemList(idx);
if (differs(idxNew, idx)) {
  if (!CHECK_ONLY) fs.writeFileSync(idxPath, idxNew);
  log.push(`index.html: ItemList 重建为 ${TOOLS.length} 条`);
}

/* departments/*.html 的 ai-summary 现在由 scripts/gen-dept-hubs.mjs 全量生成，
   本脚本不再触碰部门页 —— 否则会把 hub 页里手写的摘要覆盖成通用模板。 */

console.log(CHECK_ONLY ? "[check] 待更新项:" : "[regen-seo-blocks] 已更新:");
console.log(log.length ? log.map(l => "  - " + l).join("\n") : "  (无，已全部同步)");
