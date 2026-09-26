// gen-seosite.mjs — SerpPrism 单一来源生成器
//
// 模式沿用 gen-toolsite.mjs（已验证过的一套）：
//   单一来源 → 全站静态 HTML → 内容闸门 → 部署白名单
// 与工具站的区别只是内容与工具实现，骨架刻意保持一致，方便两边互抄修复。
//
// 运行：node scripts/gen-seosite.mjs
//
// ⚠️ 客户端 JS 一律用字符串拼接，不用模板字符串 ——
//    因为整个文件里 ${} 会被外层模板字面量吃掉，String.raw 也救不回来。
import fs from "fs";
import path from "path";
import crypto from "crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "seosite");

/* ===== 站点常量：换域名/品牌只改这里 ===== */
const SITE = "https://www.serpprism.com";
const BRAND = "SerpPrism";
const DOMAIN_LABEL = "www.serpprism.com";
const UPDATED = "2026-09-22";
const LAUNCH = "2026-09-21";
const ADSENSE_CLIENT = "ca-pub-9901133369141996";
const CONTACT_EMAIL = "renhongtao2@gmail.com";

/* 作者 / E-E-A-T
   AdSense 判「低价值内容」时缺的一整个维度是 Expertise：全站原本 0 处 author，
   About 页也没写是谁做的。这里一次补齐署名 + bio + Person 结构化数据。
   ⚠️ 只写能核实的事实，不编造资历 —— 虚假的 E-E-A-T 信号风险比没有更大。 */
const AUTHOR_NAME = "Hongtao Ren";
const AUTHOR_NAME_CN = "任宏涛";
const AUTHOR_BIO =
  "Hongtao Ren is a developer based in Xi'an, China. He builds browser-based tools and JetBrains IDE plugins, and built and maintains SerpPrism.";
const AUTHOR_BIO_SHORT = "Developer based in Xi'an, China. Builds browser-based tools and JetBrains IDE plugins.";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const stripTags = (s) => String(s).replace(/<[^>]*>/g, "");

/* =================================================================
   工具注册表
   ui  = 工具界面的 HTML（纯静态，交互由 TOOLS_JS 里的同名函数接管）
   fn  = 客户端函数名，挂在 window.SEOT 上
   ================================================================= */
const TOOLS = [
  {
    slug: "meta-tag-generator",
    nav: "Meta tags",
    h1: "Meta Tag Generator",
    fn: "metaGen",
    metaDesc:
      "Generate clean page title, meta description, canonical, Open Graph and Twitter card tags. Live length warnings and copy-ready HTML, all in your browser.",
    intro:
      "Fill in the fields and get a complete, copy-ready block of <code>&lt;head&gt;</code> tags. Every length counter updates as you type, so you can see exactly where Google will truncate your title or description before you publish.",
    ui: `
      <div class="grid2">
        <label>Page title<input id="m-title" type="text" placeholder="How to Fix Subtitle Sync — SerpPrism"></label>
        <label>Canonical URL<input id="m-url" type="text" placeholder="https://example.com/page"></label>
      </div>
      <label>Meta description<textarea id="m-desc" rows="3" placeholder="One or two sentences. Google shows roughly the first 155 characters on desktop."></textarea></label>
      <div class="grid2">
        <label>OG title (blank = reuse page title)<input id="m-ogtitle" type="text" placeholder="Optional"></label>
        <label>OG image URL<input id="m-ogimage" type="text" placeholder="https://example.com/og.png"></label>
      </div>
      <div class="grid2">
        <label>Twitter card
          <select id="m-card"><option value="summary_large_image">summary_large_image</option><option value="summary">summary</option></select>
        </label>
        <label>Site / Twitter handle<input id="m-site" type="text" placeholder="@yourhandle"></label>
      </div>
      <label>Robots directive
        <select id="m-robots">
          <option value="index, follow">index, follow (default)</option>
          <option value="index, nofollow">index, nofollow</option>
          <option value="noindex, follow">noindex, follow</option>
          <option value="noindex, nofollow">noindex, nofollow</option>
        </select>
      </label>
      <div id="m-out" aria-live="polite"></div>`,
    steps: [
      "Enter the page title and meta description you plan to publish.",
      "Watch the counters — amber means close to truncation, red means it will almost certainly be cut.",
      "Copy the generated block into your page's <code>&lt;head&gt;</code>.",
    ],
    why: [
      {
        h: "Why the counters are approximate, and why that is fine",
        p: [
          "Google does not cut snippets at a fixed character count. It measures rendered pixel width and trims whatever does not fit, which is why a title of 58 narrow characters can survive while a 52-character one full of capital W and M gets cut.",
          "The counters here use the widely used working limits — about 60 characters for titles and about 155 for descriptions — as a planning target rather than a guarantee. Treat amber as 'check this one by eye', not as an error.",
        ],
      },
      {
        h: "The tags most people forget",
        p: [
          "A canonical tag is the cheapest fix for duplicate-content problems caused by URL parameters, trailing slashes or <code>www</code> variants. If your page is reachable at more than one address, pick one and point canonical at it.",
          "Open Graph and Twitter tags do not affect rankings, but they decide whether your link looks credible when someone pastes it into Slack, LinkedIn or X. A page with no <code>og:image</code> renders as a bare grey box, and bare grey boxes do not get clicked.",
        ],
      },
      {
        h: "What this tool deliberately does not do",
        p: [
          "It does not fetch your live page. Checking what you actually published means asking a server to request your URL, and browsers block that for pages on other domains. A tool that worked around it would have to send your address through someone else's infrastructure, which is the opposite of the privacy this site is built around.",
          "It also does not validate that your canonical URL returns 200, or that your OG image file actually exists. Both are worth confirming before you ship, and both take one request in any HTTP client — or a quick look at your browser's network panel.",
          "What you get instead is something narrower and, in practice, more useful while you are writing: a correct block of tags and an honest warning when a field is long enough to be cut.",
        ],
      },
    ],
    faq: [
      ["Does adding meta tags improve rankings directly?", "Only indirectly. The title and description influence click-through from the results page, and canonical consolidation helps Google pick the right URL. Neither is a ranking factor in the way content and links are."],
      ["Should the OG title differ from the page title?", "Usually not. Write a separate OG title when your page title is engineered for search (keyword-first, 60 characters) and you want something more human when it is shared socially."],
      ["Is it safe to paste my URLs into this page?", "Yes. Every tool here runs as plain JavaScript in your browser. Nothing you type is sent to a server, and there is no analytics call attached to the input fields."],
    ],
    related: ["serp-preview", "open-graph-preview", "readability-score"],
  },

  {
    slug: "serp-preview",
    nav: "SERP preview",
    h1: "SERP Preview Tool",
    fn: "serpPreview",
    metaDesc:
      "Preview how your title and description look in Google results, measured in real pixels. See exactly where the snippet gets truncated before you publish.",
    intro:
      "This renders your snippet with the same font stack and sizing Google uses on desktop, then measures it with a canvas. Instead of guessing from a character count, you see the actual pixel width and get told where the cut lands.",
    ui: `
      <div class="grid2">
        <label>Page title<input id="s-title" type="text" placeholder="How to Fix Subtitle Sync in 4 Steps"></label>
        <label>Display URL<input id="s-url" type="text" placeholder="example.com › guides › fix-sync"></label>
      </div>
      <label>Meta description<textarea id="s-desc" rows="3" placeholder="Paste the description you plan to publish."></textarea></label>
      <div class="serp" id="s-preview" aria-live="polite"></div>
      <div id="s-report" class="report"></div>`,
    steps: [
      "Type your title, URL and description.",
      "Read the rendered preview — the overflowing part is shown greyed out, exactly as Google would drop it.",
      "Shorten until the width bar sits in the green zone.",
    ],
    why: [
      {
        h: "Character counts lie, pixels do not",
        p: [
          "Two descriptions can both be 150 characters and behave completely differently. One is built from narrow letters like i, l and t; the other is full of m, w and capitals. Google measures the rendered result, so the wide one gets truncated well before the narrow one does.",
          "That is why this tool renders text in the real font and measures it rather than counting characters. If you have ever shipped a description that looked fine in your CMS and appeared chopped in search, width was the reason.",
        ],
      },
      {
        h: "Google rewrites snippets anyway — plan for it",
        p: [
          "Google frequently replaces your meta description with a sentence pulled from the page body when it judges that sentence to match the query better. This is normal and not a penalty.",
          "The practical response is to write a description that is good enough to keep, and to make sure the opening sentence of the page would also work if it gets pulled. You cannot force Google to use your text; you can only remove its reason to substitute.",
        ],
      },
      {
        h: "What this tool deliberately does not do",
        p: [
          "It does not check your live snippet. Seeing what Google actually shows for a query requires running a search, which means a server-side request — and any browser-based tool claiming to do it is sending your query through someone else's infrastructure.",
          "It also does not model the layouts that sit on top of the plain result: sitelinks, FAQ accordions, review stars, video thumbnails. Those change the available width substantially, and a preview that guessed at them would be wrong more often than it was right.",
          "The value here is narrower and more practical: knowing, before you publish, whether the title and description you wrote fit in the space Google actually gives you.",
        ],
      },
    ],
    faq: [
      ["What width does Google actually allow?", "Desktop results render the title at roughly 20px and the description at 14px, with a container around 600px wide. Mobile is narrower. This tool uses the desktop value, which is the more forgiving of the two."],
      ["Why does my live snippet differ from this preview?", "Because Google may rewrite the description from page content, add sitelinks, or show a featured-snippet layout. The preview shows the default single-result layout with your own text."],
      ["Can I preview rich results here?", "Not yet. Structured-data driven layouts (FAQ, HowTo, product) render differently and are out of scope for this preview."],
    ],
    related: ["meta-tag-generator", "open-graph-preview", "heading-analyzer"],
  },

  {
    slug: "robots-txt-tester",
    nav: "robots.txt",
    h1: "robots.txt Tester",
    fn: "robotsTest",
    metaDesc:
      "Paste a robots.txt and test any URL against any user-agent. See exactly which rule wins, which line matched, and whether Googlebot can crawl the page.",
    intro:
      "Paste your robots.txt on the left, then enter a URL and a user-agent. The tester tells you allow or disallow, and — more usefully — quotes the exact rule that decided it, so you can find the line that is quietly blocking a section of your site.",
    ui: `
      <label>robots.txt<textarea id="r-txt" rows="10" placeholder="User-agent: *&#10;Disallow: /admin/&#10;Allow: /admin/public/&#10;&#10;User-agent: Googlebot&#10;Disallow: /staging/"></textarea></label>
      <div class="grid2">
        <label>URL to test<input id="r-url" type="text" placeholder="/blog/new-post"></label>
        <label>User-agent<select id="r-ua">
          <option value="Googlebot">Googlebot</option>
          <option value="Googlebot-Image">Googlebot-Image</option>
          <option value="bingbot">bingbot</option>
          <option value="*">* (all others)</option>
          <option value="__custom__">custom…</option>
        </select></label>
      </div>
      <label id="r-custom-wrap" hidden>Custom user-agent<input id="r-custom" type="text" placeholder="Bytespider"></label>
      <div id="r-out" class="verdict" aria-live="polite"></div>`,
    steps: [
      "Paste the full contents of your robots.txt (fetch it from <code>/robots.txt</code> first).",
      "Enter the path you want to check and pick a user-agent.",
      "Read the verdict — it names the winning rule and the line number it came from.",
    ],
    why: [
      {
        h: "Longest match wins, not first match",
        p: [
          "This is the single most misread part of the spec. Crawlers compare every matching Allow and Disallow rule and follow the longest one. So <code>Disallow: /admin/</code> plus <code>Allow: /admin/public/</code> means /admin/public/ is crawlable, even though the disallow line comes first.",
          "If you have ever 'fixed' a block by moving a line up or down in the file, this is why it did not work. Order inside a group is irrelevant; path length is what decides.",
        ],
      },
      {
        h: "robots.txt blocks crawling, not indexing",
        p: [
          "A disallowed URL can still appear in search results if something else links to it — Google will show it with a 'page not crawled' note because it never read the content. If you need a page gone from the index, use <code>noindex</code>, and do not disallow it at the same time, or the crawler can never see the noindex.",
          "This pairing — disallow plus noindex — is one of the most common ways sites accidentally keep dead pages in the index indefinitely.",
        ],
      },
      {
        h: "What this tool deliberately does not do",
        p: [
          "It does not fetch the robots.txt from your domain for you. Browsers block reading a file from another origin unless that origin explicitly allows it, and routing the request through a proxy would mean this site could see every URL you test — exactly what a privacy-respecting tool should not be able to do.",
          "It also does not know about rules that live outside robots.txt: <code>noindex</code> in a meta tag, an <code>X-Robots-Tag</code> response header, or password protection. A URL can be fully allowed by robots.txt and still never appear in search for any of those reasons.",
          "Treat the verdict as 'what your robots.txt says', which is one layer of the picture, not the whole one.",
        ],
      },
    ],
    faq: [
      ["Does Disallow match by prefix?", "Yes. A rule of /blog also blocks /blogging and /blog/anything. Add a trailing slash when you mean the directory only, and remember that wildcards * and $ are supported by Google."],
      ["What if no rule matches?", "The URL is allowed. Absence of a matching Disallow is an implicit allow — you do not need Allow: / to permit crawling."],
      ["Do all crawlers obey robots.txt?", "Major search engines do. Many AI training crawlers and scrapers do not. robots.txt is a request, not an access control mechanism — anything that must stay private needs real authentication."],
    ],
    related: ["meta-tag-generator", "heading-analyzer", "keyword-density"],
  },

  {
    slug: "heading-analyzer",
    nav: "Headings",
    h1: "Heading Structure Analyzer",
    fn: "headingAnalyze",
    metaDesc:
      "Paste HTML and get a clean H1–H6 outline plus a list of real problems: missing or duplicated H1, skipped levels, and headings that are too long.",
    intro:
      "Paste a chunk of HTML and this builds the document outline, then flags the problems that actually matter. It does not score you out of 100 — it tells you which specific headings are wrong and why.",
    ui: `
      <label>Page HTML<textarea id="h-html" rows="12" placeholder="&lt;h1&gt;Page title&lt;/h1&gt;&#10;&lt;h3&gt;A subsection&lt;/h3&gt;&#10;&lt;h2&gt;Another section&lt;/h2&gt;"></textarea></label>
      <div id="h-out" aria-live="polite"></div>`,
    steps: [
      "Copy the rendered HTML of your page (view-source, or the element tree in devtools).",
      "Paste it in. The outline and the issue list build instantly.",
      "Fix the flagged headings in order — missing H1 first, then skipped levels.",
    ],
    why: [
      {
        h: "Skipped levels are a real problem, just a small one",
        p: [
          "Jumping from H1 straight to H3 breaks the outline that screen readers build for navigation. A user jumping between headings hears 'level 3' with no level 2 above it, which makes the document hierarchy ambiguous.",
          "For search engines the effect is minor — Google has said heading order is not a strong ranking signal. The accessibility argument is the solid one, and it is the reason to fix it.",
        ],
      },
      {
        h: "One H1, and it should match what the page is about",
        p: [
          "Multiple H1s are not an error in HTML5 and Google has explicitly said it handles them fine. But in practice a page with three H1s usually has three competing ideas about what it is, and that confusion shows up in the snippet it earns.",
          "If your theme puts the site name in an H1 on every page, that is a template problem worth fixing — your page title deserves that slot.",
        ],
      },
      {
        h: "How to read the outline once you have it",
        p: [
          "Scan the H2s alone first. If the H2 list does not read like a table of contents for the page, the page has no structure — it has paragraphs with bigger text above them. That is the finding worth acting on, and it is invisible if you only look at the issue count.",
          "Then check whether any section is doing two jobs. A heading like 'Pricing and support' usually means two sections were merged for convenience, and splitting them makes both easier to find.",
          "Finally, look at the depth. If you have H4s under H2s with no H3 between them, the outline is skipping a level. Either promote the H4 or introduce the missing H3 — but if a section needs four levels of nesting, it is usually a sign the page is trying to cover too much.",
        ],
      },
    ],
    faq: [
      ["Is it OK to have several H1s?", "Technically yes in HTML5, and Google tolerates it. The reason to keep one is clarity of the outline, not a rule in a ranking document."],
      ["Should headings contain keywords?", "Write them for the reader first. A heading that reads naturally and describes the section will contain the relevant words anyway; forcing keywords into H2s makes the outline worse for everyone."],
      ["Does heading order affect rankings?", "Only weakly, if at all. Treat correct heading structure as basic document hygiene and accessibility, not as a ranking tactic."],
    ],
    related: ["serp-preview", "readability-score", "keyword-density"],
  },

  {
    slug: "keyword-density",
    nav: "Keyword density",
    h1: "Keyword Density Checker",
    fn: "kwDensity",
    metaDesc:
      "Count single words and two- or three-word phrases with stopwords filtered out. See frequency, percentage, and which phrases are worth targeting.",
    intro:
      "Paste your text and get word and phrase frequency with common English stopwords removed, so the top of the list is actually informative instead of being 'the, and, of'.",
    ui: `
      <label>Text to analyse<textarea id="k-text" rows="12" placeholder="Paste the article or page copy here."></textarea></label>
      <div class="grid3">
        <label>Phrase length
          <select id="k-n">
            <option value="1">Single words</option>
            <option value="2" selected>Two-word phrases</option>
            <option value="3">Three-word phrases</option>
          </select>
        </label>
        <label>Stopwords
          <select id="k-stop"><option value="on" selected>Filter common words</option><option value="off">Count everything</option></select>
        </label>
        <label>Show top
          <select id="k-top"><option>10</option><option selected>20</option><option>30</option></select>
        </label>
      </div>
      <div id="k-out" aria-live="polite"></div>`,
    steps: [
      "Paste the text you want to analyse.",
      "Choose phrase length — two-word phrases are usually the most informative.",
      "Look at the repeated phrases; those are your real topic terms, not the ones you planned.",
    ],
    why: [
      {
        h: "There is no ideal density number",
        p: [
          "The idea that a page should contain a keyword between 1 and 3 percent of the time has no basis in how ranking systems work. Writing to hit a density target produces worse text, and worse text performs worse.",
          "The useful question this tool answers is different: what is this page actually about, as measured by what it says? If the top phrases are not the topic you intended, the page is off-target and no density tweak will save it.",
        ],
      },
      {
        h: "What to do with the output",
        p: [
          "If a phrase you want to rank for appears once or twice, the page probably does not cover that topic deeply enough yet. Add a section that genuinely addresses it.",
          "If a phrase appears far more than everything else, the page may be too narrow, or you may be repeating yourself. Check whether those repetitions say something new each time.",
        ],
      },
      {
        h: "How to read the table without over-correcting",
        p: [
          "Start with the phrase-length selector set to two words. Single words are dominated by generic topic terms that appear in every article on the subject, so they tell you almost nothing. Two-word phrases are where the actual subject of the page becomes visible.",
          "Look for phrases you expected to see and did not. A page about subtitle timing that never produces the phrase 'subtitle timing' is a page that talks around its subject — usually because the writer assumed the topic was obvious. It is not obvious to a crawler.",
          "Then look at the shape of the distribution. A long flat tail means the page covers many things shallowly. One phrase dominating everything else means the page says one thing repeatedly. Neither is automatically wrong, but both are worth knowing before you decide the page is finished.",
          "What you should not do is edit the text to move numbers. If a term is missing, the fix is a paragraph that genuinely covers it. Adding the phrase without the substance produces a page that reads like it was written for a counter.",
        ],
      },
    ],
    faq: [
      ["What counts as a stopword here?", "A built-in list of roughly 150 common English function words — articles, prepositions, pronouns, common verbs. You can switch the filter off to see raw counts."],
      ["Why are two-word phrases more useful?", "Single words are dominated by topic-generic terms. Phrases reveal what the page is actually about, because 'subtitle timing' says far more than 'subtitle'."],
      ["Should I optimise for the top phrase?", "Only if it matches your intent. Often the analysis reveals the page drifted off topic, and the right response is to rewrite a section rather than to adjust counts."],
    ],
    related: ["readability-score", "heading-analyzer", "meta-tag-generator"],
  },

  {
    slug: "readability-score",
    nav: "Readability",
    h1: "Readability Score Checker",
    fn: "readability",
    metaDesc:
      "Measure Flesch Reading Ease, grade level, sentence length and passive voice. See which specific sentences are dragging the score down.",
    intro:
      "Paste your text for a readability breakdown — the standard scores plus the specific sentences that are hardest to read, so you know where to cut rather than just how bad it is.",
    ui: `
      <label>Text<textarea id="rd-text" rows="12" placeholder="Paste the article or page copy here."></textarea></label>
      <div id="rd-out" aria-live="polite"></div>`,
    steps: [
      "Paste your text.",
      "Read the Flesch score and grade level together — one without the other is easy to misread.",
      "Open the longest sentences list and split anything over about 25 words.",
    ],
    why: [
      {
        h: "How to read the two scores together",
        p: [
          "Flesch Reading Ease runs from 0 to 100, higher being easier; 60 to 70 is plain English. Flesch-Kincaid grade level expresses the same signal as US school years. A text can score 65 (fine) and grade 9 (also fine) — they agree more often than not.",
          "Both formulas are built from exactly two inputs: sentence length and syllables per word. That means there are only two levers available to you — shorter sentences, and shorter words.",
        ],
      },
      {
        h: "Where these formulas mislead",
        p: [
          "Syllable counting is a heuristic, and it treats every polysyllabic word as equally hard. 'Photography' and 'responsibility' are not equally difficult, but both cost the same in the formula. Technical vocabulary is necessary in technical writing and should not be removed to chase a number.",
          "Use the score to spot sentences that are structurally tangled, not as a target to hit. A page at grade 12 about distributed databases is not failing; a page at grade 16 about choosing a kettle probably is.",
        ],
      },
      {
        h: "The three edits that actually move the number",
        p: [
          "Split sentences at conjunctions. Most sentences over 30 words contain an 'and', a 'but' or a 'which' that marks a natural seam. Cutting there produces two sentences that read better than the original and need no rewriting of the ideas.",
          "Replace nominalisations with verbs. 'The implementation of the configuration requires the specification of parameters' is four nouns doing a verb's work. 'To configure the tool, specify its parameters' says the same thing in a third of the words and drops the syllable count sharply.",
          "Delete the throat-clearing. Phrases like 'it is important to note that' and 'in order to' add syllables without adding meaning. Removing them is the cheapest readability win available, and it almost always improves the writing rather than just the score.",
          "Do those three things and the Flesch score moves on its own. Rewriting specifically to raise the number — swapping 'use' for 'utilise' in reverse, or breaking sentences at arbitrary points — produces text that scores well and reads worse.",
        ],
      },
    ],
    faq: [
      ["What is a good Flesch score for web content?", "60–70 is plain English and a reasonable target for general-audience pages. 50–60 is fairly difficult and normal for trade publications; below 30 is graduate-level."],
      ["Does readability affect SEO?", "Not directly. There is no readability score in the ranking systems. It affects how many people finish your page, which affects everything else you care about."],
      ["How accurate is the syllable count?", "It uses a vowel-group heuristic with common English corrections. It is accurate enough to compare two drafts of the same text, which is the useful comparison."],
    ],
    related: ["keyword-density", "heading-analyzer", "serp-preview"],
  },

  {
    slug: "llms-txt-generator",
    nav: "llms.txt",
    h1: "llms.txt Generator",
    fn: "llmsGen",
    metaDesc:
      "Build a valid llms.txt file — the plain-text index that tells AI crawlers what your site offers. Runs entirely in your browser.",
    intro:
      "Paste your site name, a one-line summary, and your pages or tools. Get a properly formatted llms.txt you can drop at your domain root. Nothing is uploaded.",
    ui: `
      <label>Site name<input id="lt-name" type="text" placeholder="Acme Tools"></label>
      <label>One-line summary<input id="lt-sum" type="text" placeholder="Free utilities that run entirely in your browser."></label>
      <label>Notes for automated readers (optional)<textarea id="lt-notes" rows="2" placeholder="All processing is client-side. No API; output is deterministic."></textarea></label>
      <label>Entries — one per line, format: <code>Title | /path | short description</code>
        <textarea id="lt-rows" rows="10" placeholder="SRT to VTT | /tools/srt-to-vtt | Convert SubRip subtitles to WebVTT.&#10;Merge Subtitles | /tools/merge-subtitles | Join two subtitle files and re-time the second."></textarea>
      </label>
      <div class="grid2">
        <label>Section heading for entries
          <select id="lt-head"><option value="Tools" selected>Tools</option><option value="Pages">Pages</option><option value="Docs">Docs</option><option value="Content">Content</option></select>
        </label>
        <label>Include full URLs
          <select id="lt-abs"><option value="no" selected>Relative paths</option><option value="yes">Absolute URLs</option></select>
        </label>
      </div>
      <div id="lt-out" aria-live="polite"></div>`,
    steps: [
      "Fill in your site name and a one-line summary that says what the site does, not what it wants to rank for.",
      "Add one entry per page or tool, in the format <code>Title | /path | description</code>.",
      "Copy the result and save it as <code>llms.txt</code> at your domain root, next to <code>robots.txt</code>.",
    ],
    why: [
      {
        h: "What llms.txt is actually for",
        p: [
          "llms.txt is a plain-text file at your domain root that describes what your site offers, written to be read by language models rather than by people. It is a proposal rather than a standard — no major crawler has committed to obeying it — but it costs one small file and it is the only place where you get to describe your own site in your own words.",
          "The practical value is not ranking. It is correction. A model that has only seen scraped fragments of your site will guess what it does. A well-written llms.txt replaces that guess with your own description.",
        ],
      },
      {
        h: "Why relative paths are the default",
        p: [
          "Relative paths keep the file valid if you change domain, move from a subdomain to the root, or serve the same content over several hostnames. Absolute URLs break in all three cases and are the most common way these files silently go stale.",
          "Switch to absolute URLs only if you are publishing the file somewhere that is not your own domain root, where a relative path has nothing to resolve against.",
        ],
      },
      {
        h: "Writing entries that are actually useful",
        p: [
          "The description field is where most of these files fail. 'Home', 'About us', and 'Our services' tell a reader nothing it did not already know. Write what the page does: 'Convert SubRip subtitles to WebVTT, preserving timing and cue numbering.'",
          "Be specific about constraints, because they are the thing a reader cannot infer. If a tool only handles certain input formats, or if output is approximate, say so in the description rather than leaving it to be discovered.",
          "Order matters less than completeness, but put the pages you would want someone to see first at the top. A reader that truncates will keep the head of the file.",
        ],
      },
      {
        h: "What this file will not do",
        p: [
          "It will not improve your rankings, and no search engine currently reads it as a ranking signal. Treat it as documentation for machines, not as an SEO tactic.",
          "It also does not replace robots.txt. If you want a crawler to stay out, that is still robots.txt. llms.txt describes; robots.txt permits.",
        ],
      },
    ],
    faq: [
      ["Is llms.txt an official standard?", "No. It is a community proposal that several AI companies have said they are aware of. No major crawler has formally committed to it. It is cheap to publish and harmless if ignored."],
      ["Where exactly does the file go?", "At the domain root — https://yoursite.com/llms.txt, the same place as robots.txt. A file at any other path will not be found."],
      ["How is this different from robots.txt?", "robots.txt controls whether a crawler may fetch pages. llms.txt describes what the site contains. They do different jobs and you can publish either without the other."],
      ["Should I list every page?", "No. List the pages that represent what your site does. A file with two hundred entries is worse than one with fifteen useful ones, because the signal gets lost."],
    ],
    related: ["schema-markup-generator", "meta-tag-generator", "robots-txt-tester"],
  },

  {
    slug: "schema-markup-generator",
    nav: "Schema markup",
    h1: "JSON-LD Schema Markup Generator",
    fn: "schemaGen",
    metaDesc:
      "Generate valid JSON-LD for Article, FAQ, HowTo, Product, BreadcrumbList and Organization. Fill in fields, get copy-ready markup that validates.",
    intro:
      "Pick a schema type, fill in the fields, and get JSON-LD you can paste straight into your page head. Every field is validated as you type, and the output is checked for the properties Google actually requires.",
    ui: `
      <label>Schema type
        <select id="sc-type">
          <option value="article" selected>Article</option>
          <option value="faq">FAQPage</option>
          <option value="howto">HowTo</option>
          <option value="product">Product</option>
          <option value="breadcrumb">BreadcrumbList</option>
          <option value="org">Organization</option>
        </select>
      </label>
      <div id="sc-fields"></div>
      <div id="sc-out" aria-live="polite"></div>`,
    steps: [
      "Choose the schema type that matches what the page actually is — not the one you wish it were.",
      "Fill in the fields. Required ones are marked; the validator tells you what is missing as you type.",
      "Copy the JSON-LD and paste it into the <code>&lt;head&gt;</code> of your page, then test it in Google's Rich Results Test.",
    ],
    why: [
      {
        h: "Structured data is a claim, not a ranking factor",
        p: [
          "Adding schema does not by itself move a page up. What it does is make your claims machine-readable: this is an article, it was published on this date, by this author, and this is the answer to this question. Systems that need that information can then use it.",
          "The failure mode is claiming things that are not true of the page. Marking up an FAQ section that does not exist on the page, or a product the page does not sell, is a structured-data violation and can cost you eligibility for rich results entirely.",
        ],
      },
      {
        h: "Why one @graph beats several loose blocks",
        p: [
          "Most generators emit one detached JSON-LD blob per type. That works, but it throws away the relationships: this article was published by this organization, on this website, and sits at this position in this breadcrumb trail.",
          "Emitting a single @graph where nodes reference each other by @id expresses those relationships explicitly, and it is how the same facts stop being repeated in three places where they can drift apart. If your Organization name changes, you change it once.",
        ],
      },
      {
        h: "Required versus recommended",
        p: [
          "Google treats some properties as required for a given rich result and others as recommended. Missing a required property means the result simply will not appear, with no error shown anywhere in Search Console.",
          "This tool marks required fields and refuses to produce output that omits them. It does not warn about recommended fields, because those trade off against how much you want to describe.",
        ],
      },
      {
        h: "Dates are the most common silent error",
        p: [
          "datePublished and dateModified need to be ISO 8601, and dateModified needs to mean something. Incrementing it on every deploy to make a page look fresh is a well-known trick that stops working the moment anyone compares it against the actual content.",
          "Set dateModified when the content genuinely changes. A page whose modified date moves every day but whose words never change is telling crawlers the date field is noise.",
        ],
      },
    ],
    faq: [
      ["Does schema help rankings?", "Not directly. It makes your content eligible for rich results and helps systems understand what the page is. The ranking effect, if any, is indirect."],
      ["Where does the JSON-LD go?", "Anywhere in the head or body. Google reads it regardless of position. The head is conventional and keeps it out of the way."],
      ["Can I use several types on one page?", "Yes. Either as separate script blocks or, preferably, as one @graph with cross-referenced @id values so the entities are explicitly related."],
      ["Why does my FAQ rich result not appear?", "Most often because the marked-up questions and answers are not visible in the page HTML, or the page is not indexed. Schema must describe content that actually exists on the page."],
    ],
    related: ["llms-txt-generator", "meta-tag-generator", "heading-analyzer"],
  },

  {
    slug: "utm-link-builder",
    nav: "UTM builder",
    h1: "UTM Link Builder",
    fn: "utmBuild",
    metaDesc:
      "Build campaign URLs with correctly encoded utm_source, utm_medium and utm_campaign. Live validation catches the mistakes that split your analytics data.",
    intro:
      "Fill in your destination and campaign fields, get a properly URL-encoded link, and see warnings for the naming mistakes that silently split one campaign into several in your reports.",
    ui: `
      <label>Destination URL<input id="u-base" type="text" placeholder="https://example.com/pricing"></label>
      <div class="grid2">
        <label>utm_source (required)<input id="u-src" type="text" placeholder="newsletter"></label>
        <label>utm_medium (required)<input id="u-med" type="text" placeholder="email"></label>
      </div>
      <label>utm_campaign (required)<input id="u-cmp" type="text" placeholder="spring-launch"></label>
      <div class="grid2">
        <label>utm_term (optional, paid keywords)<input id="u-term" type="text" placeholder="running+shoes"></label>
        <label>utm_content (optional, A/B variant)<input id="u-con" type="text" placeholder="cta-button"></label>
      </div>
      <div id="u-out" aria-live="polite"></div>`,
    steps: [
      "Paste the destination URL — you can include existing query parameters, they are preserved.",
      "Fill in source, medium and campaign. These three are what every analytics platform needs to attribute the visit.",
      "Copy the result. Check the warnings first — inconsistent casing is the most common way reports get split.",
    ],
    why: [
      {
        h: "The three parameters that actually matter",
        p: [
          "utm_source identifies where the traffic came from — a specific newsletter, a specific site, a specific ad platform. utm_medium identifies the channel type: email, social, cpc, referral. utm_campaign identifies the specific promotion.",
          "These three are the minimum. Term and content are refinements: term is for paid keywords, content distinguishes variants of the same link when you are testing two buttons or two placements.",
        ],
      },
      {
        h: "Case sensitivity is the most expensive mistake here",
        p: [
          "Analytics platforms treat utm_source values as case-sensitive strings. 'Newsletter', 'newsletter' and 'NEWSLETTER' are three separate sources in your reports, and they will stay separate forever because there is no reliable way to merge historical data after the fact.",
          "Pick lowercase for everything and stick to it. This tool warns when it sees mixed case, because fixing it after a campaign has run is not possible.",
        ],
      },
      {
        h: "Never put UTM parameters on internal links",
        p: [
          "A tagged link starts a new session in most analytics configurations. If a visitor arrives from your newsletter and then clicks a tagged internal link, the original source is overwritten and the visit is attributed to your own campaign instead of the newsletter that actually brought them.",
          "Tag only links that point at your site from somewhere else. Internal navigation should always be untagged.",
        ],
      },
      {
        h: "Why encoding matters more than it looks",
        p: [
          "Spaces, ampersands and non-ASCII characters have to be percent-encoded or they will truncate the parameter or break the URL entirely. A campaign name with an ampersand in it will silently cut everything after that character.",
          "This tool encodes each value properly and preserves any query parameters already present on the destination URL, so a link to a page that already has its own parameters keeps working.",
        ],
      },
    ],
    faq: [
      ["What is the difference between source and medium?", "Source is the specific origin — 'spring-newsletter' or 'google'. Medium is the channel type — 'email' or 'cpc'. One medium contains many sources."],
      ["Can I use UTM links on social media?", "Yes, and you should. Social platforms often strip referrer information, so tagged links are frequently the only way to attribute that traffic correctly."],
      ["Should campaign names use spaces?", "Avoid them. Use hyphens or underscores consistently. Spaces require encoding and make the values harder to read in reports."],
      ["Will this overwrite existing parameters on my URL?", "No. Existing query parameters are preserved and the UTM parameters are appended to them."],
    ],
    related: ["llms-txt-generator", "meta-tag-generator", "keyword-density"],
  },

  {
    slug: "open-graph-preview",
    nav: "OG preview",
    h1: "Open Graph Preview Tool",
    fn: "ogPreview",
    metaDesc:
      "Preview the card LinkedIn, Facebook, X and Slack render for your link. Get the Open Graph and Twitter tags that produce it, plus checks for image mistakes.",
    intro:
      "Fill in the fields and both card layouts render live — the large image card and the small summary card. Below them you get the exact tags, plus a list of the specific problems that stop a card from rendering at all.",
    ui: `
      <div class="grid2">
        <label>Page URL<input id="og-u" type="text" placeholder="https://example.com/guide"></label>
        <label>Site name<input id="og-s" type="text" placeholder="SerpPrism"></label>
      </div>
      <label>og:title<input id="og-t" type="text" placeholder="How to Fix Subtitle Sync"></label>
      <label>og:description<textarea id="og-d" rows="3" placeholder="One sentence. Cards cut this far shorter than a meta description."></textarea></label>
      <label>og:image URL (must be absolute)<input id="og-i" type="text" placeholder="https://example.com/og.png"></label>
      <div class="grid3">
        <label>Width (px)<input id="og-w" type="number" placeholder="1200"></label>
        <label>Height (px)<input id="og-h" type="number" placeholder="630"></label>
        <label>Twitter handle<input id="og-tw" type="text" placeholder="@yourhandle"></label>
      </div>
      <label>Twitter card
        <select id="og-c"><option value="summary_large_image">summary_large_image</option><option value="summary">summary (small, image left)</option></select>
      </label>
      <div id="og-out" aria-live="polite"></div>`,
    steps: [
      "Enter the URL, title and description you plan to publish.",
      "Add an absolute <code>og:image</code> URL and its pixel size — this is the field that breaks most often.",
      "Copy the generated block into your page's <code>&lt;head&gt;</code>, then re-check after deploying, because every platform caches the card.",
    ],
    why: [
      {
        h: "The four tags that decide whether you get a card at all",
        p: [
          "<code>og:title</code>, <code>og:description</code>, <code>og:image</code> and <code>twitter:card</code>. Miss the first three and the platform falls back to whatever it can scrape from the page, which is usually the wrong heading and the first logo it finds. Miss <code>twitter:card</code> and X renders a bare link with no image, regardless of how good your Open Graph tags are.",
          "Twitter's tags are the ones people skip, on the assumption that X reads Open Graph. It does, but only once you have told it which card type to build. That one line is the difference between a full-width image and a plain URL.",
        ],
      },
      {
        h: "Why your card shows an image you replaced three weeks ago",
        p: [
          "Every platform caches what its scraper found the first time the URL was shared. LinkedIn holds it for roughly a week, Facebook indefinitely until something forces a re-scrape, X long enough that people assume the tag is broken. Editing the tag does not update the card.",
          "The reliable fix is to make the URL new. Adding a meaningless parameter such as <code>?v=2</code> forces a fresh fetch, because the cache is keyed on the full address. The official debuggers (LinkedIn Post Inspector, Facebook Sharing Debugger, X Card Validator) do the same thing without changing your URL, and they also tell you exactly which tags the scraper read — which is worth checking before you start editing.",
        ],
      },
      {
        h: "og:image mistakes that cost the click",
        p: [
          "A relative path is the most common one. It works in your HTML for a browser, because the browser resolves it against the page, but a scraper has no base URL to resolve against, so it just gives up. Always absolute, and always <code>https</code> — an http image on an https page is silently dropped by some platforms.",
          "Size matters next. Below roughly 200×200 most platforms refuse to use it as a large card. Above 8 MB Facebook will not process it. And 1.91:1 (1200×630 is the usual choice) is the ratio that survives the most layouts without being centre-cropped — a square image in a feed is a square image with its edges cut off.",
          "The subtle one is the missing <code>og:image:width</code> and <code>og:image:height</code>. Without them the scraper has to download the image to work out the layout, and if that download is slow or blocked the first share goes out with no image at all. Declaring the dimensions is a two-line fix for a problem that otherwise looks intermittent.",
          "Finally, hotlink protection. If your CDN blocks requests with a foreign <code>Referer</code>, the platform's scraper gets a 403 and you get a grey box — while the same URL opens perfectly in your browser. The preview above requests images with no referrer for exactly this reason.",
        ],
      },
      {
        h: "What this tool deliberately does not do",
        p: [
          "It does not fetch your live page. Reading another domain's HTML from the browser is blocked by the same-origin policy, and any tool that appears to do it is routing your URL through a server that can then see every page you check — the opposite of what a privacy-respecting tool should do.",
          "It also cannot force a platform to re-scrape, and it cannot tell you whether your image URL actually resolves. Both need a request from somewhere other than your browser.",
          "What you get instead is the part that matters while you are writing: the correct block of tags, an honest list of what will break the card, and a preview that shows you the crop before your readers see it.",
        ],
      },
    ],
    faq: [
      ["Do I need both Open Graph and Twitter tags?", "Twitter/X falls back to Open Graph for title, description and image, but it still needs twitter:card to know which layout to build. Without it you get a plain link."],
      ["What size should og:image be?", "1200×630 is the safe default — it is 1.91:1, well under the 8 MB limit, and large enough that no platform rejects it. Keep any text away from the edges."],
      ["Why does LinkedIn show an old image after I fixed it?", "Its scraper caches the card, typically for about seven days. Use the Post Inspector to force a refresh, or share the URL with a new query parameter."],
      ["Can I preview how Slack or WhatsApp render it?", "Both read Open Graph and render something close to the large card above. Exact typography differs per client and version, so treat the preview as a layout guide rather than a pixel-accurate mock."],
      ["Is anything I type sent to a server?", "No. Everything runs as JavaScript in your browser. The only outbound request is your browser loading the image you typed, if you provide one."],
    ],
    related: ["meta-tag-generator", "serp-preview", "schema-markup-generator"],
  },

  {
    slug: "hreflang-generator",
    nav: "hreflang",
    h1: "hreflang Tag Generator",
    fn: "hreflangGen",
    metaDesc:
      "Generate hreflang annotations as HTML link tags, an HTTP Link header, or sitemap entries — with validation for bad language codes and missing return tags.",
    intro:
      "List one line per language version and pick an output format. The generator writes the full cluster for every URL, because that is what the specification actually requires, and it flags the mistakes that make Google silently ignore the whole set.",
    ui: `
      <label>Language versions — one per line as <code>code | URL</code><textarea id="hl-rows" rows="7" placeholder="en-US | https://example.com/us/&#10;en-GB | https://example.com/uk/&#10;de-DE | https://example.com/de/"></textarea></label>
      <div class="grid2">
        <label>Fallback (x-default) URL — optional<input id="hl-def" type="text" placeholder="https://example.com/"></label>
        <label>Output format
          <select id="hl-fmt">
            <option value="html">HTML link tags</option>
            <option value="http">HTTP Link header</option>
            <option value="sitemap">XML sitemap xhtml:link</option>
          </select>
        </label>
      </div>
      <div id="hl-out" aria-live="polite"></div>`,
    steps: [
      "Enter one line per language version: the code, a pipe, then the full URL of that version.",
      "Optionally give an <code>x-default</code> URL for visitors whose language is not in the list.",
      "Pick the format you actually ship — head tags, HTTP header, or sitemap — and copy the block.",
    ],
    why: [
      {
        h: "The return tag is the part almost everyone misses",
        p: [
          "hreflang is a two-way statement. If your US page points at the German page, the German page has to point back, or Google treats the annotation as unconfirmed and ignores it. This is why a partial rollout — tags added to the English pages but not the translated ones — produces no change in search results whatsoever, and no error message either.",
          "Each page also has to annotate itself. A page that lists only its siblings, and not its own language, is an incomplete cluster. The generator writes the full set including the self-reference precisely so this cannot happen by omission.",
        ],
      },
      {
        h: "x-default is not your main language",
        p: [
          "It is the fallback for a visitor whose language matches nothing in your list — someone browsing in Portuguese when you publish English, German and Japanese. Pointing it at your English page is common and works, but the more useful target is a page that lets the visitor choose.",
          "It is optional, and Google will not penalise you for leaving it out. It earns its place when you have significant traffic from languages you do not publish in, which is most sites.",
        ],
      },
      {
        h: "Three places to put it — and why you should pick one",
        p: [
          "HTML <code>&lt;link&gt;</code> tags in the head, the <code>Link</code> HTTP response header, or <code>xhtml:link</code> entries in your XML sitemap. The header exists for non-HTML files — a PDF has no head — and the sitemap exists for sites with too many alternates to fit comfortably in a template.",
          "Mixing them is where it breaks. If one URL carries a different set of alternates in two places, the crawler has to guess which is authoritative, and a guess is worse than a single correct source. Pick one method per URL and keep it consistent across the whole cluster.",
          "Sitemap annotations carry an extra rule: every URL in that sitemap must have its complete cluster, including itself. A sitemap where half the entries are annotated and half are not is worse than none.",
        ],
      },
      {
        h: "Codes that look right and are not",
        p: [
          "<code>en-UK</code> is the classic one. The ISO 3166-1 code for the United Kingdom is GB, not UK, and while Google is forgiving in practice, other tooling and several CMS plugins are not. <code>en-GB</code> is the value to ship.",
          "Region subtags go uppercase and language subtags lowercase: <code>de-DE</code>, not <code>DE-de</code> or <code>de-de</code>. Google reads the values case-insensitively, so a slip here will not break the annotation, but it will break any downstream tooling that compares strings exactly.",
          "Only annotate canonical, indexable URLs. A hreflang link pointed at a redirected, noindexed or non-canonical URL is dropped, and — depending on how your cluster is built — can take the whole set down with it.",
        ],
      },
      {
        h: "What this tool deliberately does not do",
        p: [
          "It does not fetch your URLs. Verifying that each target returns 200, and that each page really does carry the reciprocal tags, means requesting pages on your domain from somewhere other than your browser — which browsers block, and which a privacy-respecting tool should not route through a third party anyway.",
          "It also cannot read the hreflang report in Google Search Console, which is the only place that tells you what Google actually accepted.",
          "Use this to get the cluster correct and complete. Then confirm it with Search Console's international targeting report, or by fetching two of the URLs and checking that each contains the other.",
        ],
      },
    ],
    faq: [
      ["Should hreflang point to the canonical URL?", "Yes. Only annotate self-canonical, indexable URLs. A target that redirects or carries noindex is ignored, which can invalidate the cluster."],
      ["Do I need hreflang for a single-language site?", "No. It only matters when you serve substantially the same content in more than one language. Adding it to a monolingual site does nothing."],
      ["Can I put hreflang in the sitemap and in the HTML at the same time?", "You can, but do not. Two sources that disagree leave the crawler guessing. Choose one method per URL set."],
      ["Is x-default required?", "Not required, but recommended when you have visitors in languages you do not publish. Point it at a language chooser rather than at one language version."],
      ["Is my data sent anywhere?", "No. Parsing and generation happen in your browser. Nothing you type leaves the page."],
    ],
    related: ["meta-tag-generator", "robots-txt-tester", "llms-txt-generator"],
  },
];

/* =================================================================
   指南
   ================================================================= */
const GUIDES = [
  {
    slug: "meta-description-length",
    // tags 是**单一数据源**：feed.xml 的 <category> 和 Dev.to 发布器都从这里取。
    // 不写的话 RSS 导入到 Dev.to 的文章会一个标签都没有（没标签 = 没分发）。
    tags: ["seo", "webdev", "html", "marketing"],
    h1: "Meta Description Length: What Gets Truncated",
    lead: "The number everyone quotes is 155 characters. The real rule is pixel width, and knowing the difference saves you from rewriting descriptions that were fine.",
    body: `
<h2>Where the 155-character rule comes from</h2>
<p>It is a working average, not a limit. Someone measured a batch of results, found the cut usually landed near 155 characters, and the number spread because it is easy to remember. What Google actually does is render the description in a specific font at a specific size inside a container of a specific width, then drop whatever does not fit.</p>
<p>The practical consequence: character count and rendered width disagree constantly. A description of 150 narrow characters fits. A description of 138 characters with several capital M and W does not. If you have ever shipped a snippet that looked correct in your CMS and appeared chopped in search, this is why.</p>

<h2>The two widths that matter</h2>
<p>Desktop results render the description at roughly 14px in a container around 600px wide. Mobile is narrower — meaningfully narrower, not marginally. A description tuned exactly to the desktop limit will be cut on a phone, and most of your traffic is on a phone.</p>
<p>The safe approach is to aim at the mobile limit, not the desktop one. Put the part that must survive in the first 120 characters and treat everything after that as optional elaboration.</p>

<h2>When Google ignores your description entirely</h2>
<p>Often. If Google decides a sentence from your page body matches the query better than the description you wrote, it substitutes that sentence. This is normal behaviour and not a signal that anything is wrong.</p>
<p>You cannot force it to use your text. What you can do is remove the reason to substitute: write the opening sentence of the page so that it would work as a snippet on its own, and keep the meta description aligned with what the page actually says. When the two agree, there is nothing to gain by swapping.</p>

<h2>What is not worth doing</h2>
<p>Do not stuff the description with keyword variants. Descriptions are not a ranking factor; their entire job is to earn the click. A description written for a machine reads like it was written for a machine, and gets skipped.</p>
<p>Do not write one description and reuse it across a template. Duplicate descriptions are not penalised, but they make every page in a set look identical in the results, which costs you the clicks that a specific sentence would have earned.</p>

<h2>A working method</h2>
<p>Draft the description last, after the page is written. At that point you know what the page actually delivers, and you can say it in one sentence without guessing. Descriptions written before the page exists tend to describe the page you intended rather than the one you shipped.</p>
<p>Then put the sentence into a preview and check where it lands. If the important part is past the mobile cut, move it forward rather than trimming the tail — the end of a description is the cheapest thing to lose.</p>
<p>One more thing worth doing: read the first sentence of the page body next to the description. If they are far apart, Google has a reason to substitute one for the other. Aligning them is the closest thing to control you have over what gets shown.</p>`,
    faq: [
      ["Is there an official Google limit?", "No. Google has never published a character limit for descriptions because the limit is rendered width, which varies by device and font."],
      ["Should I leave the description empty?", "Occasionally, for pages where no sentence summarises it well. Usually a written description beats whatever Google would pull."],
      ["Do emojis help a snippet stand out?", "Sometimes, but Google strips many of them, and the ones that survive can look like spam. Test before committing to it."],
    ],
  },
  {
    slug: "robots-txt-mistakes",
    tags: ["seo", "webdev", "beginners", "programming"],
    h1: "robots.txt Mistakes That Silently Deindex Pages",
    lead: "Five configuration errors that remove pages from Google without producing any error message anywhere.",
    body: `
<h2>1. Disallowing a page you also marked noindex</h2>
<p>This is the most damaging one and it looks reasonable. You want a page out of the index, so you add <code>noindex</code> — and you also disallow it so crawlers stop wasting time. But a crawler that cannot fetch the page can never read the noindex. The URL stays in the index indefinitely, usually with a note saying it was not crawled.</p>
<p>The fix is counterintuitive: to remove a page using noindex, you must <em>allow</em> crawling. Let Google fetch it, see the directive, and drop it. Only then disallow, if you still want to.</p>

<h2>2. Blocking CSS and JavaScript</h2>
<p>An older habit, and still common in older configs. Google renders pages, and rendering requires your stylesheets and scripts. Block <code>/assets/</code> or <code>/static/</code> and Google sees a page with no layout, which it may judge as broken or as a poor mobile experience.</p>
<p>Check your file for broad disallows on asset directories. If they exist, remove them — there is no upside to blocking Google from seeing your own stylesheet.</p>

<h2>3. Assuming order decides priority</h2>
<p>It does not. Within a user-agent group, the longest matching path wins regardless of line order. So <code>Disallow: /admin/</code> followed by <code>Allow: /admin/public/</code> leaves /admin/public/ crawlable. Reordering those lines changes nothing, which is why people conclude the file is being ignored when it is behaving exactly as specified.</p>

<h2>4. Wildcard patterns that over-match</h2>
<p><code>Disallow: /*.pdf$</code> blocks PDFs — and if written slightly wrong, blocks far more. A misplaced <code>*</code> or a missing <code>$</code> turns a narrow rule into a site-wide block. Because robots.txt produces no warnings, this can run for months before anyone notices the traffic drop.</p>
<p>Test every rule containing a wildcard against a few real URLs before deploying it. That is what the tester on this site is for.</p>

<h2>5. Forgetting that staging is one typo away from public</h2>
<p>A staging host protected by robots.txt alone is not protected. Any crawler that ignores the file — and there are many — will index it. Duplicate staging content competing with production is a slow, confusing problem to untangle later.</p>
<p>Put real authentication in front of staging. Keep the robots.txt disallow as well, but understand it is politeness, not a lock.</p>

<h2>A five-minute check that catches all of these</h2>
<p>Fetch your robots.txt and paste it into a tester. Then run five URLs through it: your homepage, a category page, a deep article, one asset from your stylesheet directory, and a URL you believe is blocked. If any of the five gives a verdict you did not expect, you have found the bug — and you have found it before Google did.</p>
<p>Do this again after any deploy that touches routing, and any time someone new edits the file. The failure mode here is silence: nothing breaks visibly, nothing appears in an error log, and traffic from one section of the site quietly stops arriving. A monthly five-minute check is the entire maintenance cost.</p>`,
    faq: [
      ["How long until a robots.txt change takes effect?", "Google usually rereads it within a day, but recrawling affected URLs takes longer. Allow up to a few weeks for the change to fully propagate."],
      ["Can robots.txt remove a page already indexed?", "No. Use noindex (and allow crawling) or the removals tool in Search Console. A disallow only stops future crawling."],
      ["Is a missing robots.txt a problem?", "No. Absence means everything is allowed, which is correct for most sites."],
    ],
  },
  {
    slug: "heading-structure-seo",
    tags: ["seo", "html", "a11y", "webdev"],
    h1: "Heading Structure: What H1–H6 Order Actually Does",
    lead: "Headings are document structure, not a ranking lever. Here is what they genuinely affect, and what is folklore.",
    body: `
<h2>What headings are for</h2>
<p>Headings create a navigable outline. A screen reader user can jump between headings to understand a page without reading it linearly; a sighted reader skims them to decide whether to read at all. That is their primary job, and it is a real job.</p>
<p>For search engines, headings help identify what each section covers. Google has stated that heading order is not a significant ranking factor — using them correctly will not move you up, and a messy outline will not by itself push you down.</p>

<h2>The H1 question</h2>
<p>Having more than one H1 is valid HTML5 and Google handles it without complaint. The argument for a single H1 is about clarity: a page with three H1s usually has three competing ideas about what it is about, and that ambiguity tends to show up in the snippet it earns.</p>
<p>The most common real problem is templating — a theme that renders the site name as an H1 on every page, pushing the actual page title down to H2. If your page titles are H2s site-wide, that is worth fixing.</p>

<h2>Skipped levels</h2>
<p>Going from H1 to H3 breaks the outline. For a screen reader, encountering a level 3 with no level 2 above it makes the hierarchy ambiguous. The fix is trivial: either promote the heading or introduce the missing level.</p>
<p>Never choose a heading level for its font size. Style headings with CSS and pick levels purely for structure. If your H3 looks better than your H2, restyle the H2.</p>

<h2>Writing headings that work</h2>
<p>Describe the section concretely. 'How the payout is calculated' beats 'Calculation'; 'What breaks on mobile' beats 'Mobile'. A heading should be understandable when read out of context, because that is exactly how most people encounter it.</p>
<p>Length matters less than specificity, but a heading over about 70 characters stops being scannable. If you need that many words, the section is probably two sections.</p>

<h2>Separating structure from styling</h2>
<p>The reason heading structure goes wrong so often is that HTML gives you six levels and design gives you three or four type sizes. When a designer needs a small bold line that is not a heading, the tempting move is to use an H5 and style it down. That works visually and breaks the outline.</p>
<p>Do it the other way around. Choose the level for meaning, then style each level in CSS to whatever the design needs. An H2 can be 15px if that is what the layout calls for — nothing in HTML says an H2 must be large. Once levels stop carrying visual meaning, you can use them purely for structure, which is the only thing they were ever for.</p>

<h2>Checking a page in under a minute</h2>
<p>Paste the page HTML into the analyzer and read the outline, not the issue count. If the H2 list reads like a table of contents, the structure is fine and the remaining warnings are cosmetic. If it does not, you have found the real problem — and it is usually that the page covers two topics and should be split, or that sections were never given headings at all.</p>
<p>Repeat for your five most important pages. Structure problems are almost always systemic: a template writes the same bad outline on every page, so fixing one usually means fixing hundreds.</p>`,
    faq: [
      ["Do keywords in headings help rankings?", "Marginally at most. A heading that naturally contains the topic word is fine; forcing keywords into H2s makes the outline worse."],
      ["Can I skip H1 and start at H2?", "Technically yes, but every page benefits from a clear top-level title. There is no reason to omit it."],
      ["Should headings be sentence case or title case?", "Pick one and be consistent across the site. Consistency matters more than the choice."],
    ],
  },

  {
    slug: "json-ld-graph-structure",
    tags: ["seo", "webdev", "javascript", "html"],
    h1: "JSON-LD @graph: Why One Block Beats Five",
    lead: "Most sites emit one JSON-LD block per schema type and never connect them. A single @graph with @id references fixes the duplication.",
    body: `
<h2>The pattern almost everyone starts with</h2>
<p>A site adds an Organization block to the footer, an Article block to the article template, and a BreadcrumbList to the breadcrumb component. Three separate <code>&lt;script type="application/ld+json"&gt;</code> blocks, each describing one thing. It works — Google reads all of them — and it is where most sites stop.</p>
<p>The cost is not visible immediately. It shows up the first time you rename your company, change your logo URL, or move to a new domain. Now you have three places that each contain the same facts, and nothing enforces that they agree. One gets updated, the others do not, and the structured data on your site now contradicts itself in a way no error message will tell you about.</p>

<h2>What @id actually does</h2>
<p>Every node in JSON-LD can carry an <code>@id</code>, which is a stable identifier — a URL is conventional. Once a node has an <code>@id</code>, any other node can refer to it by that identifier instead of repeating its properties.</p>
<p>So instead of the Article block containing its own copy of the publisher's name and logo, it contains <code>"publisher": { "@id": "https://example.com/#organization" }</code>. The full description of that organization lives once, in a node that other nodes point at. Change the logo in that one place and every reference is correct.</p>
<p>The practical payoff is that your structured data becomes a description of relationships rather than a set of isolated assertions. This article was published by that organization, on this website, and sits at this position in this breadcrumb trail. All of it expressed explicitly rather than inferred.</p>

<h2>The shape that works</h2>
<p>A layout that has held up well across several sites: one <code>@graph</code> array in the page head containing, in order, the Organization, the WebSite, the WebPage for the current URL, and then whatever page-specific nodes apply — an Article, a FAQPage, a HowTo, a Product.</p>
<p>The Organization and WebSite nodes are identical on every page, which is the point: they are declared once per page but defined consistently, and every page-specific node references them by <code>@id</code> rather than restating them. The WebPage node carries <code>datePublished</code> and <code>dateModified</code>, and the page-specific nodes carry their own.</p>
<p>Breadcrumbs attach to the WebPage rather than floating free, because a breadcrumb trail describes a position within a site hierarchy, and the hierarchy belongs to the page.</p>

<h2>Where this goes wrong</h2>
<p><strong>Referencing an @id that does not exist on the page.</strong> If the Article says its publisher is <code>#organization</code> but no node with that <code>@id</code> is present, the reference resolves to nothing. Google handles this by ignoring the property, so the symptom is not an error — it is silently missing data. Always include the node you reference.</p>
<p><strong>Using the same @id for different things.</strong> Identifiers must be unique. Two nodes sharing an <code>@id</code> means you have declared two contradictory definitions of one entity, and the outcome depends on which one a consumer reads first.</p>
<p><strong>Absolute versus relative @id values.</strong> Use absolute URLs. A relative reference like <code>#organization</code> is interpreted against the page URL, which means the same markup on two domains produces two different identifiers, and any relationship you were trying to express across pages breaks.</p>

<h2>Dates deserve their own paragraph</h2>
<p><code>datePublished</code> should never change after the page goes live. <code>dateModified</code> should change when the content genuinely changes, and not otherwise.</p>
<p>Incrementing <code>dateModified</code> on every deploy is a common habit, usually adopted because someone believed freshness helps rankings. It does not, and the pattern is easy to detect: a modified date that advances daily while the words stay identical tells any consumer that the field is noise, which means it will be discounted on the pages where it was actually true.</p>
<p>If you use a build system, wire <code>dateModified</code> to a per-page content hash rather than to the build timestamp. That way the field moves only when the content does.</p>

<h2>Checking your markup</h2>
<p>Validate with Google's Rich Results Test for eligibility and the Schema Markup Validator for syntax. Neither will tell you that your <code>@id</code> references are dangling, because a dangling reference is not a syntax error.</p>
<p>The check that catches it is manual and takes a minute: extract the list of <code>@id</code> values defined in the page, then extract every value used in a reference, and confirm every reference appears in the defined list. On a page with six nodes this is faster to do by eye than to automate.</p>`,
    faq: [
      ["Do I need @graph, or can I use separate script blocks?", "Separate blocks work and Google reads them. @graph is preferable when the nodes relate to each other, because it lets you express those relationships with @id instead of repeating properties in several places."],
      ["Does one @graph block hurt performance?", "No. It is a few kilobytes of text in the head. The parse cost is negligible next to a single image."],
      ["Should Organization appear on every page?", "Yes, as a node with a stable @id, so page-specific nodes can reference it without restating its properties."],
      ["What is the correct @id format?", "An absolute URL with a fragment is conventional, for example https://example.com/#organization. The only hard requirements are that it is unique within the page and stable over time."],
    ],
  },

  {
    slug: "pre-publish-seo-checklist",
    tags: ["seo", "webdev", "html", "a11y"],
    h1: "A Pre-Publish SEO Checklist for Any New Page",
    lead: "Nine checks that take under ten minutes and catch the mistakes that are invisible after publishing. Ordered so that the cheap ones come first.",
    body: `
<h2>Why a checklist rather than a tool</h2>
<p>Every item here has a dedicated tool on this site, and you can run them in any order. The reason to work from a list is that the failure mode is not a broken page — it is a page that looks finished. A missing canonical, a duplicate H1, a description that gets truncated: none of these produce a visible symptom. The page renders, the content is good, and the problem is only discoverable weeks later in a report nobody reads closely.</p>
<p>The order below is deliberate. Structural checks first, because fixing them often changes the text, and re-running content checks after a rewrite wastes the first pass.</p>

<h2>1. Does the page have exactly one H1?</h2>
<p>Not zero, not two. Zero usually means the title was styled with a class rather than a heading element. Two usually means a template printed the site name as an H1 and the page title as another. Both are invisible in a browser and both make the page's main subject ambiguous.</p>
<p>Run the HTML through the <a href="/tools/heading-analyzer">heading analyzer</a> and read the outline rather than the warnings. If the H2 list reads like a table of contents for the page, the structure is sound.</p>

<h2>2. Do the heading levels descend without skipping?</h2>
<p>An H2 followed by an H4 tells a reader that a level is missing. Sometimes a level genuinely is missing and the outline is still correct — but more often the H4 was chosen for its smaller font size. Choose levels for meaning and style them in CSS; nothing in HTML requires an H2 to be visually larger than an H3.</p>

<h2>3. Is the title tag specific to this page?</h2>
<p>Open ten tabs of your site and read the titles. If several are identical, those pages compete with each other for the same query and none of them wins clearly. A title should describe what this page specifically covers, not the category it belongs to.</p>

<h2>4. Will the description survive truncation?</h2>
<p>The widely quoted 155-character limit is an average, not a rule — the real constraint is rendered pixel width, and mobile is narrower than desktop. Put the sentence that must survive in the first 120 characters and treat the rest as elaboration. See <a href="/guides/meta-description-length">the full explanation</a> if you want the details.</p>
<p>Preview it rather than counting: the <a href="/tools/serp-preview">SERP preview tool</a> measures in pixels and shows exactly where the cut lands.</p>

<h2>5. Does the canonical point at itself?</h2>
<p>A page's canonical should be its own URL, in the same form the page is served at. Trailing-slash mismatches are the common case: if <code>/tools</code> redirects to <code>/tools/</code>, the canonical must say <code>/tools/</code>, or you are telling Google that the real page is a URL that redirects.</p>
<p>Check this on index pages specifically. They are the ones most often generated with a canonical that omits the trailing slash.</p>

<h2>6. Is the page in the sitemap, with the right URL form?</h2>
<p>Same trailing-slash question. A sitemap entry that redirects is a wasted crawl. If your sitemap is generated, generate the canonical at the same time from the same value — two independent string constructions will eventually disagree.</p>

<h2>7. Are the internal links real and useful?</h2>
<p>Every new page should link to at least two existing pages, and at least one existing page should link to it. A page that nothing links to is a page that is hard to find, and internal links are the only navigation signal you fully control.</p>
<p>Link with descriptive anchor text. "Read the guide" tells a reader nothing about where it goes; the text should describe the destination.</p>

<h2>8. Do images have dimensions and alt text?</h2>
<p>Set explicit width and height attributes on every image. Without them the browser cannot reserve space, and the page shifts as images load — which is the single most common cause of a poor layout-shift score.</p>
<p>Alt text describes the image for someone who cannot see it. If the image is purely decorative, an empty <code>alt=""</code> is correct and better than a description nobody needs.</p>

<h2>9. Does the structured data describe this page accurately?</h2>
<p>If you mark up an Article, the headline should match the visible title and the dates should be real. If you mark up an FAQ, those questions must be visible on the page — markup describing content that is not there is a violation, not an optimisation.</p>
<p>See <a href="/guides/json-ld-graph-structure">the @graph guide</a> for how to keep the nodes consistent, or generate the markup with the <a href="/tools/schema-markup-generator">schema generator</a>.</p>

<h2>What is deliberately not on this list</h2>
<p>Keyword density. There is no target to hit, and writing to one produces worse text. Run the <a href="/tools/keyword-density">density checker</a> only to see whether the page is actually about the topic you intended — if the top phrases surprise you, that is a content problem, not a density problem.</p>
<p>Word count. Length is a consequence of covering the subject, not a goal. A page that answers the question in 400 words is finished; padding it to 1200 makes it worse.</p>
<p>Meta keywords. They have been ignored for over a decade.</p>`,
    faq: [
      ["How long should this take?", "Under ten minutes once you are used to it. The tool runs are seconds each; most of the time goes into reading the heading outline and checking the canonical form."],
      ["Should I run this before or after publishing?", "Before, on a staging URL if you have one. Canonical and sitemap checks are easier when the URL form is not yet live, because there is nothing to compare against."],
      ["Is this list complete?", "It covers the checks that catch invisible problems. Technical performance, accessibility and content quality all matter and are separate disciplines."],
    ],
  },
  {
    slug: "robots-txt-in-the-wild",
    tags: ["seo", "webdev", "javascript", "programming"],
    h1: "What 71 Sites Actually Put in robots.txt",
    lead: "We fetched the robots.txt of 78 high-traffic sites. A quarter declare no sitemap at all, and five still ship a directive Google ignores.",
    body: `
<h2>How this was measured</h2>
<p>On 2026-09-23 we fetched <code>https://&lt;domain&gt;/robots.txt</code> for 78 high-traffic domains spanning news, ecommerce, SaaS, developer, social, finance, education and government categories. Of those, 71 returned a usable plain-text file. Two returned HTML instead of robots.txt, and five could not be read at all — four behind bot protection returning HTTP 403 or 418, and one returning 404 because no file exists.</p>
<p>Fetching used curl from a single machine with a two-tier transport: direct connection first, then a local proxy for domains the direct route could not reach. 46 of the 71 files came back over the direct connection and 25 over the proxy. That split is a property of our network rather than of the sites, and it is not distributed evenly across categories — which is the main caveat on everything below.</p>
<p>Parsing was done line by line, with user-agent groups respected. A <code>Disallow: /</code> that applies only to a scraper group is not treated as applying to Googlebot. The script and the domain list ship with this site, so every number here can be re-derived rather than taken on trust.</p>

<h2>Finding 1: 24% declare no sitemap</h2>
<p>54 of the 71 sites (76%) declare at least one sitemap, and 26 declare more than one. The other 17 declare none at all:</p>
<p><code>forbes.com, amazon.com, etsy.com, shopify.com, github.com, gitlab.com, reddit.com, linkedin.com, quora.com, npmjs.com, python.org, go.dev, mozilla.org, w3.org, ahrefs.com, screamingfrog.co.uk, mit.edu</code></p>
<p>Two things make that list worth reading. First, it contains sites with enormous page counts — Amazon, LinkedIn, Reddit — where a sitemap would seem most useful. Second, it contains two companies that sell SEO tools. That is not hypocrisy; it is evidence that the robots.txt sitemap line is genuinely optional in practice.</p>
<p>Be precise about what "no sitemap line" means. It does not mean the site has no sitemap. A sitemap can be submitted directly in Search Console and never mentioned in robots.txt, which is a valid setup and arguably the cleaner one — the file stays about access control, and discovery is handled where discovery is managed. What the omission does mean is that any crawler relying on robots.txt to find sitemaps will not find these ones.</p>
<p>If you are unsure whether your own file is read the way you think it is, paste it into the <a href="/tools/robots-txt-tester">robots.txt tester</a> and run a few real URLs through it.</p>

<h2>Finding 2: Crawl-delay is still shipping, and Google ignores it</h2>
<p>Five sites put <code>Crawl-delay</code> in the <code>User-agent: *</code> group: <code>x.com</code>, <code>tumblr.com</code>, <code>vimeo.com</code>, <code>semrush.com</code> and <code>searchengineland.com</code>.</p>
<p><code>Crawl-delay</code> is not a Google directive. Googlebot has never supported it, and crawl rate is controlled in Search Console instead. So for the crawler it was most likely written for, the line does nothing.</p>
<p>It is not harmless, though. It is a signal that whoever maintains the file believes it controls crawl rate — and when that belief is wrong, the decisions made from it are wrong too. On a site genuinely being crawled too hard, the fix is the crawl rate setting, not a line in robots.txt.</p>
<p>One site in the sample uses <code>Crawl-delay</code> in a way worth copying rather than fixing. See the aside further down.</p>

<h2>Finding 3: sitemaps that point somewhere else</h2>
<p>Two sites declare a sitemap on a host other than the one being crawled.</p>
<p><code>notion.so</code> declares eleven sitemaps, all on <code>www.notion.com</code>. That is a brand migration caught mid-flight — the .so domain being retired in favour of .com, with the old host's robots.txt pointing at the new one. It works, but the .so file can no longer be removed without breaking discovery for anyone still crawling it.</p>
<p><code>trello.com</code> declares exactly one sitemap, on <code>a594014.sitemaphosting7.com</code> — a third-party sitemap host, not a Trello domain. Cross-host sitemap declarations are valid and Google accepts them, but they hand part of your discovery infrastructure to a domain you do not control. If that host changes its URL scheme or disappears, the declaration stops working silently.</p>

<h2>Finding 4: http:// in a 2026 sitemap line</h2>
<p>Two sites declare sitemap URLs over plain HTTP: <code>theguardian.com</code> and <code>who.int</code>.</p>
<p>The URL is followed with a redirect, so it usually still resolves. But it is a needless hop, and on sites that moved to HTTPS everywhere else it is the kind of leftover that suggests the file has not been reviewed in years. The check takes seconds: search your robots.txt for <code>http://</code> and replace it with <code>https://</code>.</p>

<h2>Finding 5: two sites serve HTML at /robots.txt</h2>
<p><code>khanacademy.org</code> and <code>cdc.gov</code> both return HTTP 200 with an HTML document at <code>/robots.txt</code>.</p>
<p>This is a soft 404: the request succeeds, so nothing alerts, but the content is not a robots.txt file. A crawler parsing it finds no directives and falls back to "everything allowed" — the same outcome as an empty file. The failure is invisible in a browser and invisible to a status-code monitor. It is exactly the class of problem a plain-text check catches and a dashboard does not.</p>

<h2>What we did not find: nobody blocks their own sitemap</h2>
<p>Before running this, we expected a handful of sites to declare a sitemap and then block it with their own <code>Disallow</code> rule — a classic own-goal that appears in most lists of robots.txt mistakes, including <a href="/guides/robots-txt-mistakes">our own</a>.</p>
<p>Zero out of 71 did.</p>
<p>That is worth stating plainly. The mistake is real and worth checking for, but across a sample this size it did not occur once. Advice can be technically correct and still miscalibrated about how often the problem actually happens — and the way to find out is to look, not to repeat the list.</p>

<h2>An aside worth stealing: github rate-limits AI crawlers</h2>
<p>github.com's robots.txt contains 13 user-agent groups, and one of them is a block listing <code>GPTBot</code>, <code>OAI-SearchBot</code>, <code>ClaudeBot</code>, <code>anthropic-ai</code> and <code>PerplexityBot</code>, carrying <code>Crawl-delay: 1</code>.</p>
<p>So that <code>Crawl-delay</code> is not a mistake. It is aimed at AI crawlers rather than Googlebot, and it is a deliberate attempt to slow bulk training and answer-engine fetching without touching search crawling. Whether the receiving crawlers honour it is a separate question — most have not committed to it — but the structure is a reasonable pattern: one group for search, another for AI, different policies in each.</p>
<p>If you are trying to control AI crawlers, that separation is the part worth copying. The <a href="/tools/llms-txt-generator">llms.txt generator</a> covers the other half of the same problem.</p>

<h2>What to check on your own site</h2>
<p><strong>Does /robots.txt return plain text?</strong> Curl it and read the first line. If you see <code>&lt;!DOCTYPE</code>, you have a soft 404 and none of your directives are being applied at all.</p>
<p><strong>Is every declared sitemap on your own host?</strong> Cross-host declarations work until they don't.</p>
<p><strong>Is there an <code>http://</code> anywhere in it?</strong> Replace it with <code>https://</code>.</p>
<p><strong>Is <code>Crawl-delay</code> in there?</strong> If it targets Googlebot, delete it and use the crawl rate setting. If it targets AI crawlers, keep it but give it its own user-agent group.</p>
<p><strong>Does your sitemap URL form match your canonical URL form?</strong> An entry that redirects is a wasted crawl. This is the same trailing-slash question covered in the <a href="/guides/pre-publish-seo-checklist">pre-publish checklist</a>.</p>

<h2>Limitations</h2>
<p>Seventy-one sites is a sample, not a census, and it is not random. The domains were chosen by hand to span categories, which makes them representative of "well-known sites" rather than of "the web". Sites behind bot protection are systematically missing, and those are disproportionately large and heavily defended — so the true rate of unreadable robots.txt files is likely higher than the 5 in 78 measured here.</p>
<p>robots.txt is also a moving target. Files change without notice and this is a single-day snapshot, so the counts are a point-in-time measurement rather than a standing fact. Where a specific site is named, the raw body we retrieved is the arbiter.</p>

<h2>Reproduce it</h2>
<p>The survey script and the domain list are part of this site's source. It runs in about a minute and writes a per-domain table plus the raw files, so any claim on this page can be checked against the source text instead of taken on our word.</p>
<p>If you spot an error in a specific row, the raw body settles it — and corrections are welcome via the <a href="/contact">contact page</a>.</p>`,
    faq: [
      ["Is a sitemap in robots.txt required?", "No. Submitting it directly in Search Console is equally valid and keeps the file focused on access control. Many large sites declare none."],
      ["Does Google support Crawl-delay?", "No. Googlebot has never honoured it. Use the crawl rate setting in Search Console instead."],
      ["Can a sitemap live on another domain?", "Yes, if you verify that domain. It works, but it puts discovery on infrastructure you do not control."],
    ],
  },
  {
    slug: "json-ld-in-the-wild",
    tags: ["seo", "webdev", "javascript", "html"],
    h1: "What 61 Homepages Actually Ship in JSON-LD",
    lead: "We parsed the JSON-LD on 61 homepages. Half ship none in their HTML, and 14 still carry markup for a feature Google retired in 2024.",
    body: `
<h2>How this was measured</h2>
<p>On 2026-09-23 we fetched the homepage of 78 well-known domains and extracted every <code>&lt;script type="application/ld+json"&gt;</code> block from the response. 61 returned a usable page — 42 over a direct connection and 19 over a local proxy. Of those 61, 32 contained at least one JSON-LD block.</p>
<p>One caveat governs everything below, so it belongs at the top rather than the bottom: <strong>this measures what is present in the server-rendered HTML.</strong> A page that injects its structured data with JavaScript will look empty here even though a browser — and Google, which renders — would see it. Single-page applications are the obvious case. So when this article says a site "ships none", read it as "none in the initial HTML response", which is a different and weaker claim.</p>
<p>For the sites where we did find markup, that caveat disappears: everything about blocks, <code>@graph</code>, <code>@id</code> and node types is measured on markup that was actually present.</p>

<h2>Finding 1: about half ship nothing in the HTML</h2>
<p>29 of the 61 homepages contained no JSON-LD block at all. The list includes <code>github.com</code>, <code>youtube.com</code>, <code>wikipedia.org</code>, <code>w3.org</code>, <code>mozilla.org</code>, <code>linkedin.com</code>, <code>x.com</code>, <code>spotify.com</code>, <code>npmjs.com</code>, <code>nodejs.org</code>, <code>kubernetes.io</code>, <code>mit.edu</code>, <code>stanford.edu</code>, <code>khanacademy.org</code>, <code>theguardian.com</code>, <code>slack.com</code>, <code>notion.so</code>, <code>trello.com</code>, <code>tumblr.com</code>, <code>vimeo.com</code>, <code>archive.org</code>, <code>wikimedia.org</code>, <code>digitalocean.com</code>, <code>squareup.com</code>, <code>uber.com</code>, <code>cdc.gov</code>, <code>go.dev</code>, <code>rust-lang.org</code> and <code>developer.mozilla.org</code>.</p>
<p>Some of those are certainly JavaScript-rendered and will have markup in a browser. But <code>wikipedia.org</code> is not a JavaScript application, and neither is <code>w3.org</code> or <code>github.com</code> — those responses were 119KB, 51KB and 576KB of ordinary server-rendered HTML with no structured data anywhere in them.</p>
<p>The honest conclusion is narrower than "half the web has no structured data" and more useful than nothing: shipping JSON-LD is a choice that a large share of serious sites have not made, and it is not a precondition for ranking.</p>

<h2>Finding 2: 14 sites still ship markup for a retired feature</h2>
<p>This was the most surprising result. Google retired the sitelinks search box on <strong>21 November 2024</strong> — the search field that used to appear under a brand's result. The markup that powered it, a <code>SearchAction</code> on the <code>WebSite</code> node, now produces nothing.</p>
<p>Fourteen of the 32 sites with JSON-LD still carry it: <code>cnn.com</code>, <code>forbes.com</code>, <code>walmart.com</code>, <code>atlassian.com</code>, <code>zoom.us</code>, <code>pinterest.com</code>, <code>docker.com</code>, <code>python.org</code>, <code>screamingfrog.co.uk</code>, <code>yoast.com</code>, <code>cloudflare.com</code>, <code>heroku.com</code>, <code>airbnb.com</code> and <code>who.int</code>.</p>
<p>Two of those are SEO tool vendors. That is the interesting part: this is not a case of amateurs leaving stale markup around. It is a case of markup that was correct when it was written, that nothing broke when it stopped mattering, and that no tool flags because it is still valid schema.org. There is no error, no warning, and no rich result — just a few lines of JSON that no longer do anything.</p>
<p>It is worth being fair about this: leaving it in place costs nothing measurable. We are not suggesting the markup is harmful. The point is that it is invisible dead weight, and the only way to notice is to know the feature was retired — which is exactly the kind of thing that a site audit will never tell you.</p>
<p>If you are auditing your own markup, this is the check that pays: <strong>is any of it aimed at a feature that no longer exists?</strong> The <a href="/tools/schema-markup-generator">schema generator</a> on this site does not emit <code>SearchAction</code> for that reason.</p>

<h2>Finding 3: a single block is the norm, and @graph is the minority</h2>
<p>Of the 32 sites with markup, 24 used exactly one block, four used two, three used three, and one used four. So the "many small blocks" pattern that <a href="/guides/json-ld-graph-structure">our @graph guide</a> warns about is not actually the common shape — one block is.</p>
<p>Within that single block, however, the split matters. Only <strong>13 of the 32 (41%)</strong> use a <code>@graph</code> array. The rest put a single node at the top level.</p>
<p>The 13: <code>gitlab.com</code>, <code>atlassian.com</code>, <code>zoom.us</code>, <code>asana.com</code>, <code>docker.com</code>, <code>twitch.tv</code>, <code>moz.com</code>, <code>screamingfrog.co.uk</code>, <code>yoast.com</code>, <code>searchenginejournal.com</code>, <code>stripe.com</code>, <code>netlify.com</code> and <code>heroku.com</code>.</p>
<p>Look at that list again. Four of the thirteen are SEO tool vendors or SEO publications — Moz, Screaming Frog, Yoast and Search Engine Journal. When the people who build the tooling converge on a pattern, that is usually worth more than a spec reading, and it is consistent with the argument in the @graph guide: one connected graph beats several disconnected blocks.</p>

<h2>Finding 4: most markup is boilerplate</h2>
<p>Twenty of the 32 sites ship only generic node types — <code>Organization</code>, <code>WebSite</code>, <code>WebPage</code>, <code>ContactPoint</code>, <code>PostalAddress</code> — with nothing specific to the page being viewed.</p>
<p>The type frequency across all 32 tells the same story. The most common types were <code>PostalAddress</code> (33 occurrences), <code>Organization</code> (25), <code>Place</code> (24), <code>WebSite</code> (20) and <code>ImageObject</code> (20). <code>BreadcrumbList</code> appeared 6 times. <code>SoftwareApplication</code> 6 times. <code>VideoObject</code> 6 times.</p>
<p>More addresses than web pages. For a homepage that is defensible — the homepage is where the organization describes itself. But it means that on most of these sites, the structured data says "here is a company" and never says "here is what this particular page is about".</p>

<h2>Finding 5: the pattern at full size</h2>
<p><code>stripe.com</code> packs <strong>54 nodes into a single <code>@graph</code></strong> — by a wide margin the largest we found, and more than the next three sites combined.</p>
<p>That is the @graph pattern doing what it is for. Fifty-four connected nodes with <code>@id</code> references resolve to one coherent description of the site rather than fifty-four independent assertions that must agree with each other by hand.</p>

<h2>What we did not find: almost no dangling references</h2>
<p>Our <a href="/guides/json-ld-graph-structure">@graph guide</a> warns that referencing an <code>@id</code> which is never defined causes the property to be silently ignored. We expected to find this in the wild.</p>
<p>One site out of 32 — <code>paypal.com</code>, with a single reference to <code>https://www.paypal.com/c2/home#website</code> that no node defines.</p>
<p>Two other things we expected and did not find: <strong>zero</strong> JSON parse failures across every block we extracted, and no site shipping markup in more than four blocks. Invalid JSON-LD and block sprawl both turn out to be much rarer than the advice would suggest.</p>
<p>This is the second time in two surveys that a widely repeated warning did not appear at all in a sample of this size. That is not an argument for ignoring the warnings — a dangling reference is still a bug — but it is an argument for checking how often the thing you are worried about actually happens before you spend a week refactoring.</p>

<h2>What to check on your own markup</h2>
<p><strong>Is any of it aimed at a retired feature?</strong> <code>SearchAction</code> is the one to search for today. Check the markup against the current list of supported rich results rather than against a tutorial you followed in 2023.</p>
<p><strong>Does it say anything about this page?</strong> If every page on your site emits the same <code>Organization</code> and <code>WebSite</code> nodes and nothing else, the markup is describing your company and not your content.</p>
<p><strong>Is it one connected graph or several disconnected blocks?</strong> Neither is an error. One is easier to keep consistent.</p>
<p><strong>Does every <code>@id</code> you reference exist on the page?</strong> Extract the defined <code>@id</code> values and the referenced ones and compare the lists. It takes a minute by eye on a page with under ten nodes.</p>

<h2>Limitations</h2>
<p>The sample is 61 reachable homepages chosen by hand to span categories — representative of well-known sites, not of the web. Homepages only: article, product and FAQ markup lives on inner pages and is not measured here.</p>
<p>The server-rendered caveat is the big one. Any JavaScript-injected markup is invisible to this method, so the true rate of sites using structured data is certainly higher than 52%. The findings about <code>@graph</code>, node types and <code>SearchAction</code> are drawn only from markup we actually retrieved, so they are unaffected — but the headline number is a floor, not a rate.</p>
<p>Finally, this is a single-day snapshot of pages that change constantly.</p>

<h2>Reproduce it</h2>
<p>The extraction script and the domain list ship with this site and run in about two minutes. It writes the extracted JSON-LD for every domain, so each claim above can be checked against the markup itself rather than our summary of it.</p>
<p>If a row is wrong, the markup settles it. Corrections via the <a href="/contact">contact page</a> — and if you know why the sitelinks search box markup is still so widespread two years after retirement, we would like to hear that too.</p>`,
    faq: [
      ["Do I need structured data to rank?", "No. Half the homepages we fetched ship none and rank fine. It affects eligibility for rich results, not ranking itself."],
      ["Should I remove SearchAction markup?", "It is harmless, but it does nothing since November 2024. Removing it is tidier than keeping dead code you will later assume is working."],
      ["Is @graph required?", "No. Only 41% of the sites we checked use it. It is a consistency tool, not a requirement."],
    ],
  },
  {
    slug: "open-graph-in-the-wild",
    tags: ["seo", "webdev", "html", "javascript"],
    h1: "What 62 Homepages Actually Ship in Open Graph",
    lead: "We read the Open Graph tags on 62 homepages. 90% have some, only 23% declare image dimensions, and two sites ship an og:image tag that carries nothing.",
    body: `
<h2>How this was measured</h2>
<p>On 2026-09-23 we fetched the homepage of 78 well-known domains and parsed every <code>&lt;meta&gt;</code> tag whose <code>property</code> or <code>name</code> began with <code>og:</code> or <code>twitter:</code>. 62 returned a usable page — 41 over a direct connection and 21 over a local proxy.</p>
<p>Two counting rules governed everything below, and both changed the numbers. First, a tag whose <code>content</code> attribute is empty or missing counts as absent: <code>og:title=""</code> is a tag that exists and says nothing. Second, nothing was rendered — this is what the server returned, so any tag injected by JavaScript is invisible here. That caveat bites less for social tags than it did for our JSON-LD survey, because social metadata is usually server-rendered precisely because crawlers do not run JavaScript, but it still makes these figures a floor rather than a rate.</p>

<h2>Finding 1: Open Graph is near-universal; Twitter cards are not</h2>
<p>56 of the 62 homepages (90%) carried at least one Open Graph tag. But "90% have Open Graph" hides how patchy the individual fields are:</p>
<p><code>og:title</code> 54/62 (87%) · <code>og:description</code> 53/62 (85%) · <code>og:url</code> 49/62 (79%) · <code>og:image</code> 48/62 (77%) · <code>og:type</code> 48/62 (77%) · <code>og:site_name</code> 40/62 (65%) · <code>og:locale</code> 22/62 (35%).</p>
<p>So roughly one homepage in four has no shareable image at all. That is not a ranking problem — Open Graph has no effect on search — but it is a click problem, and it is invisible from inside the site because everything looks fine.</p>
<p>The Twitter side is where the real gap opens. 34 sites (55%) declared <code>twitter:card</code> as <code>summary_large_image</code>, 14 as <code>summary</code>, 2 as <code>app</code>, and <strong>12 declared no <code>twitter:card</code> at all</strong> — about one in five. X falls back to Open Graph for title, description and image, but it still needs <code>twitter:card</code> to know which layout to build. Without it you get a plain link, no matter how good the Open Graph tags are.</p>

<h2>Finding 2: two sites ship an og:image tag with nothing in it</h2>
<p>We expected this to be common, because it is the mistake that produces a grey box: a site declares a large-image card and supplies no image. It turned out to be rare — 2 of the 34 sites declaring <code>summary_large_image</code> had no usable <code>og:image</code>.</p>
<p>Both are worth looking at, because they fail in different ways.</p>
<p><code>netflix.com</code> declares <code>twitter:card = summary_large_image</code> and <code>twitter:site</code>, and nothing else — no <code>og:image</code>, no <code>og:title</code>, no <code>og:url</code>. The card type promises a large image that was never supplied.</p>
<p><code>forbes.com</code> is the more instructive one, because it does emit the tag:</p>
<p><code>&lt;meta property="og:image" name="image" data-next-head=""/&gt;</code></p>
<p>There is no <code>content</code> attribute at all. The tag is present, a checker that asks "does <code>og:image</code> exist?" answers yes, and there is no image. Its <code>twitter:image</code> has the same shape, and its <code>og:image:type</code> is <code>image/jpeg,image/gif,image/png</code> — a comma-separated list, which is not a single MIME type and is not a valid value for that field.</p>
<p>This is the failure mode worth remembering, because it is the one automated checks miss. A missing tag fails loudly. A present-but-empty tag passes every "is it there" check and renders nothing.</p>
<p>We should be candid that we had this backwards. Until the day this data was collected, every one of the 25 pages on this site declared <code>twitter:card = summary_large_image</code> with no <code>og:image</code> — the pattern that turns out to be rare in the wild. It is fixed now, and that fix is what led to the next finding.</p>

<h2>Finding 3: only 23% declare image dimensions</h2>
<p>Of the 48 homepages with a usable <code>og:image</code>, just 11 (23%) also declared <code>og:image:width</code> and <code>og:image:height</code>. The rest leave the scraper to download the image and work out the layout for itself.</p>
<p>That sounds harmless until you think about what happens on the first share. The platform has to fetch the image before it can build the card. If that fetch is slow, rate-limited or blocked — a CDN that dislikes the crawler's user agent, a region where the image host is slow — the first share goes out with no image and the second one works. An intermittent bug like that is far harder to diagnose than a missing tag.</p>
<p>The 11 that declare dimensions: <code>figma.com</code>, <code>x.com</code>, <code>docker.com</code>, <code>developer.mozilla.org</code>, <code>w3.org</code>, <code>moz.com</code>, <code>screamingfrog.co.uk</code>, <code>yoast.com</code>, <code>searchenginejournal.com</code>, <code>harvard.edu</code> and <code>heroku.com</code>.</p>
<p>Four of those — Moz, Screaming Frog, Yoast and Search Engine Journal — are SEO vendors or SEO publications. All four SEO sites in the sample declare dimensions, against 23% overall. They are the same four that showed up as <code>@graph</code> users in our <a href="/guides/json-ld-in-the-wild">JSON-LD survey</a>, which is a consistent signal: the sites whose business is this metadata treat it more carefully than average by a wide margin.</p>
<p>Only 5 of the 48 (10%) declared <code>og:image:alt</code>. Alternative text on a social card is not decorative — it is what a screen reader announces.</p>

<h2>Finding 4: one in four og:title disagrees with the title</h2>
<p>14 of the 54 homepages with both a <code>&lt;title&gt;</code> and an <code>og:title</code> showed different text in each — 26%.</p>
<p>Most are trivial: <code>github.com</code> drops a trailing "· GitHub" from the Open Graph version. Some are not. <code>kubernetes.io</code> has <code>&lt;title&gt;Kubernetes&lt;/title&gt;</code> alongside <code>og:title = Production-Grade Container Orchestration</code>, so the search result says one thing and the shared link says another. <code>asana.com</code> ships "Work &amp; Project Management for Human-Agent Teams • Asana" as its title and "Asana: The OS for human-agent teams" in the card.</p>
<p>Neither is wrong. But it means the title you optimise for search is not the title people see when the page is shared, and those are usually written for different purposes. If you only ever check one, check the one that appears in search.</p>

<h2>Finding 5: what we expected and did not find</h2>
<p>Across the 48 usable images: <strong>one</strong> relative path — <code>kubernetes.io</code>, at <code>/images/kubernetes-open-graph.png</code> — <strong>zero</strong> <code>http://</code> images, and <strong>zero</strong> sites declaring more than one <code>og:image</code>.</p>
<p>Relative <code>og:image</code> URLs are the classic warning: scrapers have no base URL to resolve against, so the tag gets dropped. It happens once in 48. Insecure images, not at all. This is the third survey in a row where a widely repeated warning turned out to be rare at this sample size — which is not an argument for ignoring the warnings, but is an argument for checking the base rate before spending a day on the thing you are worried about.</p>

<h2>What to check on your own tags</h2>
<p><strong>Is the image tag carrying anything?</strong> View source and look for <code>content=</code>. A tag with no content attribute is the one check a validator will not do for you.</p>
<p><strong>Do you declare width and height?</strong> Two lines, and it removes the "first share has no image" failure mode entirely.</p>
<p><strong>Do you declare twitter:card?</strong> One in five sites we checked skip it, and it is the difference between a card and a bare link.</p>
<p><strong>Does og:title match your title?</strong> If not, decide which one you meant and make them agree — or accept that you have written two titles and maintain both.</p>
<p>The <a href="/tools/open-graph-preview">Open Graph Preview</a> renders what your tags will actually produce, and the <a href="/tools/meta-tag-generator">meta tag generator</a> emits the full set including dimensions and alt text.</p>

<h2>Limitations</h2>
<p>62 homepages chosen by hand to span categories — representative of well-known sites, not of the web. Homepages only; article and product pages carry different tags and are not measured here.</p>
<p>Server-rendered HTML only, so JavaScript-injected tags are invisible and the 90% figure is a floor. Empty and missing <code>content</code> attributes count as absent, which is the stricter reading — the 77% with a usable <code>og:image</code> would be slightly higher if a present-but-empty tag counted.</p>
<p>A single-day snapshot of pages that change constantly.</p>

<h2>Reproduce it</h2>
<p>The extraction script and the domain list ship with this site and run in about two minutes. It stores the raw HTML for every domain, so each claim above can be checked against the markup itself rather than our summary of it.</p>
<p>If a row is wrong, the markup settles it. Corrections via the <a href="/contact">contact page</a>.</p>`,
    faq: [
      ["Do Open Graph tags affect rankings?", "No. They have no effect on search. They decide whether a shared link renders as a card or a bare link, which is a click-through problem rather than a ranking one."],
      ["Is og:image required?", "Not required by anything. But 23% of homepages we checked have no usable image, and 55% declare a card type that expects one — so if you declare summary_large_image, supply the image."],
      ["Do I need both Open Graph and Twitter tags?", "X falls back to Open Graph for title, description and image, but still needs twitter:card to pick a layout. One site in five we checked omits it and gets a plain link."],
    ],
  },
  {
    slug: "ai-crawlers-in-the-wild",
    tags: ["seo", "webdev", "ai", "privacy"],
    h1: "What 70 robots.txt Files Say About AI Crawlers",
    lead: "We read 70 robots.txt files and checked 22 AI crawler tokens in each. 63% never mention one, and the most famous crawler is blocked least often.",
    body: `
<h2>How this was measured</h2>
<p>On 2026-09-23 we fetched <code>https://&lt;domain&gt;/robots.txt</code> for 78 well-known domains and parsed 70 usable files — 45 over a direct connection and 25 over a local proxy. Eight produced nothing we could read: <code>stackoverflow.com</code> answered 418, <code>npmjs.com</code> and <code>nih.gov</code> returned 403, <code>vimeo.com</code> timed out, <code>rust-lang.org</code> and <code>wikimedia.org</code> returned 404, and <code>khanacademy.org</code> and <code>cdc.gov</code> answered 200 with an HTML error page instead of a robots file. All eight are counted as missing rather than silently dropped.</p>
<p>In each file we built the user-agent groups, then asked one question for each of 22 known AI crawler tokens: <em>is this crawler allowed to fetch <code>/</code>?</em> A crawler with no group of its own inherits the <code>*</code> group, which is how robots.txt has always worked. Three verdicts are possible: <strong>blocked</strong> (root disallowed), <strong>partial</strong> (some paths disallowed, root open), <strong>allowed</strong>. Path matching follows Google's rule — the longest matching pattern wins, and an equal-length <code>Allow</code> beats a <code>Disallow</code>.</p>
<p>Every number below was checked against the raw lines before it was written down. Where a claim involves a specific site, the exact lines were printed and read. That step mattered: two earlier surveys in this series each produced a batch of findings that looked entirely reasonable in summary form and were wrong in the source.</p>

<h2>The one caveat that bounds everything</h2>
<p>robots.txt is a request, not a lock, and it is increasingly not where the real decision lives. A site hosted behind Cloudflare can block AI crawlers at the firewall with a single switch and never mention them in robots.txt. Sites can also pursue non-compliant crawlers through terms of service and rate limiting. So every figure here describes <strong>what the file says</strong>, not what the crawler experiences. A crawler that ignores robots.txt is invisible to this method in both directions.</p>

<h2>Finding 1: nearly two-thirds never mention an AI crawler</h2>
<p>44 of the 70 files contain no AI crawler token at all. Not a block, not an allow — silence. The list includes <code>wikipedia.org</code>, <code>mozilla.org</code>, <code>w3.org</code>, <code>archive.org</code>, <code>python.org</code>, <code>nodejs.org</code>, <code>go.dev</code>, <code>kubernetes.io</code>, <code>youtube.com</code>, <code>spotify.com</code>, <code>stripe.com</code>, <code>paypal.com</code>, <code>coinbase.com</code>, <code>vercel.com</code>, <code>digitalocean.com</code>, <code>heroku.com</code>, <code>mit.edu</code>, <code>harvard.edu</code>, <code>stanford.edu</code>, <code>etsy.com</code>, <code>shopify.com</code>, <code>walmart.com</code> and <code>target.com</code>.</p>
<p>Silence is not neutral, and it is not the same thing as permission-by-indifference: it means the crawler falls under whatever the <code>*</code> group says. For 42 of those 44, that works out to allowed. For two it does not — <code>reddit.com</code> and <code>pinterest.com</code> both ship <code>User-agent: *</code> / <code>Disallow: /</code>, so they block every AI crawler without naming a single one. Reddit's file is two lines long and its comment points at a public content policy rather than at crawler rules.</p>
<p>The SEO industry is mostly silent too. <code>ahrefs.com</code>, <code>semrush.com</code>, <code>screamingfrog.co.uk</code>, <code>yoast.com</code> and <code>searchengineland.com</code> name no AI crawler. Only two companies in that category say anything: <code>searchenginejournal.com</code> (blocks <code>omgili</code> and <code>Omgilibot</code>) and <code>moz.com</code>, discussed below. The vendors whose tools audit robots.txt files have largely not used them to make a statement about AI.</p>

<h2>Finding 2: the sites that do speak overwhelmingly block</h2>
<p>26 files name at least one AI crawler. Of those, 22 block at least one, and 13 block every AI crawler they name: <code>theguardian.com</code>, <code>bbc.com</code>, <code>cnn.com</code>, <code>washingtonpost.com</code>, <code>bloomberg.com</code>, <code>amazon.com</code>, <code>notion.so</code>, <code>figma.com</code>, <code>x.com</code>, <code>tumblr.com</code>, <code>searchenginejournal.com</code>, <code>yelp.com</code> and <code>who.int</code>.</p>
<p>Only four name AI crawlers and block none: <code>cloudflare.com</code>, <code>netlify.com</code>, <code>moz.com</code> and <code>twitch.tv</code> — and one of those four blocks nothing because of a mistake rather than a policy, which we come back to below.</p>
<p>The shape of the result is that AI crawler policy is concentrated in publishing. News organisations and marketplaces have made a decision; developer tooling, reference sites and universities mostly have not.</p>

<h2>Finding 3: the most famous crawler is blocked the least</h2>
<p>This was the counterintuitive result. Among the files that name a crawler, the block rate runs opposite to name recognition:</p>
<p><code>GPTBot</code> is named by 17 sites and blocked by 10 (59%), with 5 more applying partial rules. <code>ClaudeBot</code> is named by 18 and blocked by 13 (72%). <code>CCBot</code> is named by 15 and blocked by 13 (87%). And the long tail is unanimous: <code>Bytespider</code> is named by 11 and blocked by all 11, <code>Applebot-Extended</code> by 10 of 10, <code>omgili</code> by 9 of 9, <code>Diffbot</code> by 8 of 8.</p>
<p>Read that as a decision rule rather than a ranking. Sites that think about this at all block the crawlers that exist to harvest training data — Common Crawl feeds a large share of public training sets, and ByteDance's crawler has no search product attached to it — while giving the crawler attached to the most visible AI product the most nuanced treatment. GPTBot is also the one most likely to get a partial rule instead of a blanket block, which is what a site writes when it wants the crawler to see some sections and not others.</p>

<h2>Finding 4: two large sites went the other way, loudly</h2>
<p><code>cloudflare.com</code> is the clearest statement in the sample. Its file opens with <code>User-agent: *</code> / <code>Allow: /</code>, then carries a comment — <em>"Allow AI crawlers to access markdown versions of pages"</em> — followed by explicit <code>Allow: /</code> lines for <code>GPTBot</code>, <code>ChatGPT-User</code>, <code>Google-Extended</code>, <code>Anthropic-AI</code>, <code>Claude-Web</code>, <code>CCBot</code>, <code>PerplexityBot</code> and <code>cohere-ai</code>. It is not an absence of blocking; it is an affirmative allow, written per crawler, by the company that sells most of the blocking.</p>
<p><code>netflix.com</code> is the inverted case. Its <code>*</code> group is <code>Disallow: /</code> — everyone is out — but the allowlist group that follows begins <code>User-agent: googlebot</code> and runs through <code>Applebot</code>, <code>bingbot</code>, <code>Baiduspider</code>, <code>Yandex</code>, <code>facebookexternalhit</code>, <code>GPTBot</code>, <code>ChatGPT-User</code>, <code>OAI-SearchBot</code> and <code>Google-Extended</code>, opening with <code>Allow: /</code>. Netflix shuts the door on generic crawlers and holds it open for the AI ones. Whatever the reasoning, it is the opposite of the pattern the headlines describe.</p>

<h2>Finding 5: when blocking is selective, it is oddly specific</h2>
<p>Blanket blocks are the norm, so the selective ones stand out — and they are selective in ways that reveal intent.</p>
<p><code>moz.com</code> writes <code>User-agent: GPTBot</code> / <code>Disallow: /blog/</code> / <code>Disallow: /learn/seo/</code>. An SEO company has blocked AI crawlers from exactly its blog and its SEO education library, and from nothing else.</p>
<p><code>ebay.com</code> splits OpenAI's own crawlers against each other: <code>GPTBot</code> and <code>Applebot-Extended</code> share a <code>Disallow: /</code> group with a short list of exceptions, while <code>OAI-SearchBot</code>, <code>ChatGPT-User</code>, <code>Claude-SearchBot</code> and <code>Claude-User</code> get only parameter-level rules such as <code>Disallow: /*_kw</code>. That is the distinction between a crawler that trains on your pages and one that fetches a page because a person asked a question — and it is the distinction most files in this sample never make.</p>
<p><code>linkedin.com</code> does something similar and less consistent: <code>GPTBot</code> and <code>ChatGPT-User</code> blocked, <code>OAI-SearchBot</code> limited to specific paths like <code>/public-profile/</code>.</p>
<p><code>github.com</code> puts <code>GPTBot</code>, <code>OAI-SearchBot</code>, <code>ClaudeBot</code>, <code>anthropic-ai</code> and <code>PerplexityBot</code> in one shared group with <code>Crawl-delay: 1</code> and an allowlist of marketing pages, then gives <code>Bytespider</code> its own <code>Disallow: /</code>. It is also the only site in the sample that sets a crawl delay specifically for AI crawlers — worth knowing that Google ignores <code>Crawl-delay</code> entirely, as do most AI crawlers.</p>

<h2>Finding 6: the lines that read like a block and are not</h2>
<p><code>twitch.tv</code> ships <code>User-agent: Amazonbot</code> followed by <code>Disallow:</code> with nothing after the colon. An empty <code>Disallow</code> means nothing is disallowed; it is the same as allowing everything. The file names a crawler, appears to have a rule for it, and has no rule at all. One site out of 70, and exactly the kind of line a human reviewer would read as deliberate.</p>
<p>Two other mechanical details worth knowing. <code>who.int</code> writes <code>Disallow:/</code> with no space, which is legal and works. And <code>theguardian.com</code> follows its block with <code>License: https://theguardian.com/license.xml</code> — not part of the robots.txt specification, read by no crawler, and clearly aimed at people rather than machines.</p>
<p>Grouping style varies and it matters for maintenance. <code>theguardian.com</code>, <code>github.com</code>, <code>yelp.com</code> and <code>washingtonpost.com</code> put many crawler names into one shared block; <code>nytimes.com</code>, <code>bbc.com</code>, <code>bloomberg.com</code> and <code>amazon.com</code> use one block per crawler. Both are valid, but in the shared-block style a single edit changes the fate of twenty crawlers at once — which is how a rule for one bot silently becomes a rule for all of them.</p>

<h2>What we did not find</h2>
<p>Across 70 files we found <strong>zero</strong> misspelled AI crawler tokens. We looked for the plausible mistakes — <code>openai</code>, <code>chatgpt</code>, <code>claude</code>, <code>anthropic</code>, <code>gpt</code>, <code>gemini</code>, <code>ai</code>, <code>bot</code> — on the theory that a token no crawler matches is the most common way to write a rule that does nothing. None appeared. We also found no site blocking <code>Googlebot</code> apart from <code>reddit.com</code>, which blocks everyone.</p>
<p>Two non-findings in a row across this series now. That is not an argument for ignoring the warnings — an unmatched token is still a bug when you write one — but it is an argument for checking how often the thing you are about to spend a week defending against actually happens.</p>

<h2>What to do with this</h2>
<p><strong>Decide per crawler, not for "AI".</strong> The files that do this well split training crawlers from search and user-triggered ones. Blocking <code>GPTBot</code> and accidentally blocking <code>OAI-SearchBot</code> with it removes you from a different surface than the one you were aiming at.</p>
<p><strong>Check what an unnamed crawler inherits.</strong> If your <code>*</code> group is <code>Disallow: /</code>, you have already made the AI decision without writing it down — which is where Reddit and Pinterest ended up.</p>
<p><strong>Read your file's empty directives.</strong> <code>Disallow:</code> with no value allows everything. If you meant to block, it is not blocking.</p>
<p><strong>Then test it.</strong> Paste the file into a <a href="/tools/robots-txt-tester">robots.txt tester</a> and run one AI crawler token against your homepage, an article and a URL you believe is blocked. The failure mode here is the same one described in <a href="/guides/robots-txt-mistakes">our piece on robots.txt mistakes</a>: nothing errors, nothing logs, and the effect only shows up months later as missing traffic or missing citations.</p>
<p>If you want the earlier baseline for the same file, our <a href="/guides/robots-txt-in-the-wild">first robots.txt survey</a> covers sitemap declaration across 78 domains.</p>

<h2>Limitations</h2>
<p>70 files from 78 hand-picked domains spanning news, commerce, SaaS, developer tooling, education and government — representative of well-known sites, not of the web. A random sample would be dominated by small sites with different incentives and would almost certainly show a lower rate of explicit AI policy.</p>
<p>The tokens are 22 specific crawlers chosen because they are documented and widely discussed. New ones appear constantly and none of them are measured here. A site may have a policy for a crawler we did not look for.</p>
<p>The larger limitation is the one from the top: robots.txt is advisory, and for AI crawlers it is increasingly not where enforcement happens. Firewalls, rate limits and terms of service decide most of this, and none are visible in the file. Treat these numbers as a survey of stated intent.</p>
<p>Finally, a single-day snapshot of files that change without notice.</p>

<h2>Reproduce it</h2>
<p>The script and the shared domain list ship with this site, run in about two minutes, and store the raw file for every domain — so every claim above can be checked against the source rather than against our summary of it. If a row is wrong, the file settles it; corrections via the <a href="/contact">contact page</a>.</p>`,
    faq: [
      ["Does blocking GPTBot remove me from ChatGPT search results?", "Not necessarily. Search retrieval uses OAI-SearchBot, a separate crawler. The files in our sample that block GPTBot while leaving OAI-SearchBot alone are making exactly that distinction."],
      ["Is silence in robots.txt the same as permission?", "Functionally yes for most crawlers: with no matching group, the * group applies. But 2 of the 44 silent sites in our sample block everything at the * level, so silence inherits whatever your default is."],
      ["Does an empty Disallow block anything?", "No. 'Disallow:' with no value is the same as allowing everything. One site in our sample, twitch.tv, ships this for Amazonbot."],
      ["Do AI crawlers actually obey robots.txt?", "The major ones do. But enforcement increasingly happens at the firewall rather than in the file, so robots.txt measures stated intent, not what the crawler experiences."],
    ],
  },
  {
    slug: "hreflang-in-the-wild",
    tags: ["seo", "webdev", "html", "programming"],
    h1: "What 60 Sites Actually Do With hreflang",
    lead: "We parsed hreflang on 60 high-traffic homepages. Less than half declare it, and a third skip x-default — the tag Google recommends but never requires.",
    body: `
<h2>How this was measured</h2>
<p>On 2026-09-24 we fetched the homepage of 78 high-traffic domains and looked for <code>&lt;link rel="alternate" hreflang="..."&gt;</code> tags in the initial HTML. Of the 78, 60 returned a usable page: 41 over a direct connection and 19 over a local proxy, because some domains are unreachable from our network without one. The other 18 were unreadable — four behind bot protection returning 403 or 418, the rest timing out or returning 404.</p>
<p>Extraction used a single regex over <code>&lt;link&gt;</code> tags, keeping only those whose <code>rel</code> contains <code>alternate</code> and whose <code>hreflang</code> is non-empty. A bare <code>hreflang=""</code> is treated as absent, because an empty annotation is the same as none and counting it would invent findings that are not there. The script and the domain list ship with this site, so every number below can be re-derived rather than taken on trust.</p>

<h2>Finding 1: fewer than half use hreflang at all</h2>
<p>28 of the 60 sites (46.7%) declare hreflang. The other 32 declare none. That sounds low until you look at who the 32 are: Amazon, LinkedIn, Reddit, GitHub, Wikipedia, the New York Times, Bloomberg — overwhelmingly monolingual or single-locale sites where hreflang would be meaningless. hreflang exists to tell a crawler "this page has equivalents in other languages or regions." A site with one language has nothing to point at, so its absence is correct, not a gap.</p>
<p>So the coverage number is not a score. It is a reminder that hreflang is a multilingual-site tool, and most of the web's famous names are not multilingual in the way that needs it.</p>

<h2>Finding 2: when sites do it, they do it thoroughly</h2>
<p>The 28 that declare hreflang are not dabbling. 24 of them ship six or more alternate links; the median site in the group declares 15. The outliers are startling: uber.com emits 173, stripe.com 89, mozilla.org 80, linkedin.com 77, shopify.com 71. The average across the 28 is 30.9 annotations per site.</p>
<p>Two things explain the spread. First, genuinely global products — ride-hailing, payments, browsers — really do serve dozens of locales, and each one is a link. Second, a few sites that are not obviously global still go deep: ahrefs.com and semrush.com, both SEO vendors, declare 14 each, which is consistent with the pattern we have seen across every survey on this site — the companies whose business is this metadata treat it more carefully than average.</p>
<p>The practical point for a normal site: you do not need 70 annotations. You need one correct set per localized URL, which for most operators is a handful. The big numbers belong to companies with genuinely big locale matrices.</p>

<h2>Finding 3: the common miss is x-default</h2>
<p>Of the 28 sites that declare hreflang, 9 (32.1%) have no <code>x-default</code> annotation. The list is not obscure: bbc.com, atlassian.com, notion.so, pinterest.com, docker.com, kubernetes.io, semrush.com, squareup.com, uber.com.</p>
<p>Google recommends x-default as the fallback for users whose language or region matches none of your specific alternates. Without it, the version an unmatched user sees is undefined, and because hreflang errors are silent, no validator will tell you it is missing. It is recommended, not required — a site without x-default is not penalised — but for sites serving this many locales, leaving it out is a real, if mild, gap. That a third of even the careful sites skip it tells you how easy it is to forget.</p>

<h2>Finding 4: the format is cleaner than expected</h2>
<p>We checked every hreflang value against BCP-47. Zero sites used a relative URL in the <code>href</code>. The values a naive validator might flag as non-standard — <code>zh-Hans</code>, <code>zh-Hant-TW</code>, <code>sco</code>, <code>ast</code> — are all valid: the <code>Hans</code>/<code>Hant</code> forms are script subtags, and <code>sco</code> and <code>ast</code> are legitimate ISO 639-3 language codes used by sites that genuinely serve Scots and Asturian. Nobody in the sample shipped a broken value like "english" or "en_en".</p>
<p>This is a useful contrast with our other surveys, which did find real defects. hreflang's format is mature enough that the mistakes are about relationships between annotations, not about the annotations themselves.</p>

<h2>Finding 5: a sampling caveat, not a defect</h2>
<p>Four sites — gitlab.com, notion.so, zoom.us, spotify.com — have their hreflang set living on a different domain or subdomain from the bare homepage we fetched: about.gitlab.com, notion.com, zoom.com, open.spotify.com. Because we sampled the bare homepage, that page shows no same-origin self-reference. In every case the bare domain is effectively an entry point that redirects to the host serving localized content, where the set is complete and reciprocal. We report it as a measurement artifact, not as a broken annotation.</p>

<h2>The two errors that actually break hreflang</h2>
<p>The format is fine and the coverage question is mostly irrelevant. The failures that matter are about relationships, and both are silent. The first is a missing return tag: if your English page points at the German page, the German page must point back, or Google treats the whole annotation as unconfirmed and ignores it. The second is a missing self-reference: every URL in the set must include a link to itself. A page that lists its siblings but not itself is, to a crawler, a page that never confirmed its own identity.</p>
<p>Both are invisible. The page renders, the links are present, and the annotation simply does not take effect — which is exactly the state you discover months later when a locale refuses to rank. The fix is to generate the full set, including x-default and the self-link, from one source, so the relationships cannot drift apart.</p>

<h2>How to do it without the foot-guns</h2>
<p>A correct set has one entry per locale plus <code>x-default</code>, every entry points at an absolute URL, the page lists itself, and every target links back. Writing that by hand for more than two locales is how the return-tag rule gets broken. Generating it — as the <a href="/tools/hreflang-generator">hreflang generator</a> on this site does, from a single list of language and URL pairs — makes the reciprocal links and the self-reference impossible to forget, because the tool emits them for you.</p>
<p>If your site is monolingual, the right move is to declare nothing and spend the effort on content. hreflang is for sites that actually have equivalents to offer.</p>

<h2>Limitations</h2>
<p>60 pages from 78 hand-picked high-traffic domains — representative of well-known sites, not of the web. A random sample would be dominated by monolingual sites and would show lower usage. We parsed only the initial HTML of the homepage, so annotations delivered through HTTP headers, sitemap entries, or injected by client-side JavaScript on a single-page app are not counted. A site whose hreflang lives only in its sitemap would appear here as not using it. Where a specific site is named, the raw HTML we retrieved is the arbiter; corrections are welcome.</p>

<h2>Reproduce it</h2>
<p>The script and the shared domain list ship with this site and store the raw HTML for every domain, so every claim above can be checked against the source rather than against our summary of it.</p>`,
    faq: [
      ["Is hreflang a ranking factor?", "No. It tells Google which regional or language version to serve to a given user; it does not by itself improve rankings. Its job is to stop the wrong-language page from showing, not to lift the right one."],
      ["Do I need x-default?", "Recommended, not required. Without it, users whose language or region matches none of your specific alternates get an undefined fallback. It is the most commonly skipped tag among the sites we measured, but its absence is not a penalty."],
      ["Can I put hreflang in the sitemap instead of the head?", "Yes. Sitemap alternates are valid and keep the head clean, but they are only seen by crawlers that read your sitemap, whereas HTML link tags are visible to any crawler parsing the page."],
      ["Does hreflang have to be on every page?", "Every URL that has localized variants should carry the full set, including a link to itself. A common gap is declaring it only on the homepage and leaving deep pages unannotated, which leaves those pages unconfirmed."],
      ["What silently breaks hreflang?", "A missing return tag — if page A links to B, B must link back — and a missing self-reference. Neither produces an error; the annotation just does not take effect, which you usually notice only as a locale that will not rank."],
    ],
  },
  {
    slug: "canonical-in-the-wild",
    tags: ["seo", "webdev", "html", "programming"],
    h1: "What 55 Homepages Actually Do With Canonical",
    lead: "We fetched the homepage of 78 well-known domains and read 55. Four in five declare a canonical; one in five ships a homepage with none at all.",
    body: `
<h2>How this was measured</h2>
<p>On 2026-09-24 we fetched <code>https://&lt;domain&gt;/</code> for 78 well-known domains spanning news, commerce, SaaS, developer tooling, social, education, finance and government. 55 returned a usable page: 34 over a direct connection and 21 over a local proxy, because a number of these domains are unreachable from our network without one.</p>
<p>The other 23 could not be read. 14 answered with something other than 200 — mostly 403, one 401, one 202, one timeout — and 20 served a bot check or an interstitial instead of a page; the two groups overlap. One is worth naming: <code>amazon.com</code> answers 200 with a 2 KB page whose entire content is a <code>bm-verify</code> meta-refresh, not a homepage. Our first pass counted it as a real page and would have recorded Amazon as a site with no canonical. Re-reading the response is what caught it, and it is why every number below was checked against the raw HTML before it was written down.</p>
<p>For each page we took the <code>&lt;link rel="canonical"&gt;</code> from the initial HTML, resolved it against the URL we actually landed on after redirects, and compared the two after normalising: lowercased host, <code>www</code> stripped, trailing slash and <code>index.html</code> removed. We also captured the HTTP <code>Link</code> header, counted how many canonical tags each page ships, and recorded whether the tag sits before <code>&lt;/head&gt;</code>. Then we made a second request to each canonical URL with redirects disabled, to see whether it points at a page that exists.</p>

<h2>Finding 1: one homepage in five declares nothing</h2>
<p>44 of the 55 pages (80%) declare a canonical. The other 11 declare none:</p>
<p><code>reddit.com, kubernetes.io, python.org, rust-lang.org, netflix.com, wikipedia.org, mozilla.org, w3.org, archive.org, wikimedia.org, airbnb.com</code></p>
<p>Two of those need an asterisk. <code>reddit.com</code> and <code>archive.org</code> returned client-rendered shells — 8.4 KB and 1.9 KB with no content in them — so a canonical injected by JavaScript would be invisible to a method that reads only the initial HTML. We cannot say they have no canonical; we can only say none is served with the document.</p>
<p>The other nine are server-rendered and full-sized, and the absence is real. Wikipedia, Mozilla, W3C and Python.org are not sites that forgot a tag through carelessness; for a homepage that is the most-linked URL on the domain, the duplicate-selection problem canonical solves is largely solved by the link graph anyway. <code>airbnb.com</code> is the interesting one: it ships <code>&lt;meta id="english-canonical-url" content=""&gt;</code>, a canonical slot that arrived empty.</p>
<p>What the omission costs is narrow but real. Without it, <code>/</code>, <code>/index.html</code>, <code>/?utm_source=newsletter</code> and the http variant are four separate URLs that a crawler must choose between. It is one line of HTML to remove the question.</p>

<h2>Finding 2: you have to follow the redirect first</h2>
<p>43 of the 55 homepages (78%) redirected at least once before serving content, and 35 of the 44 that declare a canonical (80%) did. Some are ordinary www normalisation; several land on a different host entirely:</p>
<p><code>gitlab.com &rarr; about.gitlab.com</code>, <code>spotify.com &rarr; open.spotify.com</code>, <code>notion.so &rarr; notion.com</code>, <code>zoom.us &rarr; zoom.com</code>, <code>linkedin.com &rarr; www.linkedin.cn</code>, <code>cnn.com &rarr; edition.cnn.com</code>.</p>
<p>This is the most common way to misread your own canonical. If you compare the tag against the URL you typed rather than the URL you were finally served, every one of those six looks like a cross-domain canonical pointing somewhere suspicious. They are not — they are self-referencing canonicals on the page that actually exists. When you audit, audit against the final URL after redirects, which is what a crawler sees.</p>

<h2>Finding 3: six of 44 point anywhere other than themselves</h2>
<p>38 of the 44 canonicals (86%) resolve to exactly the URL we were served. The six that do not are the whole story of this survey:</p>
<p><code>cnn.com</code> — served <code>edition.cnn.com</code>, canonical <code>https://www.cnn.com</code>, which returns 200. This is geo consolidation done deliberately: the regional edition defers to the global URL.</p>
<p><code>linkedin.com</code> — served <code>www.linkedin.cn</code>, canonical <code>https://business.linkedin.com/zh-cn/zh-cn</code>, 200. The same pattern on a different host.</p>
<p><code>tumblr.com</code> — served <code>/</code>, canonical <code>https://www.tumblr.com/explore/trending</code>, 200. The logged-out homepage canonicalises to the trending feed rather than to itself.</p>
<p><code>stanford.edu</code> — served <code>/</code>, canonical <code>https://www.stanford.edu/home</code>, which returns <strong>404</strong>.</p>
<p><code>trello.com</code> — served <code>/</code>, canonical <code>https://www.trello.com/home</code>, which returns <strong>301</strong>.</p>
<p><code>mit.edu</code> — served <code>web.mit.edu</code>, canonical <code>https://tlecms.mit.edu/spotlight/zombie-cells</code>: a different host, and a specific article about zombie cells. We could not reach that URL to check it — a direct request timed out and a proxied request failed the TLS handshake — so we report it as unverified rather than as broken. It has the shape of the classic template bug, where a homepage inherits a canonical slot filled from an article template, but we did not confirm it.</p>

<h2>Finding 4: two canonical targets are not reachable pages</h2>
<p>We managed to test 43 of the 44 canonical URLs. 41 returned 200 (95%). Two did not, and both belong to large, well-resourced sites.</p>
<p>Stanford's homepage tells a crawler that the preferred version of <code>https://www.stanford.edu/</code> is a URL that answers 404. Trello's points at <code>/home</code>, which 301s — and in Trello's case the bare host redirects too, so the canonical points into a redirect chain rather than at a destination.</p>
<p>Neither is a syntax error, and nothing warns you. The tag is well-formed, the page renders, validators pass. The failure is silent in exactly the way canonical failures always are: a crawler that cannot resolve the canonical behaves as though you had not written one, which returns you to the duplicate-selection problem you wrote the tag to avoid. One command settles it for any URL you own:</p>
<p><code>curl -sS -o /dev/null -w "%{http_code}" https://example.com/your-canonical</code></p>
<p>The answer must be 200. Anything else is a canonical that does not do its job.</p>

<h2>Finding 5: the mechanics are cleaner than the reputation suggests</h2>
<p>Across 44 canonicals we found <strong>zero</strong> relative hrefs — every single one used an absolute URL. Zero http/https mismatches. Zero pages shipping two conflicting canonicals. Zero canonicals placed outside <code>&lt;head&gt;</code>.</p>
<p>Two near-misses are worth knowing. <code>bbc.com</code> ships the identical canonical tag twice, a harmless artefact of a framework rendering the head twice. <code>moz.com</code> is the only site in the sample to send a canonical in the HTTP <code>Link</code> header — and it also has the tag in its HTML, so the header is redundant rather than load-bearing.</p>
<p>Read alongside the two broken targets above, this is the useful shape of the result: nobody writes malformed canonicals any more. The failures are not in the syntax, they are in what the tag points at.</p>

<h2>Finding 6: geo-personalisation is the real design decision</h2>
<p>Seven of the 44 canonical URLs carry a language or region segment in the path. Four are region-personalised versions of what we asked for: <code>stripe.com/cn</code>, <code>coinbase.com/en-ca</code>, <code>squareup.com/us/en</code>, <code>uber.com/ca/en</code>. Because we fetched from a Chinese IP address, those are the variants we were served — and each of them self-canonicalises to the variant it served.</p>
<p>CNN made the opposite choice: it served us the regional edition and canonicalised back to the global URL. Both are defensible. What matters is that the choice is consistent, that it matches your <a href="/guides/hreflang-in-the-wild">hreflang annotations</a>, and that one URL produces one canonical regardless of who asks. If your canonical varies with the visitor's IP, then a crawler geo-dispatched differently from your users will consolidate a different set of pages than the set your users actually see.</p>

<h2>What to do with this</h2>
<p><strong>Emit an absolute, self-referencing canonical on every indexable URL.</strong> One in five famous homepages does not, and the ones that do are not doing anything clever.</p>
<p><strong>Compare it against the final URL after redirects.</strong> 80% of the pages here redirected before serving content. Auditing against the URL you typed will manufacture cross-domain errors that do not exist.</p>
<p><strong>Check that the canonical itself returns 200.</strong> Two of 43 did not. It is one curl command and no validator will do it for you.</p>
<p><strong>Never point a canonical at a redirect.</strong> Point it at where the redirect lands.</p>
<p><strong>Pick one geo policy and apply it everywhere.</strong> Consolidate globally like CNN, or self-canonicalise per locale like Stripe — but do not let the answer depend on who is asking.</p>
<p><strong>Generate the tag rather than hand-writing it.</strong> Every failure above is a value problem, not a syntax problem, and values are what templates and generators get right. The <a href="/tools/meta-tag-generator">meta tag generator</a> on this site emits the canonical alongside the rest of the head from a single URL, so the value cannot drift away from the page it describes.</p>

<h2>Limitations</h2>
<p>55 pages from 78 hand-picked, well-known domains — representative of famous sites, not of the web. A random sample would look different in both directions.</p>
<p>The 23 unreadable pages are not a random loss. They are disproportionately large consumer and financial sites that fight crawlers — Amazon, GitHub, the New York Times, PayPal, Target, eBay — so the sample skews toward sites that serve their homepage to anyone who asks. That is a real bias, and it probably makes these numbers look tidier than the web as a whole.</p>
<p>We read only the initial HTML. A canonical delivered through JavaScript, a sitemap entry, or an HTTP header on a site that omits it from HTML is invisible here; two of the eleven "absent" pages were client-rendered shells where that caveat is live rather than theoretical.</p>
<p>One fetch, from one IP address, on one day. Because that address is in China we were served regional variants of several sites, which is what made Finding 6 visible — and it also means a different vantage point would produce a slightly different set of canonicals.</p>

<h2>Reproduce it</h2>
<p>The script and the shared domain list ship with this site. <code>node scripts/survey-canonical.mjs</code> fetches and stores the raw HTML for every domain; <code>--report</code> re-derives every number from that stored HTML without touching the network, and <code>--evidence</code> prints the raw <code>&lt;link&gt;</code> tag behind each verdict. Our <a href="/guides/robots-txt-in-the-wild">first robots.txt survey</a> covers the same domain list from a different angle.</p>`,
    faq: [
      ["Should a canonical point at itself?", "Yes, in almost every case. 38 of the 44 canonicals we measured are self-referencing. The exceptions are deliberate consolidations, such as a regional edition pointing at the global URL."],
      ["What happens if my canonical URL returns a 404?", "The crawler treats the page as though no valid canonical was given and falls back to choosing among duplicates itself. Nothing errors and nothing warns you. Two of the 43 canonicals we tested pointed at URLs that did not return 200."],
      ["Can I use a relative URL in a canonical?", "You can, because browsers resolve it against the page, but every site in our sample used an absolute URL. Absolute is unambiguous when a page is mirrored, proxied or served from more than one path."],
      ["Does a redirecting homepage change how canonical works?", "It changes how you should read it. 43 of the 55 homepages we fetched redirected before serving content, so compare the canonical against the final URL, not the one you typed."],
      ["Is a canonical in the HTTP Link header enough?", "It is valid, but only one site in our sample used it, and that site also had the tag in its HTML. Put it in the HTML; treat the header as an option for PDFs and other non-HTML files."],
    ],
  },
  {
    slug: "serp-snippet-in-the-wild",
    tags: ["seo", "webdev", "html", "marketing"],
    h1: "What 59 Homepages Put in Their SERP Snippet",
    lead: "We fetched 78 well-known homepages and read 59. Every one ships a title; the median is 35 characters, and a fifth of the descriptions run long.",
    body: `
<h2>How this was measured</h2>
<p>On 2026-09-25 we fetched <code>https://&lt;domain&gt;/</code> for 78 hand-picked domains spanning news, commerce, SaaS, developer tooling, social, education, finance, government and SEO. 62 returned a usable page: 41 over a direct connection and 21 over a local proxy, because a number of these domains are unreachable from our network without one.</p>
<p>Three of the 62 were not homepages and were dropped. <code>khanacademy.org</code> answered 200 with a 3 KB Cloudflare interstitial whose entire title is "Client Challenge". <code>paypal.com</code> returned an 8 KB JavaScript shell with no <code>&lt;title&gt;</code> at all. <code>archive.org</code> returned a 1.9 KB shell. Counting them would have manufactured findings that do not exist — a 15-character title, two missing titles — so they are excluded and listed in the script's output instead.</p>
<p>One bug is worth naming, because it changed the headline. Our first pass read <code>python.org</code> as having no <code>&lt;title&gt;</code>. It has one. The site returns gzip unconditionally, and our fetch was not decompressing, so we were parsing gzip bytes as HTML. Once the fetch decompressed, the title appeared, and the count of homepages without a title went from two to zero. A measurement pipeline that fails quietly produces confident nonsense.</p>
<p>For each page we took the first <code>&lt;title&gt;</code> and the first <code>&lt;meta name="description"&gt;</code>, decoded HTML entities, collapsed runs of whitespace and measured in Unicode code points. Skipping the decode step inflates every number: <code>&amp;amp;</code> counts as five characters instead of one.</p>

<h2>Finding 1: every homepage has a title, and the median is 35 characters</h2>
<p>59 of 59. Not one homepage in the sample ships without a <code>&lt;title&gt;</code>. The distribution is narrow at the bottom and long at the top: minimum 3 characters, 25th percentile 22, median 35, 75th percentile 54, 90th percentile 61, maximum 116, mean 36.9.</p>
<p>The familiar rule — keep your title under 60 characters — is true and almost empty. Only 7 of 59 pages (12%) exceed 60, and just 2 exceed 70. The real behaviour is at the opposite end: 21 of 59 (36%) are under 30 characters. Half the sample writes a title shorter than 35 characters.</p>
<p>If you have been treating 60 as a target to hit, you are aiming at a number almost nobody in this sample reaches.</p>

<h2>Finding 2: the shorter the title, the bigger the brand</h2>
<p>The shortest titles belong to the most famous names in the sample: <code>w3.org</code> (3 characters, "W3C"), <code>forbes.com</code> (6, "Forbes"), <code>tumblr.com</code> (6), <code>twitch.tv</code> (6), <code>youtube.com</code> (7), <code>pinterest.com</code> (9), <code>wikipedia.org</code> (9), <code>wikimedia.org</code> (9), <code>kubernetes.io</code> (10), <code>developer.mozilla.org</code> (12, "MDN Web Docs").</p>
<p>The longest belong to sites that still have to explain themselves: <code>bbc.com</code> at 116 characters, <code>airbnb.com</code> at 74, <code>atlassian.com</code> at 70, <code>wise.com</code> at 68, <code>shopify.com</code> at 66, <code>github.com</code> at 61.</p>
<p>That is not a style difference, it is an equity budget. "Forbes" is a complete title because the reader already knows what Forbes is; the word carries the meaning the other 54 characters would otherwise have to. A site nobody has heard of that ships its name alone has said nothing at all. The 60 characters are not a ceiling to stay under — they are space you have to fill until your name does the work by itself.</p>
<p>The practical corollary: copying the title format of a famous site means copying a luxury you have not earned yet.</p>

<h2>Finding 3: nearly everyone writes a meta description, so that advice is stale</h2>
<p>57 of 59 homepages (97%) ship a description. Only two do not: <code>linkedin.com</code> and <code>cdc.gov</code>.</p>
<p>This contradicts a piece of advice still repeated constantly — that most sites forget the description and let Google invent one. On this sample that is simply false. What the last decade of snippet rewriting actually did was make the tag universal rather than optional. The omission rate here is 3%, not the 50% the folklore implies.</p>
<p>Two caveats. <code>linkedin.com</code> served a 121 KB JavaScript shell and <code>cdc.gov</code> a 60 KB document, so a description injected after load would be invisible to this method; both are recorded as "none in the served HTML", which is also what a crawler parsing the initial document sees. And writing a description does not mean Google uses it — this measurement is only about what sites ship, not about which sentence ends up in the snippet.</p>

<h2>Finding 4: descriptions cluster at 114 to 150, and the 160 guideline holds up</h2>
<p>The length distribution: minimum 45, 25th percentile 114, median 131, 75th percentile 150, 90th percentile 184, maximum 559, mean 141.</p>
<p>That interquartile range — 114 to 150 — is remarkably tight for a number nobody enforces. Practitioners have converged on a working band just under the display limit without being told to.</p>
<p>12 of the 57 (21%) run past 160 characters. The extremes are instructive: <code>kubernetes.io</code> ships 559 characters, roughly three and a half times what will ever be shown; <code>stanford.edu</code> ships 364; <code>trello.com</code> ships 195. At the other end, four descriptions fall under 70 characters, leaving more than half of the available space empty.</p>
<p>The practical read: 120 to 155 characters is where this sample lives, and it is also where truncation is least likely.</p>

<h2>Finding 5: pipe is the most common separator, but no separator is more common</h2>
<p>Counting only separators with whitespace on both sides, so that the hyphen inside <code>rust-lang</code> is not mistaken for one: pipe appears in 16 titles (27%), hyphen in 11 (19%), em dash in 2, and colon, middle dot and slash once each.</p>
<p>But 27 of 59 (46%) use no separator at all. The pipe is the plurality, not the majority; nearly half the sample writes a name or a sentence and stops.</p>
<p>A separator is a formatting decision with no ranking consequence. What it does signal is how many ideas you are concatenating. One separator means two ideas, and in most of the titles above the second one is the weaker — the tagline, the region, the boilerplate. The titles with no separator have a single idea, and a single idea is usually the better title.</p>

<h2>Finding 6: your title is not one thing</h2>
<p>We fetched from a Chinese IP address, and several sites served a regional variant rather than the default. <code>linkedin.com</code> returned 领英企业服务. <code>stripe.com</code> returned "Stripe | 金融基础设施，托举营收增长". <code>wise.com</code> returned "Wise: The international account | Money without borders | Wise China". <code>bloomberg.com</code> returned "Bloomberg Europe".</p>
<p>None of those are mistakes. But they mean a title audit performed from one location gives you one slice of a title that changes with geography, and a crawler dispatched from a different location reads a different string. The same applies to the description.</p>
<p>If you localise titles per region, decide it deliberately and keep it consistent with your <a href="/guides/hreflang-in-the-wild">hreflang annotations</a> and your <a href="/guides/canonical-in-the-wild">canonical choice</a>. If you do not intend to localise, check that your edge is not doing it for you — the way to find out is to fetch your own homepage from more than one country.</p>

<h2>What to do with this</h2>
<p><strong>Write 50 to 60 characters, not 3.</strong> The median homepage title in this sample is 35 characters and 36% are under 30 — but those are household names. Unless yours is one, use the space.</p>
<p><strong>Always write a description.</strong> 97% of the sample does. It is table stakes now, not an optional extra, and omitting it hands the sentence a searcher reads entirely to Google.</p>
<p><strong>Target 120 to 155 characters.</strong> That is the measured interquartile band, and it sits just inside where truncation begins.</p>
<p><strong>Do not copy a famous site's title.</strong> Its brevity is backed by recognition you have not earned yet.</p>
<p><strong>Prefer one idea per title.</strong> 46% of the sample uses no separator. When you do need one, pipe is the safe default at 27% — but check whether the second half is pulling its weight.</p>
<p><strong>Check what your edge actually serves.</strong> Fetch your homepage from two or three regions before concluding that your title is what you wrote.</p>
<p>To see the truncation before you ship it, the <a href="/tools/serp-preview">SERP preview tool</a> on this site renders a title and description at Google's real desktop and mobile widths. The <a href="/tools/meta-tag-generator">meta tag generator</a> emits the title, description and canonical from a single input, so the values cannot drift apart from each other.</p>

<h2>Limitations</h2>
<p>59 homepages from 78 hand-picked, well-known domains — representative of famous sites, not of the web. A random sample would look different in both directions, and probably longer: small sites write longer titles than W3C does.</p>
<p>16 of the 78 domains never produced a readable page — 403s, bot checks, timeouts. That loss is not random; it skews toward large consumer and financial sites that fight crawlers, so the sample is biased toward sites that serve their homepage to anyone who asks.</p>
<p>We read the initial HTML only. A title or description injected by JavaScript after load is invisible here, and one of the two missing descriptions may be exactly that.</p>
<p>One fetch, from one IP address, on one day. Finding 6 is the direct consequence of that limitation rather than a separate discovery.</p>
<p>The brand-position analysis we planned did not survive checking and is not reported. Judging brand placement from the domain's first label fails on multi-word brands and on brands spelled differently from their domain: 9 of the 10 titles flagged as containing no brand did contain one — "the Guardian", "Node.js", "Rust", "Screaming Frog", "Search Engine Journal", "Square". We dropped the metric rather than publish a number we could not stand behind.</p>

<h2>Reproduce it</h2>
<p>The script and the shared domain list ship with this site. <code>node scripts/survey-serp-snippet.mjs</code> fetches and stores the raw HTML for every domain; <code>--report</code> re-derives every number from that stored HTML without touching the network; <code>--sample=N</code> prints raw title and description lines for manual checking; and <code>--outliers</code> lists every title over 60 characters, every description over 160, and every response excluded as a non-homepage. Our <a href="/guides/robots-txt-in-the-wild">robots.txt</a>, <a href="/guides/hreflang-in-the-wild">hreflang</a> and <a href="/guides/canonical-in-the-wild">canonical</a> surveys cover the same domain list from different angles.</p>`,
    faq: [
      ["How long should a title tag be?", "The median homepage title in our sample is 35 characters and only 12% exceed 60, so the familiar 'under 60' rule is already satisfied by almost everyone. For a site without brand recognition, 50 to 60 characters is the useful target — long enough to say what the page is."],
      ["Do I still need a meta description?", "Yes. 57 of the 59 homepages we measured ship one. Google may rewrite or replace it, but omitting it hands the decision over entirely and you lose the ability to choose the sentence a searcher reads."],
      ["Should my brand name go at the start or the end of the title?", "We could not measure that reliably and are not reporting a number for it. What the data does show is that famous brands can use the name alone as the entire title, and sites that are not yet famous cannot."],
      ["What separator should I use in a title tag?", "None, if one idea will do — 46% of the homepages we measured use no separator. When you need two, pipe is the most common by a wide margin at 27%, followed by hyphen at 19%. There is no ranking difference between them."],
      ["How long should a meta description be?", "The middle half of our sample sits between 114 and 150 characters, with a median of 131. Staying inside 120 to 155 keeps you in the band where the sample lives and inside the range Google usually displays."],
    ],
  },
  {
    slug: "whatsmyserp-alternatives",
    tags: ["seo", "marketing", "tools", "webdev"],
    h1: "Whatsmyserp Alternatives: Pick by Job, Not Price",
    lead: "Two different jobs hide behind the phrase 'Whatsmyserp alternative', and most lists ignore the difference. Here is what each tool is actually for.",
    body: `
<h2>What Whatsmyserp actually is</h2>
<p>We read <code>whatsmyserp.com/pricing</code> on 2026-09-26. It lists three plans, all with daily automatic refreshes, unlimited on-demand updates, unlimited domains and white-label reporting:</p>
<table class="mini-table">
<tr><th>Plan</th><th>Price / month</th><th>Keywords tracked daily</th><th>Backlink rows</th><th>Keyword lookups / mo</th></tr>
<tr><td>Starter</td><td>$19.99</td><td>200</td><td>50,000</td><td>100</td></tr>
<tr><td>Premium</td><td>$29.99</td><td>500</td><td>75,000</td><td>200</td></tr>
<tr><td>Professional</td><td>$59.99</td><td>1,000</td><td>150,000</td><td>300</td></tr>
</table>
<p>Every tier also carries custom alerts and a 30-day money-back guarantee, and every tier lists <strong>API (coming soon)</strong> — so as of the date above there is no API to build on, only a promise of one.</p>
<p>Its job is narrow and clear: <strong>watch where a set of keywords rank over time</strong>, on a schedule, and produce a report you can hand to someone else. It does that and stops. Two things it does not do are worth knowing before you shop: it does not show you <strong>how your page will look in the SERP</strong> (it reports positions, not snippets), and it does not check your page's <strong>on-page markup</strong> — titles, descriptions, headings, canonical, structured data.</p>
<p>On a free tier: the pricing page lists three paid plans and no free plan. Several third-party reviews describe a free spot-checker capped at roughly 10 searches a day with no signup, but we could not confirm that on the site itself, so treat the number as second-hand.</p>

<h2>The question most lists skip: which job do you actually have?</h2>
<p>Two unrelated jobs get bundled into one search phrase, and a list that does not separate them will sell you the wrong thing.</p>
<p><strong>Job one is tracking.</strong> "Where do I rank for these 200 keywords, and how did that change since last week?" Answering it needs a crawler, a stored history and a schedule. It cannot be done in a browser tab, and no free tool substitutes for it.</p>
<p><strong>Job two is checking.</strong> "Will my title and description render without being cut off? Is my canonical self-referencing? Is my robots.txt blocking something it should not?" This is a per-page, right-now question. It needs no account, no history and no data set.</p>
<p>Whatsmyserp is a tool for job one. If job one is your job, nothing free replaces it — you are buying someone's crawler. If job two is your job, a monthly subscription is the wrong purchase.</p>

<h2>If you need rank tracking</h2>
<p><strong>Google Search Console</strong> — free, and the only source of <em>actual</em> position data for your own site rather than an estimate. Set it up before you buy anything. Its ceiling: your own verified properties only, no competitor tracking, and it will not tell you where you rank for a keyword you do not already appear for.</p>
<p><strong>SERPROBOT</strong> — its pricing page states one price: $4.99 per month, for 75 keyword updates per 24 hours. That is roughly a quarter of Whatsmyserp's entry tier for a comparable core job. The trade-off is scope: it is a rank checker, not a reporting suite.</p>
<p><strong>Mangools</strong> — bundles rank tracking with keyword research and SERP analysis, and its pricing table is worth reading closely on one line. The two cheaper tiers update ranks <strong>weekly</strong>; only the top tier is daily. If you are tracking a rollout, a recovery or a short-lived volatility spike, weekly is a different product from what Whatsmyserp sells.</p>
<p><strong>Ahrefs, Semrush, SE Ranking</strong> — full suites where rank tracking is one feature among many. You are really buying keyword and backlink data. If you already pay for one, check whether its tracker covers your list before adding a second subscription.</p>
<p><strong>BrightLocal</strong> — built around local pack and Google Business Profile reporting. The right purchase if "rankings" for you means map pack visibility rather than blue links.</p>
<p>A warning that applies to this page as much as to any other: <strong>prices in this market change and roundups go stale.</strong> We verified Whatsmyserp and SERPROBOT at the source on 2026-09-26 and deliberately do not quote numbers we could not confirm. Check the vendor's own pricing page before you decide.</p>

<h2>If you need to check how a page renders and is marked up</h2>
<p>This is the job our own tools do, so read this section knowing that we have an interest in it.</p>
<p>A <strong>SERP preview</strong> renders your title and description at Google's desktop and mobile widths, so you see the truncation before you publish rather than after. Our <a href="/tools/serp-preview">SERP preview tool</a> does it in the browser with no signup. Mangools ships a comparable simulator; Whatsmyserp does not have one.</p>
<p><strong>Length is the most common avoidable mistake, and not in the direction people expect.</strong> We measured the homepages of 59 well-known domains in our <a href="/guides/serp-snippet-in-the-wild">SERP snippet survey</a>: the median title is 35 characters, only 12% exceed 60, and 36% fall under 30. Overlong titles are the minority problem.</p>
<p><strong>On-page checks</strong> — headings, canonical, robots.txt, structured data, Open Graph, hreflang — are deterministic and per-page. They need no crawler and no data set. Our <a href="/tools/meta-tag-generator">meta tag generator</a> emits the title, description and canonical from one input so the values cannot drift apart, and the <a href="/tools/heading-analyzer">heading analyzer</a> and <a href="/tools/robots-txt-tester">robots.txt tester</a> cover the rest.</p>

<h2>What we are not</h2>
<p>Being direct, because a comparison page that only flatters its own product is not worth reading.</p>
<p><strong>SerpPrism is not a rank tracker.</strong> We do not crawl Google, we do not store your positions and we cannot tell you where you ranked last week. If rank tracking is what you need, Whatsmyserp or one of the trackers above is the correct purchase, and we are not an alternative to it.</p>
<p><strong>Everything runs in your browser.</strong> Nothing you paste is uploaded. That is a privacy property and also a limit: no history, no alerts, no report to send a client.</p>
<p><strong>There is no account and no quota.</strong> No signup, no daily search meter, no upsell.</p>
<p><strong>We have no backlink data, no search volume data and no API.</strong> If your question needs any of those, we are the wrong tool and we would rather say so here than have you find out after signing up.</p>

<h2>How to decide in one minute</h2>
<table class="mini-table">
<tr><th>What you are trying to answer</th><th>What to use</th></tr>
<tr><td>Where do I rank, and how has it moved?</td><td>A rank tracker — Whatsmyserp, SERPROBOT, or a suite you already pay for</td></tr>
<tr><td>Where do I rank for my own site, for free?</td><td>Google Search Console</td></tr>
<tr><td>Where does a competitor rank?</td><td>A paid tracker; nothing free does this reliably</td></tr>
<tr><td>How will my title and description look in Google?</td><td>A SERP preview — ours is free and needs no account</td></tr>
<tr><td>Is my canonical, robots.txt or structured data correct?</td><td>A per-page checker</td></tr>
<tr><td>Do I need a client-ready white-label report?</td><td>A tracker with white-label reporting — we cannot do this</td></tr>
</table>

<h2>Limitations of this comparison</h2>
<p>We verified Whatsmyserp's plans and prices from its own pricing page on 2026-09-26, and SERPROBOT's single price from its own pricing page on the same day. Everything else is described by positioning rather than by number, because we could not confirm those prices at the source and would rather say less than say something wrong.</p>
<p>Features and prices in this market change monthly. Treat every number here as a dated snapshot, not a standing fact.</p>
<p>We build the tools recommended in the two sections above, so we have an obvious commercial interest in this page. We have tried to state plainly where we lose. If something here is wrong about a competitor, tell us through the <a href="/contact">contact page</a> and we will correct it.</p>`,
    faq: [
      ["Is SerpPrism a Whatsmyserp alternative?", "Only partly, and we would rather say so plainly. Whatsmyserp tracks where keywords rank over time; SerpPrism does not track rankings at all. If you need rank tracking it is not an alternative. If you need to check how a page renders in the SERP, or whether its markup is correct, it is a free one."],
      ["What does Whatsmyserp cost?", "As of 2026-09-26 its pricing page lists Starter at $19.99 per month, Premium at $29.99 and Professional at $59.99. All three include daily automatic refreshes, unlimited on-demand updates, unlimited domains and white-label reporting."],
      ["Is there a free Whatsmyserp plan?", "Its pricing page lists three paid plans and no free tier. Several third-party reviews describe a free spot-checker limited to about 10 searches a day without signup, but we could not confirm that on the site itself."],
      ["What is the cheapest way to track rankings?", "Google Search Console is free and shows real position data for your own verified sites. For competitor keywords, or for a keyword you do not already rank for, you need a paid crawler; SERPROBOT's $4.99 per month single plan was the cheapest we could verify at the source."],
      ["Do I need a rank tracker at all?", "Not if your question is about a page rather than about a position. Titles, descriptions, canonicals, headings, robots.txt and structured data can all be checked per page, immediately, with no account and no data set."],
      ["Why does this page not list prices for every tool?", "Because we could not confirm them at the source on the day we published. Prices in this category change often and third-party roundups go stale, so we quote only what we verified ourselves and describe the rest by what they are for."],
    ],
  },
];

/* =================================================================
   客户端实现
   约定：每个工具页 <body data-tool="fn">，工具容器内所有
   input/textarea/select 变化即重算，结果写进该工具的 out 容器。
   ================================================================= */
const TOOLS_JS = `
/* SerpPrism — client-side core. No network calls, no uploads. */
(function () {
  "use strict";
  var SEOT = {};
  var $ = function (id) { return document.getElementById(id); };
  var txt = function (id) { var e = $(id); return e ? String(e.value || "") : ""; };

  function bind(ids, fn) {
    var run = function () { try { fn(); } catch (e) { console.error(e); } };
    ids.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      ["input", "change", "keyup"].forEach(function (ev) { el.addEventListener(ev, run); });
    });
    run();
  }

  function out(id, html) { var e = $(id); if (e) e.innerHTML = html; }

  // 统一的 HTML 转义：生成的代码块要原样显示，不能被当标签解析。
  // 注意别和某些工具内部的局部 esc 变量重名，所以叫 escHtml。
  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // 复制按钮：原先 llmsGen / schemaGen / utmBuild 上的 data-copy 按钮没有接处理器，
  // 点了没反应。这里统一做事件委托，新工具只要写 data-copy="<pre> 的 id" 就自动可用。
  function copyText(s) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(s);
    return new Promise(function (res, rej) {
      var ta = document.createElement("textarea");
      ta.value = s;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); res(); } catch (e) { rej(e); }
      document.body.removeChild(ta);
    });
  }
  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.getAttribute) return;
    var id = t.getAttribute("data-copy");
    if (!id) return;
    var src = document.getElementById(id);
    if (!src) return;
    var label = t.textContent;
    copyText(src.textContent || "").then(function () {
      t.textContent = "Copied";
      setTimeout(function () { t.textContent = label || "Copy"; }, 1400);
    }).catch(function () {
      t.textContent = "Select it manually";
      setTimeout(function () { t.textContent = label || "Copy"; }, 1600);
    });
  });

  function bar(used, limit) {
    var pct = Math.min(100, Math.round((used / limit) * 100));
    var cls = pct > 100 ? "bad" : pct > 92 ? "warn" : "good";
    return '<div class="meter"><div class="meter-fill ' + cls + '" style="width:' +
      Math.min(100, pct) + '%"></div></div>' +
      '<div class="meter-note ' + cls + '">' + used + " / ~" + limit + " characters</div>";
  }

  /* ---------- 1. Meta Tag Generator ---------- */
  SEOT.metaGen = function () {
    bind(["m-title", "m-url", "m-desc", "m-ogtitle", "m-ogimage", "m-card", "m-site", "m-robots"], function () {
      var title = txt("m-title").trim();
      var url = txt("m-url").trim();
      var desc = txt("m-desc").trim();
      var ogT = txt("m-ogtitle").trim() || title;
      var ogI = txt("m-ogimage").trim();
      var card = txt("m-card") || "summary_large_image";
      var site = txt("m-site").trim();
      var robots = txt("m-robots") || "index, follow";

      var h = "";
      h += "<!-- title / description -->\\n";
      h += "<title>" + title + "</title>\\n";
      h += '<meta name="description" content="' + desc + '">\\n';
      h += '<meta name="robots" content="' + robots + '">\\n';
      if (url) h += '<link rel="canonical" href="' + url + '">\\n';
      h += "\\n<!-- Open Graph -->\\n";
      h += '<meta property="og:type" content="website">\\n';
      if (ogT) h += '<meta property="og:title" content="' + ogT + '">\\n';
      if (desc) h += '<meta property="og:description" content="' + desc + '">\\n';
      if (url) h += '<meta property="og:url" content="' + url + '">\\n';
      if (ogI) h += '<meta property="og:image" content="' + ogI + '">\\n';
      h += "\\n<!-- Twitter -->\\n";
      h += '<meta name="twitter:card" content="' + card + '">\\n';
      if (site) h += '<meta name="twitter:site" content="' + site + '">\\n';
      if (ogT) h += '<meta name="twitter:title" content="' + ogT + '">\\n';
      if (desc) h += '<meta name="twitter:description" content="' + desc + '">\\n';
      if (ogI) h += '<meta name="twitter:image" content="' + ogI + '">\\n';

      var html =
        bar(title.length, 60) +
        bar(desc.length, 155) +
        '<div class="out-head"><span>Generated tags</span>' +
        '<button class="mini" id="m-copy">Copy</button></div>' +
        '<pre class="code" id="m-code">' + h.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</pre>";
      out("m-out", html);

      var b = $("m-copy");
      if (b) b.addEventListener("click", function () {
        var code = $("m-code").textContent;
        if (navigator.clipboard) navigator.clipboard.writeText(code);
        b.textContent = "Copied";
        setTimeout(function () { b.textContent = "Copy"; }, 1400);
      });
    });
  };

  /* ---------- 2. SERP Preview ---------- */
  var cv = null;
  function px(str, font) {
    if (!cv) { cv = document.createElement("canvas"); }
    var c = cv.getContext("2d");
    c.font = font;
    return Math.round(c.measureText(str).width);
  }
  SEOT.serpPreview = function () {
    bind(["s-title", "s-url", "s-desc"], function () {
      var t = txt("s-title").trim() || "Your page title appears here";
      var u = txt("s-url").trim() || "example.com › page";
      var d = txt("s-desc").trim() ||
        "Your meta description appears here. Google shows roughly the first 155 characters on a desktop result, but the limit is measured in rendered pixels rather than characters.";

      var LIMIT_T = 580, LIMIT_D = 600;
      var wt = px(t, "20px arial, sans-serif");
      var wd = px(d, "14px arial, sans-serif");

      function trim(str, limit, font) {
        var lo = 0, hi = str.length;
        while (lo < hi) {
          var mid = (lo + hi + 1) >> 1;
          if (px(str.slice(0, mid), font) <= limit) lo = mid; else hi = mid - 1;
        }
        return lo;
      }
      var cutT = trim(t, LIMIT_T, "20px arial, sans-serif");
      var cutD = trim(d, LIMIT_D, "14px arial, sans-serif");
      var showT = t.slice(0, cutT) + (cutT < t.length ? "…" : "");
      var restT = cutT < t.length ? t.slice(cutT) : "";

      var prev =
        '<div class="serp-box">' +
        '<div class="serp-url">' +
          '<span class="serp-fav"></span>' +
          '<span class="serp-site">' + u.split("/")[0] + "</span>" +
          '<span class="serp-path"> — ' + (u.split("/").slice(1).join(" › ") || "") + "</span>" +
        "</div>" +
        '<div class="serp-title">' + showT +
          (restT ? '<span class="serp-cut">' + restT + "</span>" : "") + "</div>" +
        '<div class="serp-desc">' + d.slice(0, cutD) +
          (cutD < d.length ? '<span class="serp-cut">' + d.slice(cutD) + "</span>" : "") + "</div>" +
        "</div>";
      out("s-preview", prev);

      var cls = function (w, l) { return w > l ? "bad" : w > l * 0.92 ? "warn" : "good"; };
      out("s-report",
        '<div class="meter"><div class="meter-fill ' + cls(wt, LIMIT_T) + '" style="width:' +
          Math.min(100, Math.round(wt / LIMIT_T * 100)) + '%"></div></div>' +
        '<div class="meter-note ' + cls(wt, LIMIT_T) + '">Title: ' + wt + "px of ~" + LIMIT_T +
          "px" + (cutT < t.length ? " — about " + (t.length - cutT) + " characters cut" : " — fits") + "</div>" +
        '<div class="meter" style="margin-top:8px"><div class="meter-fill ' + cls(wd, LIMIT_D) + '" style="width:' +
          Math.min(100, Math.round(wd / LIMIT_D * 100)) + '%"></div></div>' +
        '<div class="meter-note ' + cls(wd, LIMIT_D) + '">Description: ' + wd + "px of ~" + LIMIT_D +
          "px" + (cutD < d.length ? " — about " + (d.length - cutD) + " characters cut" : " — fits") + "</div>");
    });
  };

  /* ---------- 3. robots.txt Tester ---------- */
  function parseRobots(src) {
    var lines = src.split(/\\r?\\n/);
    var groups = [], cur = null, sitemaps = [];
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var hash = raw.indexOf("#");
      var line = (hash >= 0 ? raw.slice(0, hash) : raw).trim();
      if (!line) continue;
      var c = line.indexOf(":");
      if (c < 0) continue;
      var key = line.slice(0, c).trim().toLowerCase();
      var val = line.slice(c + 1).trim();
      if (key === "user-agent") {
        // 新组的判定：还没有当前组 / 当前组已经写过规则 / 当前组被未知指令封口。
        // 连续的 User-agent 行属于同一组（RFC 9309），所以不能见到 user-agent 就开新组。
        if (!cur || cur.rules.length > 0 || cur._closed) { cur = { agents: [], rules: [], _closed: false }; groups.push(cur); }
        cur.agents.push(val.toLowerCase());
      } else if (key === "allow" || key === "disallow") {
        if (!cur) { cur = { agents: ["*"], rules: [], _closed: false }; groups.push(cur); }
        cur.rules.push({ type: key, path: val, line: i + 1, len: val.length });
      } else if (key === "sitemap") {
        sitemaps.push(val);
      } else {
        if (cur) cur._closed = true;
      }
    }
    return { groups: groups, sitemaps: sitemaps };
  }

  function pathToRe(p) {
    // 注意：$ 不能转义 —— 在 robots.txt 里它是「路径结束」锚点，不是字面美元符号。
    var s = p.replace(/[.+?^(){}[\\]\\\\]/g, "\\\\$&");
    s = s.replace(/\\*/g, ".*");
    if (s.slice(-1) === "$") { s = s.slice(0, -1) + "$"; } else { s = s + ".*"; }
    return new RegExp("^" + s + "$", "i");
  }

  function pickGroup(groups, ua) {
    var want = ua.toLowerCase();
    var best = null;
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      for (var j = 0; j < g.agents.length; j++) {
        var a = g.agents[j];
        if (a === want) return g;
        if (a === "*" && !best) best = g;
      }
    }
    return best;
  }

  function decide(group, path) {
    if (!group) return { allow: true, rule: null, why: "No matching group — crawling is allowed by default." };
    var p = path.trim();
    if (p.charAt(0) !== "/") p = "/" + p;
    var win = null;
    for (var i = 0; i < group.rules.length; i++) {
      var r = group.rules[i];
      if (r.path === "") {
        if (r.type === "disallow") continue;
        if (!win || win.len < 1) win = { r: r, len: 1 };
        continue;
      }
      var re = pathToRe(r.path);
      if (!re.test(p)) continue;
      // 长度相同的时候 Allow 胜出（与 Google 的实现一致）
      if (!win || r.path.length > win.len || (r.path.length === win.len && r.type === "allow")) {
        win = { r: r, len: r.path.length };
      }
    }
    if (!win) return { allow: true, rule: null, why: "No rule matched this path — crawling is allowed." };
    return {
      allow: win.r.type === "allow",
      rule: win.r,
      why: "Longest matching rule is " + win.r.type.toUpperCase() + " " +
        (win.r.path === "" ? "(empty value)" : win.r.path) + " on line " + win.r.line + ".",
    };
  }

  SEOT.robotsTest = function () {
    var uaSel = $("r-ua"), customWrap = $("r-custom-wrap");
    if (uaSel) uaSel.addEventListener("change", function () {
      customWrap.hidden = uaSel.value !== "__custom__";
    });
    bind(["r-txt", "r-url", "r-ua", "r-custom"], function () {
      var src = txt("r-txt");
      var url = txt("r-url").trim();
      var ua = txt("r-ua");
      if (ua === "__custom__") ua = txt("r-custom").trim() || "*";

      if (!src.trim()) {
        out("r-out", '<div class="muted">Paste a robots.txt to begin.</div>');
        return;
      }
      var parsed = parseRobots(src);
      var g = pickGroup(parsed.groups, ua);
      var d = decide(g, url || "/");

      var html =
        '<div class="verdict-box ' + (d.allow ? "ok" : "no") + '">' +
          '<div class="verdict-word">' + (d.allow ? "ALLOWED" : "BLOCKED") + "</div>" +
          '<div class="verdict-why">' + d.why + "</div>" +
        "</div>" +
        '<div class="muted small">' +
          "Matched group: <code>" + (g ? g.agents.join(", ") : "none") + "</code> · " +
          "Groups found: " + parsed.groups.length + " · " +
          "Rules in group: " + (g ? g.rules.length : 0) + " · " +
          "Sitemap lines: " + parsed.sitemaps.length +
        "</div>";
      if (d.rule) {
        html += '<table class="mini-table"><tr><th>Rule</th><th>Line</th><th>Length</th></tr>' +
          "<tr><td><code>" + (d.rule.path === "" ? "(empty)" : d.rule.path) + "</code></td>" +
          "<td>" + d.rule.line + "</td><td>" + d.rule.path.length + "</td></tr></table>";
      }
      out("r-out", html);
    });
  };

  /* ---------- 4. Heading Structure Analyzer ---------- */
  SEOT.headingAnalyze = function () {
    bind(["h-html"], function () {
      var src = txt("h-html");
      if (!src.trim()) { out("h-out", '<div class="muted">Paste HTML to see the outline.</div>'); return; }
      var doc = new DOMParser().parseFromString(src, "text/html");
      var hs = Array.prototype.slice.call(doc.querySelectorAll("h1,h2,h3,h4,h5,h6"));
      if (!hs.length) { out("h-out", '<div class="muted">No headings found in this HTML.</div>'); return; }

      var issues = [];
      var h1s = hs.filter(function (e) { return e.tagName === "H1"; });
      if (h1s.length === 0) issues.push(["warn", "No H1 found. Every page benefits from a clear top-level heading."]);
      if (h1s.length > 1) issues.push(["warn", h1s.length + " H1 elements found. Valid HTML, but it usually means the page has competing ideas about what it is about."]);

      var prev = 0;
      hs.forEach(function (e, i) {
        var lvl = parseInt(e.tagName.slice(1), 10);
        if (prev && lvl > prev + 1) {
          issues.push(["warn", "Level skipped: " + e.tagName + " \u201c" +
            e.textContent.trim().slice(0, 50) + "\u201d follows H" + prev + "."]);
        }
        prev = lvl;
        var t = e.textContent.trim();
        if (t.length > 70) issues.push(["info", e.tagName + " is " + t.length + " characters — long headings stop being scannable."]);
        if (!t) issues.push(["warn", "Empty " + e.tagName + " found."]);
      });

      var outline = hs.map(function (e) {
        var lvl = parseInt(e.tagName.slice(1), 10);
        return '<div class="h-row h-' + lvl + '"><span class="h-tag">' + e.tagName + "</span>" +
          '<span class="h-text">' + (e.textContent.trim() || "(empty)") + "</span></div>";
      }).join("");

      var counts = {};
      hs.forEach(function (e) { counts[e.tagName] = (counts[e.tagName] || 0) + 1; });
      var tally = ["H1", "H2", "H3", "H4", "H5", "H6"].map(function (k) {
        return '<span class="chip' + (counts[k] ? "" : " dim") + '">' + k + ": " + (counts[k] || 0) + "</span>";
      }).join("");

      var ih = issues.length
        ? '<div class="issue-list">' + issues.slice(0, 12).map(function (p) {
            return '<div class="issue ' + p[0] + '">' + p[1] + "</div>";
          }).join("") + "</div>"
        : '<div class="issue ok">No structural problems found.</div>';

      out("h-out",
        '<div class="chips">' + tally + "</div>" +
        '<div class="out-head"><span>Issues (' + issues.length + ")</span></div>" + ih +
        '<div class="out-head"><span>Outline</span></div><div class="outline">' + outline + "</div>");
    });
  };

  /* ---------- 5. Keyword Density ---------- */
  var STOP = ("a about above after again against all am an and any are aren as at be because been before being below between both but by can cannot could couldn did didn do does doesn doing don down during each few for from further had hadn has hasn have haven having he her here hers herself him himself his how i if in into is isn it its itself just ll me more most mustn my myself no nor not of off on once only or other ought our ours ourselves out over own re s same shan she should shouldn so some such t than that the their theirs them themselves then there these they this those through to too under until up ve very was wasn we were weren what when where which while who whom why will with won would wouldn you your yours yourself yourselves").split(" ");
  var STOPSET = {};
  STOP.forEach(function (w) { STOPSET[w] = 1; });

  SEOT.kwDensity = function () {
    bind(["k-text", "k-n", "k-stop", "k-top"], function () {
      var raw = txt("k-text");
      var n = parseInt(txt("k-n") || "2", 10);
      var useStop = txt("k-stop") === "on";
      var top = parseInt(txt("k-top") || "20", 10);
      if (!raw.trim()) { out("k-out", '<div class="muted">Paste some text to analyse.</div>'); return; }

      var words = raw.toLowerCase().match(/[a-z0-9']+/g) || [];
      var counts = {};
      var total = 0;
      for (var i = 0; i + n <= words.length; i++) {
        var gram = words.slice(i, i + n);
        if (useStop) {
          var allStop = gram.every(function (w) { return STOPSET[w]; });
          var edgeStop = STOPSET[gram[0]] || STOPSET[gram[gram.length - 1]];
          if (allStop || edgeStop) continue;
        }
        var key = gram.join(" ");
        counts[key] = (counts[key] || 0) + 1;
        total++;
      }
      var arr = Object.keys(counts).map(function (k) {
        return { k: k, c: counts[k], p: total ? (counts[k] / total) * 100 : 0 };
      }).sort(function (a, b) { return b.c - a.c || a.k.localeCompare(b.k); }).slice(0, top);

      if (!arr.length) { out("k-out", '<div class="muted">Not enough text to analyse at this phrase length.</div>'); return; }

      var max = arr[0].c;
      var rows = arr.map(function (r) {
        return "<tr><td>" + r.k + "</td><td class='num'>" + r.c + "</td>" +
          "<td class='num'>" + r.p.toFixed(2) + "%</td>" +
          "<td><div class='bar'><div class='bar-fill' style='width:" +
          Math.round((r.c / max) * 100) + "%'></div></div></td></tr>";
      }).join("");

      out("k-out",
        '<div class="muted small">' + words.length + " words · " + total + " phrases counted · " +
          Object.keys(counts).length + " unique</div>" +
        '<table class="kw-table"><tr><th>Phrase</th><th>Count</th><th>Share</th><th style="width:38%"></th></tr>' +
        rows + "</table>");
    });
  };

  /* ---------- 6. Readability ---------- */
  function syllables(w) {
    w = w.toLowerCase().replace(/[^a-z]/g, "");
    if (!w) return 0;
    if (w.length <= 3) return 1;
    w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
    // 按「连续元音段」计数，比 {1,2} 更贴近真实音节
    // （beautiful → eau/i/u = 3，而不是 ea/u/i/u = 4）
    var m = w.match(/[aeiouy]+/g);
    return m ? m.length : 1;
  }
  SEOT.readability = function () {
    bind(["rd-text"], function () {
      var t = txt("rd-text").trim();
      if (!t) { out("rd-out", '<div class="muted">Paste some text to score.</div>'); return; }
      var sents = t.split(/(?<=[.!?])\\s+|\\n+/).filter(function (s) { return s.trim().length > 1; });
      if (!sents.length) sents = [t];
      var words = t.match(/[A-Za-z0-9']+/g) || [];
      if (!words.length) { out("rd-out", '<div class="muted">No words found.</div>'); return; }

      var syl = 0, long = 0;
      words.forEach(function (w) {
        var s = syllables(w);
        syl += s;
        if (s >= 3) long++;
      });
      var W = words.length, S = sents.length;
      var fre = 206.835 - 1.015 * (W / S) - 84.6 * (syl / W);
      var fkg = 0.39 * (W / S) + 11.8 * (syl / W) - 15.59;
      fre = Math.max(0, Math.min(100, fre));

      var band = fre >= 80 ? ["Very easy", "good"] : fre >= 70 ? ["Easy", "good"]
        : fre >= 60 ? ["Plain English", "good"] : fre >= 50 ? ["Fairly difficult", "warn"]
        : fre >= 30 ? ["Difficult", "warn"] : ["Very difficult", "bad"];

      var longest = sents.map(function (s, i) {
        return { i: i, n: (s.match(/[A-Za-z0-9']+/g) || []).length, s: s.trim() };
      }).sort(function (a, b) { return b.n - a.n; }).slice(0, 5);

      var passive = (t.match(/\\b(is|are|was|were|be|been|being)\\s+\\w+(ed|en)\\b/gi) || []).length;

      out("rd-out",
        '<div class="score-grid">' +
          '<div class="score ' + band[1] + '"><div class="score-n">' + fre.toFixed(0) +
            '</div><div class="score-l">Flesch Reading Ease</div><div class="score-b">' + band[0] + "</div></div>" +
          '<div class="score"><div class="score-n">' + fkg.toFixed(1) +
            '</div><div class="score-l">Flesch-Kincaid grade</div><div class="score-b">US school years</div></div>' +
          '<div class="score"><div class="score-n">' + (W / S).toFixed(1) +
            '</div><div class="score-l">Words per sentence</div><div class="score-b">target under 20</div></div>' +
          '<div class="score"><div class="score-n">' + (syl / W).toFixed(2) +
            '</div><div class="score-l">Syllables per word</div><div class="score-b">lower is easier</div></div>' +
        "</div>" +
        '<div class="muted small">' + W + " words · " + S + " sentences · " +
          long + " words of 3+ syllables (" + Math.round((long / W) * 100) + "%) · " +
          passive + " possible passive constructions</div>" +
        '<div class="out-head"><span>Longest sentences</span></div>' +
        '<div class="issue-list">' + longest.map(function (r) {
          return '<div class="issue ' + (r.n > 25 ? "warn" : "info") + '"><strong>' + r.n +
            " words</strong> — " + r.s.slice(0, 160) + (r.s.length > 160 ? "…" : "") + "</div>";
        }).join("") + "</div>");
    });
  };

  /* 内部函数暴露给 Node 测试用（scripts/test-seosite.mjs）。
     不在浏览器里产生任何副作用。 */
  SEOT._test = {
    parseRobots: parseRobots, pickGroup: pickGroup, decide: decide,
    pathToRe: pathToRe, syllables: syllables, STOPSET: STOPSET
  };

  /* 暴露纯函数供 scripts/test-seosite.mjs 在 Node 里断言。
     浏览器端无副作用；带下划线前缀表示「不是给页面用的」。 */
  /* ---------- 7. llms.txt Generator ---------- */
  SEOT.llmsGen = function () {
    bind(["lt-name", "lt-sum", "lt-notes", "lt-rows", "lt-head", "lt-abs"], function () {
      var name = txt("lt-name").trim();
      var sum = txt("lt-sum").trim();
      var notes = txt("lt-notes").trim();
      var rows = txt("lt-rows").split(/\\n+/).map(function (r) { return r.trim(); }).filter(Boolean);
      var head = txt("lt-head") || "Tools";
      var abs = txt("lt-abs") === "yes";

      if (!name && !sum && !rows.length) {
        out("lt-out", '<div class="muted">Fill in your site name and at least one entry.</div>');
        return;
      }

      var items = [];
      var skipped = [];
      rows.forEach(function (r) {
        var parts = r.split("|").map(function (p) { return p.trim(); });
        if (parts.length < 2 || !parts[0] || !parts[1]) { skipped.push(r); return; }
        items.push({ title: parts[0], path: parts[1], desc: parts[2] || "" });
      });

      var L = [];
      L.push("# " + (name || "Untitled site"));
      L.push("");
      if (sum) { L.push("> " + sum); L.push(""); }
      if (items.length) {
        L.push("## " + head);
        items.forEach(function (it) {
          var loc = abs && /^https?:\\/\\//i.test(it.path) ? it.path : it.path;
          L.push("- [" + it.title + "](" + loc + ")" + (it.desc ? ": " + it.desc : ""));
        });
        L.push("");
      }
      if (notes) {
        L.push("## Notes for automated readers");
        L.push(notes);
        L.push("");
      }

      var body = L.join("\\n");
      var esc = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      var warn = skipped.length
        ? '<div class="issue warn">Skipped ' + skipped.length + " line(s) that were not in <code>Title | /path | description</code> format.</div>"
        : "";
      var note = items.length > 60
        ? '<div class="issue info">You have ' + items.length + " entries. Consider keeping the list short — files with hundreds of entries lose the signal.</div>"
        : "";

      out("lt-out",
        '<div class="out-head"><span>llms.txt</span>' +
        '<button class="mini" type="button" data-copy="lt-body">Copy</button></div>' +
        warn + note +
        '<pre class="code" id="lt-body">' + esc + "</pre>" +
        '<p class="small muted">Save as <code>llms.txt</code> at your domain root — the same place as <code>robots.txt</code>.</p>');
    });
  };

  /* ---------- 8. JSON-LD Schema Generator ---------- */
  var SCHEMA_FIELDS = {
    article: [
      ["headline", "Headline", "text", true],
      ["desc", "Description", "text", false],
      ["author", "Author name", "text", true],
      ["pub", "datePublished (YYYY-MM-DD)", "text", true],
      ["mod", "dateModified (YYYY-MM-DD)", "text", false],
      ["url", "Page URL", "text", false],
      ["site", "Site name", "text", false],
    ],
    faq: [
      ["q1", "Question 1", "text", true],
      ["a1", "Answer 1", "area", true],
      ["q2", "Question 2", "text", false],
      ["a2", "Answer 2", "area", false],
      ["q3", "Question 3", "text", false],
      ["a3", "Answer 3", "area", false],
    ],
    howto: [
      ["name", "HowTo name", "text", true],
      ["desc", "Description", "text", false],
      ["steps", "Steps (one per line)", "area", true],
    ],
    product: [
      ["name", "Product name", "text", true],
      ["desc", "Description", "text", false],
      ["brand", "Brand", "text", false],
      ["price", "Price (numbers only)", "text", true],
      ["cur", "Currency (e.g. USD)", "text", true],
    ],
    breadcrumb: [
      ["items", "Trail — one per line: Label | /path", "area", true],
    ],
    org: [
      ["name", "Organization name", "text", true],
      ["url", "Website URL", "text", true],
      ["desc", "Description", "text", false],
      ["logo", "Logo URL", "text", false],
    ],
  };

  var isoOk = function (s) { return /^\\d{4}-\\d{2}-\\d{2}$/.test(s); };

  SEOT.schemaGen = function () {
    var holder = $("sc-fields");
    if (!holder) return;

    function render() {
      var type = txt("sc-type") || "article";
      var defs = SCHEMA_FIELDS[type] || [];
      holder.innerHTML = defs.map(function (d) {
        var id = "sc-" + d[0];
        var req = d[3] ? ' <span class="muted">(required)</span>' : "";
        if (d[2] === "area") {
          return '<label>' + d[1] + req + '<textarea id="' + id + '" rows="3"></textarea></label>';
        }
        return '<label>' + d[1] + req + '<input id="' + id + '" type="text"></label>';
      }).join("");
      defs.forEach(function (d) {
        var el = $("sc-" + d[0]);
        if (!el) return;
        ["input", "change", "keyup"].forEach(function (ev) {
          el.addEventListener(ev, function () { try { build(); } catch (e) { console.error(e); } });
        });
      });
      build();
    }

    function build() {
      var type = txt("sc-type") || "article";
      var v = function (k) { return txt("sc-" + k).trim(); };
      var problems = [];
      var node = {};

      if (type === "article") {
        if (!v("headline")) problems.push("headline is required");
        if (!v("author")) problems.push("author name is required");
        if (v("pub") && !isoOk(v("pub"))) problems.push("datePublished must be YYYY-MM-DD");
        if (v("mod") && !isoOk(v("mod"))) problems.push("dateModified must be YYYY-MM-DD");
        node = {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: v("headline"),
          author: { "@type": "Person", name: v("author") },
        };
        if (v("desc")) node.description = v("desc");
        if (v("pub")) node.datePublished = v("pub");
        if (v("mod")) node.dateModified = v("mod");
        if (v("url")) node.mainEntityOfPage = { "@type": "WebPage", "@id": v("url") };
        if (v("site")) node.publisher = { "@type": "Organization", name: v("site") };
      } else if (type === "faq") {
        var pairs = [];
        for (var i = 1; i <= 3; i++) {
          var q = v("q" + i), a = v("a" + i);
          if (q && a) pairs.push({ q: q, a: a });
        }
        if (!pairs.length) problems.push("at least one question and answer pair is required");
        node = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: pairs.map(function (p) {
            return {
              "@type": "Question",
              name: p.q,
              acceptedAnswer: { "@type": "Answer", text: p.a },
            };
          }),
        };
      } else if (type === "howto") {
        var steps = txt("sc-steps").split(/\\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
        if (!v("name")) problems.push("HowTo name is required");
        if (!steps.length) problems.push("at least one step is required");
        node = {
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: v("name"),
          step: steps.map(function (s, i) {
            return { "@type": "HowToStep", position: i + 1, name: s, text: s };
          }),
        };
        if (v("desc")) node.description = v("desc");
      } else if (type === "product") {
        if (!v("name")) problems.push("product name is required");
        var price = v("price");
        if (!price) problems.push("price is required");
        else if (!/^\\d+(\\.\\d+)?$/.test(price)) problems.push("price should be a number with no currency symbol");
        if (!v("cur")) problems.push("currency is required");
        node = {
          "@context": "https://schema.org",
          "@type": "Product",
          name: v("name"),
          offers: {
            "@type": "Offer",
            price: price,
            priceCurrency: v("cur").toUpperCase(),
          },
        };
        if (v("desc")) node.description = v("desc");
        if (v("brand")) node.brand = { "@type": "Brand", name: v("brand") };
      } else if (type === "breadcrumb") {
        var trail = txt("sc-items").split(/\\n+/).map(function (s) { return s.trim(); }).filter(Boolean)
          .map(function (line) {
            var p = line.split("|").map(function (x) { return x.trim(); });
            return { name: p[0] || "", item: p[1] || "" };
          }).filter(function (x) { return x.name; });
        if (trail.length < 2) problems.push("a breadcrumb trail needs at least two entries");
        node = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: trail.map(function (x, i) {
            var e = { "@type": "ListItem", position: i + 1, name: x.name };
            if (x.item) e.item = x.item;
            return e;
          }),
        };
      } else if (type === "org") {
        if (!v("name")) problems.push("organization name is required");
        if (!v("url")) problems.push("website URL is required");
        node = {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: v("name"),
          url: v("url"),
        };
        if (v("desc")) node.description = v("desc");
        if (v("logo")) node.logo = v("logo");
      }

      var json = JSON.stringify(node, null, 2);
      var esc = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      var warn = problems.length
        ? '<div class="issue warn">' + problems.map(function (p) {
            return "<div>" + p.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</div>";
          }).join("") + "</div>"
        : '<div class="issue ok">All required properties present.</div>';

      out("sc-out",
        '<div class="out-head"><span>JSON-LD</span>' +
        '<button class="mini" type="button" data-copy="sc-body">Copy</button></div>' +
        warn +
        '<pre class="code" id="sc-body">' + esc + "</pre>" +
        '<p class="small muted">Paste into your page head, then verify with Google&rsquo;s Rich Results Test.</p>');
    }

    var sel = $("sc-type");
    if (sel) sel.addEventListener("change", render);
    render();
  };

  /* ---------- 9. UTM Link Builder ---------- */
  SEOT.utmBuild = function () {
    bind(["u-base", "u-src", "u-med", "u-cmp", "u-term", "u-con"], function () {
      var base = txt("u-base").trim();
      var src = txt("u-src").trim();
      var med = txt("u-med").trim();
      var cmp = txt("u-cmp").trim();
      var term = txt("u-term").trim();
      var con = txt("u-con").trim();

      if (!base) { out("u-out", '<div class="muted">Paste the destination URL to start.</div>'); return; }

      var warns = [];
      var fixed = base;
      if (!/^https?:\\/\\//i.test(fixed)) {
        fixed = "https://" + fixed.replace(/^\\/+/, "");
        warns.push("Added https:// — the original did not include a scheme.");
      }
      if (!src) warns.push("utm_source is missing — the visit cannot be attributed to a source.");
      if (!med) warns.push("utm_medium is missing — the visit cannot be attributed to a channel.");
      if (!cmp) warns.push("utm_campaign is missing — you will not be able to separate this promotion from others.");

      var vals = { source: src, medium: med, campaign: cmp, term: term, content: con };
      Object.keys(vals).forEach(function (k) {
        var v = vals[k];
        if (!v) return;
        if (v !== v.toLowerCase()) {
          warns.push("utm_" + k + " has uppercase characters. Values are case-sensitive, so 'News' and 'news' become separate entries in your reports.");
        }
        if (/\\s/.test(v)) warns.push("utm_" + k + " contains a space. Use hyphens or underscores instead.");
      });

      var known = ["cpc", "ppc", "email", "social", "referral", "organic", "display", "banner", "affiliate"];
      if (med && known.indexOf(med.toLowerCase()) === -1) {
        warns.push('"' + med + '" is not a common medium value. Typical ones are: ' + known.join(", ") + ".");
      }

      var parts = [];
      if (src) parts.push("utm_source=" + encodeURIComponent(src));
      if (med) parts.push("utm_medium=" + encodeURIComponent(med));
      if (cmp) parts.push("utm_campaign=" + encodeURIComponent(cmp));
      if (term) parts.push("utm_term=" + encodeURIComponent(term));
      if (con) parts.push("utm_content=" + encodeURIComponent(con));

      var final = parts.length ? fixed + (fixed.indexOf("?") === -1 ? "?" : "&") + parts.join("&") : fixed;
      var esc = final.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      var warnHtml = warns.length
        ? '<div class="issue-list">' + warns.map(function (w) {
            return '<div class="issue warn">' + w.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</div>";
          }).join("") + "</div>"
        : '<div class="issue ok">No problems found. All required parameters present and consistently cased.</div>';

      out("u-out",
        '<div class="out-head"><span>Tagged URL</span>' +
        '<button class="mini" type="button" data-copy="u-body">Copy</button></div>' +
        warnHtml +
        '<pre class="code" id="u-body">' + esc + "</pre>");
    });
  };

  /* ---------- 10. Open Graph / social card preview ---------- */
  SEOT.ogPreview = function () {
    bind(["og-u", "og-t", "og-d", "og-i", "og-s", "og-w", "og-h", "og-tw", "og-c"], function () {
      var url = txt("og-u").trim();
      var title = txt("og-t").trim();
      var desc = txt("og-d").trim();
      var img = txt("og-i").trim();
      var site = txt("og-s").trim();
      var w = txt("og-w").trim();
      var h = txt("og-h").trim();
      var tw = txt("og-tw").trim();
      var card = txt("og-c") || "summary_large_image";

      if (!url && !title && !desc && !img) {
        out("og-out", '<div class="muted">Fill in a field to see the card.</div>');
        return;
      }

      var E = escHtml;
      var host = "";
      var hm = url.match(/^https?:\\/\\/([^\\/]+)/);
      if (hm) host = hm[1];
      else if (url) host = url;

      var abs = /^https?:\\/\\//i.test(img);
      var issues = [];

      if (!title) {
        issues.push(["warn", "No og:title — platforms fall back to the title tag, and often to the first heading on the page, which is rarely what you want shown."]);
      } else if (title.length > 88) {
        issues.push(["warn", "og:title is " + title.length + " characters. X cuts near 70, LinkedIn near 100. Keep the important words in the first 60."]);
      }
      if (!desc) {
        issues.push(["warn", "No og:description — the card shows an empty gap, or a sentence the scraper picked for you."]);
      } else if (desc.length > 200) {
        issues.push(["warn", "og:description is " + desc.length + " characters. Most cards cut near 200; LinkedIn cuts nearer 160 in some layouts."]);
      }
      if (!img) {
        issues.push(["bad", "No og:image — the card renders as a plain grey block. This is the single biggest reason a shared link gets scrolled past."]);
      } else {
        if (!abs) {
          issues.push(["bad", "og:image is not an absolute URL. Scrapers have no base URL to resolve a relative path against, so the tag is dropped."]);
        } else if (/^http:\\/\\//i.test(img)) {
          issues.push(["warn", "og:image is http:// on what is presumably an https page. Some platforms refuse to render insecure images."]);
        }
        if (!w || !h) {
          issues.push(["warn", "No og:image:width / og:image:height. The scraper has to download the image to lay the card out, and if that fetch is slow or blocked the first share goes out with no image at all."]);
        } else {
          var iw = parseInt(w, 10), ih = parseInt(h, 10);
          if (iw > 0 && ih > 0) {
            if (iw < 200 || ih < 200) {
              issues.push(["bad", "Image is " + iw + " x " + ih + " px. Below 200x200 most platforms will not use it for a large card."]);
            }
            var ratio = iw / ih;
            if (ratio < 1.5 || ratio > 2.1) {
              issues.push(["info", "Aspect ratio is about " + ratio.toFixed(2) + ":1. Outside the 1.91:1 sweet spot the image is likely to be centre-cropped."]);
            }
          }
        }
      }
      if (!url) issues.push(["info", "No og:url. Worth adding when several URLs serve the same content — it tells the scraper which one to credit the share to."]);
      if (!site) issues.push(["info", "No og:site_name — the source line under the card falls back to the bare domain."]);
      if (!issues.length) {
        issues.push(["ok", "Nothing wrong found. Remember that every platform caches the card, so a fix is not visible until that cache is refreshed."]);
      }

      var issueHtml = '<div class="issue-list">' + issues.map(function (it) {
        return '<div class="issue ' + it[0] + '">' + E(it[1]) + "</div>";
      }).join("") + "</div>";

      // 预览里请求图片时故意不带 referrer：很多 CDN 的热链保护会拦带外站 Referer 的请求，
      // 那正是「浏览器打得开、平台上却是灰块」的原因。
      var imgHtml = img && abs
        ? '<img src="' + E(img) + '" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;display:block">'
        : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#8a9099;font-size:13px;text-align:center;padding:12px">no usable og:image</div>';

      var big =
        '<div class="serp-box" style="padding:0;overflow:hidden">' +
          '<div style="height:262px;background:var(--panel)">' + imgHtml + "</div>" +
          '<div style="padding:12px 16px">' +
            '<div class="serp-url"><span class="serp-fav"></span><span class="serp-site">' + (E(host) || "your-domain.com") + "</span></div>" +
            '<div class="serp-title">' + (title ? E(title) : '<span class="dim">Untitled — no og:title</span>') + "</div>" +
            (desc ? '<div class="serp-desc">' + E(desc.slice(0, 220)) + "</div>" : "") +
          "</div>" +
        "</div>";

      var small =
        '<div class="serp-box" style="padding:0;overflow:hidden;display:flex">' +
          '<div style="width:116px;height:116px;flex:none;background:var(--panel)">' + imgHtml + "</div>" +
          '<div style="padding:10px 13px;min-width:0">' +
            '<div class="serp-desc" style="margin-bottom:2px">' + (E(host) || "your-domain.com") + "</div>" +
            '<div class="serp-title" style="font-size:15px">' + (title ? E(title) : '<span class="dim">Untitled</span>') + "</div>" +
            (desc ? '<div class="serp-desc">' + E(desc.slice(0, 130)) + "</div>" : "") +
          "</div>" +
        "</div>";

      // 标签里放原始值，输出前整体转义一次 —— 转义两次会变成 &amp;amp;
      var tags = "";
      tags += "<!-- Open Graph -->\\n";
      tags += '<meta property="og:type" content="website">\\n';
      if (title) tags += '<meta property="og:title" content="' + title + '">\\n';
      if (desc) tags += '<meta property="og:description" content="' + desc + '">\\n';
      if (url) tags += '<meta property="og:url" content="' + url + '">\\n';
      if (img) tags += '<meta property="og:image" content="' + img + '">\\n';
      if (img && w) tags += '<meta property="og:image:width" content="' + w + '">\\n';
      if (img && h) tags += '<meta property="og:image:height" content="' + h + '">\\n';
      if (site) tags += '<meta property="og:site_name" content="' + site + '">\\n';
      tags += "\\n<!-- Twitter -->\\n";
      tags += '<meta name="twitter:card" content="' + card + '">\\n';
      if (tw) tags += '<meta name="twitter:site" content="' + tw + '">\\n';
      if (title) tags += '<meta name="twitter:title" content="' + title + '">\\n';
      if (desc) tags += '<meta name="twitter:description" content="' + desc + '">\\n';
      if (img) tags += '<meta name="twitter:image" content="' + img + '">\\n';

      out("og-out",
        '<div class="out-head"><span>How it will render</span></div>' +
        '<div class="grid2">' +
          '<div><div class="small muted" style="margin-bottom:6px">Large image card — LinkedIn, Facebook, X, Slack</div>' + big + "</div>" +
          '<div><div class="small muted" style="margin-bottom:6px">Small summary card — twitter:card = summary</div>' + small + "</div>" +
        "</div>" +
        '<div class="out-head"><span>What needs fixing</span></div>' + issueHtml +
        '<div class="out-head"><span>Generated tags</span>' +
        '<button class="mini" type="button" data-copy="og-body">Copy</button></div>' +
        '<pre class="code" id="og-body">' + E(tags) + "</pre>");
    });
  };

  /* ---------- 11. hreflang generator ---------- */
  var REGION_SET = (function () {
    var list = (
      "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
      "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
      "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
      "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
      "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
      "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
      "UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
    ).split(/\\s+/);
    var set = {};
    list.forEach(function (c) { set[c] = 1; });
    return set;
  })();
  // 语言小写、可选脚本子标签（Hans/Hant 等）、可选地区（2 字母大写或 3 位数字，如 es-419）
  var LANG_RE = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$/;

  SEOT.hreflangGen = function () {
    bind(["hl-rows", "hl-def", "hl-fmt"], function () {
      var raw = txt("hl-rows").split(/\\n+/).map(function (r) { return r.trim(); }).filter(Boolean);
      var def = txt("hl-def").trim();
      var fmt = txt("hl-fmt") || "html";

      if (!raw.length && !def) {
        out("hl-out", '<div class="muted">Add at least one language version to begin.</div>');
        return;
      }

      var E = escHtml;
      var rows = [];
      var issues = [];
      var seenCode = {};
      var seenUrl = {};

      raw.forEach(function (line, i) {
        var parts = line.indexOf("|") >= 0 ? line.split("|") : line.split(/\\s+/);
        var code = (parts[0] || "").trim();
        var href = parts.slice(1).join(" ").trim();

        if (!code) { issues.push(["bad", "Line " + (i + 1) + ": no language code."]); return; }
        if (!href) { issues.push(["bad", "Line " + (i + 1) + ": no URL for " + code + "."]); return; }

        if (!LANG_RE.test(code)) {
          issues.push(["bad", "Line " + (i + 1) + ": " + code + " is not a valid hreflang value. Expected a lowercase language subtag (en), optionally a script (zh-Hans), optionally an uppercase region (en-US)."]);
          return;
        }
        var bits = code.split("-");
        var region = null;
        for (var b = 1; b < bits.length; b++) {
          if (/^[A-Z]{2}$/.test(bits[b]) || /^[0-9]{3}$/.test(bits[b])) region = bits[b];
        }
        // 只有 2 字母的才去比对 ISO 3166-1；3 位数字是 UN M.49 大区码（es-419 拉美），
        // 同样是合法的 hreflang 地区子标签，不能误报。
        if (region && /^[A-Z]{2}$/.test(region) && !REGION_SET[region]) {
          if (region === "UK") {
            issues.push(["bad", "Line " + (i + 1) + ": " + code + " uses UK. The ISO 3166-1 code for the United Kingdom is GB — use " + code.replace("UK", "GB") + "."]);
          } else {
            issues.push(["warn", "Line " + (i + 1) + ": " + region + " is not a recognised ISO 3166-1 alpha-2 region code. Double-check it."]);
          }
        }
        if (seenCode[code]) issues.push(["bad", "Duplicate language code " + code + ". Each code may appear only once in a cluster."]);
        seenCode[code] = 1;

        if (!/^https?:\\/\\//i.test(href)) {
          issues.push(["bad", "Line " + (i + 1) + ": " + href + " is not an absolute URL. hreflang targets must be complete URLs including the scheme."]);
        } else if (/^http:\\/\\//i.test(href)) {
          issues.push(["warn", "Line " + (i + 1) + ": " + href + " is http, not https."]);
        }
        if (seenUrl[href]) {
          issues.push(["warn", href + " is used for more than one language. That is usually a geo-redirect setup, which hreflang cannot express — each language needs its own URL."]);
        }
        seenUrl[href] = 1;

        rows.push({ code: code, href: href });
      });

      if (def && !/^https?:\\/\\//i.test(def)) {
        issues.push(["bad", "The x-default value must be a full URL, not a language code."]);
      } else if (rows.length && !def) {
        issues.push(["info", "No x-default. It is optional, but worth adding for visitors whose language is not in the list."]);
      }
      if (rows.length === 1) {
        issues.push(["info", "Only one language version. hreflang only does something once there are two or more."]);
      }
      if (!issues.length) {
        issues.push(["ok", "Nothing wrong found. Every page in the cluster must carry this complete set, including its own line — that part you have to verify on the live pages."]);
      }

      var issueHtml = '<div class="issue-list">' + issues.map(function (it) {
        return '<div class="issue ' + it[0] + '">' + E(it[1]) + "</div>";
      }).join("") + "</div>";

      var cluster = rows.slice();
      if (def) cluster.push({ code: "x-default", href: def });

      var code = "";
      if (fmt === "http") {
        code = "Link: " + cluster.map(function (r) {
          return "<" + r.href + '>; rel="alternate"; hreflang="' + r.code + '"';
        }).join(",\\n      ") + "\\n";
      } else if (fmt === "sitemap") {
        var block = cluster.map(function (r) {
          return '  <xhtml:link rel="alternate" hreflang="' + r.code + '" href="' + r.href + '"/>';
        }).join("\\n");
        // 站点地图里每个 URL 都要带完整集群（含自己），所以每个语言版本各出一个 <url> 块
        code = '<?xml version="1.0" encoding="UTF-8"?>\\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\\n' +
          '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\\n' +
          rows.map(function (r) {
            return "<url>\\n  <loc>" + r.href + "</loc>\\n" + block + "\\n</url>";
          }).join("\\n") +
          "\\n</urlset>\\n";
      } else {
        cluster.forEach(function (r) {
          code += '<link rel="alternate" hreflang="' + r.code + '" href="' + r.href + '">\\n';
        });
      }

      var note = "Cluster: " + rows.length + " language" + (rows.length === 1 ? "" : "s") +
        (def ? " + x-default" : "") + " = " + cluster.length + " entries. " +
        "Each of the " + rows.length + " pages must carry this complete set, including its own line.";

      out("hl-out",
        '<div class="out-head"><span>What needs fixing</span></div>' + issueHtml +
        '<div class="out-head"><span>Generated annotations</span>' +
        '<button class="mini" type="button" data-copy="hl-body">Copy</button></div>' +
        '<pre class="code" id="hl-body">' + E(code) + "</pre>" +
        '<div class="muted small">' + E(note) + "</div>");
    });
  };

  SEOT._internal = { parseRobots, pickGroup, decide, pathToRe, syllables, isoOk };

  window.SEOT = SEOT;

  document.addEventListener("DOMContentLoaded", function () {
    var fn = document.body.getAttribute("data-tool");
    if (fn && SEOT[fn]) SEOT[fn]();
  });
})();
`;

/* =================================================================
   样式
   ================================================================= */
const CSS = `
:root{
  --bg:#ffffff; --panel:#f7f9fc; --line:#e4e8ef; --ink:#151821; --ink-2:#5a6373;
  --accent:#2f6df6; --good:#0f7b4f; --warn:#a8630a; --bad:#b3261e;
  --radius:12px; --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
[data-theme="dark"]{
  --bg:#0f1218; --panel:#171b24; --line:#262c38; --ink:#e8ecf3; --ink-2:#9aa4b5;
  --accent:#6b9bff; --good:#4cc38a; --warn:#e0a458; --bad:#ff7b6e;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;}
.wrap{max-width:920px;margin:0 auto;padding:0 22px}
.wrap.narrow{max-width:760px}
a{color:var(--accent)}
h1,h2,h3,h4{line-height:1.28;letter-spacing:-.2px}
h2{font-size:21px;margin:30px 0 10px}
h3{font-size:17px;margin:22px 0 8px}
p{margin:0 0 14px}
code{font-family:var(--mono);font-size:.9em;background:var(--panel);padding:1px 5px;border-radius:4px}
.skip{position:absolute;left:-9999px}
.skip:focus{left:8px;top:8px;background:var(--bg);padding:8px 12px;z-index:9;border:1px solid var(--line)}
header.site{border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg);z-index:5}
header.site .wrap{display:flex;align-items:center;gap:16px;min-height:58px;flex-wrap:wrap}
.logo{font-weight:800;font-size:17px;text-decoration:none;color:var(--ink);display:flex;align-items:center;gap:7px}
.logo .mark{font-size:19px}
.logo em{font-style:normal;color:var(--accent)}
header.site nav{display:flex;gap:2px;flex-wrap:wrap;margin-left:auto;align-items:center}
header.site nav a{font-size:13.5px;color:var(--ink-2);text-decoration:none;padding:5px 8px;border-radius:7px}
header.site nav a:hover{background:var(--panel);color:var(--ink)}
#theme{background:none;border:1px solid var(--line);border-radius:8px;cursor:pointer;padding:4px 8px;margin-left:4px}
main{padding:34px 0 60px}
footer.site{border-top:1px solid var(--line);padding:34px 0 40px;background:var(--panel);font-size:14px}
footer.site .cols{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:26px}
footer.site .fcol{margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-2)}
footer.site ul{list-style:none;margin:0;padding:0}
footer.site li{margin-bottom:5px}
footer.site a{color:var(--ink-2);text-decoration:none}
footer.site a:hover{color:var(--accent)}
.legal{margin-top:26px;padding-top:16px;border-top:1px solid var(--line);color:var(--ink-2);font-size:13px}
.crumb{font-size:13px;color:var(--ink-2);margin:0 0 6px}
.crumb a{color:var(--ink-2)}
.lead{font-size:17.5px;color:var(--ink-2);margin:0 0 22px}
.hero{background:var(--panel);border-bottom:1px solid var(--line);padding:40px 0 38px;margin:-34px 0 34px}
.hero h1{font-size:clamp(26px,4.2vw,38px);margin:0 0 12px}
.badges{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.badge{font-size:12.5px;padding:4px 11px;border:1px solid var(--line);border-radius:20px;background:var(--bg);color:var(--ink-2)}
.badge.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.grid-tools{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin:22px 0}
.tcard{border:1px solid var(--line);border-radius:var(--radius);padding:16px;background:var(--bg);text-decoration:none;color:inherit;display:block}
.tcard:hover{border-color:var(--accent)}
.tcard h3{margin:0 0 6px;font-size:16px}
.tcard p{margin:0;font-size:14px;color:var(--ink-2)}
.tool{border:1px solid var(--line);border-radius:var(--radius);padding:18px;background:var(--panel);margin:22px 0}
label{display:block;margin-bottom:13px;font-size:13.5px;color:var(--ink-2);font-weight:600}
label input,label textarea,label select{
  display:block;width:100%;margin-top:6px;padding:9px 11px;font:inherit;font-size:15px;
  border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--ink)}
label textarea{font-family:var(--mono);font-size:13.5px;line-height:1.6;resize:vertical}
label input:focus,label textarea:focus,label select:focus{outline:2px solid var(--accent);outline-offset:0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 14px}
@media(max-width:620px){.grid2,.grid3{grid-template-columns:1fr}}
.meter{height:7px;background:var(--line);border-radius:20px;overflow:hidden;margin:10px 0 4px}
.meter-fill{height:100%;border-radius:20px}
.meter-fill.good{background:var(--good)}.meter-fill.warn{background:var(--warn)}.meter-fill.bad{background:var(--bad)}
.meter-note{font-size:12.5px;font-weight:600}
.meter-note.good{color:var(--good)}.meter-note.warn{color:var(--warn)}.meter-note.bad{color:var(--bad)}
.out-head{display:flex;justify-content:space-between;align-items:center;margin:18px 0 8px;font-weight:700;font-size:14px}
.mini{font:inherit;font-size:12.5px;padding:4px 11px;border:1px solid var(--line);background:var(--bg);
  color:var(--ink);border-radius:7px;cursor:pointer}
.mini:hover{border-color:var(--accent)}
pre.code{background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:13px;overflow:auto;
  font-family:var(--mono);font-size:12.5px;line-height:1.6;margin:0;max-height:340px}
.muted{color:var(--ink-2)}
.small{font-size:12.5px}
.serp-box{border:1px solid var(--line);border-radius:10px;padding:14px 16px;background:#fff;max-width:620px}
[data-theme="dark"] .serp-box{background:#11151c}
.serp-url{display:flex;align-items:center;gap:7px;font-size:13px;color:#202124;margin-bottom:3px}
[data-theme="dark"] .serp-url{color:#c9d1dc}
.serp-fav{width:22px;height:22px;border-radius:50%;background:#e8eaed;flex:none}
.serp-site{font-weight:600}
.serp-path{color:#5f6368}
.serp-title{color:#1a0dab;font-size:19px;line-height:1.35;margin-bottom:3px}
[data-theme="dark"] .serp-title{color:#8ab4f8}
.serp-desc{color:#4d5156;font-size:13.5px;line-height:1.58}
[data-theme="dark"] .serp-desc{color:#bdc1c6}
.serp-cut{color:#9aa0a6;text-decoration:line-through}
.verdict{margin-top:6px}
.verdict-box{border:1px solid var(--line);border-left-width:4px;border-radius:9px;padding:13px 15px;background:var(--bg);margin-bottom:10px}
.verdict-box.ok{border-left-color:var(--good)}
.verdict-box.no{border-left-color:var(--bad)}
.verdict-word{font-weight:800;font-size:17px;letter-spacing:.02em}
.verdict-box.ok .verdict-word{color:var(--good)}
.verdict-box.no .verdict-word{color:var(--bad)}
.verdict-why{font-size:14px;color:var(--ink-2)}
.mini-table{border-collapse:collapse;font-size:13px;margin-top:10px}
.mini-table th,.mini-table td{border:1px solid var(--line);padding:5px 10px;text-align:left}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.chip{font-size:12.5px;padding:3px 10px;border:1px solid var(--line);border-radius:20px}
.chip.dim{opacity:.45}
.outline{border:1px solid var(--line);border-radius:9px;padding:10px;background:var(--bg);max-height:380px;overflow:auto}
.h-row{padding:3px 0;font-size:14px;display:flex;gap:9px;align-items:baseline}
.h-tag{font-family:var(--mono);font-size:11.5px;color:var(--ink-2);flex:none;min-width:26px}
.h-1 .h-text{font-weight:700;font-size:16px}
.h-2{padding-left:14px}.h-3{padding-left:28px}.h-4{padding-left:42px}
.h-5{padding-left:56px}.h-6{padding-left:70px}
.issue-list{display:flex;flex-direction:column;gap:7px}
.issue{border:1px solid var(--line);border-left-width:3px;border-radius:8px;padding:9px 12px;font-size:14px;background:var(--bg)}
.issue.warn{border-left-color:var(--warn)}
.issue.ok{border-left-color:var(--good)}
.issue.info{border-left-color:var(--line)}
.kw-table{border-collapse:collapse;width:100%;font-size:13.5px;margin-top:10px}
.kw-table th,.kw-table td{border-bottom:1px solid var(--line);padding:6px 9px;text-align:left}
.kw-table .num{text-align:right;font-variant-numeric:tabular-nums;width:64px}
.bar{height:6px;background:var(--line);border-radius:20px;overflow:hidden}
.bar-fill{height:100%;background:var(--accent);border-radius:20px}
.score-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0}
@media(max-width:680px){.score-grid{grid-template-columns:repeat(2,1fr)}}
.score{border:1px solid var(--line);border-radius:var(--radius);padding:14px;text-align:center;background:var(--bg)}
.score-n{font-size:27px;font-weight:800;line-height:1.1}
.score.good .score-n{color:var(--good)}.score.warn .score-n{color:var(--warn)}.score.bad .score-n{color:var(--bad)}
.score-l{font-size:12.5px;color:var(--ink-2);margin-top:4px}
.score-b{font-size:11.5px;color:var(--ink-2);opacity:.8;margin-top:2px}
.faq{margin:26px 0 0}
.faq details{border:1px solid var(--line);border-radius:10px;padding:12px 15px;margin-bottom:9px;background:var(--panel)}
.faq summary{cursor:pointer;font-weight:600;font-size:15px}
.faq p{margin:9px 0 0;font-size:14.5px;color:var(--ink-2)}
.privacy{border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:0 10px 10px 0;
  padding:14px 16px;background:var(--panel);margin:22px 0}
.privacy h2{margin:0 0 7px;font-size:15px}
.privacy p{margin:0;font-size:14.5px;color:var(--ink-2)}
.note{font-size:14px;color:var(--ink-2);border-top:1px solid var(--line);padding-top:16px;margin-top:30px}
.byline{font-size:13.5px;color:var(--ink-2);margin:-10px 0 22px;padding-bottom:14px;border-bottom:1px solid var(--line)}
.byline a{color:var(--ink-2);text-decoration:underline;text-decoration-color:var(--line)}
.byline a:hover{color:var(--accent)}
.author-box{display:flex;gap:16px;align-items:flex-start;border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;background:var(--panel);margin:28px 0}
.author-box h3{margin:0 0 6px;font-size:15px}
.author-box p{margin:0 0 8px;font-size:14.5px}
.author-box p:last-child{margin-bottom:0}
.author-avatar{width:44px;height:44px;flex:none;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px}
@media(max-width:620px){.author-box{flex-direction:column;gap:10px}}
`;

/* =================================================================
   结构化数据（沿用工具站已验证的 @graph 模式）
   ================================================================= */
const ORG_ID = `${SITE}/#organization`;
const SITE_ID = `${SITE}/#website`;
const PERSON_ID = `${SITE}/#person`;
const ABOUT_ID = `${SITE}/about#webpage`;

/* 作者节点：单独抽出来，About 页要把它升级成 ProfilePage 的主角 */
const personNode = () => ({
  "@type": "Person",
  "@id": PERSON_ID,
  name: AUTHOR_NAME,
  alternateName: AUTHOR_NAME_CN,
  url: `${SITE}/about`,
  description: AUTHOR_BIO,
  email: CONTACT_EMAIL,
  address: { "@type": "PostalAddress", addressLocality: "Xi'an", addressCountry: "CN" },
  knowsAbout: [
    "Technical SEO",
    "Search engine result page rendering",
    "robots.txt",
    "Open Graph and Twitter card metadata",
    "hreflang and international SEO",
    "Structured data (JSON-LD)",
  ],
});

const siteNodes = () => [
  {
    "@type": "Organization",
    "@id": ORG_ID,
    name: BRAND,
    url: `${SITE}/`,
    description: "Free browser-based SEO and website auditing tools.",
    email: CONTACT_EMAIL,
    founder: { "@id": PERSON_ID },
  },
  { "@type": "WebSite", "@id": SITE_ID, name: BRAND, url: `${SITE}/`, inLanguage: "en", publisher: { "@id": ORG_ID } },
  personNode(),
];

const webPageNode = ({ p, title, desc }) => ({
  "@type": "WebPage",
  "@id": `${SITE}${p}#webpage`,
  url: `${SITE}${p}`,
  name: title,
  description: desc,
  isPartOf: { "@id": SITE_ID },
  inLanguage: "en",
  datePublished: LAUNCH,
  dateModified: UPDATED,
  author: { "@id": PERSON_ID },
});

const breadcrumbNode = (p, trail) => ({
  "@type": "BreadcrumbList",
  "@id": `${SITE}${p}#breadcrumb`,
  itemListElement: trail.map(([name, url], i) => ({
    "@type": "ListItem",
    position: i + 1,
    name,
    item: url,
  })),
});

const graphOf = (...nodes) => ({ "@context": "https://schema.org", "@graph": [...siteNodes(), ...nodes.flat()] });

const faqNode = (p, faq) => ({
  "@type": "FAQPage",
  "@id": `${SITE}${p}#faq`,
  mainEntity: faq.map(([q, a]) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: stripTags(a) },
  })),
});

function toolJsonLd(t) {
  const p = `/tools/${t.slug}`;
  const url = `${SITE}${p}`;
  const steps = t.steps.map(stripTags);
  return graphOf(
    webPageNode({ p, title: `${t.h1} — Free, No Upload | ${BRAND}`, desc: t.metaDesc }),
    breadcrumbNode(p, [["Home", `${SITE}/`], ["Tools", `${SITE}/tools/`], [t.h1, url]]),
    {
      "@type": "WebApplication",
      "@id": `${url}#app`,
      name: t.h1,
      url,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any (runs in a browser)",
      browserRequirements: "Requires JavaScript. No installation.",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: steps,
      publisher: { "@id": ORG_ID },
    },
    {
      "@type": "HowTo",
      "@id": `${url}#howto`,
      name: `How to use the ${t.h1}`,
      totalTime: "PT1M",
      author: { "@id": PERSON_ID },
      publisher: { "@id": ORG_ID },
      tool: [{ "@type": "HowToTool", name: "A web browser" }],
      step: steps.map((text, i) => ({ "@type": "HowToStep", position: i + 1, text })),
    },
    faqNode(p, t.faq)
  );
}

/* =================================================================
   页面骨架
   ================================================================= */
const nav = () =>
  `<a href="/tools/">All tools</a>` +
  TOOLS.map((t) => `<a href="/tools/${t.slug}">${esc(t.nav)}</a>`).join("") +
  `<a href="/guides/">Guides</a>`;

const ASSET_V = crypto.createHash("sha1").update(CSS).update(TOOLS_JS).digest("hex").slice(0, 8);

/* og:image 文件名。
   两边都从页面的 canonical 推名字（不是从文件名），规则只有这一条：
   去掉 .html、去掉尾部斜杠、按 / 拆成 a-b-c；根路径叫 home。
   例：/ → home · /404 → 404 · /tools/ → tools · /guides/x → guides-x
   （去掉 .html 这一步是防御性的：目前没有页面带 .html 后缀，但万一某个
     canonical 写成了 /x.html，CF Pages 会 308 跳掉，名字对不上就直接掉图。）
   ⚠️ scripts/gen-og-images.py 的 og_name() 是同一规则的 Python 版
   （Node 出 <meta> 标签，Python 出实际图片文件），check-seosite.mjs 有
   「标签指向的图片必须真实存在」的断言兜底 —— 这条断言上线当天就抓到了
   404 页两边不一致，不要删。 */
const ogName = (canonicalPath) => {
  const p = canonicalPath.replace(/\.html$/, "").replace(/\/+$/, "");
  return p === "" || p === "/" ? "home" : p.split("/").filter(Boolean).join("-");
};

function layout({ title, desc, canonicalPath, body, jsonLd, bodyAttr = "" }) {
  const url = SITE + canonicalPath;
  // 社交卡片。2026-09-23 之前 25/25 个页面都是 twitter:card=summary_large_image
  // 却没有 og:image，分享出去是灰框 —— 本站的 open-graph-preview 工具正好判它 bad。
  const ogUrl = `${SITE}/og/${ogName(canonicalPath)}.png`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:image" content="${ogUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ogUrl}">
<meta name="twitter:image:alt" content="${esc(title)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="author" content="${esc(AUTHOR_NAME)}">
<link rel="alternate" type="text/plain" href="${SITE}/llms.txt" title="LLM-friendly index">
<link rel="alternate" type="application/rss+xml" href="${SITE}/feed.xml" title="${BRAND} — Guides">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%232f6df6%22/><text y=%22.74em%22 x=%2250%22 text-anchor=%22middle%22 font-size=%2252%22>%F0%9F%94%8D</text></svg>">
<style>${CSS}</style>
<script>try{var t=localStorage.getItem("sp-theme");if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ""}
</head>
<body${bodyAttr}>
<a class="skip" href="#main">Skip to content</a>
<header class="site">
  <div class="wrap">
    <a class="logo" href="/"><span class="mark">🔍</span>Serp<em>Prism</em></a>
    <nav>${nav()}<button id="theme" title="Toggle theme" aria-label="Toggle theme">🌗</button></nav>
  </div>
</header>
<main id="main">${body}</main>
<footer class="site">
  <div class="wrap">
    <div class="cols">
      <div>
        <p class="fcol">${esc(BRAND)}</p>
        <p style="margin:0">Free SEO and website auditing tools that run entirely in your browser. Nothing you paste is uploaded or stored.</p>
        <p style="margin:10px 0 0">Built and maintained by <a href="/about">${esc(AUTHOR_NAME)}</a>.</p>
      </div>
      <div>
        <p class="fcol">Tools</p>
        <ul>
          <li><a href="/tools/"><strong>All tools</strong></a></li>
          ${TOOLS.map((t) => `<li><a href="/tools/${t.slug}">${esc(t.h1)}</a></li>`).join("")}
        </ul>
      </div>
      <div>
        <p class="fcol">Guides</p>
        <ul>
          <li><a href="/guides/"><strong>All guides</strong></a></li>
          ${GUIDES.map((g) => `<li><a href="/guides/${g.slug}">${esc(g.h1)}</a></li>`).join("")}
        </ul>
      </div>
      <div>
        <p class="fcol">Site</p>
        <ul>
          <li><a href="/about">About</a></li>
          <li><a href="/contact">Contact</a></li>
          <li><a href="/privacy">Privacy</a></li>
        </ul>
      </div>
    </div>
    <div class="legal">
      <p>© ${new Date().getFullYear()} ${esc(BRAND)} — ${esc(DOMAIN_LABEL)}. All analysis happens locally in your browser. Last updated ${UPDATED}.</p>
    </div>
  </div>
</footer>
<script src="/js/tools.js?v=${ASSET_V}"></script>
<script>(function(){var b=document.getElementById("theme");if(!b)return;b.addEventListener("click",function(){var h=document.documentElement,n=h.getAttribute("data-theme")==="dark"?"light":"dark";h.setAttribute("data-theme",n);try{localStorage.setItem("sp-theme",n)}catch(e){}});})();</script>
</body>
</html>
`;
}

/* ---------- 首页 ---------- */
const homeBody = `
<section class="hero">
  <div class="wrap">
    <h1>Free SEO tools that run in your browser</h1>
    <p class="lead">Preview snippets, test robots.txt rules, audit heading structure and measure readability — without uploading anything to a server.</p>
    <div class="badges">
      <span class="badge on">100% client-side</span>
      <span class="badge">No signup</span>
      <span class="badge">No file size limit</span>
      <span class="badge">Works offline after load</span>
    </div>
  </div>
</section>
<div class="wrap">
  <div class="privacy">
    <h2>Why “client-side” matters here</h2>
    <p>You are about to paste unpublished page copy, a staging robots.txt, or HTML from a site you are not ready to talk about. Every tool on this site processes that input as plain JavaScript on your own machine. Nothing is uploaded, nothing is logged, and there is no request attached to the text you type.</p>
  </div>
  <h2>All tools</h2>
  <div class="grid-tools">
    ${TOOLS.map(
      (t) => `<a class="tcard" href="/tools/${t.slug}"><h3>${esc(t.h1)}</h3><p>${esc(t.metaDesc.split(".")[0])}.</p></a>`
    ).join("")}
  </div>
  <h2>Guides</h2>
  <div class="grid-tools">
    ${GUIDES.map(
      (g) => `<a class="tcard" href="/guides/${g.slug}"><h3>${esc(g.h1)}</h3><p>${esc(g.lead)}</p></a>`
    ).join("")}
  </div>
</div>
`;

/* ---------- 署名块（E-E-A-T 的 Expertise 信号）----------
   工具页只用紧凑署名，避免 11 个页面重复同一段 bio 造成站内内容重复；
   指南页（-ful）额外放完整作者框，About 页放最完整的一版。 */
const BYLINE = `<p class="byline">By <a href="/about">${esc(AUTHOR_NAME)}</a> · Updated <time datetime="${UPDATED}">${UPDATED}</time></p>`;

const AUTHOR_BOX = `
  <div class="author-box">
    <div class="author-avatar" aria-hidden="true">HR</div>
    <div>
      <h3>About the author</h3>
      <p><strong>${esc(AUTHOR_NAME)}</strong> (${esc(AUTHOR_NAME_CN)}) — ${esc(AUTHOR_BIO_SHORT)} He built and maintains ${esc(BRAND)}.</p>
      <p class="muted small">Corrections are the most useful thing you can send. If a tool or guide here gives you a wrong answer, that is a bug, not a judgement call — use the <a href="/contact">contact page</a>.</p>
    </div>
  </div>`;

/* ---------- 工具页 ---------- */
function toolBody(t) {
  const why = t.why
    .map(
      (s) => `<h2>${esc(s.h)}</h2>${s.p.map((p) => `<p>${p}</p>`).join("")}`
    )
    .join("");
  const rel = t.related
    .map((s) => TOOLS.find((x) => x.slug === s))
    .filter(Boolean)
    .map((x) => `<a class="tcard" href="/tools/${x.slug}"><h3>${esc(x.h1)}</h3><p>${esc(x.metaDesc.split(".")[0])}.</p></a>`)
    .join("");
  return `
<div class="wrap narrow">
  <p class="crumb"><a href="/">Home</a> › <a href="/tools/">Tools</a> › ${esc(t.h1)}</p>
  <h1 style="font-size:clamp(25px,3.6vw,34px);margin:8px 0 10px">${esc(t.h1)}</h1>
  <p class="lead">${esc(t.metaDesc)}</p>
  ${BYLINE}

  <div class="tool">
    ${t.ui}
  </div>

  <p>${t.intro}</p>

  <h2>How to use it</h2>
  <ol>${t.steps.map((s) => `<li>${s}</li>`).join("")}</ol>

  ${why}

  <div class="faq">
    <h2>Questions</h2>
    ${t.faq
      .map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`)
      .join("")}
  </div>

  ${
    rel
      ? `<h2>Related tools</h2><div class="grid-tools">${rel}</div>`
      : ""
  }
</div>`;
}

/* ---------- 指南页 ---------- */
function guideBody(g) {
  return `
<div class="wrap narrow">
  <p class="crumb"><a href="/">Home</a> › <a href="/guides/">Guides</a> › ${esc(g.h1)}</p>
  <h1 style="font-size:clamp(25px,3.6vw,34px);margin:8px 0 10px">${esc(g.h1)}</h1>
  <p class="lead">${esc(g.lead)}</p>
  ${BYLINE}
  <article>${g.body}</article>
  ${AUTHOR_BOX}
  <div class="faq">
    <h2>Questions</h2>
    ${g.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join("")}
  </div>
</div>`;
}

/* ---------- 索引页 ---------- */
const toolHubBody = `
<div class="wrap narrow">
  <p class="crumb"><a href="/">Home</a> › Tools</p>
  <h1 style="font-size:clamp(25px,3.6vw,34px);margin:8px 0 10px">All SEO tools</h1>
  <p class="lead">${TOOLS.length} free utilities for checking how a page will appear in search, what crawlers are allowed to do, and whether the copy is readable. All of them run in your browser.</p>

  <h2>Which tool do I need?</h2>
  <ul>
    <li><strong>About to publish a page?</strong> Start with the <a href="/tools/serp-preview">SERP Preview</a>, then generate the tags with the <a href="/tools/meta-tag-generator">Meta Tag Generator</a>.</li>
    <li><strong>Pages missing from Google?</strong> Test your rules with the <a href="/tools/robots-txt-tester">robots.txt Tester</a> before assuming anything else is wrong.</li>
    <li><strong>Cleaning up page structure?</strong> The <a href="/tools/heading-analyzer">Heading Structure Analyzer</a> builds the outline and flags what is broken.</li>
    <li><strong>Checking whether the copy says what you think it says?</strong> Use <a href="/tools/keyword-density">Keyword Density</a> for topic terms and <a href="/tools/readability-score">Readability Score</a> for sentence load.</li>
  </ul>

  <h2>All tools</h2>
  <div class="grid-tools">
    ${TOOLS.map(
      (t) => `<a class="tcard" href="/tools/${t.slug}"><h3>${esc(t.h1)}</h3><p>${esc(t.metaDesc.split(".")[0])}.</p></a>`
    ).join("")}
  </div>

  <h2>What these tools will not do</h2>
  <p>They do not fetch your live site. Crawling a live URL from a browser is blocked by cross-origin rules, and a client-side tool that could bypass that would be a security problem rather than a feature. Everything here works on text you paste in.</p>
  <p>They also do not produce a single SEO score. A number out of 100 tells you nothing about which line to change; these tools point at the specific rule, heading or sentence instead. That is a deliberate choice, not a missing feature.</p>

  <h2>Why they run in your browser</h2>
  <p>Most tools in this category ask you to paste a URL, then crawl your site from their servers and email you a report. That model has two costs people rarely weigh up: your unpublished page copy and your staging configuration pass through someone else's infrastructure, and you wait for a crawl even when you only wanted to check one line of one file.</p>
  <p>Everything here takes the opposite approach. You paste the text you want checked and the analysis runs locally. There is no queue, no account, no email gate, and nothing to wait for. The trade-off is real and worth stating plainly: these tools cannot see your live site, so they answer "is this correct?" rather than "is my site correct?".</p>

  <h2>A reasonable order to work in</h2>
  <p>If you are about to publish a page, start with the <a href="/tools/serp-preview">SERP Preview</a> to see whether your title and description survive truncation, then generate the matching tags with the <a href="/tools/meta-tag-generator">Meta Tag Generator</a>. Those two catch the problems that cost clicks.</p>
  <p>If a page is missing from search results entirely, check the <a href="/tools/robots-txt-tester">robots.txt Tester</a> before anything else. A blocked path is the most common cause and the fastest to confirm or rule out — and it is invisible in every other diagnostic, because a blocked URL simply never appears.</p>
  <p>Once the page is reachable and titled, move to substance. The <a href="/tools/heading-analyzer">Heading Structure Analyzer</a> tells you whether the page has an outline at all, <a href="/tools/keyword-density">Keyword Density</a> tells you what it is actually about, and <a href="/tools/readability-score">Readability Score</a> tells you whether people will finish it. Those three are about the writing, and the writing is what ranks.</p>

  <h2>Accuracy, and where it stops</h2>
  <p>The robots.txt tester implements the longest-match rule from RFC 9309, including wildcard and end-anchor patterns. It is not a replacement for the tester in Search Console, which has access to Google's real crawl behaviour, but it answers "which of my rules is doing this?" in about two seconds instead of a round trip.</p>
  <p>The SERP preview measures rendered pixel width using the font stack and sizes Google uses on desktop results. It is accurate enough to tell you a snippet will be cut and roughly where; it is not a promise about what Google will display, because Google rewrites descriptions from page content more often than most people realise.</p>
  <p>Where a measurement is approximate, the page says so. A tool that hides its error bars is worse than one that admits them.</p>
</div>`;

const guideHubBody = `
<div class="wrap narrow">
  <p class="crumb"><a href="/">Home</a> › Guides</p>
  <h1 style="font-size:clamp(25px,3.6vw,34px);margin:8px 0 10px">Guides</h1>
  <p class="lead">Short, specific write-ups on the parts of technical SEO where the common advice is wrong or out of date.</p>
  <h2>All guides</h2>
  <div class="grid-tools">
    ${GUIDES.map(
      (g) => `<a class="tcard" href="/guides/${g.slug}"><h3>${esc(g.h1)}</h3><p>${esc(g.lead)}</p></a>`
    ).join("")}
  </div>
  <h2>What these guides have in common</h2>
  <p>Each one covers something you can check and fix in an afternoon, and each one leads with the part of the conventional advice that is wrong or out of date. That constraint is deliberate. There is no shortage of material explaining what a title tag is; there is very little that tells you the 155-character rule is a pixel measurement in disguise, or that disallowing a page prevents its <code>noindex</code> from ever being read.</p>
  <p>The other shared property is that none of them require a tool subscription to act on. If a guide's conclusion is "buy this product", it does not belong here.</p>

  <h2>Where to start</h2>
  <p>If a page has dropped out of search results, read the <a href="/guides/robots-txt-mistakes">robots.txt mistakes</a> guide first — it covers the failure mode that produces no error message anywhere, which is why it takes people weeks to find.</p>
  <p>If you are publishing new pages and want them to earn clicks, read the <a href="/guides/meta-description-length">meta description</a> guide, then check each page with the <a href="/tools/serp-preview">SERP Preview</a>.</p>
  <p>If you are cleaning up an older site, the <a href="/guides/heading-structure-seo">heading structure</a> guide is the one that usually uncovers a template problem affecting every page at once.</p>

  <h2>What is not covered here</h2>
  <p>There is no guide on link building, keyword research tooling, or content calendars. Those topics are saturated with material that is either obvious or wrong, and this site is deliberately about things you can check and fix in an afternoon.</p>
  <p>There is also nothing here about AI-generated content at scale. Not because it is taboo, but because the useful advice depends entirely on what you are doing with it, and a general guide would be worthless to everyone.</p>

  <h2>How to read a technical SEO claim</h2>
  <p>Most bad advice in this field has the same shape: a rule stated as absolute, with no mention of what it was measured on. "Titles should be 60 characters" is a measurement of one font at one size on one device. "Keyword density should be 2%" was never measured on anything. When a rule has no conditions attached, that is the signal to check it rather than adopt it.</p>
  <p>A useful test is to ask what would change the answer. If nothing would — if the rule holds regardless of your platform, audience or content type — it is probably a policy or a legal requirement, not an optimisation. Those are the only absolute rules in this field, and there are very few of them.</p>
  <p>The second useful test is recency. Google's systems change continuously, and a claim that was verifiable in 2019 may now be simply false. Where a guide here makes a claim about current behaviour, it says when it was checked.</p>

  <h2>Corrections</h2>
  <p>If one of these guides is wrong about something, that is worth an email — see the <a href="/contact">contact page</a>. Technical SEO advice ages badly, and several widely repeated claims were accurate five years ago and are not now. Being told which ones I have repeated is genuinely useful.</p>
</div>`;

/* =================================================================
   输出
   ================================================================= */
fs.rmSync(OUT, { recursive: true, force: true });
for (const d of ["css", "js", "tools", "guides"]) fs.mkdirSync(path.join(OUT, d), { recursive: true });

const write = (rel, content) => {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};

write("css/style.css", CSS);
write("js/tools.js", TOOLS_JS);

write(
  "index.html",
  layout({
    title: `${BRAND} — Free SEO tools that run in your browser`,
    desc: "Preview Google snippets, test robots.txt rules, audit heading structure and measure readability. Free, client-side, no signup.",
    canonicalPath: "/",
    body: homeBody,
    jsonLd: graphOf(
      webPageNode({
        p: "/",
        title: `${BRAND} — Free SEO tools that run in your browser`,
        desc: "Preview Google snippets, test robots.txt rules, audit heading structure and measure readability.",
      }),
      {
        "@type": "ItemList",
        "@id": `${SITE}/#tools`,
        name: "SEO tools",
        numberOfItems: TOOLS.length,
        itemListElement: TOOLS.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.h1, url: `${SITE}/tools/${t.slug}` })),
      }
    ),
  })
);

for (const t of TOOLS) {
  write(
    `tools/${t.slug}.html`,
    layout({
      title: `${t.h1} — Free, No Upload | ${BRAND}`,
      desc: t.metaDesc,
      canonicalPath: `/tools/${t.slug}`,
      body: toolBody(t),
      jsonLd: toolJsonLd(t),
      bodyAttr: ` data-tool="${t.fn}"`,
    })
  );
}

write(
  "tools/index.html",
  layout({
    title: `All SEO Tools — Free & Client-Side | ${BRAND}`,
    desc: `${TOOLS.length} free SEO utilities: SERP preview, meta tag generator, robots.txt tester, heading analyzer, keyword density and readability scoring.`,
    canonicalPath: "/tools/",
    body: toolHubBody,
    jsonLd: graphOf(
      webPageNode({ p: "/tools/", title: "All SEO tools", desc: `${TOOLS.length} free browser-based SEO utilities.` }),
      breadcrumbNode("/tools/", [["Home", `${SITE}/`], ["Tools", `${SITE}/tools/`]]),
      {
        "@type": "CollectionPage",
        "@id": `${SITE}/tools/#collection`,
        name: "SEO tools",
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: TOOLS.length,
          itemListElement: TOOLS.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.h1, url: `${SITE}/tools/${t.slug}` })),
        },
      }
    ),
  })
);

for (const g of GUIDES) {
  write(
    `guides/${g.slug}.html`,
    layout({
      title: `${g.h1} | ${BRAND}`,
      desc: g.lead,
      canonicalPath: `/guides/${g.slug}`,
      body: guideBody(g),
      jsonLd: graphOf(
        webPageNode({ p: `/guides/${g.slug}`, title: g.h1, desc: g.lead }),
        breadcrumbNode(`/guides/${g.slug}`, [["Home", `${SITE}/`], ["Guides", `${SITE}/guides/`], [g.h1, `${SITE}/guides/${g.slug}`]]),
        {
          "@type": "TechArticle",
          "@id": `${SITE}/guides/${g.slug}#article`,
          headline: g.h1,
          description: g.lead,
          datePublished: LAUNCH,
          dateModified: UPDATED,
          // 原来写的是 author: ORG_ID —— 文章作者挂成「组织」，E-E-A-T 上等于没有作者
          author: { "@id": PERSON_ID },
          publisher: { "@id": ORG_ID },
        },
        faqNode(`/guides/${g.slug}`, g.faq)
      ),
    })
  );
}

write(
  "guides/index.html",
  layout({
    title: `SEO Guides | ${BRAND}`,
    desc: "Short, specific guides on the parts of technical SEO where the common advice is wrong or out of date.",
    canonicalPath: "/guides/",
    body: guideHubBody,
    jsonLd: graphOf(
      webPageNode({ p: "/guides/", title: "SEO guides", desc: "Technical SEO guides." }),
      breadcrumbNode("/guides/", [["Home", `${SITE}/`], ["Guides", `${SITE}/guides/`]]),
      {
        "@type": "CollectionPage",
        "@id": `${SITE}/guides/#collection`,
        name: "SEO guides",
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: GUIDES.length,
          itemListElement: GUIDES.map((g, i) => ({ "@type": "ListItem", position: i + 1, name: g.h1, url: `${SITE}/guides/${g.slug}` })),
        },
      }
    ),
  })
);

/* ---------- 静态页 ---------- */
write(
  "about.html",
  layout({
    title: `About ${BRAND}`,
    desc: `${BRAND} is a small set of free, client-side SEO tools. Here is what they do, what they deliberately do not do, and who runs the site.`,
    canonicalPath: "/about",
    body: `<div class="wrap narrow">
  <p class="crumb"><a href="/">Home</a> › About</p>
  <h1 style="font-size:clamp(25px,3.6vw,34px);margin:8px 0 10px">About ${esc(BRAND)}</h1>
  <p class="lead">${esc(BRAND)} is a small collection of SEO tools that run entirely in your browser.</p>
  <h2>Why these tools exist</h2>
  <p>Most SEO checking tools ask you to enter a URL, then crawl your site from their servers and show you a report. That is useful, but it means handing over an address you may not want logged, and waiting for a crawl you do not need if you only wanted to check one thing.</p>
  <p>The tools here take the opposite approach: you paste the text or rules you want to check, and the analysis happens on your machine. There is no queue, no account, and no server-side record of what you checked.</p>
  <h2>What the tools deliberately do not do</h2>
  <p>They do not produce a site-wide SEO score. A single number cannot tell you which line of a robots.txt file is blocking a section, or which sentence of a paragraph is unreadable. Every tool here points at a specific thing instead, because that is what you can actually act on.</p>
  <p>They also do not fetch live URLs. Browsers block cross-origin requests for good reasons, and a tool that worked around that would be a liability rather than a feature. If you need site-wide crawling, use a crawler — this site is for checking one thing quickly and privately.</p>
  <h2>Accuracy and limits</h2>
  <p>Where a measurement is approximate, the tool says so. The SERP preview measures rendered pixel width using the font stack and sizes Google uses on desktop results; it is accurate enough to tell you whether a snippet will be cut, and it is not a guarantee of what Google will display, because Google frequently rewrites descriptions using text from the page itself.</p>
  <p>The robots.txt tester implements the longest-match rule from RFC 9309 including wildcards. It is not a substitute for Google's own tester in Search Console, which has access to Google's actual crawl behaviour — but it is much faster for answering "which of my rules is doing this?"</p>
  ${AUTHOR_BOX}
  <h2>Who runs this</h2>
  <p>${esc(BRAND)} is built and maintained by ${esc(AUTHOR_NAME)} (${esc(AUTHOR_NAME_CN)}), a developer based in Xi'an, China. He also builds JetBrains IDE plugins and a handful of small web tools; this is the one concerned with search results and page markup.</p>
  <p>It started from a specific frustration. Every check that ought to take two seconds — does this snippet fit, is this path blocked, is this heading order sane — seemed to require pasting a URL into somebody else's server and waiting for a crawl. None of them actually need a server: a robots.txt rule can be evaluated in JavaScript, and a snippet's rendered width can be measured with a canvas. So these were built as plain client-side JavaScript instead.</p>
  <h2>What this site does and does not claim to know</h2>
  <p>Worth being straight about the limits. The tools implement published specifications — RFC 9309 for robots.txt, the Open Graph protocol, Google's documented hreflang behaviour — and each tool page states where a measurement is approximate rather than exact. Where behaviour is undocumented, or changes without notice, the page says so instead of guessing.</p>
  <p>The guides are written from the same place: things you can check and fix in an afternoon, not strategic SEO advice. There is deliberately nothing here about link building, keyword research tooling or content calendars, because the useful version of that advice depends entirely on which site is asking.</p>
  <h2>Independence and money</h2>
  <p>${esc(BRAND)} is an independent site with no investors and no parent company. It is free to use and carries advertising; the advertising does not influence what any tool reports, because there is nothing in the code that could be influenced — the analysis runs on your machine and returns the same answer regardless.</p>
  <h2>Corrections</h2>
  <p>If a tool gives you the wrong answer, that is a bug and worth an email — use the <a href="/contact">contact page</a> and include the input that produced it. Technical SEO advice also ages badly: several widely repeated claims were accurate five years ago and are not now. Being told which ones this site has repeated is genuinely useful.</p>
</div>`,
    jsonLd: graphOf(
      {
        "@type": "ProfilePage",
        "@id": ABOUT_ID,
        url: `${SITE}/about`,
        name: `About ${BRAND}`,
        description: `Who runs ${BRAND}, why the tools are client-side, and what the site does and does not claim to know.`,
        isPartOf: { "@id": SITE_ID },
        inLanguage: "en",
        // ⚠️ ProfilePage 的 dateModified 在 Google 规范里是 DateTime 类型，官方示例全是完整
        // ISO 8601（带时间+时区）。只给日期 "2026-09-22" 会被 GSC 判「日期时间值无效」
        // （2026-09-26 Search Console 邮件实测）。datePublished 不是 ProfilePage 的属性，去掉。
        dateModified: UPDATED + "T00:00:00+00:00",
        about: { "@id": PERSON_ID },
        author: { "@id": PERSON_ID },
        mainEntity: { "@id": PERSON_ID },
      },
      breadcrumbNode("/about", [["Home", `${SITE}/`], ["About", `${SITE}/about`]])
    ),
  })
);

write(
  "contact.html",
  layout({
    title: `Contact ${BRAND}`,
    desc: `Get in touch about a bug, a correction or a question about the ${BRAND} SEO tools.`,
    canonicalPath: "/contact",
    body: `<div class="wrap narrow">
  <p class="crumb"><a href="/">Home</a> › Contact</p>
  <h1 style="font-size:clamp(25px,3.6vw,34px);margin:8px 0 10px">Contact</h1>
  <p class="lead">Bug reports and corrections are the most useful thing you can send.</p>
  <h2>Email</h2>
  <p><a href="mailto:${CONTACT_EMAIL}">${esc(CONTACT_EMAIL)}</a></p>
  <h2>What to include in a bug report</h2>
  <p>If a tool gave you the wrong answer, the fastest way to get it fixed is to send the exact input that produced it. For the robots.txt tester that means the file contents and the URL you tested; for the heading analyzer, the HTML you pasted.</p>
  <p>Because everything runs client-side, there is no log on this end to look at — without your input the report cannot be reproduced.</p>
  <h2>What this site cannot help with</h2>
  <p>Individual site audits, link building and ranking consultations are out of scope. This is a tool site, not an agency. If a tool's output confused you, though, that is worth an email — confusing output is usually a bug.</p>
  <h2>Response time</h2>
  <p>Expect a reply within a few days. There is no support team and no live chat; messages go to one inbox.</p>
</div>`,
    jsonLd: graphOf(
      webPageNode({ p: "/contact", title: `Contact ${BRAND}`, desc: `Contact ${BRAND} about bugs or corrections.` }),
      breadcrumbNode("/contact", [["Home", `${SITE}/`], ["Contact", `${SITE}/contact`]])
    ),
  })
);

write(
  "privacy.html",
  layout({
    title: `Privacy Policy | ${BRAND}`,
    desc: `How ${BRAND} handles your data: all tools run client-side, nothing you paste is uploaded, and how advertising and cookies are handled.`,
    canonicalPath: "/privacy",
    body: `<div class="wrap narrow">
  <p class="crumb"><a href="/">Home</a> › Privacy</p>
  <h1 style="font-size:clamp(25px,3.6vw,34px);margin:8px 0 10px">Privacy Policy</h1>
  <p class="lead">The short version: the tools run in your browser, and what you paste into them never leaves your device.</p>
  <h2>What is processed where</h2>
  <p>Every tool on this site is plain JavaScript executing on your own machine. When you paste HTML, a robots.txt file or page copy into a form, that text is read by your browser and never transmitted anywhere. There is no endpoint that receives it, and no record of it is kept.</p>
  <h2>Cookies and advertising</h2>
  <p>This site displays advertising served by Google AdSense. Google and its partners use cookies to serve ads based on a visitor's prior visits to this or other websites. Google's use of advertising cookies enables it and its partners to serve ads based on visits to this site and/or other sites on the internet.</p>
  <p>You can opt out of personalised advertising by visiting <a href="https://www.google.com/settings/ads" rel="nofollow noopener" target="_blank">Google Ads Settings</a>. Visitors in the EEA, UK and Switzerland are shown a consent prompt before personalised advertising cookies are set.</p>
  <h2>Third parties</h2>
  <p>Third-party vendors, including Google, use cookies to serve ads based on prior visits. No advertising vendor receives the content you paste into a tool — advertising scripts and tool inputs are entirely separate, and the tool inputs never leave the browser.</p>
  <h2>Data we do hold</h2>
  <p>Nothing beyond ordinary web server logs that any static site produces. There is no account system, no analytics on tool input, and no email list.</p>
  <h2>Changes</h2>
  <p>If this policy changes, the revision date below changes with it. Questions about any of this can go to <a href="mailto:${CONTACT_EMAIL}">${esc(CONTACT_EMAIL)}</a>.</p>
  <p class="note">Last updated ${UPDATED}.</p>
</div>`,
    jsonLd: graphOf(
      webPageNode({ p: "/privacy", title: `Privacy Policy | ${BRAND}`, desc: `How ${BRAND} handles data and advertising cookies.` }),
      breadcrumbNode("/privacy", [["Home", `${SITE}/`], ["Privacy", `${SITE}/privacy`]])
    ),
  })
);

write(
  "404.html",
  layout({
    title: `Page not found | ${BRAND}`,
    desc: "That page does not exist. Here are the tools instead.",
    // ⚠️ 必须是 /404，不能是 /404.html：CF Pages 的 pretty URL 会把
    // /404.html 308 跳到 /404，canonical 指到会跳转的地址等于让 Google
    // 去收录一个 3xx。（2026-09-23 实测 /404.html → 308 → /404）
    canonicalPath: "/404",
    body: `<div class="wrap narrow">
  <h1 style="font-size:clamp(25px,3.6vw,34px);margin:8px 0 10px">Page not found</h1>
  <p class="lead">That address does not exist on this site. Nothing is broken — the link is just wrong or the page moved.</p>
  <h2>All tools</h2>
  <div class="grid-tools">
    ${TOOLS.map((t) => `<a class="tcard" href="/tools/${t.slug}"><h3>${esc(t.h1)}</h3><p>${esc(t.metaDesc.split(".")[0])}.</p></a>`).join("")}
  </div>
</div>`,
  })
);

/* ---------- 站点文件 ---------- */
const urls = [
  { loc: "/", pri: "1.0", freq: "weekly" },
  { loc: "/tools/", pri: "0.9", freq: "weekly" },
  ...TOOLS.map((t) => ({ loc: `/tools/${t.slug}`, pri: "0.8", freq: "monthly" })),
  { loc: "/guides/", pri: "0.8", freq: "weekly" },
  ...GUIDES.map((g) => ({ loc: `/guides/${g.slug}`, pri: "0.7", freq: "monthly" })),
  { loc: "/about", pri: "0.4", freq: "yearly" },
  { loc: "/contact", pri: "0.4", freq: "yearly" },
  { loc: "/privacy", pri: "0.3", freq: "yearly" },
];

write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${SITE}${u.loc}</loc>
    <lastmod>${UPDATED}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.pri}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`
);

write("robots.txt", `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`);

write("ads.txt", `google.com, pub-${ADSENSE_CLIENT.replace("ca-pub-", "")}, DIRECT, f08c47fec0942fa0\n`);

write(
  "_headers",
  `/*.html
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/css/*
  Cache-Control: public, max-age=604800

/js/*
  Cache-Control: public, max-age=604800
`
);

write("_redirects", "");

write(
  "llms.txt",
  `# ${BRAND}

> Free SEO and website auditing tools that run entirely in the browser. No upload, no signup.

## Tools
${TOOLS.map((t) => `- [${t.h1}](${SITE}/tools/${t.slug}): ${t.metaDesc}`).join("\n")}

## Guides
${GUIDES.map((g) => `- [${g.h1}](${SITE}/guides/${g.slug}): ${g.lead}`).join("\n")}

## Notes for automated readers
All processing is client-side JavaScript. There is no API; tool behaviour is deterministic given the same input.
`
);

/* ---------- RSS feed ----------
   用途：内容分发的机器可读入口。
   Dev.to / Hashnode 都支持「按 RSS 自动导入，并把来源标为 canonical」——
   配一次就不必每次手动复制正文 + 手动填 canonical。
   （手动填 canonical 那个入口在编辑器最底部的六边形图标里，很不好找，
     这是当初做这个 feed 的直接原因。）

   两个必须处理的细节：
   ① 正文里的站内相对链接（href="/tools/x"）要转成绝对 URL，
      否则导入到别的平台后链接全断。
   ② 用 CDATA 包全文（导入器读 content:encoded），description 放摘要兜底。
      CDATA 里不能出现 `]]>`，要先替换掉。
*/
const rfc822 = (d) => {
  const dt = new Date(d + "T00:00:00Z");
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getUTCDay()];
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dt.getUTCMonth()];
  return `${wd}, ${String(dt.getUTCDate()).padStart(2, "0")} ${mo} ${dt.getUTCFullYear()} 00:00:00 +0000`;
};
const xesc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const absolutise = (html) => String(html).replace(/(href|src)="\//g, `$1="${SITE}/`);

write(
  "feed.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>${xesc(BRAND)} — Guides</title>
  <link>${SITE}/guides/</link>
  <description>Short, specific write-ups on technical SEO, including original data from surveys of real sites.</description>
  <language>en</language>
  <lastBuildDate>${rfc822(UPDATED)}</lastBuildDate>
  <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
${GUIDES.map((g) => {
  const url = `${SITE}/guides/${g.slug}`;
  const body = absolutise(g.body).replace(/\]\]>/g, "]]&gt;");
  // <category> 是给 RSS 导入器读的标签（Forem 的 get_tags 取 item.categories 前 4 个）。
  // 少了它，Dev.to 导入的文章会一个标签都没有 —— 没标签等于没有分发。
  const cats = (g.tags || []).map((t) => `    <category>${xesc(t)}</category>`).join("\n");
  return `  <item>
    <title>${xesc(g.h1)}</title>
    <link>${url}</link>
    <guid isPermaLink="true">${url}</guid>
    <pubDate>${rfc822(g.date || UPDATED)}</pubDate>
    <description>${xesc(g.lead)}</description>
${cats}
    <content:encoded><![CDATA[${body}]]></content:encoded>
  </item>`;
}).join("\n")}
</channel>
</rss>
`
);

/* Dev.to 发布器的标签来源。
   ⚠️ 为什么单独写一份 JSON 而不是让发布器去解析 feed.xml：
   RSS 导入进来的草稿是**先于**这次生成就建好的（Dev.to 侧），回读时它没标签；
   发布器需要按 canonical 反查标签补上去。写进 assets/ 而不是 seosite/ —— 后者每次
   生成都被 rmSync 清掉。单一数据源仍然是 GUIDES 里的 tags。 */
fs.mkdirSync(path.join(ROOT, "assets"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "assets", "devto-tags.json"),
  JSON.stringify(
    Object.fromEntries(GUIDES.filter((g) => g.tags?.length).map((g) => [`${SITE}/guides/${g.slug}`, g.tags])),
    null,
    2
  ) + "\n"
);

// GSC 站点所有权验证文件。文件名 token 是 Google Search Console 给的，
// 换站或重新验证时改 GSC_TOKEN 一行；文件名会自动跟着变。
// 同时也要在 scripts/prepare-deploy-dir.mjs 的 seo.files 白名单里登记新文件名，
// 否则会被静默丢弃（这个坑踩过：toolboxes.top 的 contact.html）。
//
// 同时输出两份：有 .html 扩展名的（GSC 给的标准文件名）+ 无扩展名的备份。
// 原因：CF Pages 默认对所有 .html 走 308 跳到无扩展名（"漂亮 URL"），
// 部分 GSC fetcher 不跟 308 直接判定失败。两份都备，无论访问哪种 URL 都能拿到。
const GSC_TOKEN = "google11ba110197545384";
// ⚠️ 文件内容结尾必须带 .html —— GSC 下载的那个文件原文就是
// `google-site-verification: google11ba110197545384.html`。
// 我第一次凭格式猜成不带后缀，GSC 报「验证文件内容错误」（逐字节匹配）。
// 以后换 token 直接把 GSC 下载的文件内容抄过来，别自己拼。
// 末尾不加换行 —— GSC 下载的原文就没有换行符，做到逐字节一致最保险。
const gscBody = `google-site-verification: ${GSC_TOKEN}.html`;
write(`${GSC_TOKEN}.html`, gscBody);
write(GSC_TOKEN, gscBody);

/* ---------- 报告 ---------- */
const htmlFiles = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const fp = path.join(d, e.name);
    if (e.isDirectory()) walk(fp);
    else if (fp.endsWith(".html")) htmlFiles.push(path.relative(OUT, fp).replace(/\\/g, "/"));
  }
})(OUT);

console.log(`✅ ${BRAND} 生成完成 → ${OUT}`);
console.log(`   页面 ${htmlFiles.length} · 工具 ${TOOLS.length} · 指南 ${GUIDES.length} · sitemap ${urls.length} 条`);
