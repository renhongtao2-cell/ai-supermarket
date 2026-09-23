// 调查用域名列表 —— 两个 survey 脚本共用，避免两边各写一份后漂移。
//
// 选站原则：手工挑选、跨类别，代表「知名站点」而不是「整个 web」。
// 每次调查都要在报告里说明这一点（样本非随机）。
// 抓取时若某站不可达，如实记录，不要为了好看而剔除。
export const DOMAINS = [
  // 新闻 / 媒体
  "nytimes.com", "theguardian.com", "bbc.com", "cnn.com", "reuters.com",
  "washingtonpost.com", "forbes.com", "bloomberg.com",
  // 电商
  "amazon.com", "ebay.com", "etsy.com", "shopify.com", "walmart.com", "target.com",
  // SaaS / 生产力
  "github.com", "gitlab.com", "atlassian.com", "slack.com", "notion.so",
  "figma.com", "zoom.us", "asana.com", "trello.com",
  // 社交 / 社区
  "reddit.com", "x.com", "linkedin.com", "pinterest.com", "tumblr.com", "quora.com",
  // 开发者
  "stackoverflow.com", "npmjs.com", "docker.com", "kubernetes.io", "python.org",
  "nodejs.org", "rust-lang.org", "go.dev", "developer.mozilla.org",
  // 流媒体 / 娱乐
  "youtube.com", "spotify.com", "netflix.com", "twitch.tv", "vimeo.com",
  // 参考 / 非营利
  "wikipedia.org", "mozilla.org", "w3.org", "archive.org", "wikimedia.org",
  // SEO / 营销（同行，重点看）
  "ahrefs.com", "moz.com", "semrush.com", "screamingfrog.co.uk", "yoast.com",
  "searchenginejournal.com", "searchengineland.com",
  // 教育
  "mit.edu", "harvard.edu", "stanford.edu", "khanacademy.org", "coursera.org",
  // 金融
  "stripe.com", "paypal.com", "coinbase.com", "wise.com", "squareup.com",
  // 云 / 基础设施
  "cloudflare.com", "vercel.com", "netlify.com", "digitalocean.com", "heroku.com",
  // 出行 / 本地
  "airbnb.com", "booking.com", "uber.com", "doordash.com", "yelp.com",
  // 政府 / 医疗
  "nih.gov", "cdc.gov", "who.int",
];

// 本机在中国网络环境：直连常被墙，本地代理可用。
// curl 读 HTTP_PROXY，Node 的 fetch 不读 —— 所以抓取一律走 curl 子进程。
export const PROXY = process.env.SURVEY_PROXY || "http://127.0.0.1:10809";

export const UA =
  "Mozilla/5.0 (compatible; SerpPrismSurvey/1.0; +https://www.serpprism.com/about)";
