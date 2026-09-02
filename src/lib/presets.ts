// Website-type presets so the same chatbot product drops cleanly onto any kind
// of site — blog, e-commerce, listing/marketplace, SaaS, or a generic custom
// site. Each preset seeds a sensible system prompt, quick replies and a few
// starter Q&As. Used when the super admin provisions an account/bot.

export type WebsitePreset = {
  label: string;
  systemPrompt: string;
  quickReplies: string[];
  qas: { q: string; a: string; k: string }[];
};

export const WEBSITE_PRESETS: Record<string, WebsitePreset> = {
  custom: {
    label: "Custom / Other",
    systemPrompt: "You are a helpful customer support assistant. Answer briefly and politely.",
    quickReplies: ["Pricing", "Support", "Contact"],
    qas: [
      { q: "How can I contact support?", a: "You can reach our team through this chat or the contact form. We'll get back to you shortly.", k: "contact,support,help,reach" },
      { q: "What are your hours?", a: "We're available Mon–Fri, 9am–7pm.", k: "hours,timing,open,available" },
    ],
  },
  blog: {
    label: "Blog / Content",
    systemPrompt: "You are a friendly assistant for a content/blog website. Help readers find articles, answer questions about topics covered, and guide them to subscribe.",
    quickReplies: ["Popular posts", "Subscribe", "Topics"],
    qas: [
      { q: "How do I subscribe to the newsletter?", a: "Enter your email in the subscribe box on any page and you'll get new posts in your inbox.", k: "subscribe,newsletter,email,follow" },
      { q: "What topics do you cover?", a: "We cover a range of topics — ask me about any subject and I'll point you to relevant articles.", k: "topics,articles,categories,about" },
    ],
  },
  ecommerce: {
    label: "E-commerce / Store",
    systemPrompt: "You are a sales and support assistant for an online store. Help customers find products, answer questions about shipping, returns, payments and order status, and encourage purchases.",
    quickReplies: ["Track my order", "Shipping & returns", "Payment options"],
    qas: [
      { q: "What is your return policy?", a: "We accept returns within 30 days of delivery for unused items in original packaging.", k: "return,refund,exchange,policy" },
      { q: "How long does shipping take?", a: "Standard shipping takes 3–7 business days. Express options are available at checkout.", k: "shipping,delivery,dispatch,time" },
      { q: "How do I track my order?", a: "Share your order number and email and I'll help you check the status.", k: "track,order,status,tracking" },
      { q: "What payment methods do you accept?", a: "We accept major cards, UPI, net banking and popular wallets.", k: "payment,pay,card,upi,methods" },
    ],
  },
  listing: {
    label: "Listing / Marketplace",
    systemPrompt: "You are an assistant for a listings/marketplace website (properties, jobs, classifieds, directories). Help users search listings, understand how to post, and contact sellers/owners.",
    quickReplies: ["Search listings", "Post a listing", "Contact seller"],
    qas: [
      { q: "How do I post a listing?", a: "Click 'Post' / 'Add listing', fill in the details and photos, then publish. It only takes a couple of minutes.", k: "post,add,create,listing,submit" },
      { q: "How do I contact a seller?", a: "Open the listing and use the contact/enquiry button to message the owner directly.", k: "contact,seller,owner,enquiry,message" },
      { q: "Is posting free?", a: "Basic listings are free. Featured/premium placements are available for more visibility.", k: "free,price,cost,featured,premium" },
    ],
  },
  saas: {
    label: "SaaS / App",
    systemPrompt: "You are a product support assistant for a SaaS application. Help users with onboarding, features, billing, and troubleshooting. Offer to connect them to a human for account-specific issues.",
    quickReplies: ["Pricing", "Book a demo", "Documentation"],
    qas: [
      { q: "Do you offer a free trial?", a: "Yes — you can start a free trial and upgrade anytime. No credit card required to begin.", k: "trial,free,demo,start" },
      { q: "How does billing work?", a: "Plans are billed monthly or yearly. You can change or cancel your plan from your account settings.", k: "billing,plan,subscription,cancel,upgrade" },
      { q: "Where is the documentation?", a: "Our docs cover setup and features. Ask me anything and I'll point you to the right place.", k: "docs,documentation,guide,help,api" },
    ],
  },
};

export const WEBSITE_TYPE_OPTIONS = Object.entries(WEBSITE_PRESETS).map(([value, p]) => ({ value, label: p.label }));
