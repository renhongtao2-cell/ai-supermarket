// diag-ads.mjs — 取证：线上页面到底有没有在投广告 / 有没有 CMP
// 为什么必须用真实浏览器：Auto Ads 由 Google 在运行时注入广告位，
// 静态 HTML 里 ins.adsbygoogle 永远是 0，grep 源码无法判断 Auto Ads 是否生效。
// 用法：node scripts/diag-ads.mjs <url> [url2 ...]
const PW = "file:///C:/Users/Administrator/node_modules/playwright-core/index.js";
const CHROME =
  "C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const _pw = await import(PW);
const chromium = _pw.chromium || (_pw.default && _pw.default.chromium);

// 解析参数：--xxx VALUE 形式的选项要连值一起跳过，否则值会被误当成 URL
const OPTS_WITH_VALUE = new Set(["--proxy", "--locale", "--tz"]);
const urls = [];
const opt = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (OPTS_WITH_VALUE.has(a)) { opt[a.slice(2)] = process.argv[++i]; continue; }
  if (a.startsWith("--")) { opt[a.slice(2)] = true; continue; }
  urls.push(a);
}
// 默认强制 Chromium 不走系统代理。
// 本机系统代理是 127.0.0.1:10809（用户自开的 v2ray），它会拦 Google 广告域 →
// Chromium 报 ERR_SSL_PROTOCOL_ERROR，广告脚本从未执行 → 会误判「没有广告、没有 CMP」。
// 这个陷阱已经导致过一次错误结论，所以把「直连」做成默认，而不是可选项。
// 确实需要走系统代理时，显式加 --system-proxy；走指定代理用 --proxy URL。
const direct = !opt["system-proxy"] && !opt.proxy;
const proxy = opt.proxy ? { server: opt.proxy } : undefined;
const locale = opt.locale || "en-GB";
const tz = opt.tz || "Europe/London";
if (!urls.length) {
  console.error("usage: node scripts/diag-ads.mjs [--system-proxy | --proxy URL] [--locale L] [--tz Z] <url> ...");
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: direct ? ["--no-proxy-server"] : [],
});

for (const url of urls) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale,
    timezoneId: tz,
    proxy,
  });
  const page = await ctx.newPage();
  const reqHosts = new Set();
  page.on("request", (r) => {
    try { reqHosts.add(new URL(r.url()).host); } catch {}
  });

  let navErr = null;
  try {
    await page.goto(url, { waitUntil: "load", timeout: 60000 });
  } catch (e) { navErr = e.message.slice(0, 120); }
  // Auto Ads 是异步注入的，等久一点再判
  await page.waitForTimeout(9000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  await page.waitForTimeout(4000);

  const r = await page.evaluate(() => {
    const frames = [...document.querySelectorAll("iframe")].map((f) => f.src || "(srcless)");
    const adFrames = frames.filter((s) =>
      /aswift|google_ads_iframe|doubleclick|googlesyndication|adtrafficquality/.test(s)
    );
    return {
      insAdsbygoogle: document.querySelectorAll("ins.adsbygoogle").length,
      insAny: document.querySelectorAll("ins").length,
      iframesTotal: frames.length,
      adIframes: adFrames.length,
      adFrameSample: adFrames.slice(0, 3),
      adsbygoogleArray: Array.isArray(window.adsbygoogle) ? window.adsbygoogle.length : null,
      tcfapi: typeof window.__tcfapi === "function",
      // Google 的 GDPR 消息脚本 / 用户同意状态
      googlefc: !!document.querySelector('script[src*="fundingchoicesmessages"], script[src*="googlefc"]'),
      consentBannerText: /consent|privacy|gdpr|cookie/i.test(
        (document.body ? document.body.innerText : "").slice(0, 4000)
      ),
    };
  });

  console.log(JSON.stringify({ url, navErr, ...r, adHosts: [...reqHosts].filter((h) => /googlesyndication|doubleclick|googleadservices|googletagservices/.test(h)) }, null, 2));
  await ctx.close();
}

await browser.close();
process.exit(0);
