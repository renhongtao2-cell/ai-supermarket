// affiliate.mjs — 联盟链接的「单一来源」
//
// 为什么要有这个文件：目录站有 7 处出站链接的发射点（3 个生成器 + app.js + 静态卡片），
// 把联盟参数散在各处 = 改一个忘一个。这里统一成一个注册表 + 一个 outbound()，
// 所有发射点都调它。
//
// 两种状态：
//   link: ""        → 还没注册，链接保持原样（**零风险，可先上线**）
//   link: "https://…" → 已拿到联盟链接，自动换成联盟链接 + rel="sponsored"
//
// 所以正确的上线顺序是：先把这套东西部署（全是普通链接），再去逐个注册，
// 拿到一个填一个。不需要一次性填完。
//
// 合规（不是可选项）：
//   - Google 要求联盟链接标 rel="sponsored"（或至少 nofollow），否则可能被判为链接作弊
//   - FTC 要求页面上有「可能获得佣金」的披露，见 /affiliate-disclosure
//
// 运行 node scripts/affiliate-status.mjs 看还差哪些。

/* ------------------------------------------------------------------
   注册表。key 必须与 js/data.js 里的 name 字段逐字一致。
   verified: 该计划「存在且条款已人工核实」的日期；null = 未核实，需自行确认。
   ------------------------------------------------------------------ */
export const PROGRAMS = {
  /* ---- 已核实（2026-09-19 从官方页面确认） ---- */
  Semrush: {
    program: "Semrush Affiliate",
    network: "Impact",
    payout: "$100–300 / 单，$10 / 试用",
    recurring: false,
    cookie: "120 天",
    signup: "https://www.semrush.com/lp/affiliate-program/en/",
    verified: "2026-09-19",
    link: "",
    note: "客单价最高的一条。工具目录里的 SEO 类页面都能挂。",
  },
  Jasper: {
    program: "Jasper Affiliate",
    network: "FirstPromoter",
    payout: "25%（满 100 单升 30%）",
    recurring: "12 个月",
    cookie: "14 天",
    signup: "https://www.jasper.ai/affiliates",
    verified: "2026-09-19",
    link: "",
    note: "$25 起付。Business 套餐不计佣。",
  },
  ElevenLabs: {
    program: "ElevenLabs Affiliate",
    network: "PartnerStack",
    payout: "22%",
    recurring: "12 个月",
    cookie: "未在页面公布",
    signup: "https://elevenlabs.io/affiliates",
    verified: "2026-09-19",
    link: "",
    note: "自助注册，无需审批。TTS/配音类需求量大。",
  },
  Surfer: {
    program: "Surfer Affiliate",
    network: "自有平台",
    payout: "最高 125%（结构以申请后协议为准）",
    recurring: "以协议为准",
    cookie: "未在页面公布",
    signup: "https://surferseo.com/affiliate-program/",
    verified: "2026-09-19",
    link: "",
    note: "需申请，官方称 24 小时内回复（工作日）。",
  },

  /* ---- 待核实：业内公认有联盟计划，但本次未逐个确认条款 ---- */
  Grammarly: { program: "Grammarly Affiliate", network: "Impact", payout: "待核实", signup: "https://www.grammarly.com/affiliates", verified: null, link: "" },
  Writesonic: { program: "Writesonic Affiliate", network: "待核实", payout: "待核实", signup: "https://writesonic.com/affiliate-program", verified: null, link: "" },
  Shopify: { program: "Shopify Affiliate", network: "Impact", payout: "待核实", signup: "https://www.shopify.com/affiliates", verified: null, link: "" },
  HubSpot: { program: "HubSpot Affiliate", network: "Impact", payout: "待核实", signup: "https://www.hubspot.com/partners/affiliates", verified: null, link: "" },
  ClickUp: { program: "ClickUp Affiliate", network: "待核实", payout: "待核实", signup: "https://clickup.com/affiliate", verified: null, link: "" },
  Rytr: { program: "Rytr Affiliate", network: "待核实", payout: "待核实", signup: "https://rytr.me/affiliate", verified: null, link: "" },
  Descript: { program: "Descript Affiliate", network: "待核实", payout: "待核实", signup: "https://www.descript.com/affiliates", verified: null, link: "" },
  HeyGen: { program: "HeyGen Affiliate", network: "待核实", payout: "待核实", signup: "https://www.heygen.com/affiliate-program", verified: null, link: "" },
  Synthesia: { program: "Synthesia Affiliate", network: "待核实", payout: "待核实", signup: "https://www.synthesia.io/affiliates", verified: null, link: "" },
  Murf: { program: "Murf Affiliate", network: "待核实", payout: "待核实", signup: "https://murf.ai/affiliate-program", verified: null, link: "" },
  Framer: { program: "Framer Affiliate", network: "待核实", payout: "待核实", signup: "https://www.framer.com/affiliates/", verified: null, link: "" },
};

/* 已确认「没有」联盟计划的，记下来，免得下次又去查一遍 */
export const NO_PROGRAM = {
  "Copy.ai": "2026-09-19 核实：官网已转向企业 GTM 平台，无自助联盟入口",
  Canva: "2026-09-19 核实：联盟并入 Canvassador 计划，目前暂停申请",
  Notion: "无公开联盟计划",
  Zapier: "无公开联盟计划",
  Make: "无公开联盟计划",
};

const AFF_ATTRS = 'rel="sponsored nofollow noopener" target="_blank"';
const PLAIN_ATTRS = 'rel="nofollow noopener" target="_blank"';

/**
 * 把一个工具的出站链接解析成最终 href + 属性。
 * @param {string} name 工具名（须与 data.js 一致）
 * @param {string} url  官网地址
 * @returns {{href:string, attrs:string, affiliate:boolean}}
 */
export function outbound(name, url) {
  const p = PROGRAMS[name];
  const hasLink = !!(p && p.link && /^https?:\/\//.test(p.link));
  return {
    href: hasLink ? p.link : url,
    attrs: hasLink ? AFF_ATTRS : PLAIN_ATTRS,
    affiliate: hasLink,
  };
}

/** 直接生成 <a> 标签，供生成器复用 */
export function outboundAnchor(name, url, inner, extraAttrs = "") {
  const o = outbound(name, url);
  return `<a href="${escAttr(o.href)}" ${o.attrs}${extraAttrs ? " " + extraAttrs : ""}>${inner}</a>`;
}

/** 当前接通情况统计 */
export function stats() {
  const all = Object.entries(PROGRAMS);
  const live = all.filter(([, p]) => p.link && /^https?:\/\//.test(p.link));
  const verified = all.filter(([, p]) => p.verified);
  return {
    registered: all.length,
    live: live.length,
    pending: all.length - live.length,
    verified: verified.length,
    liveNames: live.map(([n]) => n),
  };
}

function escAttr(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
