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
const UPDATED = "2026-09-21";
const LAUNCH = "2026-09-21";
const ADSENSE_CLIENT = "ca-pub-9901133369141996";
const CONTACT_EMAIL = "renhongtao2@gmail.com";

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
      "Generate clean page title, meta description, canonical, Open Graph and Twitter card tags. Live length warnings, copy-ready HTML, runs entirely in your browser.",
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
      "Preview how your title and description will look in Google search results, measured in real pixels. See exactly where the snippet gets truncated before you publish.",
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
      "Count single words, two-word and three-word phrases with stopwords filtered out. See actual frequency and percentage, plus which phrases are worth targeting.",
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
      "Measure Flesch Reading Ease, Flesch-Kincaid grade level, sentence length, syllables per word and passive voice. See which sentences are dragging the score down.",
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
      "Build a valid llms.txt file for your site — the plain-text index that tells AI crawlers and assistants what your site actually offers. Runs entirely in your browser.",
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
      "Generate valid JSON-LD structured data for Article, FAQ, HowTo, Product, BreadcrumbList and Organization. Fill in fields, get copy-ready markup that validates.",
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
];

/* =================================================================
   指南
   ================================================================= */
const GUIDES = [
  {
    slug: "meta-description-length",
    h1: "Meta Description Length: What Actually Gets Truncated",
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
footer.site h5{margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-2)}
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
.privacy h4{margin:0 0 7px;font-size:15px}
.privacy p{margin:0;font-size:14.5px;color:var(--ink-2)}
.note{font-size:14px;color:var(--ink-2);border-top:1px solid var(--line);padding-top:16px;margin-top:30px}
`;

/* =================================================================
   结构化数据（沿用工具站已验证的 @graph 模式）
   ================================================================= */
const ORG_ID = `${SITE}/#organization`;
const SITE_ID = `${SITE}/#website`;

const siteNodes = () => [
  {
    "@type": "Organization",
    "@id": ORG_ID,
    name: BRAND,
    url: `${SITE}/`,
    description: "Free browser-based SEO and website auditing tools.",
    email: CONTACT_EMAIL,
  },
  { "@type": "WebSite", "@id": SITE_ID, name: BRAND, url: `${SITE}/`, inLanguage: "en", publisher: { "@id": ORG_ID } },
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

function layout({ title, desc, canonicalPath, body, jsonLd, bodyAttr = "" }) {
  const url = SITE + canonicalPath;
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
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="alternate" type="text/plain" href="${SITE}/llms.txt" title="LLM-friendly index">
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
        <h5>${esc(BRAND)}</h5>
        <p style="margin:0">Free SEO and website auditing tools that run entirely in your browser. Nothing you paste is uploaded or stored.</p>
      </div>
      <div>
        <h5>Tools</h5>
        <ul>
          <li><a href="/tools/"><strong>All tools</strong></a></li>
          ${TOOLS.map((t) => `<li><a href="/tools/${t.slug}">${esc(t.h1)}</a></li>`).join("")}
        </ul>
      </div>
      <div>
        <h5>Guides</h5>
        <ul>
          <li><a href="/guides/"><strong>All guides</strong></a></li>
          ${GUIDES.map((g) => `<li><a href="/guides/${g.slug}">${esc(g.h1)}</a></li>`).join("")}
        </ul>
      </div>
      <div>
        <h5>Site</h5>
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
    <h4>Why “client-side” matters here</h4>
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
  <article>${g.body}</article>
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
          author: { "@id": ORG_ID },
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
  <h2>Who runs this</h2>
  <p>${esc(BRAND)} is an independent site. Questions, bug reports and corrections are welcome — use the <a href="/contact">contact page</a>. Corrections are genuinely appreciated: if a tool here gives you a wrong answer, that is a bug worth knowing about.</p>
</div>`,
    jsonLd: graphOf(
      webPageNode({ p: "/about", title: `About ${BRAND}`, desc: `What ${BRAND} is and what its tools deliberately do not do.` }),
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
    canonicalPath: "/404.html",
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
