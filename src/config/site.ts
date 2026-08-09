export type SiteMode = 'private-prototype' | 'public';

export const site: {
  name: string;
  description: string;
  productHost: string;
  requestAccessHref: string;
  siteMode: SiteMode;
} = {
  name: 'LemmaComputer',
  description:
    'Bring any AI agent — Claude, Codex, Hermes — onto one governed computer. Managed workspaces, an egress firewall, tool approvals, and a signed trail, so you get enterprise freedom without losing control.',
  // The live product. Shown verbatim in the faux browser chrome on each shot.
  productHost: 'onecomputer.metech.dev',
  // Single primary CTA. Placeholder until a real destination is approved — kept
  // as a mailto so it is never a dead in-page anchor (mirrors LemmaLabs' gate).
  requestAccessHref: 'mailto:hello@lemmalabs.ai?subject=LemmaComputer%20access',
  siteMode: 'private-prototype',
};
