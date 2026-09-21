
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
      h += "<!-- title / description -->\n";
      h += "<title>" + title + "</title>\n";
      h += '<meta name="description" content="' + desc + '">\n';
      h += '<meta name="robots" content="' + robots + '">\n';
      if (url) h += '<link rel="canonical" href="' + url + '">\n';
      h += "\n<!-- Open Graph -->\n";
      h += '<meta property="og:type" content="website">\n';
      if (ogT) h += '<meta property="og:title" content="' + ogT + '">\n';
      if (desc) h += '<meta property="og:description" content="' + desc + '">\n';
      if (url) h += '<meta property="og:url" content="' + url + '">\n';
      if (ogI) h += '<meta property="og:image" content="' + ogI + '">\n';
      h += "\n<!-- Twitter -->\n";
      h += '<meta name="twitter:card" content="' + card + '">\n';
      if (site) h += '<meta name="twitter:site" content="' + site + '">\n';
      if (ogT) h += '<meta name="twitter:title" content="' + ogT + '">\n';
      if (desc) h += '<meta name="twitter:description" content="' + desc + '">\n';
      if (ogI) h += '<meta name="twitter:image" content="' + ogI + '">\n';

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
    var lines = src.split(/\r?\n/);
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
    var s = p.replace(/[.+?^(){}[\]\\]/g, "\\$&");
    s = s.replace(/\*/g, ".*");
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
          issues.push(["warn", "Level skipped: " + e.tagName + " “" +
            e.textContent.trim().slice(0, 50) + "” follows H" + prev + "."]);
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
      var sents = t.split(/(?<=[.!?])\s+|\n+/).filter(function (s) { return s.trim().length > 1; });
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

      var passive = (t.match(/\b(is|are|was|were|be|been|being)\s+\w+(ed|en)\b/gi) || []).length;

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
  SEOT._internal = { parseRobots, pickGroup, decide, pathToRe, syllables };

  window.SEOT = SEOT;

  document.addEventListener("DOMContentLoaded", function () {
    var fn = document.body.getAttribute("data-tool");
    if (fn && SEOT[fn]) SEOT[fn]();
  });
})();
