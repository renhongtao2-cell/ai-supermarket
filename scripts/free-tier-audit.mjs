// free-tier-audit.mjs — AI 工具「免费额度」事实抽取（第一遍自动初筛 + 人工复核队列）
// 用法:
//   node scripts/free-tier-audit.mjs --limit 20        # 试跑前 20 个
//   node scripts/free-tier-audit.mjs --all             # 全量
//   node scripts/free-tier-audit.mjs --all --concurrency 6
//
// 产出:
//   .workbuddy/free-tier-audit.json    结构化结果（供后续生成页面）
//   outputs/free-tier-review-<日期>.md 人工复核队列（按置信度排序）
//
// 设计原则：只抽「可验证的短事实」，不做推断。抽不到就标 unknown，绝不猜。

import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import tls from 'node:tls';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'js', 'data.js');
const OUT_JSON = path.join(ROOT, '.workbuddy', 'free-tier-audit.json');
const OUT_MD_DIR = path.join(ROOT, 'outputs');
const TEXT_DIR = path.join(ROOT, '.workbuddy', 'free-tier-text');

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const valOf = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const LIMIT = has('--all') ? Infinity : parseInt(valOf('--limit', '20'), 10);
const CONC = parseInt(valOf('--concurrency', '5'), 10);
// 只跑指定工具（逗号分隔，按名字精确匹配）—— 补抓时用，不必重跑全量
const ONLY = (valOf('--only', '') || '').split(',').map(s => s.trim()).filter(Boolean);
// 强制走无头浏览器（JS 渲染）。默认是 direct → proxy → browser 逐级降级，
// direct 一成功就停，导致 JS 渲染站只拿到导航栏。补抓这类站点时加这个。
const FORCE_BROWSER = has('--force-browser');
// 本机代理：Node 的 fetch 不读 HTTP_PROXY 环境变量，被封域名必须走这里
const PROXY = valOf('--proxy', 'http://127.0.0.1:10809');
const NO_PROXY = has('--no-proxy');
const NO_BROWSER = has('--no-browser');
// 从已落盘的原文重抽信号，完全不联网 —— 迭代抽取规则时用这个，别再重新抓一遍
const FROM_CACHE = has('--from-cache');
// 单个工具硬超时（毫秒），防止个别站点把整轮跑挂住
const TOOL_TIMEOUT = parseInt(valOf('--tool-timeout', '90000'), 10);
const CHROME = valOf('--chrome', 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe');
const PW_MODULE = 'file:///C:/Users/Administrator/node_modules/playwright-core/index.js';
const PROXY_HOST = PROXY.replace(/^https?:\/\//, '').split(':')[0];
const PROXY_PORT = parseInt(PROXY.replace(/^https?:\/\//, '').split(':')[1] || '10809', 10);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// ---------- 经代理的 HTTPS 请求（CONNECT 隧道，零依赖）----------
function tunnel(targetHost, targetPort, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(PROXY_PORT, PROXY_HOST, () => {
      socket.write(`CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n\r\n`);
    });
    let buf = Buffer.alloc(0);
    const onData = chunk => {
      buf = Buffer.concat([buf, chunk]);
      const i = buf.indexOf('\r\n\r\n');
      if (i === -1) return;
      socket.removeListener('data', onData);
      const head = buf.slice(0, i).toString('latin1');
      if (!/^HTTP\/1\.[01] 200/.test(head)) { socket.destroy(); return reject(new Error('PROXY ' + (head.split('\r\n')[0] || 'DENIED'))); }
      resolve(socket);
    };
    socket.on('data', onData);
    socket.on('error', e => reject(new Error('PROXY ' + (e.code || e.message))));
    socket.setTimeout(timeoutMs, () => { socket.destroy(); reject(new Error('PROXY_TIMEOUT')); });
  });
}

async function proxyGet(url, timeoutMs, hops = 0) {
  const u = new URL(url);
  const socket = await tunnel(u.hostname, 443, timeoutMs);
  socket.setTimeout(0);
  const r = await new Promise((resolve, reject) => {
    const req = https.request({
      method: 'GET',
      path: u.pathname + u.search,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*', 'Accept-Language': 'en-US,en;q=0.9' },
      createConnection: () => tls.connect({ socket, servername: u.hostname }),
    }, res => {
      const chunks = [];
      let n = 0;
      res.on('data', d => { n += d.length; if (n < 3e6) chunks.push(d); });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), finalUrl: url }));
    });
    req.on('error', e => reject(new Error(e.code || e.message)));
    req.setTimeout(timeoutMs, () => req.destroy(new Error('TIMEOUT')));
    req.end();
  });
  if (r.status >= 300 && r.status < 400 && r.headers.location && hops < 4) {
    return proxyGet(new URL(r.headers.location, url).href, timeoutMs, hops + 1);
  }
  return r;
}

// 直连（住宅 IP，能过一部分 Cloudflare；但 GFW 封的域名连不上）
async function directGet(url, timeoutMs) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      redirect: 'follow', signal: c.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*', 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const body = await r.text();
    return { status: r.status, headers: Object.fromEntries(r.headers), body, finalUrl: r.url };
  } finally { clearTimeout(t); }
}

// ---------- 第三级：无头浏览器（过 Cloudflare 人机验证 + 渲染 JS）----------
let _browser = null, _ctx = null;
async function getBrowser() {
  if (_browser) return _browser;
  const pw = await import(PW_MODULE);
  const chromium = pw.chromium || (pw.default && pw.default.chromium);
  _browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    proxy: { server: PROXY },
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  _ctx = await _browser.newContext({ userAgent: UA, locale: 'en-US', viewport: { width: 1366, height: 900 } });
  await _ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  return _browser;
}
async function closeBrowser() { try { if (_browser) await _browser.close(); } catch {} _browser = null; _ctx = null; }

async function browserGet(url, timeoutMs = 32000) {
  await getBrowser();
  const page = await _ctx.newPage();
  try {
    await page.route('**/*', route => {
      const t = route.request().resourceType();
      return (t === 'image' || t === 'font' || t === 'media' || t === 'stylesheet') ? route.abort() : route.continue();
    });
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(2200);
    const text = await page.evaluate(() => (document.body ? document.body.innerText : ''));
    const html = await page.content();
    return { status: resp ? resp.status() : 0, headers: {}, body: text, text, html, finalUrl: page.url() };
  } finally { await page.close(); }
}

// 三级降级：直连 → 代理 → 无头浏览器。谁先成功用谁。
async function fetchText(url, timeoutMs = 18000) {
  // FORCE_BROWSER：跳过 direct/proxy，直接上无头浏览器。
  // 用于补抓 JS 渲染站 —— direct 能拿到很长的导航文本，于是永远不会升级到 browser，
  // 结果正文（含定价）全是空的。
  const tries = FORCE_BROWSER ? ['browser'] : ['direct'];
  if (!FORCE_BROWSER) {
    if (!NO_PROXY) tries.push('proxy');
    if (!NO_BROWSER) tries.push('browser');
  }
  const attempts = [];
  for (const mode of tries) {
    try {
      let r, text;
      if (mode === 'direct') { r = await directGet(url, timeoutMs); text = stripHtml(r.body); }
      else if (mode === 'proxy') { r = await proxyGet(url, timeoutMs); text = stripHtml(r.body); }
      else { r = await browserGet(url); text = r.text; }
      attempts.push({ mode, status: r.status, len: text.length });
      if (r.status >= 200 && r.status < 400 && text.length > 0) return { ok: true, status: r.status, text, html: r.html || '', via: mode };
    } catch (e) {
      attempts.push({ mode, status: 0, err: String(e.message || e.name).slice(0, 32) });
    }
  }
  const best = attempts.find(a => a.status >= 200 && a.status < 300) || attempts[attempts.length - 1];
  return { ok: false, status: best.status || 0, text: '', note: best.err || ('HTTP ' + best.status), attempts };
}

// ---------- 载入工具库 ----------
const src = fs.readFileSync(DATA, 'utf8');
const { TOOLS } = new Function(src + '\n; return { TOOLS, DEPARTMENTS };')();

// ---------- 抓取（上面 proxyGet / fetchText 已定义）----------

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

// ---------- 定价页候选 ----------
const PRICE_PATHS = ['/pricing', '/plans', '/pricing/', '/plans/', '/pricing.html', '/upgrade', '/subscription'];

async function gatherText(baseUrl) {
  const u = new URL(baseUrl);
  const home = await fetchText(u.href);
  let best = home.ok ? { url: u.href, text: home.text, via: home.via } : { url: u.href, text: '', note: home.note || ('HTTP ' + home.status) };

  // 先看首页有没有 <a href> 指向定价页
  const candidates = new Set();
  if (home.ok && home.html) {
    for (const m of home.html.matchAll(/href=["']([^"']+)["']/gi)) {
      const href = m[1];
      if (/pricing|plans|upgrade|subscribe/i.test(href) && !/^https?:\/\/(?![\w.-]*\.)?(twitter|facebook|linkedin|x)\./i.test(href)) {
        try { candidates.add(new URL(href, u.href).href); } catch {}
        if (candidates.size >= 3) break;
      }
    }
  }
  for (const p of PRICE_PATHS) { try { candidates.add(new URL(p, u.origin).href); } catch {} }

  let pricing = null;
  for (const c of [...candidates].slice(0, 3)) {
    const r = await fetchText(c);
    if (r.ok && r.text.length > 400) { pricing = { url: c, text: r.text }; break; }
  }
  return { home: best, pricing };
}

// ---------- 信号抽取（只认明确措辞，不做推断）----------
const SIGNALS = [
  { key: 'noCreditCard',     label: '无需信用卡', re: /\b(no|without|not? requiring|doesn'?t require)\s+(a\s+)?credit\s*card\b|\bcredit\s*card\s*(is\s*)?(not\s*required|never\s*required)\b/i },
  { key: 'creditCardRequired', label: '需绑卡',   re: /\bcredit\s*card\s*(is\s*)?required\b|\badd\s+(your\s+)?(credit\s*)?card\b|\brequires?\s+a\s+(valid\s+)?credit\s*card\b/i },
  { key: 'freeForever',      label: '永久免费',   re: /\bfree\s*forever\b|\balways\s*free\b|\bpermanently\s*free\b|\bfree\s*for\s*life\b/i },
  { key: 'freePlan',         label: '有免费套餐', re: /\bfree\s*(plan|tier|version|account|edition)\b/i },
  { key: 'freeTrial',        label: '免费试用',   re: /\bfree\s*trial\b/i },
  { key: 'trialDays',        label: '试用天数',   re: /\b(\d{1,2})[\s-]*day\s*(free\s*)?trial\b|\bfree\s*trial\s*(for\s*)?(\d{1,2})\s*days?\b/i, capture: true },
  { key: 'freeQuota',        label: '免费额度',   re: /\b(\d[\d,\.]*\s*(?:free\s*)?(?:credits?|tokens?|words?|characters?|messages?|generations?|images?|requests?|minutes?|projects?|seats?|users?)\b[^.]{0,40}?\b(?:free|per\s*(?:month|day|week)|monthly|forever)\b|\bfree\b[^.]{0,30}?\d[\d,\.]*\s*(?:credits?|tokens?|words?|messages?|generations?|images?|requests?|minutes?|projects?)\b)/i, capture: true },
  { key: 'watermarkFree',    label: '免费版无水印', re: /\b(no|without)\s+(a\s+)?watermark\b|\bwatermark[-\s]?free\b/i },
  { key: 'watermark',        label: '免费版带水印', re: /\bwatermark\b/i },
  { key: 'apiOnFree',        label: '免费版含 API', re: /\b(api|api\s*access)\b[^.]{0,40}\bfree\b|\bfree\b[^.]{0,30}\bapi\s*(access|key)\b/i },
  { key: 'commercialUse',    label: '免费版可商用', re: /\bcommercial\s*(use|license)\b[^.]{0,30}\b(free|included)\b|\bfree\b[^.]{0,30}\bcommercial\s*use\b/i },
];

function extract(text) {
  const out = {};
  let hits = 0;
  for (const s of SIGNALS) {
    const m = text.match(s.re);
    if (m) { out[s.key] = s.capture && m[1] ? m[1] : true; hits++; }
  }
  return { signals: out, hits };
}

// ---------- 主流程 ----------
const results = [];
let done = 0;

if (FROM_CACHE) {
  // 从 .workbuddy/free-tier-text/*.txt 重抽，不联网
  const files = fs.existsSync(TEXT_DIR) ? fs.readdirSync(TEXT_DIR).filter(f => f.endsWith('.txt')) : [];
  const byName = new Map();
  for (const f of files) {
    const raw = fs.readFileSync(path.join(TEXT_DIR, f), 'utf8');
    const cut = raw.indexOf('\n\n');
    const head = cut === -1 ? raw : raw.slice(0, cut);
    const body = cut === -1 ? '' : raw.slice(cut + 2);
    const g = k => (head.match(new RegExp('^' + k + ': (.*)$', 'm')) || [, ''])[1].trim();
    const name = (head.match(/^# (.+)$/m) || [, ''])[1].trim();
    if (name) byName.set(name, { url: g('URL'), declaredPricing: g('声明定价'), via: g('抓取通道'), pricingUrl: g('定价页') === '-' ? null : g('定价页'), text: body });
  }
  console.log(`从缓存重抽：${files.length} 份原文，覆盖 ${byName.size} 个工具\n`);
  for (const tool of TOOLS) {
    const c = byName.get(tool.name);
    if (!c || c.text.length <= 200) {
      results.push({ name: tool.name, url: tool.url, dept: tool.dept, declaredPricing: tool.pricing, reachable: false, pricingUrl: null, chars: c ? c.text.length : 0, signals: {}, hits: 0, ms: 0, via: c?.via || null, note: 'no-cache' });
      continue;
    }
    const ex = extract(c.text);
    results.push({ name: tool.name, url: tool.url, dept: tool.dept, declaredPricing: c.declaredPricing || tool.pricing, reachable: true, pricingUrl: c.pricingUrl, chars: c.text.length, signals: ex.signals, hits: ex.hits, ms: 0, via: c.via || null, note: null });
  }
} else {
  const pool = (() => {
    let p = TOOLS.slice(0, LIMIT === Infinity ? TOOLS.length : LIMIT);
    if (ONLY.length) {
      const want = new Set(ONLY.map(s => s.toLowerCase()));
      p = TOOLS.filter(t => want.has(t.name.toLowerCase()));
      if (!p.length) {
        console.error(`--only 未匹配到任何工具。给定的 ${ONLY.length} 个名字里没有匹配 data.js 的。`);
        process.exit(1);
      }
      const matched = new Set(p.map(t => t.name.toLowerCase()));
      const miss = ONLY.filter(n => !matched.has(n.toLowerCase()));
      if (miss.length) console.warn(`--only 有 ${miss.length} 个名字未匹配：${miss.slice(0, 5).join(', ')}${miss.length > 5 ? ' …' : ''}`);
    }
    return p;
  })();
  console.log(`审计 ${pool.length} / ${TOOLS.length} 个工具，并发 ${CONC}，单工具硬超时 ${TOOL_TIMEOUT}ms${FORCE_BROWSER ? '，强制浏览器' : ''}\n`);

  async function worker(queue) {
    while (queue.length) {
      const tool = queue.shift();
      const t0 = Date.now();
      // 硬超时兜底：个别站点会把整轮卡死（实测有 6 个工具挂住 25 分钟）
      const gathered = await Promise.race([
        gatherText(tool.url),
        new Promise(res => setTimeout(() => res({ home: { text: '', note: 'TOOL_TIMEOUT' }, pricing: null }), TOOL_TIMEOUT)),
      ]);
      const { home, pricing } = gathered;
      const combined = [home.text, pricing?.text || ''].filter(Boolean).join(' \n ');
      const ex = combined.length > 200 ? extract(combined) : { signals: {}, hits: 0 };
      results.push({
        name: tool.name, url: tool.url, dept: tool.dept, declaredPricing: tool.pricing,
        reachable: home.text.length > 200, pricingUrl: pricing?.url || null,
        chars: combined.length, signals: ex.signals, hits: ex.hits, ms: Date.now() - t0,
        via: home.via || null, note: home.note || null,
      });
      // 原文落盘，供离线复核（避免复核时重新访问网站）
      if (combined.length > 200) {
        fs.mkdirSync(TEXT_DIR, { recursive: true });
        const slug = tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        fs.writeFileSync(path.join(TEXT_DIR, slug + '.txt'),
          `# ${tool.name}\nURL: ${tool.url}\n声明定价: ${tool.pricing}\n抓取通道: ${home.via || '-'}\n定价页: ${pricing?.url || '-'}\n\n${combined}\n`, 'utf8');
      }
      done++;
      if (done % 5 === 0 || done === pool.length) console.log(`  ${done}/${pool.length} ...`);
    }
  }

  const queue = [...pool];
  await Promise.all(Array.from({ length: CONC }, () => worker(queue)));
  await closeBrowser();
}

const pool = results;  // 汇总统一走 results

// ---------- 汇总 ----------
const reachable = results.filter(r => r.reachable);
const withPricing = results.filter(r => r.pricingUrl);
const withSignals = results.filter(r => r.hits > 0);
const conf = r => {
  let s = 0;
  if (r.reachable) s += 1;
  if (r.pricingUrl) s += 2;
  if (r.signals.noCreditCard) s += 2;
  if (r.signals.freePlan || r.signals.freeForever) s += 2;
  if (r.signals.freeQuota) s += 2;
  if (r.signals.trialDays) s += 1;
  if (r.signals.apiOnFree) s += 1;
  return s;
};
results.sort((a, b) => conf(b) - conf(a));

const viaCount = results.reduce((a, r) => { const k = r.via || 'failed'; a[k] = (a[k] || 0) + 1; return a; }, {});
const summary = {
  generatedAt: new Date().toISOString(),
  total: pool.length,
  reachable: reachable.length,
  withPricingPage: withPricing.length,
  withSignals: withSignals.length,
  unknown: results.length - withSignals.length,
  via: viaCount,
  results,
};
fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });

// 补抓模式（--only / --force-browser）：把新结果合并回既有审计，绝不覆盖全量。
// 否则一次针对 60 个工具的补抓会把另外 160 个工具的记录抹掉。
let toWrite = summary;
const isPartialRun = ONLY.length > 0 || FORCE_BROWSER;
if (isPartialRun && fs.existsSync(OUT_JSON)) {
  try {
    const prev = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
    const prevResults = Array.isArray(prev.results) ? prev.results : [];
    const fresh = new Map(results.map(r => [r.name, r]));
    let replaced = 0, added = 0;
    const merged = prevResults.map(r => {
      const n = fresh.get(r.name);
      if (!n) return r;
      fresh.delete(r.name); replaced++;
      return n;
    });
    for (const r of fresh.values()) { merged.push(r); added++; }
    // 顺序按 data.js 的 TOOLS 排，保证输出稳定
    const order = new Map(TOOLS.map((t, i) => [t.name, i]));
    merged.sort((a, b) => (order.get(a.name) ?? 1e9) - (order.get(b.name) ?? 1e9));
    const withSig = merged.filter(r => Object.keys(r.signals || {}).length).length;
    const reach = merged.filter(r => r.reachable).length;
    toWrite = {
      ...prev,
      generatedAt: new Date().toISOString(),
      total: merged.length,
      reachable: reach,
      withSignals: withSig,
      unknown: merged.length - withSig,
      partialRuns: [...(prev.partialRuns || []), {
        at: new Date().toISOString(),
        tools: results.length,
        forceBrowser: FORCE_BROWSER,
        replaced, added,
      }],
      results: merged,
    };
    console.log(`\n补抓合并：更新 ${replaced} 个 + 新增 ${added} 个，保留其余 ${merged.length - results.length + (added ? 0 : 0)} 个`);
    console.log(`合并后全量：${merged.length} 个工具，可达 ${reach}，有信号 ${withSig}`);
  } catch (e) {
    console.error('合并既有审计失败，改为只写本轮结果：', e.message);
  }
}
fs.writeFileSync(OUT_JSON, JSON.stringify(toWrite, null, 2), 'utf8');

const L = [];
L.push(`# 免费额度事实抽取 — 复核队列`);
L.push('');
L.push(`生成时间：${new Date().toLocaleString('sv-SE')} ｜ 样本 ${pool.length} / ${TOOLS.length} 个工具`);
L.push('');
L.push(`| 指标 | 数量 | 占比 |`);
L.push(`|---|---|---|`);
L.push(`| 站点可达（正文 > 200 字符） | ${reachable.length} | ${Math.round(reachable.length / pool.length * 100)}% |`);
L.push(`| 找到定价页 | ${withPricing.length} | ${Math.round(withPricing.length / pool.length * 100)}% |`);
L.push(`| 抽到至少一个明确信号 | ${withSignals.length} | ${Math.round(withSignals.length / pool.length * 100)}% |`);
L.push(`| 完全抽不到（unknown） | ${summary.unknown} | ${Math.round(summary.unknown / pool.length * 100)}% |`);
L.push('');
L.push(`## 复核队列（置信度从高到低）`);
L.push('');
L.push(`| 工具 | 声明 | 可达 | 通道 | 定价页 | 抽到的信号 |`);
L.push(`|---|---|---|---|---|---|`);
for (const r of results) {
  const sig = Object.entries(r.signals).map(([k, v]) => v === true ? k : `${k}=${v}`).join(', ') || '—';
  L.push(`| ${r.name} | ${r.declaredPricing} | ${r.reachable ? '✓' : '✗ ' + (r.note || '')} | ${r.via || '—'} | ${r.pricingUrl ? '✓' : '✗'} | ${sig} |`);
}
fs.mkdirSync(OUT_MD_DIR, { recursive: true });
const mdSuffix = isPartialRun ? '-partial' : '';
const mdPath = path.join(OUT_MD_DIR, `free-tier-review-${new Date().toISOString().slice(0, 10)}${mdSuffix}.md`);
fs.writeFileSync(mdPath, L.join('\n'), 'utf8');

console.log(`\n可达 ${reachable.length}/${pool.length} | 有定价页 ${withPricing.length} | 抽到信号 ${withSignals.length} | 抽不到 ${summary.unknown}`);
console.log('通道分布: ' + Object.entries(viaCount).map(([k, v]) => `${k}=${v}`).join('  '));
console.log('JSON: ' + OUT_JSON);
console.log('复核队列: ' + mdPath);
