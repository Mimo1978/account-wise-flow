/** Colour identity for each top-level nav route. Used by nav bar, page accents, etc. */
export const NAV_COLOURS: Record<string, string> = {
  '/home': '#6366f1',
  '/projects': '#38bdf8',
  '/canvas': '#a78bfa',
  '/companies': '#34d399',
  '/crm/deals': '#fb923c',
  '/documents': '#fbbf24',
  '/accounts': '#22d3ee',
  '/contacts': '#f472b6',
  '/talent': '#2dd4bf',
  '/jobs': '#60a5fa',
  '/outreach': '#f87171',
  '/insights': '#a3e635',
  '/admin': '#e879f9',
};

/** Find the accent colour for a given pathname (matches prefix). */
export function getNavColour(pathname: string): string | undefined {
  // Exact match first, then prefix
  if (NAV_COLOURS[pathname]) return NAV_COLOURS[pathname];
  for (const [path, colour] of Object.entries(NAV_COLOURS)) {
    if (pathname.startsWith(path + '/') || pathname === path) return colour;
  }
  return undefined;
}
