// site-nav.mjs — 全站「内容页入口」的唯一来源
//
// 为什么需要它：2026-09-18 实测发现首页与 21 个部门页对 4 个内容页（best/ × 3 + guides/ × 1）
// **零出链** —— 全站权重最高的两个来源完全不往那 36 条硬事实上导权重。
// 其中 best/free-tier-comparison 只有 1 条站内入链，等于做了一半。
//
// 为什么不直接改页脚模板：部门页与内容页每次部署都被生成器**全量重写**，
// 靠后处理脚本加的链接会被下一次部署擦掉（这个坑本项目已经踩过两次）。
// 所以：生成器里调用本模块（生成时就在），首页由 CLI 注入（首页不被全量重写）。
//
// 用法：
//   import { injectContentNav } from "./site-nav.mjs";
//   const FOOTER = injectContentNav(rawFooter);        // 生成器里包一层
//   node scripts/site-nav.mjs                          // CLI：注入 index.html 并自检
//   node scripts/site-nav.mjs --check                  // 只检查，不写盘（给闸门用）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");

/* 内容页清单 —— 加新内容页只改这里，别在别处再抄一份 */
export const CONTENT_LINKS = [
  {
    href: "/best/free-tier-comparison",
    label: "Free tier comparison",
    short: "Free tier comparison",
    desc: "36 allowances grouped by unit and renewal",
  },
  {
    href: "/best/ai-tools-with-free-tier",
    label: "Tools with a free tier",
    short: "Tools with a free tier",
    desc: "the published allowance for each tool",
  },
  {
    href: "/best/free-ai-tools",
    label: "Genuinely free tools",
    short: "Genuinely free tools",
    desc: "no paid gate at all",
  },
  {
    href: "/guides/how-to-choose-an-ai-tool",
    label: "How to choose an AI tool",
    short: "Choosing a tool",
    desc: "buying guide",
  },
];

const MARK = 'data-content-nav="1"';

/* ---------- 形态 A：首页的 footer-grid（四栏）→ 追加一栏 ---------- */
function colBlock(indent) {
  const lines = [
    `<div class="footer-col" ${MARK}>`,
    `  <h4>Free Tier Data</h4>`,
    `  <nav class="footer-links">`,
    ...CONTENT_LINKS.map((l) => `    <a href="${l.href}">${l.short}</a>`),
    `  </nav>`,
    `</div>`,
  ];
  return indent + lines.join("\n" + indent);
}

/* ---------- 形态 B：部门页/内容页（只有 footer-bottom）→ 在它之前插一段 ----------
   这里用内联样式是有意的：本块要能独立于 css/style.css 存在（少一处「改了 CSS 忘了
   同步版本」的失败点）。注意 CSS 本身每次部署都会被 version-assets.mjs 重新内联进
   HTML，所以改 css/style.css 并不需要手动升版本号 —— 见 cf-deploy.js 的调用顺序。 */
function navBlock(indent) {
  const lines = [
    `<div class="container" ${MARK} style="padding:20px 20px 6px;border-top:1px solid rgba(128,128,128,.18);margin-top:18px">`,
    `  <p style="margin:0 0 9px;font-size:12.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;opacity:.55">Free tier data &amp; guides</p>`,
    `  <ul style="margin:0;padding:0;list-style:none;font-size:14.5px;line-height:1.7;opacity:.85">`,
    ...CONTENT_LINKS.map(
      (l) =>
        `    <li><a href="${l.href}" style="color:inherit;text-decoration:underline;text-decoration-color:rgba(128,128,128,.45)">${l.label}</a> — ${l.desc}</li>`
    ),
    `  </ul>`,
    `</div>`,
  ];
  return indent + lines.join("\n" + indent);
}

/* 从 anchor 所在行的行首切分，返回 { at, indent }。
   为什么不直接 slice(0, anchor)：anchor 前面还带着它自己那一行的缩进，
   直接切会把这段缩进复制到注入块前面，块整体多缩一层。 */
function lineAnchor(html, anchor) {
  const at = html.lastIndexOf("\n", anchor) + 1;
  const indent = html.slice(at, anchor) || "    ";
  return { at, indent };
}

/**
 * 幂等注入。自动识别页脚形态；已注入过则原样返回。
 * 抛错而不是静默跳过 —— 页脚结构变了要立刻知道，否则链接会无声消失。
 */
export function injectContentNav(html) {
  if (html.includes(MARK)) return html;
  // 形态 A：首页 —— 在 footer-grid 的最后一个 </div> 前插一栏
  const gridOpen = html.indexOf('<div class="container footer-grid">');
  if (gridOpen !== -1) {
    // 找到与该 div 匹配的收尾 </div>（只数 div，够用且不依赖缩进）
    let depth = 0, i = gridOpen;
    const re = /<div\b|<\/div>/g;
    re.lastIndex = gridOpen;
    let m;
    while ((m = re.exec(html)) !== null) {
      depth += m[0] === "</div>" ? -1 : 1;
      if (depth === 0) { i = m.index; break; }
    }
    if (depth !== 0) throw new Error("site-nav: 首页 footer-grid 未闭合，拒绝注入");
    // 缩进对齐兄弟节点（= 容器行缩进 + 一级），不是对齐收尾 </div> 的缩进
    const { at } = lineAnchor(html, i);
    const childIndent = lineAnchor(html, gridOpen).indent + "  ";
    return html.slice(0, at) + colBlock(childIndent) + "\n" + html.slice(at);
  }

  // 形态 B：部门页 / 内容页 —— 插在 footer-bottom 之前
  const bottom = html.indexOf('<div class="container footer-bottom">');
  if (bottom !== -1) {
    const { at, indent } = lineAnchor(html, bottom);
    return html.slice(0, at) + navBlock(indent) + "\n" + html.slice(at);
  }

  throw new Error("site-nav: 未识别的页脚结构（既没有 footer-grid 也没有 footer-bottom）");
}

/* ---------- 刷新支持：摘掉之前注入的块 ----------
   为什么需要：注入块是「一次写入、永不更新」的。改了块里的文案/样式后，
   光靠 injectContentNav 的「已存在就跳过」会让改动永远不生效（而且没有任何报错）。
   定位方式：从标记所在的那个 <div 起做 div 配平，连同行首缩进一起摘掉。 */
export function stripContentNav(html) {
  const mark = html.indexOf(MARK);
  if (mark === -1) return html;
  const start = html.lastIndexOf("<div", mark);
  if (start === -1) throw new Error("site-nav: 找到标记但找不到所属 <div>，拒绝改写");
  let depth = 0, end = -1;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let m;
  while ((m = re.exec(html)) !== null) {
    depth += m[0] === "</div>" ? -1 : 1;
    if (depth === 0) { end = m.index + "</div>".length; break; }
  }
  if (end === -1) throw new Error("site-nav: 已注入块未闭合，拒绝改写");
  const { at } = lineAnchor(html, start);
  return html.slice(0, at) + html.slice(end).replace(/^\r?\n/, "");
}

/* ---------- CLI：注入首页 ---------- */
// 只在「本文件就是入口脚本」时执行 —— 被生成器 import 时不能跑，
// 否则生成器一加载就会顺手改首页，副作用不可见。
const isEntry =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntry) {
  const CHECK = process.argv.includes("--check");
  const TARGETS = ["index.html"]; // 其余页面由生成器负责
  let changed = 0, bad = 0;
  for (const rel of TARGETS) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) { console.warn(`  跳过（不存在）: ${rel}`); continue; }
    const before = fs.readFileSync(p, "utf8");
    let after;
    // 先摘后注：这样块内的改动（文案/样式）才能刷新，而不是被「已存在」挡住
    try { after = injectContentNav(stripContentNav(before)); }
    catch (e) { console.error(`  ✗ ${rel}: ${e.message}`); bad++; continue; }
    if (after === before) { console.log(`  = ${rel} 已是目标状态`); continue; }
    if (!CHECK) fs.writeFileSync(p, after);
    console.log(`  ✓ ${rel} ${CHECK ? "需要注入/刷新" : "已注入/刷新内容页入口"}`);
    changed++;
  }
  // 自检：目标页面必须真的含全部内容页链接
  for (const rel of TARGETS) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    const h = fs.readFileSync(p, "utf8");
    const miss = CONTENT_LINKS.filter((l) => !h.includes(`href="${l.href}"`));
    if (miss.length) { console.error(`  ✗ ${rel} 缺少 ${miss.length} 个内容页链接: ${miss.map((m) => m.href).join(", ")}`); bad++; }
  }
  if (bad) { console.error(`site-nav: ${bad} 个问题`); process.exit(1); }
  console.log(`site-nav: 完成（${changed} 个文件${CHECK ? "待注入" : "已更新"}）`);
}
