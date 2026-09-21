// link-check.mjs — 站内链接体检：找出会 404 的内部链接
// 用法: node scripts/link-check.mjs [toolsite|.] [--base=https://toolboxes.top]
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const dirArg = process.argv[2] || "toolsite";
const SRC = path.join(ROOT, dirArg === "." ? "" : dirArg);
const baseArg = process.argv.find((a) => a.startsWith("--base="));
const BASE = baseArg ? baseArg.split("=")[1] : "https://toolboxes.top";

// 收集所有 html
const htmls = [];
const SKIP_DIRS = new Set([
  "node_modules", "toolsite", "mcp", "outputs", ".deploy", ".deploy-tools", ".git",
]);
const walk = (p) => {
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
    const fp = path.join(p, e.name);
    if (e.isDirectory()) walk(fp);
    else if (e.name.endsWith(".html")) htmls.push(fp);
  }
};
walk(SRC);

// 本地可解析的资源集合：/foo → foo.html 或 foo/index.html 或 foo（文件）
const exists = (urlPath) => {
  const clean = urlPath.split("#")[0].split("?")[0];
  if (!clean || clean === "/") return fs.existsSync(path.join(SRC, "index.html"));
  const rel = clean.replace(/^\//, "");
  return (
    fs.existsSync(path.join(SRC, rel)) ||
    fs.existsSync(path.join(SRC, rel + ".html")) ||
    fs.existsSync(path.join(SRC, rel, "index.html"))
  );
};

const broken = new Map(); // target -> Set(source pages)
let total = 0;
for (const f of htmls) {
  const html = fs.readFileSync(f, "utf8");
  const rel = "/" + path.relative(SRC, f).replace(/\\/g, "/");
  const re = /href="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (/^(mailto:|tel:|javascript:|#)/.test(href)) continue;
    if (/^https?:\/\//i.test(href)) {
      // 外链里同域的也算内部
      if (!href.startsWith(BASE) && !href.startsWith(BASE.replace("https://", "https://www."))) continue;
      const u = new URL(href);
      if (!exists(u.pathname)) {
        total++;
        if (!broken.has(u.pathname)) broken.set(u.pathname, new Set());
        broken.get(u.pathname).add(rel);
      }
      continue;
    }
    if (!href.startsWith("/")) continue; // 相对路径暂不处理
    total++;
    if (!exists(href)) {
      if (!broken.has(href)) broken.set(href, new Set());
      broken.get(href).add(rel);
    }
  }
}

console.log(`扫描 ${htmls.length} 个页面，内部链接 ${total} 条`);
if (!broken.size) {
  console.log("✅ 没有发现会 404 的内部链接");
} else {
  console.log(`\n❌ ${broken.size} 个目标不存在（会 404）：`);
  for (const [target, srcs] of [...broken].sort()) {
    console.log(`   ${target}`);
    for (const s of srcs) console.log(`       ← ${s}`);
  }
}
process.exit(broken.size ? 1 : 0);
