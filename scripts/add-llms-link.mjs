/**
 * 给所有站点页面补 <link rel="alternate" type="text/plain" href="/llms.txt">
 * —— GEO 信号：让 AI 爬虫在任一页面都能发现机器可读索引。
 *
 * 幂等：已存在则跳过。插在 <link rel="canonical"> 之后（没有则插在 </title> 之后）。
 * 用法： node scripts/add-llms-link.mjs [--check]
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHECK = process.argv.includes("--check");
const LINK = '  <link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs.txt index for AI engines">\n';

const files = [
  "index.html", "about.html", "privacy.html",
  ...fs.readdirSync(path.join(ROOT, "departments")).filter(f => f.endsWith(".html")).map(f => `departments/${f}`),
  ...fs.readdirSync(path.join(ROOT, "best")).filter(f => f.endsWith(".html")).map(f => `best/${f}`),
  ...fs.readdirSync(path.join(ROOT, "guides")).filter(f => f.endsWith(".html")).map(f => `guides/${f}`),
];

let added = 0, skipped = 0;
for (const rel of files) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  let h = fs.readFileSync(p, "utf8");
  if (/rel="alternate"[^>]*llms\.txt/.test(h)) { skipped++; continue; }
  if (CHECK) { console.log(`[待补] ${rel}`); added++; continue; }
  let out;
  const can = h.match(/^[ \t]*<link rel="canonical"[^>]*>\n/m);
  if (can) out = h.replace(can[0], can[0] + LINK);
  else {
    const t = h.match(/^[ \t]*<\/title>\n/m);
    if (!t) { console.log(`[跳过] ${rel}: 找不到插入锚点`); continue; }
    out = h.replace(t[0], t[0] + LINK);
  }
  fs.writeFileSync(p, out);
  added++;
}
console.log(CHECK ? `[check] 待补 ${added} 个页面，已具备 ${skipped} 个` : `已补 ${added} 个页面，跳过 ${skipped} 个（已有）`);
