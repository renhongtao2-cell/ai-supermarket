// version-assets.mjs — 部署前的资源内联与版本化处理：
//   1. 把 css/style.css 整体内联进每个 HTML（页面自带样式，样式请求失败也不会裸奔）
//   2. Google Fonts 改为非阻塞加载（字体源不可达时用系统字体渲染，不卡页面）
//   3. js/app.js、js/data.js 引用追加 ?v=<内容哈希>，避免旧缓存混搭
// 幂等，可重复运行。改过 css/js 或重新生成页面后、部署前运行：
//   node scripts/version-assets.mjs
import fs from "fs";
import path from "path";
import crypto from "crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const css = fs.readFileSync(path.join(ROOT, "css", "style.css"), "utf8");

const jsVersion = crypto
  .createHash("sha1")
  .update(css)
  .update(fs.readFileSync(path.join(ROOT, "js", "app.js")))
  .update(fs.readFileSync(path.join(ROOT, "js", "data.js")))
  .digest("hex")
  .slice(0, 8);

const MARKER = "<style>/* asm-inline-css */";
const inlineStyle = `${MARKER}\n${css}\n</style>`;

const files = ["index.html", "about.html", "privacy.html"];
for (const dir of ["departments", "tool"]) {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (f.endsWith(".html")) files.push(path.join(dir, f));
  }
}

let changed = 0;
for (const rel of files) {
  const p = path.join(ROOT, rel);
  let html = fs.readFileSync(p, "utf8");
  const before = html;

  // 已有内联块 → 用最新 css 替换；否则把 <link> 本地样式表换成内联块
  const markerRe = /<style>\/\* asm-inline-css \*\/[\s\S]*?<\/style>/;
  const linkRe = /<link rel="stylesheet" href="(?:\.\.\/)?css\/style\.css[^"]*"\s*\/?>/;
  if (markerRe.test(html)) html = html.replace(markerRe, () => inlineStyle);
  else if (linkRe.test(html)) html = html.replace(linkRe, () => inlineStyle);
  else throw new Error(`${rel}: neither inline block nor css <link> found`);

  // Google Fonts: rel="stylesheet" 阻塞渲染，改为 print→all 技巧 + noscript 兜底
  // (?!<noscript>) 防止把 noscript 里的兜底链接再包一层
  html = html.replace(
    /(?<!<noscript>)<link href="(https:\/\/fonts\.googleapis\.com\/css2[^"]*)" rel="stylesheet">/g,
    (_m, href) =>
      `<link href="${href}" rel="stylesheet" media="print" onload="this.media='all'">\n  <noscript><link href="${href}" rel="stylesheet"></noscript>`,
  );

  // js 引用刷新 ?v= 版本号（仅 src="js/..." 属性形式，不影响页脚 /js/data.js 链接）
  html = html
    .replace(/(?<=")(js\/(?:app|data)\.js)\?v=[0-9a-f]+/g, "$1")
    .replace(/(?<=")(js\/(?:app|data)\.js)(?=["\s])/g, `$1?v=${jsVersion}`);

  if (html !== before) {
    fs.writeFileSync(p, html);
    changed++;
  }
}
console.log(`css inlined + js v=${jsVersion} — ${changed}/${files.length} pages updated`);
