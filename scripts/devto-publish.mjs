// devto-publish.mjs — 把 outputs/devto-*.md 发到 Dev.to，canonical 指向 SerpPrism
//
// 为什么有这个脚本：Dev.to 编辑器里 canonical 字段的位置极难找（富文本编辑器是
// 底部「Save draft」旁边的六边形 ⬡ 图标），手抄 canonical 三次都没找到。
// 走 API 就完全绕开 UI，而且 canonical_url 是官方字段，比手填可靠。
//
// 关键设计：**草稿 → 回读校验 canonical → 才发布**。
// 直接 published:true 发出去，如果 canonical 没生效，就等于把同一篇文章在
// dev.to 和 serpprism.com 各放一份，Google 判定重复内容，SEO 权重被稀释。
// 所以必须先建草稿、用 GET 回读确认 canonical_url 真的生效，再发。
//
// 幂等：先拉 /api/articles/me/all，canonical 已存在的直接跳过，不会重发两遍。
//
// 用法：
//   DEVTO_KEY=xxx node scripts/devto-publish.mjs              # 发 outputs/devto-*.md（全部）
//   DEVTO_KEY=xxx node scripts/devto-publish.mjs --dry-run    # 只解析不请求
//   node scripts/devto-publish.mjs --file=outputs/devto-x.md  # 只发一篇
//   node scripts/devto-publish.mjs --publish-drafts           # 把草稿箱里的都发布（配 RSS 导入用）
//   node scripts/devto-publish.mjs --publish-drafts --dry-run # 先看清单
//   或把 key 写进 .workbuddy/devto.env（已 gitignore）：DEVTO_KEY=xxx
//   拿 key：dev.to/settings/extensions → 页面**最底部** → DEV Community API Keys
//
// ⚠️ 传输用 curl 而不是 fetch：Node 的 fetch/undici 不读 HTTP_PROXY，
//    哪天直连又不通时没法走代理。curl 两级都能走 —— 与 survey-*.mjs 同一套做法。
//    注：2026-09-23 复测**本机直连 dev.to API 是通的**（200 / 0.9s），
//    所以正常情况下会走直连分支；代理只是兜底，不是必需。
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const API = "https://dev.to/api";
const PROXY = process.env.SURVEY_PROXY || "http://127.0.0.1:10809";
const OUT = path.join(ROOT, "outputs");

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const PUB_DRAFTS = argv.includes("--publish-drafts");
const ONLY = (argv.find((a) => a.startsWith("--file=")) || "").split("=")[1];

/* ---------- API key：环境变量 > .workbuddy/devto.env ---------- */
let KEY = process.env.DEVTO_KEY || "";
if (!KEY) {
  const envFile = path.join(ROOT, ".workbuddy", "devto.env");
  try {
    const m = fs.readFileSync(envFile, "utf8").match(/^\s*DEVTO_KEY\s*=\s*(.+?)\s*$/m);
    if (m) KEY = m[1];
  } catch {
    /* 文件不存在就靠环境变量 */
  }
}
if (!KEY && !DRY) {
  console.error(
    "❌ 没有 Dev.to API key。\n" +
      "   方式一：DEVTO_KEY=xxx node scripts/devto-publish.mjs\n" +
      "   方式二：把 DEVTO_KEY=xxx 写进 .workbuddy/devto.env（已 gitignore）\n" +
      "   拿 key：dev.to/settings/extensions → DEV Community API Keys → Generate API Key"
  );
  process.exit(1);
}

/* ---------- front matter 解析 ---------- */
function parseArticle(file) {
  const raw = fs.readFileSync(file, "utf8");
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_]+)\s*:\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  if (!fm.canonical_url || !fm.title) return null;
  // ⚠️ tags 必须是**数组**，不能是 "a, b, c" 字符串。
  //    Forem 的 strong params 里声明的是 `{ tags: [] }`（concerns/api/articles_controller.rb），
  //    传字符串会被静默过滤掉 —— 不报错、不 422，只是发出去的文章**一个标签都没有**。
  const tags = (fm.tags || "")
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean)
    .slice(0, 4); // dev.to 最多 4 个标签，多的会被丢弃
  return {
    file,
    title: fm.title,
    description: fm.description || "",
    tags,
    canonical_url: fm.canonical_url,
    main_image: fm.main_image || null,
    body_markdown: m[2].trim(),
  };
}

/* ---------- 两级传输：先直连，失败再走代理 ---------- */
function curlJson(args, body) {
  const base = ["-sS", "--max-time", "45", "-H", `api-key: ${KEY}`,
    "-H", "Content-Type: application/json", "-H", "Accept: application/vnd.forem.api-v1+json"];
  const tail = ["-w", "\n__HTTP__%{http_code}"];
  const payload = body ? ["--data-binary", JSON.stringify(body)] : [];

  const run = (extra) => {
    const out = execFileSync("curl", [...base, ...extra, ...args, ...payload, ...tail], {
      encoding: "utf8",
      maxBuffer: 1 << 26,
    });
    const i = out.lastIndexOf("\n__HTTP__");
    return { status: Number(out.slice(i + 9).trim()), body: out.slice(0, i) };
  };

  // 先直连（境外机器/已翻墙时更快），失败再走代理。
  // 注意：退出码 5 = 解析不了代理地址（传错参数），28 = 超时 —— 两者不要混为一谈。
  try {
    const r = run(["--noproxy", "*"]);
    if (r.status >= 200 && r.status < 500) return r;
    if (r.status === 0) throw new Error("direct: no response");
    return r;
  } catch {
    return run(["-x", PROXY]);
  }
}

function api(method, p, body) {
  const r = curlJson(["-X", method, `${API}${p}`], body);
  let json = null;
  try {
    json = JSON.parse(r.body);
  } catch {
    /* 非 JSON 响应（如 Cloudflare 拦截页） */
  }
  if (![200, 201].includes(r.status)) {
    const detail = json?.error || json?.message || r.body.slice(0, 200);
    throw new Error(`${method} ${p} → HTTP ${r.status}: ${detail}`);
  }
  return json;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- 模式 C：把草稿箱里的都发出去（配 RSS 导入用）----------
 * 场景：RSS 导入把 serpprism.com 的文章自动搬进 dev.to，但只到**草稿箱**。
 *       这个模式把草稿批量发布 —— RSS 管搬运、这一步管发布，合起来才是真全自动。
 * 安全线：canonical_url 为空的**不发**（发出去就是一份没有指向主站的重复内容）。
 *       想强行发加 --force。
 */
/* 把 front matter 里的 published 和 tags 一起改掉。
   ⚠️ 为什么必须连 tags 一起改：RSS 导入进来的 body_markdown 的 front matter 长这样
   （Forem 的 Feeds::AssembleArticleMarkdown 拼的）：
       ---
       title: ...
       published: false
       date: ...
       tags:                 ← 空的！feed 没 <category> 时就是空
       canonical_url: ...
       ---
   front matter 的优先级高于 JSON 字段，所以光在 PUT body 里传 tags 会被这个**空的
   `tags:` 行**覆盖掉 → 文章发出去一个标签都没有。必须在 front matter 里写死。
   （2026-09-23：8 篇 RSS 草稿全是「tags（无）」就是这么来的） */
function setFrontMatter(md, { published, tags }) {
  if (!/^---\r?\n/.test(md)) return md;
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return md;
  let fm = m[1];
  const pub = published ? "true" : "false";
  fm = /published\s*:/i.test(fm)
    ? fm.replace(/published\s*:\s*(?:false|true)/i, `published: ${pub}`)
    : `${fm}\npublished: ${pub}`;
  const tagStr = (tags || []).join(", ");
  if (tagStr) {
    fm = /^tags\s*:/im.test(fm)
      ? fm.replace(/^tags\s*:.*$/im, `tags: ${tagStr}`)
      : `${fm}\ntags: ${tagStr}`;
  }
  return `---\n${fm}\n---\n${md.slice(m[0].length)}`;
}

/* canonical → tags 映射，由 gen-seosite.mjs 从 GUIDES 生成（单一数据源）。
   读不到就退化成空 map（不报错）—— 那时草稿会保留原有标签，不会因为读不到文件而挂掉。 */
function loadTagMap() {
  try {
    const p = path.join(ROOT, "assets", "devto-tags.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    console.error("  ⚠️ 读不到 assets/devto-tags.json（先跑 node scripts/gen-seosite.mjs），本次不补标签");
    return {};
  }
}

async function publishDrafts() {
  const force = argv.includes("--force");
  // 每次最多发几篇（默认 2）。RSS 导入可能一次灌进 7 篇草稿，
  // 一口气全发出去在新账号上很像 spam；限量让它几天内自然滴出来。
  // 改上限：--max=5；不限：--max=0。
  const MAX = Number((argv.find((a) => a.startsWith("--max=")) || "").split("=")[1] || 2);
  const drafts = api("GET", "/articles/me/unpublished?per_page=1000");
  if (!drafts.length) return console.log("草稿箱是空的，没有要发布的。");

  // ⚠️ 去重护栏：RSS 导入是按 feed 的 <link> 建草稿，**不一定**跟已有文章的
  //    canonical_url 去重。本站 feed 里 7 篇有 3 篇已经手动发过 —— 若导入器不去重，
  //    这里再发一遍就是 Dev.to 上 3 组重复文章。所以发布前先查「同 canonical 是否
  //    已有已发布文章」，有就跳过（不是失败，是本来就不该发）。
  const published = new Set();
  try {
    for (const x of api("GET", "/articles/me/published?per_page=1000")) {
      if (x.canonical_url) published.add(x.canonical_url);
    }
  } catch (e) {
    console.error(`  ⚠️ 已发布列表拉取失败，去重护栏失效：${e.message}`);
  }

  console.log(`草稿箱 ${drafts.length} 篇${DRY ? "（--dry-run，不实际发布）" : ""} · 每次上限 ${MAX || "不限"}\n`);
  const TAGS = loadTagMap();
  let ok = 0, skip = 0, dup = 0, failed = 0;
  for (const d of drafts) {
    if (MAX && ok >= MAX) {
      console.log(`\n已达本次上限 ${MAX} 篇，其余留到下次（草稿不会丢）。`);
      break;
    }
    const canon = d.canonical_url || "";
    // RSS 导入的草稿 tag_list 为空 → 按 canonical 从 GUIDES 生成的映射补上。
    // 已有标签的（比如手动发的）不动。
    const tags = (d.tag_list || []).length ? d.tag_list : TAGS[canon] || [];
    console.log(`=== ${d.title}`);
    console.log(`    id ${d.id} · ${d.body_markdown ? d.body_markdown.split(/\s+/).length : "?"} 词`);
    console.log(`    canonical ${canon || "（空）"}`);
    console.log(
      `    tags ${(d.tag_list || []).join(", ") || "（无）"}${
        tags.length && !(d.tag_list || []).length ? ` → 补为 ${tags.join(", ")}` : ""
      }`
    );
    if (!canon && !force) {
      console.log("  ⏭  没有 canonical，跳过（要强行发加 --force）");
      skip++;
      continue;
    }
    if (canon && published.has(canon)) {
      console.log(`  ⏭  同 canonical 已有已发布文章，跳过（RSS 导入的重复稿）—— 可去 dashboard 删掉这条草稿`);
      dup++;
      continue;
    }
    if (DRY) continue;

    // ⚠️ 逐篇 try/catch：Dev.to 会偶发返回 500（2026-09-23 实测，同一篇重试即成功）。
    //    不接住的话一篇的 500 会把整个批次打断 —— 自动化里表现为 exit 1，
    //    剩下的草稿全发不出去。所以单篇失败只记一笔、继续下一篇。
    const body = setFrontMatter(d.body_markdown || "", { published: true, tags });
    let pub = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        pub = api("PUT", `/articles/${d.id}`, {
          article: {
            title: d.title,
            body_markdown: body,
            published: true,
            ...(canon ? { canonical_url: canon } : {}),
            ...(tags.length ? { tags } : {}),
          },
        });
        break;
      } catch (e) {
        // 5xx 才重试；4xx（key 错、字段非法）重试没意义，直接记失败。
        const is5xx = /\bHTTP 5\d\d\b/.test(e.message);
        if (attempt === 1 && is5xx) {
          console.log(`  ↻ 第 1 次 PUT 遇到 ${e.message.split(":")[0].trim()}，2 秒后重试…`);
          await sleep(2000);
          continue;
        }
        console.error(`  ❌ ${e.message}`);
        failed++;
        pub = null;
        break;
      }
    }
    if (!pub) {
      await sleep(1200);
      continue;
    }

    // ⚠️ 和主流程同一套回读规则（2026-09-23 实测的坑）：
    // 1) 刚发布的文章按 id GET 可能 404 / 仍报 published=false —— 有传播延迟。
    //    不能把「PUT 成功 + 立刻回读 false」判成失败，否则自动化下次会再 PUT 一遍，
    //    而 PUT 是整体更新 + 幂等键没对上时就等于出两份。
    // 2) 读不到就退回列表按 canonical 反查。
    let after = null;
    try {
      after = api("GET", `/articles/${d.id}`);
    } catch {
      after = findByCanonical(canon);
    }
    if (!after) {
      console.error(`  ⚠️ 发布后两种回读都拿不到，请人工确认：${pub.url}`);
      skip++;
      continue;
    }
    if (canon && after.canonical_url !== canon) {
      console.error(`  ⚠️ 已发布但 canonical 掉了（${after.canonical_url || "空"}）—— 去 dashboard 补：${pub.url}`);
      skip++;
      continue;
    }
    if (!after.published) {
      // 传播延迟：等 3 秒再反查一次，仍 false 才算「PUT 成功但没真正发出」。
      await sleep(3000);
      const retry = findByCanonical(canon);
      if (retry && retry.published) {
        console.log(`  🚀 已发布 ${pub.url}（首次回读有延迟，二次确认 published=true）`);
        ok++;
        await sleep(1200);
        continue;
      }
      console.error(`  ⚠️ PUT 返回成功但二次确认仍是草稿，去 dashboard 手动发：${pub.url}`);
      skip++;
      continue;
    }
    console.log(`  🚀 已发布 ${pub.url}`);
    ok++;
    await sleep(1200);
  }
  console.log(`\n完成：${ok} 篇发布，${skip} 篇跳过，${dup} 篇重复稿（同 canonical 已发过）${failed ? `，${failed} 篇失败` : ""}。`);
}

/* ---------- 主流程 ---------- */
if (PUB_DRAFTS) {
  try {
    await publishDrafts();
  } catch (e) {
    console.error(`❌ ${e.message}`);
    console.error("   常见原因：key 没复制全 / key 已失效 / 本机到 dev.to 不通。");
    process.exit(1);
  }
  process.exit(0);
}

const files = fs
  .readdirSync(OUT)
  .filter((f) => f.startsWith("devto-") && f.endsWith(".md"))
  .filter((f) => (ONLY ? path.basename(ONLY) === f : true))
  .map((f) => ({ f, a: parseArticle(path.join(OUT, f)) }))
  .filter((x) => x.a);

if (!files.length) {
  console.error("❌ outputs/ 下没有带 front matter（title + canonical_url）的 devto-*.md");
  process.exit(1);
}

console.log(`待处理 ${files.length} 篇${DRY ? "（--dry-run，不实际请求）" : ""}\n`);
for (const { a } of files) {
  console.log(`  · ${a.title}`);
    console.log(`    canonical ${a.canonical_url}`);
    console.log(`    tags      ${a.tags.join(", ") || "(无)"}`);
  console.log(`    body      ${a.body_markdown.split(/\s+/).length} 词`);
}
if (DRY) process.exit(0);

// 已存在的（按 canonical 比对）→ 跳过，避免重发两份
// key 无效时这里会 401。不接住的话会甩一整屏堆栈，看不出到底是 key 错还是网络错。
let mine = [];
try {
  mine = api("GET", "/articles/me/all?per_page=1000");
} catch (e) {
  console.error(`❌ 连不上 Dev.to API：${e.message}`);
  console.error("   常见原因：key 没复制全 / key 已失效 / 本机到 dev.to 不通。");
  process.exit(1);
}
const existing = new Map();
for (const x of mine) if (x.canonical_url) existing.set(x.canonical_url, x);

/* ⚠️ 草稿的回读必须走列表接口，不能走 /api/articles/{id}。
   2026-09-23 实测：GET /api/articles/{id} 对**草稿**一律 404（带不带 api-key 都一样），
   对已发布文章才返回 200 —— Dev.to 不把草稿暴露在那个公开端点上。
   所以：草稿阶段用列表按 canonical 反查，发布**之后**再用 id 回读。
   列表接口返回 canonical_url / tag_list / description / cover_image，够校验了。 */
function findByCanonical(canon) {
  try {
    const list = api("GET", "/articles/me/all?per_page=1000");
    return list.find((x) => x.canonical_url === canon) || null;
  } catch (e) {
    console.error(`  ⚠️ 列表拉取失败：${e.message}`);
    return null;
  }
}

let done = 0;
for (const { a } of files) {
  console.log(`\n=== ${a.title}`);

  let target = existing.get(a.canonical_url) || null;
  if (target && target.published) {
    console.log(`  ⏭  已发布，跳过 — ${target.url}`);
    continue;
  }

  if (target) {
    console.log(`  ↻  已存在草稿 id=${target.id}，沿用（不再新建，避免同一篇出两份）`);
  } else {
    // 1) 先建草稿
    const draft = api("POST", "/articles", {
      article: {
        title: a.title,
        body_markdown: a.body_markdown,
        published: false,
        ...(a.description ? { description: a.description } : {}),
        ...(a.tags.length ? { tags: a.tags } : {}),
        ...(a.main_image ? { main_image: a.main_image } : {}),
        canonical_url: a.canonical_url,
      },
    });
    console.log(`  草稿已建 id=${draft.id}`);
    await sleep(1200);
    target = findByCanonical(a.canonical_url);
  }

  // 2) 回读校验 —— 这一步是整条链路的保险，不能省
  if (!target) {
    console.error("  ❌ 列表里查不到这篇文章，保持不发布。");
    continue;
  }
  if (target.canonical_url !== a.canonical_url) {
    console.error(
      `  ❌ canonical 没生效（拿到 ${target.canonical_url || "空"}），保持草稿不发布。\n` +
        `     id=${target.id} — 去 dev.to/dashboard 手动填 canonical 或删掉重试。`
    );
    continue;
  }
  console.log(`  ✅ canonical 校验通过 ${target.canonical_url}`);
  if (a.tags.length && !(target.tag_list || []).length) {
    console.error("  ❌ 标签没生效（tag_list 为空），保持草稿不发布。");
    continue;
  }
  await sleep(1200);

  // 3) 校验过了才发布。
  //    canonical_url 再带一次：PUT 是整体更新，少传一个字段就等于把它清掉的风险不值得赌，
  //    多传 40 字节而已。（front matter 不在 body 里，所以不会被它覆盖回去）
  const pub = api("PUT", `/articles/${target.id}`, {
    article: {
      title: a.title,
      body_markdown: a.body_markdown,
      published: true,
      canonical_url: a.canonical_url,
      ...(a.description ? { description: a.description } : {}),
      ...(a.tags.length ? { tags: a.tags } : {}),
      ...(a.main_image ? { main_image: a.main_image } : {}),
    },
  });

  // 4) 发布后再回读一次 —— 「发出去那一刻 canonical 还在不在」才是真正要保证的事。
  //    ⚠️ 刚发布的文章用 /api/articles/{id} 查也可能 404（有传播延迟：2026-09-23 实测
  //    发布成功后立刻按 id 查仍是 404，但列表里已经是 published=true、canonical 正确）。
  //    所以 id 读不到就退回列表查 —— 不能把「读不到」误判成「发布失败」，
  //    否则会以为没发成功而重发一遍，那才是真的出两份。
  let after = null;
  try {
    after = api("GET", `/articles/${target.id}`);
  } catch {
    after = findByCanonical(a.canonical_url);
  }
  if (!after) {
    console.error(`  ⚠️ 发布后两种回读都拿不到，请人工确认：${pub.url || target.url}`);
    continue;
  }
  if (after.canonical_url !== a.canonical_url) {
    console.error(
      `  ⚠️ 已发布，但发布后 canonical 变成了 ${after.canonical_url || "空"}！\n` +
        `     ${pub.url} — 立刻去 dev.to/dashboard 手动补 canonical。`
    );
    continue;
  }
  if (!after.published) {
    // ⚠️ 别急着判失败：发布状态有传播延迟。2026-09-23 三篇全部遇到
    // 「PUT 成功 + 立刻回读 published=false」，但过几秒再查就是 true。
    // 直接判失败会让人以为没发出去而去手动重发 —— 那才真会出两份。
    await sleep(3000);
    const retry = findByCanonical(a.canonical_url);
    if (retry && retry.published) {
      console.log(`  🚀 已发布 ${retry.url}（首次回读有延迟，二次确认 published=true）`);
      done++;
      await sleep(1200);
      continue;
    }
    console.error(`  ⚠️ PUT 返回成功但二次确认仍是草稿，去 dashboard 手动发布：${pub.url || target.url}`);
    continue;
  }
  console.log(`  🚀 已发布 ${pub.url}`);
  done++;
  await sleep(1200);
}

console.log(`\n完成：${done} 篇新发布，${files.length - done} 篇跳过/未发。`);
console.log("核对：dev.to/dashboard → 每篇的 canonical 都应指向 serpprism.com");
