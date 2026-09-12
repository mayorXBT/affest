export const docsNav = [
  {
    label: 'Getting started',
    items: [
      { href: '/docs', title: 'What Affest is' },
      { href: '/docs/start', title: 'Connect and deposit' },
      { href: '/docs/how-it-works', title: 'How it works' },
    ],
  },
  {
    label: 'Product',
    items: [
      { href: '/docs/strategies', title: 'Strategies' },
      { href: '/docs/builder', title: 'If/Else and filters' },
    ],
  },
  {
    label: 'Protocol',
    items: [
      { href: '/docs/attestcoin', title: 'Attestcoin summary' },
      { href: '/docs/proofs', title: 'Proofs' },
      { href: '/docs/mcp', title: 'MCP agents' },
      { href: '/docs/chatgpt', title: 'ChatGPT' },
      { href: '/docs/chains', title: 'Chains and contracts' },
    ],
  },
  {
    label: 'Safety',
    items: [
      { href: '/docs/security', title: 'Security' },
      { href: '/docs/testnet', title: 'Testnet notes' },
      { href: '/docs/errors', title: 'Errors' },
    ],
  },
] as const;

export function docsPage(pathname: string) {
  for (const group of docsNav) {
    const match = group.items.find((item) => item.href === pathname);
    if (match) return { group: group.label, title: match.title };
  }
  return { group: 'Getting started', title: 'What Affest is' };
}
