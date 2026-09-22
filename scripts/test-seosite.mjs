// test-seosite.mjs — SerpPrism 客户端逻辑的单元测试
//
// 为什么需要这个：工具站的全部价值都在「算得对」。robots.txt 判错一个规则，
// 站长就会放行本该屏蔽的目录；音节数算错，可读性分数就是假的。
// 这类 bug 在浏览器里看不出来 —— 页面照样渲染，只是答案是错的。
//
// 做法：用最小 DOM 桩在 Node 里 eval 客户端脚本，取出 SEOT._internal 的纯函数断言。
//
// 运行：node scripts/test-seosite.mjs
import fs from "fs";
import path from "path";
import vm from "vm";

const ROOT = path.resolve(import.meta.dirname, "..");
const JS = path.join(ROOT, "seosite", "js", "tools.js");

if (!fs.existsSync(JS)) {
  console.error("❌ seosite/js/tools.js 不存在，先跑 node scripts/gen-seosite.mjs");
  process.exit(1);
}

/* ---- 最小 DOM 桩 ---- */
function makeEl(id) {
  return {
    id,
    value: "",
    hidden: false,
    innerHTML: "",
    textContent: "",
    addEventListener() {},
    getAttribute() { return null; },
    setAttribute() {},
  };
}
const els = new Map();
const document = {
  getElementById(id) {
    if (!els.has(id)) els.set(id, makeEl(id));
    return els.get(id);
  },
  createElement(tag) {
    return {
      tagName: tag,
      getContext() { return { font: "", measureText: (s) => ({ width: s.length * 7 }) }; },
    };
  },
  addEventListener() {},
  body: { getAttribute: () => null },
  querySelectorAll: () => [],
  DOMParser: null,
};

const sandbox = {
  document,
  window: {},
  console,
  navigator: { clipboard: null },
  localStorage: { getItem: () => null, setItem() {} },
  DOMParser: class { parseFromString() { return { querySelectorAll: () => [] }; } },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(JS, "utf8"), sandbox);

const I = sandbox.SEOT && sandbox.SEOT._internal;
if (!I) {
  console.error("❌ SEOT._internal 未暴露，客户端脚本结构可能变了");
  process.exit(1);
}

let pass = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) pass++;
  else fails.push(name + (detail ? ` — ${detail}` : ""));
}

/* =================================================================
   robots.txt
   ================================================================= */
const ROBOTS = `User-agent: *
Disallow: /admin/
Allow: /admin/public/
Disallow: /private/
Disallow: /*.pdf$

User-agent: Googlebot
Disallow: /staging/

Sitemap: https://example.com/sitemap.xml`;

const parsed = I.parseRobots(ROBOTS);

function verdict(url, ua = "SomeBot") {
  return I.decide(I.pickGroup(parsed.groups, ua), url);
}

ok("robots: 解析出 2 个 group", parsed.groups.length === 2, `实际 ${parsed.groups.length}`);
ok("robots: 解析出 1 条 sitemap", parsed.sitemaps.length === 1);

ok("robots: 默认允许无规则路径", verdict("/blog/post").allow === true);
ok("robots: /admin/secret 被屏蔽", verdict("/admin/secret").allow === false);
ok(
  "robots: /admin/public/page 被放行（最长匹配优先，Allow 更长）",
  verdict("/admin/public/page").allow === true
);
ok("robots: /private/x 被屏蔽", verdict("/private/x").allow === false);
ok("robots: /*.pdf$ 屏蔽 PDF（通配符）", verdict("/files/report.pdf").allow === false);
ok("robots: /*.pdf$ 不误伤 html", verdict("/files/report.html").allow === true);

// UA 特异性：Googlebot 有专属 group
ok("robots: Googlebot 专属规则生效", verdict("/staging/x", "Googlebot").allow === false);
ok(
  "robots: Googlebot 不受 * 组规则约束（专属 group 优先）",
  verdict("/private/x", "Googlebot").allow === true
);
ok("robots: 其他 UA 走 * 组", verdict("/private/x", "bingbot").allow === false);

// 空 Disallow = 全放行
const empty = I.parseRobots("User-agent: *\nDisallow:");
ok("robots: 空 Disallow 视为全放行", I.decide(I.pickGroup(empty.groups, "x"), "/anything").allow === true);

// 完全没有 group
const none = I.parseRobots("# just a comment\n");
ok("robots: 无 group 时默认允许", I.decide(I.pickGroup(none.groups, "x"), "/anything").allow === true);

// 允许优先（同长度时 Allow 胜）
const tie = I.parseRobots("User-agent: *\nDisallow: /x/\nAllow: /x/");
ok("robots: 同长度时 Allow 优先", I.decide(I.pickGroup(tie.groups, "x"), "/x/y").allow === true);

// 注释与大小写
const messy = I.parseRobots("User-Agent: *   # comment\nDisallow: /tmp/  # temp");
ok("robots: 忽略行内注释", I.decide(I.pickGroup(messy.groups, "x"), "/tmp/a").allow === false);
ok("robots: 键名大小写不敏感", messy.groups.length === 1);

// 无前导斜杠的路径应能匹配
ok("robots: 输入缺前导斜杠也能匹配", I.decide(I.pickGroup(parsed.groups, "x"), "admin/secret").allow === false);

/* =================================================================
   音节（可读性公式的输入）
   ================================================================= */
ok("syllables: a = 1", I.syllables("a") === 1);
ok("syllables: hello = 2", I.syllables("hello") === 2, `实际 ${I.syllables("hello")}`);
ok("syllables: world = 1", I.syllables("world") === 1, `实际 ${I.syllables("world")}`);
ok("syllables: beautiful = 3", I.syllables("beautiful") === 3, `实际 ${I.syllables("beautiful")}`);
ok("syllables: 纯数字返回 0 而不是崩", I.syllables("123") === 0);
ok("syllables: 空串为 0", I.syllables("") === 0);

/* =================================================================
   路径 → 正则
   ================================================================= */
ok("pathToRe: /admin/ 命中子路径", I.pathToRe("/admin/").test("/admin/x"));
ok("pathToRe: /admin/ 不命中 /administration", I.pathToRe("/admin/").test("/administration") === false);
ok("pathToRe: /*.pdf$ 命中", I.pathToRe("/*.pdf$").test("/f/a.pdf"));
ok("pathToRe: /*.pdf$ 不命中末尾多余字符", I.pathToRe("/*.pdf$").test("/f/a.pdf.html") === false);
ok("pathToRe: 正则元字符被转义", I.pathToRe("/a+b/").test("/aab/") === false);

/* =================================================================
   接线检查：每个工具页的 data-tool 必须对应一个真实存在的 SEOT 函数
   —— 这是「页面能不能跑」的核心风险：函数名拼错 / 忘了导出，
       页面会静默什么都不做，而 HTML 看起来完全正常。
   ================================================================= */
const OUT = path.join(ROOT, "seosite");
const toolPages = fs
  .readdirSync(path.join(OUT, "tools"))
  .filter((f) => f.endsWith(".html") && f !== "index.html");

ok("工具页数量 > 0", toolPages.length > 0);

for (const f of toolPages) {
  const html = fs.readFileSync(path.join(OUT, "tools", f), "utf8");
  const m = html.match(/<body data-tool="([^"]+)"/);
  ok(`${f}: 有 data-tool`, !!m);
  if (!m) continue;
  ok(`${f}: SEOT.${m[1]} 是函数`, typeof sandbox.SEOT[m[1]] === "function");
}

/* 每个工具页必须有输出容器，否则算完没地方显示 */
for (const f of toolPages) {
  const html = fs.readFileSync(path.join(OUT, "tools", f), "utf8");
  const m = html.match(/<body data-tool="([^"]+)"/);
  if (!m) continue;
  // 每个工具的输出容器 id —— 加新工具时必须同步到这里，
  // 否则测试会报「有输出容器 #undefined」（刚加 llmsGen/schemaGen 时踩到）。
  const containers = {
    metaGen: "m-out",
    serpPreview: "s-preview",
    robotsTest: "r-out",
    headingAnalyze: "h-out",
    kwDensity: "k-out",
    readability: "rd-out",
    llmsGen: "lt-out",
    schemaGen: "sc-out",
    utmBuild: "u-out",
  };
  const id = containers[m[1]];
  ok(`${f}: 有输出容器 #${id}`, html.includes(`id="${id}"`));
}

/* ---------- 报告 ---------- */
console.log(`✅ 通过 ${pass} · 失败 ${fails.length}`);
if (fails.length) {
  console.error("\n❌ 失败用例：");
  for (const f of fails) console.error("   - " + f);
  process.exit(1);
}
console.log("OK — all tests passed");
