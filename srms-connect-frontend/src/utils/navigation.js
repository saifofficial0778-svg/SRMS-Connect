// The product's navigation map. Pure (no React / icon imports) so the "which section am I in"
// rules are unit tested; the shell pairs each key with an icon.
//
// Eight destinations, grouped the way people think about them:
//   primary   always in the top bar (desktop) - the six product areas
//   utility   Messages and Notifications live on the right as icon buttons
// Secondary pages (alumni directory vs. my connections, skill gap, analytics, introductions ...)
// are reached through tabs inside their section, not through more top-level links.

export const PRIMARY_NAV = [
  { key: "home", label: "Home", to: "/home", match: ["/home"] },
  { key: "network", label: "Network", to: "/alumni", match: ["/alumni", "/network", "/profile/"] },
  { key: "jobs", label: "Jobs", to: "/jobs", match: ["/jobs"] },
  { key: "mentorship", label: "Mentorship", to: "/mentorship", match: ["/mentorship"] },
  { key: "career", label: "Career", to: "/career", match: ["/career"] },
  { key: "insights", label: "Insights", to: "/industry-pulse", match: ["/industry-pulse", "/skill-gap", "/analytics"] },
];

export const MESSAGES_NAV = { key: "messages", label: "Messages", to: "/chat", match: ["/chat"] };

// phones get a bottom bar with the four most-used areas; the rest sit behind "More"
export const MOBILE_NAV_KEYS = ["home", "network", "jobs", "messages"];
export const MOBILE_MORE_KEYS = ["mentorship", "career", "insights"];

const matches = (pathname, prefix) =>
  prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`);

// "/profile" (your own profile) belongs to no section; "/profile/12" is someone in your network
export function isNavActive(item, pathname) {
  const path = String(pathname || "");
  return item.match.some((prefix) => matches(path, prefix));
}

export function activeNavKey(pathname) {
  const all = [...PRIMARY_NAV, MESSAGES_NAV];
  return all.find((item) => isNavActive(item, pathname))?.key || null;
}

export const navItem = (key) => [...PRIMARY_NAV, MESSAGES_NAV].find((item) => item.key === key);

// sub-navigation of the Network section
export const NETWORK_TABS = [
  { to: "/alumni", label: "Directory" },
  { to: "/network", label: "My network" },
];
