/* ============================================================
   AI SUPERMARKET — TOOL DATABASE
   ------------------------------------------------------------
   How to add a tool: copy one line below and edit it.
   Fields:
     name    — display name
     url     — official website (https://)
     dept    — department id (must exist in DEPARTMENTS below)
     pricing — "free" | "freemium" | "paid"
     desc    — one-line description shown on the card
     tags    — extra words users can search by
     featured— optional; true = appears in Best Sellers
     isNew   — optional; true = shows a NEW badge
   ============================================================ */

const DEPARTMENTS = [
  { id: "assistants",   name: "AI Assistants",     icon: "🤖", color: "#6366f1" },
  { id: "writing",      name: "Writing & Content", icon: "✍️", color: "#0ea5e9" },
  { id: "marketing",    name: "Marketing & SEO",   icon: "📣", color: "#f97316" },
  { id: "design",       name: "Design & Art",      icon: "🎨", color: "#ec4899" },
  { id: "video",        name: "Video & Audio",     icon: "🎬", color: "#ef4444" },
  { id: "dev",          name: "Software & Dev",    icon: "💻", color: "#22c55e" },
  { id: "productivity", name: "Productivity",      icon: "⚡", color: "#8b5cf6" },
  { id: "ecommerce",    name: "E-commerce",        icon: "🛍️", color: "#14b8a6" },
  { id: "sales",        name: "Sales & CRM",       icon: "📈", color: "#ca8a04" },
  { id: "support",      name: "Customer Support",  icon: "🎧", color: "#06b6d4" },
  { id: "hr",           name: "HR & Recruiting",   icon: "🧑‍💼", color: "#a855f7" },
  { id: "finance",      name: "Finance & Accounting", icon: "💰", color: "#059669" },
  { id: "legal",        name: "Legal",             icon: "⚖️", color: "#64748b" },
  { id: "health",       name: "Healthcare",        icon: "🩺", color: "#f43f5e" },
  { id: "education",    name: "Education",         icon: "🎓", color: "#3b82f6" },
  { id: "realestate",   name: "Real Estate",       icon: "🏠", color: "#d97706" },
  { id: "data",         name: "Data & Analytics",  icon: "📊", color: "#0891b2" },
  { id: "travel",       name: "Travel",            icon: "✈️", color: "#2dd4bf" },
  { id: "gaming",       name: "Gaming",            icon: "🎮", color: "#9333ea" },
  { id: "manufacturing",name: "Manufacturing",     icon: "🏭", color: "#475569" },
  { id: "agriculture",  name: "Agriculture",       icon: "🌾", color: "#65a30d" }
];

const TOOLS = [

  /* ---------- AI ASSISTANTS ---------- */
  { name: "ChatGPT",           url: "https://chatgpt.com",                dept: "assistants", pricing: "freemium", featured: true, desc: "OpenAI's conversational assistant for writing, coding, analysis and images.", tags: ["chatbot", "gpt", "openai"] },
  { name: "Claude",            url: "https://claude.ai",                  dept: "assistants", pricing: "freemium", featured: true, desc: "Anthropic's assistant known for long-document analysis and high-quality writing.", tags: ["chatbot", "anthropic", "reasoning"] },
  { name: "Google Gemini",     url: "https://gemini.google.com",          dept: "assistants", pricing: "freemium", desc: "Google's multimodal AI built into Search, Workspace and Android.", tags: ["chatbot", "google", "multimodal"] },
  { name: "Microsoft Copilot", url: "https://copilot.microsoft.com",      dept: "assistants", pricing: "freemium", desc: "AI assistant for Windows, Edge and Microsoft 365 apps.", tags: ["chatbot", "office", "windows"] },
  { name: "Perplexity",        url: "https://www.perplexity.ai",          dept: "assistants", pricing: "freemium", featured: true, desc: "AI answer engine that searches the live web and cites its sources.", tags: ["search", "research", "answers"] },
  { name: "Grok",              url: "https://grok.com",                   dept: "assistants", pricing: "freemium", isNew: true, desc: "xAI's chatbot with real-time X data and a rebel streak.", tags: ["chatbot", "xai", "twitter"] },
  { name: "Meta AI",           url: "https://www.meta.ai",                dept: "assistants", pricing: "free", desc: "Free assistant across WhatsApp, Instagram, Facebook and the web.", tags: ["chatbot", "meta", "social"] },
  { name: "Poe",               url: "https://poe.com",                    dept: "assistants", pricing: "freemium", desc: "One app to chat with GPT, Claude, Gemini and many more models.", tags: ["chatbot", "aggregator", "models"] },
  { name: "DeepSeek",          url: "https://chat.deepseek.com",          dept: "assistants", pricing: "free", isNew: true, desc: "Powerful open-source models with a free web chat.", tags: ["chatbot", "open source", "reasoning"] },
  { name: "Mistral Le Chat",   url: "https://chat.mistral.ai",            dept: "assistants", pricing: "freemium", desc: "Fast European assistant with web search, code and image understanding.", tags: ["chatbot", "eu", "open source"] },

  /* ---------- WRITING & CONTENT ---------- */
  { name: "Grammarly",      url: "https://www.grammarly.com",    dept: "writing", pricing: "freemium", featured: true, desc: "Real-time grammar, clarity and tone suggestions everywhere you type.", tags: ["grammar", "editing", "english"] },
  { name: "QuillBot",       url: "https://quillbot.com",         dept: "writing", pricing: "freemium", desc: "Paraphraser, summarizer and grammar checker trusted by students.", tags: ["paraphrase", "summarize", "students"] },
  { name: "Rytr",           url: "https://rytr.me",              dept: "writing", pricing: "freemium", desc: "Quick, affordable AI writer for 40+ use cases and tones.", tags: ["copywriting", "blog", "ai writer"] },
  { name: "Wordtune",       url: "https://www.wordtune.com",     dept: "writing", pricing: "freemium", desc: "Rewrites sentences for clarity, tone and length.", tags: ["rewrite", "editing", "tone"] },
  { name: "Sudowrite",      url: "https://www.sudowrite.com",    dept: "writing", pricing: "paid", desc: "Creative writing partner for novelists — describe, brainstorm, draft.", tags: ["fiction", "novel", "story"] },
  { name: "HyperWrite",     url: "https://www.hyperwriteai.com", dept: "writing", pricing: "freemium", desc: "AI writer with web research, citations and a browser assistant.", tags: ["writing", "research", "agent"] },
  { name: "Writer",         url: "https://writer.com",           dept: "writing", pricing: "paid", desc: "Enterprise generative AI platform with brand and style guardrails.", tags: ["enterprise", "brand", "teams"] },
  { name: "Originality.ai", url: "https://originality.ai",       dept: "writing", pricing: "paid", desc: "AI-content detection and plagiarism scanning for publishers.", tags: ["detection", "plagiarism", "seo"] },
  { name: "Hemingway",      url: "https://hemingwayapp.com",     dept: "writing", pricing: "free", desc: "Editor that makes your writing bold and clear, with AI rewriting.", tags: ["editing", "readability", "clarity"] },

  /* ---------- MARKETING & SEO ---------- */
  { name: "Jasper",         url: "https://www.jasper.ai",       dept: "marketing", pricing: "paid", featured: true, desc: "Brand-trained AI copywriter for blogs, ads and campaigns at scale.", tags: ["copywriting", "ads", "brand"] },
  { name: "Copy.ai",        url: "https://www.copy.ai",         dept: "marketing", pricing: "freemium", desc: "Generate marketing copy and automate go-to-market workflows.", tags: ["copywriting", "gtm", "automation"] },
  { name: "Surfer SEO",     url: "https://surferseo.com",       dept: "marketing", pricing: "paid", desc: "Data-driven content optimization to rank higher on Google.", tags: ["seo", "content", "ranking"] },
  { name: "Semrush",        url: "https://www.semrush.com",     dept: "marketing", pricing: "paid", desc: "All-in-one SEO suite with AI keyword and content tools.", tags: ["seo", "keywords", "analytics"] },
  { name: "AdCreative.ai",  url: "https://www.adcreative.ai",   dept: "marketing", pricing: "paid", desc: "Generate conversion-focused ad creatives and banners automatically.", tags: ["ads", "creatives", "banners"] },
  { name: "HubSpot",        url: "https://www.hubspot.com",     dept: "marketing", pricing: "freemium", featured: true, desc: "CRM platform with embedded AI for content, prospecting and support.", tags: ["crm", "inbound", "breeze"] },
  { name: "MarketMuse",     url: "https://www.marketmuse.com",  dept: "marketing", pricing: "paid", desc: "AI content planning and briefs built on topical authority.", tags: ["seo", "planning", "briefs"] },
  { name: "Writesonic",     url: "https://writesonic.com",      dept: "marketing", pricing: "freemium", desc: "SEO-friendly article writer and chatbot with live web data.", tags: ["articles", "seo", "chatbot"] },
  { name: "Anyword",        url: "https://anyword.com",         dept: "marketing", pricing: "paid", desc: "Copywriting AI that predicts performance before you publish.", tags: ["copywriting", "prediction", "ads"] },
  { name: "Scalenut",       url: "https://www.scalenut.com",    dept: "marketing", pricing: "freemium", desc: "SEO content lifecycle — research, write, optimize, publish.", tags: ["seo", "articles", "optimization"] },
  { name: "Predis.ai",      url: "https://predis.ai",           dept: "marketing", pricing: "freemium", desc: "Social media posts, carousels and videos from a single prompt.", tags: ["social", "instagram", "content"] },

  /* ---------- DESIGN & ART ---------- */
  { name: "Midjourney",         url: "https://www.midjourney.com",        dept: "design", pricing: "paid", featured: true, desc: "Best-in-class AI art generator with a distinctive aesthetic.", tags: ["images", "art", "illustration"] },
  { name: "DALL·E 3",           url: "https://openai.com/dall-e-3",       dept: "design", pricing: "freemium", desc: "OpenAI's image generator built into ChatGPT.", tags: ["images", "openai", "art"] },
  { name: "Adobe Firefly",      url: "https://firefly.adobe.com",         dept: "design", pricing: "freemium", desc: "Commercially-safe image and design generation inside Adobe apps.", tags: ["images", "adobe", "photoshop"] },
  { name: "Canva Magic Studio", url: "https://www.canva.com",             dept: "design", pricing: "freemium", featured: true, desc: "Design suite with AI writing, image generation and layout magic.", tags: ["design", "presentations", "templates"] },
  { name: "Figma AI",           url: "https://www.figma.com",             dept: "design", pricing: "freemium", desc: "AI assistance for UI design, prototypes and copy in Figma.", tags: ["ui", "ux", "prototyping"] },
  { name: "Framer AI",          url: "https://www.framer.com",            dept: "design", pricing: "freemium", desc: "Design and publish AI-generated websites in minutes.", tags: ["website", "no-code", "publish"] },
  { name: "Uizard",             url: "https://uizard.io",                 dept: "design", pricing: "freemium", desc: "Turn sketches and prompts into editable app mockups.", tags: ["wireframe", "mockup", "app"] },
  { name: "Looka",              url: "https://looka.com",                 dept: "design", pricing: "paid", desc: "AI logo maker and full brand kit for new businesses.", tags: ["logo", "branding", "startup"] },
  { name: "Ideogram",           url: "https://ideogram.ai",               dept: "design", pricing: "freemium", desc: "Text-to-image generator that nails typography and logos.", tags: ["images", "typography", "logo"] },
  { name: "Leonardo.Ai",        url: "https://leonardo.ai",               dept: "design", pricing: "freemium", desc: "Game-asset and creative image generation with fine control.", tags: ["game assets", "images", "art"] },
  { name: "Stable Diffusion",   url: "https://stability.ai",              dept: "design", pricing: "free", desc: "Open-source image model you can run and fine-tune anywhere.", tags: ["open source", "images", "self-hosted"] },
  { name: "Kittl",              url: "https://www.kittl.com",             dept: "design", pricing: "freemium", desc: "AI-powered design platform for logos, tees and print.", tags: ["logo", "print", "merch"] },
  { name: "Recraft",            url: "https://www.recraft.ai",            dept: "design", pricing: "freemium", isNew: true, desc: "Vector-native AI art for brand illustrations and icons.", tags: ["vector", "icons", "svg"] },

  /* ---------- VIDEO & AUDIO ---------- */
  { name: "Runway",       url: "https://runwayml.com",        dept: "video", pricing: "freemium", featured: true, desc: "Pro AI video suite — text-to-video, inpainting and motion tools.", tags: ["video", "gen-3", "editing"] },
  { name: "Pika",         url: "https://pika.art",            dept: "video", pricing: "freemium", desc: "Fun text and image-to-video generator for social creators.", tags: ["video", "animation", "social"] },
  { name: "Sora",         url: "https://openai.com/sora",     dept: "video", pricing: "paid", isNew: true, desc: "OpenAI's flagship text-to-video model inside ChatGPT.", tags: ["video", "openai", "generation"] },
  { name: "Synthesia",    url: "https://www.synthesia.io",    dept: "video", pricing: "freemium", desc: "Studio-quality AI avatar videos from a script in 140+ languages.", tags: ["avatar", "training", "localization"] },
  { name: "HeyGen",       url: "https://www.heygen.com",      dept: "video", pricing: "freemium", desc: "AI avatars and video translation with perfect lip-sync.", tags: ["avatar", "translation", "spokesperson"] },
  { name: "Descript",     url: "https://www.descript.com",    dept: "video", pricing: "freemium", desc: "Edit video and podcasts by editing the transcript.", tags: ["podcast", "editing", "transcription"] },
  { name: "ElevenLabs",   url: "https://elevenlabs.io",       dept: "video", pricing: "freemium", featured: true, desc: "Ultra-realistic AI voices, dubbing and voice cloning.", tags: ["voice", "tts", "dubbing"] },
  { name: "Murf AI",      url: "https://murf.ai",             dept: "video", pricing: "freemium", desc: "Studio voiceovers from text for videos and presentations.", tags: ["voice", "tts", "voiceover"] },
  { name: "Suno",         url: "https://suno.com",            dept: "video", pricing: "freemium", featured: true, isNew: true, desc: "Generate full songs with vocals from a text prompt.", tags: ["music", "songs", "audio"] },
  { name: "Udio",         url: "https://www.udio.com",        dept: "video", pricing: "freemium", desc: "AI music creation for songs, remixes and soundtracks.", tags: ["music", "songs", "remix"] },
  { name: "Opus Clip",    url: "https://www.opus.pro",        dept: "video", pricing: "freemium", desc: "Turn long videos into viral short clips automatically.", tags: ["shorts", "tiktok", "repurposing"] },
  { name: "Topaz Video AI", url: "https://www.topazlabs.com", dept: "video", pricing: "paid", desc: "Upscale, denoise and stabilize footage to pro quality.", tags: ["upscale", "restoration", "4k"] },
  { name: "CapCut",       url: "https://www.capcut.com",      dept: "video", pricing: "freemium", desc: "Free video editor packed with AI captions and effects.", tags: ["editing", "mobile", "captions"] },
  { name: "LALAL.AI",     url: "https://www.lalal.ai",        dept: "video", pricing: "freemium", desc: "AI stem splitter — isolate vocals and instruments cleanly.", tags: ["audio", "stems", "music"] },

  /* ---------- SOFTWARE & DEV ---------- */
  { name: "GitHub Copilot",     url: "https://github.com/features/copilot", dept: "dev", pricing: "freemium", featured: true, desc: "AI pair programmer inline in your editor and terminal.", tags: ["coding", "autocomplete", "github"] },
  { name: "Cursor",             url: "https://cursor.com",                  dept: "dev", pricing: "freemium", isNew: true, desc: "AI-first code editor with codebase-aware chat and agents.", tags: ["ide", "coding", "agent"] },
  { name: "Windsurf",           url: "https://windsurf.com",                dept: "dev", pricing: "freemium", desc: "Agentic IDE that builds features alongside you end to end.", tags: ["ide", "coding", "agent"] },
  { name: "Replit",             url: "https://replit.com",                  dept: "dev", pricing: "freemium", desc: "Build, run and deploy apps with AI agents in the browser.", tags: ["ide", "cloud", "deploy"] },
  { name: "Tabnine",            url: "https://www.tabnine.com",             dept: "dev", pricing: "freemium", desc: "Private, trainable code completion for teams.", tags: ["coding", "privacy", "enterprise"] },
  { name: "Amazon Q Developer", url: "https://aws.amazon.com/q/developer/", dept: "dev", pricing: "freemium", desc: "AWS coding assistant for building, debugging and operating apps.", tags: ["aws", "cloud", "coding"] },
  { name: "v0",                 url: "https://v0.dev",                      dept: "dev", pricing: "freemium", desc: "Generate production-ready React and Tailwind UI from prompts.", tags: ["ui", "react", "frontend"] },
  { name: "Bolt.new",           url: "https://bolt.new",                    dept: "dev", pricing: "freemium", isNew: true, desc: "Prompt, run and deploy full-stack web apps in the browser.", tags: ["fullstack", "no-code", "apps"] },
  { name: "Lovable",            url: "https://lovable.dev",                 dept: "dev", pricing: "freemium", isNew: true, desc: "Describe an app in chat and get a working full-stack product.", tags: ["app builder", "fullstack", "no-code"] },
  { name: "Cody",               url: "https://sourcegraph.com/cody",        dept: "dev", pricing: "freemium", desc: "Codebase-aware AI chat and search for large repositories.", tags: ["coding", "chat", "codebase"] },
  { name: "Phind",              url: "https://www.phind.com",               dept: "dev", pricing: "freemium", desc: "Developer search engine with technical, cited answers.", tags: ["search", "coding", "answers"] },
  { name: "JetBrains AI",       url: "https://www.jetbrains.com/ai/",       dept: "dev", pricing: "freemium", desc: "AI assistance built into IntelliJ, PyCharm and other IDEs.", tags: ["ide", "coding", "intellij"] },

  /* ---------- PRODUCTIVITY ---------- */
  { name: "Notion AI",         url: "https://www.notion.com",       dept: "productivity", pricing: "freemium", featured: true, desc: "Q&A, writing and autofill across your workspace docs and wikis.", tags: ["notes", "wiki", "workspace"] },
  { name: "Otter.ai",          url: "https://otter.ai",             dept: "productivity", pricing: "freemium", desc: "Meeting transcripts and summaries for Zoom, Meet and Teams.", tags: ["meetings", "transcription", "notes"] },
  { name: "Fireflies.ai",      url: "https://fireflies.ai",         dept: "productivity", pricing: "freemium", desc: "AI notetaker with searchable meeting transcripts and insights.", tags: ["meetings", "transcription", "crm"] },
  { name: "ClickUp Brain",     url: "https://clickup.com",          dept: "productivity", pricing: "freemium", desc: "AI for tasks, docs and project updates in one workspace.", tags: ["tasks", "projects", "docs"] },
  { name: "Asana AI",          url: "https://asana.com",            dept: "productivity", pricing: "freemium", desc: "Smart goals, status updates and workflow automation.", tags: ["tasks", "projects", "teams"] },
  { name: "Slack AI",          url: "https://slack.com",            dept: "productivity", pricing: "freemium", desc: "Search answers and channel recaps inside Slack.", tags: ["chat", "workplace", "summaries"] },
  { name: "Zoom AI Companion", url: "https://www.zoom.us",          dept: "productivity", pricing: "freemium", desc: "Meeting summaries, chat compose and whiteboard assistance.", tags: ["meetings", "summaries", "video calls"] },
  { name: "Superhuman",        url: "https://superhuman.com",       dept: "productivity", pricing: "paid", desc: "The fastest email experience, now with AI triage and drafting.", tags: ["email", "gmail", "speed"] },
  { name: "Gamma",             url: "https://gamma.app",            dept: "productivity", pricing: "freemium", desc: "Generate polished decks, docs and websites from one prompt.", tags: ["presentations", "slides", "decks"] },
  { name: "Beautiful.ai",      url: "https://www.beautiful.ai",     dept: "productivity", pricing: "paid", desc: "Smart templates that auto-design your slides as you type.", tags: ["presentations", "slides", "design"] },
  { name: "Zapier",            url: "https://zapier.com",           dept: "productivity", pricing: "freemium", desc: "Automate 7,000+ apps with AI-built workflows and agents.", tags: ["automation", "integrations", "workflows"] },
  { name: "Make",              url: "https://www.make.com",         dept: "productivity", pricing: "freemium", desc: "Visual automation platform with AI scenario builders.", tags: ["automation", "integrations", "no-code"] },
  { name: "Bardeen",           url: "https://www.bardeen.ai",       dept: "productivity", pricing: "freemium", desc: "AI browser automation for repetitive sales and GTM work.", tags: ["browser", "automation", "scraper"] },
  { name: "Reclaim.ai",        url: "https://reclaim.ai",           dept: "productivity", pricing: "freemium", desc: "AI calendar scheduling, habits and meeting defense.", tags: ["calendar", "scheduling", "time"] },
  { name: "Motion",            url: "https://www.usemotion.com",    dept: "productivity", pricing: "paid", desc: "AI project manager that plans your day automatically.", tags: ["calendar", "tasks", "planning"] },

  /* ---------- E-COMMERCE ---------- */
  { name: "Shopify Magic",  url: "https://www.shopify.com",    dept: "ecommerce", pricing: "freemium", featured: true, desc: "AI product copy, chat and store setup built into Shopify.", tags: ["store", "product copy", "shopify"] },
  { name: "Algolia",        url: "https://www.algolia.com",    dept: "ecommerce", pricing: "freemium", desc: "AI-powered site search and recommendations for online stores.", tags: ["search", "recommendations", "site"] },
  { name: "Bloomreach",     url: "https://www.bloomreach.com", dept: "ecommerce", pricing: "paid", desc: "Personalization, search and marketing automation for e-commerce.", tags: ["personalization", "search", "cdp"] },
  { name: "ViSenze",        url: "https://www.visenze.com",    dept: "ecommerce", pricing: "paid", desc: "Visual AI for product discovery, tagging and smart search.", tags: ["visual search", "tagging", "retail"] },
  { name: "Syte",           url: "https://syte.ai",            dept: "ecommerce", pricing: "paid", desc: "Visual search and discovery for fashion and retail brands.", tags: ["visual search", "fashion", "discovery"] },
  { name: "Perfect Corp",   url: "https://www.perfectcorp.com",dept: "ecommerce", pricing: "paid", desc: "Virtual try-on for makeup, hair colors and eyewear.", tags: ["try-on", "beauty", "ar"] },
  { name: "Clerk.io",       url: "https://clerk.io",           dept: "ecommerce", pricing: "paid", desc: "AI search, recommendations and email personalization for shops.", tags: ["search", "recommendations", "email"] },
  { name: "Yotpo",          url: "https://www.yotpo.com",      dept: "ecommerce", pricing: "paid", desc: "AI-powered reviews, SMS marketing and loyalty for DTC brands.", tags: ["reviews", "loyalty", "sms"] },

  /* ---------- SALES & CRM ---------- */
  { name: "Salesforce Einstein", url: "https://www.salesforce.com", dept: "sales", pricing: "paid", desc: "AI predictions, copilots and agents across Salesforce clouds.", tags: ["crm", "enterprise", "agents"] },
  { name: "Apollo.io",           url: "https://www.apollo.io",      dept: "sales", pricing: "freemium", desc: "B2B contact database plus AI sequencing and email writing.", tags: ["prospecting", "leads", "sequences"] },
  { name: "Clay",                url: "https://www.clay.com",       dept: "sales", pricing: "freemium", isNew: true, desc: "Waterfall data enrichment powered by AI research agents.", tags: ["enrichment", "outbound", "prospecting"] },
  { name: "Gong",                url: "https://www.gong.io",        dept: "sales", pricing: "paid", desc: "Revenue intelligence from calls, emails and deal activity.", tags: ["calls", "analytics", "revenue"] },
  { name: "Outreach",            url: "https://www.outreach.io",    dept: "sales", pricing: "paid", desc: "Sales execution platform with AI deal and pipeline assistance.", tags: ["sequences", "pipeline", "enterprise"] },
  { name: "Regie.ai",            url: "https://www.regie.ai",       dept: "sales", pricing: "freemium", desc: "AI prospecting — sequences, emails and call scripts that convert.", tags: ["sequences", "email", "sdr"] },
  { name: "Lavender",            url: "https://www.lavender.ai",    dept: "sales", pricing: "freemium", desc: "AI email coach that helps reps write better, faster.", tags: ["email", "coaching", "reply rates"] },
  { name: "Seamless.AI",         url: "https://seamless.ai",        dept: "sales", pricing: "paid", desc: "Real-time contact and company data for prospecting.", tags: ["leads", "contacts", "b2b"] },
  { name: "ZoomInfo",            url: "https://www.zoominfo.com",   dept: "sales", pricing: "paid", desc: "B2B intelligence with AI-powered buying signals.", tags: ["leads", "intent", "b2b"] },

  /* ---------- CUSTOMER SUPPORT ---------- */
  { name: "Intercom Fin",  url: "https://www.intercom.com",   dept: "support", pricing: "paid", desc: "AI agent that resolves customer chats using your content.", tags: ["chatbot", "helpdesk", "resolution"] },
  { name: "Zendesk AI",    url: "https://www.zendesk.com",    dept: "support", pricing: "paid", desc: "Intelligent triage, bots and an agent copilot for tickets.", tags: ["helpdesk", "tickets", "bots"] },
  { name: "Freddy AI",     url: "https://www.freshworks.com", dept: "support", pricing: "freemium", desc: "Copilot and self-service bots for Freshdesk support teams.", tags: ["helpdesk", "bots", "copilot"] },
  { name: "Tidio Lyro",    url: "https://www.tidio.com",      dept: "support", pricing: "freemium", desc: "Small-business chatbot that answers from your knowledge base.", tags: ["chatbot", "smb", "live chat"] },
  { name: "Drift",         url: "https://www.drift.com",      dept: "support", pricing: "paid", desc: "Conversational marketing and sales chatbots for B2B sites.", tags: ["chatbot", "b2b", "conversions"] },
  { name: "Ada",           url: "https://www.ada.cx",         dept: "support", pricing: "paid", desc: "No-code AI agents for automated customer service at scale.", tags: ["chatbot", "automation", "enterprise"] },
  { name: "Forethought",   url: "https://www.forethought.ai", dept: "support", pricing: "paid", desc: "AI that deflects, triages and assists support tickets.", tags: ["tickets", "deflection", "ai agent"] },
  { name: "Chatbase",      url: "https://www.chatbase.co",    dept: "support", pricing: "freemium", desc: "Build a custom support chatbot from your docs in minutes.", tags: ["chatbot", "docs", "embed"] },
  { name: "Voiceflow",     url: "https://www.voiceflow.com",  dept: "support", pricing: "freemium", desc: "Design, build and deploy chat and voice AI agents.", tags: ["agents", "chatbot", "voice"] },
  { name: "LivePerson",    url: "https://www.liveperson.com", dept: "support", pricing: "paid", desc: "Conversational AI for large-scale brand messaging.", tags: ["messaging", "enterprise", "bots"] },

  /* ---------- HR & RECRUITING ---------- */
  { name: "HireVue",      url: "https://www.hirevue.com",     dept: "hr", pricing: "paid", desc: "AI video interviewing and assessments for hiring at scale.", tags: ["interview", "assessments", "hiring"] },
  { name: "Paradox Olivia", url: "https://www.paradox.ai",    dept: "hr", pricing: "paid", desc: "Conversational hiring assistant for screening and scheduling.", tags: ["chatbot", "scheduling", "screening"] },
  { name: "Eightfold AI", url: "https://eightfold.ai",        dept: "hr", pricing: "paid", desc: "Talent intelligence for skills-based hiring and internal mobility.", tags: ["talent", "skills", "enterprise"] },
  { name: "Phenom",       url: "https://www.phenom.com",      dept: "hr", pricing: "paid", desc: "Candidate experience, CRM and interview scheduling with AI.", tags: ["crm", "candidates", "enterprise"] },
  { name: "SeekOut",      url: "https://www.seekout.com",     dept: "hr", pricing: "paid", desc: "Talent search and diversity hiring with AI insights.", tags: ["sourcing", "diversity", "recruiting"] },
  { name: "Textio",       url: "https://textio.com",          dept: "hr", pricing: "paid", desc: "Inclusive language and unbiased job-post optimization.", tags: ["language", "bias", "job posts"] },
  { name: "Manatal",      url: "https://www.manatal.com",     dept: "hr", pricing: "paid", desc: "Affordable applicant tracking with AI candidate recommendations.", tags: ["ats", "recruiting", "smb"] },
  { name: "LinkedIn AI",  url: "https://www.linkedin.com",    dept: "hr", pricing: "freemium", desc: "AI-assisted sourcing, outreach and profile writing.", tags: ["network", "sourcing", "jobs"] },

  /* ---------- FINANCE ---------- */
  { name: "Digits",     url: "https://digits.com",        dept: "finance", pricing: "paid", desc: "AI accounting platform for modern businesses.", tags: ["accounting", "bookkeeping", "reports"] },
  { name: "Truewind",   url: "https://www.truewind.ai",   dept: "finance", pricing: "paid", desc: "AI-powered bookkeeping and finance back office.", tags: ["bookkeeping", "startup", "cfo"] },
  { name: "Pilot",      url: "https://pilot.com",         dept: "finance", pricing: "paid", desc: "Bookkeeping, taxes and CFO advice for growing startups.", tags: ["bookkeeping", "taxes", "startup"] },
  { name: "Ramp",       url: "https://ramp.com",          dept: "finance", pricing: "free", desc: "Spend management with AI savings and accounting automation.", tags: ["cards", "spend", "savings"] },
  { name: "Brex",       url: "https://www.brex.com",      dept: "finance", pricing: "free", desc: "Corporate cards and banking with AI expense agents.", tags: ["cards", "banking", "expenses"] },
  { name: "Kavout",     url: "https://www.kavout.com",    dept: "finance", pricing: "paid", desc: "Machine-learning credit and fraud scoring for lenders.", tags: ["credit", "fraud", "risk"] },
  { name: "Zest AI",    url: "https://www.zest.ai",       dept: "finance", pricing: "paid", desc: "AI underwriting for fairer, faster lending decisions.", tags: ["lending", "underwriting", "risk"] },
  { name: "Ocrolus",    url: "https://www.ocrolus.com",   dept: "finance", pricing: "paid", desc: "Document AI that automates loan and bank-statement review.", tags: ["documents", "lending", "ocr"] },
  { name: "Booke.ai",   url: "https://booke.ai",          dept: "finance", pricing: "freemium", desc: "AI bookkeeping automation and error detection.", tags: ["bookkeeping", "quickbooks", "xero"] },
  { name: "AlphaSense", url: "https://www.alpha-sense.com", dept: "finance", pricing: "paid", desc: "Market intelligence search across filings, transcripts and research.", tags: ["research", "market", "investing"] },

  /* ---------- LEGAL ---------- */
  { name: "Harvey",     url: "https://www.harvey.ai",      dept: "legal", pricing: "paid", desc: "AI for elite law firms — research, drafting and analysis.", tags: ["law firm", "research", "enterprise"] },
  { name: "CoCounsel",  url: "https://casetext.com",       dept: "legal", pricing: "paid", desc: "AI legal assistant for research, review and deposition prep.", tags: ["research", "review", "thomson reuters"] },
  { name: "Luminance",  url: "https://www.luminance.com",  dept: "legal", pricing: "paid", desc: "AI for contract review, negotiation and due diligence.", tags: ["contracts", "diligence", "corporate"] },
  { name: "Robin AI",   url: "https://www.robinai.com",    dept: "legal", pricing: "paid", desc: "Contract copilot that reviews and drafts to your playbook.", tags: ["contracts", "playbook", "review"] },
  { name: "Spellbook",  url: "https://www.spellbook.legal", dept: "legal", pricing: "paid", desc: "Contract drafting AI that lives inside Microsoft Word.", tags: ["contracts", "word", "drafting"] },
  { name: "LawGeex",    url: "https://www.lawgeex.com",    dept: "legal", pricing: "paid", desc: "Automated contract review against your legal policies.", tags: ["contracts", "review", "policy"] },
  { name: "DoNotPay",   url: "https://donotpay.com",       dept: "legal", pricing: "paid", desc: "Consumer AI lawyer for disputes, tickets and refunds.", tags: ["consumer", "disputes", "tickets"] },
  { name: "Lexis+ AI",  url: "https://www.lexisnexis.com", dept: "legal", pricing: "paid", desc: "Legal research with grounded citations from LexisNexis.", tags: ["research", "case law", "citations"] },
  { name: "Genie AI",   url: "https://www.genieai.co",     dept: "legal", pricing: "freemium", desc: "AI contract editor with a large legal template library.", tags: ["contracts", "templates", "editor"] },

  /* ---------- HEALTHCARE ---------- */
  { name: "Nuance DAX",      url: "https://www.nuance.com",       dept: "health", pricing: "paid", desc: "Ambient clinical documentation that writes notes for physicians.", tags: ["clinical notes", "ambient", "microsoft"] },
  { name: "Suki",            url: "https://www.suki.ai",          dept: "health", pricing: "paid", desc: "AI assistant that writes clinical notes and answers questions.", tags: ["clinical notes", "voice", "ehr"] },
  { name: "Abridge",         url: "https://www.abridge.com",      dept: "health", pricing: "paid", desc: "Turns patient conversations into structured clinical notes.", tags: ["clinical notes", "ambient", "ehr"] },
  { name: "Ada Health",      url: "https://ada.com",              dept: "health", pricing: "free", desc: "Symptom assessment app used by millions and health systems.", tags: ["symptoms", "assessment", "consumer"] },
  { name: "Viz.ai",          url: "https://www.viz.ai",           dept: "health", pricing: "paid", desc: "AI care coordination for stroke and cardiac teams.", tags: ["stroke", "imaging", "coordination"] },
  { name: "PathAI",          url: "https://www.pathai.com",       dept: "health", pricing: "paid", desc: "AI pathology for diagnostics and translational research.", tags: ["pathology", "diagnostics", "research"] },
  { name: "Tempus",          url: "https://www.tempus.com",       dept: "health", pricing: "paid", desc: "Precision medicine data and AI for cancer care.", tags: ["oncology", "genomics", "precision"] },
  { name: "Buoy Health",     url: "https://www.buoyhealth.com",   dept: "health", pricing: "free", desc: "AI symptom checker that guides you to the right care.", tags: ["symptoms", "triage", "consumer"] },
  { name: "Glass Health",    url: "https://glass.health",         dept: "health", pricing: "freemium", desc: "AI clinical decision support for diagnosis and treatment plans.", tags: ["dds", "clinicians", "plans"] },
  { name: "Hippocratic AI",  url: "https://www.hippocraticai.com", dept: "health", pricing: "paid", isNew: true, desc: "Safety-focused AI agents for patient-facing healthcare tasks.", tags: ["agents", "safety", "patient"] },

  /* ---------- EDUCATION ---------- */
  { name: "Khanmigo",         url: "https://www.khanacademy.org/khan-labs", dept: "education", pricing: "freemium", desc: "Khan Academy's AI tutor for learners and teaching assistant for teachers.", tags: ["tutor", "k12", "khan academy"] },
  { name: "Duolingo",         url: "https://www.duolingo.com",    dept: "education", pricing: "freemium", desc: "Language learning with AI-powered personalization and chat.", tags: ["languages", "mobile", "gamified"] },
  { name: "Quizlet",          url: "https://quizlet.com",         dept: "education", pricing: "freemium", desc: "Study sets and flashcards plus Q-Chat, an AI tutor.", tags: ["flashcards", "study", "students"] },
  { name: "Photomath",        url: "https://photomath.com",       dept: "education", pricing: "freemium", desc: "Scan math problems for instant step-by-step solutions.", tags: ["math", "homework", "scan"] },
  { name: "Socratic",         url: "https://socratic.org",        dept: "education", pricing: "free", desc: "Google's free homework helper across science, math and more.", tags: ["homework", "google", "explainer"] },
  { name: "Carnegie Learning", url: "https://www.carnegielearning.com", dept: "education", pricing: "paid", desc: "MATHia adaptive learning for K-12 math classrooms.", tags: ["math", "k12", "adaptive"] },
  { name: "Century Tech",     url: "https://www.century.tech",    dept: "education", pricing: "paid", desc: "AI personalization for schools, built in the UK.", tags: ["schools", "adaptive", "k12"] },
  { name: "Gradescope",       url: "https://www.gradescope.com",  dept: "education", pricing: "freemium", desc: "AI-assisted grading and assessment for educators.", tags: ["grading", "assessment", "teachers"] },
  { name: "MagicSchool",      url: "https://www.magicschool.ai",  dept: "education", pricing: "freemium", isNew: true, desc: "Lesson planning and teacher tools used by millions of educators.", tags: ["teachers", "lesson plans", "k12"] },
  { name: "Eduaide",          url: "https://www.eduaide.ai",      dept: "education", pricing: "freemium", desc: "AI lesson plans, feedback and teaching resources.", tags: ["teachers", "resources", "planning"] },

  /* ---------- REAL ESTATE ---------- */
  { name: "Zillow",       url: "https://www.zillow.com",       dept: "realestate", pricing: "free", desc: "Home search with natural-language search and price estimates.", tags: ["homes", "search", "zestimate"] },
  { name: "Redfin",       url: "https://www.redfin.com",       dept: "realestate", pricing: "free", desc: "Home search with the Ask Redfin AI assistant.", tags: ["homes", "search", "agent"] },
  { name: "HouseCanary",  url: "https://www.housecanary.com",  dept: "realestate", pricing: "paid", desc: "Property valuation and market analytics for professionals.", tags: ["valuation", "analytics", "investors"] },
  { name: "Restb.ai",     url: "https://www.restb.ai",         dept: "realestate", pricing: "paid", desc: "Computer-vision tagging for property photos at MLS scale.", tags: ["photos", "tagging", "mls"] },
  { name: "Epique AI",    url: "https://epiqueai.com",         dept: "realestate", pricing: "freemium", desc: "AI content, leads and tools built for real estate agents.", tags: ["agents", "content", "leads"] },
  { name: "Ylopo",        url: "https://www.ylopo.com",        dept: "realestate", pricing: "paid", desc: "AI marketing and lead nurturing for realty teams.", tags: ["marketing", "leads", "nurture"] },
  { name: "Structurely",  url: "https://structurely.com",      dept: "realestate", pricing: "paid", desc: "AI voice and text lead qualification, around the clock.", tags: ["leads", "qualification", "voice"] },
  { name: "Matterport",   url: "https://www.matterport.com",   dept: "realestate", pricing: "freemium", desc: "3D digital twins of properties with AI-powered insights.", tags: ["3d", "tours", "twins"] },

  /* ---------- DATA & ANALYTICS ---------- */
  { name: "Tableau",           url: "https://www.tableau.com",           dept: "data", pricing: "paid", desc: "Visual analytics with AI explanations and Pulse insights.", tags: ["bi", "dashboards", "salesforce"] },
  { name: "Microsoft Power BI", url: "https://www.microsoft.com/power-platform/products/power-bi", dept: "data", pricing: "freemium", desc: "Business intelligence with Copilot for reports and DAX help.", tags: ["bi", "dashboards", "microsoft"] },
  { name: "ThoughtSpot",       url: "https://www.thoughtspot.com",       dept: "data", pricing: "paid", desc: "Search-driven analytics with natural-language AI (Sage).", tags: ["analytics", "search", "ai analyst"] },
  { name: "DataRobot",         url: "https://www.datarobot.com",         dept: "data", pricing: "paid", desc: "Enterprise AutoML and predictive AI platform.", tags: ["ml", "enterprise", "predictions"] },
  { name: "H2O.ai",            url: "https://h2o.ai",                    dept: "data", pricing: "freemium", desc: "Open-source machine learning and h2oGPT enterprise platform.", tags: ["ml", "open source", "llm"] },
  { name: "Domo",              url: "https://www.domo.com",              dept: "data", pricing: "paid", desc: "Cloud BI with AI-powered data experiences for teams.", tags: ["bi", "cloud", "dashboards"] },
  { name: "Hex",               url: "https://hex.tech",                  dept: "data", pricing: "freemium", desc: "Collaborative data notebooks with a Magic AI toolkit.", tags: ["notebooks", "sql", "python"] },
  { name: "Julius AI",         url: "https://julius.ai",                 dept: "data", pricing: "freemium", desc: "Chat with your spreadsheets to analyze and visualize data.", tags: ["analysis", "charts", "spreadsheets"] },
  { name: "Rows",              url: "https://rows.com",                  dept: "data", pricing: "freemium", desc: "Spreadsheet with a built-in AI analyst and live data connectors.", tags: ["spreadsheet", "analyst", "integrations"] },
  { name: "Akkio",             url: "https://www.akkio.com",             dept: "data", pricing: "paid", desc: "No-code predictive AI for agencies and small businesses.", tags: ["no-code", "predictions", "smb"] },

  /* ---------- TRAVEL ---------- */
  { name: "Expedia",      url: "https://www.expedia.com",     dept: "travel", pricing: "free", desc: "Trip planning and booking with the AI travel assistant Romie.", tags: ["booking", "flights", "hotels"] },
  { name: "Booking.com",  url: "https://www.booking.com",     dept: "travel", pricing: "free", desc: "AI Trip Planner for stays, flights and full itineraries.", tags: ["booking", "hotels", "planner"] },
  { name: "Mindtrip",     url: "https://www.mindtrip.ai",     dept: "travel", pricing: "freemium", isNew: true, desc: "Conversational travel planning with shareable itineraries and bookings.", tags: ["itinerary", "planner", "chat"] },
  { name: "Layla",        url: "https://layla.ai",            dept: "travel", pricing: "free", desc: "AI travel companion for destination ideas and day-by-day plans.", tags: ["itinerary", "inspiration", "chat"] },
  { name: "GuideGeek",    url: "https://guidegeek.com",       dept: "travel", pricing: "free", desc: "Travel AI that lives on WhatsApp, Instagram and Messenger.", tags: ["whatsapp", "messenger", "tips"] },
  { name: "Wonderplan",   url: "https://wonderplan.ai",       dept: "travel", pricing: "free", desc: "Free AI itinerary maker tailored to your interests and budget.", tags: ["itinerary", "free", "planner"] },
  { name: "iPlan.ai",     url: "https://iplan.ai",            dept: "travel", pricing: "freemium", desc: "Smart trip itineraries generated in seconds.", tags: ["itinerary", "planner", "mobile"] },
  { name: "Hopper",       url: "https://www.hopper.com",      dept: "travel", pricing: "free", desc: "Travel booking with AI price prediction and freeze options.", tags: ["booking", "prediction", "deals"] },

  /* ---------- GAMING ---------- */
  { name: "Character.AI",  url: "https://character.ai",       dept: "gaming", pricing: "freemium", desc: "Chat with millions of user-created AI characters.", tags: ["characters", "roleplay", "chat"] },
  { name: "Inworld AI",    url: "https://inworld.ai",         dept: "gaming", pricing: "freemium", desc: "AI brains for NPCs and immersive game characters.", tags: ["npc", "unreal", "unity"] },
  { name: "Convai",        url: "https://www.convai.com",     dept: "gaming", pricing: "freemium", desc: "Voice-enabled NPCs with spatial awareness for Unreal and Unity.", tags: ["npc", "voice", "engines"] },
  { name: "Charisma",      url: "https://charisma.ai",        dept: "gaming", pricing: "freemium", desc: "Interactive storytelling engine for games and virtual worlds.", tags: ["story", "narrative", "interactive"] },
  { name: "Rosebud AI",    url: "https://rosebud.ai",         dept: "gaming", pricing: "freemium", desc: "AI game creation and asset generation platform.", tags: ["assets", "creation", "indie"] },
  { name: "Ludo.ai",       url: "https://ludo.ai",            dept: "gaming", pricing: "freemium", desc: "Ideation and research copilot for game designers.", tags: ["ideation", "research", "design"] },
  { name: "AI Dungeon",    url: "https://aidungeon.io",       dept: "gaming", pricing: "freemium", desc: "Infinite text adventures powered by language models.", tags: ["text adventure", "story", "roleplay"] },
  { name: "NovelAI",       url: "https://novelai.net",        dept: "gaming", pricing: "freemium", desc: "AI storytelling and anime-style image generation.", tags: ["story", "anime", "images"] },

  /* ---------- MANUFACTURING ---------- */
  { name: "C3 AI",           url: "https://c3.ai",             dept: "manufacturing", pricing: "paid", desc: "Enterprise AI applications for industry, energy and defense.", tags: ["enterprise", "energy", "apps"] },
  { name: "Avathon",         url: "https://avathon.com",           dept: "manufacturing", pricing: "paid", desc: "Industrial AI for asset protection and optimization (formerly SparkCognition).", tags: ["industrial", "ai", "optimization"] },
  { name: "Augury",          url: "https://www.augury.com",    dept: "manufacturing", pricing: "paid", desc: "Machine-health sensors and AI for predictive maintenance.", tags: ["maintenance", "sensors", "machines"] },
  { name: "Uptake",          url: "https://uptake.com",        dept: "manufacturing", pricing: "paid", desc: "Asset performance AI for fleets and heavy industry.", tags: ["fleet", "assets", "performance"] },
  { name: "Falkonry",        url: "https://falkonry.com",      dept: "manufacturing", pricing: "paid", desc: "Time-series AI for production quality and operations.", tags: ["quality", "time series", "production"] },
  { name: "Sight Machine",   url: "https://sightmachine.com",  dept: "manufacturing", pricing: "paid", desc: "Manufacturing data platform for plant-wide analytics.", tags: ["analytics", "plants", "data"] },

  /* ---------- AGRICULTURE ---------- */
  { name: "Climate FieldView", url: "https://climate.com",     dept: "agriculture", pricing: "freemium", desc: "Bayer's field data platform with AI agronomic insights.", tags: ["farming", "fields", "bayer"] },
  { name: "OneSoil",           url: "https://onesoil.ai",      dept: "agriculture", pricing: "free", desc: "Free precision-farming maps built from satellite data.", tags: ["satellite", "fields", "precision"] },
  { name: "Plantix",           url: "https://plantix.net",     dept: "agriculture", pricing: "free", desc: "Diagnose crop diseases from a phone photo in seconds.", tags: ["crops", "disease", "mobile"] },
  { name: "xarvio Field Manager", url: "https://www.xarvio.com", dept: "agriculture", pricing: "freemium", desc: "Agronomic AI for spray timing and field scouting.", tags: ["spraying", "scouting", "agronomy"] },
  { name: "Cropwise",          url: "https://www.cropwise.com", dept: "agriculture", pricing: "freemium", desc: "Syngenta's digital agronomy platform with AI advisories.", tags: ["agronomy", "advisory", "syngenta"] }
];
