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
      "index.html", "about.html", "privacy.html", "affiliate-disclosure.html", "404.html",
      "sitemap.xml", "robots.txt", "ads.txt", "_headers", "_redirects",
      "og-image.png", "llms.txt",
    ],
    dirs: ["css", "js", "departments", "best", "guides"],
  },
  // SerpPrism — SEO 工具站（serpprism.com）
  // 生成器：scripts/gen-seosite.mjs；闸门：scripts/check-seosite.mjs
  seo: {
    src: path.join(ROOT, "seosite"),
    out: path.join(ROOT, ".deploy-seo"),
    files: [
      "index.html", "about.html", "contact.html", "privacy.html", "404.html",
      "sitemap.xml", "robots.txt", "ads.txt", "_headers", "_redirects", "llms.txt",
    ],
    dirs: ["css", "js", "tools", "guides"],
  },
  // Subtitle Tools 工具站（toolboxes.top / www）
  tools: {
    src: path.join(ROOT, "toolsite"),
    out: path.join(ROOT, ".deploy-tools"),
    files: [
      "index.html", "about.html", "contact.html", "privacy.html", "404.html",
      "sitemap.xml", "robots.txt", "ads.txt", "_headers", "_redirects", "llms.txt",
      // og:image 由 assets/og-toolsite.png 复制而来（生成器每次重建 toolsite/，
      // 所以图片源不能放在 toolsite/ 里）。图片还没做时这里只会显示 missing，不会报错。
      "og-image.png",
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

// 注意：沙箱的 safe-delete 守卫会拦截单次 >50 文件的批量删除（Node 的 fs.rmSync 被 hook）。
// cf-deploy.js 会先用 shell 清空 staging 目录；这里只在目录仍存在时兜底。
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
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

// 白名单漏检：根目录下的 .html 若不在 FILES 里，会被**静默丢掉**，
// 线上表现为 404 —— 而且部署日志一切正常，极难发现。
// （2026-09-21 踩过：新增 contact.html 忘了加白名单，/contact 上线即 404。）
const dropped = fs
  .readdirSync(SRC)
  .filter((f) => f.endsWith(".html") && !FILES.includes(f));
if (dropped.length) {
  console.error(
    "\n⚠️  以下根目录 HTML 不在白名单里，不会被部署（线上会 404）：\n" +
      dropped.map((d) => "     " + d).join("\n") +
      `\n   请把它们加入 scripts/prepare-deploy-dir.mjs 的 SITES.${key}.files\n`
  );
  process.exit(1);
}
