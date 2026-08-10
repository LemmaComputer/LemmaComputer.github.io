export type SiteMode = 'private-prototype' | 'public';

export const site: {
  name: string;
  description: string;
  productHost: string;
  githubHref: string;
  siteMode: SiteMode;
} = {
  name: 'LemmaComputer',
  description:
    'Bring any AI agent — Claude, Codex, Hermes — onto one governed computer. Managed workspaces, an egress firewall, tool approvals, and a signed trail, so you get enterprise freedom without losing control.',
  // The live product. Shown verbatim in the faux browser chrome on each shot.
  productHost: 'lemmacomputer',
  // Primary CTA — the open-source repo. A real external destination, opened in a
  // new tab from the hero and close CTAs.
  githubHref: 'https://github.com/ONE-Computer/LemmaComputer',
  siteMode: 'public',
};
