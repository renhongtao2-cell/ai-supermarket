// inject-affiliate-disclosure.mjs — 给每个页面的页脚注入联盟披露链接
//
// 为什么是「注入」而不是写进生成器：页脚来自多个不同的模板来源
//   - gen-cross-pages.mjs 从 backup-pre-consolidation/ 取外壳
//   - gen-dept-hubs.mjs    取自己的外壳
//   - index.html           是手写静态页，没有任何生成器全量重写它
// 写进每个生成器 = 3 处，漏一处就有一批页面缺披露。所以做成统一的注入步骤，
// 放在所有生成器之后、version-assets 之前（version-assets 之后没人再改 HTML）。
//
// 幂等语义：这里是「已是最新就跳过」，不是「已存在就跳过」——先 strip 再 inject，
// 否则改了披露文案永远刷不进去。
// 运行：node scripts/inject-affiliate-disclosure.mjs
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MARK = "Some outbound links are affiliate links";
const SENTENCE = ` ${MARK} — see our <a href="/affiliate-disclosure" style="color:inherit;text-decoration:underline">affiliate disclosure</a>.`;

const files = ["index.html", "about.html", "privacy.html", "affiliate-disclosure.html"];
for (const dir of ["departments", "best", "guides"]) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    if (f.endsWith(".html")) files.push(path.join(dir, f));
  }
}

function stripDisclosure(html) {
  return html.replace(new RegExp(`\\s*${MARK}[\\s\\S]*?(?=</p>)`, "g"), "");
}

let changed = 0, missingFooter = [], alreadyOk = 0;

for (const rel of files) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { missingFooter.push(rel + " (文件不存在)"); continue; }
  const before = fs.readFileSync(p, "utf8");
  const cleaned = stripDisclosure(before);

  if (!/<p class="footer-disclaimer">[\s\S]*?<\/p>/.test(cleaned)) {
    missingFooter.push(rel);
    continue;
  }

  const after = cleaned.replace(
    /(<p class="footer-disclaimer">)([\s\S]*?)(<\/p>)/,
    (_m, open, body, close) => open + body + SENTENCE + close,
  );

  if (after === before) { alreadyOk++; continue; }
  fs.writeFileSync(p, after);
  changed++;
}

console.log(`联盟披露注入：${changed} 个页面更新，${alreadyOk} 个已是最新，共 ${files.length} 个`);
if (missingFooter.length) {
  console.warn(`⚠ 以下页面没有页脚披露位（未注入）：\n  ${missingFooter.join("\n  ")}`);
}

// 自检：所有页面都必须带上披露
const bad = files.filter((rel) => {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) && !fs.readFileSync(p, "utf8").includes(MARK);
});
if (bad.length) {
  console.error(`✗ ${bad.length} 个页面缺联盟披露，拒绝继续：\n  ${bad.join("\n  ")}`);
  process.exit(1);
}
