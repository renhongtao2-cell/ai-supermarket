/* ============================================================
   AI SUPERMARKET — front-end logic
   (no dependencies; runs from file:// or any static host)
   ============================================================ */
(function () {
  "use strict";

  /* ---------- tiny helpers ---------- */
  const $  = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const PRICING = {
    free:     { label: "Free",     cls: "free" },
    freemium: { label: "Freemium", cls: "freemium" },
    paid:     { label: "Paid",     cls: "paid" }
  };

  const DEPT_BY_ID = Object.fromEntries(DEPARTMENTS.map(d => [d.id, d]));

  const slugify = s => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "tool";
  const _used = new Set();
  TOOLS.forEach(t => {
    let base = slugify(t.name), s = base;
    if (_used.has(s)) { s = base + "-" + t.dept; let n = 2; while (_used.has(s)) s = base + "-" + t.dept + "-" + n++; }
    _used.add(s); t._slug = s;
  });
  const DEPT_COUNTS = {};
  TOOLS.forEach(t => { DEPT_COUNTS[t.dept] = (DEPT_COUNTS[t.dept] || 0) + 1; });

  const esc = s => String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  const domainOf = url => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };

  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  /* ---------- state ---------- */
  const state = { dept: "all", pricing: new Set(), q: "", sort: "featured" };
  let cart = load("asm-cart", []);          // array of tool names

  /* ---------- rendering ---------- */

  function toolCard(t) {
    const dept = DEPT_BY_ID[t.dept];
    const p = PRICING[t.pricing];
    const inCart = cart.includes(t.name);
    const d = domainOf(t.url);
    return `
    <article class="tool-card">
      <button class="cart-add${inCart ? " on" : ""}" data-tool="${esc(t.name)}"
              aria-label="${inCart ? "Remove from" : "Add to"} my list"
              title="${inCart ? "Remove from my list" : "Save to my list"}">${inCart ? "✓" : "+"}</button>
      <a class="tool-main" href="/tool/${t._slug}">
        <div class="tool-head">
          <span class="tool-logo" style="--dept:${dept.color}">${esc(t.name.charAt(0))}
            <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64"
                 alt="" loading="lazy" onerror="this.remove()">
          </span>
          <div class="tool-id">
            <h3>${esc(t.name)}${t.isNew ? ' <span class="new-pill">NEW</span>' : ""}</h3>
            <span class="pill ${p.cls}">${p.label}</span>
          </div>
        </div>
        <p class="tool-desc">${esc(t.desc)}</p>
      </a>
      <div class="tool-foot">
        <span class="dept-chip" style="--dept:${dept.color}">${dept.icon} ${esc(dept.name)}</span>
        <span class="visit" aria-hidden="true">Details →</span>
      </div>
    </article>`;
  }

  function getFiltered() {
    const q = state.q.trim().toLowerCase();
    let list = TOOLS.filter(t => {
      if (state.dept !== "all" && t.dept !== state.dept) return false;
      if (state.pricing.size && !state.pricing.has(t.pricing)) return false;
      if (!q) return true;
      const dept = DEPT_BY_ID[t.dept];
      const hay = (t.name + " " + t.desc + " " + t.tags.join(" ") + " " + dept.name + " " +
                   t.pricing + " " + PRICING[t.pricing].label).toLowerCase();
      return q.split(/\s+/).every(word => hay.includes(word));
    });
    if (state.sort === "az") list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
    else if (state.sort === "za") list = list.slice().sort((a, b) => b.name.localeCompare(a.name));
    else list = list.slice().sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)); // stable in modern JS
    return list;
  }

  function renderTools() {
    const list = getFiltered();
    const grid = $("#toolGrid");
    grid.innerHTML = list.map(toolCard).join("");
    $("#emptyState").hidden = list.length > 0;
    const deptLabel = state.dept === "all" ? "all departments" : DEPT_BY_ID[state.dept].name;
    $("#resultCount").textContent = `Showing ${list.length} of ${TOOLS.length} tools · ${deptLabel}`;
  }

  function renderDepts() {
    const all = `<a class="dept-item${state.dept === "all" ? " active" : ""}" href="#all">
      <span class="dept-emoji">🏪</span><span class="dept-name">All Departments</span>
      <span class="dept-count">${TOOLS.length}</span></a>`;
    $("#deptList").innerHTML = all + DEPARTMENTS.map(d => `
      <a class="dept-item${state.dept === d.id ? " active" : ""}" href="#${d.id}">
        <span class="dept-emoji">${d.icon}</span><span class="dept-name">${esc(d.name)}</span>
        <span class="dept-count">${DEPT_COUNTS[d.id] || 0}</span>
      </a>`).join("");

    $("#deptGrid").innerHTML = `<a class="dept-card all-card" href="#all">
      <span class="dept-card-icon">🏪</span>
      <h3>All Departments</h3><span class="dept-card-count">${TOOLS.length} tools</span></a>` +
      DEPARTMENTS.map(d => `
      <a class="dept-card" href="departments/${d.id}.html" style="--dept:${d.color}">
        <span class="dept-card-icon">${d.icon}</span>
        <h3>${esc(d.name)}</h3>
        <span class="dept-card-count">${DEPT_COUNTS[d.id] || 0} tools</span>
      </a>`).join("");
  }

  function renderFeatured() {
    const featured = TOOLS.filter(t => t.featured);
    $("#featuredGrid").innerHTML = featured.map(toolCard).join("");
  }

  function renderSamples() {
    const free = TOOLS.filter(t => t.pricing === "free").slice(0, 10);
    $("#sampleChips").innerHTML =
      free.map(t => `<a class="sample-chip" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">${esc(t.name)}</a>`).join("") +
      `<a class="sample-more" href="#all" id="allFreeLink">see all free tools →</a>`;
  }

  function renderFooterDepts() {
    const popular = ["assistants", "marketing", "design", "dev", "video", "productivity", "ecommerce", "education"];
    $("#footerDepts").innerHTML = popular
      .filter(id => DEPT_BY_ID[id])
      .map(id => `<a href="departments/${id}.html">${DEPT_BY_ID[id].icon} ${esc(DEPT_BY_ID[id].name)}</a>`)
      .join("");
  }

  function renderCart() {
    const items = cart.map(name => TOOLS.find(t => t.name === name)).filter(Boolean);
    $("#cartCount").textContent = items.length;
    $("#cartItems").innerHTML = items.length === 0
      ? `<div class="cart-empty"><p>🧺</p><p>Your list is empty.<br>Add tools with the <strong>+</strong> button as you browse.</p></div>`
      : items.map(t => `
        <div class="cart-item">
          <a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">
            <strong>${esc(t.name)}</strong><span>${esc(domainOf(t.url))}</span>
          </a>
          <button class="cart-remove" data-tool="${esc(t.name)}" aria-label="Remove ${esc(t.name)}">✕</button>
        </div>`).join("");
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function showToast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
  }

  /* ---------- cart ---------- */
  function toggleCart(name) {
    const i = cart.indexOf(name);
    if (i >= 0) { cart.splice(i, 1); showToast(`Removed "${name}" from your list`); }
    else { cart.push(name); showToast(`Saved "${name}" to your list 🧺`); }
    save("asm-cart", cart);
    renderCart();
    renderTools();       // refresh +/✓ buttons
    renderFeatured();
  }

  function setCartOpen(open) {
    $("#cartDrawer").classList.toggle("open", open);
    $("#cartDrawer").setAttribute("aria-hidden", String(!open));
    $("#overlay").hidden = !open;
  }

  /* ---------- filters ---------- */
  function syncDeptFromHash(scroll) {
    const id = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (id === "all" || DEPT_BY_ID[id]) {
      state.dept = id;
      renderDepts();
      renderTools();
      if (scroll) $("#browse").scrollIntoView({ behavior: "smooth" });
    }
  }

  function resetFilters() {
    state.dept = "all";
    state.pricing.clear();
    state.q = "";
    $("#searchInput").value = "";
    $("#searchClear").hidden = true;
    $$("#pricingFilters input").forEach(cb => { cb.checked = false; });
    history.replaceState(null, "", "#all");
    renderDepts();
    renderTools();
  }

  /* ---------- events ---------- */

  // search
  let searchTimer = null;
  $("#searchInput").addEventListener("input", e => {
    clearTimeout(searchTimer);
    const value = e.target.value;
    searchTimer = setTimeout(() => {
      state.q = value;
      $("#searchClear").hidden = value.length === 0;
      renderTools();
    }, 120);
  });
  $("#searchClear").addEventListener("click", () => {
    $("#searchInput").value = "";
    state.q = "";
    $("#searchClear").hidden = true;
    renderTools();
    $("#searchInput").focus();
  });

  // "/" focuses search
  document.addEventListener("keydown", e => {
    if (e.key === "/" && document.activeElement !== $("#searchInput")) {
      e.preventDefault();
      $("#searchInput").focus();
    }
    if (e.key === "Escape") setCartOpen(false);
  });

  // sort
  $("#sortSelect").addEventListener("change", e => {
    state.sort = e.target.value;
    renderTools();
  });

  // pricing checkboxes
  $("#pricingFilters").addEventListener("change", e => {
    const cb = e.target;
    if (cb.matches("input[type=checkbox]")) {
      if (cb.checked) state.pricing.add(cb.value); else state.pricing.delete(cb.value);
      renderTools();
    }
  });

  // reset buttons
  $("#clearFilters").addEventListener("click", resetFilters);
  $("#emptyReset").addEventListener("click", resetFilters);

  // department hash navigation (dept cards + sidebar links)
  window.addEventListener("hashchange", () => syncDeptFromHash(true));

  // free samples: "see all free tools"
  $("#sampleChips").addEventListener("click", e => {
    if (e.target.id === "allFreeLink") {
      e.preventDefault();
      state.pricing.clear(); state.pricing.add("free");
      $$("#pricingFilters input").forEach(cb => { cb.checked = cb.value === "free"; });
      history.replaceState(null, "", "#all");
      state.dept = "all"; renderDepts(); renderTools();
      $("#browse").scrollIntoView({ behavior: "smooth" });
    }
  });

  // add/remove from list (delegated)
  document.addEventListener("click", e => {
    const addBtn = e.target.closest(".cart-add");
    if (addBtn) { e.preventDefault(); toggleCart(addBtn.dataset.tool); return; }
    const removeBtn = e.target.closest(".cart-remove");
    if (removeBtn) { toggleCart(removeBtn.dataset.tool); return; }
  });

  // drawer
  $("#cartBtn").addEventListener("click", () => { renderCart(); setCartOpen(true); });
  $("#cartClose").addEventListener("click", () => setCartOpen(false));
  $("#overlay").addEventListener("click", () => setCartOpen(false));
  $("#clearCart").addEventListener("click", () => {
    cart = []; save("asm-cart", cart); renderCart(); renderTools(); renderFeatured();
  });
  $("#copyList").addEventListener("click", () => {
    const items = cart.map(n => TOOLS.find(t => t.name === n)).filter(Boolean);
    if (!items.length) { showToast("Your list is empty"); return; }
    const text = items.map(t => `${t.name} — ${t.url}`).join("\n");
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(() => showToast("List copied to clipboard ✓"))
      .catch(() => showToast("Couldn't copy — sorry!"));
  });

  // theme
  function applyTheme(dark) {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    $("#themeToggle").textContent = dark ? "☀️" : "🌙";
    try { localStorage.setItem("asm-theme", dark ? "dark" : "light"); } catch (e) {}
  }
  $("#themeToggle").addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme !== "dark");
  });

  /* ---------- init ---------- */
  function init() {
    // dynamic stats
    $("#statTools").textContent = TOOLS.length + "+";
    $("#statDepts").textContent = DEPARTMENTS.length;
    $("#year").textContent = new Date().getFullYear();

    // theme icon matches pre-applied theme
    $("#themeToggle").textContent =
      document.documentElement.dataset.theme === "dark" ? "☀️" : "🌙";

    // prefill search from ?q= (works with the SearchAction JSON-LD)
    const q = new URLSearchParams(location.search).get("q");
    if (q) { $("#searchInput").value = q; state.q = q; $("#searchClear").hidden = false; }

    renderDepts();
    renderFeatured();
    renderSamples();
    renderFooterDepts();
    renderCart();
    renderTools();

    // honor an initial hash like #marketing (deep link) without scrolling
    const id = decodeURIComponent(location.hash.replace(/^#/, ""));
    if ((id === "all" || DEPT_BY_ID[id]) && id !== "all") {
      state.dept = id;
      renderDepts();
      renderTools();
    }
  }

  init();
})();
