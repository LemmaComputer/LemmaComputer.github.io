export type SiteMode = 'private-prototype' | 'public';

export const site: {
  name: string;
  /** Product tagline — the <title> suffix and OG title. */
  tagline: string;
  description: string;
  productHost: string;
  githubHref: string;
  siteMode: SiteMode;
  /** Publisher. Drives the JSON-LD Organization node and footer lineage. */
  publisher: string;
  /** Comma-joined into the <meta name="keywords"> and mirrored in JSON-LD. */
  keywords: string[];
  /** Absolute URLs that identify the same entity — feeds JSON-LD sameAs. */
  sameAs: string[];
  /** Path (relative to the site root) of the 1200×630 social share image. */
  ogImage: string;
  /** X/Twitter @handle for the card attribution, or '' to omit. */
  twitterHandle: string;
} = {
  name: 'LemmaComputer',
  tagline: 'Any agent. One governed computer.',
  description:
    'Bring any AI agent — Claude, Codex, Hermes, or your own — onto one governed computer. Each agent runs in an isolated Ubuntu workspace behind an egress firewall, with tool approvals and a signed, replayable audit trail. Open-source enterprise AI-agent governance without the trade-off between freedom and control.',
  // The live product. Shown verbatim in the faux browser chrome on each shot.
  productHost: 'lemmacomputer',
  // Primary CTA — the open-source repo. A real external destination, opened in a
  // new tab from the hero and close CTAs.
  githubHref: 'https://github.com/ONE-Computer/LemmaComputer',
  siteMode: 'public',
  publisher: 'LemmaLabs',
  // Keyword intent this page should rank for — governance-of-AI-agents queries.
  // Kept honest to what the page actually demonstrates; no keyword stuffing.
  keywords: [
    'AI agent governance',
    'governed computer for AI agents',
    'AI agent sandbox',
    'agent egress firewall',
    'AI audit trail',
    'agent tool approvals',
    'Claude agent',
    'Codex agent',
    'sandboxed AI desktop',
    'enterprise AI agent security',
    'open source AI agent runtime',
    'LemmaComputer',
  ],
  // Same-entity identities for the Organization/SoftwareApplication graph.
  sameAs: ['https://github.com/ONE-Computer/LemmaComputer'],
  // Emitted to /og.jpg at the site root; a 1200×630 screenshot of the live
  // hero, saved as an optimized progressive JPEG for fast link unfurls.
  ogImage: '/og.jpg',
  twitterHandle: '',
};
