export type SeedService = {
  slug: string;
  category: "marketing-growth" | "web-technology";
  title: string;
  icon: string;
  summary: string;
  heroHeading: string;
  intro: string;
  benefits: { title: string; text: string }[];
  included: string[];
  process: { title: string; text: string }[];
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  related: string[];
};

const stdProcess = (a: string, b: string, c: string, d: string) => [
  { title: "Discover", text: a },
  { title: "Plan", text: b },
  { title: "Deliver", text: c },
  { title: "Review & improve", text: d },
];

export const SERVICES: SeedService[] = [
  {
    slug: "brand-strategy",
    category: "marketing-growth",
    title: "Brand Strategy",
    icon: "target",
    summary: "Brand identities, positioning, visual language and voice that make your business easy to recognise and remember.",
    heroHeading: "A brand people recognise, trust and remember",
    intro:
      "Brand strategy is the foundation every campaign, website and piece of content is built on. We define who you are for, what you stand for and how you sound, then turn that into a visual and verbal identity your team can apply consistently.",
    benefits: [
      { title: "Clear positioning", text: "A sharp answer to why customers should choose you over alternatives." },
      { title: "Consistent identity", text: "One visual language and voice across web, social, print and sales material." },
      { title: "Faster decisions", text: "Brand guidelines remove guesswork from design, copy and campaign work." },
    ],
    included: ["Brand identity and logo direction", "Market and competitor positioning", "Visual language: colour, type, imagery", "Brand voice and messaging", "Brand guidelines"],
    process: stdProcess(
      "We learn your business, audience, competitors and goals through a short discovery session.",
      "We define positioning, messaging and the visual direction for your approval.",
      "We produce the identity assets and a guideline document your team can use.",
      "We check how the brand performs in real use and refine where needed.",
    ),
    seoTitle: "Brand Strategy Services in Ahmedabad | Shreeji Marketing",
    seoDescription: "Brand identity, positioning, visual language and voice from Shreeji Marketing in Ahmedabad. Book a free consultation.",
    focusKeyword: "brand strategy agency",
    related: ["creative-production", "ui-ux-graphics-design", "digital-marketing"],
  },
  {
    slug: "digital-marketing",
    category: "marketing-growth",
    title: "Digital Marketing",
    icon: "megaphone",
    summary: "SEO, paid advertising, social media and content campaigns planned around your goals and reported transparently.",
    heroHeading: "Digital campaigns built around your business goals",
    intro:
      "We plan and run integrated digital campaigns across search, social and paid channels. Every campaign starts with a goal, a target audience and the numbers we will report against, so you always know what is working.",
    benefits: [
      { title: "Integrated channels", text: "Search, social, paid and content work together instead of in silos." },
      { title: "Goal-led planning", text: "Campaigns are tied to enquiries, sales or reach, not vanity metrics." },
      { title: "Transparent reporting", text: "Regular reports and review calls so decisions are based on data." },
    ],
    included: ["Meta and Google Ads management", "Social media management", "Content and video campaigns", "SEO support", "Campaign reporting"],
    process: stdProcess(
      "We audit your current presence, audience and competitors.",
      "We agree goals, channels, budget and the metrics to report.",
      "We launch campaigns and publish content across the chosen channels.",
      "We review results, test improvements and adjust the plan each cycle.",
    ),
    seoTitle: "Digital Marketing Services in Ahmedabad | Shreeji Marketing",
    seoDescription: "SEO, Meta and Google Ads, social media and content campaigns from Shreeji Marketing in Ahmedabad. Get a free consultation.",
    focusKeyword: "digital marketing services Ahmedabad",
    related: ["seo", "lead-generation", "analytics-insights"],
  },
  {
    slug: "media-planning",
    category: "marketing-growth",
    title: "Media Planning",
    icon: "layout",
    summary: "Planning and buying across print, broadcast, outdoor and digital media to reach the right audience efficiently.",
    heroHeading: "Reach the right audience across the right media",
    intro:
      "Good media planning matches your audience to the channels they actually use. We plan and buy across traditional and digital media so your budget goes where it can do the most for your goals.",
    benefits: [
      { title: "Audience-first channel mix", text: "Channels are chosen from who you need to reach, not from habit." },
      { title: "Budget discipline", text: "A clear plan for how spend is split and what each channel is expected to do." },
      { title: "One partner for all media", text: "Print, broadcast, outdoor and digital coordinated under one plan." },
    ],
    included: ["Media strategy and channel mix", "Print and broadcast planning", "Outdoor and out-of-home planning", "Digital media buying", "Post-campaign review"],
    process: stdProcess(
      "We define the audience, geography, timing and goals.",
      "We build a channel plan and budget split for approval.",
      "We negotiate, book and monitor placements.",
      "We review delivery against the plan and feed lessons into the next one.",
    ),
    seoTitle: "Media Planning & Buying Services | Shreeji Marketing",
    seoDescription: "Media planning and buying across print, broadcast, outdoor and digital from Shreeji Marketing, Ahmedabad.",
    focusKeyword: "media planning agency",
    related: ["digital-marketing", "brand-strategy", "analytics-insights"],
  },
  {
    slug: "creative-production",
    category: "marketing-growth",
    title: "Creative Production",
    icon: "camera",
    summary: "Photography, video, copywriting and design that bring your brand to life across every channel.",
    heroHeading: "Creative that looks sharp and says something",
    intro:
      "Strong creative makes campaigns work harder. Our team produces photography, video, copy and design assets for websites, social media, advertising and print, all guided by your brand identity.",
    benefits: [
      { title: "In-house range", text: "Photo, video, copy and design handled by one coordinated team." },
      { title: "On-brand output", text: "Everything follows your brand guidelines for a consistent look." },
      { title: "Made for the channel", text: "Assets are sized and written for where they will actually run." },
    ],
    included: ["Photography", "Video production and editing", "Copywriting", "Graphic and social design", "Ad creatives"],
    process: stdProcess(
      "We agree the brief, audience and where the content will be used.",
      "We prepare concepts, scripts and shot lists for approval.",
      "We produce and edit the final assets.",
      "We review performance and refine future creative.",
    ),
    seoTitle: "Creative Production: Video, Photo & Copy | Shreeji Marketing",
    seoDescription: "Photography, video, copywriting and design for brands from Shreeji Marketing in Ahmedabad.",
    focusKeyword: "creative production agency",
    related: ["brand-strategy", "ui-ux-graphics-design", "influencer-marketing"],
  },
  {
    slug: "influencer-marketing",
    category: "marketing-growth",
    title: "Influencer Marketing",
    icon: "users",
    summary: "Curated influencer partnerships that put your brand in front of engaged audiences.",
    heroHeading: "Partnerships with creators your audience already follows",
    intro:
      "We help you find, brief and manage influencers whose audience and style fit your brand. The focus is relevance and authenticity, not just follower counts.",
    benefits: [
      { title: "Relevant creators", text: "Matched on audience, content style and brand fit." },
      { title: "Managed end to end", text: "Outreach, briefing, approvals and posting handled for you." },
      { title: "Measured outcomes", text: "Reach, engagement and enquiries tracked against the campaign goal." },
    ],
    included: ["Influencer research and shortlisting", "Outreach and negotiation", "Campaign briefs and content approvals", "Campaign management", "Performance reporting"],
    process: stdProcess(
      "We define campaign goals and the audience to reach.",
      "We shortlist creators and agree the content plan.",
      "We manage briefs, content approval and publishing.",
      "We report results and decide on follow-up collaborations.",
    ),
    seoTitle: "Influencer Marketing Agency in India | Shreeji Marketing",
    seoDescription: "Curated influencer partnerships and campaign management from Shreeji Marketing. Reach engaged audiences.",
    focusKeyword: "influencer marketing agency India",
    related: ["digital-marketing", "creative-production", "analytics-insights"],
  },
  {
    slug: "analytics-insights",
    category: "marketing-growth",
    title: "Analytics & Insights",
    icon: "chart",
    summary: "Performance analytics and market intelligence that turn raw numbers into decisions.",
    heroHeading: "Know what is working and what to do next",
    intro:
      "Data is only useful when it leads to a decision. We set up tracking, build clear dashboards and explain results in plain language so you can invest in what works.",
    benefits: [
      { title: "Reliable tracking", text: "Events, conversions and campaigns tracked consistently." },
      { title: "Clear reporting", text: "Live dashboards, weekly updates and monthly review calls." },
      { title: "Actionable insight", text: "Each report ends with recommended next steps." },
    ],
    included: ["Analytics and tracking setup", "Dashboards and reporting", "Market and competitor research", "A/B testing support", "Monthly review calls"],
    process: stdProcess(
      "We review your goals and what is currently measured.",
      "We define KPIs and implement tracking.",
      "We build dashboards and a reporting rhythm.",
      "We review results with you and agree improvements.",
    ),
    seoTitle: "Marketing Analytics & Reporting | Shreeji Marketing",
    seoDescription: "Analytics setup, dashboards and market insight from Shreeji Marketing to guide your marketing decisions.",
    focusKeyword: "marketing analytics services",
    related: ["digital-marketing", "lead-generation", "seo"],
  },
  {
    slug: "lead-generation",
    category: "marketing-growth",
    title: "Lead Generation",
    icon: "funnel",
    summary: "Outbound and inbound pipeline building: LinkedIn outreach, email automation, landing funnels and CRM management.",
    heroHeading: "A steadier pipeline of qualified enquiries",
    intro:
      "We build repeatable lead generation systems that combine outbound outreach with inbound funnels, and keep follow-up organised in a CRM so no enquiry is lost.",
    benefits: [
      { title: "Outbound and inbound", text: "Proactive outreach plus landing pages that convert interest into enquiries." },
      { title: "Quality over volume", text: "Targeting and qualification focused on leads you can actually serve." },
      { title: "Organised follow-up", text: "CRM set-up and management so every lead is tracked." },
    ],
    included: ["LinkedIn outreach", "Email automation", "Landing pages and funnels", "CRM management", "Lead reporting"],
    process: stdProcess(
      "We define your ideal customer and what qualifies as a good lead.",
      "We design the outreach sequences and funnel.",
      "We launch outreach and manage incoming leads.",
      "We review lead quality and refine targeting and messaging.",
    ),
    seoTitle: "B2B Lead Generation Services | Shreeji Marketing",
    seoDescription: "LinkedIn outreach, email automation, landing funnels and CRM management from Shreeji Marketing.",
    focusKeyword: "lead generation services",
    related: ["digital-marketing", "analytics-insights", "web-app-development"],
  },
  {
    slug: "seo",
    category: "marketing-growth",
    title: "SEO",
    icon: "search",
    summary: "Technical audits, content strategy, link building and monthly reporting to grow organic search visibility.",
    heroHeading: "Be found by people already searching for what you offer",
    intro:
      "Search engine optimisation brings steady, qualified visitors without paying per click. We fix technical issues, build content around real search intent and report progress every month. No one can guarantee rankings, and we do not.",
    benefits: [
      { title: "Technical foundation", text: "Crawling, indexing, speed and structure fixed first." },
      { title: "Intent-led content", text: "Pages written for what your customers actually search." },
      { title: "Honest reporting", text: "Monthly reports on visibility, traffic and enquiries." },
    ],
    included: ["Technical SEO audit", "Keyword and content strategy", "On-page optimisation", "Link building", "Monthly reports"],
    process: stdProcess(
      "We audit your site, search visibility and competitors.",
      "We prioritise fixes and map keywords to pages.",
      "We implement technical fixes and publish optimised content.",
      "We track results monthly and keep improving.",
    ),
    seoTitle: "SEO Services in Ahmedabad | Shreeji Marketing",
    seoDescription: "Technical SEO audits, content strategy, link building and monthly reporting from Shreeji Marketing in Ahmedabad.",
    focusKeyword: "SEO services in Ahmedabad",
    related: ["digital-marketing", "web-app-development", "analytics-insights"],
  },
  {
    slug: "web-app-development",
    category: "web-technology",
    title: "Web & App Development",
    icon: "code",
    summary: "Websites, web apps and mobile apps built with React, Next.js, Node.js, Laravel and more, with API and CMS integrations.",
    heroHeading: "Websites and apps built to perform and to last",
    intro:
      "We design and build fast, secure and maintainable websites, web applications and mobile apps. From marketing sites and e-commerce to custom business tools, we choose the technology that fits the job.",
    benefits: [
      { title: "Modern stack", text: "React, Next.js, Node.js and other proven technologies." },
      { title: "Integrations", text: "APIs, payment, CRM and CMS integrations that fit your workflow." },
      { title: "Built for search", text: "Clean structure and speed that support SEO from day one." },
    ],
    included: ["Business websites", "E-commerce", "Custom web applications", "iOS and Android apps", "API and CMS integrations"],
    process: stdProcess(
      "We gather requirements and define scope.",
      "We design the experience and technical approach.",
      "We build, test and launch in stages.",
      "We support, monitor and iterate after launch.",
    ),
    seoTitle: "Web & App Development in Ahmedabad | Shreeji Marketing",
    seoDescription: "Websites, web apps and mobile apps built with Next.js, React, Node.js and Laravel by Shreeji Marketing.",
    focusKeyword: "web development company Ahmedabad",
    related: ["ui-ux-graphics-design", "web-hosting", "seo"],
  },
  {
    slug: "web-hosting",
    category: "web-technology",
    title: "Web Hosting",
    icon: "server",
    summary: "Managed cloud hosting with SSL, domains, backups and CDN so your website stays online and fast.",
    heroHeading: "Hosting that keeps your site fast, secure and backed up",
    intro:
      "We manage the hosting side of your website so you do not have to: cloud servers, SSL certificates, domain set-up, regular backups and a CDN for faster delivery.",
    benefits: [
      { title: "Managed for you", text: "Server set-up and upkeep handled by our team." },
      { title: "Secure by default", text: "SSL certificates and regular backups included." },
      { title: "Faster delivery", text: "CDN support for quicker page loads." },
    ],
    included: ["Managed cloud hosting", "SSL and domain management", "Daily backups", "CDN", "Support"],
    process: stdProcess(
      "We review your site and traffic needs.",
      "We choose and configure the right hosting set-up.",
      "We migrate or deploy and test everything.",
      "We monitor, back up and support the site.",
    ),
    seoTitle: "Managed Web Hosting with SSL & Backups | Shreeji Marketing",
    seoDescription: "Managed cloud hosting, SSL, domains, daily backups and CDN from Shreeji Marketing.",
    focusKeyword: "managed web hosting India",
    related: ["web-app-development", "ui-ux-graphics-design", "seo"],
  },
  {
    slug: "ui-ux-graphics-design",
    category: "web-technology",
    title: "UI/UX & Graphics Design",
    icon: "pen",
    summary: "Wireframes, prototypes, logos, social graphics and print collateral designed around how people actually use them.",
    heroHeading: "Design that is clear to use and consistent everywhere",
    intro:
      "From interface design to logos and print, we design with the user and the brand in mind. Wireframes and prototypes let you see and test ideas before development begins.",
    benefits: [
      { title: "User-focused", text: "Layouts and flows designed around real user tasks." },
      { title: "Prototype first", text: "Review and refine before a line of code is written." },
      { title: "Brand-consistent", text: "Graphics and interfaces that share one identity." },
    ],
    included: ["Wireframes and prototypes", "UI design", "Logo and brand graphics", "Social media graphics", "Print collateral"],
    process: stdProcess(
      "We learn about your users, goals and brand.",
      "We map flows and create wireframes.",
      "We design and prototype the interface and graphics.",
      "We gather feedback and refine before handoff.",
    ),
    seoTitle: "UI/UX & Graphic Design Agency | Shreeji Marketing",
    seoDescription: "UI/UX design, logos, social graphics and print collateral from Shreeji Marketing in Ahmedabad.",
    focusKeyword: "UI UX design agency Ahmedabad",
    related: ["web-app-development", "brand-strategy", "creative-production"],
  },
  {
    slug: "custom-software-development",
    category: "web-technology",
    title: "Custom Software Development",
    icon: "code",
    summary: "Bespoke business software, dashboards and integrations built around the way your team actually works.",
    heroHeading: "Software built around your business, not the other way round",
    intro:
      "When off-the-shelf tools do not fit, we design and build custom software: internal tools, portals, dashboards and integrations. We start from your workflow and build in stages so you see progress early.",
    benefits: [
      { title: "Fits your workflow", text: "Built around your processes instead of forcing your team to adapt to generic tools." },
      { title: "Staged delivery", text: "Working releases at each stage so you can review and steer as we go." },
      { title: "Maintainable code", text: "Clear structure and documentation so the software can grow with you." },
    ],
    included: ["Requirements and scoping", "Custom web applications and portals", "Dashboards and reporting", "API and third-party integrations", "Testing, deployment and support"],
    process: stdProcess(
      "We map your workflow and define what the software must do.",
      "We agree the scope, technical approach and release stages.",
      "We build, test and release in stages with your feedback.",
      "We support, monitor and extend the software after launch.",
    ),
    seoTitle: "Custom Software Development in Ahmedabad | Shreeji Marketing",
    seoDescription: "Custom business software, web applications, dashboards and integrations from Shreeji Marketing in Ahmedabad.",
    focusKeyword: "custom software development Ahmedabad",
    related: ["web-app-development", "ui-ux-graphics-design", "web-hosting"],
  },
  {
    slug: "ads-management",
    category: "marketing-growth",
    title: "Ads Management",
    icon: "chart",
    summary: "Paid campaigns on search and social platforms, planned, run and optimised against your goals.",
    heroHeading: "Paid advertising managed for enquiries and sales, not just clicks",
    intro:
      "We plan, launch and optimise paid campaigns across search and social platforms. Budgets, audiences, creative and landing pages are tested and refined, and results are reported against the goal you set.",
    benefits: [
      { title: "Goal-led campaigns", text: "Targeting and budgets set against enquiries, sales or reach." },
      { title: "Continuous optimisation", text: "Audiences, creative and bids are tested and refined as data comes in." },
      { title: "Clear reporting", text: "You see spend, results and next steps in regular reports." },
    ],
    included: ["Campaign strategy and budgeting", "Search and social ad set-up", "Ad creative and copy", "Conversion tracking", "Optimisation and reporting"],
    process: stdProcess(
      "We define goals, audiences and budget.",
      "We plan the campaign structure, creative and tracking.",
      "We launch the campaigns and monitor them closely.",
      "We optimise and report, then scale what works.",
    ),
    seoTitle: "Ads Management & PPC Services | Shreeji Marketing",
    seoDescription: "Paid search and social ads management from Shreeji Marketing: strategy, creative, tracking and optimisation.",
    focusKeyword: "ads management agency",
    related: ["digital-marketing", "seo", "analytics-insights"],
  },
  {
    slug: "ugc-content-creation",
    category: "marketing-growth",
    title: "UGC Content Creation",
    icon: "camera",
    summary: "Authentic, creator-style video and photo content for your social channels and ads.",
    heroHeading: "Authentic creator-style content that feels real",
    intro:
      "User-generated style content builds trust because it looks and sounds like real people. We brief creators, manage production and deliver content formatted for your social channels and paid ads.",
    benefits: [
      { title: "Authentic look and feel", text: "Content that reads as genuine rather than overproduced." },
      { title: "Ready for every channel", text: "Formats and lengths prepared for social feeds, stories and ads." },
      { title: "Managed for you", text: "Briefing, production and approvals handled by our team." },
    ],
    included: ["Content concepts and scripts", "Creator sourcing and briefing", "Video and photo production", "Editing and formatting", "Usage-ready delivery"],
    process: stdProcess(
      "We learn about your product, audience and goals.",
      "We develop content concepts and brief the creators.",
      "We manage production, review and editing.",
      "We deliver final content and review how it performs.",
    ),
    seoTitle: "UGC Content Creation Services | Shreeji Marketing",
    seoDescription: "Authentic UGC-style video and photo content for social media and ads from Shreeji Marketing.",
    focusKeyword: "UGC content creation",
    related: ["social-media-marketing", "influencer-marketing", "creative-production"],
  },
  {
    slug: "social-media-marketing",
    category: "marketing-growth",
    title: "Social Media Marketing",
    icon: "megaphone",
    summary: "Content, community and campaigns on the social platforms where your customers spend their time.",
    heroHeading: "Social media that builds an audience and drives enquiries",
    intro:
      "We plan content calendars, create posts and campaigns, and manage your presence across the social platforms that matter for your audience. Performance is tracked so the plan keeps improving.",
    benefits: [
      { title: "Consistent presence", text: "A planned content calendar keeps your brand visible and on message." },
      { title: "Platform-specific content", text: "Posts and creative made for how each platform is used." },
      { title: "Measured results", text: "Reach, engagement and enquiries reported on a regular schedule." },
    ],
    included: ["Social media strategy", "Content calendar and creative", "Community management", "Campaign support", "Monthly performance reports"],
    process: stdProcess(
      "We review your brand, audience and current channels.",
      "We build the strategy and content calendar.",
      "We create, publish and manage content and community.",
      "We analyse performance and refine the plan.",
    ),
    seoTitle: "Social Media Marketing Agency in Ahmedabad | Shreeji Marketing",
    seoDescription: "Social media strategy, content and community management from Shreeji Marketing in Ahmedabad.",
    focusKeyword: "social media marketing agency Ahmedabad",
    related: ["ugc-content-creation", "influencer-marketing", "digital-marketing"],
  },
];

export const SERVICE_CATEGORIES = [
  { slug: "marketing-growth", name: "Marketing & Growth", description: "Strategy, campaigns and measurement that grow your brand and pipeline.", sortOrder: 1 },
  { slug: "web-technology", name: "Web & Technology", description: "Websites, apps, hosting and design built to perform.", sortOrder: 2 },
];

/** Display names applied by the seed for services that were renamed when the eight core services were defined. */
export const CORE_SERVICE_RENAMES: Record<string, { from: string; to: string }> = {
  "web-app-development": { from: "Web & App Development", to: "Web / App Development & Design" },
  seo: { from: "SEO", to: "Search Engine Optimization" },
};
