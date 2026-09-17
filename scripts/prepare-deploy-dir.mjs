// prepare-deploy-dir.mjs — 构建一个「只含站点文件」的干净部署目录 .deploy/
// 背景：wrangler pages deploy 会把整个项目根目录上传，且不认 .assetsignore，
//       导致 .workbuddy/（含 cf.env token）、scripts/、worker.js 等被公开。
//       这里只挑站点真正需要的文件，杜绝敏感文件上线。
// 运行：node scripts/prepare-deploy-dir.mjs
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, ".deploy");

// 站点真正需要的文件（白名单，不做黑名单 —— 新增开发文件不会被误传）
const FILES = [
  "index.html", "about.html", "privacy.html", "404.html",
  "sitemap.xml", "robots.txt", "ads.txt", "_headers",
  "og-image.png", "llms.txt",
];
const DIRS = ["css", "js", "departments", "tool"];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let missing = [];
for (const f of FILES) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f));
  else missing.push(f);
}
for (const d of DIRS) {
  const src = path.join(ROOT, d);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(OUT, d), { recursive: true });
  else missing.push(d + "/");
}

let n = 0;
const walk = (p) => {
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const fp = path.join(p, e.name);
    if (e.isDirectory()) walk(fp); else n++;
  }
};
walk(OUT);

// 安全自检：绝不允许 .workbuddy / cf.env / scripts / worker.js 混入
const bad = [];
const scan = (p) => {
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const fp = path.join(p, e.name);
    if (e.isDirectory()) { if (e.name === ".workbuddy" || e.name === "scripts") bad.push(fp); scan(fp); }
    else if (/cf\.env|wrangler\.toml|worker\.js$/.test(e.name)) bad.push(fp);
  }
};
scan(OUT);

console.log(`staging .deploy/ ready — ${n} files${missing.length ? " (missing: " + missing.join(", ") + ")" : ""}`);
if (bad.length) { console.error("SECURITY: forbidden files in staging:", bad); process.exit(1); }
console.log("security self-check: OK (no .workbuddy / cf.env / scripts / worker.js)");
