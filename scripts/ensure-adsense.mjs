// ensure-adsense.mjs — 幂等地为所有 HTML 页注入 AdSense 脚本（生成器重跑后守护用）
// 运行: node scripts/ensure-adsense.mjs
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TAG =
  '  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9901133369141996" crossorigin="anonymous"></script>';
const MARK = "pagead2.googlesyndication.com";

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
let injected = 0;
for (const f of files) {
  const html = fs.readFileSync(f, "utf8");
  if (html.includes(MARK)) continue;
  if (!html.includes("</head>")) { console.warn("跳过(无 </head>):", f); continue; }
  fs.writeFileSync(f, html.replace("</head>", `${TAG}\n</head>`));
  injected++;
}
console.log(`[ensure-adsense] 扫描 ${files.length} 个 HTML，新注入 ${injected} 个`);
