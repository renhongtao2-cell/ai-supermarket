// prepare-deploy-dir.mjs — 构建一个「只含站点文件」的干净部署目录
// 背景：wrangler pages deploy 会把整个目录上传，且不认 .assetsignore，
//       导致 .workbuddy/（含 cf.env token）、scripts/、worker.js 等被公开。
//       这里只挑站点真正需要的文件，杜绝敏感文件上线。
//
// 运行：
//   node scripts/prepare-deploy-dir.mjs                      # 目录站 → .deploy/
//   node scripts/prepare-deploy-dir.mjs --site=tools         # 工具站 → .deploy-tools/
//
// 安全自检是硬门槛：命中 .workbuddy / cf.env / scripts / worker.js 直接 exit 1。
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");

/* ---------- 站点定义 ---------- */
const SITES = {
  // AI Supermarket 目录站（ai.toolboxes.top）
  catalog: {
    src: ROOT,
    out: path.join(ROOT, ".deploy"),
    files: [
      "index.html", "about.html", "privacy.html", "404.html",
      "sitemap.xml", "robots.txt", "ads.txt", "_headers",
      "og-image.png", "llms.txt",
    ],
    dirs: ["css", "js", "departments", "tool"],
  },
  // Subtitle Tools 工具站（toolboxes.top / www）
  tools: {
    src: path.join(ROOT, "toolsite"),
    out: path.join(ROOT, ".deploy-tools"),
    files: [
      "index.html", "about.html", "privacy.html", "404.html",
      "sitemap.xml", "robots.txt", "ads.txt", "_headers", "_redirects", "llms.txt",
    ],
    dirs: ["css", "js", "tools", "guides"],
  },
};

const arg = process.argv.find((a) => a.startsWith("--site="));
const key = arg ? arg.split("=")[1] : "catalog";
const SITE = SITES[key];
if (!SITE) {
  console.error(`unknown --site=${key}. known: ${Object.keys(SITES).join(", ")}`);
  process.exit(1);
}

const { src: SRC, out: OUT, files: FILES, dirs: DIRS } = SITE;

if (!fs.existsSync(SRC)) {
  console.error(`source dir not found: ${SRC}`);
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const missing = [];
for (const f of FILES) {
  const src = path.join(SRC, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f));
  else missing.push(f);
}
for (const d of DIRS) {
  const src = path.join(SRC, d);
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
    if (e.isDirectory()) {
      if (e.name === ".workbuddy" || e.name === "scripts" || e.name === ".git") bad.push(fp);
      scan(fp);
    } else if (/cf\.env|wrangler\.toml|worker\.js$|\.mjs$/.test(e.name)) bad.push(fp);
  }
};
scan(OUT);

console.log(
  `staging ${path.basename(OUT)}/ [${key}] ready — ${n} files` +
    (missing.length ? ` (missing: ${missing.join(", ")})` : "")
);
if (bad.length) {
  console.error("SECURITY: forbidden files in staging:");
  bad.forEach((b) => console.error("  " + b));
  process.exit(1);
}
console.log("security self-check: OK (no .workbuddy / cf.env / scripts / worker.js)");
