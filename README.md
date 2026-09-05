# AI Supermarket 🛒

**Every AI tool you need. One store.** — An English-language directory of 200+ AI tools,
organized into 21 industry "departments" so visitors can find and start using the right
tool in one click. Built for the international market.

Live preview (while the local server is running): http://127.0.0.1:8000/

## What's inside

| File | Purpose |
|---|---|
| `index.html` | Single-page site: hero, departments, best sellers, browse, footer |
| `css/style.css` | All styling (light + dark theme, responsive, no framework) |
| `js/data.js` | **The tool database — this is the file you'll edit most** |
| `js/app.js` | Rendering, search, filters, "My List" favorites, theme toggle |

No build step, no backend, no dependencies. It runs by double-clicking `index.html`
(logo images load from Google's favicon service; everything degrades gracefully offline).

## Features

- 🛍️ **21 industry departments** — assistants, marketing, design, video, dev, e-commerce,
  sales, support, HR, finance, legal, healthcare, education, real estate, data, travel,
  gaming, manufacturing, agriculture and more
- 🔍 **Instant search** across names, descriptions and tags (also accepts `?q=` parameter)
- 🏷️ **Filters & sort** — by department, by pricing (Free / Freemium / Paid), A→Z sort
- 🏆 **Best Sellers** shelf + 🎁 **Free Samples** strip (supermarket merchandising)
- 🧺 **My List** — visitors save tools to a shopping list (stored in localStorage)
- 🌙 **Dark / light theme** (respects system preference), fully responsive, SEO basics
  (meta tags, Open Graph, JSON-LD SearchAction)

## Run locally

```bash
# from this folder — any static server works
py -m http.server 8000
# then open http://127.0.0.1:8000/
```

(On this machine use `py`, not `python` — the `python` on PATH is a broken alias.)

## Deploy (free options)

The site is 100% static — drag-and-drop or connect the repo:

- **Netlify** — drag the folder onto https://app.netlify.com/drop
- **Vercel** — `npx vercel` in this folder
- **Cloudflare Pages** — create a Pages project, upload the folder
- **GitHub Pages** — push to a repo, enable Pages on the root

After deploying, point your domain at it and update the two placeholder URLs in
`index.html` (the JSON-LD `"url"` and SearchAction `target`, currently
`https://aisupermarket.com/`) plus the `mailto:` addresses.

## How to add / edit a tool

Open `js/data.js` and copy any line in the `TOOLS` array:

```js
{ name: "NewTool", url: "https://newtool.com", dept: "marketing",
  pricing: "freemium", isNew: true, desc: "One clear sentence about it.",
  tags: ["ads", "copywriting"] },
```

- `dept` must match one of the ids at the top of the file (add a new department there
  and the whole UI picks it up automatically — cards, sidebar, counts)
- `pricing`: `free` | `freemium` | `paid`
- `featured: true` puts it on the Best Sellers shelf; `isNew: true` shows a NEW badge
- Logos are fetched automatically from each site's favicon — nothing to upload

Suggested maintenance: review links quarterly and rotate the `featured` flags so the
Best Sellers shelf stays fresh.

## Roadmap ideas

1. Submit-a-tool form (replace the mailto link with Formspree/Tally)
2. Tool detail pages (or modals) with screenshots, pros/cons, alternatives
3. Chinese version (`zh` folder) sharing the same `data.js`
4. "Use it now" phase 2: unified chat-style access to tools via API keys
5. Analytics (Plausible/Umami) to see which departments convert best
