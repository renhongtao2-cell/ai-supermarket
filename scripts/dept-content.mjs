// dept-content.mjs — 21 个部门 hub 页的「人写内容」
// 深度来自三处：①这里的领域判断 ②data.js 的真实工具数据 ③free-tier-facts 的具体免费额度
// 原则：只写可核实的东西，不编造百分比/统计数字。
export const DEPT_CONTENT = {
  assistants: {
    lead: "General-purpose assistants are the entry point to everything else — which one you pick matters far less than which one is already in front of you.",
    reality: [
      "The frontier assistants have largely converged. ChatGPT, Claude and Gemini all handle long documents, code, analysis and images competently. The practical differences are context window size, how reliably they follow instructions, tone, and whether you can reach them inside the software you already use.",
      "The bigger fork is distribution. Google Gemini sits inside Search, Workspace and Android; Microsoft Copilot inside Windows and Microsoft 365; Meta AI inside WhatsApp and Instagram. For a lot of people the assistant they should use is the one already included in a subscription they pay for.",
      "The third fork is jurisdiction and data handling. DeepSeek and Mistral Le Chat are the notable non-US options, and for organisations with data-residency requirements that single fact decides the choice before any benchmark is consulted.",
    ],
    choose: [
      "<strong>Where you already work.</strong> An assistant embedded in your existing apps saves more time than a marginally stronger model in a separate tab.",
      "<strong>Context window.</strong> If you paste long contracts, repositories or transcripts, check the limit — it varies widely between tiers, not just between vendors.",
      "<strong>Whether answers need sources.</strong> Perplexity cites the pages it read. General chatbots often will not, which matters when the answer has to be checked.",
      "<strong>Data handling and residency.</strong> Regulated buyers should establish where prompts are stored, for how long, and whether they are used for training.",
      "<strong>What the paid tier costs.</strong> Almost every assistant is freemium; the stronger models and higher limits live behind the paid plan.",
    ],
    jobs: [
      ["One assistant for everything", "ChatGPT"],
      ["Long documents, careful writing, analysis", "Claude"],
      ["Answers that cite their sources", "Perplexity"],
      ["You already live in Google Workspace", "Google Gemini"],
      ["You already live in Windows and Microsoft 365", "Microsoft Copilot"],
      ["Several models under one subscription", "Poe"],
      ["Free chat with no account", "DeepSeek"],
      ["European data residency", "Mistral Le Chat"],
    ],
    watch: [
      "Benchmarks are a poor buying guide. Public leaderboards reshuffle monthly and rarely measure the task you actually have.",
      "Free tiers differ enormously in message limits. A generous-looking free tier that throttles after a handful of messages is not usable for real work.",
      "Do not paste confidential material into a consumer assistant before checking the provider's training and retention policy.",
    ],
    faq: [
      ["Which AI assistant is best?", "There is no single winner. For general work ChatGPT, Claude and Gemini are all strong. The deciding factors are usually context limits, whether you need cited sources, and whether the assistant is already built into software you pay for."],
      ["Are free AI assistants good enough?", "For occasional use, yes. Free tiers typically cap how many messages you can send to the strongest model per day. The paid tier is what unlocks longer documents, higher limits and priority access."],
      ["Can I use these assistants for work?", "Technically yes, but check your employer's policy and the provider's data terms first. Consumer tiers may use conversations for training unless you opt out or use a business plan."],
    ],
  },

  writing: {
    lead: "Writing tools split into two very different jobs: correcting the text you wrote, and producing text you did not.",
    reality: [
      "The correction category is mature and genuinely useful. Grammarly and Wordtune sit in the editor and improve what you already wrote — grammar, clarity, tone, length. These tools are low-risk because you remain the author.",
      "The generation category is where the trouble starts. Tools like Rytr and HyperWrite will draft a blog post or an ad from a prompt, and the output is fluent but generic. It reads well and says little, which is precisely the failure mode that search engines and readers now penalise.",
      "A third category is easy to overlook: verification. Originality.ai exists because publishers need to know whether a submission was machine-written. If you publish at volume, having a detection and plagiarism step in the workflow is now standard practice.",
    ],
    choose: [
      "<strong>Correction or generation?</strong> Decide first. A grammar tool and a drafting tool solve opposite problems and are rarely interchangeable.",
      "<strong>Where it runs.</strong> Browser-extension tools work in every text field you already use; standalone editors force you to change how you work.",
      "<strong>Tone control.</strong> If your writing has a specific voice, check whether the tool can be trained on it or only offers preset tones.",
      "<strong>Volume and pricing model.</strong> Per-word and per-seat pricing diverge fast once you are producing regularly.",
      "<strong>Whether output is detectable.</strong> If you publish under your own name, this matters more than output quality.",
    ],
    jobs: [
      ["Fix grammar and clarity in your own writing", "Grammarly"],
      ["Rewrite a sentence to be shorter or warmer", "Wordtune"],
      ["Paraphrase or summarise source material", "QuillBot"],
      ["Fast drafts for ads and short copy", "Rytr"],
      ["Draft with web research and citations", "HyperWrite"],
      ["Long-form fiction and worldbuilding", "Sudowrite"],
      ["Enterprise writing with brand guardrails", "Writer"],
      ["Check whether text was machine-written", "Originality.ai"],
    ],
    watch: [
      "Fluency is not accuracy. Generated prose reads confidently even when the underlying claim is wrong, and readers rarely catch it — you have to.",
      "Publishing volume-generated text is the fastest way to accumulate content that search engines classify as low value. Use generation for drafts, then do the part a model cannot: specific detail and judgement.",
      "AI detectors produce false positives on plain, formal human writing. Never treat a detector score as proof.",
    ],
    faq: [
      ["Will AI writing tools get my site penalised?", "The tool is not the problem; the output is. Mass-produced, generic pages are penalised whether a human or a model wrote them. Use these tools to draft and edit, then add the specifics, examples and judgement that make a page worth reading."],
      ["Do grammar checkers change my meaning?", "Occasionally, which is why you should read every accepted suggestion. They are reliable on spelling, agreement and punctuation, and less reliable when a rewrite would alter emphasis."],
      ["Are AI detectors accurate?", "Not reliably. They flag text on statistical patterns, produce false positives on formal human writing, and can be defeated by light editing. Treat a score as a signal to investigate, never as evidence."],
    ],
  },

  marketing: {
    lead: "Marketing is where AI is most crowded and most tempting to over-use — the tools that survive are the ones tied to real performance data.",
    reality: [
      "There are two distinct families here and they should not be bought together. Content tools (Jasper, Copy.ai, Writesonic, Scalenut) produce words. SEO and performance tools (Surfer, Semrush, MarketMuse, Anyword) tell you what to write about and whether it worked.",
      "The performance-data family is the more defensible purchase. Surfer scores a draft against what currently ranks; MarketMuse builds briefs from topical authority gaps; Anyword predicts copy performance before you publish. These give you information you could not get by asking a chatbot.",
      "Pure generation is now commoditised. Every assistant in the AI Assistants category will write marketing copy. What a dedicated tool adds is brand training, workflow, and integration with the campaign data you already have.",
    ],
    choose: [
      "<strong>Words or data?</strong> If you already have an assistant for drafting, spend the budget on the SEO/performance side instead of another generator.",
      "<strong>Does it use live SERP data?</strong> Content optimisation without current ranking data is guesswork with a subscription fee.",
      "<strong>Brand and style control.</strong> For teams producing at volume, whether the tool can be constrained to your voice determines whether output is usable.",
      "<strong>Integration with your stack.</strong> HubSpot and Semrush matter mostly because the data already lives there.",
      "<strong>Seat pricing versus usage pricing.</strong> Marketing teams grow; per-seat tools get expensive quickly.",
    ],
    jobs: [
      ["Brand-trained copy at scale", "Jasper"],
      ["SEO-optimised articles against live rankings", "Surfer SEO"],
      ["Keyword research plus AI content tools in one suite", "Semrush"],
      ["Content briefs built on topical authority", "MarketMuse"],
      ["Predict which copy will perform before publishing", "Anyword"],
      ["Social posts and carousels from one prompt", "Predis.ai"],
      ["Marketing automation inside your CRM", "HubSpot"],
    ],
    watch: [
      "Optimising purely for a content score produces writing that satisfies the algorithm and bores the reader. Use scores as a floor, not a target.",
      "AI-written landing pages still have to convert. If nobody has tested the copy against a control, the tool has not proved anything.",
      "Ad platforms increasingly require disclosure of AI-generated creative in some contexts. Check the current policy for the channels you buy.",
    ],
    faq: [
      ["Is AI content bad for SEO?", "Search engines penalise low-value, mass-produced content regardless of how it was made, and explicitly allow helpful content that was AI-assisted. The distinction is whether the page adds information a reader cannot get elsewhere."],
      ["Do I need a dedicated AI writer if I already pay for ChatGPT?", "Usually not for drafting. Dedicated tools earn their fee through workflow, brand training and — most importantly — access to ranking and performance data that a general assistant does not have."],
      ["Can AI write ad copy that converts?", "It can produce plausible variants quickly, which is useful for testing. Whether they convert is an empirical question that only your own A/B tests answer."],
    ],
  },

  design: {
    lead: "Image generation is the most visible AI category and the one where licensing — not quality — most often decides the purchase.",
    reality: [
      "Output quality is no longer the differentiator. Midjourney has a distinctive aesthetic, Ideogram is unusually good at text inside images, and Recraft works in vectors rather than pixels. The practical choice is stylistic fit, not raw capability.",
      "The legal question is the real one. Adobe Firefly was trained on licensed and public-domain material and is marketed as commercially safe; Stable Diffusion is open-source and can be run locally, which removes the third-party service from the picture entirely. For agency and brand work this usually decides it before anyone looks at sample images.",
      "A third layer is whether generation lives inside a design tool. Canva Magic Studio, Figma AI and Kittl put generation next to layout, type and export, which is where the work actually happens. Standalone generators produce an image you then have to place somewhere.",
    ],
    choose: [
      "<strong>Licensing and training data.</strong> Ask explicitly what the model was trained on and what commercial rights you receive. This is the question that ends most evaluations.",
      "<strong>Raster or vector.</strong> If the output has to scale to a billboard or be edited as paths, a vector-native tool saves a redraw.",
      "<strong>Text rendering.</strong> Many models still garble lettering. If your asset contains words, test that specifically.",
      "<strong>Consistency across a set.</strong> Producing one good image is easy; producing twenty that look like the same brand is the hard part.",
      "<strong>Where it plugs in.</strong> Generation inside your existing design tool beats a separate tab for everyday work.",
    ],
    jobs: [
      ["Best-in-class illustration and concept art", "Midjourney"],
      ["Commercially safe generation for client work", "Adobe Firefly"],
      ["Design, generate and export in one place", "Canva Magic Studio"],
      ["UI design and prototypes", "Figma AI"],
      ["Images with legible text or logos", "Ideogram"],
      ["Vector illustrations and icons", "Recraft"],
      ["Run locally with no third-party service", "Stable Diffusion"],
      ["Consistent game or brand asset sets", "Leonardo.Ai"],
    ],
    watch: [
      "Copyright status of AI-generated images varies by jurisdiction and is still moving. For high-value brand assets, get legal advice rather than relying on a vendor's marketing page.",
      "A model's output can closely resemble its training data. If you generate in the style of a living artist or an existing brand, you are taking a risk the tool will not warn you about.",
      "Free tiers frequently restrict commercial use or add watermarks. Check the licence attached to the tier you are actually on.",
    ],
    faq: [
      ["Can I use AI-generated images commercially?", "It depends on the tool and your jurisdiction. Some vendors grant broad commercial rights, others restrict them on free tiers, and the copyright status of purely machine-generated work is unsettled in several countries. Check the specific licence for the plan you are on."],
      ["Which AI image generator is best?", "They differ more in style and licensing than in quality. Midjourney for aesthetics, Ideogram for text, Recraft for vectors, Firefly when you need a licensed training set, Stable Diffusion when you need to run it yourself."],
      ["Will AI replace designers?", "It has replaced a specific task — producing a single stock-like image on demand. It has not replaced layout, hierarchy, typography or the judgement about what a brand should look like."],
    ],
  },

  video: {
    lead: "Video and audio AI is the fastest-moving category here, and the one where the gap between demo and production is widest.",
    reality: [
      "Text-to-video models (Runway, Pika, Sora) produce impressive short clips and are genuinely useful for b-roll, concepts and social cutaways. They are not yet a substitute for shooting a controlled scene with consistent characters across many shots.",
      "The production-ready tools are less glamorous. Descript lets you edit video by editing its transcript, which is a real change to how editing works. Opus Clip turns long recordings into short clips automatically. CapCut adds captions and effects at no cost. These solve problems creators actually have every week.",
      "Audio is further along than video. ElevenLabs and Murf produce voiceover that is usable in production, LALAL.AI separates stems cleanly, and Suno and Udio generate complete songs with vocals. If your project needs narration or music, the quality bar has already been cleared.",
    ],
    choose: [
      "<strong>Finished output or raw material?</strong> Clip generators and avatar tools produce a finished asset; generative video produces footage you still have to assemble.",
      "<strong>Consistency across shots.</strong> Ask to see the same character or product across multiple generations. This is where generative video usually falls apart.",
      "<strong>Rights to the voice or likeness.</strong> Cloning tools raise consent questions that vary by jurisdiction; make sure you have the right to the voice you are cloning.",
      "<strong>Where it fits the edit.</strong> A tool that exports a file you then import is slower than one that edits in place.",
      "<strong>Rendering cost and queue time.</strong> Credit-based pricing can be consumed surprisingly fast on video.",
    ],
    jobs: [
      ["Edit video by editing the transcript", "Descript"],
      ["Turn long videos into short clips", "Opus Clip"],
      ["Professional voiceover from text", "ElevenLabs"],
      ["Presenter-led video from a script", "Synthesia"],
      ["Translate a video with lip-sync", "HeyGen"],
      ["Generate original music with vocals", "Suno"],
      ["Isolate vocals or instruments", "LALAL.AI"],
      ["Restore, upscale or stabilise footage", "Topaz Video AI"],
    ],
    watch: [
      "Generative video struggles with physical consistency — hands, reflections, text and objects that must stay the same between shots. Budget for retakes.",
      "Voice cloning without documented consent is legally risky in a growing number of jurisdictions, regardless of what the tool permits.",
      "Credit-based pricing makes cost unpredictable. Model your actual monthly output before committing to a plan.",
    ],
    faq: [
      ["Can AI generate a complete video yet?", "It can generate impressive individual shots and complete short social clips. It cannot yet reliably produce a multi-minute narrative with consistent characters, so most professional workflows use it for b-roll, concepts and cutaways alongside real footage."],
      ["Is AI voiceover good enough for client work?", "For narration, usually yes — the leading voices are hard to distinguish from recorded speech in a mix. Check the licence for the specific voice, and disclose synthetic narration where your client or platform requires it."],
      ["Do I need a powerful computer?", "Only for local tools like Stable Diffusion or heavy upscaling. Most tools in this category run in the cloud and work from a normal laptop."],
    ],
  },

  dev: {
    lead: "Coding assistants are the most measurably useful AI tools in production — and the category where the licence and data-boundary questions are most concrete.",
    reality: [
      "The category split is between completion and agency. GitHub Copilot, Tabnine and JetBrains AI complete what you are typing. Cursor, Windsurf, Bolt.new and Lovable operate at a higher level: you describe a feature and they edit multiple files, run commands and iterate.",
      "The agentic tools have changed what a single developer can ship, particularly for greenfield work. They are also where the risk concentrates — an agent that can write files and run commands can make a confident, plausible mistake across an entire codebase.",
      "The third axis is where your code goes. Tabnine emphasises private, trainable deployment. Amazon Q Developer and JetBrains AI keep work inside their respective ecosystems. For regulated teams, whether inference happens against a hosted service or a self-managed model is the deciding question.",
    ],
    choose: [
      "<strong>Completion or agent?</strong> Completion is low-risk and immediately useful. Agents are more powerful and require real review discipline.",
      "<strong>Where does your code go?</strong> Establish whether snippets are sent to a third party and whether they are retained. This is often a policy question, not a preference.",
      "<strong>Does it understand your repository?</strong> Whole-codebase context is what separates a helpful assistant from an autocomplete with opinions.",
      "<strong>Language and framework coverage.</strong> Quality varies sharply outside mainstream languages.",
      "<strong>How you review its output.</strong> Agents produce diffs; whether your process actually inspects them determines whether you benefit or accumulate debt.",
    ],
    jobs: [
      ["Inline completion in your existing editor", "GitHub Copilot"],
      ["Agentic editing across a whole codebase", "Cursor"],
      ["Describe a feature and have it built", "Windsurf"],
      ["Build and deploy from a browser", "Replit"],
      ["Private or self-hosted completion", "Tabnine"],
      ["Generate React and Tailwind UI", "v0"],
      ["Prototype a full-stack app from a prompt", "Bolt.new"],
      ["Delegate a well-specified ticket", "Devin"],
    ],
    watch: [
      "Generated code compiles and looks idiomatic while being subtly wrong. The review step is not optional, and agents increase the volume of code needing review.",
      "Licence contamination is a real concern: some models reproduce code patterns from their training data. Check what your tool says about provenance.",
      "Agents with filesystem and shell access should run in a sandbox or a branch. Treat their output as an untrusted patch.",
    ],
    faq: [
      ["Do AI coding tools actually make developers faster?", "For boilerplate, tests, unfamiliar APIs and greenfield prototypes, clearly yes. For work inside a large legacy codebase with implicit conventions, gains are smaller and depend heavily on how much context the tool can see."],
      ["Is it safe to let an AI agent write and run code?", "Only with the same controls you would apply to any untrusted contributor: isolated environment, branch-based workflow, and review before merge. Agents make mistakes confidently, at volume."],
      ["Will my code be used for training?", "That depends entirely on the tool and plan. Several vendors offer business tiers that exclude your code from training; check the specific terms rather than assuming."],
    ],
  },

  productivity: {
    lead: "Productivity AI is really three products sharing a category: meeting capture, document assistance, and automation.",
    reality: [
      "Meeting tools are the most immediately valuable and the most mature. Otter.ai, Fireflies.ai, Zoom AI Companion and Slack AI turn conversations into searchable transcripts, summaries and action items. The value is not the summary — it is being able to search what was decided three months ago.",
      "Document and workspace assistants (Notion AI, ClickUp Brain, Asana AI) work inside tools you already use, which is why they get adopted. Their quality is bounded by how much of your work actually lives in that tool.",
      "Automation is the category with the largest upside and the steepest learning curve. Zapier and Make connect thousands of services; Bardeen automates browser work. These are not AI features so much as AI-assisted plumbing, and they deliver the biggest time savings once configured.",
    ],
    choose: [
      "<strong>Does it live where your work lives?</strong> An assistant inside your existing workspace beats a better one you have to visit.",
      "<strong>Meeting capture or document help?</strong> These are separate purchases. Most teams need the former first.",
      "<strong>How much setup automation needs.</strong> Zapier and Make repay configuration effort; if nobody will maintain the workflows, skip them.",
      "<strong>Search across everything.</strong> The value of transcripts compounds only if they are searchable alongside your other documents.",
      "<strong>Who can see the data.</strong> Meeting transcripts are sensitive by default. Check retention and access controls before recording anything.",
    ],
    jobs: [
      ["Searchable meeting transcripts", "Otter.ai"],
      ["Notetaking with action items across platforms", "Fireflies.ai"],
      ["Answers about your own documents and wiki", "Notion AI"],
      ["Generate a polished deck from a prompt", "Gamma"],
      ["Automate workflows across thousands of apps", "Zapier"],
      ["Visual automation with complex logic", "Make"],
      ["Automate repetitive browser tasks", "Bardeen"],
      ["Protect focus time in your calendar", "Reclaim.ai"],
    ],
    watch: [
      "Recording meetings has legal and cultural implications that differ by jurisdiction. In several places all parties must consent, and in many teams it changes how frankly people speak.",
      "Transcripts are inaccurate in exactly the moments that matter — names, numbers and acronyms. Do not treat a generated action item as authoritative.",
      "Automation that nobody owns becomes invisible technical debt. Every workflow needs a person responsible for it breaking.",
    ],
    faq: [
      ["Are AI meeting notetakers worth it?", "If you attend more than a few meetings a week and need to recall decisions later, yes — the searchable record is the real benefit, not the summary. If you rarely revisit meetings, the value is much lower."],
      ["Can I record meetings without telling people?", "Do not. Consent rules vary by jurisdiction and many require all parties to agree. Beyond legality, undisclosed recording damages trust in a way that is hard to repair."],
      ["Where should I start with automation?", "Pick one repetitive task you do weekly, automate only that, and leave it running for a month before adding more. Broad automation projects fail because nobody maintains them."],
    ],
  },

  ecommerce: {
    lead: "E-commerce AI is mostly invisible — it runs in search, recommendations and personalisation, not in a chatbot your customers chat with.",
    reality: [
      "The highest-return applications are the quiet ones. Site search and product recommendations (Algolia, Clerk.io, Bloomreach) directly affect revenue because they sit between an intent and a purchase. This is measurable in a way that most AI features are not.",
      "Visual search is the notable newer capability. ViSenze, Syte and Perfect Corp let shoppers find products from a photo, or try on makeup and eyewear virtually. For fashion, eyewear and beauty this removes a genuine purchase barrier — the inability to see the thing on you.",
      "Store operations are the third area: Shopify Magic handles product copy, chat and setup, and Yotpo manages reviews and loyalty. These are smaller wins individually but compound across a large catalogue.",
    ],
    choose: [
      "<strong>Can you measure it?</strong> Search and recommendations can be A/B tested against revenue. Insist on that before buying anything else.",
      "<strong>Catalogue size.</strong> Personalisation only matters once manual merchandising stops scaling — typically hundreds of SKUs or more.",
      "<strong>Return rate, not just conversion.</strong> Visual search and virtual try-on often lift conversion partly by reducing mismatched purchases. Track returns too.",
      "<strong>Platform lock-in.</strong> If you are on Shopify, native features are cheaper; if you are on a custom stack, API-first vendors matter more.",
      "<strong>Where product data comes from.</strong> Every one of these tools is only as good as the product feed you give it.",
    ],
    jobs: [
      ["Better site search and recommendations", "Algolia"],
      ["Visual search from a customer photo", "ViSenze"],
      ["Virtual try-on for beauty and eyewear", "Perfect Corp"],
      ["Personalisation across email and onsite", "Bloomreach"],
      ["Product copy and store setup", "Shopify Magic"],
      ["Reviews, SMS and loyalty", "Yotpo"],
      ["Search, recommendations and email for smaller shops", "Clerk.io"],
    ],
    watch: [
      "Personalisation can misfire in ways that feel intrusive — retargeting a product a customer already bought is the classic example.",
      "Virtual try-on accuracy varies by skin tone and lighting. Test across your actual customer base, not a demo model.",
      "AI-generated product descriptions are convenient and often bland. For high-margin items, the specific detail that sells is the detail a model does not have.",
    ],
    faq: [
      ["Where does AI actually make money in e-commerce?", "Search and recommendations, because they sit directly between intent and purchase and can be A/B tested against revenue. Everything else is harder to attribute."],
      ["Is AI search worth it for a small store?", "Usually not until manual merchandising stops scaling. Below a few hundred SKUs, a well-tagged catalogue and decent filters will outperform an expensive personalisation platform."],
      ["Can AI write my product descriptions?", "It can, and they will be grammatically correct and interchangeable. The descriptions that sell contain specifics a model does not have — materials, fit, the reason a customer would choose this over the alternative."],
    ],
  },

  sales: {
    lead: "Sales AI is split between finding people to contact and understanding what happened in the conversations you already had.",
    reality: [
      "Prospecting is the crowded half. Apollo.io, ZoomInfo, Seamless.AI and Clay assemble contact and company data, and AI layers on enrichment, sequencing and email drafting. The quality of the underlying data determines everything; the AI is the delivery mechanism.",
      "Revenue intelligence is the half that changes behaviour. Gong, Outreach and Salesforce Einstein analyse calls, emails and deal activity to show which deals are actually progressing and which only look healthy. This is information a manager genuinely cannot obtain by reading CRM fields.",
      "The email-coaching layer is smaller but immediately practical. Lavender and Regie.ai improve the messages reps send, which is the highest-volume activity in most sales organisations.",
    ],
    choose: [
      "<strong>Data quality first.</strong> Evaluate the underlying contact database on your actual territory before looking at any AI feature.",
      "<strong>Do you record calls?</strong> Revenue intelligence requires it, which brings consent and trust questions you must resolve first.",
      "<strong>CRM fit.</strong> If your CRM already includes AI features you are paying for, buy the gap rather than duplicating.",
      "<strong>Compliance.</strong> Outreach regulations differ by country; automated sequences must respect unsubscribe and consent rules in each market.",
      "<strong>Adoption, not features.</strong> Sales tools fail when reps do not use them. Favour tools that reduce work in the existing flow.",
    ],
    jobs: [
      ["Contact database plus sequencing", "Apollo.io"],
      ["Data enrichment with AI research", "Clay"],
      ["Understand which deals are really progressing", "Gong"],
      ["Predictions and copilots inside Salesforce", "Salesforce Einstein"],
      ["Write better emails faster", "Lavender"],
      ["AI prospecting sequences and call scripts", "Regie.ai"],
      ["Real-time contact data at scale", "Seamless.AI"],
    ],
    watch: [
      "Automated outreach at volume damages deliverability and brand. Personalisation is not a nice-to-have here; it is what keeps you out of spam folders.",
      "Contact data goes stale quickly. Budget for refresh, not just acquisition.",
      "Call recording has consent requirements that vary by jurisdiction, and in several places requires notifying all parties.",
    ],
    faq: [
      ["Does AI cold email still work?", "Volume-based generic outreach increasingly fails because mailbox providers filter it and recipients ignore it. AI helps most when it improves relevance and personalisation, not when it multiplies volume."],
      ["What is revenue intelligence?", "Software that analyses sales calls, emails and deal activity to surface risk and forecast accuracy — for example, flagging a deal that has gone quiet or a competitor mentioned on a call. Gong and Outreach are the established names."],
      ["Should I buy more contact data or better enrichment?", "Enrichment, usually. Most teams already have more contacts than they can work effectively; the constraint is knowing which ones to prioritise."],
    ],
  },

  support: {
    lead: "Support is where AI has the clearest return, because deflection and triage are measurable and the volume is high.",
    reality: [
      "The core application is answering questions from your own documentation. Intercom Fin, Zendesk AI, Ada, Chatbase and Voiceflow all build agents grounded in your knowledge base, which is what makes the answers trustworthy rather than plausible.",
      "Triage is the second application and often the bigger win. Routing tickets, detecting urgency and summarising long threads saves agent time on every single ticket, not only on the ones the bot handles.",
      "The ceiling is set by your documentation, not the model. An agent built on out-of-date help articles gives confident wrong answers, which is worse than no bot at all. Every team deploying one of these should treat content maintenance as part of the project.",
    ],
    choose: [
      "<strong>Quality of your knowledge base.</strong> Audit it before buying. This determines your result more than the vendor does.",
      "<strong>Deflection or assistance?</strong> Customer-facing bots and agent copilots are different products; most teams need triage and assistance before full deflection.",
      "<strong>Handover quality.</strong> The moment a bot fails must route cleanly to a human with context. Test this specifically.",
      "<strong>Escalation and tone.</strong> A confidently wrong answer on billing or an outage costs more than the ticket it saved.",
      "<strong>Language coverage.</strong> Check quality in every language you actually support, not just English.",
    ],
    jobs: [
      ["Deflect chats using your own content", "Intercom Fin"],
      ["Triage and copilot inside Zendesk", "Zendesk AI"],
      ["Build a support bot from your docs", "Chatbase"],
      ["Design custom chat and voice agents", "Voiceflow"],
      ["Small-business chatbot on your site", "Tidio Lyro"],
      ["Automated service at enterprise scale", "Ada"],
      ["Deflect and triage tickets automatically", "Forethought"],
    ],
    watch: [
      "A bot that cannot say \"I don't know\" will invent an answer. Constrain it to your documentation and give it an explicit escalation path.",
      "Deflection rate is an easy metric to game and a poor one to optimise alone. Track customer satisfaction and repeat contact rate alongside it.",
      "Support conversations contain personal data. Check retention, redaction and where inference happens.",
    ],
    faq: [
      ["Will an AI chatbot annoy my customers?", "A good one that answers accurately and hands over quickly will not. A bad one that loops, misanswers, and hides the human option will. The difference is almost always the quality of the underlying documentation."],
      ["What deflection rate should I expect?", "It varies too widely to promise a number — it depends on ticket type, documentation quality and how tolerant your customers are of self-service. Measure your own baseline before and after, and watch satisfaction, not just deflection."],
      ["Should the bot admit it is an AI?", "Yes. Disclosure is increasingly a legal requirement in some jurisdictions and concealing it damages trust when customers work it out, which they do."],
    ],
  },

  hr: {
    lead: "HR AI is powerful and legally sensitive — hiring tools are regulated in several jurisdictions, and bias risk is a compliance issue, not a philosophical one.",
    reality: [
      "The recruiting stack covers sourcing, screening, scheduling and interviewing. SeekOut and Eightfold AI search for candidates by skill; Paradox Olivia and Phenom handle screening and scheduling conversations; HireVue assesses video interviews.",
      "The compliance dimension is not optional. Automated hiring tools can fall under employment-discrimination law and, in some jurisdictions, specific AI regulations requiring bias audits and candidate disclosure. Textio exists in this space for the opposite reason: to remove biased language from job posts.",
      "The lower-risk applications are administrative — scheduling, applicant tracking, drafting job descriptions. The higher-risk ones are assessment and ranking, because those decisions directly affect people's livelihoods and are the ones regulators scrutinise.",
    ],
    choose: [
      "<strong>Regulatory exposure.</strong> Establish which rules apply where you hire. Assessment and ranking tools carry obligations that scheduling tools do not.",
      "<strong>Is a human making the decision?</strong> Tools that assist a human reviewer are far safer than tools that filter candidates automatically.",
      "<strong>Bias auditing.</strong> Ask vendors for evidence of adverse-impact testing and how they monitor it over time.",
      "<strong>Candidate disclosure.</strong> Several jurisdictions require telling candidates that AI is used in the process.",
      "<strong>Data retention.</strong> Candidate data has specific retention and deletion obligations in many countries.",
    ],
    jobs: [
      ["Skill-based sourcing and internal mobility", "Eightfold AI"],
      ["Conversational screening and scheduling", "Paradox Olivia"],
      ["Video interviewing and assessment", "HireVue"],
      ["Remove biased language from job posts", "Textio"],
      ["Affordable ATS with AI recommendations", "Manatal"],
      ["Candidate CRM and interview scheduling", "Phenom"],
      ["Sourcing and outreach on LinkedIn", "LinkedIn AI"],
    ],
    watch: [
      "Automated screening can reproduce historical bias at scale, and in several jurisdictions the employer remains liable even when a vendor supplied the model.",
      "Never let a model make a rejection decision without human review. Assist, rank and summarise — do not auto-reject.",
      "Candidate data is personal data with retention limits. Keeping rejected candidates' records indefinitely is a compliance problem.",
    ],
    faq: [
      ["Is AI hiring legal?", "It is legal in many places but regulated. Several jurisdictions require bias auditing, candidate disclosure or both, and employment-discrimination law applies to outcomes regardless of who built the model. Get jurisdiction-specific advice before deploying screening or assessment tools."],
      ["Can AI reduce hiring bias?", "It can reduce specific biases — Textio removes loaded language from job posts, which measurably affects who applies. It can also amplify bias if trained on skewed historical decisions. The tool is not neutral; how it is trained and monitored decides the outcome."],
      ["Should I tell candidates AI is being used?", "Increasingly you must, and you should regardless. Candidates who discover undisclosed automated assessment react badly, and in some jurisdictions non-disclosure is itself a violation."],
    ],
  },

  finance: {
    lead: "Finance AI divides into bookkeeping automation, spend management and credit decisioning — three areas with very different risk profiles.",
    reality: [
      "Bookkeeping is the most mature and least contentious. Digits, Truewind, Pilot and Booke.ai automate categorisation, reconciliation and reporting. The work is rule-bound, the output is verifiable, and errors surface in a month rather than silently.",
      "Spend management (Ramp, Brex) is where AI produces visible savings — flagging duplicate subscriptions, negotiating rates, automating expense coding. Notably, both offer substantial free tiers because the business model is interchange, not software.",
      "Credit and underwriting (Kavout, Zest AI, Ocrolus) is the regulated frontier. These tools make decisions about people's access to money, which brings fair-lending obligations, explainability requirements and model-risk governance that the other two categories do not have.",
    ],
    choose: [
      "<strong>Which category are you in?</strong> Bookkeeping automation and credit decisioning should not be evaluated with the same checklist.",
      "<strong>Explainability.</strong> For any decision affecting a customer, you need to be able to explain it. This rules out some black-box models.",
      "<strong>Audit trail.</strong> Automated entries must be traceable back to source documents.",
      "<strong>Integration with your ledger.</strong> Bookkeeping tools live or die on how cleanly they reconcile with your existing accounts.",
      "<strong>Who is accountable.</strong> Automation does not transfer responsibility — a human still signs the accounts.",
    ],
    jobs: [
      ["Automated bookkeeping and reporting", "Digits"],
      ["Bookkeeping plus CFO advice", "Pilot"],
      ["Spend management with savings automation", "Ramp"],
      ["Corporate cards with expense agents", "Brex"],
      ["Automate loan and bank-statement review", "Ocrolus"],
      ["AI underwriting for lending decisions", "Zest AI"],
      ["Market intelligence across filings and transcripts", "AlphaSense"],
    ],
    watch: [
      "Automated categorisation errors compound quietly. Reconcile and spot-check monthly rather than trusting the ledger blindly.",
      "Credit models can encode historical discrimination. In many jurisdictions fair-lending law requires documented testing and the ability to explain adverse decisions.",
      "AI-generated financial summaries are not advice. Never present model output as a recommendation to a client without professional review.",
    ],
    faq: [
      ["Can AI do my bookkeeping?", "It can automate categorisation, reconciliation and reporting, which removes most of the repetitive work. A human still needs to review the accounts, handle unusual transactions and sign off — responsibility does not transfer to the software."],
      ["Is AI used in lending decisions?", "Yes, widely, particularly in underwriting and document review. It is regulated: fair-lending law and model-risk rules apply, and lenders generally must be able to explain an adverse decision to the applicant."],
      ["Are free spend-management tools really free?", "Ramp and Brex are free because they earn interchange on card spend. That is a legitimate model, but it means the product is designed around card usage — if you will not move spend onto the card, the economics do not work for either side."],
    ],
  },

  legal: {
    lead: "Legal AI is the highest-value, highest-risk category in this directory — the tools are genuinely capable and the consequences of an error are severe.",
    reality: [
      "Contract work is where adoption is deepest. Luminance, Robin AI, Spellbook, LawGeex and Genie AI review, draft and negotiate against a playbook. The task is structured, the volume is high, and the output is reviewed by a lawyer before it matters.",
      "Legal research is the second application. Harvey, CoCounsel and Lexis+ AI search case law and statutes, with Lexis+ emphasising grounded citations. This is also where the most public failures have occurred — models have cited cases that do not exist, and courts have sanctioned lawyers for filing them.",
      "The dividing line is verification. A tool that summarises a contract you can read is low-risk. A tool that asserts what the law says must be checked against the primary source, every time, because the cost of a fabricated citation is professional sanction.",
    ],
    choose: [
      "<strong>Does it ground answers in retrievable sources?</strong> If the tool cannot show you the underlying document or case, treat its output as a draft to verify.",
      "<strong>Privilege and confidentiality.</strong> Sending client material to a third-party service raises privilege questions. Establish where data is processed and whether it is retained.",
      "<strong>Jurisdiction coverage.</strong> Training data is heavily US-weighted. Quality outside your jurisdiction must be tested, not assumed.",
      "<strong>Where it fits your playbook.</strong> Tools that encode your own standards beat generic drafting assistance.",
      "<strong>Whether a lawyer reviews output.</strong> Non-negotiable for anything filed or signed.",
    ],
    jobs: [
      ["Contract review and due diligence at volume", "Luminance"],
      ["Drafting inside Microsoft Word", "Spellbook"],
      ["Contract review against your playbook", "Robin AI"],
      ["Legal research with grounded citations", "Lexis+ AI"],
      ["Research, review and deposition prep", "CoCounsel"],
      ["Contract drafting with a template library", "Genie AI"],
      ["Consumer disputes and refunds", "DoNotPay"],
    ],
    watch: [
      "Fabricated citations are the defining failure of legal AI. Models have invented plausible case names, and courts have imposed sanctions on lawyers who filed them. Verify every citation against the primary source.",
      "Do not paste privileged material into a consumer AI tool. Use an enterprise deployment with contractual confidentiality, or redact first.",
      "AI output is not legal advice, and using it does not create a lawyer-client relationship. The professional responsibility remains with the lawyer who signs.",
    ],
    faq: [
      ["Can AI replace a lawyer?", "No. It can compress the time spent on document review, drafting and first-pass research, which is a large share of billable hours. Judgement, strategy, negotiation and accountability remain with a qualified lawyer, and in most jurisdictions only a licensed lawyer can give legal advice."],
      ["Why do AI legal tools cite cases that do not exist?", "Language models generate plausible text rather than retrieving verified facts. Unless the tool is explicitly grounded in a retrievable database and shows you the source, it can produce a convincing but invented citation. This has already led to court sanctions."],
      ["Is it safe to upload contracts to an AI tool?", "Only with an enterprise agreement that covers confidentiality and retention. Consumer tools may use inputs for training. For privileged material, confirm the data terms in writing before uploading anything."],
    ],
  },

  health: {
    lead: "Healthcare AI splits cleanly into clinician-facing documentation, which is working well, and patient-facing triage, which must be treated as a starting point and never a diagnosis.",
    reality: [
      "Ambient clinical documentation is the clear success. Nuance DAX, Suki and Abridge listen to a consultation and write the note, addressing the documentation burden that is a major driver of clinician burnout. These tools operate under clinician review, which is why the risk is manageable.",
      "Diagnostic and imaging AI (Viz.ai, PathAI, Tempus) works in specialist settings under professional oversight, identifying stroke patterns, analysing pathology slides and supporting precision medicine. These are regulated medical devices in many jurisdictions, not general software.",
      "Patient-facing symptom checkers (Ada Health, Buoy Health) are genuinely useful for directing someone to the right level of care. They are also the area where a user may act on output without any professional in the loop, which is why every one of them carries prominent disclaimers.",
    ],
    choose: [
      "<strong>Who acts on the output?</strong> Clinician-reviewed tools carry a fundamentally different risk profile from patient-facing ones.",
      "<strong>Regulatory status.</strong> Check whether the product is cleared or registered as a medical device where you operate. This is not a marketing detail.",
      "<strong>Data protection.</strong> Health data is special-category personal data in most jurisdictions, with strict handling and residency requirements.",
      "<strong>Clinical validation.</strong> Ask for published evidence in your patient population, not vendor case studies.",
      "<strong>Integration with the record.</strong> Documentation tools only save time if the note lands in the EHR.",
    ],
    jobs: [
      ["Ambient notes for clinicians", "Nuance DAX"],
      ["Clinical documentation and Q&A", "Suki"],
      ["Patient conversation to structured note", "Abridge"],
      ["Clinical decision support", "Glass Health"],
      ["Care coordination for stroke and cardiac teams", "Viz.ai"],
      ["Digital pathology", "PathAI"],
      ["Symptom assessment to guide care seeking", "Ada Health"],
    ],
    watch: [
      "A symptom checker is not a diagnosis and must never delay urgent care. Anyone with severe or worsening symptoms should seek medical attention rather than consult software.",
      "Health data is special-category personal data. Consumer tools without a business agreement generally should not receive identifiable patient information.",
      "Models can underperform on populations under-represented in their training data. Validation in your actual patient group is essential, not optional.",
    ],
    faq: [
      ["Can I use an AI symptom checker instead of seeing a doctor?", "No. These tools are designed to suggest a level of care, not to diagnose. They can be a reasonable first step for a minor complaint, but they cannot examine you, order tests or account for your history — and they should never delay urgent care."],
      ["Is AI used in hospitals already?", "Yes, most commonly for documentation, imaging triage and administrative work under clinician supervision. Ambient scribes that write consultation notes are among the most widely adopted clinical AI applications."],
      ["Is my health data safe with these tools?", "That depends entirely on the deployment. Tools used within a health system are covered by its data agreements and regulations. Consumer apps are governed by their own privacy policies, which you should read before entering anything identifiable."],
    ],
  },

  education: {
    lead: "Education AI has two audiences with opposite needs: students who want answers, and teachers who want their workload reduced.",
    reality: [
      "For learners, the useful tools are tutors and study aids rather than answer machines. Khanmigo is built to guide a student toward the answer rather than supply it. Quizlet and Kai turn material into flashcards and quizzes. Photomath and Socratic explain the steps of a problem, which is the part that actually teaches.",
      "For teachers, the value is administrative. MagicSchool, Eduaide and Gradescope handle lesson planning, feedback and grading — the work that consumes evenings. This is where adoption has been fastest and least controversial.",
      "Adaptive learning platforms (Carnegie Learning, Century Tech, Squirrel AI) attempt something more ambitious: adjusting the sequence of material to each learner in real time. These are institutional purchases with real evidence requirements, and the claims deserve scrutiny.",
    ],
    choose: [
      "<strong>Answers or understanding?</strong> A tool that gives the answer saves five minutes and teaches nothing. Prefer tools that show the method.",
      "<strong>Age appropriateness.</strong> Products built for higher education are often unsuitable for children, both pedagogically and in data terms.",
      "<strong>Data protection for minors.</strong> Children's data carries the strictest rules in most jurisdictions. Check compliance before deploying anything in a school.",
      "<strong>Teacher workload, not novelty.</strong> The tools that stick are the ones that remove marking and planning hours.",
      "<strong>Evidence of learning gains.</strong> Ask for independent evaluation rather than vendor-reported improvement.",
    ],
    jobs: [
      ["Guided tutoring rather than answers", "Khanmigo"],
      ["Turn lectures into notes and quizzes", "Kai"],
      ["Flashcards and study sets", "Quizlet"],
      ["Step-by-step maths explanations", "Photomath"],
      ["Lesson planning and teacher resources", "MagicSchool"],
      ["Grading and assessment for educators", "Gradescope"],
      ["Adaptive K-12 maths", "Squirrel AI"],
      ["Language learning with AI conversation", "Duolingo"],
    ],
    watch: [
      "Students will use these tools whether or not institutions permit them. Designing assessment that assumes their absence is now unrealistic.",
      "AI detectors produce false positives, and accusing a student on that basis is unjust. Never treat a detector score as proof of misconduct.",
      "Children's data is protected more strictly than adults'. Verify compliance before putting any AI tool in front of minors.",
    ],
    faq: [
      ["Does AI help students learn?", "It depends entirely on how it is used. A tutor that explains steps and asks guiding questions helps. A tool that produces a finished essay removes the practice that learning requires. The design of the tool decides which one you get."],
      ["Should teachers use AI detectors?", "They are unreliable and produce false positives on ordinary formal writing, which has led to wrongful accusations. Use them, if at all, as a prompt to have a conversation — never as evidence."],
      ["Can AI grade essays fairly?", "It can handle consistent, rubric-driven marking and gives useful first-pass feedback. It is weaker on argument quality and originality, and students deserve a human read on anything that matters."],
    ],
  },

  realestate: {
    lead: "Real estate AI divides between consumer search, where the platforms are free, and professional tooling, where the money is.",
    reality: [
      "Consumer search is already AI-assisted and free. Zillow and Redfin both offer natural-language search and AI assistants, and the property estimates themselves are algorithmic. For buyers and sellers the useful AI is already in the tools they were going to use anyway.",
      "Professional tools address the parts of the job that consume agent time: valuation and market analytics (HouseCanary), photo processing at MLS scale (Restb.ai), lead qualification and follow-up (Structurely, Ylopo), and marketing content (Epique AI). Lead response speed is the one that most directly affects commission.",
      "Immersive property data is a separate thread. Matterport produces 3D digital twins with AI-derived measurements and insights, which reduces unnecessary viewings and helps remote buyers.",
    ],
    choose: [
      "<strong>Lead response time.</strong> In most markets the agent who replies first wins. AI qualification and instant follow-up has the clearest return here.",
      "<strong>Market and jurisdiction.</strong> Valuation models and disclosure rules differ by country and state; coverage matters more than features.",
      "<strong>Photo volume.</strong> Automated tagging and enhancement only pays off at scale.",
      "<strong>CRM integration.</strong> Anything that does not land in the CRM creates a second place to look.",
      "<strong>Accuracy of estimates.</strong> Automated valuations are useful as a range, not a price. Never present one to a client as an appraisal.",
    ],
    jobs: [
      ["Instant lead qualification by text and voice", "Structurely"],
      ["AI marketing and lead nurturing", "Ylopo"],
      ["Property valuation and market analytics", "HouseCanary"],
      ["Auto-tag property photos at scale", "Restb.ai"],
      ["3D digital twins with measurements", "Matterport"],
      ["Agent content and lead tools", "Epique AI"],
      ["Natural-language home search", "Zillow"],
    ],
    watch: [
      "Automated valuations are not appraisals and can be materially wrong in unusual properties or thin markets. Present them as estimates and say so.",
      "Fair-housing law applies to how you target listings and ads. AI-driven targeting can inadvertently exclude protected groups, which is a legal exposure.",
      "AI-written listing descriptions tend to read identically. In a market where every listing says \"stunning\", the specific detail is what differentiates.",
    ],
    faq: [
      ["Are Zillow and Redfin estimates accurate?", "They are reasonable as a rough range for typical homes in active markets, and unreliable for unusual properties, very recent renovations or thin markets. They are not appraisals and should not be relied on for a transaction."],
      ["What is the highest-value AI for a real estate agent?", "Speed of response. Instant, competent qualification and follow-up captures leads that would otherwise go to whoever replied first — which is a direct effect on commission rather than a marginal efficiency."],
      ["Does AI replace a buyer's agent?", "No. It improves search and speeds up research, but negotiation, local knowledge, contract handling and accountability remain human work, and in most markets the legal and fiduciary duties require a licensed person."],
    ],
  },

  data: {
    lead: "Analytics AI is the category where the output is easiest to check — a generated query either returns the right number or it does not.",
    reality: [
      "The established BI platforms have added natural-language layers: Tableau has AI explanations and Pulse, Power BI has Copilot, ThoughtSpot answers questions in plain language. The point is to let people who cannot write SQL ask questions directly.",
      "A newer group works on the data itself rather than the dashboard. Hex provides collaborative notebooks with an AI toolkit, Julius AI and Rows let you interrogate a spreadsheet conversationally, and Mode Analytics writes SQL from a conversational prompt. These are most useful when you are exploring, not reporting.",
      "Predictive and AutoML platforms (DataRobot, H2O.ai, Akkio) are a different purchase entirely. They build models rather than answer questions, and they require the statistical judgement to know whether the model is any good — which is the part no tool supplies.",
    ],
    choose: [
      "<strong>Answering questions or building models?</strong> These are different products with different buyers. Do not evaluate them together.",
      "<strong>Governance.</strong> Who can the AI read? A natural-language layer over a warehouse can expose data a user should not see. Permissions must be enforced at the source.",
      "<strong>Verifiability.</strong> Prefer tools that show the generated SQL, so an analyst can check it.",
      "<strong>Semantic layer quality.</strong> Natural-language analytics is only as good as the metric definitions underneath. Ambiguous definitions produce confidently wrong answers.",
      "<strong>Where your data lives.</strong> Warehouse-native tools avoid moving data; others may not.",
    ],
    jobs: [
      ["Ask questions of your warehouse in plain language", "ThoughtSpot"],
      ["BI with AI explanations", "Tableau"],
      ["Copilot inside Power BI", "Microsoft Power BI"],
      ["Chat with a spreadsheet", "Julius AI"],
      ["Collaborative notebooks with AI assistance", "Hex"],
      ["No-code predictive models", "Akkio"],
      ["Enterprise AutoML", "DataRobot"],
      ["Free dashboarding with auto-charts", "Looker Studio"],
    ],
    watch: [
      "Natural-language analytics will confidently answer a question whose underlying metric is defined ambiguously. The failure looks like a plausible number, not an error.",
      "A conversational layer can bypass row-level security if permissions are enforced in the BI tool rather than the database.",
      "AutoML makes it easy to build a model without understanding whether the data supports one. Overfitting is invisible to anyone who does not check.",
    ],
    faq: [
      ["Can I just ask my data questions in English now?", "For exploration, yes, and it is genuinely useful. For reporting, you still want governed metric definitions — because a natural-language answer inherits every ambiguity in how your metrics are defined."],
      ["Do I need a data warehouse for this?", "It helps a great deal. Natural-language analytics performs far better over well-modelled, documented tables than over raw operational data, and the semantic layer is where most deployments succeed or fail."],
      ["Is AutoML a replacement for a data scientist?", "No. It automates model selection and tuning. Knowing whether the problem is well-posed, whether the data is representative and whether the result is meaningful remains human work — and it is the part that determines whether the model is useful."],
    ],
  },

  travel: {
    lead: "Travel AI is unusual in that the best tools are free and built into the booking platforms you were already going to use.",
    reality: [
      "Itinerary generation is the crowded application. Mindtrip, Layla, Wonderplan, iPlan.ai, Roamer and Wanderlog all turn a description of a trip into a day-by-day plan. The output is a good starting point and a poor final plan — opening hours, travel times and availability change, and models do not always check.",
      "Booking platforms have added assistants of their own. Expedia's Romie, Booking.com's Trip Planner, Hopper's price prediction and Trip.com's TripGenie sit directly next to the inventory, which means they can act on what they recommend rather than just describing it.",
      "Price prediction is the one application with a clear, measurable benefit. Hopper's forecasts and freeze options address the actual anxiety of booking — whether to buy now or wait.",
    ],
    choose: [
      "<strong>Can it book, or only suggest?</strong> An assistant next to real inventory is more useful than one that produces a list you then re-enter elsewhere.",
      "<strong>Does it verify opening hours and availability?</strong> Assume not unless it says so. Always confirm anything time-critical.",
      "<strong>Group collaboration.</strong> For trips involving several people, a shared editable itinerary beats a document you paste into a chat.",
      "<strong>Price flexibility.</strong> If your dates are fixed, price prediction adds little; if they are flexible, it is the most valuable feature here.",
      "<strong>Where your data goes.</strong> Travel plans reveal location and dates. Check what the tool retains.",
    ],
    jobs: [
      ["Group itinerary that everyone can edit", "Roamer"],
      ["Itineraries with shareable booking links", "Mindtrip"],
      ["Free day-by-day itinerary generation", "Wonderplan"],
      ["Map-first planning with collaboration", "Wanderlog"],
      ["Price prediction and booking freezes", "Hopper"],
      ["Assistant inside a booking platform", "Expedia"],
      ["Planning via WhatsApp or Messenger", "GuideGeek"],
    ],
    watch: [
      "Generated itineraries routinely include places that are closed, too far apart to visit in one day, or no longer exist. Treat the plan as a draft and verify the specifics.",
      "AI cannot see live availability or prices reliably. Always confirm before building a trip around a recommendation.",
      "Visa, entry and vaccination rules change and are jurisdiction-specific. Never rely on an AI assistant for these — check the official source.",
    ],
    faq: [
      ["Can AI plan my whole trip?", "It can produce a credible first draft in seconds, which is a real time saving. It cannot reliably know opening hours, seasonal closures, travel times or availability, so the plan needs verifying before you book anything around it."],
      ["Are AI travel planners free?", "Mostly yes — Expedia, Booking.com, Layla, GuideGeek, Wonderplan and Roamer are free because they sit alongside a booking business. Paid tiers add features like offline access or unlimited plans rather than core capability."],
      ["Is it worth paying for price prediction?", "If your travel dates are flexible, yes — knowing whether to book now or wait addresses the main anxiety of booking. If your dates are fixed, it adds little."],
    ],
  },

  gaming: {
    lead: "Gaming AI has two distinct markets: tools that generate game content, and AI that lives inside the game as characters or narrative.",
    reality: [
      "Content generation is the production side. Scenario, Leonardo.Ai and Layer.ai produce consistent art assets in a studio's own style; Promethean AI dresses and populates 3D scenes; Rosebud AI and Ludo.ai support prototyping and design research. The consistent-style requirement is what separates a production tool from a novelty.",
      "In-game AI is the player-facing side. Inworld AI, Convai and Charisma give NPCs dialogue, memory and voice, with Convai supporting spatial awareness in Unreal and Unity. This is where the most interesting work is happening and also where the technical constraints bite hardest — latency, cost per interaction and consistency over long play sessions.",
      "A third group is entertainment rather than development: Character.AI, AI Dungeon and NovelAI are consumer products where the AI is the game. They have large audiences and no bearing on game production.",
    ],
    choose: [
      "<strong>Production or in-game?</strong> These are different purchases with different buyers. Be clear which problem you have.",
      "<strong>Style consistency.</strong> Ask for a set of assets, not one sample. Holding a consistent art style across dozens of assets is the actual requirement.",
      "<strong>Cost per interaction.</strong> For in-game NPCs, inference cost scales with players. Model this before launch, not after.",
      "<strong>Latency.</strong> Dialogue generation that takes seconds breaks immersion. Check real response times under load.",
      "<strong>Rights and training data.</strong> Asset generators trained on unlicensed art are a legal risk for a commercial release.",
    ],
    jobs: [
      ["Consistent game assets in your own style", "Scenario"],
      ["On-brand generative art pipelines", "Layer.ai"],
      ["Populate and dress 3D scenes", "Promethean AI"],
      ["NPCs with dialogue and memory", "Inworld AI"],
      ["Voice-enabled NPCs in Unreal or Unity", "Convai"],
      ["Interactive narrative engines", "Charisma"],
      ["Prototype game ideas quickly", "Rosebud AI"],
      ["Design research and ideation", "Ludo.ai"],
    ],
    watch: [
      "Players notice AI-generated content and are often hostile to it when it replaces work they valued. How you use it matters as much as whether you do.",
      "Inference cost per NPC interaction can scale faster than revenue. Model it against your player count before committing to the design.",
      "Asset generators trained on unlicensed artwork carry legal risk. For a commercial release, verify the training data provenance.",
    ],
    faq: [
      ["Can AI make a whole game?", "It can generate assets, prototype mechanics and write dialogue. It cannot design a game that is fun — that remains an iterative process of playtesting and judgement, and it is the part that determines whether anyone plays."],
      ["Are AI-generated assets safe to ship?", "It depends on the tool's training data and licence. Some generators are trained on licensed or owned material and grant commercial rights; others are not. For a commercial release, confirm the provenance in writing."],
      ["What are AI NPCs actually like to play with?", "Impressive in a demo and harder in practice. The constraints are response latency, cost per interaction, and staying in character consistently over hours of play rather than minutes."],
    ],
  },

  manufacturing: {
    lead: "Industrial AI is the least glamorous category here and among the highest-value — predictive maintenance and defect detection pay for themselves in avoided downtime.",
    reality: [
      "Predictive maintenance is the flagship application. Augury uses vibration and acoustic sensors plus AI to detect machine faults before failure; Uptake and Avathon (formerly SparkCognition) work at the fleet and asset level. In heavy industry an unplanned stoppage is measured in lost production, which is what makes the business case straightforward.",
      "Quality and process analytics is the second area. Falkonry analyses time-series sensor data for production quality; Sight Machine builds plant-wide analytics; Instrumental uses AI cameras to catch assembly defects before products ship.",
      "Machine monitoring and frontline tooling is the accessible entry point. MachineMetrics connects to machines and turns shop-floor data into OEE figures; Tulip provides no-code apps for operators. These require less data science than the enterprise platforms and are often where plants start.",
    ],
    choose: [
      "<strong>Start with one line, not the plant.</strong> Pilot on a single machine or line with a measurable cost of failure.",
      "<strong>Sensor infrastructure.</strong> Predictive maintenance needs data. If the machines are not instrumented, that cost comes first.",
      "<strong>Integration with existing systems.</strong> SCADA, MES and ERP integration is where projects stall.",
      "<strong>Who acts on the alert.</strong> A prediction nobody can respond to is worthless. Define the workflow before buying.",
      "<strong>Measurable outcome.</strong> Agree in advance what success looks like — downtime hours avoided, scrap rate, OEE.",
    ],
    jobs: [
      ["Detect machine faults before failure", "Augury"],
      ["Asset performance across a fleet", "Uptake"],
      ["Catch assembly defects inline", "Instrumental"],
      ["Time-series quality analytics", "Falkonry"],
      ["Plant-wide production analytics", "Sight Machine"],
      ["Connect machines and measure OEE", "MachineMetrics"],
      ["No-code apps for frontline operators", "Tulip Interfaces"],
      ["Industrial AI applications at enterprise scale", "C3 AI"],
    ],
    watch: [
      "Industrial AI projects fail on data and integration far more often than on modelling. Budget accordingly and pilot narrowly.",
      "Alerts without a response workflow train operators to ignore them. Define the escalation path before deployment.",
      "Operators have knowledge the models do not. Tools imposed without their involvement tend to be worked around.",
    ],
    faq: [
      ["What is predictive maintenance?", "Using sensor data — vibration, temperature, acoustics, current draw — to detect the early signatures of machine failure and schedule repair before an unplanned stoppage. It is the industrial AI application with the clearest and most measurable return."],
      ["Do I need new sensors?", "Often yes. Predictive maintenance requires continuous machine data, so if your equipment is not already instrumented, sensor and connectivity costs come before any AI spending."],
      ["Why do industrial AI projects stall?", "Usually integration and data quality rather than the model. Connecting to SCADA, MES and ERP systems, and getting clean enough data to train on, is the hard part — and it is why narrow pilots succeed where plant-wide programmes do not."],
    ],
  },

  agriculture: {
    lead: "Agricultural AI is one of the few categories where the free tools are genuinely competitive — satellite imagery and phone-based diagnosis have removed most of the cost barrier.",
    reality: [
      "Field monitoring is accessible and largely free. OneSoil builds precision-farming maps from satellite data at no cost, and Climate FieldView, Cropwise and xarvio provide agronomic insights on freemium terms. Satellite imagery has made field-level variability visible to any grower with a phone.",
      "Diagnosis from a photograph is the standout consumer-facing application. Plantix identifies crop diseases and pests from a phone photo, which puts expert-adjacent diagnosis in the hands of growers who may be hours from an agronomist.",
      "High-value and specialty crops drive the paid segment. Taranis uses aerial imagery to scout every plant in a field, CropX combines soil moisture sensors with irrigation advice, Arable provides in-field weather sensing, and AgriWebb handles livestock records and grazing planning. These make sense where the value per hectare justifies the hardware.",
    ],
    choose: [
      "<strong>Value per hectare.</strong> The paid precision tools pay off on high-value crops; on low-margin broadacre, the free satellite tools often capture most of the benefit.",
      "<strong>Hardware requirement.</strong> Sensor-based tools need installation and maintenance. Factor that in alongside the subscription.",
      "<strong>Connectivity.</strong> Field-level connectivity is a real constraint in rural areas and determines which tools are usable at all.",
      "<strong>Local agronomy.</strong> Models trained elsewhere may not match your climate, pests or varieties. Test recommendations against local knowledge.",
      "<strong>Whether it fits existing practice.</strong> Tools that require changing established routines get abandoned at harvest.",
    ],
    jobs: [
      ["Free satellite field maps", "OneSoil"],
      ["Diagnose crop disease from a photo", "Plantix"],
      ["Field data and agronomic insights", "Climate FieldView"],
      ["Spray timing and field scouting", "xarvio Field Manager"],
      ["Scout every plant with aerial imagery", "Taranis"],
      ["Soil moisture and irrigation advice", "CropX"],
      ["In-field weather and crop sensing", "Arable"],
      ["Livestock records and grazing planning", "AgriWebb"],
    ],
    watch: [
      "Photo-based diagnosis is a decision aid, not a confirmation. For a treatment decision with real cost, get an agronomist to verify.",
      "Models trained in other regions can misidentify local pests and diseases. Validate against local expertise before acting.",
      "Sensor hardware needs maintenance through the season. A failed sensor in a critical week is worse than no sensor.",
    ],
    faq: [
      ["Are there genuinely free precision-agriculture tools?", "Yes. OneSoil provides satellite-based field maps at no cost, and Plantix offers photo-based crop diagnosis free. Several commercial platforms also have free tiers. The paid tools generally add hardware, higher-resolution imagery or agronomic advisory services."],
      ["How accurate is photo-based disease diagnosis?", "It is a useful first opinion, especially where an agronomist is not nearby. It is not a confirmation, and a misdiagnosis has a real cost — treat it as a prompt to verify rather than a verdict."],
      ["Is AI practical on a small farm?", "The phone-based tools are, because they require no capital investment. The sensor and aerial-imagery platforms generally need enough acreage or crop value to justify the hardware and subscription."],
    ],
  },
};
