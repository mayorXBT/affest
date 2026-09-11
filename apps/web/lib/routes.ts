export const routes = [
  { href: '/', label: 'Overview' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/strategies', label: 'Strategies' },
  { href: '/activity', label: 'Activity' },
  { href: '/agents', label: 'Agents' },
  { href: '/settings', label: 'Settings' },
] as const;

export const pageCopy: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Overview', subtitle: 'Strategies you can open, fund, and rebalance.' },
  '/portfolio': {
    title: 'Portfolio overview',
    subtitle: 'A clear view of what the vault holds and what the strategy is targeting.',
  },
  '/strategies': {
    title: 'Strategies',
    subtitle: 'Translate intent into deterministic rules you can inspect before signing.',
  },
  '/activity': {
    title: 'Activity',
    subtitle: 'Every trigger, proof and execution is visible, attributable and replay-safe.',
  },
  '/agents': {
    title: 'Agents',
    subtitle: 'Connect an MCP client with explicit scopes. Credentials are shown once and can be revoked.',
  },
  '/settings': {
    title: 'Settings',
    subtitle: 'Network, security and operational controls for this testnet workspace.',
  },
};

export function copyForPath(pathname: string) {
  if (/^\/strategies\/\d+$/.test(pathname)) {
    return { title: 'Strategy', subtitle: 'Value, mix, and the next verified rebalance.' };
  }
  return pageCopy[pathname] ?? pageCopy['/'];
}
