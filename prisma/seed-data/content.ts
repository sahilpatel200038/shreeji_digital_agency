import type { Block } from "../../src/lib/blocks/schema";

export const PROJECTS = [
  { name: "Vastu Astro Swami", slug: "vastu-astro-swami", category: "DIGITAL_MARKETING", tags: ["WordPress UI/UX", "Meta & Google Ads", "Social media", "Content", "Video", "SEO"], image: "vastuastroswami.png" },
  { name: "One Center", slug: "one-center", category: "DIGITAL_MARKETING", tags: ["Social media", "Ads", "Content", "Video", "SEO"], image: "onecenter.png" },
  { name: "PickNgo Mart", slug: "pickngo-mart", category: "DIGITAL_MARKETING", tags: ["Social media", "Ads", "Content", "Video", "SEO"], image: "pickgo.png" },
  { name: "Prihaan Spices", slug: "prihaan-spices", category: "DIGITAL_MARKETING", tags: ["Social media", "Ads", "Content", "Video", "SEO"], image: "prihaan.png" },
  { name: "Pufflio", slug: "pufflio", category: "DIGITAL_MARKETING", tags: ["Social media", "Ads", "Content", "Video", "SEO"], image: "pufflio_pic.png" },
  { name: "Shreeji International Courier", slug: "shreeji-international-courier", category: "WEB_DEVELOPMENT", tags: ["Next.js", "UI/UX", "Digital marketing"], image: null },
  { name: "Abundance Educational", slug: "abundance-educational", category: "WEB_DEVELOPMENT", tags: ["PHP", "UI/UX"], image: null },
  { name: "Skyscraper", slug: "skyscraper", category: "WEB_APPLICATION", tags: ["Laravel", "Angular"], image: null },
] as const;

export const FAQS = [
  { category: "General", question: "What industries do you work with?", answer: "We work with real estate, luxury goods, fintech, FMCG, healthcare, retail and B2B services, among others.", showOnHome: true },
  { category: "General", question: "How long does it take to see results?", answer: "Digital campaigns typically show early results in 30 to 60 days. Brand building usually takes three to six months. Timelines depend on your market, budget and starting point.", showOnHome: true },
  { category: "Working together", question: "Is there a minimum engagement?", answer: "Performance campaigns usually run for a minimum of three months, and brand strategy engagements for six months.", showOnHome: true },
  { category: "Working together", question: "How do you measure and report progress?", answer: "Through a live dashboard, weekly email updates and a monthly strategy call.", showOnHome: true },
  { category: "Working together", question: "Do you work with startups and small businesses?", answer: "Yes. We offer tailored packages for startups and SMEs. Contact us to discuss what fits your stage and budget.", showOnHome: true },
] as const;

// Imported from the live site. Hidden from the public site until the owner verifies them in the admin.
export const TESTIMONIALS = [
  { name: "Mitesh Patel", location: "USA", quote: "The relaunch campaign lifted our brand recall by more than 300% within six months." },
  { name: "Margi Desai", location: "India", quote: "Strategic clarity from day one, and we saw a return in the very first quarter." },
  { name: "Vimash Trivedi", location: "India", quote: "It feels like having an in-house marketing department of real quality." },
  { name: "Yogesh Pareskh", location: "UAE", quote: "Their influencer campaign generated more qualified leads in 30 days than our previous agency did in a year." },
  { name: "Dev Patel", location: "India", quote: "They are a partner to our business, not just a vendor." },
] as const;

export const MENUS = {
  header: [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Services", href: "/services" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
  ],
  "footer-company": [
    { label: "About Us", href: "/about" },
    { label: "Our Work", href: "/#work" },
    { label: "Blog", href: "/blog" },
    { label: "FAQ", href: "/faq" },
    { label: "Contact", href: "/contact" },
  ],
  "footer-legal": [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms & Conditions", href: "/terms-and-conditions" },
    { label: "Cookie Policy", href: "/cookie-policy" },
  ],
} as const;

const h2 = (text: string): Block => ({ type: "heading", level: 2, text });
const p = (text: string): Block => ({ type: "paragraph", text });
const ul = (items: string[]): Block => ({ type: "list", ordered: false, items });

export type SeedPage = {
  slug: string;
  title: string;
  template: "DEFAULT" | "CONTACT";
  excerpt: string;
  blocks: Block[];
  seoTitle: string;
  seoDescription: string;
};

export const PAGES: SeedPage[] = [
  {
    slug: "about",
    title: "About Us",
    template: "DEFAULT",
    excerpt: "Precision strategy, creative work and analytics under one roof.",
    seoTitle: "About Shreeji Marketing | Digital Agency in Ahmedabad",
    seoDescription: "Meet Shreeji Marketing: strategists, creatives and analysts in Ahmedabad building brands and growth for businesses.",
    blocks: [
      h2("Precision strategy. Unmatched results."),
      p("Shreeji Marketing is a digital marketing and web development agency based in Ahmedabad, Gujarat. We combine market understanding with creative work so that campaigns are both well thought out and well made."),
      p("Strategists, creatives and analysts work together on every project, so the plan, the creative and the measurement stay connected from the first discovery call to the monthly review."),
      h2("What we focus on"),
      ul(["Brand strategy", "Digital marketing", "Media planning", "Creative direction", "Analytics"]),
      h2("How we work"),
      p("We start by understanding your business and customers, agree measurable goals, and report openly on progress. You get a consistent team rather than a rotating cast of account managers."),
      { type: "cta", title: "Let's talk about your goals", text: "Book a free 30-minute consultation. No commitment required.", label: "Book a free consultation", href: "/contact" },
    ],
  },
  {
    slug: "contact",
    title: "Contact Us",
    template: "CONTACT",
    excerpt: "Tell us about your project and we will get back to you.",
    seoTitle: "Contact Shreeji Marketing | Ahmedabad",
    seoDescription: "Contact Shreeji Marketing in Nikol, Ahmedabad. Call, email or send an enquiry to book a free consultation.",
    blocks: [
      p("Tell us about your business and what you want to achieve. We will reply to arrange a free 30-minute consultation. No commitment required."),
    ],
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    template: "DEFAULT",
    excerpt: "How Shreeji Marketing collects and uses personal information.",
    seoTitle: "Privacy Policy | Shreeji Marketing",
    seoDescription: "How Shreeji Marketing collects, uses and protects personal information submitted through this website.",
    blocks: [
      callout("This is a starter policy. Have it reviewed by a qualified professional before relying on it."),
      h2("Information we collect"),
      p("When you submit our contact form we collect the details you enter: your name, email address, phone number, company, the service you are interested in and your message. We also store a one-way hashed form of your IP address and your browser's user-agent to help prevent spam."),
      h2("How we use it"),
      ul(["To respond to your enquiry", "To prevent abuse and spam", "To improve our website and services"]),
      h2("Analytics"),
      p("If analytics is enabled on this website, it uses cookies or similar technologies to understand how visitors use the site. See our [Cookie Policy](/cookie-policy)."),
      h2("Sharing"),
      p("We do not sell your personal information. We may share it with service providers who help us operate the website and respond to you, or where the law requires."),
      h2("Retention and your rights"),
      p("We keep enquiry details for as long as needed to respond and maintain business records. You can ask us to access, correct or delete your information by emailing us."),
      h2("Contact"),
      p("Questions about this policy: info@shreejidigitalagency.com."),
    ],
  },
  {
    slug: "terms-and-conditions",
    title: "Terms & Conditions",
    template: "DEFAULT",
    excerpt: "The terms for using this website.",
    seoTitle: "Terms & Conditions | Shreeji Marketing",
    seoDescription: "Terms and conditions for using the Shreeji Marketing website.",
    blocks: [
      callout("This is a starter document. Have it reviewed by a qualified professional before relying on it."),
      h2("Using this website"),
      p("By using this website you agree to these terms. Content is provided for general information and may change without notice."),
      h2("Intellectual property"),
      p("Unless stated otherwise, the content, design and logo on this website belong to Shreeji Marketing or its licensors and may not be reproduced without permission."),
      h2("Services"),
      p("Descriptions of services on this website are not a binding offer. The scope, fees and timelines of any engagement are set out in a separate written agreement."),
      h2("No guarantee of results"),
      p("Marketing outcomes depend on many factors outside our control. Nothing on this website is a guarantee of specific results."),
      h2("Limitation of liability"),
      p("To the extent permitted by law, we are not liable for losses arising from the use of this website."),
      h2("Governing law"),
      p("These terms are governed by the laws of India. Courts in Ahmedabad, Gujarat have jurisdiction."),
    ],
  },
  {
    slug: "cookie-policy",
    title: "Cookie Policy",
    template: "DEFAULT",
    excerpt: "How this website uses cookies.",
    seoTitle: "Cookie Policy | Shreeji Marketing",
    seoDescription: "How the Shreeji Marketing website uses cookies and similar technologies.",
    blocks: [
      callout("This is a starter policy. Update it to match the tools you enable, and have it reviewed by a qualified professional."),
      h2("What are cookies"),
      p("Cookies are small text files stored on your device by websites you visit."),
      h2("Cookies we use"),
      ul([
        "Essential: used to keep the administrator area secure. These are not set for ordinary visitors.",
        "Analytics: set only if the site owner has enabled Google Analytics or Google Tag Manager.",
      ]),
      h2("Managing cookies"),
      p("You can block or delete cookies in your browser settings. Blocking analytics cookies will not affect your ability to use the site."),
    ],
  },
];

function callout(text: string): Block {
  return { type: "callout", title: "Note", text };
}

export type SeedPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  blocks: Block[];
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
};

export const POST_CATEGORIES = [
  { slug: "digital-marketing", name: "Digital Marketing" },
  { slug: "seo", name: "SEO" },
  { slug: "web-technology", name: "Web & Technology" },
  { slug: "branding-design", name: "Branding & Design" },
];

export const POSTS: SeedPost[] = [
  {
    slug: "how-to-plan-a-digital-marketing-campaign",
    title: "How to Plan a Digital Marketing Campaign: A Practical Checklist",
    excerpt: "A step-by-step checklist for planning a campaign around a clear goal, a defined audience and measurable results.",
    category: "digital-marketing",
    tags: ["planning", "campaigns"],
    seoTitle: "How to Plan a Digital Marketing Campaign | Shreeji Marketing",
    seoDescription: "A practical checklist for planning a digital marketing campaign: goals, audience, channels, budget and measurement.",
    focusKeyword: "plan a digital marketing campaign",
    blocks: [
      p("A campaign without a clear plan tends to spend money and learn little. This checklist keeps the planning simple and focused."),
      h2("1. Start with one goal"),
      p("Decide what success means: enquiries, sales, sign-ups or awareness. Pick one primary goal so every decision can be tested against it."),
      h2("2. Define your audience"),
      p("Write down who you are trying to reach, what they need and where they spend time online. A narrow, accurate audience beats a broad guess."),
      h2("3. Choose channels to match"),
      ul(["Search (SEO and ads) for people already looking", "Social media for awareness and community", "Email for people who already know you"]),
      h2("4. Set a budget and a timeframe"),
      p("Agree what you can invest and how long you will run the campaign before judging results, so decisions are not made on a few days of data."),
      h2("5. Decide how you will measure"),
      p("Choose the numbers you will review each week and make sure tracking is working before launch."),
      { type: "cta", title: "Want help planning yours?", text: "Talk to us about your goals and we will suggest a practical plan.", label: "Book a free consultation", href: "/contact" },
      p("Learn more about our [digital marketing services](/services/digital-marketing)."),
    ],
  },
  {
    slug: "technical-seo-basics-for-business-websites",
    title: "Technical SEO Basics Every Business Website Should Cover",
    excerpt: "The fundamentals that let search engines find, understand and index your website.",
    category: "seo",
    tags: ["technical seo", "website"],
    seoTitle: "Technical SEO Basics for Business Websites | Shreeji Marketing",
    seoDescription: "Technical SEO fundamentals for business websites: crawlability, speed, sitemaps, canonical URLs and structured data.",
    focusKeyword: "technical SEO basics",
    blocks: [
      p("Great content cannot rank if search engines struggle to access it. These are the technical basics worth checking first."),
      h2("Make sure pages can be crawled and indexed"),
      p("Use real links for navigation, avoid blocking important pages in robots.txt and submit an XML sitemap listing the pages you want indexed."),
      h2("Use clear, unique page titles and descriptions"),
      p("Each page should have its own title and meta description describing what the page is about."),
      h2("Set canonical URLs"),
      p("Canonical tags tell search engines which version of a page is the main one when similar URLs exist."),
      h2("Keep the site fast and mobile friendly"),
      ul(["Compress and correctly size images", "Avoid unnecessary scripts", "Test on real phones"]),
      h2("Add structured data where it fits"),
      p("Structured data helps search engines understand your business and content. Only mark up what is actually visible on the page."),
      p("If you would like an audit, see our [SEO services](/services/seo)."),
    ],
  },
  {
    slug: "what-makes-a-good-business-website",
    title: "What Makes a Good Business Website?",
    excerpt: "Clear messaging, simple navigation, speed and a visible next step: what to look for in your website.",
    category: "web-technology",
    tags: ["website", "ux"],
    seoTitle: "What Makes a Good Business Website? | Shreeji Marketing",
    seoDescription: "The essentials of a good business website: clear messaging, easy navigation, speed, trust signals and a clear call to action.",
    focusKeyword: "good business website",
    blocks: [
      p("A business website has a job: help the right visitors understand what you do and take the next step. Here is what usually matters most."),
      h2("Say what you do, quickly"),
      p("A visitor should understand who you help and what you offer within a few seconds of landing on the page."),
      h2("Make navigation obvious"),
      p("Keep the main menu short, use plain labels and make sure every important page is reachable in a click or two."),
      h2("Load fast on every device"),
      p("Slow pages lose visitors. Optimise images, limit scripts and test on mobile connections."),
      h2("Show proof honestly"),
      p("Real client work, real testimonials with permission and clear contact details build trust. Avoid claims you cannot support."),
      h2("Always offer a next step"),
      p("Every page should point to a clear action, such as a contact form, a call or a booking link."),
      p("Looking for a new site? See our [web and app development](/services/web-app-development) service."),
    ],
  },
];
