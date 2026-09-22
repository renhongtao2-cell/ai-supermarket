
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
  /* ---------- 7. llms.txt Generator ---------- */
  SEOT.llmsGen = function () {
    bind(["lt-name", "lt-sum", "lt-notes", "lt-rows", "lt-head", "lt-abs"], function () {
      var name = txt("lt-name").trim();
      var sum = txt("lt-sum").trim();
      var notes = txt("lt-notes").trim();
      var rows = txt("lt-rows").split(/\n+/).map(function (r) { return r.trim(); }).filter(Boolean);
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
          var loc = abs && /^https?:\/\//i.test(it.path) ? it.path : it.path;
          L.push("- [" + it.title + "](" + loc + ")" + (it.desc ? ": " + it.desc : ""));
        });
        L.push("");
      }
      if (notes) {
        L.push("## Notes for automated readers");
        L.push(notes);
        L.push("");
      }

      var body = L.join("\n");
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

  var isoOk = function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); };

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
        var steps = txt("sc-steps").split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
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
        else if (!/^\d+(\.\d+)?$/.test(price)) problems.push("price should be a number with no currency symbol");
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
        var trail = txt("sc-items").split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean)
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
      if (!/^https?:\/\//i.test(fixed)) {
        fixed = "https://" + fixed.replace(/^\/+/, "");
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
        if (/\s/.test(v)) warns.push("utm_" + k + " contains a space. Use hyphens or underscores instead.");
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
      var hm = url.match(/^https?:\/\/([^\/]+)/);
      if (hm) host = hm[1];
      else if (url) host = url;

      var abs = /^https?:\/\//i.test(img);
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
        } else if (/^http:\/\//i.test(img)) {
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
      tags += "<!-- Open Graph -->\n";
      tags += '<meta property="og:type" content="website">\n';
      if (title) tags += '<meta property="og:title" content="' + title + '">\n';
      if (desc) tags += '<meta property="og:description" content="' + desc + '">\n';
      if (url) tags += '<meta property="og:url" content="' + url + '">\n';
      if (img) tags += '<meta property="og:image" content="' + img + '">\n';
      if (img && w) tags += '<meta property="og:image:width" content="' + w + '">\n';
      if (img && h) tags += '<meta property="og:image:height" content="' + h + '">\n';
      if (site) tags += '<meta property="og:site_name" content="' + site + '">\n';
      tags += "\n<!-- Twitter -->\n";
      tags += '<meta name="twitter:card" content="' + card + '">\n';
      if (tw) tags += '<meta name="twitter:site" content="' + tw + '">\n';
      if (title) tags += '<meta name="twitter:title" content="' + title + '">\n';
      if (desc) tags += '<meta name="twitter:description" content="' + desc + '">\n';
      if (img) tags += '<meta name="twitter:image" content="' + img + '">\n';

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
    ).split(/\s+/);
    var set = {};
    list.forEach(function (c) { set[c] = 1; });
    return set;
  })();
  // 语言小写、可选脚本子标签（Hans/Hant 等）、可选地区（2 字母大写或 3 位数字，如 es-419）
  var LANG_RE = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$/;

  SEOT.hreflangGen = function () {
    bind(["hl-rows", "hl-def", "hl-fmt"], function () {
      var raw = txt("hl-rows").split(/\n+/).map(function (r) { return r.trim(); }).filter(Boolean);
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
        var parts = line.indexOf("|") >= 0 ? line.split("|") : line.split(/\s+/);
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

        if (!/^https?:\/\//i.test(href)) {
          issues.push(["bad", "Line " + (i + 1) + ": " + href + " is not an absolute URL. hreflang targets must be complete URLs including the scheme."]);
        } else if (/^http:\/\//i.test(href)) {
          issues.push(["warn", "Line " + (i + 1) + ": " + href + " is http, not https."]);
        }
        if (seenUrl[href]) {
          issues.push(["warn", href + " is used for more than one language. That is usually a geo-redirect setup, which hreflang cannot express — each language needs its own URL."]);
        }
        seenUrl[href] = 1;

        rows.push({ code: code, href: href });
      });

      if (def && !/^https?:\/\//i.test(def)) {
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
        }).join(",\n      ") + "\n";
      } else if (fmt === "sitemap") {
        var block = cluster.map(function (r) {
          return '  <xhtml:link rel="alternate" hreflang="' + r.code + '" href="' + r.href + '"/>';
        }).join("\n");
        // 站点地图里每个 URL 都要带完整集群（含自己），所以每个语言版本各出一个 <url> 块
        code = '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
          '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
          rows.map(function (r) {
            return "<url>\n  <loc>" + r.href + "</loc>\n" + block + "\n</url>";
          }).join("\n") +
          "\n</urlset>\n";
      } else {
        cluster.forEach(function (r) {
          code += '<link rel="alternate" hreflang="' + r.code + '" href="' + r.href + '">\n';
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
