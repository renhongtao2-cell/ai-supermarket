// diag-adscript.mjs — 判定 AdSense loader 脚本是否真的加载成功
// 为什么单独查这个：本机在中国网络，pagead2.googlesyndication.com 大概率被墙。
// 若脚本请求失败，则「没有广告 iframe」是网络原因，不能据此判断 Auto Ads 没开。
// 用法：node scripts/diag-adscript.mjs <url> [--proxy http://127.0.0.1:10809]
const PW = "file:///C:/Users/Administrator/node_modules/playwright-core/index.js";
const CHROME =
  "C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const _pw = await import(PW);
const chromium = _pw.chromium || (_pw.default && _pw.default.chromium);

const url = process.argv[2];
const pi = process.argv.indexOf("--proxy");
const proxy = pi > -1 ? { server: process.argv[pi + 1] } : undefined;
// 默认强制 Chromium 不走系统代理。
// 本机系统代理是 127.0.0.1:10809（用户自开的 v2ray），它会拦 Google 广告域 →
// Chromium 报 ERR_SSL_PROTOCOL_ERROR，广告脚本从未执行 → 会误判「网站没投广告」。
// 这个陷阱已经导致过一次错误结论，所以把「直连」做成默认，而不是可选项。
// 确实需要走系统代理时，显式加 --system-proxy。
const direct = !process.argv.includes("--system-proxy") && !proxy;

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: direct ? ["--no-proxy-server"] : [],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, proxy });
const page = await ctx.newPage();

const seen = [];
page.on("response", async (r) => {
  const u = r.url();
  if (/googlesyndication|doubleclick|googleadservices|googletagservices|fundingchoices/.test(u)) {
    seen.push({ status: r.status(), host: new URL(u).host, path: u.slice(0, 90) });
  }
});
page.on("requestfailed", (r) => {
  const u = r.url();
  if (/googlesyndication|doubleclick|googleadservices|googletagservices/.test(u)) {
    seen.push({ status: "FAILED", host: new URL(u).host, err: r.failure()?.errorText });
  }
});

let navErr = null;
try { await page.goto(url, { waitUntil: "load", timeout: 60000 }); }
catch (e) { navErr = e.message.slice(0, 120); }
await page.waitForTimeout(10000);

const state = await page.evaluate(() => ({
  adsbygoogleType: typeof window.adsbygoogle,
  adsbygoogleIsArray: Array.isArray(window.adsbygoogle),
  adIframes: [...document.querySelectorAll("iframe")].filter((f) =>
    /aswift|google_ads_iframe|doubleclick|googlesyndication/.test(f.src || "")
  ).length,
  adStatusDivs: document.querySelectorAll("div[id^='aswift']").length,
}));

console.log(JSON.stringify({ url, proxy: proxy ? proxy.server : "none", navErr, state, adRequests: seen }, null, 2));
await browser.close();
process.exit(0);
